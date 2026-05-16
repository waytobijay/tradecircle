/**
 * app/api/backup/cloud-upload/route.ts
 * Server-side endpoint — uploads a backup JSON to Firebase Storage via REST API.
 *
 * POST body: { backupId: string; data: object; scope: string }
 * Header:    Authorization: Bearer <firebase-id-token>  (optional — used to auth the upload)
 *
 * Since firebase-admin is not installed, we use the Firebase Storage REST API directly:
 *   https://firebasestorage.googleapis.com/v0/b/{bucket}/o
 *
 * On success:
 *   - Updates backups/{backupId} in Firestore with storagePath + fileSizeBytes
 *   - Returns { storagePath, downloadUrl }
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Config ───────────────────────────────────────────────────────────────────

const STORAGE_BUCKET  = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '';
const PROJECT_ID      = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '';

// ─── Helper: upload bytes to Firebase Storage REST API ────────────────────────

async function uploadToStorageRest(
  objectPath: string,
  jsonBytes: Buffer,
  idToken?: string,
): Promise<{ downloadUrl: string }> {
  if (!STORAGE_BUCKET) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set');

  // Encode the object path for use in the URL
  const encodedPath = encodeURIComponent(objectPath);
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?name=${encodedPath}&uploadType=media`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Content-Length': String(jsonBytes.length),
  };

  // If an ID token is provided, forward it for Firebase Storage security rules
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: jsonBytes,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error(`Storage upload failed (${uploadRes.status}): ${body}`);
  }

  const uploadJson = (await uploadRes.json()) as { name?: string; downloadTokens?: string };

  // Build a public download URL using the download token
  const token = uploadJson.downloadTokens ?? '';
  const downloadUrl = token
    ? `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media&token=${token}`
    : `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media`;

  return { downloadUrl };
}

// ─── Helper: update Firestore doc via REST API ─────────────────────────────────

async function patchFirestoreDoc(
  collection: string,
  docId: string,
  fields: Record<string, unknown>,
  idToken?: string,
): Promise<void> {
  if (!PROJECT_ID) return; // silently skip if project not configured

  // Build Firestore REST PATCH URL. We update only the specified fields.
  const fieldMask = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?${fieldMask}`;

  // Convert plain JS values to Firestore REST format
  function toFirestoreValue(v: unknown): Record<string, unknown> {
    if (typeof v === 'string')  return { stringValue: v };
    if (typeof v === 'number')  return { integerValue: String(Math.round(v)) };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (v === null)             return { nullValue: null };
    return { stringValue: String(v) };
  }

  const firestoreFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    firestoreFields[k] = toFirestoreValue(v);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  // Fall back to API key auth (works for rules that allow writes without user auth)
  else if (FIREBASE_API_KEY) {
    // API key is appended as query param in the URL
  }

  const patchUrl = FIREBASE_API_KEY && !idToken ? `${url}&key=${FIREBASE_API_KEY}` : url;

  try {
    await fetch(patchUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields: firestoreFields }),
    });
  } catch {
    // Non-fatal: Firestore patch failure should not block the upload response
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract optional auth token from Authorization header
    const authHeader = request.headers.get('authorization') ?? '';
    const idToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;

    // Parse request body
    type RequestBody = { backupId?: string; data?: object; scope?: string };
    const body = (await request.json()) as RequestBody;
    const { backupId, data, scope } = body;

    if (!backupId || typeof backupId !== 'string') {
      return NextResponse.json({ error: 'backupId is required' }, { status: 400 });
    }
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'data must be an object' }, { status: 400 });
    }
    if (!scope || typeof scope !== 'string') {
      return NextResponse.json({ error: 'scope is required' }, { status: 400 });
    }

    // Serialize backup data
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const objectPath = `backups/${scope}/${dateStr}-${backupId}.json`;
    const jsonStr = JSON.stringify(data, null, 2);
    const jsonBytes = Buffer.from(jsonStr, 'utf-8');

    // Upload to Firebase Storage
    const { downloadUrl } = await uploadToStorageRest(objectPath, jsonBytes, idToken);

    // Patch the Firestore backup document with storage metadata (best-effort)
    await patchFirestoreDoc('backups', backupId, {
      storagePath: objectPath,
      fileSizeBytes: jsonBytes.length,
    }, idToken);

    return NextResponse.json({
      storagePath: objectPath,
      downloadUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[cloud-upload] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
