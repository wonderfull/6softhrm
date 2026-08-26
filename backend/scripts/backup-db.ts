import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import dotenv from 'dotenv'
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'

dotenv.config({ path: path.join(__dirname, '../.env') })

// Nightly database backup: mysqldump → gzip → local backups/ (always) and
// R2 under backups/ (when R2 env is configured). Prunes both to 30 days.
// Run via PM2 (see ecosystem.config.js) or cron.

const RETENTION_DAYS = 30

function parseDbUrl(url: string) {
  const u = new URL(url)
  return {
    host: u.hostname,
    port: u.port || '3306',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL not set')
  const db = parseDbUrl(dbUrl)

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const backupsDir = path.join(__dirname, '../backups')
  fs.mkdirSync(backupsDir, { recursive: true })
  const filename = `onsidehr-${db.database}-${stamp}.sql.gz`
  const outPath = path.join(backupsDir, filename)

  console.log(`[BACKUP] dumping ${db.database}…`)
  const started = Date.now()
  // --single-transaction: consistent InnoDB snapshot without locking writers.
  const dump = execSync(
    `mysqldump --single-transaction --set-gtid-purged=OFF --routines --triggers -h ${db.host} -P ${db.port} -u ${db.user} ${db.database}`,
    { env: { ...process.env, MYSQL_PWD: db.password }, maxBuffer: 1024 * 1024 * 512 },
  )
  fs.writeFileSync(outPath, zlib.gzipSync(dump))
  console.log(`[BACKUP] wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB) in ${Date.now() - started}ms`)

  // prune local
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  for (const f of fs.readdirSync(backupsDir)) {
    const p = path.join(backupsDir, f)
    if (fs.statSync(p).mtimeMs < cutoff) {
      fs.rmSync(p)
      console.log(`[BACKUP] pruned local ${f}`)
    }
  }

  // R2 offsite copy
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    })
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `backups/${filename}`,
      Body: fs.readFileSync(outPath),
      ContentType: 'application/gzip',
    }))
    console.log(`[BACKUP] uploaded to r2://${R2_BUCKET}/backups/${filename}`)

    const listed = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: 'backups/' }))
    for (const obj of listed.Contents ?? []) {
      if (obj.LastModified && obj.LastModified.getTime() < cutoff && obj.Key) {
        await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: obj.Key }))
        console.log(`[BACKUP] pruned r2 ${obj.Key}`)
      }
    }
  } else {
    console.log('[BACKUP] R2 env not set — offsite copy skipped (local only)')
  }

  console.log('[BACKUP] done')
}

main().catch((e) => {
  console.error('[BACKUP] FAILED:', e.message)
  process.exit(1)
})
