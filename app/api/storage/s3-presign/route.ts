/**
 * app/api/storage/s3-presign/route.ts
 * Server-side pre-signed S3 PUT URL generator.
 *
 * Uses AWS Signature Version 4 implemented via the Web Crypto API
 * (crypto.subtle) — no AWS SDK required.
 *
 * POST body : { fileName: string; contentType: string; folder?: string }
 * Response  : { uploadUrl: string; key: string; publicUrl: string }
 *
 * Environment variables required:
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION
 *   AWS_S3_BUCKET
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Helpers: AWS SigV4 via Web Crypto ────────────────────────────────────────

/**
 * HMAC-SHA256 using the SubtleCrypto API.
 * @param key  - raw key bytes (ArrayBuffer or Uint8Array) OR a string
 * @param data - message string
 */
async function hmacSHA256(
  key: ArrayBuffer | Uint8Array | string,
  data: string,
): Promise<ArrayBuffer> {
  // Import the key material
  const keyData =
    typeof key === 'string'
      ? new TextEncoder().encode(key)
      : key;

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

/** Convert an ArrayBuffer to a lowercase hex string. */
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** SHA-256 hash of a string, returned as hex. */
async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str),
  );
  return toHex(buf);
}

/**
 * Derive the AWS SigV4 signing key:
 *   kDate    = HMAC("AWS4" + secretKey, date)
 *   kRegion  = HMAC(kDate, region)
 *   kService = HMAC(kRegion, service)
 *   kSigning = HMAC(kService, "aws4_request")
 */
async function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate    = await hmacSHA256('AWS4' + secretKey, dateStamp);
  const kRegion  = await hmacSHA256(kDate,              region);
  const kService = await hmacSHA256(kRegion,            service);
  const kSigning = await hmacSHA256(kService,           'aws4_request');
  return kSigning;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Validate environment variables ─────────────────────────────────────
  const accessKeyId     = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region          = process.env.AWS_REGION;
  const bucket          = process.env.AWS_S3_BUCKET;

  if (!accessKeyId || !secretAccessKey || !region || !bucket) {
    return NextResponse.json(
      { error: 'S3 not configured' },
      { status: 503 },
    );
  }

  // ── 2. Parse the request body ─────────────────────────────────────────────
  const body = (await request.json()) as {
    fileName?: string;
    contentType?: string;
    folder?: string;
  };

  const { fileName, contentType, folder } = body;

  if (!fileName || !contentType) {
    return NextResponse.json(
      { error: 'fileName and contentType are required' },
      { status: 400 },
    );
  }

  // ── 3. Build the S3 object key ────────────────────────────────────────────
  // Sanitise the filename (strip path separators, keep extension)
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const key = folder
    ? `${folder.replace(/\/$/, '')}/${uniquePrefix}-${safeName}`
    : `uploads/${uniquePrefix}-${safeName}`;

  // ── 4. Prepare date/time strings for SigV4 ───────────────────────────────
  const now = new Date();
  // amzDate: YYYYMMDD'T'HHmmss'Z'
  const amzDate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d+Z$/, 'Z');
  // dateStamp: YYYYMMDD
  const dateStamp = amzDate.slice(0, 8);

  const expiresSeconds = 300; // pre-signed URL valid for 5 minutes
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;

  // ── 5. Build the query-string for the pre-signed URL (SigV4 query params) ─
  // Required canonical query-string parameters (sorted lexicographically):
  //   X-Amz-Algorithm, X-Amz-Credential, X-Amz-Date, X-Amz-Expires,
  //   X-Amz-SignedHeaders
  const signedHeaders = 'content-type;host';
  const host = `${bucket}.s3.${region}.amazonaws.com`;

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm':     'AWS4-HMAC-SHA256',
    'X-Amz-Credential':    credential,
    'X-Amz-Date':          amzDate,
    'X-Amz-Expires':       String(expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  });

  // URLSearchParams sorts by insertion order; we need them sorted by key name
  const sortedQuery = Array.from(queryParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // ── 6. Canonical request ──────────────────────────────────────────────────
  // For pre-signed URLs the payload hash is the literal string "UNSIGNED-PAYLOAD"
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalUri = `/${key}`;
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n`;

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    sortedQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // ── 7. String to sign ─────────────────────────────────────────────────────
  const canonicalRequestHash = await sha256Hex(canonicalRequest);

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  // ── 8. Derive signing key and compute the signature ───────────────────────
  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
  const signatureBuf = await hmacSHA256(signingKey, stringToSign);
  const signature = toHex(signatureBuf);

  // ── 9. Assemble the final pre-signed URL ──────────────────────────────────
  const uploadUrl =
    `https://${host}/${key}` +
    `?${sortedQuery}` +
    `&X-Amz-Signature=${signature}`;

  // Public URL (assumes public-read or CloudFront distribution)
  const publicUrl = `https://${host}/${key}`;

  return NextResponse.json({ uploadUrl, key, publicUrl });
}
