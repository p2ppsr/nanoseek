import { resolve } from '../components/resolve'
import * as uhrpUrl from 'uhrp-url'
import * as pushdrop from 'pushdrop'
import PacketPay from '@packetpay/js'
import { setupMocks } from '../utils/testHelpers'
import { NanoSeekError } from '../utils/errors'
import { Buffer } from 'buffer'

jest.mock('@packetpay/js', () => jest.fn())
jest.mock('uhrp-url')
jest.mock('pushdrop')

describe('resolve function', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupMocks()
    ;(uhrpUrl.isValidURL as jest.Mock).mockReturnValue(true)
  })

  it('should call isValidURL with the UHRPUrl', async () => {
    const UHRPUrl = 'uhrp://example.com'
    await resolve({ UHRPUrl })
    expect(uhrpUrl.isValidURL).toHaveBeenCalledWith(UHRPUrl)
  })

  it('should call PacketPay with correct parameters', async () => {
    const UHRPUrl = 'uhrp://example.com'
    const confederacyHost = 'https://test.confederacy.com'
    const clientPrivateKey = 'testPrivateKey'

    await resolve({ UHRPUrl, confederacyHost, clientPrivateKey })

    expect(PacketPay).toHaveBeenCalledWith(`${confederacyHost}/lookup`, {
      method: 'POST',
      body: {
        provider: 'UHRP',
        query: { UHRPUrl }
      },
      clientPrivateKey
    })
  })

  it('should return mock URLs in test environment', async () => {
    // Mock the PacketPay response to return the URLs
    PacketPay.mockResolvedValueOnce({
      body: JSON.stringify([{ outputScript: 'mockOutputScript' }])
    })

    // Mock the pushdrop.decode function to return the expected fields
    pushdrop.decode.mockReturnValue({
      fields: [
        'field1',
        'field2',
        'field3',
        'field4',
        'http://example1.com\nhttp://example2.com'
      ]
    })

    const result = await resolve({ UHRPUrl: 'uhrp://example.com' })
    expect(result).toEqual(['http://example1.com', 'http://example2.com'])
  })

  it('should throw an error for invalid URL', async () => {
    ;(uhrpUrl.isValidURL as jest.Mock).mockReturnValueOnce(false)
    await expect(resolve({ UHRPUrl: 'invalid-url' })).rejects.toThrow(
      'Invalid parameter UHRP url'
    )
  })

  it('should throw an error when Confederacy lookup fails', async () => {
    const errorMessage = 'Confederacy lookup failed'
    ;(PacketPay as jest.Mock).mockRejectedValueOnce(new Error(errorMessage))

    await expect(resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow(
      errorMessage
    )
  })

  it('should return an empty array when PacketPay returns empty response', async () => {
    ;(PacketPay as jest.Mock).mockResolvedValueOnce({ body: '[]' })
    const result = await resolve({ UHRPUrl: 'uhrp://example.com' })
    expect(result).toEqual([])
  })

  it('should throw an error when outputScript is missing in PacketPay response', async () => {
    ;(PacketPay as jest.Mock).mockResolvedValueOnce({
      body: JSON.stringify([{}])
    })
    await expect(resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow(
      'Invalid response format'
    )
  })

  it('should handle invalid pushdrop decode result', async () => {
    ;(PacketPay as jest.Mock).mockResolvedValueOnce({
      body: Buffer.from(JSON.stringify([{ outputScript: 'test' }]))
    })
    ;(pushdrop.decode as jest.Mock).mockReturnValueOnce({ fields: [] })
    await expect(resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow(
      NanoSeekError
    )
  })

  it('should return multiple valid URLs', async () => {
    const mockUrls = ['http://example1.com', 'http://example2.com']
    ;(PacketPay as jest.Mock).mockResolvedValueOnce({
      body: JSON.stringify([{ outputScript: 'mockOutputScript' }])
    })
    ;(pushdrop.decode as jest.Mock).mockReturnValueOnce({
      fields: ['', '', '', '', mockUrls.join('\n')]
    })
    const result = await resolve({ UHRPUrl: 'uhrp://example.com' })
    expect(result).toEqual(mockUrls)
  })

  it('should handle network errors', async () => {
    ;(PacketPay as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
    await expect(resolve({ UHRPUrl: 'uhrp://example.com' })).rejects.toThrow(
      'Network error'
    )
  })

  it('should use default confederacyHost if not provided', async () => {
    ;(PacketPay as jest.Mock).mockResolvedValueOnce({
      body: Buffer.from(JSON.stringify([{ outputScript: 'test' }]))
    })
    ;(pushdrop.decode as jest.Mock).mockReturnValueOnce({
      fields: [
        '',
        '',
        '',
        '',
        'https://staging-nanostore.babbage.systems/cdn/MGYzaYCwSUKvYpBDXuTgLM'
      ]
    })
    const result = await resolve({ UHRPUrl: 'uhrp://example.com' })
    expect(result).toEqual([
      'https://staging-nanostore.babbage.systems/cdn/MGYzaYCwSUKvYpBDXuTgLM'
    ])
    expect(PacketPay).toHaveBeenCalledWith(
      expect.stringContaining('/lookup'),
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          provider: 'UHRP',
          query: expect.objectContaining({
            UHRPUrl: 'uhrp://example.com'
          })
        })
      })
    )
  })
})
