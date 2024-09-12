import { isValidURL, getHashFromURL, getURLForHash } from 'uhrp-url'
import * as pushdrop from 'pushdrop'
import fetch from 'isomorphic-fetch'
import PacketPay from '@packetpay/js'
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
  
    // Ensure the UHRPUrl is standardized without any prefixes
    const hash = getHashFromURL(UHRPUrl)
    const standardizedUHRPUrl = getURLForHash(hash)
  
    // A list of potential download URLs are resolved
    const resolveParams: {
      UHRPUrl: string
      confederacyHost?: string
      clientPrivateKey?: string
    } = {
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
          mimeType:
            result.headers.get('Content-Type') || 'application/octet-stream'
        }
      } catch (e) {
        // In case of any errors with this url, continue to the next one
        continue
      }
    }
  
    // If the loop finishes without success, the content cannot be downloaded
    const e: ErrorWithCode = new Error(
      `Unable to download content from ${UHRPUrl}`
    )
    e.code = 'ERR_INVALID_DOWNLOAD_URL'
    throw e
  }
  