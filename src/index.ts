// Export all types
export * from './types/types';

import getUrlFromQueryResult from '../getUrlFromQueryResult';

import * as pushdrop from 'pushdrop';
console.log('pushdrop module:', pushdrop);
import PacketPay from '@packetpay/js';
import * as crypto from 'crypto';
import { getHashFromURL, getURLForHash, isValidURL } from 'uhrp-url'; // Adjust the import path as needed

// 'crypto' is available globally in Node.js, so no need to redeclare
// 'fetch' is available globally in the browser, no need to redeclare

interface ResolveParams {
  UHRPUrl: string;
  confederacyHost?: string;
  clientPrivateKey?: string;
}

/**
 * Locates HTTP URLs where content can be downloaded.
 *
 * @param {Object} obj - All parameters are passed in an object.
 * @param {String} obj.UHRPUrl - The UHRP URL to resolve.
 * @param {string} obj.confederacyHost - HTTPS URL for the Confederacy host with default setting.
 * @param {String} [obj.clientPrivateKey] - Key used to resolve the file (for payment).
 * 
 * @return {Array<String>} - An array of HTTP URLs where content can be downloaded.
 * @throws {Error} - If UHRP URL is invalid, or there is an error retrieving URLs from UHRP token.
 */
export async function resolve({ UHRPUrl, confederacyHost = 'https://confederacy.babbage.systems', clientPrivateKey }: ResolveParams): Promise<string[] | null> {
  console.log('resolve():UHRPUrl=', UHRPUrl);
  console.log('resolve():confederacyHost=', confederacyHost);
  console.log('resolve():clientPrivateKey=', clientPrivateKey);

  if (!isValidURL(UHRPUrl)) {
    console.log('resolve():Invalid UHRP URL');
    throw new Error('Invalid parameter UHRP URL');
  }

  console.log('resolve():call PacketPay()');
  let response;
  try {
    response = await PacketPay(`${confederacyHost}/lookup`, {
      method: 'POST',
      body: {
        provider: 'UHRP',
        query: { UHRPUrl }
      }
    }, { clientPrivateKey });
    console.log('resolve():called PacketPay()');
  } catch (error) {
    console.error('Error in PacketPay:', error);
    throw error;
  }
  
  let lookupResult;
  try {
    lookupResult = JSON.parse(Buffer.from(response.body).toString('utf8'));
    console.log('resolve():lookupResult=', lookupResult);
  } catch (error) {
    console.error('Error parsing lookupResult:', error);
    throw error;
  }

  if (lookupResult.status === 'error') {
    const e = new Error(lookupResult.description) as any;
    e.code = lookupResult.code || 'ERR_UNKNOWN';
    throw e;
  }

  if (lookupResult.length < 1) return null;

  const decodedResults: string[] = [];

  for (const result of lookupResult) {
    console.log('resolve():call pushdrop.decode():result=', result);
    console.log('resolve():call pushdrop.decode():result.outputScript=', result.outputScript);
    let decodedResult;
    try {
      decodedResult = pushdrop.decode({
        script: result.outputScript,
        fieldFormat: 'buffer'
      });
    } catch (error) {
      console.error('Error decoding script:', error);
      continue; // Skip this iteration and move to the next result
    }
    console.log('resolve():decodedResult=', decodedResult);
    if (decodedResult.op === 'advertise') {
      const url = getUrlFromQueryResult(decodedResult.url);
      decodedResults.push(url);
    }
  }

  return decodedResults.length > 0 ? decodedResults : null;
};

// Import types
import { DownloadOptions, DownloadResult } from './types/types';

// Update the download function signature to use the imported types
export async function download(options: DownloadOptions): Promise<DownloadResult> {
  console.log("Using local nanoseek download function");
  console.log("download():call isValidURL():options=", options);
  console.log("download():call isValidURL():UHRPUrl=", options.UHRPUrl);

  if (!isValidURL(options.UHRPUrl)) {
    throw new Error("Invalid UHRP URL");
  }

  console.log('download():isValidURL');
  const hash = getHashFromURL(options.UHRPUrl);
  options.UHRPUrl = getURLForHash(hash);
  console.log('download():hash=', hash);
  console.log('download():UHRPUrl=', options.UHRPUrl);
  console.log('download():clientPrivateKey=', options.clientPrivateKey);

  const URLs = await resolve({ UHRPUrl: options.UHRPUrl, confederacyHost: options.confederacyHost, clientPrivateKey: options.clientPrivateKey });
  if (!URLs || URLs.length === 0) {
    const e = new Error('Unable to resolve URLs from UHRP URL!') as any;
    e.code = 'ERR_NO_RESOLVED_URLS_FOUND';
    throw e;
  }
  console.log('download():URLs=', URLs);

  for (const url of URLs) {
    try {
      const result = await fetch(url, { method: 'GET' });
      console.log('download():result=', result);

      if (result.status >= 400) continue;

      const blob = await result.blob();
      const contentBuffer = Buffer.from(await blob.arrayBuffer());
      console.log('download():contentBuffer=', contentBuffer);

      const contentHash = crypto
        .createHash('sha256')
        .update(contentBuffer)
        .digest('hex');
      console.log('download():contentHash=', contentHash);

      if (contentHash !== hash.toString('hex')) continue;

      return {
        data: contentBuffer,
        mimeType: result.headers.get('Content-Type') || ''
      };
    } catch (e) {
      console.error(e);
      continue;
    }
  }

  const e = new Error(`Unable to download content from ${options.UHRPUrl}`) as any;
  e.code = 'ERR_INVALID_DOWNLOAD_URL';
  throw e;
};

/*
export function isValidURL(url: string): boolean {
  // Implement your URL validation logic here
  // For now, let's use a simple check
  console.log('isValidURL():url=', url);

  return url.startsWith('XU');
}
  */
