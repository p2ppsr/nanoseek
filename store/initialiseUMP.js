import store from './store'
import {
  DEFAULT_PRIVILEGED_KEY_TIMEOUT,
  DEFAULT_SECRET_SERVER,
  DEFAULT_DOJO_URL,
  DEFAULT_CONFEDERACY_HOST,
  DEFAULT_APPROX_TRANSACTION_OVERHEAD
} from './defaults'
import { UPDATE_AUTH, UPDATE_SETTINGS } from './types'
import restoreSnapshot from './restoreSnapshot'
import { ValidationError } from '@cwi/errors'
import { BSV_DUST_LIMIT } from '@cwi/params'
import { callCallback } from './utils'

// Needed for browser-based support for K-256 curves
if (typeof document !== 'undefined') {
  const script = document.createElement('script')
  script.setAttribute(
    'src',
    'https://peculiarventures.github.io/pv-webcrypto-tests/src/elliptic.js'
  )
  script.setAttribute(
    'integrity',
    'sha384-AmhFrqYb3HHB8oKbCI+596yVjCBSiA7+PIkGUNXIU62ow06NoZ8OcOh76T0T8xeW'
  )
  script.setAttribute(
    'crossorigin',
    'anonymous'
  )
  script.onload = () => {
    // eslint-disable-next-line
    import('webcrypto-liner')
  }
  document.head.appendChild(script)
}

/**
 * Provide initial configuration parameters and/or state snapshots for the
 * library.
 *
 * Before you can use the authentication library, you must call this function
 * in order to set things up. At a minimum, provide your Planaria token (see
 * the [README](https://github.com/p2ppsr/cwi-core)) so that the library can
 * interact with the blockchain.
 *
 * You can also specify some configuration settings and give a state snapshot
 * from `createSnapshot` so that the user doesn't need to re-authenticate
 * whenever the page reloads.
 *
 * @param {Object} config
 * @param {number} [config.privilegedKeyTimeout=120] The timeout (given in  seconds) after which a password will be required in order to use the privileged key. Maximum 1800, 0 to disable caching completely.
 * @param {string} [config.secretServerURL=https://secretserver.babbage.systems] The URL of the secret server to use.
 * @param {string} [config.dojoURL=https://dojo.babbage.systems] The URL for the Dojo UTXO Management Server to use.
 * @param {string} [config.confederacyHost='https://confederacy.babbage.systems'] The default Confederacy host to use.
 * @param {array} [config.commissions=[]] An array of commission objects that can earn you revenue from calls to createAction. See the [commissions documentation](https://github.com/p2ppsr/cwi-core/blob/master/doc/COMMISSIONS.md) for more details.
 * @param {string} [config.stateSnapshot] A state snapshot created with createSnapshot that will be immediately applied.
 * @param {number} [config.approxTransactionOverhead=1500] A generous and approximate overhead needed to spend the new outputs that are created when funding a user account with more BSV tokens.
 *
 * @returns {Promise<boolean>} Indicating whether the specified configuration was successfully applied.
 *
 * @fires onInitialization When the library has been successfully initialized.
 *
 * @throws {TypeError} When secretServerURL is not a string
 * @throws {TypeError} When privilegedKeyTimeout is not a number
 * @throws {TypeError} When secretServerURL is not a string
 * @throws {ValidationError} When secretServerURL is not a valid URL
 * @throws {ValidationError} When the SecretServer at secretServerURL cannot be reached
 * @throws {ValidationError} When the SecretServer does not support SMS verification
 * @throws {ValidationError} When stateSnapshot cannot be applied
 * @throws {ValidationError} When privilegedKeyTimeout is not sane
 * @private
 */
