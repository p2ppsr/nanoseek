import store from './store'
import {
  stateChecks,
  bindCallbackInternal,
  unbindCallbackInternal,
  callCallback,
  getID
} from './utils'
import ensureSpendingAuthorization from './utils/ensureSpendingAuthorization'
import ensureBasketAccess from './utils/ensureBasketAccess'
import bsv from 'babbage-bsv'
import getNinja from './getNinja'
import isAdminOriginator from './utils/isAdminOriginator'
import { ValidationError } from '@cwi/errors'
import getPrimaryKey from './getPrimaryKey'
import { encrypt } from 'cwi-crypto'
import boomerang from 'boomerang-http'

/**
 * Creates and broadcasts a BitCoin transaction with the provided inputs and outputs. Notifies confederacy, supplying additional funding inputs if needed and creating additional change outputs to collect any extra coins.
 *
 * @param {Object} obj All parameters for this function are provided in an object
 * @param {Object} [obj.inputs] Input scripts to spend as part of this Action. This is an object whose keys are TXIDs and whose values are Everett-style transaction envelopes that contain an additional field called `outputsToRedeen`. This additional field is an array of objects, each containing `index` and `unlockingScript` properties. The `index` property is the output number in the transaction you are spending, and `unlockingScript` is the hex-encoded Bitcoin script that unlocks and spends the output. Any signatures should be created with `SIGHASH_NONE | ANYONECANPAY` so that additional modifications to the resulting transaction can be made afterward without invalidating them. You may substitute `SIGHASH_NONE` for `SIGHASH_SINGLE` if required for a token contract, or drop `ANYONECANPAY` if you are self-funding the Action.
 * @param {Array<Object>} [obj.outputs] The array of transaction outputs (amounts and scripts) that you want in the transaction. Each object contains "satoshis" and "script", which can be any custom locking script of your choosing.
 * @param {string} obj.description A present-tense description of the user Action being facilitated or represented by this BitCoin transaction.
 * @param {Array<String>} [obj.topics=[]] Topics to send this transaction to
 * @param {Array<String>} [obj.labels=[]] Labels to apply to this Action.
 * @param {string} args.originator The domain name of the application that is calling this function.
 *
 * @returns {Promise<Object>} An Action object containing "txid", "rawTx" "mapiResponses" and "inputs".
 *
 * @fires onPaymentRequired If there are insufficient funds available in the user account, this event will promot for a payment. Once `submitPayment` is called, the transaction will continue and the Promise will resulve.
 *
 * @throws {InvalidStateError} Library not initialized or no user is currently authenticated.
 */
