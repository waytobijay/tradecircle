/**
 * services/imageTagging.ts
 * AI-powered image categorisation service.
 *
 * Given a product image URL, uses AI vision (multimodal model such as GPT-4o)
 * to suggest: category, tags[], and a short description.
 *
 * Calls the internal /api/ai route — the API key never leaves the server.
 */

export interface ImageTagResult {
  suggestedCategory: string;
  tags: string[];
  description: string;
}

const SAFE_DEFAULTS: ImageTagResult = {
  suggestedCategory: 'Other',
  tags: [],
  description: '',
};

/**
 * Given a product image URL, calls the AI vision endpoint and returns
 * suggested category, tags, and a short description for that image.
 *
 * Falls back to safe defaults if the AI response cannot be parsed or if
 * the current model does not support image analysis.
 */
export async function tagProductImage(imageUrl: string): Promise<ImageTagResult> {
  if (!imageUrl) return SAFE_DEFAULTS;

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
              {
                type: 'text',
                text: 'Identify this agricultural or marketplace product. Return JSON only (no markdown): { "category": string, "tags": string[], "description": string }. The category should be a concise product category (e.g. "Vegetables", "Grains", "Livestock", "Tools", "Electronics"). Tags should be 3-6 relevant keywords. Description should be 1-2 sentences.',
              },
            ],
          },
        ],
        maxTokens: 300,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return SAFE_DEFAULTS;

    const data = await res.json() as { text?: string };
    const text = data.text ?? '';

    // Extract JSON from the response (may be wrapped in markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return SAFE_DEFAULTS;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<{
      category: string;
      tags: unknown;
      description: string;
    }>;

    const tags = Array.isArray(parsed.tags)
      ? (parsed.tags as unknown[]).filter((t): t is string => typeof t === 'string')
      : [];

    return {
      suggestedCategory: typeof parsed.category    === 'string' ? parsed.category    : SAFE_DEFAULTS.suggestedCategory,
      tags,
      description:       typeof parsed.description === 'string' ? parsed.description : SAFE_DEFAULTS.description,
    };
  } catch {
    return SAFE_DEFAULTS;
  }
}
