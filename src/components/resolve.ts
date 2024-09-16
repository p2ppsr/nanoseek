import { isValidURL } from 'uhrp-url'
import * as pushdrop from 'pushdrop'
import PacketPay from '@packetpay/js'
import { NanoSeekError, ErrorWithCode } from '../utils/errors'
import {
  LookupResult,
  PushdropResult,
  PacketPayOptions
} from '../types/resolve'

/**
 * Locates HTTP URLs where content can be downloaded. It uses the passed Confederacy hosts or the default one.
 *
 * @param {Object} obj All parameters are passed in an object.
 * @param {String} obj.UHRPUrl The UHRP url to resolve.
 * @param {string} obj.confederacyHost HTTPS URL for for the Confederacy host with default setting.
 * @param {String} [obj.clientPrivateKey] Key used to resolve the file (for payment)
 *
 * @return {Array<String>} An array of HTTP URLs where content can be downloaded.
 * @throws {Error} If UHRP url parameter invalid or Confederacy hosts is not an array
 * or there is an error retrieving url(s) stored in the UHRP token.
 */
export const resolve = async (query: {
  UHRPUrl: string
  confederacyHost?: string
  clientPrivateKey?: string
}): Promise<string[]> => {
  if (!query.UHRPUrl || !isValidURL(query.UHRPUrl)) {
    throw new ErrorWithCode(
      'Invalid parameter UHRP url',
      'ERR_INVALID_UHRP_URL'
    )
  }

  // Use Confederacy UHRP lookup service
  const packetPayOptions: PacketPayOptions = {
    method: 'POST',
    body: {
      provider: 'UHRP',
      query: {
        UHRPUrl: query.UHRPUrl
      }
    }
  }

  if (query.clientPrivateKey) {
    packetPayOptions.clientPrivateKey = query.clientPrivateKey
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: Response & { body: any } = await PacketPay(
    `${query.confederacyHost}/lookup`,
    packetPayOptions
  )

  let lookupResult: LookupResult[] // Explicitly define the type
  try {
    // Use a more universal method to decode the response
    const jsonString =
      typeof response.body === 'string'
        ? response.body
        : Buffer.from(response.body).toString('utf-8')
    lookupResult = JSON.parse(jsonString) as LookupResult[] // Assert the type necessary

    // Check for any errors returned and create error to notify bugsnag.
    if (lookupResult.length > 0 && lookupResult[0].status === 'error') {
      throw new ErrorWithCode(
        lookupResult[0].description || 'Unknown error occurred',
        lookupResult[0].code || 'ERR_UNKNOWN'
      )
    }
  } catch (error) {
    console.error('Error parsing Confederacy response:', error)
    if (error instanceof SyntaxError) {
      throw new NanoSeekError(
        'Confederacy lookup failed: Invalid JSON response',
        'ERR_INVALID_JSON'
      )
    } else {
      throw new NanoSeekError(
        'Confederacy lookup failed: Unexpected error',
        'ERR_CONFEDERACY_LOOKUP'
      )
    }
  }

  // Handle empty response
  if (lookupResult.length < 1) {
    // Check for at least one result
    return [] // Return an empty array
  }

  // Add a check for the expected structure of lookupResult
  if (
    !lookupResult[0] ||
    !Object.prototype.hasOwnProperty.call(lookupResult[0], 'outputScript')
  ) {
    throw new NanoSeekError(
      'Invalid response format from Confederacy',
      'ERR_INVALID_CONFEDERACY_RESPONSE'
    )
  }

  if (!lookupResult[0].outputScript) {
    throw new NanoSeekError(
      'Invalid response format',
      'ERR_INVALID_CONFEDERACY_RESPONSE_FORMAT'
    )
  }

  const result = pushdrop.decode({
    script: lookupResult[0].outputScript,
    fieldFormat: 'utf8'
  }) as PushdropResult

  if (!result || !Array.isArray(result.fields) || result.fields.length < 5) {
    throw new NanoSeekError(
      'Invalid pushdrop decode result',
      'ERR_INVALID_PUSHDROP_RESULT'
    )
  }

  const urls = result.fields[4]
    .toString()
    .split('\n')
    .filter(url => url.trim() !== '')
  return urls
}
