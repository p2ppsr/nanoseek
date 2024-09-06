import { resolve, download } from '../index'
import { isValidURL, getHashFromURL, getURLForHash } from 'uhrp-url'
import fetch from 'cross-fetch'
import PacketPay from '@packetpay/js'
import * as pushdrop from 'pushdrop'
import { getUrlFromQueryResult } from '../utils/getUrlFromQueryResult'
import crypto from 'crypto'
import * as babbageSDK from '@babbage/sdk-ts'

jest.mock('@babbage/sdk-ts', () => ({
  ...jest.requireActual('@babbage/sdk-ts'),
  getPublicKey: jest.fn().mockResolvedValue('mockedPublicKey')
}))

// We're not mocking these anymore
// jest.mock('uhrp-url')
// jest.mock('cross-fetch')
// jest.mock('@packetpay/js')
// jest.mock('pushdrop')
// jest.mock('../utils/getUrlFromQueryResult')
// jest.mock('crypto')

import { jest } from '@jest/globals'

// Mock the entire @packetpay/js module
jest.mock('@packetpay/js', () => ({
  PacketPayClient: jest.fn().mockImplementation(() => ({
    request: jest.fn().mockResolvedValue({ /* mock response data */ }),
  })),
}))

describe('NanoSeek', () => {
  const testUHRPUrl = 'XUTpehJ6pWvx5XBPTV4Pts8bhqz1vvFk3bGo6FUSsNyUqWVGrnfJ'
  const confederacyHost = 'https://staging-confederacy.babbage.systems'

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  describe('download function', () => {
    test('should download content successfully', async () => {
      console.log('Starting download test')
      try {
        console.log('Calling download function')
        const result = await download({
          UHRPUrl: testUHRPUrl,
          confederacyHost
        })
        console.log('Download function returned successfully')
        expect(result).toEqual({
          data: expect.any(Buffer),
          mimeType: expect.any(String)
        })
      } catch (error) {
        console.error('Download failed with error:', error)
        console.error('Error stack:', (error as Error).stack)
        throw error // Re-throw the error to fail the test
      }
    }, 30000) // Increased timeout to 30 seconds

    test('should throw an error for invalid UHRP URL', async () => {
      await expect(download({
        UHRPUrl: 'invalid-url',
        confederacyHost
      })).rejects.toThrow('Invalid parameter UHRP url')
    })
  })

  describe('resolve function', () => {
    test('should resolve URLs successfully', async () => {
      console.log('Starting resolve test')
      try {
        console.log('Calling resolve function')
        const result = await resolve({
          UHRPUrl: testUHRPUrl,
          confederacyHost
        })
        console.log('Resolve function returned successfully')
        expect(result).not.toBeNull()
        if (result) {
          expect(result).toBeInstanceOf(Array)
          expect(result.length).toBeGreaterThan(0)
          expect(result[0]).toMatch(/^https?:\/\//) // URL should start with http:// or https://
        }
      } catch (error) {
        console.error('Resolve failed with error:', error)
        console.error('Error stack:', (error as Error).stack)
        throw error // Re-throw the error to fail the test
      }
    }, 30000) // Increased timeout to 30 seconds
  })
})
