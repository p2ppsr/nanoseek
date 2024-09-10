import {
  setupMocks,
  mockFetch,
  mockHash,
  mockOutputScript,
  mockUHRPUrl,
  mockResolvedUrl
} from '../utils/testHelpers'
import PacketPay from '@packetpay/js'
import * as pushdrop from 'pushdrop'
import { isValidURL, getHashFromURL, getURLForHash } from 'uhrp-url'
import crypto from 'crypto'

jest.mock('@packetpay/js')
jest.mock('pushdrop')
jest.mock('uhrp-url')
jest.mock('crypto')

describe('testHelpers', () => {
  describe('setupMocks', () => {
    it('should clear all mocks', () => {
      // Setup a mock function
      const mockFn = jest.fn()
      mockFn()
      expect(mockFn).toHaveBeenCalled()

      // Call setupMocks
      setupMocks()

      // Check if the mock function's calls have been cleared
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should mock isValidURL', () => {
      isValidURL('test')
      expect(isValidURL).toHaveBeenCalledWith(expect.any(String))
      expect(isValidURL('test')).toBe(true)
    })

    it('should mock getHashFromURL', () => {
      getHashFromURL('test')
      expect(getHashFromURL).toHaveBeenCalledWith(expect.any(String))
      expect(getHashFromURL('test')).toBe(mockHash)
    })

    it('should mock getURLForHash', () => {
      const testBuffer = Buffer.from('test')
      getURLForHash(testBuffer)
      expect(getURLForHash).toHaveBeenCalledWith(expect.any(Buffer))
      expect(getURLForHash(testBuffer)).toBe(mockUHRPUrl)
    })

    it('should mock PacketPay', async () => {
      const result = await PacketPay()
      expect(result).toEqual({
        body: Buffer.from(JSON.stringify([{ outputScript: mockOutputScript }]))
      })
    })

    it('should mock pushdrop.decode', () => {
      const mockPushdropInput = {
        script: 'mockScript',
        fieldFormat: 'mockFieldFormat'
      }
      const result = pushdrop.decode(mockPushdropInput)
      expect(result).toEqual({
        fields: [
          Buffer.from('field1'),
          Buffer.from('field2'),
          Buffer.from('field3'),
          Buffer.from('field4'),
          Buffer.from(mockResolvedUrl)
        ]
      })
    })

    it('should mock crypto.createHash', () => {
      const mockHashInstance = crypto.createHash('sha256')
      expect(mockHashInstance.update).toBeDefined()
      expect(mockHashInstance.digest).toBeDefined()
      expect(mockHashInstance.digest()).toBe(mockHash.toString('hex'))
    })
  })

  describe('mockFetch', () => {
    it('should return a mocked fetch function with default parameters', async () => {
      const mockedFetch = mockFetch()
      const response = await mockedFetch('https://example.com')
      expect(response.status).toBe(200)
      expect(response.headers.get()).toBe('application/json')
      expect(await response.arrayBuffer()).toBeInstanceOf(ArrayBuffer)
    })

    it('should return a mocked fetch function with custom parameters', async () => {
      const mockedFetch = mockFetch(404, 'text/plain')
      const response = await mockedFetch('https://example.com')
      expect(response.status).toBe(404)
      expect(response.headers.get()).toBe('text/plain')
    })
  })

  describe('exported constants', () => {
    it('should export mockHash as a Buffer', () => {
      expect(mockHash).toBeInstanceOf(Buffer)
      expect(mockHash.toString('hex')).toBe(
        '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81'
      )
    })

    it('should export mockOutputScript as a string', () => {
      expect(typeof mockOutputScript).toBe('string')
      expect(mockOutputScript).toBe(
        '4104ca0a8ce950bf2bc85115bd68818455ae2f187efc96c7527dfad98b69531ae65d13cff3e6f07263dcc64c8ccfd03884983a896b0c5887f2ec5bfd7ad739b76119ac'
      )
    })

    it('should export mockUHRPUrl as a string', () => {
      expect(typeof mockUHRPUrl).toBe('string')
      expect(mockUHRPUrl).toBe('uhrp://example.com/path')
    })

    it('should export mockResolvedUrl as a string', () => {
      expect(typeof mockResolvedUrl).toBe('string')
      expect(mockResolvedUrl).toBe(
        'https://staging-nanostore.babbage.systems/cdn/MGYzaYCwSUKvYpBDXuTgLM'
      )
    })
  })
})
