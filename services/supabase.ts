/**
 * services/supabase.ts
 * Supabase client factory.
 * Only instantiated when SupabaseConfig.enabled === true and credentials are set.
 * Spec ref: section 9.1 — Supabase backend option
 *
 * Install the Supabase JS client if you haven't already:
 *   npm install @supabase/supabase-js
 */

import type { SupabaseConfig } from '@/types';

// ─── Dynamic import with graceful stub ────────────────────────────────────────
// We import @supabase/supabase-js lazily to avoid a hard crash when the
// package is not installed. If the import fails, every exported function
// will throw a descriptive error pointing to the install command.

type SupabaseClient = import('@supabase/supabase-js').SupabaseClient;

let _createClient: ((url: string, key: string) => SupabaseClient) | null = null;
let _importError: string | null = null;

async function resolveCreateClient(): Promise<(url: string, key: string) => SupabaseClient> {
  if (_createClient) return _createClient;
  if (_importError) throw new Error(_importError);

  try {
    const mod = await import('@supabase/supabase-js');
    _createClient = mod.createClient as (url: string, key: string) => SupabaseClient;
    return _createClient;
  } catch {
    _importError =
      '@supabase/supabase-js is not installed. ' +
      'Run: npm install @supabase/supabase-js';
    throw new Error(_importError);
  }
}

// ─── Cached client instance ───────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

/**
 * Return a Supabase client using the provided config. Caches the instance.
 * Throws a descriptive error if @supabase/supabase-js is not installed.
 */
export async function getSupabaseClient(
  url: string,
  anonKey: string,
): Promise<SupabaseClient> {
  if (_client) return _client;
  const createClient = await resolveCreateClient();
  _client = createClient(url, anonKey);
  return _client;
}

/**
 * Reset the cached client (call when config changes or during tests).
 */
export function resetSupabaseClient(): void {
  _client = null;
}

// ─── Config helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if Supabase is enabled and both url and anonKey are non-empty.
 */
export function isSupabaseConfigured(config: SupabaseConfig): boolean {
  return !!(config.enabled && config.url?.trim() && config.anonKey?.trim());
}

/**
 * Tries a lightweight query against a `_health` table to verify connectivity.
 * Returns { ok: true } on success, or { ok: false, error: string } on failure.
 */
export async function testSupabaseConnection(
  url: string,
  anonKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await getSupabaseClient(url, anonKey);
    // Attempt a minimal SELECT; the table doesn't need to exist —
    // a "relation does not exist" Postgres error still proves connectivity.
    const { error } = await client.from('_health').select('1');

    if (error) {
      // PGRST116 = table not found — connection is alive, table is just missing
      const isConnected =
        error.code === 'PGRST116' ||
        error.message?.toLowerCase().includes('does not exist');

      if (isConnected) return { ok: true };
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
