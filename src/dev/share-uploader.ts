import { randomBytes } from 'node:crypto'
import { type Connect, loadEnv, type Plugin } from 'vite'
import { z } from 'zod'
import { type SharePageParts, sharePageHtml } from '../lib/share-page'
import { SHARE_ENDPOINT } from '../lib/source-ref'
import { publicObjectUrl, putObject, type S3Target } from '../node/s3'
import { fromTheViewer, servedBy } from './annotations-writer'

/**
 * Where shared views are uploaded. Everything here can also come from the environment (see
 * `SHARE_ENV`), which wins; the keys themselves come only from the environment, so they are never
 * written into a config file that is committed.
 */
export interface ShareOptions {
  bucket?: string
  /** Defaults to `us-east-1`. Cloudflare R2 takes `auto`. */
  region?: string
  /** An S3-compatible service's address, e.g. `https://<account>.r2.cloudflarestorage.com`. Leave out for AWS. */
  endpoint?: string
  /** The address the public reads shares from, when it is not the bucket's own, e.g. a CDN or an R2 public domain. */
  publicUrl?: string
  /** The folder in the bucket shares go in. Defaults to `prototype-lab`. */
  prefix?: string
  /** Address the bucket in the path. Defaults to on with a custom `endpoint`, off for AWS. */
  forcePathStyle?: boolean
  /** A canned ACL for each object, e.g. `public-read`. Leave out when a bucket policy makes the prefix public. */
  acl?: string
}

/** The environment variables sharing reads. `.env.local` is a good home for them: Vite loads it, and git ignores it. */
export const SHARE_ENV = {
  bucket: 'PROTOTYPE_LAB_S3_BUCKET',
  region: 'PROTOTYPE_LAB_S3_REGION',
  endpoint: 'PROTOTYPE_LAB_S3_ENDPOINT',
  publicUrl: 'PROTOTYPE_LAB_S3_PUBLIC_URL',
  prefix: 'PROTOTYPE_LAB_S3_PREFIX',
  forcePathStyle: 'PROTOTYPE_LAB_S3_FORCE_PATH_STYLE',
  acl: 'PROTOTYPE_LAB_S3_ACL',
  accessKeyId: 'PROTOTYPE_LAB_S3_ACCESS_KEY_ID',
  secretAccessKey: 'PROTOTYPE_LAB_S3_SECRET_ACCESS_KEY',
  sessionToken: 'PROTOTYPE_LAB_S3_SESSION_TOKEN',
} as const

const ENV_PREFIX = 'PROTOTYPE_LAB_S3_'

export interface ResolvedShare {
  target: S3Target
  prefix: string
}

export type ShareSetup = { ready: true; share: ResolvedShare } | { ready: false; missing: string[]; problem?: string }

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

function httpUrl(value: string | undefined, name: string): string | undefined {
  if (value === undefined) {
    return undefined
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be an http(s) address, got "${value}".`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${name} must be an http(s) address, got "${value}".`)
  }
  return value
}

/**
 * Puts the options and the environment together. Sharing is ready once a bucket and a key pair are
 * known; anything short of that reads as what is missing, so the viewer can say so.
 *
 * The key pair falls back to the standard `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
 */
