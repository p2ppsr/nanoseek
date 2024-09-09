import { getQueryFromHash } from '../utils/getQueryFromHash';

describe('getQueryFromHash', () => {
  it('should return correct query for valid hash', () => {
    const hash = 'validhash';
    const result = getQueryFromHash(hash);
    expect(result).toEqual({
      // expected query structure
      // You'll need to adjust this based on the actual expected output
      provider: 'UHRP',
      query: { UHRPUrl: expect.stringContaining(hash) }
    });
  });

  it('should handle empty hash', () => {
    const hash = '';
    expect(() => getQueryFromHash(hash)).toThrow('Invalid hash');
  });

  it('should handle non-string input', () => {
    // @ts-ignore - intentionally passing invalid type for testing
    expect(() => getQueryFromHash(123)).toThrow('Invalid hash');
  });

  it('should handle very long hash', () => {
    const longHash = 'a'.repeat(1000);
    const result = getQueryFromHash(longHash);
    expect(result).toEqual({
      provider: 'UHRP',
      query: { UHRPUrl: expect.stringContaining(longHash) }
    });
  });

  it('should handle hash with special characters', () => {
    const hash = 'abc123!@#$%^&*()';
    const result = getQueryFromHash(hash);
    expect(result).toEqual({
      [hash]: '',
    });
  });

  it('should handle very short hash', () => {
    const hash = 'a';
    const result = getQueryFromHash(hash);
    expect(result).toEqual({
      a: '',
    });
  });

  // Add more test cases as needed
});
