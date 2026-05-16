'use client';

/**
 * components/ui/StepBuilder.tsx
 * Reusable step editor for advice posts.
 * Fully controlled — parent owns the steps array.
 */

import { useRef, ChangeEvent } from 'react';
import type { AdviceStep } from '@/types';
import { validateImage } from '@/utils/image';

interface StepBuilderProps {
  value: AdviceStep[];
  onChange: (steps: AdviceStep[]) => void;
  cloudName: string;
  uploadPreset: string;
}

// ─── Cloudinary upload (simple fetch, no progress needed for single file) ───

async function uploadStepImage(
  file: File,
  cloudName: string,
  uploadPreset: string,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'advice-steps');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData },
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(err.error?.message ?? `Upload failed (${res.status})`);
  }

  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}

// ─── Sub-component: single step card ────────────────────────────────────────

interface StepCardProps {
  step: AdviceStep;
  index: number;
  total: number;
  cloudName: string;
  uploadPreset: string;
  onUpdate: (updated: AdviceStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function StepCard({
  step,
  index,
  total,
  cloudName,
  uploadPreset,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: StepCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...step, title: e.target.value });
  };

  const handleDescChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ ...step, description: e.target.value });
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validation = validateImage(file);
    if (!validation.valid) {
      alert(validation.error ?? 'Invalid file.');
      return;
    }

    try {
      const url = await uploadStepImage(file, cloudName, uploadPreset);
      onUpdate({ ...step, images: [...step.images, url] });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  const removeImage = (imgIndex: number) => {
    onUpdate({ ...step, images: step.images.filter((_, i) => i !== imgIndex) });
  };

  const iconBtn: React.CSSProperties = {
    background: 'none',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    width: 30,
    height: 30,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-text-secondary)',
    padding: 0,
    flexShrink: 0,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    fontSize: 14,
    color: 'var(--color-text)',
    background: 'var(--color-background)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      padding: '16px',
      background: 'var(--color-surface)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header row: step number + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Step number circle */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--color-primary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14, flexShrink: 0,
        }}>
          {index + 1}
        </div>

        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)', flex: 1 }}>
          Step {index + 1}
        </span>

        {/* Move up */}
        <button
          style={{ ...iconBtn, opacity: index === 0 ? 0.35 : 1 }}
          onClick={onMoveUp}
          disabled={index === 0}
          title="Move up"
          aria-label="Move step up"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        {/* Move down */}
        <button
          style={{ ...iconBtn, opacity: index === total - 1 ? 0.35 : 1 }}
          onClick={onMoveDown}
          disabled={index === total - 1}
          title="Move down"
          aria-label="Move step down"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Delete */}
        <button
          style={{ ...iconBtn, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
          onClick={onDelete}
          title="Delete step"
          aria-label="Delete step"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      {/* Title input */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
          Title
        </label>
        <input
          type="text"
          value={step.title}
          onChange={handleTitleChange}
          placeholder="Step title…"
          style={inputStyle}
        />
      </div>

      {/* Description textarea */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
          Description
        </label>
        <textarea
          value={step.description}
          onChange={handleDescChange}
          placeholder="Describe this step…"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
      </div>

      {/* Images */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
          Images
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {/* Existing thumbnails */}
          {step.images.map((url, imgIdx) => (
            <div
              key={`${url}-${imgIdx}`}
              style={{
                position: 'relative', width: 60, height: 60,
                borderRadius: 8, overflow: 'hidden',
                border: '1px solid var(--color-border)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Step ${index + 1} image ${imgIdx + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <button
                onClick={() => removeImage(imgIdx)}
                style={{
                  position: 'absolute', top: 2, right: 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.65)', border: 'none',
                  color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, lineHeight: 1, padding: 0,
                }}
                aria-label={`Remove image ${imgIdx + 1}`}
              >
                ×
              </button>
            </div>
          ))}

          {/* Add image button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 60, height: 60, borderRadius: 8,
              border: '2px dashed var(--color-border)',
              background: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-secondary)', fontSize: 22, lineHeight: 1,
            }}
            title="Add image"
            aria-label="Add image to step"
          >
            +
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function StepBuilder({
  value,
  onChange,
  cloudName,
  uploadPreset,
}: StepBuilderProps) {
  const addStep = () => {
    onChange([...value, { title: '', description: '', images: [] }]);
  };

  const updateStep = (index: number, updated: AdviceStep) => {
    onChange(value.map((s, i) => (i === index ? updated : s)));
  };

  const deleteStep = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {value.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', textAlign: 'center', padding: '16px 0' }}>
          No steps yet. Click &ldquo;Add Step&rdquo; to get started.
        </p>
      )}

      {value.map((step, idx) => (
        <StepCard
          key={idx}
          step={step}
          index={idx}
          total={value.length}
          cloudName={cloudName}
          uploadPreset={uploadPreset}
          onUpdate={(updated) => updateStep(idx, updated)}
          onDelete={() => deleteStep(idx)}
          onMoveUp={() => moveStep(idx, idx - 1)}
          onMoveDown={() => moveStep(idx, idx + 1)}
        />
      ))}

      <button
        onClick={addStep}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 16px',
          border: '2px dashed var(--color-primary)',
          borderRadius: 10,
          background: 'none',
          color: 'var(--color-primary)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          width: '100%',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Step
      </button>
    </div>
  );
}
