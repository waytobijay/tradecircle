/**
 * utils/image.ts
 * Generic image utilities — validation, preview generation, fallback helpers.
 * For Cloudinary-specific optimisation, see services/cloudinary.ts.
 * Spec ref: section 5.4 (Media Handling)
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum upload size in bytes (10 MB). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Accepted MIME types for product / profile images. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a File before uploading it.
 * Checks MIME type and size limit.
 */
export function validateImage(
  file: File,
  maxBytes: number = MAX_IMAGE_BYTES,
): ImageValidationResult {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as AcceptedImageType)) {
    return {
      valid: false,
      error: `Unsupported file type "${file.type}". Accepted: JPEG, PNG, WebP, GIF.`,
    };
  }

  if (file.size > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    const fileMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is ${fileMb} MB — maximum allowed is ${maxMb} MB.`,
    };
  }

  return { valid: true };
}

// ─── Local preview ────────────────────────────────────────────────────────────

/**
 * Create a temporary object URL for an image file so it can be previewed
 * without uploading. Caller must call URL.revokeObjectURL(url) when done.
 */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Read a File as a base64 data URL.
 * Useful for sending images to APIs that don't accept multipart forms.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// ─── Dimensions ───────────────────────────────────────────────────────────────

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Load an image file and return its natural pixel dimensions.
 * Only works in browser environments.
 */
export function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image to read dimensions.'));
    };

    img.src = url;
  });
}

// ─── Fallbacks ────────────────────────────────────────────────────────────────

/** Inline SVG data URL used as a placeholder when no image is available. */
export const PLACEHOLDER_IMAGE_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='14'%3ENo image%3C/text%3E%3C/svg%3E";

/**
 * Return the URL if it is non-empty, otherwise return the placeholder.
 * Useful in `<img src={safeImageUrl(product.imageUrl)} />`.
 */
export function safeImageUrl(url: string | null | undefined): string {
  return url && url.trim() !== '' ? url : PLACEHOLDER_IMAGE_URL;
}

/**
 * Generate initials-based avatar data URL for users without a profile photo.
 * Returns an SVG with the first letter of the name on a coloured background.
 */
export function initialsAvatarUrl(name: string, bgColor = '#16a34a'): string {
  const initial = (name?.charAt(0) ?? '?').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bgColor}" rx="50"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="44" font-weight="600">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

/**
 * Human-readable file size string.
 * e.g. 1536000 → "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
