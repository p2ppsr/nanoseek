import * as indexModule from '../index';
import PacketPay from '@packetpay/js';
import { isValidURL } from 'uhrp-url';
import fetch from 'cross-fetch';
import * as pushdrop from 'pushdrop';
import { getUrlFromQueryResult } from '../utils/getUrlFromQueryResult';

jest.mock('@packetpay/js');
jest.mock('uhrp-url');
jest.mock('cross-fetch');
jest.mock('pushdrop');
jest.mock('../utils/getUrlFromQueryResult');

describe('NanoSeek', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.MockedFunction<typeof fetch>).mockClear()
    ;(isValidURL as jest.Mock).mockReturnValue(true)
    ;(PacketPay as jest.Mock).mockResolvedValue({
      body: Buffer.from(JSON.stringify([{ outputScript: 'mockScript' }]))
    })
    ;(pushdrop.decode as jest.Mock).mockReturnValue({ fields: ['mockField'] })
    ;(getUrlFromQueryResult as jest.Mock).mockReturnValue('https://example.com/cdn/file');
  });

  describe('download function', () => {
    test('should download content successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        blob: async () => new Blob([new Uint8Array([1, 2, 3])]),
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        ok: true,
        json: async () => ({}),
        text: async () => ''
      } as unknown as Response);

      const result = await indexModule.download({ UHRPUrl: 'uhrp://example.com' });

      expect(fetch).toHaveBeenCalledWith('https://example.com/cdn/file', { method: 'GET' });
      expect(result).toEqual({
        data: expect.any(Buffer),
        mimeType: 'application/json'
      });
    });

    test('should throw an error if all download attempts fail', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ status: 404 });

      await expect(indexModule.download({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('Failed to download content');

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolve function', () => {
    test('should return an array of URLs', async () => {
      const result = await indexModule.resolve({ UHRPUrl: 'uhrp://example.com' });
      expect(result).toEqual(['https://example.com/cdn/file']);
    });

    test('should throw an error for invalid UHRP URL', async () => {
      (isValidURL as jest.Mock).mockReturnValueOnce(false);
      await expect(indexModule.resolve({ UHRPUrl: 'invalid-url' })).rejects.toThrow('Invalid parameter UHRP URL');
    });

    test('should return null for empty lookup result', async () => {
      (PacketPay as jest.Mock).mockResolvedValueOnce({ body: Buffer.from('[]') });
      const result = await indexModule.resolve({ UHRPUrl: 'uhrp://example.com' });
      expect(result).toBeNull();
    });

    test('should handle PacketPay error', async () => {
      (PacketPay as jest.Mock).mockRejectedValueOnce(new Error('PacketPay error'));
      await expect(indexModule.resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('PacketPay error');
    });

    test('should handle lookup result error', async () => {
      (PacketPay as jest.Mock).mockResolvedValueOnce({
        body: Buffer.from(JSON.stringify({ status: 'error', description: 'Lookup error', code: 'ERR_LOOKUP' }))
      });
      await expect(indexModule.resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('Lookup error');
    });

    test('should handle script decoding error', async () => {
      (pushdrop.decode as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Decoding error');
      });
      await expect(indexModule.resolve({ UHRPUrl: 'uhrp://example.com' }))
        .rejects.toThrow('Decoding error');
    });
  });
});
