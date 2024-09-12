export interface ResolveParams {
  UHRPUrl?: string
  confederacyHost?: string
  clientPrivateKey?: string
  limit?: number
  offset?: number
}

export interface DownloadResult {
  data: Buffer
  mimeType: string | null
}

export interface DownloadOptions {
  UHRPUrl: string
  confederacyHost?: string
  clientPrivateKey?: string
}

export type DownloadFunction = (
  options: DownloadOptions
) => Promise<DownloadResult>

export interface PushdropResult {
  fields: Buffer[]
}

export interface PacketPayOptions {
  method: string
  body: {
    provider: string
    query: {
      UHRPUrl: string
    }
  }
  clientPrivateKey?: string
}
