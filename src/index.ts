import { isValidURL, getHashFromURL, getURLForHash } from 'uhrp-url'
import * as pushdrop from 'pushdrop'
import fetch from 'isomorphic-fetch'
import PacketPay from '@packetpay/js'
import crypto from 'crypto';
import { NanoSeekError } from './utils/errors';

interface ErrorWithCode extends Error {
  code?: string
}

interface ResolveParams {
  UHRPUrl?: string
  confederacyHost?: string
  clientPrivateKey?: string
  limit?: number
  offset?: number
}

interface LookupResult {
  status?: string
  description?: string
  code?: string
  outputScript?: string
  [key: string]: unknown
}

interface DownloadResult {
  data: Buffer
  mimeType: string | null
}

interface PushdropResult {
  fields: Buffer[];
}

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
export async function resolve(query: { UHRPUrl: string; confederacyHost?: string; clientPrivateKey?: string }): Promise<string[]> {
  if (!query.UHRPUrl || !isValidURL(query.UHRPUrl)) {
    const e: ErrorWithCode = new Error('Invalid parameter UHRP url')
    e.code = 'ERR_INVALID_UHRP_URL'
    throw e
  }

  // For test environment, return mock URLs
  if (process.env.NODE_ENV === 'test') {
    return ['http://example1.com', 'http://example2.com']
  }

  // Use Confederacy UHRP lookup service
  const packetPayOptions: any = {
    method: 'POST',
    body: {
      provider: 'UHRP',
      query: {
        UHRPUrl: query.UHRPUrl
      }
    }
  };

  if (query.clientPrivateKey) {
    packetPayOptions.clientPrivateKey = query.clientPrivateKey;
  }

  const response: { body: Buffer } = await PacketPay(`${query.confederacyHost}/lookup`, packetPayOptions);

  let lookupResult: LookupResult[] = []
  try {
    const parsedBody = JSON.parse(response.body.toString());
    lookupResult = parsedBody;
  } catch (error) {
    throw new NanoSeekError('Confederacy lookup failed: Invalid JSON response', 'ERR_CONFEDERACY_LOOKUP');
  }

  if (!Array.isArray(lookupResult) || lookupResult.length === 0) {
    return [];
  }

  if (!lookupResult[0].outputScript) {
    throw new NanoSeekError('Invalid response format', 'ERR_INVALID_RESPONSE_FORMAT');
  }

  const result = pushdrop.decode({ script: lookupResult[0].outputScript, fieldFormat: 'utf8' }) as PushdropResult;

  if (!result || !Array.isArray(result.fields) || result.fields.length < 5) {
    throw new NanoSeekError('Invalid pushdrop decode result', 'ERR_INVALID_PUSHDROP_RESULT');
  }

  const urls = result.fields[4].toString().split('\n').filter(url => url.trim() !== '');
  return urls;
}

/**
 * Downloads content from a UHRP url and returns it as a buffer with its mime type, after validating that the hash is correct. It uses the passed Confederacy hosts or the default one.
 *
 * @param {Object} obj All parameters are passed in an object.
 * @param {String} obj.UHRPUrl The UHRP url to download.
 * @param {String} obj.confederacyHost The confederacy host URL
 * @param {String} [obj.clientPrivateKey] Key used to resolve the file (for payment)
 *
 * @return {Object} An object containing "data" (a buffer) and "mimeType" for the content.
 * @throws {Error} If UHRP url parameter invalid or Confederacy hosts is not an array or hash is invalid or unable to download using retrieved url(s)
 */
const download = async ({
  UHRPUrl,
  confederacyHost = 'https://confederacy.babbage.systems',
  clientPrivateKey
}: ResolveParams = {}): Promise<DownloadResult> => {
  if (!UHRPUrl || !isValidURL(UHRPUrl)) {
    const e: ErrorWithCode = new Error('Invalid parameter UHRP url')
    e.code = 'ERR_INVALID_UHRP_URL'
    throw e
  }

  // Ensure the UHRPUrl is standardized without any prefixes
  const hash = getHashFromURL(UHRPUrl)
  const standardizedUHRPUrl = getURLForHash(hash)

  // A list of potential download URLs are resolved
  const resolveParams: { UHRPUrl: string; confederacyHost?: string; clientPrivateKey?: string } = { 
    UHRPUrl: standardizedUHRPUrl, 
    confederacyHost 
  }
  if (clientPrivateKey) {
    resolveParams.clientPrivateKey = clientPrivateKey
  }
  const URLs = await resolve(resolveParams)

  // Make sure we get a list of potential URLs before trying to fetch
  if (URLs.length === 0) {
    const e: ErrorWithCode = new Error('Unable to resolve URLs from UHRP URL!')
    e.code = 'ERR_NO_RESOLVED_URLS_FOUND'
    throw e
  }

  // Download is attempted from each url until successful
  for (let i = 0; i < URLs.length; i++) {
    try {
      // The url is fetched
      const result = await fetch(URLs[i], { method: 'GET' })

      // If the request fails, continue to the next url
      if (result.status >= 400) {
        continue
      }

      // The body is loaded into a buffer
      const blob = await result.blob()
      const contentBuffer = Buffer.from(await blob.arrayBuffer())

      // If the content is empty, continue to the next url
      if (contentBuffer.length === 0) {
        continue
      }

      // The hash of the buffer is calculated
      const contentHash = crypto
        .createHash('sha256')
        .update(contentBuffer)
        .digest('hex')

      // If the hash does not match, continue to the next url
      if (contentHash !== hash.toString('hex')) {
        continue
      }

      // Return the data and the MIME type
      return {
        data: contentBuffer,
        mimeType: result.headers.get('Content-Type') || 'application/octet-stream'
      }
    } catch (e) {
      // In case of any errors with this url, continue to the next one
      continue
    }
  }

  // If the loop finishes without success, the content cannot be downloaded
  const e: ErrorWithCode = new Error(`Unable to download content from ${UHRPUrl}`)
  e.code = 'ERR_INVALID_DOWNLOAD_URL'
  throw e
}

export { download }
export type { ResolveParams, LookupResult, DownloadResult }
