import store from '../store' // Needs to be coded?

const { getUrlFromQueryResult } = require ('getUrlFromQueryResult')
const { isValidURL, getHashFromURL } = require('uhrp-url')
const crypto = require('crypto')
const fetch = require('isomorphic-fetch')

/**
 * Locates HTTP URLs where content can be downloaded. It uses the passed Confederacy hosts or the default one.
 *
 * @param {Object} obj All parameters are passed in an object.
 * @param {String} obj.UHRPUrl The UHRP URL to resolve.
 * @param {Array[Object]} obj.confederacyHosts Array of Confederacy hosts.
 *
 * @return {Array<String>} An array of HTTP URLs where content can be downloaded.
 * @throws {Error} If UHRP url parameter invalid or Confederacy hosts is not an array
 * or there is an error retrieving url(s) stored in the UHRP token.
 */
const resolve = async ({
  UHRPUrl,
  confederacyHosts = [store.getState().settings.confederacyHost]
} = {}) => {

  if (!isValidURL(UHRPUrl)) {
    const e = new Error('Invalid parameter UHRP url')
    e.code = 'ERR_INVALID_UHRP_URL'
    throw e
  }

  if (!isArray(confederacyHosts)) {
    const e = new Error('Invalid parameter Confederacy hosts, must be an array')
    e.code = 'ERR_INVALID_CONFEDERACY_ARRAY'
    throw e
  }

  // Use Confederacy UHRP lookup service
  // *** TBD resolve multiple Confederacy hosts ***
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

  // Decode the UHRP token field
  const decodedResult = pushdrop.decode({
    script: Buffer.from(lookupResult[0].outputScript).toString('hex'), // Is Buffer form supported by PushDrop?
    fieldFormat: 'buffer'
  })

  // Retrive the URL where the file can be downloaded
  // *** TBD return multiple URLs ***
  try {
    return [getUrlFromQueryResult(
      decodedResult
    )]
  } catch (e) {
    throw new Error(`Error retrieving URL stored in the UHRP token: ${e.message}`)
  }

}

/**
 * Downloads content from a UHRP url and returns it as a buffer with its mime type, after validating that the hash is correct. It uses the passed Confederacy hosts or the default one.
 *
 * @param {Object} obj All parameters are passed in an object.
 * @param {String} obj.UHRPUrl The UHRP URL to download.
 * @param {Array[Object]} obj.confederacyHosts Array of Confederacy hosts.
 *
 * @return {Object} An object containing "data" (a buffer) and "mimeType" for the content.
 * @throws {Error} If UHRP url parameter invalid or Confederacy hosts is not an array or hash is invalid or unable to download using retrieved url(s)
 */
const download = async ({
  UHRPUrl,
  confederacyHosts
} = {}) => {

  if (!isValidURL(UHRPUrl)) {
    const e = new Error('Invalid parameter UHRP url')
    e.code = 'ERR_INVALID_UHRP_URL'
    throw e
  }

  if (!isArray(confederacyHosts)) {
    const e = new Error('Invalid parameter Confederacy hosts, must be an array')
    e.code = 'ERR_INVALID_CONFEDERACY_ARRAY'
    throw e
  }

  // The hash is extracted from the UHRP url for later validation
  try {
    const hash = getHashFromURL(UHRPUrl).toString('hex')
  } catch (e) {
    throw new Error(`Error invalid UHRP url: ${e.message}`)
  }

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
  const e = new Error(`Unable to download content from ${URL}`)
  e.code = 'ERR_INVALID_DOWNLOAD_URL'
  throw e

}

module.exports = { resolve, download }