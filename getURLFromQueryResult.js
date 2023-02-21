
/**
 * This function takes a query result and returns the URL in
 * Standard Format.
 * @param {object} queryResult - The query result to parse
 * @returns {array} The retrieved URL
 * @throws {Error} If passed parameter query is invalid
 */
export default queryResult => {
  if (typeof queryResult === 'undefined') {
    const e = new Error('queryResult is a required parameter!')
    e.code = 'ERR_INVALID_PARAM'
    throw e
  }
  if (typeof queryResult !== 'object') {
    const e = new Error(`queryResult must be an object, but ${typeof queryResult} was given!`)
    e.code = 'ERR_INVALID_TYPE'
    throw e
  }
  const OP_CHECKSIG = 172
  const res = [
    [...Buffer.from(queryResult.lockingPublicKey, 'hex')],
    [OP_CHECKSIG]
  ]
  // Create a URL according to the valid formatting standard
  for (const field of queryResult.fields) {
    res.push([...field])
  }
  return res
}