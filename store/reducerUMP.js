import {
    UPDATE_AUTH,
    CLEAR_AUTH_FACTORS,
    UPDATE_SETTINGS,
    UPDATE_KEYS,
    UPDATE_CALLBACKS
  } from './types'
  import {
    DEFAULT_SECRET_SERVER,
    DEFAULT_PRIVILEGED_KEY_TIMEOUT,
    DEFAULT_DOJO_URL,
    DEFAULT_APPROX_TRANSACTION_OVERHEAD,
    DEFAULT_CONFEDERACY_HOST
  } from './defaults'
  
  export const initialState = {
    accountDescriptor: [],
    authFactors: {
      phone: undefined,
      presentationKey: undefined,
      password: undefined,
      recoveryKey: undefined
    },
    authenticated: false,
    initialized: false,
    authenticationMode: 'phone-number-and-password',
    accountStatus: 'existing-user',
    callbacks: {
      onInitialization: [],
      onAuthenticationSuccess: [],
      onAuthenticationError: [],
      onAccountStatusDiscovered: [],
      onBasketAccessRequested: [],
      onBasketAccessGrantedInternal: [],
      onBasketAccessDeniedInternal: [],
      onRecoveryKeyNeedsSaving: [],
      onRecoveryKeySavedInternal: [],
      onRecoveryKeyAbortedInternal: [],
      onPaymentRequired: [],
      onPaymentReceivedInternal: [],
      onPaymentAbortedInternal: [],
      onCodeRequired: [],
      onPresentationKeyReceivedInternal: [],
      onPresentationKeyAbortedInternal: [],
      onPasswordRequired: [],
      onPasswordReceivedInternal: [],
      onPasswordAbortedInternal: [],
      onProtocolPermissionRequested: [],
      onProtocolPermissionGrantedInternal: [],
      onProtocolPermissionDeniedInternal: [],
      onSpendingAuthorizationRequested: [],
      onSpendingAuthorizationGrantedInternal: [],
      onSpendingAuthorizationDeniedInternal: [],
      onCertificateAccessRequested: [],
      onCertificateAccessGrantedInternal: [],
      onCertificateAccessDeniedInternal: []
    },
    keys: {
      primaryKey: undefined,
      privilegedKey: undefined
    },
    secretServerConfig: undefined,
    dojoServerConfig: undefined,
    settings: {
      secretServerURL: DEFAULT_SECRET_SERVER,
      dojoURL: DEFAULT_DOJO_URL,
      confederacyHost: DEFAULT_CONFEDERACY_HOST,
      privilegedKeyTimeout: DEFAULT_PRIVILEGED_KEY_TIMEOUT,
      approxTransactionOverhead: DEFAULT_APPROX_TRANSACTION_OVERHEAD
    },
    // This is the CWI commission. Do not alter or remove it. Altering or removing the CWI commission is a violation of any licenses or agreements we have made with you, and may result in the termination of such agreements, or legal actions.
    commissions: [{
      paymail: 'p2ppsr@tyweb.us',
      amount: 3301,
      frequency: 1
    }]
  }
  
  const reducer = (state = initialState, action) => {
    switch (action.type) {
      case UPDATE_AUTH:
        return {
          ...state,
          ...action.payload
        }
      case CLEAR_AUTH_FACTORS:
        return {
          ...state,
          authFactors: initialState.authFactors
        }
      case UPDATE_SETTINGS:
        return {
          ...state,
          settings: {
            ...state.settings,
            ...action.payload
          }
        }
      case UPDATE_KEYS:
        return {
          ...state,
          keys: {
            ...state.keys,
            ...action.payload
          }
        }
      case UPDATE_CALLBACKS:
        return {
          ...state,
          callbacks: {
            ...state.callbacks,
            ...action.payload
          }
        }
      default:
        return state
    }
  }
  
  export default reducer