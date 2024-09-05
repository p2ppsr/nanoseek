import * as indexModule from './src/index';
import PacketPay from '@packetpay/js';
import { isValidURL, getHashFromURL } from 'uhrp-url';
import fetch from 'isomorphic-fetch';
import * as pushdrop from 'pushdrop';

jest.mock('@packetpay/js');
jest.mock('uhrp-url');
jest.mock('isomorphic-fetch');
jest.mock('pushdrop');
jest.mock('./getUrlFromQueryResult', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue('https://example.com/cdn/file'),
}));

describe('NanoSeek', () => {
  let mockResolve: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear().mockReset();
    (isValidURL as jest.Mock).mockReturnValue(true);
    (getHashFromURL as jest.Mock).mockReturnValue('mockHash');
    (PacketPay as jest.Mock).mockResolvedValue({
      body: Buffer.from(JSON.stringify([{ outputScript: 'mockScript' }]))
    });
    mockResolve = jest.spyOn(indexModule, 'resolve').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  describe('download function', () => {
    test('should download content successfully', async () => {
      mockResolve.mockResolvedValue(['https://example.com/cdn/file']);
      
      const mockArrayBuffer = new ArrayBuffer(8);
      const mockBlob = new Blob([mockArrayBuffer]);
      (fetch as jest.Mock).mockResolvedValue({
        status: 200,
        blob: jest.fn().mockResolvedValue(mockBlob),
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        }
      });

      const result = await indexModule.download({ UHRPUrl: 'uhrp://example.com' });

      expect(mockResolve).toHaveBeenCalledWith({ 
        UHRPUrl: 'uhrp://example.com', 
        confederacyHost: undefined,
        clientPrivateKey: undefined
      });
      expect(fetch).toHaveBeenCalledWith('https://example.com/cdn/file', { method: 'GET' });
      expect(result).toEqual({
        data: expect.any(Buffer),
        mimeType: 'application/json'
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('Successfully downloaded content');
    });

    test('should try the second URL if the first request fails', async () => {
      mockResolve.mockResolvedValue(['https://example.com/cdn/file1', 'https://example.com/cdn/file2']);
      
      const mockArrayBuffer = new ArrayBuffer(8);
      const mockBlob = new Blob([mockArrayBuffer]);
      (fetch as jest.Mock)
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({
          status: 200,
          blob: jest.fn().mockResolvedValue(mockBlob),
          headers: {
            get: jest.fn().mockReturnValue('application/json')
          }
        });

      const result = await indexModule.download({ UHRPUrl: 'uhrp://example.com' });

      expect(mockResolve).toHaveBeenCalledWith({ 
        UHRPUrl: 'uhrp://example.com', 
        confederacyHost: undefined,
        clientPrivateKey: undefined
      });
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(1, 'https://example.com/cdn/file1', { method: 'GET' });
      expect(fetch).toHaveBeenNthCalledWith(2, 'https://example.com/cdn/file2', { method: 'GET' });
      expect(result).toEqual({
        data: expect.any(Buffer),
        mimeType: 'application/json'
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('Successfully downloaded content');
    });

    test('should throw an error if all download attempts fail', async () => {
      mockResolve.mockResolvedValue(['https://example.com/cdn/file']);
      (fetch as jest.Mock).mockResolvedValue({ status: 404 });

      await expect(indexModule.download({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('Failed to download content');

      expect(mockResolve).toHaveBeenCalledWith({ 
        UHRPUrl: 'uhrp://example.com', 
        confederacyHost: undefined,
        clientPrivateKey: undefined
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('Failed to download content');
    });

    test('should throw an error if resolve returns null', async () => {
      mockResolve.mockResolvedValue(null);

      await expect(indexModule.download({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('Unable to resolve URLs from UHRP URL!');

      expect(mockResolve).toHaveBeenCalledWith({ 
        UHRPUrl: 'uhrp://example.com', 
        confederacyHost: undefined,
        clientPrivateKey: undefined
      });
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});