import * as indexModule from '../index'
import * as resolveModule from '../components/resolve'
import * as uhrpUrl from 'uhrp-url'
import fetch from 'isomorphic-fetch'
import crypto from 'crypto'

jest.mock('uhrp-url')
jest.mock('isomorphic-fetch')
jest.mock('crypto')

// Mock PacketPay to control its behavior
jest.mock('@packetpay/js', () => ({
  PacketPay: jest.fn()
}))

const createMockArrayBuffer = (content: string): ArrayBuffer => {
  const buffer = new ArrayBuffer(content.length)
  const uint8Array = new Uint8Array(buffer)
  for (let i = 0; i < content.length; i++) {
    uint8Array[i] = content.charCodeAt(i)
  }
  return buffer
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let resolveSpy: jest.SpyInstance

describe('download function', () => {
  const mockValidUHRPUrl = 'uhrp://validmockhash'

  beforeEach(() => {
    jest.clearAllMocks()
    ;(uhrpUrl.isValidURL as jest.Mock).mockImplementation(
      (url: string) => url === mockValidUHRPUrl
    )
    ;(uhrpUrl.getHashFromURL as jest.Mock).mockReturnValue(
      Buffer.from('mockhash')
    )
    ;(uhrpUrl.getURLForHash as jest.Mock).mockReturnValue(mockValidUHRPUrl)
    ;(crypto.createHash as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue(Buffer.from('mockhash').toString('hex'))
    })
    resolveSpy = jest
      .spyOn(resolveModule, 'resolve')
      .mockResolvedValue(['http://example1.com', 'http://example2.com'])
  })

  describe('download function', () => {
    const mockValidUHRPUrl = 'uhrp://validmockhash'
    const mockInvalidUHRPUrl = 'invalid://url'

    beforeEach(() => {
      jest.clearAllMocks()
      ;(uhrpUrl.isValidURL as jest.Mock).mockImplementation(
        (url: string) => url === mockValidUHRPUrl
      )
      ;(uhrpUrl.getHashFromURL as jest.Mock).mockReturnValue(
        Buffer.from('mockhash')
      )
      ;(uhrpUrl.getURLForHash as jest.Mock).mockReturnValue(mockValidUHRPUrl)
      ;(crypto.createHash as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest
          .fn()
          .mockReturnValue(Buffer.from('mockhash').toString('hex'))
      })
      resolveSpy = jest
        .spyOn(resolveModule, 'resolve')
        .mockResolvedValue(['http://example1.com', 'http://example2.com'])
    })

    it('should successfully download content with correct MIME type', async () => {
      const mockContent = 'mock content'
      const mockArrayBuffer = createMockArrayBuffer(mockContent)

      ;(fetch as jest.Mock).mockResolvedValue({
        status: 200,
        blob: jest.fn().mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer)
        }),
        headers: { get: jest.fn().mockReturnValue('text/plain') }
      })

      const result = await indexModule.download({ UHRPUrl: mockValidUHRPUrl })

      expect(result).toEqual({
        data: expect.any(Buffer),
        mimeType: 'text/plain'
      })
      expect(result.data.toString()).toBe(mockContent)
    })

    it('should throw an error for invalid URLs', async () => {
      (uhrpUrl.isValidURL as jest.Mock).mockReturnValueOnce(false)

      await expect(
        indexModule.download({ UHRPUrl: mockInvalidUHRPUrl })
      ).rejects.toThrow('Invalid parameter UHRP url')
    })

    it('should throw an error if no URLs are resolved', async () => {
      jest.spyOn(resolveModule, 'resolve').mockResolvedValueOnce([])

      await expect(
        indexModule.download({ UHRPUrl: mockValidUHRPUrl })
      ).rejects.toThrow('Unable to resolve URLs from UHRP URL!')
    })

    it('should retry all URLs before throwing an error', async () => {
      const mockUrls = ['http://example1.com', 'http://example2.com']

      ;(fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('First URL failed'))
        .mockRejectedValueOnce(new Error('Second URL failed'))

      await expect(
        indexModule.download({ UHRPUrl: mockValidUHRPUrl })
      ).rejects.toThrow('Unable to download content from')

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(fetch).toHaveBeenNthCalledWith(1, mockUrls[0], expect.anything())
      expect(fetch).toHaveBeenNthCalledWith(2, mockUrls[1], expect.anything())
    })

    it('should handle large file downloads correctly', async () => {
      const largeContent = 'a'.repeat(1024 * 1024) // 1MB of data
      const mockArrayBuffer = createMockArrayBuffer(largeContent)

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        blob: jest.fn().mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer)
        }),
        headers: { get: jest.fn().mockReturnValue('application/octet-stream') }
      })

      const result = await indexModule.download({ UHRPUrl: mockValidUHRPUrl })

      expect(result).toEqual({
        data: expect.any(Buffer),
        mimeType: 'application/octet-stream'
      })
      expect(result.data.length).toBe(largeContent.length)
      expect(result.data.toString()).toBe(largeContent)
    })
  })
})
