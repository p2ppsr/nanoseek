
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
  return  queryResult.fields[5].toString('utf8')
}

module.exports = getUrlFromQueryResult
