import { isValidURL, getHashFromURL, getURLForHash } from 'uhrp-url'
import fetch from 'isomorphic-fetch'
import crypto from 'crypto'
import { resolve } from './resolve'
import { ResolveParams, DownloadResult } from '../types/download'
import { ErrorWithCode } from '../utils/errors'

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
export const download = async ({
  UHRPUrl,
  confederacyHost = 'https://confederacy.babbage.systems',
  clientPrivateKey
}: ResolveParams = {}): Promise<DownloadResult> => {
  if (!UHRPUrl || !isValidURL(UHRPUrl)) {
    throw new ErrorWithCode(
      'Invalid parameter UHRP url',
      'ERR_INVALID_UHRP_URL'
    )
  }

  const hash = getHashFromURL(UHRPUrl)
  const standardizedUHRPUrl = getURLForHash(hash)
  const resolveParams = {
    UHRPUrl: standardizedUHRPUrl,
    confederacyHost,
    ...(clientPrivateKey && { clientPrivateKey })
  }

  const URLs = await resolve(resolveParams)

  if (URLs.length === 0) {
    throw new ErrorWithCode(
      'Unable to resolve URLs from UHRP URL!',
      'ERR_NO_RESOLVED_URLS_FOUND'
    )
  }

  for (let i = 0; i < URLs.length; i++) {
    try {
      const result = await fetch(URLs[i], { method: 'GET' })

      if (result.status >= 400) {
        throw new ErrorWithCode(
          `Failed to fetch content from ${URLs[i]}: HTTP status ${result.status}`,
          'ERR_FAILED_TO_FETCH_CONTENT'
        )
      }

      const blob = await result.blob()
      const contentBuffer = Buffer.from(await blob.arrayBuffer())

      if (contentBuffer.length === 0) {
        throw new ErrorWithCode(
          `Empty content from ${URLs[i]}`,
          'ERR_FETCHED_EMPTY_CONTENT'
        )
      }

      const contentHash = crypto
        .createHash('sha256')
        .update(contentBuffer)
        .digest('hex')

      // Ensure both are compared as strings in hex format
      if (contentHash !== hash.toString('hex')) {
        throw new ErrorWithCode(
          `Hash mismatch for content from ${URLs[i]}: Expected ${hash.toString('hex')}, got ${contentHash}`,
          'ERR_HASH_MISMATCH_FOR_CONTENT'
        )
      }

      return {
        data: contentBuffer,
        mimeType:
          result.headers.get('Content-Type') || 'application/octet-stream'
      }
    } catch (error) {
      console.error(
        `Error downloading from ${URLs[i]}: ${error}, trying next URL`
      )
      // If error occurs, continue to the next URL.
      continue
    }
  }

  throw new ErrorWithCode(
    `Unable to download content from ${UHRPUrl}`,
    'ERR_INVALID_DOWNLOAD_URL'
  )
}
