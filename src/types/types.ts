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

export type QueryResult = Record<string, unknown>

export type NanoSeekOptions = Record<string, unknown>
export type NanoSeekResult = unknown
export type NanoSeekError = Error

// Add this interface for PacketPayClient
export interface PacketPayClient {
  (url: string, fetchConfig?: Record<string, unknown>, config?: {
    authriteConfig?: Record<string, unknown>;
    ninjaConfig?: Record<string, unknown>;
    clientPrivateKey?: string;
    description?: string;
  }): Promise<{
    status: number;
    headers: Headers;
    body: unknown;
  }>;
}

// Update ResolveParams to use the new interface
export interface ResolveParams {
  UHRPUrl: string;
  confederacyHost?: string;
  packetPayClient?: PacketPayClient;
}
