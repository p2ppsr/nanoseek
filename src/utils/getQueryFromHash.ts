/**
 * This function takes a hash string and returns the associated query object.
 * @param hash - The hash string to parse.
 *
 * @returns The parsed query object.
 * @throws {Error} If passed parameter hash is missing or an invalid type.
 */
export function getQueryFromHash(hash: string): Record<string, string> {
  if (typeof hash === 'undefined') {
    const e = new Error('hash is a required parameter!')
    e.name = 'ERR_INVALID_HASH_PARAM'
    throw e
  }
  if (typeof hash !== 'string') {
    const e = new Error(`hash must be a string, but ${typeof hash} was given!`)
    e.name = 'ERR_INVALID_HASH_TYPE'
    throw e
  }

  const query: Record<string, string> = {}
  const pairs = hash.replace(/^#/, '').split('&')

  for (const pair of pairs) {
    const [key, value] = pair.split('=')
    if (key && value) {
      query[decodeURIComponent(key)] = decodeURIComponent(value)
    }
  }

  return query
}