export function resolveShare(options: ShareOptions | undefined, env: Record<string, string | undefined>): ShareSetup {
  const bucket = nonEmpty(env[SHARE_ENV.bucket]) ?? nonEmpty(options?.bucket)
  const accessKeyId = nonEmpty(env[SHARE_ENV.accessKeyId]) ?? nonEmpty(env.AWS_ACCESS_KEY_ID)
  const secretAccessKey = nonEmpty(env[SHARE_ENV.secretAccessKey]) ?? nonEmpty(env.AWS_SECRET_ACCESS_KEY)
  const sessionToken =
    nonEmpty(env[SHARE_ENV.sessionToken]) ??
    (nonEmpty(env[SHARE_ENV.accessKeyId]) === undefined ? nonEmpty(env.AWS_SESSION_TOKEN) : undefined)

  const missing = [
    ...(bucket === undefined ? [SHARE_ENV.bucket] : []),
    ...(accessKeyId === undefined ? [SHARE_ENV.accessKeyId] : []),
    ...(secretAccessKey === undefined ? [SHARE_ENV.secretAccessKey] : []),
  ]
  if (bucket === undefined || accessKeyId === undefined || secretAccessKey === undefined) {
    return { ready: false, missing }
  }

  try {
    const endpoint = httpUrl(nonEmpty(env[SHARE_ENV.endpoint]) ?? nonEmpty(options?.endpoint), SHARE_ENV.endpoint)
    const publicUrl = httpUrl(nonEmpty(env[SHARE_ENV.publicUrl]) ?? nonEmpty(options?.publicUrl), SHARE_ENV.publicUrl)
    const pathStyleEnv = nonEmpty(env[SHARE_ENV.forcePathStyle])
    const forcePathStyle =
      pathStyleEnv !== undefined ? pathStyleEnv === 'true' : (options?.forcePathStyle ?? endpoint !== undefined)
    const acl = nonEmpty(env[SHARE_ENV.acl]) ?? nonEmpty(options?.acl)
    const region =
      nonEmpty(env[SHARE_ENV.region]) ??
      nonEmpty(options?.region) ??
      nonEmpty(env.AWS_REGION) ??
      nonEmpty(env.AWS_DEFAULT_REGION) ??
      'us-east-1'
    const prefix = (nonEmpty(env[SHARE_ENV.prefix]) ?? nonEmpty(options?.prefix) ?? 'prototype-lab').replace(
      /^\/+|\/+$/g,
      ''
    )

    return {
      ready: true,
      share: {
        prefix,
        target: {
          bucket,
          region,
          forcePathStyle,
          ...(endpoint === undefined ? {} : { endpoint }),
          ...(publicUrl === undefined ? {} : { publicUrl }),
          ...(acl === undefined ? {} : { acl }),
          credentials: { accessKeyId, secretAccessKey, ...(sessionToken === undefined ? {} : { sessionToken }) },
        },
      },
    }
  } catch (thrown) {
    return { ready: false, missing: [], problem: thrown instanceof Error ? thrown.message : String(thrown) }
  }
}

/** The largest request the endpoint reads: a canvas of many screens, its styles and its preview. */
export const MAX_SHARE_BYTES = 64 * 1024 * 1024

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export const shareRequestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/),
  page: z.object({
    kind: z.enum(['screen', 'canvas']),
    title: z.string().min(1).max(300),
    description: z.string().max(2000),
    prototypeTitle: z.string().max(300),
    subject: z.string().max(300),
    component: z.string().max(300).optional(),
    sourceUrl: z
      .string()
      .max(2000)
      .url()
      .refine(url => /^https?:\/\//i.test(url))
      .optional(),
    stage: z.string(),
    stageSize: z.object({ width: z.number().positive().finite(), height: z.number().positive().finite() }),
    doc: z.string(),
    comments: z.string(),
    commentCount: z.number().int().nonnegative(),
    css: z.string(),
    sharedAt: z.string(),
  }),
  image: z
    .object({
      /** Base64 PNG, without the `data:` prefix. */
      data: z.string().min(1),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
})

export type ShareRequest = z.infer<typeof shareRequestSchema>

export interface ShareResult {
  status: number
  body: { url: string } | { error: string }
}

/** An id no one can guess, so a share is found only by those given its link. */
export function shareId(): string {
  return randomBytes(12).toString('base64url')
}

/**
 * Uploads one share: its preview image first, then the page that points at it. Each share gets a
 * folder of its own under the prefix, so nothing is ever overwritten.
 */
export async function uploadShare(
  share: ResolvedShare,
  request: ShareRequest,
  options: { fetch?: typeof fetch; id?: string } = {}
): Promise<ShareResult> {
  const id = options.id ?? shareId()
  const folder = `${share.prefix === '' ? '' : `${share.prefix}/`}${request.slug.replaceAll('/', '-')}/${id}`
  const pageKey = `${folder}/index.html`
  const imageKey = `${folder}/preview.png`
  const cacheControl = 'public, max-age=31536000, immutable'
  const put = { ...(options.fetch === undefined ? {} : { fetch: options.fetch }) }

  let image: { url: string; width: number; height: number } | undefined
  if (request.image !== undefined) {
    const bytes = Buffer.from(request.image.data, 'base64')
    if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
      return { status: 400, body: { error: 'The preview image is not a PNG.' } }
    }
    await putObject(share.target, { key: imageKey, body: bytes, contentType: 'image/png', cacheControl }, put)
    image = { url: publicObjectUrl(share.target, imageKey), width: request.image.width, height: request.image.height }
  }

  const url = publicObjectUrl(share.target, pageKey)
  const page = request.page as SharePageParts
  const html = sharePageHtml(page, { url, ...(image === undefined ? {} : { image }) })
  await putObject(
    share.target,
    { key: pageKey, body: new TextEncoder().encode(html), contentType: 'text/html; charset=utf-8', cacheControl },
    put
  )
  return { status: 200, body: { url } }
}

