import { createHash, createHmac } from 'node:crypto'

/**
 * A small S3 client: enough to PUT an object into a bucket on AWS or on any service that speaks the
 * S3 API (Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2…). It signs with AWS Signature
 * Version 4 itself, so the package does not pull in the AWS SDK for one request.
 */

export interface S3Credentials {
  accessKeyId: string
  secretAccessKey: string
  /** Set for temporary credentials, such as those from `aws sso login`. */
  sessionToken?: string
}

/** Where shares are written, and where the public reads them from. */
export interface S3Target {
  bucket: string
  region: string
  /** An S3-compatible service's address. Left out for AWS itself. */
  endpoint?: string
  /** `https://host/bucket/key` rather than `https://bucket.host/key`. */
  forcePathStyle: boolean
  /** The address objects are read from by the public, when it is not the bucket's own. */
  publicUrl?: string
  /** A canned ACL sent with each object, e.g. `public-read`. Left out for buckets that use a policy instead. */
  acl?: string
  credentials: S3Credentials
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

/** Encodes a path the way SigV4 wants it: every byte but the unreserved ones, keeping the `/`s. */
export function encodePath(path: string): string {
  return path
    .split('/')
    .map(segment =>
      encodeURIComponent(segment).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    )
    .join('/')
}

/** `20130524T000000Z`. */
export function amzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

export interface SignInput {
  method: string
  host: string
  /** The path as it reads, not yet encoded: `/bucket/a b.html`. */
  path: string
  /** Headers to sign besides the ones SigV4 adds. Names in any case. */
  headers: Record<string, string>
  /** Hex SHA-256 of the body. */
  payloadHash: string
  region: string
  credentials: S3Credentials
  date: Date
  service?: string
}

/**
 * Signs a request with AWS Signature Version 4 and returns every header it must carry, the
 * `authorization` one included. Names come back in lower case.
 */
export function signRequest(input: SignInput): Record<string, string> {
  const { credentials, region, payloadHash } = input
  const service = input.service ?? 's3'
  const stamp = amzDate(input.date)
  const day = stamp.slice(0, 8)

  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(input.headers)) {
    headers[name.toLowerCase()] = value
  }
  headers.host = input.host
  headers['x-amz-date'] = stamp
  headers['x-amz-content-sha256'] = payloadHash
  if (credentials.sessionToken !== undefined) {
    headers['x-amz-security-token'] = credentials.sessionToken
  }

  const names = Object.keys(headers).sort()
  const canonicalHeaders = names.map(name => `${name}:${(headers[name] ?? '').trim().replace(/\s+/g, ' ')}\n`).join('')
  const signedHeaders = names.join(';')
  const canonicalRequest = [
    input.method,
    encodePath(input.path),
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const scope = `${day}/${region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256Hex(canonicalRequest)].join('\n')
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, day), region), service), 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

function trimSlashes(text: string): string {
  return text.replace(/^\/+|\/+$/g, '')
}

/** The address a PUT for `key` goes to: its host and its path, not yet encoded. */
export function objectLocation(target: S3Target, key: string): { origin: string; host: string; path: string } {
  const endpoint = new URL(target.endpoint ?? `https://s3.${target.region}.amazonaws.com`)
  const basePath = trimSlashes(endpoint.pathname)
  const prefix = basePath === '' ? '' : `/${basePath}`

  if (target.forcePathStyle) {
    return { origin: endpoint.origin, host: endpoint.host, path: `${prefix}/${target.bucket}/${key}` }
  }
  const host = `${target.bucket}.${endpoint.host}`
  return { origin: `${endpoint.protocol}//${host}`, host, path: `${prefix}/${key}` }
}

/** The address the public opens `key` at: under `publicUrl` when there is one, else the bucket's own. */
export function publicObjectUrl(target: S3Target, key: string): string {
  if (target.publicUrl !== undefined) {
    return `${target.publicUrl.replace(/\/+$/, '')}/${encodePath(key)}`
  }
  const { origin, path } = objectLocation(target, key)
  return `${origin}${encodePath(path)}`
}

/** An error the storage service answered with. Its message names the service's own code, not the credentials. */
export class S3Error extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(status: number, code: string | undefined, message: string) {
    super(message)
    this.name = 'S3Error'
    this.status = status
    this.code = code
  }
}

function xmlField(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1]
}

export interface PutObjectInput {
  key: string
  body: Uint8Array
  contentType: string
  cacheControl?: string
}

/** Writes one object. Resolves once the service has it, and throws an `S3Error` if it refuses. */
export async function putObject(
  target: S3Target,
  object: PutObjectInput,
  options: { fetch?: typeof fetch; now?: Date } = {}
): Promise<void> {
  const { origin, host, path } = objectLocation(target, object.key)
  const signed = signRequest({
    method: 'PUT',
    host,
    path,
    headers: {
      'content-type': object.contentType,
      ...(object.cacheControl === undefined ? {} : { 'cache-control': object.cacheControl }),
      ...(target.acl === undefined ? {} : { 'x-amz-acl': target.acl }),
    },
    payloadHash: sha256Hex(object.body),
    region: target.region,
    credentials: target.credentials,
    date: options.now ?? new Date(),
  })
  // fetch sets the host itself, from the URL, which is the one signed.
  const { host: _host, ...headers } = signed

  const response = await (options.fetch ?? fetch)(`${origin}${encodePath(path)}`, {
    method: 'PUT',
    headers,
    body: object.body as Uint8Array<ArrayBuffer>,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const code = xmlField(text, 'Code')
    const message = xmlField(text, 'Message')
    throw new S3Error(
      response.status,
      code,
      `The bucket answered ${response.status}${code === undefined ? '' : ` ${code}`}${message === undefined ? '' : `: ${message}`}`
    )
  }
}
