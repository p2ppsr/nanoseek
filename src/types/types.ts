// types.ts

export interface DownloadOptions {
  UHRPUrl: string
  confederacyHost?: string
  clientPrivateKey?: string
}

export interface DownloadResult {
  data: Buffer
  mimeType: string
}

export type DownloadFunction = (options: DownloadOptions) => Promise<DownloadResult>

// These types are used for type checking and are imported from their respective packages
export type { UHRPUrl } from 'uhrp-url';
export type { PacketPayClient } from '@packetpay/js';

// Need to replace empty interfaces with more specific types
export type NanoSeekOptions = Record<string, unknown>
export type NanoSeekResult = unknown // Or a more specific type if possible
export type NanoSeekError = Error // Or a custom error type if needed
