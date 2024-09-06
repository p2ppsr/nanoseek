import { QueryResult, getUrlFromQueryResult } from './utils/getUrlFromQueryResult'
import { isValidURL, getHashFromURL, getURLForHash } from 'uhrp-url'
import * as pushdrop from 'pushdrop'
import fetch from 'isomorphic-fetch'
import PacketPay from '@packetpay/js'
import crypto from 'crypto'

interface ErrorWithCode extends Error {
  code?: string
}

interface ResolveParams {
  UHRPUrl?: string
  confederacyHost?: string
  clientPrivateKey?: string
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
const resolve = async ({
  UHRPUrl,
  confederacyHost = 'https://confederacy.babbage.systems',
  clientPrivateKey
}: ResolveParams = {}): Promise<string[] | null> => {
  if (!UHRPUrl || !isValidURL(UHRPUrl)) {
    const e: ErrorWithCode = new Error('Invalid parameter UHRP url')
    e.code = 'ERR_INVALID_UHRP_URL'
    throw e
  }

  // Use Confederacy UHRP lookup service
  const response: { body: Buffer } = await PacketPay(`${confederacyHost}/lookup`, {
    method: 'POST',
    body: {
      provider: 'UHRP',
      query: {
        UHRPUrl
      }
    }
  }, { clientPrivateKey })
  const lookupResult: LookupResult[] = JSON.parse(Buffer.from(response.body).toString('utf8'))

  // Check for any errors returned and create error to notify bugsnag.
  if (lookupResult[0]?.status === 'error') {
    const e: ErrorWithCode = new Error(lookupResult[0].description || 'Unknown error')
    e.code = lookupResult[0].code || 'ERR_UNKNOWN'
    throw e
  }

  if (lookupResult.length < 1) {
    return null
  }

  const decodedResults: string[] = []

  // Decode the UHRP token fields
  try {
    for (let i = 0; i < lookupResult.length; i++) {
      if (lookupResult[i].outputScript) {
        const decodedResult = pushdrop.decode({
          script: lookupResult[i].outputScript as string,
          fieldFormat: 'buffer'
        })
        const url = getUrlFromQueryResult(decodedResult as QueryResult)
        if (url) {
          decodedResults.push(url)
        }
      }
    }
  } catch (e) {
    throw new Error(`Error retrieving url stored in the UHRP token: ${(e as Error).message}`)
  }
  return decodedResults
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
  UHRPUrl = getURLForHash(hash)

  // A list of potential download URLs are resolved
  const URLs = await resolve({ UHRPUrl, confederacyHost, clientPrivateKey })

  // Make sure we get a list of potential URLs before trying to fetch
  if (!URLs || URLs.length === 0) {
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
        mimeType: result.headers.get('Content-Type')
      }
    } catch (e) {
      console.error(e)
      // In case of any errors with this url, continue to the next one
      continue
    }
  }

  // If the loop finishes without success, the content cannot be downloaded
  const e: ErrorWithCode = new Error(`Unable to download content from ${UHRPUrl}`)
  e.code = 'ERR_INVALID_DOWNLOAD_URL'
  throw e
}

export { resolve, download }
