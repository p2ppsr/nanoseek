import { download } from '../index'
import * as uhrpUrl from 'uhrp-url'
import fetch from 'isomorphic-fetch'
import crypto from 'crypto'

jest.mock('@packetpay/js')
jest.mock('pushdrop')
jest.mock('uhrp-url')
jest.mock('isomorphic-fetch')
jest.mock('crypto')

jest.mock('../index', () => {
  const originalModule = jest.requireActual('../index')
  return {
    ...originalModule,
    resolve: jest
      .fn()
      .mockResolvedValue(['http://example1.com', 'http://example2.com'])
  }
})

describe('download function', () => {
  const mockContent = 'mock content'
  const mockArrayBuffer = Buffer.from(mockContent)
  const mockHash = Buffer.from('mockhash').toString('hex')

  beforeEach(() => {
    jest.clearAllMocks()
    ;(uhrpUrl.isValidURL as jest.Mock).mockReturnValue(true)
    ;(uhrpUrl.getHashFromURL as jest.Mock).mockReturnValue(
      Buffer.from('mockhash')
    )
    ;(uhrpUrl.getURLForHash as jest.Mock).mockReturnValue('uhrp://mockhash')
    ;(fetch as jest.Mock).mockResolvedValue({
      status: 200,
      blob: jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer)
      }),
      headers: { get: jest.fn().mockReturnValue('text/plain') }
    })

    const mockCreateHash = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue(mockHash)
    }
    ;(crypto.createHash as jest.Mock).mockReturnValue(mockCreateHash)
  })

  test('should resolve UHRP URL successfully', async () => {
    const result = await download({ UHRPUrl: 'uhrp://example.com' })
    expect(result).not.toBeNull()
    expect(uhrpUrl.isValidURL).toHaveBeenCalledWith('uhrp://example.com')
  })

  test('should retrieve correct data', async () => {
    const result = await download({ UHRPUrl: 'uhrp://example.com' })
    expect(result.data).toBeInstanceOf(Buffer)
    expect(Buffer.from(result.data).toString()).toBe(mockContent)
  })

  test('should handle MIME type correctly', async () => {
    const result = await download({ UHRPUrl: 'uhrp://example.com' })
    expect(result.mimeType).toBe('text/plain')
  })

  test('should verify hash correctly', async () => {
    await download({ UHRPUrl: 'uhrp://example.com' })
    expect(crypto.createHash).toHaveBeenCalledWith('sha256')
  })

  test('should fetch from resolved URL', async () => {
    await download({ UHRPUrl: 'uhrp://example.com' })
    expect(fetch).toHaveBeenCalledWith('http://example1.com', expect.anything())
  })
})
