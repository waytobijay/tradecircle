/**
 * hooks/useAI.ts
 * Client hook that calls the /api/ai proxy route.
 *
 * Usage:
 *   const { complete, stream, loading, error } = useAI();
 */

'use client';

import { useCallback, useState } from 'react';
import type { AIMessage }        from '@/services/ai';

export interface UseAIReturn {
  complete: (messages: AIMessage[], options?: { maxTokens?: number; temperature?: number }) => Promise<string>;
  stream:   (messages: AIMessage[], onChunk: (delta: string) => void, options?: { maxTokens?: number }) => Promise<void>;
  loading:  boolean;
  error:    string | null;
}

export function useAI(): UseAIReturn {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Non-streaming completion ───────────────────────────────────────────────

  const complete = useCallback(async (
    messages: AIMessage[],
    options?: { maxTokens?: number; temperature?: number },
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages,
          maxTokens:   options?.maxTokens,
          temperature: options?.temperature,
          stream:      false,
        }),
      });

      const data = await res.json() as { text?: string; error?: string };

      if (!res.ok) {
        const msg = data.error ?? `Request failed (${res.status})`;
        setError(msg);
        throw new Error(msg);
      }

      return data.text ?? '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown AI error';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Streaming completion ───────────────────────────────────────────────────

  const stream = useCallback(async (
    messages: AIMessage[],
    onChunk:  (delta: string) => void,
    options?: { maxTokens?: number },
  ): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages,
          maxTokens: options?.maxTokens,
          stream:    true,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        const msg  = data.error ?? `Request failed (${res.status})`;
        setError(msg);
        throw new Error(msg);
      }

      if (!res.body) throw new Error('No response body from AI route.');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') return;

          try {
            const parsed = JSON.parse(payload) as {
              choices: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices[0]?.delta?.content;
            if (delta) onChunk(delta);
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown AI error';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { complete, stream, loading, error };
}
