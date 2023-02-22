import store from './store'
import stateChecks from './stateChecks'
import { XOR, encrypt } from 'cwi-crypto'
import { UPDATE_AUTH } from '../types'
import createAction from '../createAction'
import bsv from 'babbage-bsv'
import { getPaymentPrivateKey } from 'sendover'
import {
  ACCOUNT_DESCRIPTOR_FIELDS,
  CWI_PROTOCOL_ADDRESS,
  BSV_DUST_LIMIT
} from '@cwi/params'
import normalizeProtocol from './normalizeProtocol'
import pushdrop from 'pushdrop'
import { encodeUint8AsString } from 'cwi-array-encoding'
import boomerang from 'boomerang-http'

export default async ({
  passwordKeyRaw,
  recoveryKeyRaw,
  presentationKeyRaw,
  primaryKeyRaw,
  privilegedKeyRaw,
  passwordSaltRaw
} = {}) => {
  debugger
  stateChecks(['init', 'auth'])
  const currentDescriptor = store.getState().accountDescriptor
  const privilegedKey = await crypto.subtle.importKey(
    'raw',
    privilegedKeyRaw,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  const presentationHash = new Uint8Array(
    await crypto.subtle.digest(
      { name: 'SHA-256' },
      presentationKeyRaw
    )
  )
  const recoveryHash = new Uint8Array(
    await crypto.subtle.digest(
      { name: 'SHA-256' },
      recoveryKeyRaw
    )
  )
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

  const passwordPresentationPrimary = await encrypt(
    primaryKeyRaw,
    xorPasswordPresentation,
    'Uint8Array'
  )
  const passwordRecoveryPrimary = await encrypt(
    primaryKeyRaw,
    xorPasswordRecovery,
    'Uint8Array'
  )
  const presentationRecoveryPrimary = await encrypt(
    primaryKeyRaw,
    xorPresentationRecovery,
    'Uint8Array'
  )
  const passwordPrimaryPrivileged = await encrypt(
    privilegedKeyRaw,
    xorPasswordPrimary,
    'Uint8Array'
  )
  const presentationRecoveryPrivileged = await encrypt(
    privilegedKeyRaw,
    xorPresentationRecovery,
    'Uint8Array'
  )

  // The rendition (essentially the number of times the user token has been updated) is read from the account descriptor. A new rendition is calculated.
  const oldRenditionBuf = Buffer.from(currentDescriptor[ACCOUNT_DESCRIPTOR_FIELDS.currentRendition])
  const oldRendition = oldRenditionBuf.readUintBE(0, oldRenditionBuf.byteLength)
  const newRendition = oldRendition + 1
  let newRenditionBuf = newRendition.toString(16)
  if (newRenditionBuf.length % 2 !== 0) {
    newRenditionBuf = '0' + newRenditionBuf // Pad the hex before converting
  }
  newRenditionBuf = Buffer.from(newRenditionBuf, 'hex')

  // We'll need the old account update unlocking key, and the new key that will be used to re-lock the account token.
  const oldKey = bsv.PrivateKey.fromHex(getPaymentPrivateKey({
    recipientPrivateKey: Buffer.from(privilegedKeyRaw)
      .toString('hex'),
    senderPublicKey: bsv.PrivateKey.fromBuffer(Buffer.from(privilegedKeyRaw))
      .publicKey.toString(),
    invoiceNumber: `${normalizeProtocol('User Management')}-${oldRendition}`,
    returnType: 'hex'
  }))
  const newKey = bsv.PrivateKey.fromHex(getPaymentPrivateKey({
    recipientPrivateKey: Buffer.from(privilegedKeyRaw)
      .toString('hex'),
    senderPublicKey: bsv.PrivateKey.fromBuffer(Buffer.from(privilegedKeyRaw)).publicKey.toString(),
    invoiceNumber: `${normalizeProtocol('User Management')}-${newRendition}`,
    returnType: 'hex'
  }))

  const recoveryKeyHash = encodeUint8AsString(Uint8Array.from(
    currentDescriptor[ACCOUNT_DESCRIPTOR_FIELDS.recoveryHash]
  ))

  // Use confederacy to query for the
  const [foundUser] = await boomerang(
    'POST',
    `${store.getState().settings.confederacyHost}/lookup`,
    {
      provider: 'UMP',
      query: {
        recoveryKeyHash
      }
    }
  )

  const previousTXID = foundUser.txid
  const previousVout = foundUser.vout

  // Calc the previous outpoint
  let outputIndex = previousVout.toString(16)
  while (outputIndex.length < 8) {
    outputIndex = '0' + outputIndex
  }
  const previousOutpoint = `${previousTXID}${outputIndex}`

  const user = [
    Buffer.from(CWI_PROTOCOL_ADDRESS, 'utf8'),
    Buffer.from(previousOutpoint, 'hex'),
    newRenditionBuf,
    Buffer.from(passwordPresentationPrimary),
    Buffer.from(passwordRecoveryPrimary),
    Buffer.from(presentationRecoveryPrimary),
    Buffer.from(passwordPrimaryPrivileged),
    Buffer.from(presentationRecoveryPrivileged),
    Buffer.from(presentationHash),
    Buffer.from(passwordSaltRaw),
    Buffer.from(recoveryHash),
    Buffer.from(presentationKeyEncrypted),
    Buffer.from(recoveryKeyEncrypted),
    Buffer.from(passwordKeyEncrypted)
  ]
  const actionScript = await pushdrop.create({
    fields: user,
    key: newKey
  })

  await createAction({
    inputs: {
      [previousTXID]: {
        inputs: foundUser.inputs ? JSON.parse(foundUser.inputs) : undefined,
        mapiResponses: foundUser.mapiResponses ? JSON.parse(foundUser.mapiResponses) : undefined,
        proof: foundUser.proof ? JSON.parse(foundUser.proof) : undefined,
        rawTx: foundUser.rawTx,
        outputsToRedeem: [{
          index: previousVout,
          unlockingScript: await pushdrop.redeem({
            prevTxId: previousTXID,
            outputIndex: previousVout,
            outputAmount: foundUser.satoshis,
            lockingScript: Buffer.from(foundUser.outputScript).toString('hex'),
            key: oldKey
          })
        }]
      }
    },
    outputs: [{
      satoshis: BSV_DUST_LIMIT,
      script: actionScript
    }],
    originator: 'projectbabbage.com',
    description: 'Update your account credentials',
    topics: ['UMP']
  })
  store.dispatch({
    type: UPDATE_AUTH,
    payload: {
      accountDescriptor: [
        Array.from(newKey.publicKey.toBuffer()), // the public key
        Array.from(Buffer.from('ac', 'hex')), // OP_CHECKSIG
        ...user.map(x => Array.from(x))
      ]
    }
  })
  return true
}