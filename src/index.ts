import { QueryResult } from './utils/getUrlFromQueryResult'

// Required to export all types
export * from './types/types'
import fetch from 'cross-fetch'
import { getUrlFromQueryResult } from './utils/getUrlFromQueryResult'
import * as pushdrop from 'pushdrop'
import PacketPay from '@packetpay/js'
import { isValidURL } from 'uhrp-url'

interface ErrorWithCode extends Error {
  code?: string
}

interface ResolveParams {
  UHRPUrl: string
  confederacyHost?: string
  clientPrivateKey?: string
}

interface LookupResult {
  status: string
  description?: string
  code?: string
  [key: string]: unknown
}

export async function resolve({ UHRPUrl, confederacyHost = 'https://confederacy.babbage.systems', clientPrivateKey }: ResolveParams): Promise<string[] | null> {
  if (!isValidURL(UHRPUrl)) {
    throw new Error('Invalid parameter UHRP URL');
  }

  const response: { body: Buffer } = await PacketPay(`${confederacyHost}/lookup`, {
    method: 'POST',
    body: {
      provider: 'UHRP',
      query: { UHRPUrl }
    }
  }, { clientPrivateKey })
  
  const lookupResult: LookupResult = JSON.parse(Buffer.from(response.body).toString('utf8'))

  if (lookupResult.status === 'error') {
    const e: ErrorWithCode = new Error(lookupResult.description || 'Unknown error');
    e.code = lookupResult.code || 'ERR_UNKNOWN';
    throw e;
  }

  if (!Array.isArray(lookupResult) || lookupResult.length < 1) return null;

  const decodedResults: string[] = [];

  for (const result of lookupResult) {
    const decodedResult = pushdrop.decode({
      script: result.outputScript,
      fieldFormat: 'buffer'
    })

    const url = getUrlFromQueryResult(decodedResult as QueryResult)
    if (url) {
      decodedResults.push(url)
    }
  }

  return decodedResults.length > 0 ? decodedResults : null;
}

import { DownloadOptions, DownloadResult } from './types/types'

export async function download({ UHRPUrl, confederacyHost, clientPrivateKey }: DownloadOptions): Promise<DownloadResult> {
  const resolveResult = await resolve({ UHRPUrl, confederacyHost, clientPrivateKey })

  if (!resolveResult || !Array.isArray(resolveResult) || resolveResult.length === 0) {
    throw new Error('Unable to resolve URLs from UHRP URL!')
  }

  for (const url of resolveResult) {
    const response = await fetch(url, { method: 'GET' })

    if (response.status === 200) {
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const mimeType = response.headers.get('content-type') || 'application/octet-stream'

      return { data: buffer, mimeType }
    }
  }

  throw new Error('Failed to download content')
}
