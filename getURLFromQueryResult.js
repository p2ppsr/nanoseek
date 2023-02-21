
/**
 * This function takes a query result and returns the URL in
 * Standard Format.
 * @param {object} queryResult - The query result to parse
 * @returns {array} The retrieved URL
 * @throws {Error} If the rerived URL is invalid
 */
export default queryResult => {
  if (typeof queryResult === 'undefined') {
    throw new ValidationError('queryResult is a required parameter!')
  }
  if (typeof queryResult !== 'object') {
    throw new TypeError(`queryResult must be an object, but ${typeof queryResult} was given!`)
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