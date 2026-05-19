// Object storage wrapper. S3-compatible — works with Hetzner Object Storage,
// Backblaze B2, Cloudflare R2, DigitalOcean Spaces. Uses the AWS SDK v3.
//
// Config via env vars (see .env.example):
//   OBJECT_STORAGE_ENDPOINT           e.g. https://nbg1.your-objectstorage.com
//   OBJECT_STORAGE_REGION             e.g. nbg1 (or "auto" for R2)
//   OBJECT_STORAGE_BUCKET             e.g. pak-tax-receipts
//   OBJECT_STORAGE_ACCESS_KEY_ID
//   OBJECT_STORAGE_SECRET_ACCESS_KEY
//   OBJECT_STORAGE_FORCE_PATH_STYLE   '1' for most non-AWS endpoints
//
// If any of the required vars is missing, `isConfigured()` returns false and
// callers should respond 503 rather than crash. This lets the rest of the
// backend keep working in dev environments without object-storage creds.

const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../utils/logger');

const REQUIRED_VARS = [
  'OBJECT_STORAGE_ENDPOINT',
  'OBJECT_STORAGE_REGION',
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_ACCESS_KEY_ID',
  'OBJECT_STORAGE_SECRET_ACCESS_KEY',
];

function isConfigured() {
  return REQUIRED_VARS.every((k) => !!process.env[k]);
}

let _client = null;
function client() {
  if (!_client) {
    if (!isConfigured()) {
      throw new Error('object_storage_not_configured');
    }
    _client = new S3Client({
      endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
      region: process.env.OBJECT_STORAGE_REGION,
      forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === '1',
      credentials: {
        accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

function bucket() {
  return process.env.OBJECT_STORAGE_BUCKET;
}

// Upload bytes. Returns the storage key on success. Throws on failure.
async function putObject({ key, body, contentType, metadata }) {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata || undefined,
    })
  );
  return key;
}

// Get a short-lived signed URL for downloading an object. Default 15 min.
async function getSignedDownloadUrl(key, ttlSeconds = 900) {
  const url = await getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: ttlSeconds }
  );
  return url;
}

// Verify an object exists. Used by tests and by GET /receipts/:id before
// issuing a signed URL — guards against database / storage divergence.
async function objectExists(key) {
  try {
    await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NotFound') return false;
    logger.warn('[objectStorage] HEAD failed', { key, message: err.message });
    throw err;
  }
}

// Reset cached client — used by tests when env vars change.
function _resetForTests() {
  _client = null;
}

module.exports = {
  isConfigured,
  putObject,
  getSignedDownloadUrl,
  objectExists,
  _resetForTests,
};