const createAction = async params => {
  const {
    inputs = {},
    outputs = [],
    description,
    topics = [],
    labels = [],
    originator,
    _recursionCounter = 0,
    _lastRecursionError
  } = params

  if (!description) {
    throw new ValidationError(
      'Provide a present-tense description for your Action!'
    )
  }

  // Fetch the wrapped ninja object
  const ninja = getNinja()

  stateChecks(['init', 'auth'])
  const isAdminAction = isAdminOriginator(originator)
  if (labels.some(x => typeof x !== 'string')) {
    throw new ValidationError('All Action labels must be strings!')
  }
  if (!isAdminAction && labels.some(x => x.startsWith('babbage'))) {
    throw new ValidationError('No Action label can start with "babbage"!')
  }
  if (_recursionCounter >= 5) {
    throw _lastRecursionError
  }
  outputs.forEach(x => {
    if (x.satoshis < 1) {
      throw new ValidationError(
        'Every BitCoin output must contain at least one satoshi (if you are going to use Project Babbage).'
      )
    }
  })

  // Generate an encryption key to use
  const encryptionKey = await getPrimaryKey({
    protocolID: 'Babbage Action Description Obfuscation',
    keyID: '1'
  })

  // Encrypt the action description
  const encryptedDescription = await encrypt(
    description,
    await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(Buffer.from(encryptionKey, 'hex')),
      { name: 'AES-GCM' },
      false, ['encrypt']
    ),
    'string'
  )

  const lineItems = []
  // Get the total sum of the outputs' satoshis
  let totalOutputSum = 0
  // Make a deep copy of the outputs to retain plaintext params for recursive calls (consider optimizing further)
  const outputsWithEncryptedData = JSON.parse(JSON.stringify(outputs))

  // Encrypt each output description property if provided
  const outputBaskets = []
  for (const [i, output] of outputs.entries()) {
    // Validate that the originator has access to the given output basket
    if (output.basket && !outputBaskets.includes(output.basket)) {
      outputBaskets.push(output.basket)
      await ensureBasketAccess({
        basket: output.basket,
        originator
      })
    }

    if (!output.description) {
      // Default description
      output.description = 'No description provided'
    }

    // Validate output description length
    if (output.description.length > 50) {
      const e = new Error('Output descriptions must be under 50 characters')
      e.code = 'ERR_INVALID_LINE_ITEM'
      throw e
    }

    // Encrypt it
    const encryptedOutputDescription = await encrypt(
      output.description,
      await crypto.subtle.importKey(
        'raw',
        Uint8Array.from(Buffer.from(encryptionKey, 'hex')),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      ),
      'string'
    )
    totalOutputSum += output.satoshis
    lineItems.push({
      satoshis: output.satoshis * -1, // outputs are debits, thus negative
      description: output.description
    })
    // Replace plaintext description with encrypted version
    outputsWithEncryptedData[i].description = encryptedOutputDescription
  }

  // Total amount of outputs redeemed
  let totalAmountRedeemed = 0
  // Make a deep copy of the inputs to retain plaintext params for recursive calls
  const inputsWithEncryptedData = JSON.parse(JSON.stringify(inputs))

  // Encrypt spendingDescription for each output to redeem
  for (const [i, input] of Object.values(inputsWithEncryptedData).entries()) {
    const tx = new bsv.Transaction(input.rawTx)

    for (const [j, output] of input.outputsToRedeem.entries()) {
      if (!output.spendingDescription) {
        // Default description
        output.spendingDescription = 'Unspecified token input'
      }

      // Validate output to redeem description length
      if (output.spendingDescription.length > 50) {
        const e = new Error('Spending descriptions must be under 50 characters')
        e.code = 'ERR_INVALID_LINE_ITEM'
        throw e
      }

      // Encrypt it
      const encryptedSpendingDescription = await encrypt(
        output.spendingDescription,
        await crypto.subtle.importKey(
          'raw',
          Uint8Array.from(Buffer.from(encryptionKey, 'hex')),
          { name: 'AES-GCM' },
          false,
          ['encrypt']
        ),
        'string'
      )
      // Keep track of the total amount redeemed
      totalAmountRedeemed += tx.outputs[output.index].satoshis
      lineItems.push({
        satoshis: tx.outputs[output.index].satoshis, // inputs are credits (+)
        description: output.spendingDescription
      })
      // Replace the plaintext spending description with the encrypted version
      Object.values(inputsWithEncryptedData)[i].outputsToRedeem[j].spendingDescription = encryptedSpendingDescription
    }
  }

  // Create a Ninja transaction with the required parameters
  let referenceNumber
  try {
    const txResult = await ninja.getTransactionWithOutputs({
      inputs: { ...inputsWithEncryptedData },
      outputs: [
        ...outputsWithEncryptedData
        /// ...transactionCommissions
      ],
      labels: [
        `babbage_app_${originator}`,
        ...labels
      ],
      note: encryptedDescription,
      autoProcess: false
    })

    if (txResult.status === 'error') {
      const e = new Error(txResult.description)
      e.code = txResult.code
      throw e
    }

    const { rawTx, inputs: dojoInputs, amount, outputMap } = txResult
    referenceNumber = txResult.referenceNumber

    // Show the Bitcoin transaction fee
    lineItems.push({
      description: 'Bitcoin transaction fee',
      satoshis: Math.abs(totalOutputSum + totalAmountRedeemed - Math.abs(amount)) * -1
    })

    // Ensure authorization before broadcast
    // This only happens the first time we recursively call.
    // No authorization is needed if the user is receiving funds.
    if (_recursionCounter === 0 && amount > 0) {
      await ensureSpendingAuthorization({ originator, amount, lineItems })
    }

    const txid = new bsv.Transaction(rawTx).id

    // The outgoing transaction is processed by Ninja after being created
    const {
      mapiResponses
    } = await ninja.processTransaction({
      submittedTransaction: rawTx,
      reference: referenceNumber,
      outputMap,
      inputs: txResult.inputs
    })

    // To increase performance, we can get the return value back to the caller quickly before finishing transaction propagation.
    // eslint-disable-next-line
    return new Promise(async resolve => {
      resolve({ rawTx, inputs: dojoInputs, mapiResponses, txid })

      // Notify confederacy topic about the transaction using boomerang IFF there is at least one topic provided
      try {
        if (topics && topics.length !== 0) {
          await boomerang(
            'POST',
            `${store.getState().settings.confederacyHost}/submit`,
            {
              inputs: dojoInputs,
              mapiResponses,
              rawTx,
              topics
            }
          )
        }
      } catch (error) {
        // There is nothing we can or should do.
      }
    })
  } catch (e) {
    if (e.code !== 'ERR_NOT_SUFFICIENT_FUNDS') {
      throw e
    }

    // ERR_NOT_SUFFICIENT_FUNDS
    return new Promise((resolve, reject) => {
      const successCallback = () => {
        resolve(createAction({
          ...params,
          _recursionCounter: _recursionCounter + 1,
          _lastRecursionError: e
        }))
        unbindCallbackInternal('onPaymentReceivedInternal', successCallback)
        unbindCallbackInternal('onPaymentAbortedInternal', failureCallback)
      }
      const failureCallback = () => {
        const err = new Error(
          'The call to createAction failed because the user needed to fund their account, but they aborted the operation.'
        )
        err.code = 'ERR_ABORTED'
        reject(err)
        unbindCallbackInternal('onPaymentReceivedInternal', successCallback)
        unbindCallbackInternal('onPaymentAbortedInternal', failureCallback)
      }

      /*
        The functions themselves are tagged with payment IDs so that they can
        later be individually submitted or aborted by the consumer.
      */
      const paymentID = getID()
      successCallback.paymentID = paymentID
      failureCallback.paymentID = paymentID

      bindCallbackInternal(
        'onPaymentReceivedInternal',
        successCallback
      )
      bindCallbackInternal(
        'onPaymentAbortedInternal',
        failureCallback
      )
      callCallback(
        'onPaymentRequired',
        {
          /*
            The generous and approximate overhead needed to spend the new
            outputs is added to the amount of the payment to avoid another
            underpayment.
          */
          amount: e.moreSatoshisNeeded + store
            .getState()
            .settings
            .approxTransactionOverhead,
          reason: description,
          paymentID
        }
      )
    })
  }
}

export default createAction