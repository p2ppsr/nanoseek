import { NanoSeekError } from '../types/types'

export interface QueryResult {
  fields: (string | Buffer)[];
}

export function getUrlFromQueryResult(result: any): string | null {
  if (typeof result === 'undefined') {
    throw new NanoSeekError('result is a required parameter!', 'ERR_INVALID_QUERY_PARAM')
  }
  if (typeof result !== 'object' || result === null) {
    throw new NanoSeekError(
      `result must be an object, but ${typeof result} was given!`,
      'ERR_INVALID_QUERY_TYPE'
    )
  }
  if (!Array.isArray(result.fields) || result.fields.length < 5) {
    throw new NanoSeekError('Invalid result structure', 'ERR_INVALID_QUERY_STRUCTURE')
  }
  const url = result.fields[4]?.toString('utf8') ?? null;
  return url && url.trim() !== '' ? url : null;
}

export { NanoSeekError };
