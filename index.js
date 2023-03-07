const { getUrlFromQueryResult } = require('./getUrlFromQueryResult')
const { isValidURL, getHashFromURL } = require('uhrp-url')
const pushdrop = require('pushdrop')
const fetch = require('isomorphic-fetch')
const PacketPay = require('@packetpay/js')

/**
 * Locates HTTP URLs where content can be downloaded. It uses the passed Confederacy hosts or the default one.
 *
 * @param {Object} obj All parameters are passed in an object.
 * @param {String} obj.UHRPUrl The UHRP url to resolve.
 * @param {string} obj.confederacyHost HTTPS Url for for the Confederacy host with default setting.
 *
 * @return {Array<String>} An array of HTTP URLs where content can be downloaded.
 * @throws {Error} If UHRP url parameter invalid or Confederacy hosts is not an array
 * or there is an error retrieving url(s) stored in the UHRP token.
 */
const resolve = async ({
  UHRPUrl,
  confederacyHost = 'https://confederacy.babbage.systems',
  clientPrivateKey
} = {}) => {
  if (!isValidURL(UHRPUrl)) {
    const e = new Error('Invalid parameter UHRP url')
    e.code = 'ERR_INVALID_UHRP_URL'
    throw e
  }

  // Use Confederacy UHRP lookup service
  const response = await PacketPay(`${confederacyHost}/lookup`, {
    method: 'POST',
    body: {
      provider: 'UHRP',
      query: {
        UHRPUrl
      }
    }
  }, { clientPrivateKey })
  const lookupResult = JSON.parse(Buffer.from(response.body).toString('utf8'))

  // Check for any errors returned and create error to notify bugsnag.
  if (lookupResult.status && lookupResult.status === 'error') {
    const e = new Error(lookupResult.description)
    e.code = lookupResult.code || 'ERR_UNKNOWN'
    throw e
  }

  if (lookupResult.length < 1) {
    return null
  }

  const decodedResults = []

  // Decode the UHRP token fields
  try {
    for (let i = 0; i < lookupResult.length; i++) {
      decodedResults.push(
        getUrlFromQueryResult(
          pushdrop.decode({
            // eslint-disable-next-line no-undef
            script: Buffer.from(lookupResult[i].outputScript).toString('hex'), // Is Buffer form supported by PushDrop?
            fieldFormat: 'buffer'
          })
        )
      )
    }
  } catch (e) {
    throw new Error(`Error retrieving url stored in the UHRP token: ${e.message}`)
  }
  return decodedResults
}

/**
 * Downloads content from a UHRP url and returns it as a buffer with its mime type, after validating that the hash is correct. It uses the passed Confederacy hosts or the default one.
 *
 * @param {Object} obj All parameters are passed in an object.
 * @param {String} obj.UHRPUrl The UHRP url to download.
 * @param {Array[Object]} obj.confederacyHosts Array of Confederacy hosts.
 *
 * @return {Object} An object containing "data" (a buffer) and "mimeType" for the content.
 * @throws {Error} If UHRP url parameter invalid or Confederacy hosts is not an array or hash is invalid or unable to download using retrieved url(s)
 */
const download = async ({
  UHRPUrl,
  confederacyHost = 'https://confederacy.babbage.systems'
} = {}) => {
  if (!isValidURL(UHRPUrl)) {
    const e = new Error('Invalid parameter UHRP url')
    e.code = 'ERR_INVALID_UHRP_URL'
    throw e
  }

  const hash = getHashFromURL(UHRPUrl).toString('hex')

  // A list of potential download URLs are resolved
  const URLs = await resolve({ UHRPUrl, confederacyHost })

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
      // eslint-disable-next-line no-undef
      const contentBuffer = Buffer.from(await blob.arrayBuffer())

      // The hash of the buffer is calculated
      const contentHash = crypto
        .createHash('sha256')
        .update(contentBuffer)
        .digest('hex')

      // If the hash does not match, continue to the next url
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
      // In case of any errors with this url, continue to the next one
      continue
    }
  }

  // If the loop finishes without success, the content cannot be downloaded
  const e = new Error(`Unable to download content from ${URL}`)
  e.code = 'ERR_INVALID_DOWNLOAD_URL'
  throw e
}

module.exports = { resolve, download }
