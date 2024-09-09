import { resolve as originalResolve, download as originalDownload, ResolveParams, DownloadResult } from './index';
import PacketPay from '@packetpay/js';

function withLogging<T extends (...args: any[]) => Promise<any>>(
  funcName: string,
  func: T
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    console.log(`[DEBUG] ${funcName} called with:`, JSON.stringify(args));
    try {
      // Log PacketPay calls
      const originalPacketPay = PacketPay;
      (PacketPay as any) = jest.fn((...args: any[]) => {
        console.log('[DEBUG] PacketPay called with:', JSON.stringify(args));
        return originalPacketPay(...args);
      });

      const result = await func(...args);
      console.log(`[DEBUG] ${funcName} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[ERROR] Error in ${funcName}:`, error);
      throw error;
    } finally {
      // Restore original PacketPay
      (PacketPay as any) = PacketPay;
    }
  }) as T;
}

export const resolve = withLogging('resolve', originalResolve);
export const download = withLogging('download', originalDownload);
