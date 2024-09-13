import { isValidURL, getHashFromURL, getURLForHash } from 'uhrp-url'
import fetch from 'isomorphic-fetch'
import crypto from 'crypto'
import { resolve } from './resolve'
import { ResolveParams, DownloadResult } from '../types/download'
import { ErrorWithCode } from '../types/types'

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
    const e: ErrorWithCode = new Error('Invalid parameter UHRP url')
    e.code = 'ERR_INVALID_UHRP_URL'
    throw e
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
    const e: ErrorWithCode = new Error('Unable to resolve URLs from UHRP URL!')
    e.code = 'ERR_NO_RESOLVED_URLS_FOUND'
    throw e
  }

  for (let i = 0; i < URLs.length; i++) {
    try {
      const result = await fetch(URLs[i], { method: 'GET' })

      if (result.status >= 400) {
        throw new Error(
          `Failed to fetch content from ${URLs[i]}: HTTP status ${result.status}`
        )
      }

      const blob = await result.blob()
      const contentBuffer = Buffer.from(await blob.arrayBuffer())

      if (contentBuffer.length === 0) {
        throw new Error(`Empty content from ${URLs[i]}`)
      }

      const contentHash = crypto
        .createHash('sha256')
        .update(contentBuffer)
        .digest('hex')

      // Ensure both are compared as strings in hex format
      if (contentHash !== hash.toString('hex')) {
        throw new Error(
          `Hash mismatch for content from ${URLs[i]}: Expected ${hash.toString('hex')}, got ${contentHash}`
        )
      }

      return {
        data: contentBuffer,
        mimeType:
          result.headers.get('Content-Type') || 'application/octet-stream'
      }
    } catch (error) {
      console.error(`Error downloading from ${URLs[i]}: ${error}`)
      // If error occurs, continue to the next URL.
      continue
    }
  }

  const e: ErrorWithCode = new Error(
    `Unable to download content from ${UHRPUrl}`
  )
  e.code = 'ERR_INVALID_DOWNLOAD_URL'
  throw e
}
