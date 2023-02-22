import { stateChecks, cachePrivilegedKey, callCallback } from './utils'
import store from './store'
import { InvalidStateError } from '@cwi/errors'
import {
  encodeUint8AsString,
  decodeUint8FromString
} from 'cwi-array-encoding'
import {
  ACCOUNT_DESCRIPTOR_FIELDS
} from '@cwi/params'
import { UPDATE_AUTH, CLEAR_AUTH_FACTORS } from './types'
import { XOR, decrypt } from 'cwi-crypto'
import { findByRecoveryKey } from '@cwi/users'
import Ninja from 'utxoninja'
import bsv from 'babbage-bsv'
import { getPaymentPrivateKey } from 'sendover'

/**
 * Use this function when the authenticatino mode is recovery-key-and-password or phone-number-and-recovery-key to submit the recovery key
 *
 * You can choose to consume either the return value, the events raised by this function or both depending on the needs of your project.
 *
 * @param {string} recoveryKey The recovery key to be submitted
 *
 * @returns {Promise<boolean>} Indicating whether the key was successfully submitted.
 *
 * @fires onAuthenticationError When the recovery key is missing or malformed
 * @fires onAuthenticationError When the recovery key is incorrect
 * @fires onAuthenticationSuccess When the authentication mode is phone-number-and-recovery-key, submitting a correct recovery key authenticates the user
 *
 * @throws {InvalidStateError} The library has not been initialized or the user is already authenticated
 * @throws {InvalidStateError} A recovery key cannot be submitted with the current authentication mode
 * @throws {InvalidStateError} If the authentication mode is phone-number-and-recovery-key, you must submit a phone number and code before you can submit the recovery key
 * @private
 */
export default async recoveryKey => {
  stateChecks(['init', 'no-auth'])
  if (
    !['recovery-key-and-password', 'phone-number-and-recovery-key']
      .some(x => x === store.getState().authenticationMode)
  ) {
    throw new InvalidStateError(
      'A recovery key cannot be submitted with the current authentication mode'
    )
  }
  if (typeof recoveryKey === 'undefined') {
    return callCallback('onAuthenticationError', 'A recovery key is required!')
  }
  try {
    const array = decodeUint8FromString(recoveryKey)
    if (array.byteLength !== 32) {
      throw new Error(`byteLength must be 32, but ${array.byteLength} given!`)
    }
  } catch (e) {
    return callCallback(
      'onAuthenticationError',
      'This recovery key is not in the correct format!'
    )
  }
  if (store.getState().authenticationMode === 'recovery-key-and-password') {
    const queryResult = await findByRecoveryKey({
      confederacyHost: store.getState().settings.confederacyHost,
      recoveryKey: decodeUint8FromString(recoveryKey)
    })
    if (Array.isArray(queryResult)) {
      store.dispatch({
        type: UPDATE_AUTH,
        payload: {
          accountDescriptor: queryResult,
          authFactors: {
            recoveryKey
          }
        }
      })
      return true
    } else {
      return callCallback(
        'onAuthenticationError',
        'That recovery key isn\'t correct!'
      )
    }
  } else {
    stateChecks(['presentationKey'])
    const accountDescriptor = store.getState().accountDescriptor
    const recoveryKeyRaw = decodeUint8FromString(recoveryKey)
    const presentationKeyRaw = Uint8Array.from(Buffer.from(
      store.getState().authFactors.presentationKey,
      'hex'
    ))
    const xorPresentationRecovery = await crypto.subtle.importKey(
      'raw',
      XOR(
        presentationKeyRaw,
        recoveryKeyRaw
      ),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    let primaryKeyRaw
    try {
      primaryKeyRaw = await decrypt(
        new Uint8Array(accountDescriptor[
          ACCOUNT_DESCRIPTOR_FIELDS.presentationRecoveryPrimary
        ]),
        xorPresentationRecovery,
        'Uint8Array'
      )
    } catch (e) {
      return callCallback(
        'onAuthenticationError',
        'That recovery key isn\'t correct!'
      )
    }
    const privilegedKeyRaw = await decrypt(
      new Uint8Array(accountDescriptor[
        ACCOUNT_DESCRIPTOR_FIELDS.presentationRecoveryPrivileged
      ]),
      xorPresentationRecovery,
      'Uint8Array'
    )
    const privilegedKeyStr = encodeUint8AsString(privilegedKeyRaw)
    store.dispatch({
      type: CLEAR_AUTH_FACTORS
    })
    store.dispatch({
      type: UPDATE_AUTH,
      payload: {
        authenticated: true,
        keys: {
          primaryKey: encodeUint8AsString(primaryKeyRaw)
        },
        ninja: new Ninja({
          privateKey: getPaymentPrivateKey({
            recipientPrivateKey: Buffer.from(encodeUint8AsString(primaryKeyRaw), 'base64').toString('hex'),
            senderPublicKey: bsv.PrivateKey.fromHex(Buffer.from(encodeUint8AsString(primaryKeyRaw), 'base64').toString('hex')).publicKey.toString(),
            invoiceNumber: '1',
            returnType: 'hex'
          }),
          config: {
            dojoURL: store.getState().settings.dojoURL
          }
        })
      }
    })
    cachePrivilegedKey(privilegedKeyStr)
    callCallback(
      'onAuthenticationSuccess',
      {}
    )
    return true
  }
}