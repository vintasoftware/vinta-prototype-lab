import { describe, expect, it, vi } from 'vitest'
import {
  type ResolvedShare,
  resolveShare,
  SHARE_ENV,
  type ShareRequest,
  shareRequestSchema,
  uploadShare,
} from './share-uploader'

const KEYS = { [SHARE_ENV.accessKeyId]: 'AKIDEXAMPLE', [SHARE_ENV.secretAccessKey]: 'secret' }

describe('resolveShare', () => {
  it('names what is missing', () => {
    expect(resolveShare(undefined, {})).toEqual({
      ready: false,
      missing: [SHARE_ENV.bucket, SHARE_ENV.accessKeyId, SHARE_ENV.secretAccessKey],
    })
    expect(resolveShare({ bucket: 'b' }, {})).toEqual({
      ready: false,
      missing: [SHARE_ENV.accessKeyId, SHARE_ENV.secretAccessKey],
    })
  })

  it('takes the bucket from the config and the keys from the environment, with AWS defaults', () => {
    const setup = resolveShare({ bucket: 'team' }, KEYS)
    expect(setup).toEqual({
      ready: true,
      share: {
        prefix: 'prototype-lab',
        target: {
          bucket: 'team',
          region: 'us-east-1',
          forcePathStyle: false,
          credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret' },
        },
      },
    })
  })

  it('lets the environment win, and addresses a custom endpoint by path', () => {
    const setup = resolveShare(
      { bucket: 'from-config', region: 'eu-west-1' },
      {
        ...KEYS,
        [SHARE_ENV.bucket]: 'from-env',
        [SHARE_ENV.endpoint]: 'https://acct.r2.cloudflarestorage.com',
        [SHARE_ENV.region]: 'auto',
        [SHARE_ENV.publicUrl]: 'https://shares.example.com',
        [SHARE_ENV.prefix]: '/designs/',
        [SHARE_ENV.acl]: 'public-read',
      }
    )
    expect(setup.ready && setup.share).toMatchObject({
      prefix: 'designs',
      target: {
        bucket: 'from-env',
        region: 'auto',
        endpoint: 'https://acct.r2.cloudflarestorage.com',
        forcePathStyle: true,
        publicUrl: 'https://shares.example.com',
        acl: 'public-read',
      },
    })
  })

  it('falls back to the standard AWS variables', () => {
    const setup = resolveShare(
      { bucket: 'b' },
      { AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 's', AWS_SESSION_TOKEN: 't', AWS_REGION: 'sa-east-1' }
    )
    expect(setup.ready && setup.share.target).toMatchObject({
      region: 'sa-east-1',
      credentials: { accessKeyId: 'a', secretAccessKey: 's', sessionToken: 't' },
    })
  })

  it('reports an endpoint that is not an address', () => {
    const setup = resolveShare({ bucket: 'b', endpoint: 'not a url' }, KEYS)
    expect(setup).toMatchObject({ ready: false, problem: expect.stringContaining(SHARE_ENV.endpoint) })
  })
})

const share: ResolvedShare = {
  prefix: 'prototype-lab',
  target: {
    bucket: 'team',
    region: 'us-east-1',
    forcePathStyle: false,
    publicUrl: 'https://shares.example.com',
    credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret' },
  },
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString('base64')

const request: ShareRequest = {
  slug: 'billing/refunds',
  page: {
    kind: 'screen',
    title: 'Refunds · Choose lines',
    description: 'A screen.',
    prototypeTitle: 'Refunds',
    subject: 'Choose lines',
    stage: '<p>screen</p>',
    stageSize: { width: 390, height: 844 },
    doc: '',
    comments: '',
    commentCount: 0,
    css: '',
    sharedAt: '2026-11-24T00:00:00.000Z',
  },
  image: { data: PNG, width: 1200, height: 630 },
}

describe('shareRequestSchema', () => {
  it('takes an http link back to the viewer, and nothing else', () => {
    const withLink = (sourceUrl: string) => ({ ...request, page: { ...request.page, sourceUrl } })
    expect(shareRequestSchema.safeParse(withLink('http://localhost:6007/#/p/a')).success).toBe(true)
    expect(shareRequestSchema.safeParse(withLink('javascript:alert(1)')).success).toBe(false)
  })
})

describe('uploadShare', () => {
  it('uploads the preview, then the page that points at it, into a folder of its own', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response('', { status: 200 }))
    const result = await uploadShare(share, request, { fetch: fetchMock as unknown as typeof fetch, id: 'abc' })

    expect(result).toEqual({
      status: 200,
      body: { url: 'https://shares.example.com/prototype-lab/billing-refunds/abc/index.html' },
    })
    const [image, page] = fetchMock.mock.calls as [string, RequestInit][]
    if (image === undefined || page === undefined) {
      throw new Error('Expected two uploads.')
    }
    expect(image[0]).toBe('https://team.s3.us-east-1.amazonaws.com/prototype-lab/billing-refunds/abc/preview.png')
    expect((image[1].headers as Record<string, string>)['content-type']).toBe('image/png')
    expect(page[0]).toBe('https://team.s3.us-east-1.amazonaws.com/prototype-lab/billing-refunds/abc/index.html')
    const html = new TextDecoder().decode(page[1].body as Uint8Array)
    expect(html).toContain(
      '<meta property="og:image" content="https://shares.example.com/prototype-lab/billing-refunds/abc/preview.png" />'
    )
    expect(html).toContain(
      '<meta property="og:url" content="https://shares.example.com/prototype-lab/billing-refunds/abc/index.html" />'
    )
  })

  it('refuses an image that is not a PNG, and uploads nothing', async () => {
    const fetchMock = vi.fn()
    const result = await uploadShare(
      share,
      { ...request, image: { data: Buffer.from('<svg/>').toString('base64'), width: 1, height: 1 } },
      { fetch: fetchMock as unknown as typeof fetch }
    )
    expect(result.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('gives every share an id of its own', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }))
    const { image: _image, ...withoutImage } = request
    const first = await uploadShare(share, withoutImage, { fetch: fetchMock as unknown as typeof fetch })
    const second = await uploadShare(share, withoutImage, { fetch: fetchMock as unknown as typeof fetch })
    expect(first.body).not.toEqual(second.body)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
