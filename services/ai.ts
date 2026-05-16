/**
 * services/ai.ts
 * Central AI service — OpenAI-compatible REST API.
 * Works with OpenAI, OpenRouter, or any compatible provider.
 */

export interface AIConfig {
  provider: 'openai' | 'openrouter' | 'custom';
  apiKey:   string;
  model:    string;      // e.g. 'gpt-4o-mini', 'gpt-4o'
  baseUrl?: string;      // for custom/openrouter endpoints
  enabled:  boolean;
}

export interface AIMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

// ─── Error mapping ────────────────────────────────────────────────────────────

function mapError(status: number): string {
  if (status === 401) return 'Invalid API key. Check your AI settings.';
  if (status === 429) return 'Rate limit exceeded. Please wait a moment and try again.';
  if (status === 503) return 'AI service is currently unavailable.';
  return `AI request failed (HTTP ${status}).`;
}

function resolveBaseUrl(config: AIConfig): string {
  if (config.baseUrl) return config.baseUrl.replace(/\/$/, '');
  if (config.provider === 'openrouter') return 'https://openrouter.ai/api';
  return 'https://api.openai.com';
}

// ─── Chat completion (non-streaming) ─────────────────────────────────────────

export async function chatCompletion(
  messages: AIMessage[],
  config:   AIConfig,
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  if (!config.enabled) throw new Error('AI module is not enabled.');
  if (!config.apiKey)  throw new Error('AI API key is not configured.');

  const baseUrl = resolveBaseUrl(config);

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model:       config.model,
      messages,
      max_tokens:  options?.maxTokens  ?? 1024,
      temperature: options?.temperature ?? 0.7,
      stream:      false,
    }),
  });

  if (!res.ok) {
    throw new Error(mapError(res.status));
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? '';
}

// ─── Streaming chat completion ────────────────────────────────────────────────

export async function streamChatCompletion(
  messages: AIMessage[],
  config:   AIConfig,
  onChunk:  (delta: string) => void,
  options?: { maxTokens?: number },
): Promise<void> {
  if (!config.enabled) throw new Error('AI module is not enabled.');
  if (!config.apiKey)  throw new Error('AI API key is not configured.');

  const baseUrl = resolveBaseUrl(config);

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model:      config.model,
      messages,
      max_tokens: options?.maxTokens ?? 1024,
      stream:     true,
    }),
  });

  if (!res.ok) {
    throw new Error(mapError(res.status));
  }

  if (!res.body) throw new Error('No response body from AI provider.');

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
}
