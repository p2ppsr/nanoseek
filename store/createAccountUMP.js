import { keyFromString, XOR, encrypt } from 'cwi-crypto'
import {
  encodeUint8AsString,
  decodeUint8FromString
} from 'cwi-array-encoding'
import { UPDATE_AUTH, CLEAR_AUTH_FACTORS } from './types'
import store from './store'
import {
  stateChecks,
  cachePrivilegedKey,
  getSecretServerConfig,
  normalizeProtocol
} from './utils'
import pushdrop from 'pushdrop'
import bsv from 'babbage-bsv'
import boomerang from 'boomerang-http'
import callCallback from './utils/callCallback'
import {
  generateKeypair,
  getPaymentPrivateKey,
  getPaymentAddress
} from 'sendover'
import Ninja from 'utxoninja'
import rPuzzle from 'babbage-rpuzzle'
import { BSV_DUST_LIMIT, CWI_PROTOCOL_ADDRESS } from '@cwi/params'

export default async () => {
  stateChecks([
    'init', 'no-auth', 'presentationKey', 'recoveryKey', 'password', 'new-user'
  ])

  // Generate primary and privileged keys
  const primaryKeypair = generateKeypair({ returnType: 'babbage-bsv' })
  const primaryKeyRaw = Uint8Array.from(
    primaryKeypair.privateKey.bn.toBuffer({ size: 32 })
  )
  const privilegedKeypair = generateKeypair({ returnType: 'babbage-bsv' })
  const privilegedKeyRaw = Uint8Array.from(
    privilegedKeypair.privateKey.bn.toBuffer({ size: 32 })
  )
  const privilegedKey = await crypto.subtle.importKey(
    'raw',
    privilegedKeyRaw,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  // Import the three auth factors and salt the password
  const {
    password: passwordString,
    recoveryKey: recoveryKeyString,
    presentationKey: presentationKeyString
  } = store.getState().authFactors
  const passwordSalt = crypto.getRandomValues(new Uint8Array(32))
  const passwordKey = await keyFromString({
    string: passwordString,
    salt: passwordSalt
  })
  const passwordKeyRaw = new Uint8Array(await crypto.subtle.exportKey(
    'raw',
    passwordKey
  ))
  const presentationKeyRaw = Uint8Array.from(Buffer.from(
    presentationKeyString,
    'hex'
  ))
  const recoveryKeyRaw = decodeUint8FromString(recoveryKeyString)

  // XOR the various keys
  const xorPasswordPresentation = await crypto.subtle.importKey(
    'raw',
    XOR(passwordKeyRaw, presentationKeyRaw),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  const xorPasswordRecovery = await crypto.subtle.importKey(
    'raw',
    XOR(passwordKeyRaw, recoveryKeyRaw),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  const xorPresentationRecovery = await crypto.subtle.importKey(
    'raw',
    XOR(presentationKeyRaw, recoveryKeyRaw),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  const xorPasswordPrimary = await crypto.subtle.importKey(
    'raw',
    XOR(passwordKeyRaw, primaryKeyRaw),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  /*
    Primary key is encrypted three times
  */
  // 1. xor_password_presentation
  const passwordPresentationPrimary = await encrypt(
    primaryKeyRaw,
    xorPasswordPresentation,
    'Uint8Array'
  )

  // 2. xor_password_recovery
  const passwordRecoveryPrimary = await encrypt(
    primaryKeyRaw,
    xorPasswordRecovery,
    'Uint8Array'
  )

  // 3. xor_presentation_recovery
  const presentationRecoveryPrimary = await encrypt(
    primaryKeyRaw,
    xorPresentationRecovery,
    'Uint8Array'
  )

  /*
    Privileged access key is encrypted twice
  */
  // 1. xor_password_primary
  const passwordPrimaryPrivileged = await encrypt(
    privilegedKeyRaw,
    xorPasswordPrimary,
    'Uint8Array'
  )

  // 2. xor_presentation_recovery
  const presentationRecoveryPrivileged = await encrypt(
    privilegedKeyRaw,
    xorPresentationRecovery,
    'Uint8Array'
  )

  // Encrypt each of the auth factors with the privileged key
  const presentationKeyEncrypted = await encrypt(
    presentationKeyRaw,
    privilegedKey,
    'Uint8Array'
  )
  const recoveryKeyEncrypted = await encrypt(
    recoveryKeyRaw,
    privilegedKey,
    'Uint8Array'
  )
  const passwordKeyEncrypted = await encrypt(
    passwordKeyRaw,
    privilegedKey,
    'Uint8Array'
  )

  // Hash presentation key and recovery key
  const presentationHash = new Uint8Array(await crypto.subtle.digest(
    { name: 'SHA-256' },
    presentationKeyRaw
  ))
  const recoveryHash = new Uint8Array(await crypto.subtle.digest(
    { name: 'SHA-256' },
    recoveryKeyRaw
  ))

  // Create a Dojo account and load the CWI default configuration
  const ninjaPrivateKey = getPaymentPrivateKey({
    recipientPrivateKey: primaryKeypair.privateKey,
    senderPublicKey: primaryKeypair.publicKey,
    invoiceNumber: '1',
    returnType: 'hex'
  })
  const ninjaConfig = {
    dojoURL: store.getState().settings.dojoURL
  }
  const ninja = new Ninja({
    privateKey: ninjaPrivateKey,
    config: ninjaConfig
  })

  // Create the UMP transaction and add the faucet input
  const UMPTransaction = new bsv.Transaction()

  // Redeem the R-puzzle input from the faucet
  const serverConfig = await getSecretServerConfig()
  if (!serverConfig.faucetEnabled) {
    const e = new Error(
      'The Babbage SecretServer operator has disabled a BitCoin faucet that is needed when creating your account.'
    )
    e.code = 'FAUCET_DISABLED'
    throw e
  }
  const faucetResponse = await boomerang(
    'POST',
    serverConfig.faucet.endpoint,
    { secret: presentationKeyString }
  )
  if (faucetResponse.status !== 'success') {
    const e = new Error(faucetResponse.description)
    e.code = faucetResponse.code
    throw e
  }
  if (!faucetResponse.k) {
    const e = new Error('Faucet did not respond as expected.')
    e.response = faucetResponse
    e.code = 'ERR_MALFORMED_FAUCET_RESPONSE'
    throw e
  }

  // An R puzzle is constructed from the faucet response
  const faucetRPuzzle = rPuzzle(
    rPuzzle.KValue.fromHex(faucetResponse.k)
  )
  const faucetTransaction = bsv.Transaction(faucetResponse.tx)
  const faucetInput = faucetRPuzzle.getUTXOs(faucetTransaction)
  UMPTransaction.from(faucetInput)
  let outputIndex = faucetInput[0].outputIndex.toString(16)
  while (outputIndex.length < 8) {
    outputIndex = '0' + outputIndex
  }
  const issuanceId = `${faucetInput[0].txId}${outputIndex}`

  const user = [
    Buffer.from(CWI_PROTOCOL_ADDRESS, 'utf8'),
    Buffer.from(issuanceId, 'hex'), // Issuance txid and output index (faucet)
    Buffer.from('01', 'hex'), // current UMP message (1 for new user)
    Buffer.from(passwordPresentationPrimary),
    Buffer.from(passwordRecoveryPrimary),
    Buffer.from(presentationRecoveryPrimary),
    Buffer.from(passwordPrimaryPrivileged),
    Buffer.from(presentationRecoveryPrivileged),
    Buffer.from(presentationHash),
    Buffer.from(passwordSalt),
    Buffer.from(recoveryHash),
    Buffer.from(presentationKeyEncrypted),
    Buffer.from(recoveryKeyEncrypted),
    Buffer.from(passwordKeyEncrypted)
  ]

  // Create an outgoing Ninja transaction with the faucet input and the Stas minting output for the new user. The remaining faucet funds are put into a change output with Dojo
  const {
    referenceNumber: reference, inputs, outputs, derivationPrefix, paymailHandle
  } = await ninja.createTransaction({
    inputs: {
      [faucetResponse.txid]: {
        outputsToRedeem: [{
          unlockingScriptLength: 107,
          index: 0
        }],
        rawTx: faucetResponse.tx,
        mapiResponses: faucetResponse.mapi_responses
          ? JSON.parse(faucetResponse.mapi_responses)
          : undefined,
        inputs: faucetResponse.inputs
          ? JSON.parse(faucetResponse.inputs)
          : undefined,
        proof: faucetResponse.proof
          ? JSON.parse(faucetResponse.proof)
          : undefined
      }
    },
    outputs: [{
      script: await pushdrop.create({ // Tell Dojo about the UMP script
        fields: user,
        /*
        The key used is message ID #1 in "User Management" protocol, because
        this is a new account. When the account is updated, the UTXO will be
        spent to key 2, 3 and so on. To see this in action, look at how the
        previous UTXO is spent as an input in updateAuthFactors, and
        transferred to the next key when it is re-created.
      */
        key: bsv.PrivateKey.fromHex(getPaymentPrivateKey({
          recipientPrivateKey: privilegedKeypair.privateKey,
          senderPublicKey: privilegedKeypair.publicKey,
          invoiceNumber: `${normalizeProtocol('User Management')}-1`,
          returnType: 'hex'
        }))
      }),
      satoshis: BSV_DUST_LIMIT
    }],
    note: 'Create your account',
    labels: ['babbage_app_projectbabbage.com']
  })

  const outputMap = {}
  outputs.forEach((out, i) => {
    if (out.providedBy === 'dojo' && out.purpose === 'change') {
      // Derive a change output script
      // Get derivation invoice data
      const derivationSuffix = out.derivationSuffix
      outputMap[derivationSuffix] = i
      const invoiceNumber = `2-3241645161d8-${paymailHandle} ${derivationPrefix} ${derivationSuffix}`
      // Derive the public key used for creating the output script
      const derivedAddress = getPaymentAddress({
        recipientPublicKey: bsv.PrivateKey.fromHex(ninjaPrivateKey)
          .publicKey.toString(),
        senderPrivateKey: ninjaPrivateKey,
        invoiceNumber,
        returnType: 'address'
      })
      // Create an output script that can only be unlocked with the corresponding derived private key
      UMPTransaction.addOutput(new bsv.Transaction.Output({
        script: new bsv.Script(
          bsv.Script.fromAddress(derivedAddress)
        ),
        satoshis: out.satoshis
      }))
    } else { // Add the output script
      UMPTransaction.addOutput(new bsv.Transaction.Output({
        script: new bsv.Script(out.script),
        satoshis: out.satoshis
      }))
    }
  })

  // Sign the transaction with the R-puzzle
  faucetRPuzzle.sign(UMPTransaction)

  // Serialize and broadcast the UMP transaction
  const transactionHex = UMPTransaction.uncheckedSerialize()
  const { mapiResponses } = await ninja.processTransaction({
    submittedTransaction: transactionHex,
    reference,
    outputMap,
    inputs
  })

  // Notify Confederacy of the transaction
  await boomerang(
    'POST',
    `${store.getState().settings.confederacyHost}/submit`,
    {
      inputs,
      mapiResponses,
      rawTx: transactionHex,
      topics: ['UMP']
    }
  )

  // New values are put into the Redux state machine
  store.dispatch({
    type: UPDATE_AUTH,
    payload: {
      authenticated: true,
      keys: {
        primaryKey: encodeUint8AsString(primaryKeyRaw)
      },
      accountDescriptor: [
        Array.from(Uint8Array.from(
          UMPTransaction.outputs[0].script.chunks[0].buf
        )), // the public key
        Array.from(Buffer.from('ac', 'hex')), // OP_CHECKSIG
        ...user.map(x => Array.from(x))
      ],
      ninja
    }
  })
  store.dispatch({
    type: CLEAR_AUTH_FACTORS
  })

  // The privileged key is cached for future use
  cachePrivilegedKey(encodeUint8AsString(privilegedKeyRaw))

  // Consumers are notified about the existence of the new user
  callCallback(
    'onAuthenticationSuccess',
    {}
  )
  return true
}