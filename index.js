const parapet = require('parapet-js')
const { getHashFromURL } = require('uhrp-url')
const crypto = require('crypto')
const fetch = require('isomorphic-fetch')

/**
 * Locates HTTP URLs where content can be downloaded. Uses trusted hosts when possible.
 *
 * @param {Object} obj All parameters are passed in an object.
 * @param {String} obj.URL The UHRP URL to resolve.
 * @param {Array<String>} [obj.trustedHosts=['15RLMCYZ738Y3cBb56yDSWa7TkAFxSQtyf']] A set of UHRP hosts given preferential treatmeant. By default, the Babbage host is trusted. Provide an empty array to resolve all URLs.
 * @param {Number} [obj.limit=10] The number of results to return.
 * @param {Number} [obj.offset=0] The offset into the total number of results.
 * @param {Array} [obj.bridgeportResolvers] Specify custom Bridgeport resolvers
 *
 * @return {Array<String>} An array of HTTP URLs where content can be downloaded.
 */
const resolve = async ({
  URL,
  trustedHosts = ['15RLMCYZ738Y3cBb56yDSWa7TkAFxSQtyf'],
  limit = 10,
  offset = 0,
  bridgeportResolvers
} = {}) => {
  // The hash is extracted from the UHRP URL
  const hash = getHashFromURL(URL).toString('hex')

  // The query is for URLs of matching hashes that are not revoked or expired
  const query = {
    v: 3,
    q: {
      collection: 'content',
      find: {
        hash,
        revoked: false,
        expiryTime: { $gte: parseInt(Date.now() / 1000) + 15 }
      },
      project: {
        URL: 1,
        _id: 0
      },
      limit,
      skip: offset
    }
  }

  // If there are trusted hosts, the query only includes them
  if (trustedHosts.length > 0) {
    query.q.find.host = { $in: trustedHosts }
  }

  // The query is run against the UHRP Bridge
  const resolved = await parapet({
    bridge: '1AJsUZ7MsJGwmkCZSoDpro28R52ptvGma7',
    resolvers: bridgeportResolvers,
    request: {
      type: 'json-query',
      query
    }
  })

  // If there are no results within a set of trusted hosts, re-run without trusted host restrictions
  if (resolved.length === 0 && trustedHosts.length > 0) {
    return resolve({
      URL,
      trustedHosts: [],
      limit,
      offset,
      bridgeportResolvers
    })

  // The resutt set is reduced only to include URL strings
  } else {
    return resolved.map(x => x.URL)
  }
}

/**
 * Downloads content from a UHRP URL and returns it as a buffer with its mime type, after validating that the hash is correct. Uses trusted hosts when possible.
 *
 * @param {Object} obj All parameters are passed in an object.
 * @param {String} obj.URL The UHRP URL to download.
 * @param {Array<String>} [obj.trustedHosts=['15RLMCYZ738Y3cBb56yDSWa7TkAFxSQtyf']] A set of UHRP hosts given preferential treatmeant. By default, the Babbage host is trusted. Provide an empty array to disable trusted host resolution.
 * @param {Number} [obj.limit=10] The maximum number of URLs to try downloading from before giving up.
 * @param {Number} [obj.offset=0] The offset into the list of potential download URLs to start from.
 * @param {Array} [obj.bridgeportResolvers] Specify custom Bridgeport resolvers
 *
 * @return {Object} An object containing "data" (a buffer) and "mimeType" for the content.
 */
const download = async ({
  URL,
  trustedHosts = ['15RLMCYZ738Y3cBb56yDSWa7TkAFxSQtyf'],
  bridgeportResolvers
} = {}) => {
  // The hash is extracted from the UHRP URL for later validation
  const hash = getHashFromURL(URL).toString('hex')

  // A list of potential download URLs are resolved
  const URLs = await resolve({ URL, trustedHosts, bridgeportResolvers })

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
