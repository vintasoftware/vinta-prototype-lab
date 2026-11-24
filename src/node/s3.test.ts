import { describe, expect, it, vi } from 'vitest'
import {
  encodePath,
  objectLocation,
  publicObjectUrl,
  putObject,
  S3Error,
  type S3Target,
  sha256Hex,
  signRequest,
} from './s3'

// The worked examples in AWS's "Signature Calculations for the Authorization Header" for S3.
const EXAMPLE_CREDENTIALS = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
}
const EXAMPLE_DATE = new Date('2013-05-24T00:00:00Z')

const target: S3Target = {
  bucket: 'team-shares',
  region: 'us-east-1',
  forcePathStyle: false,
  credentials: EXAMPLE_CREDENTIALS,
}

describe('signRequest', () => {
  it('signs AWS’s GET example', () => {
    const headers = signRequest({
      method: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      headers: { Range: 'bytes=0-9' },
      payloadHash: sha256Hex(''),
      region: 'us-east-1',
      credentials: EXAMPLE_CREDENTIALS,
      date: EXAMPLE_DATE,
    })
    expect(headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41'
    )
  })

  it('signs AWS’s PUT example, whose key needs encoding', () => {
    const headers = signRequest({
      method: 'PUT',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test$file.text',
      headers: { Date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
      payloadHash: sha256Hex('Welcome to Amazon S3.'),
      region: 'us-east-1',
      credentials: EXAMPLE_CREDENTIALS,
      date: EXAMPLE_DATE,
    })
    expect(headers.authorization).toContain(
      'SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class, Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd'
    )
  })

  it('signs a session token when there is one', () => {
    const headers = signRequest({
      method: 'PUT',
      host: 'h',
      path: '/k',
      headers: {},
      payloadHash: sha256Hex(''),
      region: 'us-east-1',
      credentials: { ...EXAMPLE_CREDENTIALS, sessionToken: 'token' },
      date: EXAMPLE_DATE,
    })
    expect(headers['x-amz-security-token']).toBe('token')
    expect(headers.authorization).toContain('x-amz-security-token')
  })
})

describe('object addresses', () => {
  it('encodes every segment but keeps the slashes', () => {
    expect(encodePath("/a b/it's(1).html")).toBe('/a%20b/it%27s%281%29.html')
  })

  it('puts the bucket in the host on AWS', () => {
    expect(objectLocation(target, 'shares/x/index.html')).toEqual({
      origin: 'https://team-shares.s3.us-east-1.amazonaws.com',
      host: 'team-shares.s3.us-east-1.amazonaws.com',
      path: '/shares/x/index.html',
    })
  })

  it('puts the bucket in the path when asked, on a custom endpoint', () => {
    const minio = { ...target, endpoint: 'http://localhost:9000', forcePathStyle: true }
    expect(objectLocation(minio, 'k.html')).toEqual({
      origin: 'http://localhost:9000',
      host: 'localhost:9000',
      path: '/team-shares/k.html',
    })
    expect(publicObjectUrl(minio, 'k.html')).toBe('http://localhost:9000/team-shares/k.html')
  })

  it('reads from the public address when there is one', () => {
    expect(publicObjectUrl({ ...target, publicUrl: 'https://share.example.com/' }, 'a/b.html')).toBe(
      'https://share.example.com/a/b.html'
    )
  })
})

describe('putObject', () => {
  it('PUTs the body with signed headers and the ACL', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }))
    await putObject(
      { ...target, acl: 'public-read' },
      { key: 'a/index.html', body: new TextEncoder().encode('<p>hi</p>'), contentType: 'text/html; charset=utf-8' },
      { fetch: fetchMock as unknown as typeof fetch, now: EXAMPLE_DATE }
    )
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://team-shares.s3.us-east-1.amazonaws.com/a/index.html')
    expect(init.method).toBe('PUT')
    const headers = init.headers as Record<string, string>
    expect(headers.host).toBeUndefined()
    expect(headers['x-amz-acl']).toBe('public-read')
    expect(headers['content-type']).toBe('text/html; charset=utf-8')
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20130524\//)
  })

  it('throws the service’s code and message, and never the secret', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>', { status: 403 })
    )
    const upload = putObject(
      target,
      { key: 'k', body: new Uint8Array(), contentType: 'text/plain' },
      { fetch: fetchMock as unknown as typeof fetch }
    )
    await expect(upload).rejects.toBeInstanceOf(S3Error)
    await expect(upload).rejects.toThrow('The bucket answered 403 AccessDenied: Access Denied')
    await expect(upload).rejects.not.toThrow(EXAMPLE_CREDENTIALS.secretAccessKey)
  })
})
