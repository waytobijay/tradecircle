/**
 * services/storage/index.ts
 * Storage adapter router — routes file uploads to S3 or Cloudinary
 * based on which provider is currently enabled in siteConfig.
 * Spec ref: section 9.2 — Storage abstraction layer
 */

import type { CloudinaryConfig, S3Config } from '@/types';
import {
  uploadImage as uploadCloudinary,
  type CloudinaryUploadResult,
} from '@/services/cloudinary';
import { uploadToS3, type S3UploadResult } from '@/services/storage/s3';

export type { CloudinaryUploadResult, S3UploadResult };

export interface StorageResult {
  /** Public URL to the uploaded file. */
  url: string;
  /** Cloudinary public_id or S3 object key. */
  storageId: string;
  /** Which provider handled the upload. */
  provider: 'cloudinary' | 's3';
}

/**
 * Upload a file to whichever storage provider is currently active.
 *
 * Priority:
 *  1. S3           — if s3Config.enabled is true
 *  2. Cloudinary   — fallback
 *
 * Throws if neither provider is configured with the required credentials.
 */
export async function uploadFile(
  file: File,
  cloudinaryConfig: CloudinaryConfig,
  s3Config: S3Config,
  folder?: string,
): Promise<StorageResult> {
  // ── S3 path ───────────────────────────────────────────────────────────────
  if (s3Config.enabled) {
    if (!s3Config.bucket || !s3Config.region) {
      throw new Error(
        'S3 is enabled but bucket and/or region are not configured.',
      );
    }

    const result = await uploadToS3(
      file,
      s3Config.bucket,
      s3Config.region,
      folder,
    );

    return {
      url: result.url,
      storageId: result.key,
      provider: 's3',
    };
  }

  // ── Cloudinary path ───────────────────────────────────────────────────────
  if (cloudinaryConfig.enabled) {
    if (!cloudinaryConfig.cloudName || !cloudinaryConfig.uploadPreset) {
      throw new Error(
        'Cloudinary is enabled but cloudName and/or uploadPreset are not configured.',
      );
    }

    const result = await uploadCloudinary(
      file,
      cloudinaryConfig.cloudName,
      cloudinaryConfig.uploadPreset,
      folder,
    );

    return {
      url: result.url,
      storageId: result.cloudinaryId,
      provider: 'cloudinary',
    };
  }

  // ── Neither provider is configured ────────────────────────────────────────
  throw new Error(
    'No storage provider is configured. ' +
    'Enable either S3 (s3Config.enabled) or Cloudinary (cloudinaryConfig.enabled) in siteConfig.',
  );
}
