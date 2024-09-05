import fetch from 'isomorphic-fetch';
import { getHashFromURL } from 'uhrp-url';
import { resolve, download, isValidURL } from './src/index';
import crypto from 'crypto';

// Mock PacketPay
jest.mock('@packetpay/js', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ body: Buffer.from(JSON.stringify([{ outputScript: 'mockScript' }])) })
}));

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
  status: 200,
  blob: () => Promise.resolve(new Blob(['mockData'])),
  headers: { get: () => 'text/plain' }
});

describe('NanoSeek', () => {
  const mockUHRPUrl = 'uhrp://example.com';
  const mockClientPrivateKey = 'mockPrivateKey';
  const mockHash = 'mockHashValue';

  beforeEach(() => {
    jest.clearAllMocks();
    (getHashFromURL as jest.Mock).mockReturnValue(mockHash);
    (fetch as jest.Mock).mockResolvedValue({
      status: 200,
      blob: () => ({
        arrayBuffer: () => new Uint8Array([1, 2, 3])
      }),
      headers: {
        get: () => 'application/json'
      }
    });
    (isValidURL as jest.Mock).mockReturnValue(true);
  });

  describe('resolve', () => {
    it('Calls getHashFromURL with the UHRPUrl', async () => {
      await resolve({ UHRPUrl: 'uhrp://example.com' });
      expect(getHashFromURL).toHaveBeenLastCalledWith('uhrp://example.com');
    });

    it('Handles optional parameters correctly', async () => {
      await resolve({ UHRPUrl: 'uhrp://example.com', confederacyHost: 'MOCK_HOST', clientPrivateKey: 'MOCK_KEY' });
      expect(getHashFromURL).toHaveBeenLastCalledWith('uhrp://example.com');
      // Add more expectations here based on how resolve handles these optional parameters
    });

    // Add more tests based on the current implementation of resolve()
  });

  describe('download', () => {
    it('Calls getHashFromURL with the UHRPUrl', async () => {
      await download({ UHRPUrl: 'uhrp://example.com' });
      expect(getHashFromURL).toHaveBeenLastCalledWith('uhrp://example.com');
    });

    it('Calls fetch with the HTTP URL', async () => {
      await download({ UHRPUrl: 'uhrp://example.com' });
      expect(fetch).toHaveBeenCalledWith(expect.any(String), { method: 'GET' });
    });

    it('Returns the data and MIME type', async () => {
      const result = await download({ UHRPUrl: 'uhrp://example.com' });
      expect(result).toEqual({
        data: expect.any(Buffer),
        mimeType: 'application/json'
      });
    });

    // Add more tests based on the current implementation of download()
  });
});
