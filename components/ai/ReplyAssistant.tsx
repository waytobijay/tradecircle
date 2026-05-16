/**
 * components/ai/ReplyAssistant.tsx
 * AI reply suggestion widget for messages and enquiries.
 *
 * Props:
 *   context  — the last message/enquiry text from the other party
 *   role     — 'seller' | 'advisor' (shapes the prompt)
 *   onSelect — callback when the user picks a suggestion (populates input)
 */

'use client';

import { useState } from 'react';
import { useAI }   from '@/hooks/useAI';

export interface ReplyAssistantProps {
  context:  string;
  role:     'seller' | 'advisor';
  onSelect: (reply: string) => void;
}

function parseSuggestions(text: string): string[] {
  // Expect format: "1. [reply] 2. [reply]" (possibly on separate lines)
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Try numbered list patterns: "1." or "1)" at start of line or after whitespace
  const pattern = /(?:^|\n)\s*[1-2][.)]\s+(.+)/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    const line = match[1].trim();
    if (line) matches.push(line);
  }

  if (matches.length >= 2) return matches.slice(0, 2);

  // Fallback: split by newline and take up to 2 non-empty lines
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, 2);
}

export function ReplyAssistant({ context, role, onSelect }: ReplyAssistantProps) {
  const { complete, loading, error } = useAI();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiDisabled,  setAiDisabled]  = useState(false);
  const [open,        setOpen]        = useState(false);

  async function fetchSuggestions() {
    if (!context.trim()) return;
    setSuggestions([]);
    setOpen(true);

    const prompt =
      `You are a ${role} on an agricultural trade platform. ` +
      `Suggest 2 short, professional reply options to this message: '${context}'. ` +
      `Format as: 1. [reply] 2. [reply]`;

    try {
      const text = await complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 200, temperature: 0.7 },
      );
      const parsed = parseSuggestions(text);
      setSuggestions(parsed.length ? parsed : [text]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.includes('not enabled') ||
        msg.includes('not configured') ||
        msg.includes('503')
      ) {
        setAiDisabled(true);
        setOpen(false);
      }
    }
  }

  // If AI is permanently disabled, show nothing (or a subtle warning)
  if (aiDisabled) {
    return (
      <div
        style={{
          padding:         '8px 12px',
          borderRadius:    'var(--radius-md)',
          border:          '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)',
          backgroundColor: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
          color:           'var(--color-text-secondary)',
          fontSize:        '12px',
          marginTop:       '6px',
        }}
      >
        AI reply suggestions are not enabled. Configure in{' '}
        <a href="/admin/ai-settings" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
          Admin › AI Settings
        </a>
        .
      </div>
    );
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {/* Trigger button */}
      {!open && (
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={!context.trim()}
          style={{
            display:         'flex',
            alignItems:      'center',
            gap:             '5px',
            padding:         '5px 12px',
            borderRadius:    'var(--radius-md)',
            border:          '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color:           context.trim() ? 'var(--color-text-secondary)' : 'var(--color-text-3)',
            fontSize:        '12px',
            fontWeight:      500,
            cursor:          context.trim() ? 'pointer' : 'not-allowed',
            opacity:         context.trim() ? 1 : 0.5,
            transition:      'border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (context.trim()) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
            (e.currentTarget as HTMLButtonElement).style.color = context.trim()
              ? 'var(--color-text-secondary)'
              : 'var(--color-text-3)';
          }}
        >
          <span>💡</span>
          Suggest Reply
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          style={{
            borderRadius:    'var(--radius-md)',
            border:          '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            overflow:        'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'space-between',
              padding:         '8px 12px',
              borderBottom:    '1px solid var(--color-border)',
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>💡</span> AI Reply Suggestions
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                color:      'var(--color-text-secondary)',
                fontSize:   '18px',
                lineHeight: 1,
                padding:    '0 2px',
              }}
              aria-label="Dismiss suggestions"
            >
              ×
            </button>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    height:          '52px',
                    borderRadius:    'var(--radius-md)',
                    backgroundColor: 'var(--color-surface-2, var(--color-border))',
                    animation:       'aiPulse 1.4s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div style={{ padding: '12px', fontSize: '13px', color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}

          {/* Suggestion cards */}
          {!loading && suggestions.length > 0 && (
            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { onSelect(suggestion); setOpen(false); }}
                  style={{
                    textAlign:       'left',
                    padding:         '10px 12px',
                    borderRadius:    'var(--radius-md)',
                    border:          '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg, var(--color-background))',
                    color:           'var(--color-text)',
                    fontSize:        '13px',
                    lineHeight:      1.5,
                    cursor:          'pointer',
                    transition:      'border-color 0.15s, background-color 0.15s',
                    width:           '100%',
                  }}
                  onMouseEnter={(e) => {
                    const btn = e.currentTarget as HTMLButtonElement;
                    btn.style.borderColor = 'var(--color-primary)';
                    btn.style.backgroundColor = 'color-mix(in srgb, var(--color-primary) 6%, transparent)';
                  }}
                  onMouseLeave={(e) => {
                    const btn = e.currentTarget as HTMLButtonElement;
                    btn.style.borderColor = 'var(--color-border)';
                    btn.style.backgroundColor = 'var(--color-bg, var(--color-background))';
                  }}
                >
                  <span
                    style={{
                      display:         'inline-block',
                      fontSize:        '10px',
                      fontWeight:      700,
                      padding:         '1px 5px',
                      borderRadius:    'var(--radius-sm)',
                      backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                      color:           'var(--color-primary)',
                      marginRight:     '8px',
                      verticalAlign:   'middle',
                    }}
                  >
                    {i + 1}
                  </span>
                  {suggestion}
                </button>
              ))}

              {/* Regenerate */}
              <button
                type="button"
                onClick={fetchSuggestions}
                style={{
                  alignSelf:       'flex-start',
                  padding:         '5px 10px',
                  borderRadius:    'var(--radius-md)',
                  border:          '1px solid var(--color-border)',
                  backgroundColor: 'transparent',
                  color:           'var(--color-text-secondary)',
                  fontSize:        '12px',
                  cursor:          'pointer',
                  marginTop:       '2px',
                }}
              >
                ↻ Regenerate
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes aiPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}
