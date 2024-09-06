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

// Update ResolveParams to use basic types
export interface ResolveParams {
  UHRPUrl: string; // Changed from UHRPUrl to string
  confederacyHost?: string;
  packetPayClient?: any; // Changed from PacketPayClient to any
}
