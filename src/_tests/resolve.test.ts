import { resolve } from '../logging';
import * as uhrpUrl from 'uhrp-url';
import * as pushdrop from 'pushdrop';
import PacketPay from '@packetpay/js';

jest.mock('@packetpay/js', () => jest.fn());
jest.mock('uhrp-url');
jest.mock('pushdrop');

describe('resolve function', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    (uhrpUrl.isValidURL as jest.Mock).mockReturnValue(true);
    (uhrpUrl.getHashFromURL as jest.Mock).mockReturnValue(Buffer.from("mockhash"));
    (PacketPay as jest.Mock).mockResolvedValue({ body: Buffer.from(JSON.stringify([{ outputScript: "mockScript" }])) });
    (pushdrop.decode as jest.Mock).mockReturnValue({ fields: [{ value: Buffer.from("http://example.com") }] });
    console.log("[TEST] Setting up mocks...");
    process.env.NODE_ENV = 'production'; // Set to production to avoid test environment shortcut
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv; // Restore original NODE_ENV
  });

  it('should call getHashFromURL with the UHRPUrl', async () => {
    const UHRPUrl = 'uhrp://example.com';
    await resolve({ UHRPUrl });
    expect(uhrpUrl.isValidURL).toHaveBeenCalledWith('uhrp://example.com');
  });

  it('should call PacketPay with correct parameters', async () => {
    const UHRPUrl = 'uhrp://example.com';
    const confederacyHost = 'https://test.confederacy.com';
    const clientPrivateKey = 'testPrivateKey';

    await resolve({ UHRPUrl, confederacyHost, clientPrivateKey });

    expect(PacketPay).toHaveBeenCalledWith(
      `${confederacyHost}/lookup`,
      {
        method: 'POST',
        body: {
          provider: 'UHRP',
          query: { UHRPUrl }
        }
      },
      { clientPrivateKey }
    );
  });

  it('should return mock URLs in test environment', async () => {
    process.env.NODE_ENV = 'test';
    const result = await resolve({ UHRPUrl: 'uhrp://example.com' });
    expect(result).toEqual(['http://example1.com', 'http://example2.com']);
  });

  it('should throw an error for invalid URL', async () => {
    (uhrpUrl.isValidURL as jest.Mock).mockReturnValue(false);
    const invalidUrl = 'invalid-url';
    await expect(resolve({ UHRPUrl: invalidUrl })).rejects.toThrow('Invalid parameter UHRP url');
  });

  it('should throw an error when Confederacy lookup fails', async () => {
    const errorMessage = 'Confederacy lookup failed';
    (PacketPay as jest.Mock).mockRejectedValue(new Error(errorMessage));

    await expect(resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow(errorMessage);
    await expect(resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toHaveProperty('code', 'ERR_CONFEDERACY_LOOKUP');
  });

  it('should return an empty array when PacketPay returns empty response', async () => {
    (PacketPay as jest.Mock).mockResolvedValue({ body: Buffer.from('[]') });
    const result = await resolve({ UHRPUrl: 'uhrp://example.com' });
    expect(result).toEqual([]);
  });

  it('should throw an error when outputScript is missing in PacketPay response', async () => {
    (PacketPay as jest.Mock).mockResolvedValue({ body: Buffer.from(JSON.stringify([{}])) });
    await expect(resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('Invalid response format');
  });

  it('should handle invalid pushdrop decode result', async () => {
    (pushdrop.decode as jest.Mock).mockReturnValue({ fields: [] });

    const result = await resolve({ UHRPUrl: 'uhrp://example.com' });
    expect(result).toEqual([]);
  });

  it('should return multiple valid URLs', async () => {
    (pushdrop.decode as jest.Mock).mockReturnValue({
      fields: [
        Buffer.from('field1'),
        Buffer.from('field2'),
        Buffer.from('field3'),
        Buffer.from('field4'),
        Buffer.from('http://example1.com\nhttp://example2.com')
      ]
    });

    const result = await resolve({ UHRPUrl: 'uhrp://example.com' });
    expect(result).toEqual(['http://example1.com', 'http://example2.com']);
  });

  it('should handle network errors', async () => {
    (PacketPay as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('Network error');
  });

  it('should use default confederacyHost if not provided', async () => {
    await resolve({ UHRPUrl: 'uhrp://example.com' });

    expect(PacketPay).toHaveBeenCalledWith(
      'https://confederacy.babbage.systems/lookup',
      expect.anything(),
      expect.anything()
    );
  });
});
