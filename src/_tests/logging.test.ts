import { resolve, download } from '../logging';
import * as index from '../index';
import PacketPay from '@packetpay/js';

jest.mock('../index');
jest.mock('@packetpay/js');

describe('logging', () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  let mockConsoleLog: jest.Mock;
  let mockConsoleError: jest.Mock;

  beforeEach(() => {
    mockConsoleLog = jest.fn();
    mockConsoleError = jest.fn();
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    jest.resetAllMocks();
  });

  it('should log resolve function calls', async () => {
    const mockResolve = jest.spyOn(index, 'resolve').mockResolvedValue(['http://example.com']);
    await resolve({ UHRPUrl: 'test' });
    expect(mockConsoleLog).toHaveBeenCalledWith('[DEBUG] resolve called with:', '[{"UHRPUrl":"test"}]');
    expect(mockConsoleLog).toHaveBeenCalledWith('[DEBUG] resolve completed successfully');
    expect(mockResolve).toHaveBeenCalledWith({ UHRPUrl: 'test' });
  });

  it('should log download function calls', async () => {
    const mockDownload = jest.spyOn(index, 'download').mockResolvedValue({ data: Buffer.from('test'), mimeType: 'text/plain' });
    await download({ UHRPUrl: 'http://example.com' });
    expect(mockConsoleLog).toHaveBeenCalledWith('[DEBUG] download called with:', '[{"UHRPUrl":"http://example.com"}]');
    expect(mockConsoleLog).toHaveBeenCalledWith('[DEBUG] download completed successfully');
    expect(mockDownload).toHaveBeenCalledWith({ UHRPUrl: 'http://example.com' });
  });

  it('should log errors', async () => {
    const error = new Error('Test error');
    jest.spyOn(index, 'resolve').mockRejectedValue(error);
    await expect(resolve({ UHRPUrl: 'test' })).rejects.toThrow('Test error');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Error in resolve:'), error);
  });
});