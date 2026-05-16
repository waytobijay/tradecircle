/**
 * components/ai/ImageTagger.tsx
 * AI-powered image auto-tagger for the product listing form.
 *
 * Props:
 *   imageUrl         — URL of the uploaded product image
 *   onTagsGenerated  — callback with { category, tags, description } when user applies
 *
 * Only renders when imageUrl is non-empty.
 * Calls tagProductImage(), shows editable tag pills, and lets the user
 * deselect individual tags before applying the suggestions.
 */

'use client';

import { useState }           from 'react';
import { Loader2, X }         from 'lucide-react';
import { tagProductImage }    from '@/services/imageTagging';
import type { ImageTagResult } from '@/services/imageTagging';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ImageTaggerProps {
  imageUrl:        string;
  onTagsGenerated: (tags: ImageTagResult) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImageTagger({ imageUrl, onTagsGenerated }: ImageTaggerProps) {
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [result,      setResult]      = useState<ImageTagResult | null>(null);
  const [activeTagsSet, setActiveTags] = useState<Set<string>>(new Set());

  // ── Do not render if no image is present ──────────────────────────────────
  if (!imageUrl) return null;

  // ── Trigger AI tagging ────────────────────────────────────────────────────
  async function handleAutoTag() {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await tagProductImage(imageUrl);
      setResult(res);
      setActiveTags(new Set(res.tags));
    } catch {
      setError('Auto-tagging failed. AI may not support image analysis with current model.');
    } finally {
      setLoading(false);
    }
  }

  // ── Toggle a tag pill ─────────────────────────────────────────────────────
  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  // ── Apply suggestions callback ────────────────────────────────────────────
  function handleApply() {
    if (!result) return;
    onTagsGenerated({
      suggestedCategory: result.suggestedCategory,
      tags:              result.tags.filter((t) => activeTagsSet.has(t)),
      description:       result.description,
    });
  }

  // ── Dismiss result ────────────────────────────────────────────────────────
  function handleDismiss() {
    setResult(null);
    setError('');
    setActiveTags(new Set());
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Trigger button — only when no result yet */}
      {!result && !loading && !error && (
        <button
          type="button"
          onClick={() => void handleAutoTag()}
          style={{
            alignSelf: 'flex-start',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            border: '1.5px solid var(--color-primary)',
            background: 'transparent',
            color: 'var(--color-primary)',
            fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              'color-mix(in srgb, var(--color-primary) 8%, transparent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          <span>🏷️</span>
          Auto-tag with AI
        </button>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Analysing image…</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)',
          background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
          color: 'var(--color-text-secondary)', fontSize: 13,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ fontSize: 15 }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div style={{
          border: '1.5px solid var(--color-primary)',
          borderRadius: 10,
          background: 'color-mix(in srgb, var(--color-primary) 4%, var(--color-surface))',
          padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>

          {/* Suggested category */}
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Suggested Category
            </p>
            <span style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 99,
              background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
              color: 'var(--color-primary)', fontSize: 13, fontWeight: 600,
            }}>
              {result.suggestedCategory}
            </span>
          </div>

          {/* AI description */}
          {result.description && (
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                AI Description
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5 }}>
                {result.description}
              </p>
            </div>
          )}

          {/* Tag pills */}
          {result.tags.length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Tags — click to deselect
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.tags.map((tag) => {
                  const active = activeTagsSet.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 99,
                        border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: active
                          ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                          : 'transparent',
                        color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        fontSize: 12, fontWeight: 500,
                        cursor: 'pointer',
                        textDecoration: active ? 'none' : 'line-through',
                        opacity: active ? 1 : 0.5,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {tag}
                      {active && <X size={10} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button
              type="button"
              onClick={handleApply}
              style={{
                padding: '7px 16px', borderRadius: 8, border: 'none',
                background: 'var(--color-primary)', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Apply Suggestions
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                padding: '7px 14px', borderRadius: 8,
                border: '1.5px solid var(--color-border)',
                background: 'transparent', color: 'var(--color-text-secondary)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
