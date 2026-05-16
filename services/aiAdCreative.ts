/**
 * services/aiAdCreative.ts
 * Phase 5 — AI-powered ad creative generator.
 *
 * Generates headlines, body copy, CTAs, and image prompts for ad creatives
 * from a Product. Uses the central /api/ai endpoint (OpenAI-compatible).
 */

import type { Product, AdCreative } from '@/types';

interface AdCreativePayload {
  headline: string;     // 6-10 words, action-oriented
  body: string;         // 1-2 sentences
  cta: string;          // 'Shop Now', 'Learn More', etc.
  imagePrompt: string;  // suggested image style for DALL-E/Imagen
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callAI(prompt: string, maxTokens = 300): Promise<string> {
  const res = await fetch('/api/ai', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      messages: [
        { role: 'system', content: 'You are an expert direct-response copywriter. Always respond with valid JSON only — no prose, no markdown fences.' },
        { role: 'user',   content: prompt },
      ],
      maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`AI request failed (HTTP ${res.status})`);
  const data = await res.json();
  // /api/ai typically returns either { content } or full OpenAI shape
  const content: string =
    data?.content ??
    data?.choices?.[0]?.message?.content ??
    data?.message ??
    '';
  return String(content).trim();
}

/** Strip markdown fences and parse JSON safely. */
function safeParseJSON<T>(raw: string): T {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  // If the model wrapped the JSON in extra text, extract first {...} or [...]
  const arrayMatch  = text.match(/\[[\s\S]*\]/);
  const objectMatch = text.match(/\{[\s\S]*\}/);
  const candidate   = arrayMatch?.[0] ?? objectMatch?.[0] ?? text;
  return JSON.parse(candidate) as T;
}

function productSummary(p: Product): string {
  const parts = [
    `Name: ${p.name}`,
    p.category    ? `Category: ${p.category}`         : '',
    typeof p.price === 'number' ? `Price: ${p.price}` : '',
    p.description ? `Description: ${p.description}`   : '',
  ].filter(Boolean);
  return parts.join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a single ad creative (headline, body, CTA, image prompt) for a product.
 */
export async function generateAdCreative(product: Product): Promise<AdCreativePayload> {
  const prompt = `Create a single high-converting ad creative for this product:
${productSummary(product)}

Return JSON with exactly these fields:
{
  "headline":    "6-10 words, action-oriented, no clickbait",
  "body":        "1-2 short benefit-focused sentences",
  "cta":         "Short call-to-action like 'Shop Now', 'Learn More', 'Get Yours'",
  "imagePrompt": "A vivid description of the ideal hero image, suitable for DALL-E or Imagen"
}`;
  const raw = await callAI(prompt, 350);
  const out = safeParseJSON<AdCreativePayload>(raw);
  return {
    headline:    String(out.headline ?? '').slice(0, 120),
    body:        String(out.body ?? '').slice(0, 280),
    cta:         String(out.cta ?? 'Shop Now').slice(0, 32),
    imagePrompt: String(out.imagePrompt ?? ''),
  };
}

/**
 * Generate `count` distinct ad creative variants for A/B testing.
 * Each variant adheres to the AdCreative interface (imageUrl + headline + ctaUrl).
 * `imageUrl` is left blank — the caller can upload or generate it separately.
 */
export async function generateAdVariants(product: Product, count = 3): Promise<AdCreative[]> {
  const prompt = `Create ${count} distinct ad creative variants for A/B testing this product:
${productSummary(product)}

Each variant should test a different angle (e.g. urgency, social proof, value, curiosity).
Return a JSON array of length ${count}. Each element must have exactly:
{
  "headline":    "6-10 words, action-oriented",
  "body":        "1-2 short benefit-focused sentences",
  "cta":         "Short call-to-action",
  "imagePrompt": "Vivid hero image description"
}`;
  const raw   = await callAI(prompt, 600);
  const parts = safeParseJSON<AdCreativePayload[]>(raw);
  const list  = Array.isArray(parts) ? parts : [];

  return list.slice(0, count).map<AdCreative>((p) => ({
    imageUrl: '',
    headline: String(p.headline ?? '').slice(0, 120),
    ctaUrl:   '',
  }));
}
