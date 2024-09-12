export interface LookupResult {
  status?: string
  description?: string
  code?: string
  outputScript?: string
  [key: string]: unknown
}
    
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
