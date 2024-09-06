import * as indexModule from '../index'
import PacketPay from '@packetpay/js'
import { isValidURL, getHashFromURL, getURLForHash } from 'uhrp-url'
import fetch from 'cross-fetch'
import * as pushdrop from 'pushdrop'
import { getUrlFromQueryResult } from '../utils/getUrlFromQueryResult'

jest.mock('@packetpay/js')
jest.mock('uhrp-url', () => ({
  isValidURL: jest.fn(),
  getHashFromURL: jest.fn(),
  getURLForHash: jest.fn()
}))
jest.mock('cross-fetch')
jest.mock('pushdrop')
jest.mock('../utils/getUrlFromQueryResult')
jest.mock('../index', () => ({
  ...jest.requireActual('../index'),
  resolve: jest.fn(),
  download: jest.fn()
}))

describe('NanoSeek', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.MockedFunction<typeof fetch>).mockClear()
    ;(isValidURL as jest.Mock).mockReturnValue(true)
    ;(getHashFromURL as jest.Mock).mockReturnValue('mockhash')
    ;(getURLForHash as jest.Mock).mockReturnValue('uhrp://example.com')
    ;(indexModule.download as jest.Mock).mockImplementation(async ({ UHRPUrl }) => {
      await indexModule.resolve({ UHRPUrl })
      return {
        data: Buffer.from('mock data'),
        mimeType: 'application/json'
      }
    })
    ;(indexModule.resolve as jest.Mock).mockResolvedValue(['https://example.com/cdn/file'])
  })

  describe('download function', () => {
    test('should download content successfully', async () => {
      const result = await indexModule.download({ UHRPUrl: 'uhrp://example.com' })

      expect(indexModule.resolve).toHaveBeenCalledWith({ UHRPUrl: 'uhrp://example.com' })
      expect(result).toEqual({
        data: expect.any(Buffer),
        mimeType: 'application/json'
      })
    })

    test('should throw an error if all download attempts fail', async () => {
      ;(indexModule.download as jest.Mock).mockRejectedValueOnce(new Error('Unable to download content from uhrp://example.com'))

      await expect(indexModule.download({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('Unable to download content from uhrp://example.com')
    })
  })

  describe('resolve function', () => {
    test('should return an array of URLs', async () => {
      const result = await indexModule.resolve({ UHRPUrl: 'uhrp://example.com' })
      expect(result).toEqual(['https://example.com/cdn/file'])
    })

    test('should throw an error for invalid UHRP URL', async () => {
      ;(isValidURL as jest.Mock).mockReturnValueOnce(false)
      ;(indexModule.resolve as jest.Mock).mockRejectedValueOnce(new Error('Invalid parameter UHRP url'))

      await expect(indexModule.resolve({ UHRPUrl: 'invalid-url' })).rejects.toThrow('Invalid parameter UHRP url')
    })

    test('should return null for empty lookup result', async () => {
      ;(indexModule.resolve as jest.Mock).mockResolvedValueOnce(null)
      const result = await indexModule.resolve({ UHRPUrl: 'uhrp://example.com' })
      expect(result).toBeNull()
    })

    test('should handle PacketPay error', async () => {
      ;(indexModule.resolve as jest.Mock).mockRejectedValueOnce(new Error('PacketPay error'))
      await expect(indexModule.resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('PacketPay error')
    })

    test('should handle lookup result error', async () => {
      ;(indexModule.resolve as jest.Mock).mockRejectedValueOnce(new Error('Lookup error'))
      await expect(indexModule.resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('Lookup error')
    })

    test('should handle script decoding error', async () => {
      ;(indexModule.resolve as jest.Mock).mockRejectedValueOnce(new Error('Decoding error'))
      await expect(indexModule.resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow('Decoding error')
    })
  })
})
