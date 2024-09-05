// Export all types
export * from './types/types';
import fetch from 'cross-fetch';
// Import getUrlFromQueryResult from the correct path
import { getUrlFromQueryResult } from './getUrlFromQueryResult';

import * as pushdrop from 'pushdrop'
import PacketPay from '@packetpay/js'
import * as crypto from 'crypto'
import { getHashFromURL, getURLForHash, isValidURL } from 'uhrp-url' // Adjust the import path as needed

// Define types for error objects
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
  [key: string]: any // For other potential properties
}

export async function resolve({ UHRPUrl, confederacyHost = 'https://confederacy.babbage.systems', clientPrivateKey }: ResolveParams): Promise<string[] | null> {
  if (!isValidURL(UHRPUrl)) {
    throw new Error('Invalid parameter UHRP URL')
  }

  let response: { body: Buffer }
  try {
    response = await PacketPay(`${confederacyHost}/lookup`, {
      method: 'POST',
      body: {
        provider: 'UHRP',
        query: { UHRPUrl }
      }
    }, { clientPrivateKey })
  } catch (error) {
    console.error('Error in PacketPay:', error)
    throw error
  }
  
  let lookupResult: LookupResult
  try {
    lookupResult = JSON.parse(Buffer.from(response.body).toString('utf8'))
  } catch (error) {
    console.error('Error parsing lookupResult:', error)
    throw error
  }

  if (lookupResult.status === 'error') {
    const e: ErrorWithCode = new Error(lookupResult.description || 'Unknown error')
    e.code = lookupResult.code || 'ERR_UNKNOWN'
    throw e
  }

  if (!Array.isArray(lookupResult) || lookupResult.length < 1) return null

  const decodedResults: string[] = []

  for (const result of lookupResult) {
    try {
      const decodedResult = pushdrop.decode({
        script: result.outputScript,
        fieldFormat: 'buffer'
      })

      const url = getUrlFromQueryResult(decodedResult)
      if (url) {
        decodedResults.push(url)
      }
    } catch (error) {
      console.error('Error decoding script:', error)
      continue
    }
  }

  return decodedResults.length > 0 ? decodedResults : null
}
// Import types
import { DownloadOptions, DownloadResult } from './types/types'

export async function download({ UHRPUrl, confederacyHost, clientPrivateKey }: DownloadOptions): Promise<DownloadResult> {
  try {
    console.log('Download function called with:', { UHRPUrl, confederacyHost });
    
    const resolveResult = await resolve({ UHRPUrl, confederacyHost, clientPrivateKey });
    console.log('Resolve result:', resolveResult);

    if (!resolveResult || !Array.isArray(resolveResult) || resolveResult.length === 0) {
      throw new Error('Unable to resolve URLs from UHRP URL!');
    }

    for (const url of resolveResult) {
      console.log('Attempting to fetch URL:', url);
      const response = await fetch(url, { method: 'GET' });
      console.log('Fetch response status:', response.status);

      if (response.status === 200) {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = response.headers.get('content-type') || 'application/octet-stream';

        console.log('Successfully downloaded content');
        return { data: buffer, mimeType };
      }
    }

    console.log('Failed to download content');
    throw new Error('Failed to download content');
  } catch (error) {
    console.error('Error in download function:', error);
    throw error;
  }
}