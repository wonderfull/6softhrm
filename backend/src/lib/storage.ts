import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Readable } from 'stream'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner'
import { currentTenantId } from './tenantContext'

// Storage abstraction: route code never touches an SDK or the filesystem.
// Driver is picked by STORAGE_DRIVER (local | r2). The local driver is the
// dev/test default; R2 activates with:
//   STORAGE_DRIVER=r2
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
// Bucket must stay private; downloads go through 5-minute presigned URLs.

export interface StorageDriver {
  put(key: string, body: Buffer, contentType?: string): Promise<void>
  getStream(key: string): Promise<Readable>
  /** Presigned URL for direct download, or null when the caller must stream. */
  getSignedUrl(
    key: string,
    filename: string,
    disposition: 'inline' | 'attachment',
  ): Promise<string | null>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

const SIGNED_URL_TTL_SECONDS = 300

// ---------------------------------------------------------------------------

class LocalDriver implements StorageDriver {
  private root = path.join(process.cwd(), 'uploads')

  private absolute(key: string) {
    // Legacy records store "/uploads/<file>"; new keys are relative
    // ("tenants/<id>/documents/<file>"). Both resolve under uploads/.
    const cleaned = key.replace(/^\/?uploads\//, '').replace(/^\//, '')
    const abs = path.resolve(this.root, cleaned)
    if (!abs.startsWith(this.root + path.sep) && abs !== this.root) {
      throw new Error('Invalid storage key')
    }
    return abs
  }

  async put(key: string, body: Buffer) {
    const abs = this.absolute(key)
    await fs.promises.mkdir(path.dirname(abs), { recursive: true })
    await fs.promises.writeFile(abs, body)
  }

  async getStream(key: string) {
    return fs.createReadStream(this.absolute(key))
  }

  async getSignedUrl() {
    return null // local files are streamed through the API
  }

  async delete(key: string) {
    await fs.promises.rm(this.absolute(key), { force: true })
  }

  async exists(key: string) {
    return fs.existsSync(this.absolute(key))
  }
}

// ---------------------------------------------------------------------------

class R2Driver implements StorageDriver {
  private client: S3Client
  private bucket: string

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    this.bucket = process.env.R2_BUCKET || ''
    if (!accountId || !accessKeyId || !secretAccessKey || !this.bucket) {
      throw new Error(
        'STORAGE_DRIVER=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET',
      )
    }
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  }

  private normalise(key: string) {
    return key.replace(/^\//, '')
  }

  async put(key: string, body: Buffer, contentType?: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.normalise(key),
        Body: body,
        ContentType: contentType,
      }),
    )
  }

  async getStream(key: string) {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.normalise(key) }),
    )
    return res.Body as Readable
  }

  async getSignedUrl(key: string, filename: string, disposition: 'inline' | 'attachment') {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.normalise(key),
      ResponseContentDisposition: `${disposition}; filename="${filename.replace(/"/g, '')}"`,
    })
    return awsGetSignedUrl(this.client, command, { expiresIn: SIGNED_URL_TTL_SECONDS })
  }

  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.normalise(key) }),
    )
  }

  async exists(key: string) {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.normalise(key) }),
      )
      return true
    } catch {
      return false
    }
  }
}

// ---------------------------------------------------------------------------

let driver: StorageDriver | null = null

export function getStorage(): StorageDriver {
  if (!driver) {
    driver = process.env.STORAGE_DRIVER === 'r2' ? new R2Driver() : new LocalDriver()
  }
  return driver
}

/** Tenant-prefixed key for a new upload; the tenant comes from context. */
export function buildDocumentKey(originalName: string) {
  const safeName = path
    .basename(originalName)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(-80)
  return `tenants/${currentTenantId()}/documents/${crypto.randomUUID()}-${safeName}`
}

/**
 * Belt-and-braces alongside the DB scope: a stored key must belong to the
 * current tenant (or be a legacy pre-tenancy "/uploads/" path).
 */
export function assertKeyInTenant(key: string) {
  if (key.startsWith('/uploads/') || key.startsWith('uploads/')) return
  if (!key.startsWith(`tenants/${currentTenantId()}/`)) {
    throw new Error('STORAGE_KEY_TENANT_MISMATCH')
  }
}
