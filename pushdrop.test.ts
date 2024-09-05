import { resolve } from './src/index';
import PacketPay from '@packetpay/js';
import pushdrop from 'pushdrop';
import getUrlFromQueryResult from './getUrlFromQueryResult';
import { isValidURL } from 'uhrp-url';
import 'uhrp-url';

// Mock dependencies
jest.mock('@packetpay/js');
jest.mock('./getUrlFromQueryResult');
jest.mock('./src/index', () => ({
  ...jest.requireActual('./src/index'),
}));

jest.mock('uhrp-url', () => ({
  isValidUHRPURL: jest.fn().mockImplementation((url) => url.startsWith('uhrp://')),
  getHashFromURL: jest.fn(),
  getURLForHash: jest.fn(),
  isValidURL: jest.fn().mockReturnValue(true)
}));

jest.mock('pushdrop', () => ({
  decode: jest.fn().mockReturnValue({ op: 'advertise', url: 'https://example.com' })
}));

describe('resolve function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should resolve UHRP URL successfully', async () => {
    const mockOutputScript = '4104ca0a8ce950bf2bc85115bd68818455ae2f187efc96c7527dfad98b69531ae65d13cff3e6f07263dcc64c8ccfd03884983a896b0c5887f2ec5bfd7ad739b76119ac213155485250596e4d4850755135546762334146384a5871774b6b6d5a56793568472231485438347a7272467645594658567a6b5343436f6968706d33437754586a74726b207a51691da58dd6f105df11ad7ec0dba2e27b2207d60cd1b7a97dc6ba887dd910096164766572746973654468747470733a2f2f73746167696e672d6e616e6f73746f72652e626162626167652e73797374656d732f63646e2f4d47597a6159437753554b7659704244587554674c4d0a323032383730383231330432363735473045022100d3a43092c28c8027ad450a38076bcf205b9c4676ddfa51c42df4aa88a022d2a102200af90d2a4ef0fa979d0ff79e9461219b9c4f2be84f2dc8a031a49cfa1b9a376a6d6d6d';

    const mockDecodedResult = {
      op: 'advertise',
      url: 'https://staging-nanostore.babbage.systems/cdn/MGYzaYCwSUKvYpBDXuTgLM'
    };

    (PacketPay as jest.Mock).mockResolvedValue({
      body: JSON.stringify([{ outputScript: mockOutputScript }])
    });
    (pushdrop.decode as jest.Mock).mockReturnValue(mockDecodedResult);
    (getUrlFromQueryResult as jest.Mock).mockImplementation((url) => url);

    const result = await resolve({
      UHRPUrl: 'uhrp://example.com',
      confederacyHost: 'https://confederacy.example.com',
      clientPrivateKey: 'mockKey'
    });

    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0]).toBe('https://staging-nanostore.babbage.systems/cdn/MGYzaYCwSUKvYpBDXuTgLM');
    expect(PacketPay).toHaveBeenCalledWith(
      'https://confederacy.example.com/lookup',
      expect.any(Object),
      { clientPrivateKey: 'mockKey' }
    );
    expect(pushdrop.decode).toHaveBeenCalledWith({ fieldFormat: 'buffer', script: mockOutputScript });
    expect(getUrlFromQueryResult).toHaveBeenCalledWith('https://staging-nanostore.babbage.systems/cdn/MGYzaYCwSUKvYpBDXuTgLM');
  });

  it('should throw an error for invalid UHRP URL', async () => {
    (isValidURL as jest.Mock).mockReturnValue(false);

    await expect(resolve({ UHRPUrl: 'invalid-url' })).rejects.toThrow('Invalid parameter UHRP URL');
  });

  it('should return null for empty lookup result', async () => {
    (isValidURL as jest.Mock).mockReturnValue(true);
    (PacketPay as jest.Mock).mockResolvedValue({
      body: JSON.stringify([])
    });

    const result = await resolve({ UHRPUrl: 'uhrp://example.com' });

    expect(result).toBeNull();
  });

  it('should handle PacketPay error', async () => {
    (isValidURL as jest.Mock).mockReturnValue(true);
    (PacketPay as jest.Mock).mockRejectedValue(new Error('PacketPay error'));

    await expect(resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('PacketPay error');
  });

  it('should use pushdrop to decode the script', async () => {
    const mockScript = '4104ca0a8ce950bf2bc85115bd68818455ae2f187efc96c7527dfad98b69531ae65d13cff3e6f07263dcc64c8ccfd03884983a896b0c5887f2ec5bfd7ad739b76119ac213155485250596e4d4850755135546762334146384a5871774b6b6d5a56793568472231485438347a7272467645594658567a6b5343436f6968706d33437754586a74726b207a51691da58dd6f105df11ad7ec0dba2e27b2207d60cd1b7a97dc6ba887dd910096164766572746973654468747470733a2f2f73746167696e672d6e616e6f73746f72652e626162626167652e73797374656d732f63646e2f4d47597a6159437753554b7659704244587554674c4d0a323032383730383231330432363735473045022100d3a43092c28c8027ad450a38076bcf205b9c4676ddfa51c42df4aa88a022d2a102200af90d2a4ef0fa979d0ff79e9461219b9c4f2be84f2dc8a031a49cfa1b9a376a6d6d6d6d';

    (PacketPay as jest.Mock).mockResolvedValue({
      body: JSON.stringify([{ outputScript: mockScript }])
    });

    await resolve({
      UHRPUrl: 'uhrp://example.com',
      confederacyHost: 'https://confederacy.example.com',
      clientPrivateKey: 'mockKey'
    });

    expect(pushdrop.decode).toHaveBeenCalledWith({ fieldFormat: 'buffer', script: mockScript });
  });
});