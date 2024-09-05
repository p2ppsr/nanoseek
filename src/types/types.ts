// types.ts
import type { UHRPUrl } from 'uhrp-url';
import type { PacketPayClient } from '@packetpay/js';

export interface DownloadOptions {
  UHRPUrl: string;
  confederacyHost?: string;
  clientPrivateKey?: string;
}

export interface DownloadResult {
  data: Buffer;
  mimeType: string;
}

export type DownloadFunction = (options: DownloadOptions) => Promise<DownloadResult>;