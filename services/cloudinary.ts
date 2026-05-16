/**
 * services/cloudinary.ts
 * Cloudinary image upload and URL optimisation helpers.
 */

export interface CloudinaryUploadResult {
  url: string;
  cloudinaryId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Upload a file to Cloudinary via unsigned upload preset.
 */
export async function uploadImage(
  file: File,
  cloudName: string,
  uploadPreset: string,
  folder?: string,
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  if (folder) {
    formData.append('folder', folder);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: { message?: string } }).error?.message ??
        `Cloudinary upload failed with status ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    secure_url: string;
    public_id: string;
    format: string;
    width: number;
    height: number;
    bytes: number;
  };

  return {
    url: data.secure_url,
    cloudinaryId: data.public_id,
    format: data.format,
    width: data.width,
    height: data.height,
    bytes: data.bytes,
  };
}

export interface OptimizeOptions {
  width?: number;
  height?: number;
  quality?: string;
  format?: string;
  crop?: string;
}

/**
 * Build an optimised Cloudinary delivery URL from a public ID.
 * Applies w_, h_, c_, q_, f_ transforms as supplied.
 */
export function getOptimizedUrl(
  publicId: string,
  cloudName: string,
  opts: OptimizeOptions = {},
): string {
  const parts: string[] = [];

  if (opts.width !== undefined) parts.push(`w_${opts.width}`);
  if (opts.height !== undefined) parts.push(`h_${opts.height}`);
  if (opts.crop) parts.push(`c_${opts.crop}`);
  if (opts.quality) parts.push(`q_${opts.quality}`);
  if (opts.format) parts.push(`f_${opts.format}`);

  const transforms = parts.length > 0 ? parts.join(',') + '/' : '';

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}${publicId}`;
}
