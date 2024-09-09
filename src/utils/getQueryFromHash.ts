import { NanoSeekError } from '../types/types'

export function getQueryFromHash(hash: string): { provider: string; query: { UHRPUrl: string } } {
  if (typeof hash !== 'string' || hash.trim() === '') {
    throw new NanoSeekError('Invalid hash', 'ERR_INVALID_HASH');
  }
  return {
    provider: 'UHRP',
    query: { UHRPUrl: `uhrp://${hash}` }
  };
}
