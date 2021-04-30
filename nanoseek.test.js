const parapet = require('parapet-js')
const fetch = require('isomorphic-fetch')
const { getHashFromURL } = require('uhrp-url')
const { resolve, download } = require('./index')
const crypto = require('crypto')

jest.mock('parapet-js')
jest.mock('isomorphic-fetch')
jest.mock('uhrp-url')

const mockHash = Buffer.from(
  '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
  'hex'
)

describe('NanoSeek', () => {
  beforeEach(() => {
    getHashFromURL.mockReturnValue(mockHash)
    parapet.mockReturnValue([
      { URL: 'MOCK_HTTP_URL_1' },
      { URL: 'MOCK_HTTP_URL_2' }
    ])
    fetch.mockReturnValue({
      status: 200,
      blob: () => ({
        arrayBuffer: () => new Uint8Array([1, 2, 3])
      }),
      headers: {
        get: () => 'application/json'
      }
    })
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  describe('resolve', () => {
    it('Calls getHashFromURL with the URL', async () => {
      await resolve({ URL: 'MOCK_URL' })
      expect(getHashFromURL).toHaveBeenLastCalledWith('MOCK_URL')
    })
    it('Calls parapet with the query', async () => {
      await resolve({ URL: 'MOCK_URL' })
      expect(parapet).toHaveBeenLastCalledWith({
        bridge: '1AJsUZ7MsJGwmkCZSoDpro28R52ptvGma7',
        request: {
          type: 'json-query',
          query: {
            v: 3,
            q: {
              collection: 'content',
              find: {
                hash: mockHash.toString('hex'),
                revoked: false,
                expiryTime: { $gte: expect.any(Number) },
                host: { $in: ['15RLMCYZ738Y3cBb56yDSWa7TkAFxSQtyf'] }
              },
              limit: 10,
              skip: 0,
              project: {
                URL: 1,
                _id: 0
              }
            }
          }
        }
      })
    })
    it('Uses limit and offset in the parapet query', async () => {
      await resolve({
        URL: 'MOCK_URL',
        limit: 20,
        offset: 40
      })
      expect(parapet).toHaveBeenLastCalledWith({
        bridge: '1AJsUZ7MsJGwmkCZSoDpro28R52ptvGma7',
        request: {
          type: 'json-query',
          query: {
            v: 3,
            q: {
              collection: 'content',
              find: {
                hash: mockHash.toString('hex'),
                revoked: false,
                expiryTime: { $gte: expect.any(Number) },
                host: { $in: ['15RLMCYZ738Y3cBb56yDSWa7TkAFxSQtyf'] }
              },
              limit: 20,
              skip: 40,
              project: {
                URL: 1,
                _id: 0
              }
            }
          }
        }
      })
    })
    it('Omits hosts from the query when trustedHosts is empty', async () => {
      await resolve({
        URL: 'MOCK_URL',
        trustedHosts: []
      })
      expect(parapet).toHaveBeenLastCalledWith({
        bridge: '1AJsUZ7MsJGwmkCZSoDpro28R52ptvGma7',
        request: {
          type: 'json-query',
          query: {
            v: 3,
            q: {
              collection: 'content',
              find: {
                hash: mockHash.toString('hex'),
                revoked: false,
                expiryTime: { $gte: expect.any(Number) }
              },
              limit: 10,
              skip: 0,
              project: {
                URL: 1,
                _id: 0
              }
            }
          }
        }
      })
    })
    it('Calls parapet a second time when trusted hosts fail', async () => {
      parapet.mockReturnValue([])
      await resolve({ URL: 'MOCK_URL' })
      expect(parapet.mock.calls).toEqual([
        // first call, with trusted hosts
        [{
          bridge: '1AJsUZ7MsJGwmkCZSoDpro28R52ptvGma7',
          request: {
            type: 'json-query',
            query: {
              v: 3,
              q: {
                collection: 'content',
                find: {
                  hash: mockHash.toString('hex'),
                  revoked: false,
                  expiryTime: { $gte: expect.any(Number) },
                  host: { $in: ['15RLMCYZ738Y3cBb56yDSWa7TkAFxSQtyf'] }
                },
                limit: 10,
                skip: 0,
                project: {
                  URL: 1,
                  _id: 0
                }
              }
            }
          }
        }],
        // Second call, no hosts
        [{
          bridge: '1AJsUZ7MsJGwmkCZSoDpro28R52ptvGma7',
          request: {
            type: 'json-query',
            query: {
              v: 3,
              q: {
                collection: 'content',
                find: {
                  hash: mockHash.toString('hex'),
                  revoked: false,
                  expiryTime: { $gte: expect.any(Number) }
                },
                limit: 10,
                skip: 0,
                project: {
                  URL: 1,
                  _id: 0
                }
              }
            }
          }
        }]
      ])
    })
    it('Returns the URLs from parapet', async () => {
      const result = await resolve({ URL: 'MOCK_URL' })
      expect(result).toEqual(['MOCK_HTTP_URL_1', 'MOCK_HTTP_URL_2'])
    })
  })
  describe('download', () => {
    it('Calls getHashFromURL with the URL', async () => {
      await download({ URL: 'MOCK_URL' })
      expect(getHashFromURL).toHaveBeenLastCalledWith('MOCK_URL')
    })
    it('Calls fetch with the HTTP URL', async () => {
      await download({ URL: 'MOCK_URL' })
      expect(fetch).toHaveBeenLastCalledWith(
        'MOCK_HTTP_URL_1',
        { method: 'GET' }
      )
    })
    it('Continues to the second URL if the first request fails', async () => {
      fetch.mockReturnValueOnce({
        status: 404
      })
      await download({ URL: 'MOCK_URL' })
      expect(fetch.mock.calls).toEqual([
        [
          'MOCK_HTTP_URL_1',
          { method: 'GET' }
        ],
        [
          'MOCK_HTTP_URL_2',
          { method: 'GET' }
        ]
      ])
    })
    it('Continues to the second URL if the hash is invalid', async () => {
      fetch.mockReturnValueOnce({
        status: 200,
        blob: () => ({
          arrayBuffer: () => new Uint8Array([1, 2, 4])
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      await download({ URL: 'MOCK_URL' })
      expect(fetch.mock.calls).toEqual([
        [
          'MOCK_HTTP_URL_1',
          { method: 'GET' }
        ],
        [
          'MOCK_HTTP_URL_2',
          { method: 'GET' }
        ]
      ])
    })
    it('Returns the data and MIME type', async () => {
      const returnValue = await download({ URL: 'MOCK_URL' })
      expect(returnValue).toEqual({
        data: Buffer.from([1, 2, 3]),
        mimeType: 'application/json'
      })
    })
  })
})
