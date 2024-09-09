import { getUrlFromQueryResult, NanoSeekError } from '../utils/getUrlFromQueryResult';

describe('getUrlFromQueryResult', () => {
  it('should return URL when present', () => {
    const result = { fields: [Buffer.from('field1'), Buffer.from('field2'), Buffer.from('field3'), Buffer.from('field4'), Buffer.from('http://example.com')] };
    expect(getUrlFromQueryResult(result)).toBe('http://example.com');
  });

  it('should return null when URL is not present', () => {
    const result = { fields: [Buffer.from('field1'), Buffer.from('field2'), Buffer.from('field3'), Buffer.from('field4'), Buffer.from('')] };
    expect(getUrlFromQueryResult(result)).toBeNull();
  });

  it('should return null for empty string URL', () => {
    const result = { fields: [Buffer.from('field1'), Buffer.from('field2'), Buffer.from('field3'), Buffer.from('field4'), Buffer.from('')] };
    expect(getUrlFromQueryResult(result)).toBeNull();
  });

  it('should handle empty fields array', () => {
    const result = { fields: [] };
    expect(() => getUrlFromQueryResult(result)).toThrow(NanoSeekError);
    expect(() => getUrlFromQueryResult(result)).toThrow('Invalid result structure');
  });

  it('should throw error when result is not an object', () => {
    expect(() => getUrlFromQueryResult(null as any)).toThrow(NanoSeekError);
    expect(() => getUrlFromQueryResult(null as any)).toThrow('Invalid result structure');
  });

  it('should throw error when fields is not an array', () => {
    const result = { fields: 'not an array' };
    expect(() => getUrlFromQueryResult(result as any)).toThrow(NanoSeekError);
    expect(() => getUrlFromQueryResult(result as any)).toThrow('Invalid result structure');
  });

  it('should throw error when fields array has less than 5 elements', () => {
    const result = { fields: [Buffer.from('field1'), Buffer.from('field2'), Buffer.from('field3'), Buffer.from('field4')] };
    expect(() => getUrlFromQueryResult(result)).toThrow(NanoSeekError);
    expect(() => getUrlFromQueryResult(result)).toThrow('Invalid result structure');
  });
});
