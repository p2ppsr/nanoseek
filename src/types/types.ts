import 'isomorphic-fetch'

export class NanoSeekError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message)
    this.name = 'NanoSeekError'
  }
}

export interface DownloadOptions {
  UHRPUrl: string
  confederacyHost?: string
  clientPrivateKey?: string
}

export interface DownloadResult {
  data: Buffer
  mimeType: string
}

export type DownloadFunction = (
  options: DownloadOptions
) => Promise<DownloadResult>

export interface QueryResult {
  fields: (string | Buffer)[]
}

export type NanoSeekOptions = Record<string, unknown>
export type NanoSeekResult = unknown

export interface PacketPayClient {
  (
    url: string,
    fetchConfig?: Record<string, unknown>,
    config?: {
      authriteConfig?: Record<string, unknown>
      ninjaConfig?: Record<string, unknown>
      clientPrivateKey?: string
      description?: string
    }
  ): Promise<{
    status: number
    headers: Headers
    body: unknown
  }>
}

export interface ResolveParams {
  UHRPUrl: string
  confederacyHost?: string
  packetPayClient?: PacketPayClient
}