async function readLimitedBody(request: Connect.IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    size += (chunk as Buffer).length
    if (size > limit) {
      throw new RangeError('too large')
    }
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** What the viewer is told about sharing: whether it can upload, and if not, what to set. */
export interface ShareStatus {
  upload: boolean
  missing?: string[]
  problem?: string
}

export function shareStatus(setup: ShareSetup): ShareStatus {
  return setup.ready
    ? { upload: true }
    : { upload: false, missing: setup.missing, ...(setup.problem === undefined ? {} : { problem: setup.problem }) }
}

/**
 * Uploads shared views to the team's bucket while `vite dev` runs. The keys stay on this machine:
 * the viewer sends the page, this server signs and sends it on, and only the public link goes back.
 *
 * `onSetup` hears what the configuration came to, so the viewer's entry can say whether to offer
 * the upload.
 */
export function shareUploader(options: {
  share: ShareOptions | false | undefined
  onSetup: (setup: ShareSetup) => void
}): Plugin {
  let setup: ShareSetup = { ready: false, missing: [] }

  return {
    name: 'prototype-lab:share-uploader',
    apply: 'serve',
    configResolved(config) {
      if (options.share === false) {
        setup = { ready: false, missing: [], problem: 'Sharing is turned off in the config.' }
      } else {
        // Only the PROTOTYPE_LAB_S3_ and AWS_ variables are read, and none of them reach the page:
        // Vite hands the page only those starting with `envPrefix`, `VITE_` by default.
        const env = { ...process.env, ...loadEnv(config.mode, config.envDir || config.root, [ENV_PREFIX, 'AWS_']) }
        setup = resolveShare(options.share, env)
      }
      options.onSetup(setup)
      if (!setup.ready && setup.problem !== undefined && options.share !== false) {
        config.logger.warn(`prototype-lab: sharing is off: ${setup.problem}`)
      }
    },
    configureServer(server) {
      server.middlewares.use(SHARE_ENDPOINT, (request, response, next) => {
        if (request.method !== 'POST') {
          next()
          return
        }
        const send = (status: number, body: unknown) => {
          response.statusCode = status
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(body))
        }

        void (async () => {
          if (!fromTheViewer(request.headers, servedBy(server))) {
            send(403, { error: 'Only the viewer this dev server is serving may share.' })
            return
          }
          if (!setup.ready) {
            send(409, {
              error:
                setup.problem ??
                `Uploading needs ${setup.missing.join(', ')}. Set them in .env.local and restart the dev server.`,
            })
            return
          }

          let payload: ReturnType<typeof shareRequestSchema.safeParse>
          try {
            payload = shareRequestSchema.safeParse(await readLimitedBody(request, MAX_SHARE_BYTES))
          } catch (thrown) {
            send(thrown instanceof RangeError ? 413 : 400, {
              error:
                thrown instanceof RangeError
                  ? 'The view is too large to share. Try a screen rather than the whole canvas.'
                  : 'That request is not one this endpoint takes.',
            })
            return
          }
          if (!payload.success) {
            send(400, { error: 'That request is not one this endpoint takes.' })
            return
          }

          try {
            const { status, body } = await uploadShare(setup.share, payload.data)
            if ('url' in body) {
              server.config.logger.info(`prototype-lab: shared ${payload.data.slug} → ${body.url}`)
            }
            send(status, body)
          } catch (thrown) {
            // S3 errors carry the service's code and message only; nothing here holds the keys.
            const detail = thrown instanceof Error ? thrown.message : String(thrown)
            server.config.logger.error(`${SHARE_ENDPOINT}: ${detail}`)
            send(502, { error: `The upload failed. ${detail}` })
          }
        })()
      })
    },
  }
}
