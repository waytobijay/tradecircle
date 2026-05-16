/**
 * lib/localConfig.ts
 * Server-side only file-based config store for the bootstrap admin and
 * the Firebase configuration that the setup wizard collects.
 *
 * Storage: `.tradecircle-local/config.json` at the project root.
 *
 * Security:
 *   - Passwords are hashed using PBKDF2-SHA256 (100,000 iterations) + per-user salt.
 *   - The `sessionSecret` is generated once on first write and persisted.
 *   - The whole `.tradecircle-local/` directory is auto-added to .gitignore
 *     so the credentials never end up in the repo.
 *
 * Never import this file from client components.
 */

import fs       from 'fs/promises';
import path     from 'path';
import crypto   from 'crypto';

const CONFIG_DIR   = path.join(process.cwd(), '.tradecircle-local');
const CONFIG_FILE  = path.join(CONFIG_DIR, 'config.json');
const DIR_IGNORE   = path.join(CONFIG_DIR, '.gitignore');
const ROOT_GITIGN  = path.join(process.cwd(), '.gitignore');

// ─── Types ────────────────────────────────────────────────────────────────

export interface LocalAdmin {
  email:        string;
  name:         string;
  passwordHash: string;   // PBKDF2-SHA256 hex
  salt:         string;   // hex
  createdAt:    string;   // ISO-8601
}

export interface LocalFirebase {
  apiKey?:            string;
  authDomain?:        string;
  projectId?:         string;
  storageBucket?:     string;
  appId?:             string;
  messagingSenderId?: string;
  vapidKey?:          string;
}

export interface LocalCloudinary {
  cloudName?:     string;
  uploadPreset?:  string;
}

export interface LocalConfig {
  admin?:               LocalAdmin;
  firebase?:            LocalFirebase;
  cloudinary?:          LocalCloudinary;
  serviceAccountJson?:  string;
  sessionSecret:        string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────

async function ensureDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  // Drop a .gitignore *inside* the dir as a belt-and-braces measure.
  try {
    await fs.access(DIR_IGNORE);
  } catch {
    await fs.writeFile(DIR_IGNORE, '# Bootstrap credentials — never commit\n*\n', 'utf8');
  }
  // Make sure the root .gitignore excludes this directory.
  try {
    const current = await fs.readFile(ROOT_GITIGN, 'utf8');
    if (!current.includes('.tradecircle-local')) {
      await fs.appendFile(
        ROOT_GITIGN,
        '\n# Local bootstrap credentials — never commit\n.tradecircle-local/\n',
        'utf8',
      );
    }
  } catch {
    // No root .gitignore — create one with just our entry.
    await fs.writeFile(
      ROOT_GITIGN,
      '# Local bootstrap credentials — never commit\n.tradecircle-local/\n',
      'utf8',
    );
  }
}

// ─── Password hashing ─────────────────────────────────────────────────────

/**
 * Hash a plaintext password with PBKDF2-SHA256.
 * Generates a new 16-byte salt if one isn't supplied.
 */
export function hashPassword(
  password: string,
  salt?:    string,
): { hash: string; salt: string } {
  const useSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const hash    = crypto
    .pbkdf2Sync(password, useSalt, 100_000, 32, 'sha256')
    .toString('hex');
  return { hash, salt: useSalt };
}

/** Constant-time compare of a candidate password against a stored hash. */
export function verifyPassword(
  password: string,
  hash:     string,
  salt:     string,
): boolean {
  const candidate = crypto
    .pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
    .toString('hex');
  // Buffers must be the same length for timingSafeEqual.
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Generate a random session token (hex). */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Read / write ─────────────────────────────────────────────────────────

export async function readLocalConfig(): Promise<LocalConfig | null> {
  try {
    const raw    = await fs.readFile(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as LocalConfig;
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    console.error('[localConfig] read failed:', err);
    return null;
  }
}

/**
 * True if running in a serverless / read-only filesystem environment.
 * On Vercel + AWS Lambda the project files live under /var/task which is
 * read-only — only /tmp is writable, and even that is wiped between calls.
 */
export function isReadOnlyEnv(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * Merge-write the local config.
 * Generates `sessionSecret` on first write.
 * Throws a clear error in read-only environments so callers can react with
 * a friendly message instead of an ENOENT/EROFS crash.
 */
export async function writeLocalConfig(
  patch: Partial<LocalConfig>,
): Promise<LocalConfig> {
  if (isReadOnlyEnv()) {
    throw new Error(
      'Local config writes are not supported in this environment ' +
      '(Vercel / Lambda have a read-only filesystem). ' +
      'Use Firebase Admin SDK instead — set FIREBASE_SERVICE_ACCOUNT_JSON.',
    );
  }
  await ensureDir();
  const existing = (await readLocalConfig()) ?? {
    sessionSecret: crypto.randomBytes(32).toString('hex'),
  };

  const next: LocalConfig = {
    ...existing,
    ...patch,
    // Always preserve a session secret — never let a caller clobber it to undefined.
    sessionSecret: existing.sessionSecret || crypto.randomBytes(32).toString('hex'),
    // Deep-merge nested objects so partial updates work as expected.
    firebase:   { ...(existing.firebase ?? {}),   ...(patch.firebase ?? {}) },
    cloudinary: { ...(existing.cloudinary ?? {}), ...(patch.cloudinary ?? {}) },
  };

  await fs.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
