interface QueryResult {
  fields: (string | Buffer)[];
}

/**
 * This function takes a query result and returns the associated url(s).
 * @param queryResult - The query result to parse.
 *
 * @returns The retrieved url(s).
 * @throws {Error} If passed parameter query result is missing or an invalid type.
 */
export function getUrlFromQueryResult(queryResult: QueryResult): string {
  if (typeof queryResult === 'undefined') {
    const e = new Error('queryResult is a required parameter!');
    e.name = 'ERR_INVALID_QUERY_PARAM';
    throw e;
  }
  if (typeof queryResult !== 'object' || queryResult === null) {
    const e = new Error(`queryResult must be an object, but ${typeof queryResult} was given!`);
    e.name = 'ERR_INVALID_QUERY_TYPE';
    throw e;
  }
  return queryResult.fields[4].toString('utf8');
}
