import { resolve, download } from '../index'
import { isValidURL, getHashFromURL, getURLForHash } from 'uhrp-url'
import * as pushdrop from 'pushdrop'
import fetch from 'isomorphic-fetch'
import PacketPay from '@packetpay/js'
import crypto from 'crypto'
import { getUrlFromQueryResult } from '../utils/getUrlFromQueryResult'

jest.mock('uhrp-url')
jest.mock('pushdrop')
jest.mock('isomorphic-fetch')
jest.mock('@packetpay/js')
jest.mock('crypto')
jest.mock('../utils/getUrlFromQueryResult')

const mockHash = Buffer.from(
  '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
  'hex'
)

const mockOutputScript = '4104ca0a8ce950bf2bc85115bd68818455ae2f187efc96c7527dfad98b69531ae65d13cff3e6f07263dcc64c8ccfd03884983a896b0c5887f2ec5bfd7ad739b76119ac213155485250596e4d4850755135546762334146384a5871774b6b6d5a56793568472231485438347a7272467645594658567a6b5343436f6968706d33437754586a74726b207a51691da58dd6f105df11ad7ec0dba2e27b2207d60cd1b7a97dc6ba887dd910096164766572746973654468747470733a2f2f73746167696e672d6e616e6f73746f72652e626162626167652e73797374656d732f63646e2f4d47597a6159437753554b7659704244587554674c4d0a323032383730383231330432363735473045022100d3a43092c28c8027ad450a38076bcf205b9c4676ddfa51c42df4aa88a022d2a102200af90d2a4ef0fa979d0ff79e9461219b9c4f2be84f2dc8a031a49cfa1b9a376a6d6d6d6d'

const mockUHRPUrl = 'uhrp://example.com/path'

const mockResolvedUrl = 'https://staging-nanostore.babbage.systems/cdn/MGYzaYCwSUKvYpBDXuTgLM'

describe('NanoSeek', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(isValidURL as jest.Mock).mockReturnValue(true)
    ;(getHashFromURL as jest.Mock).mockReturnValue(mockHash)
    ;(getURLForHash as jest.Mock).mockReturnValue(mockUHRPUrl)
    ;(PacketPay as jest.Mock).mockResolvedValue({
      body: Buffer.from(JSON.stringify([
        { outputScript: mockOutputScript }
      ]))
    })
    ;(pushdrop.decode as jest.Mock).mockReturnValue({
      fields: [
        Buffer.from('field1'),
        Buffer.from('field2'),
        Buffer.from('field3'),
        Buffer.from('field4'),
        Buffer.from(mockResolvedUrl)
      ]
    })
    ;(getUrlFromQueryResult as jest.Mock).mockReturnValue(mockResolvedUrl)
    ;(fetch as jest.Mock).mockResolvedValue({
      status: 200,
      blob: () => ({
        arrayBuffer: () => new ArrayBuffer(3)
      }),
      headers: {
        get: () => 'application/json'
      }
    })
    ;(crypto.createHash as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue(mockHash.toString('hex'))
    })
  })

  describe('resolve', () => {
    it('Calls isValidURL with the URL', async () => {
      await resolve({ UHRPUrl: mockUHRPUrl })
      expect(isValidURL).toHaveBeenCalledWith(mockUHRPUrl)
    })

    it('Calls PacketPay with the correct parameters', async () => {
      await resolve({ UHRPUrl: mockUHRPUrl })
      expect(PacketPay).toHaveBeenCalledWith(
        'https://confederacy.babbage.systems/lookup',
        {
          method: 'POST',
          body: {
            provider: 'UHRP',
            query: {
              UHRPUrl: mockUHRPUrl
            }
          }
        },
        expect.any(Object)
      )
    })

    it('Returns the URLs from PacketPay response', async () => {
      const result = await resolve({ UHRPUrl: mockUHRPUrl })
      expect(result).toEqual([mockResolvedUrl])
    })
  })

  describe('download', () => {
    it('Calls getHashFromURL with the URL', async () => {
      await download({ UHRPUrl: mockUHRPUrl })
      expect(getHashFromURL).toHaveBeenCalledWith(mockUHRPUrl)
    })

    it('Calls fetch with the resolved URL', async () => {
      await download({ UHRPUrl: mockUHRPUrl })
      expect(fetch).toHaveBeenCalledWith(mockResolvedUrl, { method: 'GET' })
    })

    it('Returns the data and MIME type', async () => {
      const result = await download({ UHRPUrl: mockUHRPUrl })
      expect(result).toEqual({
        data: expect.any(Buffer),
        mimeType: 'application/json'
      })
    })
  })
})
