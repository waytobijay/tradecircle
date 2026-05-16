/**
 * app/api/ai/route.ts
 * Server-side AI proxy — keeps the API key off the client.
 *
 * POST body:
 *   { messages: AIMessage[]; maxTokens?: number; temperature?: number; stream?: boolean }
 *
 * Reads AI config from Firestore `config/aiSettings` doc,
 * falls back to env vars: OPENAI_API_KEY, AI_MODEL.
 * Returns 503 if the AI module is disabled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore }                 from 'firebase-admin/firestore';
import type { AIMessage }               from '@/services/ai';

// ─── Firebase Admin init (idempotent) ─────────────────────────────────────────

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccount) {
      initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
    } else {
      // Fallback: use default credentials (e.g. in Cloud Run / GCP environment)
      initializeApp();
    }
  }
  return getFirestore();
}

// ─── Fetch AI config from Firestore ───────────────────────────────────────────

interface StoredAIConfig {
  enabled:  boolean;
  apiKey:   string;
  model:    string;
  provider: 'openai' | 'openrouter' | 'custom';
  baseUrl?: string;
}

async function loadAIConfig(): Promise<StoredAIConfig> {
  // Default from env
  const envConfig: StoredAIConfig = {
    enabled:  !!(process.env.OPENAI_API_KEY),
    apiKey:   process.env.OPENAI_API_KEY ?? '',
    model:    process.env.AI_MODEL ?? 'gpt-4o-mini',
    provider: 'openai',
  };

  try {
    const db   = getAdminDb();
    const snap = await db.doc('config/aiSettings').get();
    if (!snap.exists) return envConfig;

    const data = snap.data() as Partial<StoredAIConfig>;
    return {
      enabled:  data.enabled  ?? envConfig.enabled,
      apiKey:   data.apiKey   ?? envConfig.apiKey,
      model:    data.model    ?? envConfig.model,
      provider: data.provider ?? envConfig.provider,
      baseUrl:  data.baseUrl,
    };
  } catch {
    // Firestore unavailable — fall back to env
    return envConfig;
  }
}

// ─── Resolve base URL ─────────────────────────────────────────────────────────

function resolveBaseUrl(config: StoredAIConfig): string {
  if (config.baseUrl) return config.baseUrl.replace(/\/$/, '');
  if (config.provider === 'openrouter') return 'https://openrouter.ai/api';
  return 'https://api.openai.com';
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  const body = await req.json() as {
    messages:     AIMessage[];
    maxTokens?:   number;
    temperature?: number;
    stream?:      boolean;
  };

  const { messages, maxTokens = 1024, temperature = 0.7, stream = false } = body;

  if (!messages?.length) {
    return NextResponse.json({ error: 'messages array is required.' }, { status: 400 });
  }

  // Load config
  const config = await loadAIConfig();

  if (!config.enabled || !config.apiKey) {
    return NextResponse.json(
      { error: 'AI module is not enabled. Configure it in Admin › AI Settings.' },
      { status: 503 },
    );
  }

  const baseUrl = resolveBaseUrl(config);
  const endpoint = `${baseUrl}/v1/chat/completions`;

  const providerRes = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model:       config.model,
      messages,
      max_tokens:  maxTokens,
      temperature,
      stream,
    }),
  });

  // Map provider errors
  if (!providerRes.ok) {
    const statusMap: Record<number, string> = {
      401: 'Invalid API key. Check Admin › AI Settings.',
      429: 'Rate limit exceeded. Please wait and try again.',
      503: 'AI provider is currently unavailable.',
    };
    const message = statusMap[providerRes.status] ?? `AI provider error (${providerRes.status}).`;
    return NextResponse.json({ error: message }, { status: providerRes.status });
  }

  // ── Streaming ──
  if (stream) {
    // Pipe SSE through TransformStream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    (async () => {
      const reader  = providerRes.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    });
  }

  // ── Non-streaming ──
  const data = await providerRes.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const text = data.choices[0]?.message?.content ?? '';
  return NextResponse.json({ text });
}
