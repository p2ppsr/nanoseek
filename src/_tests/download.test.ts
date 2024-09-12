import { download } from '../components/download';
import fetch from 'isomorphic-fetch';
import * as uhrpUrl from 'uhrp-url';
import * as pushdrop from 'pushdrop';
import crypto from 'crypto';

jest.mock('uhrp-url', () => ({
  isValidURL: jest.fn(),
  getHashFromURL: jest.fn(),
  getURLForHash: jest.fn(),
  resolve: jest.fn(),
}));

jest.mock('isomorphic-fetch', () => jest.fn());
jest.mock('@packetpay/js');
jest.mock('pushdrop');
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue(Buffer.from('mockhash').toString('hex')),
  })),
}));

describe('download function', () => {
  const mockValidUHRPUrl = 'uhrp://validmockhash';
  const mockInvalidUHRPUrl = 'invalid://url';

  beforeEach(() => {
    jest.clearAllMocks();
    (uhrpUrl.isValidURL as jest.Mock).mockImplementation(
      (url: string) => url === mockValidUHRPUrl
    );
    (uhrpUrl.getHashFromURL as jest.Mock).mockReturnValue(Buffer.from('mockhash'));
    (uhrpUrl.getURLForHash as jest.Mock).mockReturnValue(mockValidUHRPUrl);
    (pushdrop.decode as jest.Mock).mockReturnValue({
      url: 'http://example.com',
    });
  });

  it('should successfully download content', async () => {
    const mockContent = 'mock content';
    const mockArrayBuffer = new ArrayBuffer(mockContent.length);
    const uint8Array = new Uint8Array(mockArrayBuffer);
    for (let i = 0; i < mockContent.length; i++) {
      uint8Array[i] = mockContent.charCodeAt(i);
    }

    (fetch as jest.Mock).mockResolvedValue({
      status: 200,
      blob: jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }),
      headers: { get: jest.fn().mockReturnValue('text/plain') },
    });

    const result = await download({ UHRPUrl: mockValidUHRPUrl });

    expect(result).toEqual({
      data: expect.any(Buffer),
      mimeType: 'text/plain',
    });
    expect(result.data.toString()).toBe(mockContent);
  });

  it('should throw an error for invalid URLs', async () => {
    await expect(download({ UHRPUrl: mockInvalidUHRPUrl })).rejects.toThrow('Invalid parameter UHRP url');
  });

  it('should handle network errors during download', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Download failed'));

    await expect(download({ UHRPUrl: mockValidUHRPUrl })).rejects.toThrow('Unable to download content from');
  });

  it('should handle non-200 HTTP status', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      status: 404,
    });

    await expect(download({ UHRPUrl: mockValidUHRPUrl })).rejects.toThrow('Unable to download content from');
  });

  it('should handle empty response', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      status: 200,
      blob: jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
      }),
      headers: { get: jest.fn().mockReturnValue('text/plain') },
    });

    await expect(download({ UHRPUrl: mockValidUHRPUrl })).rejects.toThrow('Unable to download content from');
  });

  it('should try all URLs before throwing an error', async () => {
    const mockUrls = ['http://example1.com', 'http://example2.com'];
    (uhrpUrl.resolve as jest.Mock).mockResolvedValue(mockUrls);
    (fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('First URL failed'))
      .mockRejectedValueOnce(new Error('Second URL failed'));

    await expect(download({ UHRPUrl: mockValidUHRPUrl })).rejects.toThrow('Unable to download content from');

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(1, mockUrls[0], expect.anything());
    expect(fetch).toHaveBeenNthCalledWith(2, mockUrls[1], expect.anything());
  });

  it('should handle different MIME types', async () => {
    const mockContent = 'mock content';
    const mockArrayBuffer = new ArrayBuffer(mockContent.length);
    const uint8Array = new Uint8Array(mockArrayBuffer);
    for (let i = 0; i < mockContent.length; i++) {
      uint8Array[i] = mockContent.charCodeAt(i);
    }

    (fetch as jest.Mock).mockResolvedValue({
      status: 200,
      blob: jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }),
      headers: { get: jest.fn().mockReturnValue('application/json') },
    });

    const result = await download({ UHRPUrl: mockValidUHRPUrl });

    expect(result).toEqual({
      data: expect.any(Buffer),
      mimeType: 'application/json',
    });
    expect(result.data.toString()).toBe(mockContent);
  });

  it('should handle large file downloads correctly', async () => {
    const largeContent = 'a'.repeat(1024 * 1024); // 1MB of data
    const mockArrayBuffer = new ArrayBuffer(largeContent.length);
    const uint8Array = new Uint8Array(mockArrayBuffer);
    for (let i = 0; i < largeContent.length; i++) {
      uint8Array[i] = largeContent.charCodeAt(i);
    }

    (fetch as jest.Mock).mockResolvedValue({
      status: 200,
      blob: jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }),
      headers: { get: jest.fn().mockReturnValue('application/octet-stream') },
    });

    const result = await download({ UHRPUrl: mockValidUHRPUrl });

    expect(result).toEqual({
      data: expect.any(Buffer),
      mimeType: 'application/octet-stream',
    });
    expect(result.data.length).toBe(largeContent.length);
    expect(result.data.toString()).toBe(largeContent);
  });
});
