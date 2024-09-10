import {
  resolve as originalResolve,
  download as originalDownload,
  ResolveParams,
  DownloadResult
} from './index'
import PacketPay from '@packetpay/js'

// Define DownloadParams if it's not exported from './index'
interface DownloadParams {
  url: string
  // Add other properties as needed
}

function createLogger(funcName: string) {
  return {
    logStart: (...args: unknown[]) =>
      console.log(`[DEBUG] ${funcName} called with:`, JSON.stringify(args)),
    logEnd: () => console.log(`[DEBUG] ${funcName} completed successfully`),
    logError: (error: Error) =>
      console.error(`[ERROR] Error in ${funcName}:`, error)
  }
}

function wrapPacketPay(originalPacketPay: typeof PacketPay) {
  return jest.fn((...args: Parameters<typeof PacketPay>) => {
    console.log('[DEBUG] PacketPay called with:', JSON.stringify(args))
    return originalPacketPay(...args)
  })
}

export const resolve: typeof originalResolve = async query => {
  const logger = createLogger('resolve')
  const originalPacketPay = PacketPay
  logger.logStart(query)
  try {
    ;(PacketPay as unknown) = wrapPacketPay(originalPacketPay)
    const result = await originalResolve(query)
    logger.logEnd()
    return result
  } catch (error) {
    logger.logError(error as Error)
    throw error
  } finally {
    ;(PacketPay as unknown) = originalPacketPay
  }
}

export const download: typeof originalDownload = params => {
  const logger = createLogger('download')
  const originalPacketPay = PacketPay
  logger.logStart(params)
  try {
    ;(PacketPay as unknown) = wrapPacketPay(originalPacketPay)
    return originalDownload(params).then(result => {
      logger.logEnd()
      return result
    })
  } catch (error) {
    logger.logError(error as Error)
    throw error
  } finally {
    ;(PacketPay as unknown) = originalPacketPay
  }
}

export function logResolve(params: ResolveParams, result: string[]): void {
  console.log('Resolve params:', params, 'Result:', result)
}

export function logDownload(
  params: DownloadParams,
  result: DownloadResult
): void {
  console.log('Download params:', params, 'Result:', result)
}

export function logError(error: Error): void {
  console.error('Error:', error)
}
