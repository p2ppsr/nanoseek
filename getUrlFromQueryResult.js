
/**
 * This function takes a query result and returns the associated url(s).
 * @param {object} queryResult - The query result to parse.
 * 
 * @returns {array} The retrieved url(s).
 * @throws {Error} If passed parameter query result is missing or an invalid type.
 */
 const getUrlFromQueryResult = queryResult => {
  if (typeof queryResult === 'undefined') {
    const e = new Error('queryResult is a required parameter!')
    e.code = 'ERR_INVALID_QUERY_PARAM'
    throw e
  }
  if (typeof queryResult !== 'object') {
    const e = new Error(`queryResult must be an object, but ${typeof queryResult} was given!`)
    e.code = 'ERR_INVALID_QUERY_TYPE'
    throw e
  }
  const OP_CHECKSIG = 172
  const res = [
    // eslint-disable-next-line no-undef
    [...Buffer.from(queryResult.lockingPublicKey, 'hex')],
    [OP_CHECKSIG]
  ]
  // Create the url(s) according to the valid format
  for (const field of queryResult.fields) {
    res.push([...field])
  }
  return res
}

export default getUrlFromQueryResult