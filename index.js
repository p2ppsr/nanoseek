import store from '../store'

const UHRPLookupService = require('UHRPLookupService')
const { getHashFromURL } = require('uhrp-url')
const crypto = require('crypto')
const fetch = require('isomorphic-fetch')

/**
 * Locates HTTP URLs where content can be downloaded. Uses trusted confederacy hosts when possible.
 *
 * @param {Object} obj All parameters are passed in an object.
 * @param {String} obj.UHRPUrl The UHRP URL to resolve.
 *
 * @return {Array<String>} An array of HTTP URLs where content can be downloaded.
 */
const resolve = async ({
  UHRPUrl,
  confederacyHosts = [store.getState().settings.confederacyHost]
} = {}) => {

  // Use Confederacy UHRP lookup service
  // *** TBD resolve multiple Confederacy Hosts ***
  const lookupResult = await boomerang(
    'POST',
    `${confederacyHosts[0]}/lookup`,
    {
      provider: 'UHRP',
      query: {
        UHRPUrl
      }
    }
  )
  if (lookupResult.length < 1) {
    return null
  }
  // Decode the UHRP fields
  const decodedResult = pushdrop.decode({
    script: Buffer.from(lookupResult[0].outputScript).toString('hex'), // Is Buffer form supported by PushDrop?
    fieldFormat: 'buffer'
  })

  try {
    return getAccountDescriptorFromQueryResult(
      decodedResult
    )
  } catch (e) {
    throw new ValidationError(
      `Error parsing account descriptor: ${e.message}`
    )
  }


}

/**
 * Downloads content from a UHRP URL and returns it as a buffer with its mime type, after validating that the hash is correct. Uses trusted hosts when possible.
 *
 * @param {Object} obj All parameters are passed in an object.
 * @param {String} obj.UHRPUrl The UHRP URL to download.
 *
 * @return {Object} An object containing "data" (a buffer) and "mimeType" for the content.
 */
const download = async ({
  UHRPUrl,
  confederacyHosts
} = {}) => {

  // A list of potential download URLs are resolved
  const URLs = await resolve({ UHRPUrl, confederacyHosts })

  // Download is attempted from each URL until successful
  for (let i = 0; i < URLs.length; i++) {
    try {
      // The URL is fetched
      const result = await fetch(URLs[i], { method: 'GET' })

      // If the request fails, continue to the next URL
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

      // If the hash does not match, continue to the next URL
      if (contentHash !== hash) {
        continue
      }

      // Return the data and the MIME type
      return {
        data: contentBuffer,
        mimeType: result.headers.get('Content-Type')
      }
    } catch (e) {
      console.error(e)
      // In case of any errors with this URL, continue to the next one
      continue
    }
  }

  // If the loop finishes without success, the content cannot be downloaded
  throw new Error(`Unable to download content from ${URL}`)
}

module.exports = { resolve, download }