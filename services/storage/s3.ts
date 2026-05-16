/**
 * services/storage/s3.ts
 * S3 upload via pre-signed URL pattern.
 * No AWS SDK required — signing is handled server-side by /api/storage/s3-presign.
 * Spec ref: section 9.2 — S3 storage option
 */

export interface S3UploadResult {
  url: string;
  key: string;
}

interface PresignResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

/**
 * Upload a file to S3 via the internal presign API route.
 *
 * Flow:
 *  1. POST /api/storage/s3-presign  →  { uploadUrl, key, publicUrl }
 *  2. PUT  uploadUrl                (binary file, signed by the server)
 *  3. Return { url: publicUrl, key }
 */
export async function uploadToS3(
  file: File,
  bucket: string,
  region: string,
  folder?: string,
): Promise<S3UploadResult> {
  // ── Step 1: request a pre-signed PUT URL from the server ─────────────────
  const presignRes = await fetch('/api/storage/s3-presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      ...(folder ? { folder } : {}),
    }),
  });

  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => ({})) as { error?: string };
    throw new Error(
      body.error ?? `s3-presign returned HTTP ${presignRes.status}`,
    );
  }

  const { uploadUrl, key, publicUrl } = (await presignRes.json()) as PresignResponse;

  // ── Step 2: upload the raw binary directly to S3 ─────────────────────────
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error(`S3 PUT failed with status ${putRes.status}`);
  }

  // ── Step 3: return the public URL and object key ──────────────────────────
  return { url: publicUrl, key };
}