export default async ({
  privilegedKeyTimeout = DEFAULT_PRIVILEGED_KEY_TIMEOUT,
  secretServerURL = DEFAULT_SECRET_SERVER,
  dojoURL = DEFAULT_DOJO_URL,
  confederacyHost = DEFAULT_CONFEDERACY_HOST,
  approxTransactionOverhead = DEFAULT_APPROX_TRANSACTION_OVERHEAD,
  stateSnapshot,
  commissions = []
}) => {
  if (isNaN(privilegedKeyTimeout)) {
    throw new TypeError(
      `privilegedKeyTimeout must be a number, but ${typeof privilegedKeyTimeout} was given!`
    )
  }

  if (!Number.isInteger(privilegedKeyTimeout)) {
    throw new ValidationError(
      'privilegedKeyTimeout must be a whole number of seconds!'
    )
  }

  if (privilegedKeyTimeout < -1) {
    throw new ValidationError(
      'privilegedKeyTimeout must be positive, zero or -1!'
    )
  }

  // if (!Array.isArray(confederacyHost)) {
  //   throw new TypeError(
  //     `confederacyHost must be an array, but ${typeof confederacyHost} was given!`
  //   )
  // }

  // confederacyHost.forEach((bridgeportResolver, index) => {
  //   if (typeof bridgeportResolver !== 'string') {
  //     throw new TypeError(
  //       `Every element of confederacyHost must be a string, but ${typeof bridgeportResolver} was given for element ${index}!`
  //     )
  //   }
  // })

  if (!Array.isArray(commissions)) {
    throw new TypeError(
      `commissions must be an array, but ${typeof commissions} was given!`
    )
  }

  commissions.forEach((commission, index) => {
    if (typeof commission !== 'object') {
      throw new TypeError(
        `Every element of commissions must be an object, but ${typeof commission} was given for element ${index}!`
      )
    }
    if (typeof commission.paymail === 'undefined') {
      throw new ValidationError(
        `Element ${index} of the commissions array is missing a paymail!`
      )
    }
    if (
      commission.paymail.indexOf('@') === -1 ||
      commission.paymail.split('@')[1].indexOf('.') === -1
    ) {
      throw new ValidationError(
        `Element ${index} of the commissions array contains an invalid paymail: ${commission.paymail}`
      )
    }
    if (typeof commission.amount === 'undefined') {
      throw new ValidationError(
        `Element ${index} of the commissions array is missing an amount!`
      )
    }
    if (
      isNaN(commission.amount) ||
      !Number.isInteger(commission.amount) ||
      commission.amount <= BSV_DUST_LIMIT
    ) {
      throw new ValidationError(
        `Element ${index} of the commissions array has an invalid amount. Ensure the amount is a positive whole number of satoshis greater than the dust limit of ${BSV_DUST_LIMIT}!`
      )
    }
    if (typeof commission.frequency !== 'undefined') {
      if (isNaN(commission.frequency)) {
        throw new TypeError(
          `Element ${index} of the commissions array has an invalid frequency. Ensure that the frequency is a number!`
        )
      }
      if (commission.frequency < 0 || commission.frequency > 1) {
        throw new ValidationError(
          `Element ${index} of the commissions array has an invalid frequency. Ensure that the frequency is a fraction of transactions between zero and one!`
        )
      }
      if (commission.frequency === 0) {
        throw new ValidationError(
          `Element ${index} of the commissions array has an invalid frequency. The frequency cannot be zero. A zero-frequency commission would mean that you never get paid!`
        )
      }
    }
  })

  store.dispatch({
    type: UPDATE_SETTINGS,
    payload: {
      privilegedKeyTimeout,
      secretServerURL,
      dojoURL,
      confederacyHost,
      approxTransactionOverhead
    }
  })
  store.dispatch({
    type: UPDATE_AUTH,
    payload: {
      initialized: true,
      commissions: [
        // Add theirs first so that they can't overwrite the CWI commission
        ...commissions,
        ...store.getState().commissions
      ]
    }
  })

  // Restore any snapshot that was provided
  if (typeof stateSnapshot !== 'undefined') {
    await restoreSnapshot(stateSnapshot)
  }

  /**
   * Fired whenever the library was successfully initialized.
   *
   * @event onInitialization
   * @private
   */
  callCallback('onInitialization')
  return true
}