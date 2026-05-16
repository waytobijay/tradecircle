/**
 * components/ai/ProductDescriptionGenerator.tsx
 * AI-powered product description assistant for the product listing form.
 *
 * Props:
 *   productName  — current product name value
 *   category     — current category value
 *   condition    — current condition value
 *   onGenerated  — callback with the final description text
 */

'use client';

import { useRef, useState } from 'react';
import { useAI }            from '@/hooks/useAI';

export interface ProductDescriptionGeneratorProps {
  productName:  string;
  category:     string;
  condition:    string;
  onGenerated:  (description: string) => void;
}

export function ProductDescriptionGenerator({
  productName,
  category,
  condition,
  onGenerated,
}: ProductDescriptionGeneratorProps) {
  const { stream, loading, error } = useAI();
  const [preview,   setPreview]   = useState('');
  const [generated, setGenerated] = useState(false);
  const [aiDisabled, setAiDisabled] = useState(false);
  const abortRef = useRef(false);

  async function generate() {
    if (!productName.trim()) return;
    abortRef.current = false;
    setPreview('');
    setGenerated(false);

    const prompt = `Write a compelling product listing description for: ${productName}${category ? `, Category: ${category}` : ''}${condition ? `, Condition: ${condition}` : ''}. Be concise (2-3 sentences), highlight key benefits, use active language.`;

    try {
      await stream(
        [{ role: 'user', content: prompt }],
        (delta) => {
          if (abortRef.current) return;
          setPreview((prev) => prev + delta);
        },
        { maxTokens: 200 },
      );
      setGenerated(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.includes('not enabled') ||
        msg.includes('not configured') ||
        msg.includes('503')
      ) {
        setAiDisabled(true);
      }
    }
  }

  function handleUse() {
    if (preview) onGenerated(preview);
  }

  function handleRegenerate() {
    setPreview('');
    setGenerated(false);
    generate();
  }

  // ── Warning banner if AI not configured ──────────────────────────────────

  if (aiDisabled) {
    return (
      <div
        style={{
          padding:         '10px 14px',
          borderRadius:    'var(--radius-md)',
          border:          '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)',
          backgroundColor: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
          color:           'var(--color-text-secondary)',
          fontSize:        '13px',
          display:         'flex',
          alignItems:      'center',
          gap:             '8px',
        }}
      >
        <span style={{ fontSize: '16px' }}>⚠️</span>
        AI description generation is not enabled. Configure it in{' '}
        <a href="/admin/ai-settings" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
          Admin › AI Settings
        </a>
        .
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Generate button */}
      {!preview && !loading && (
        <button
          type="button"
          onClick={generate}
          disabled={!productName.trim()}
          style={{
            alignSelf:       'flex-start',
            display:         'flex',
            alignItems:      'center',
            gap:             '6px',
            padding:         '7px 14px',
            borderRadius:    'var(--radius-md)',
            border:          '1.5px solid var(--color-primary)',
            backgroundColor: 'transparent',
            color:           productName.trim() ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontSize:        '13px',
            fontWeight:      500,
            cursor:          productName.trim() ? 'pointer' : 'not-allowed',
            opacity:         productName.trim() ? 1 : 0.5,
            transition:      'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (productName.trim()) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'color-mix(in srgb, var(--color-primary) 8%, transparent)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
          title={!productName.trim() ? 'Enter a product name first' : undefined}
        >
          <span>✨</span>
          Generate with AI
        </button>
      )}

      {/* Loading / streaming preview */}
      {(loading || preview) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
            }}
          >
            AI Preview
          </label>
          <div style={{ position: 'relative' }}>
            <textarea
              readOnly
              value={preview}
              rows={4}
              style={{
                width:           '100%',
                padding:         '10px 12px',
                borderRadius:    'var(--radius-md)',
                border:          '1.5px solid var(--color-primary)',
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, var(--color-surface))',
                color:           'var(--color-text)',
                fontSize:        '14px',
                lineHeight:      1.6,
                outline:         'none',
                resize:          'none',
                boxSizing:       'border-box',
                fontFamily:      'var(--font-body)',
              }}
            />
            {/* Blinking cursor while streaming */}
            {loading && (
              <span
                style={{
                  display:         'inline-block',
                  width:           '2px',
                  height:          '1em',
                  backgroundColor: 'var(--color-primary)',
                  marginLeft:      '2px',
                  verticalAlign:   'text-bottom',
                  animation:       'aiCursorBlink 0.8s step-end infinite',
                }}
              />
            )}
          </div>

          {/* Error message */}
          {error && !loading && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-danger)' }}>
              {error}
            </p>
          )}

          {/* Action buttons */}
          {!loading && generated && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleUse}
                style={{
                  padding:         '7px 16px',
                  borderRadius:    'var(--radius-md)',
                  border:          'none',
                  backgroundColor: 'var(--color-primary)',
                  color:           '#ffffff',
                  fontSize:        '13px',
                  fontWeight:      600,
                  cursor:          'pointer',
                }}
              >
                Use This Description
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                style={{
                  padding:         '7px 14px',
                  borderRadius:    'var(--radius-md)',
                  border:          '1.5px solid var(--color-border)',
                  backgroundColor: 'transparent',
                  color:           'var(--color-text-secondary)',
                  fontSize:        '13px',
                  fontWeight:      500,
                  cursor:          'pointer',
                }}
              >
                Regenerate
              </button>
              <button
                type="button"
                onClick={() => { setPreview(''); setGenerated(false); }}
                style={{
                  padding:         '7px 14px',
                  borderRadius:    'var(--radius-md)',
                  border:          '1.5px solid var(--color-border)',
                  backgroundColor: 'transparent',
                  color:           'var(--color-text-secondary)',
                  fontSize:        '13px',
                  cursor:          'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes aiCursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
