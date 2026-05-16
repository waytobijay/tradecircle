'use client';

/**
 * components/ui/ImageUploader.tsx
 * Multi-image drag-and-drop uploader with Cloudinary.
 * Uses XMLHttpRequest for per-file upload progress tracking.
 */

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from 'react';
import type { ProductImage } from '@/types';
import { validateImage, createPreviewUrl } from '@/utils/image';

interface ImageUploaderProps {
  cloudName: string;
  uploadPreset: string;
  folder?: string;
  maxImages?: number;
  value: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  disabled?: boolean;
}

interface UploadingFile {
  id: string;
  previewUrl: string;
  progress: number; // 0–100
  error?: string;
}

export default function ImageUploader({
  cloudName,
  uploadPreset,
  folder,
  maxImages = 5,
  value,
  onChange,
  disabled = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  // Upload a single file using XHR for progress tracking
  const uploadSingleFile = useCallback(
    (file: File, uploadId: string): Promise<ProductImage> => {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        if (folder) formData.append('folder', folder);

        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploading((prev) =>
              prev.map((u) => (u.id === uploadId ? { ...u, progress: pct } : u)),
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText) as {
                secure_url: string;
                public_id: string;
              };
              resolve({ url: data.secure_url, cloudinaryId: data.public_id });
            } catch {
              reject(new Error('Invalid response from Cloudinary.'));
            }
          } else {
            try {
              const errData = JSON.parse(xhr.responseText) as {
                error?: { message?: string };
              };
              reject(
                new Error(
                  errData.error?.message ??
                    `Upload failed with status ${xhr.status}`,
                ),
              );
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.onabort = () => reject(new Error('Upload was aborted.'));

        xhr.open(
          'POST',
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        );
        xhr.send(formData);
      });
    },
    [cloudName, uploadPreset, folder],
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      setError(null);

      const remaining = maxImages - value.length;
      if (remaining <= 0) {
        setError(`Maximum ${maxImages} images allowed.`);
        return;
      }

      const toProcess = files.slice(0, remaining);
      if (files.length > remaining) {
        setError(
          `Only ${remaining} more image${remaining !== 1 ? 's' : ''} can be added (max ${maxImages}).`,
        );
      }

      // Validate all files first
      const validFiles: { file: File; uploadId: string; previewUrl: string }[] = [];
      for (const file of toProcess) {
        const result = validateImage(file);
        if (!result.valid) {
          setError(result.error ?? 'Invalid file.');
          return;
        }
        validFiles.push({
          file,
          uploadId: `${Date.now()}-${Math.random()}`,
          previewUrl: createPreviewUrl(file),
        });
      }

      // Register all as uploading (progress 0)
      const uploadingEntries: UploadingFile[] = validFiles.map((vf) => ({
        id: vf.uploadId,
        previewUrl: vf.previewUrl,
        progress: 0,
      }));
      setUploading((prev) => [...prev, ...uploadingEntries]);

      // Upload in parallel
      const results = await Promise.allSettled(
        validFiles.map((vf) => uploadSingleFile(vf.file, vf.uploadId)),
      );

      const newImages: ProductImage[] = [];
      const errors: string[] = [];

      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          newImages.push(result.value);
        } else {
          errors.push(`${validFiles[i].file.name}: ${result.reason instanceof Error ? result.reason.message : 'Upload failed'}`);
        }
        // Clean up preview URL
        URL.revokeObjectURL(validFiles[i].previewUrl);
      });

      // Remove finished upload entries
      const finishedIds = new Set(validFiles.map((vf) => vf.uploadId));
      setUploading((prev) => prev.filter((u) => !finishedIds.has(u.id)));

      if (errors.length > 0) {
        setError(errors.join(' | '));
      }

      if (newImages.length > 0) {
        onChange([...value, ...newImages]);
      }
    },
    [maxImages, value, onChange, uploadSingleFile],
  );

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    void handleFiles(files);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) void handleFiles(files);
    // Reset input so same file can be re-selected after removal
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  };

  const atMax = value.length + uploading.length >= maxImages;
  const isDisabled = disabled || atMax;

  const dropZoneStyle: React.CSSProperties = {
    border: `2px dashed ${error ? 'var(--color-danger)' : dragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
    borderRadius: 12,
    padding: '28px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    background: dragging ? 'var(--color-surface)' : 'transparent',
    opacity: disabled ? 0.5 : 1,
    transition: 'border-color 0.15s, background 0.15s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Drop zone */}
      <div
        style={dropZoneStyle}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isDisabled && inputRef.current?.click()}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label="Image upload drop zone"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
            inputRef.current?.click();
          }
        }}
      >
        {/* Camera icon */}
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-secondary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>

        <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          {atMax
            ? `Maximum ${maxImages} images reached`
            : 'Drop images here or click to browse'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          JPEG, PNG, WebP, GIF — up to 10 MB each
        </span>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={onInputChange}
          disabled={isDisabled}
          aria-hidden="true"
        />
      </div>

      {/* Error message */}
      {error && (
        <span style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</span>
      )}

      {/* Image grid: existing + in-progress */}
      {(value.length > 0 || uploading.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {/* Uploaded images */}
          {value.map((img, idx) => (
            <div
              key={img.cloudinaryId}
              style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`Uploaded image ${idx + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {!disabled && (
                <button
                  onClick={() => removeImage(idx)}
                  style={{
                    position: 'absolute', top: 3, right: 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', border: 'none',
                    color: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, lineHeight: 1, padding: 0,
                  }}
                  aria-label={`Remove image ${idx + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {/* In-progress uploads */}
          {uploading.map((u) => (
            <div
              key={u.id}
              style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.previewUrl}
                alt="Uploading…"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.5 }}
              />
              {/* Progress bar */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 5, background: 'rgba(0,0,0,0.2)',
              }}>
                <div style={{
                  width: `${u.progress}%`,
                  height: '100%',
                  background: 'var(--color-primary)',
                  transition: 'width 0.1s',
                }} />
              </div>
              {/* Percentage label */}
              <span style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 11, fontWeight: 600, color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.7)',
              }}>
                {u.progress}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
