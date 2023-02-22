import boomerang from 'boomerang-http'
import { UPDATE_AUTH } from './types'
import { findByPresentationKey } from '@cwi/users'
import { getSecretServerConfig, stateChecks, callCallback } from './utils'
import store from './store'

/**
 * Use this function to provide the 6-digit code that was sent to the user's phone by `submitPhoneNumber`. It should also be used when responding to the `onCodeRequired` event.
 *
 * You can choose to consume either the return value, the events raised by this function or both depending on the needs of your project.
 *
 * @param {string} code The code that was sent to the user's phone
 *
 * @returns {Promise<boolean>} Indicating that the provided code was accepted
 *
 * @fires onAuthenticationError When the code is missing or invalid
 * @fires onAuthenticationError The server has responded with an error
 * @fires onAccountStatusDiscovered The library has learned the account status of this person (either new-user or existing-user)
 * @fires onAuthenticationSuccess When called in response to an `onCodeRequired` event and the previously-requested operation was successful
 *
 * @throws {InvalidStateError} The library has not been initialized, or the user is already authenticated
 * @throws {InvalidStateError} A phone number was never submitted and no code has been sent
 * @throws {InvalidStateError} A code cannot be submitted with the current authentication mode
 * @private
 */
export default async code => {
  stateChecks(['init', 'phone'])
  if (!code || typeof code !== 'string') {
    return callCallback('onAuthenticationError', 'A code is required!')
  }
  if (isNaN(code)) {
    return callCallback(
      'onAuthenticationError', 'The code must contain only numeric digits!'
    )
  }
  if (code.length !== 6) {
    return callCallback(
      'onAuthenticationError', 'Ensure the code is 6 digits long!'
    )
  }
  const serverConfig = await getSecretServerConfig()
  const result = await boomerang(
    'POST',
    serverConfig.SMS.codeSubmissionEndpoint,
    {
      phone: store.getState().authFactors.phone,
      code
    }
  )
  if (result.status !== 'success') {
    return callCallback(
      'onAuthenticationError', result.description
    )
  }

  if (store.getState().authenticated === true) {
    return callCallback(
      'onPresentationKeyReceivedInternal',
      result.secret
    )
  }

  const presentationKey = Uint8Array.from(Buffer.from(result.secret, 'hex'))
  const searchResult = await findByPresentationKey({
    confederacyHost: store.getState().settings.confederacyHost,
    presentationKey
  })

  if (Array.isArray(searchResult)) {
    callCallback('onAccountStatusDiscovered', 'existing-user')
    store.dispatch({
      type: UPDATE_AUTH,
      payload: {
        authFactors: {
          ...store.getState().authFactors,
          presentationKey: result.secret
        },
        accountStatus: 'existing-user',
        accountDescriptor: searchResult
      }
    })
    return true
  } else {
    callCallback('onAccountStatusDiscovered', 'new-user')
    store.dispatch({
      type: UPDATE_AUTH,
      payload: {
        accountStatus: 'new-user',
        authFactors: {
          ...store.getState().authFactors,
          presentationKey: result.secret
        }
      }
    })
    return true
  }
}