/**
 * store/uiStore.ts
 * Global UI state via Zustand.
 * Spec ref: section 4.3 (Settings — Appearance), section 8.6 (Dark/Light Mode)
 *
 * Usage:
 *   const { theme, toggleTheme } = useUiStore()
 *   const setSidebar = useUiStore((s) => s.setSidebar)
 *
 * Theme strategy (spec section 8.6):
 *   1. On first load, read from localStorage (user's saved preference).
 *   2. Fall back to OS prefers-color-scheme.
 *   3. Authenticated users sync preference to Firestore via useAuth hook.
 *   4. Admin CSS Editor overrides individual CSS variables at runtime
 *      via document.documentElement.style.setProperty — independent of theme.
 */

import { create } from 'zustand';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'tc-theme';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Reads the initial theme in this priority order:
 *   1. localStorage (user's explicit choice)
 *   2. OS prefers-color-scheme
 *   3. 'light' as final default
 * Safe to call on the server — returns 'light' if window is unavailable.
 */
function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Applies theme to the DOM and persists to localStorage.
 * Sets data-theme attribute on <html> — picked up by CSS variables
 * in globals.css ([data-theme="dark"] block).
 * Spec ref: section 8.6 + globals.css section 5
 */
function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

// ─────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────

interface UiState {
  /** Current colour theme. Drives [data-theme] on <html>. */
  theme: Theme;

  /** Controls the admin / mobile sidebar open state. */
  sidebarOpen: boolean;
}

// ─────────────────────────────────────────────
// Actions shape
// ─────────────────────────────────────────────

interface UiActions {
  /**
   * Toggles between light and dark.
   * Also updates document's data-theme attribute and saves to localStorage.
   */
  toggleTheme: () => void;

  /**
   * Set theme explicitly (e.g. when loading saved preference from Firestore
   * after a user signs in).
   */
  setTheme: (theme: Theme) => void;

  /**
   * Apply theme — alias for setTheme. Sets the data-theme attr + localStorage
   * + store value in one call. Used by AuthProvider on user-doc load.
   */
  applyTheme: (theme: Theme) => void;

  /** Open or close the sidebar. */
  setSidebar: (open: boolean) => void;

  /** Toggle the sidebar open state. */
  toggleSidebar: () => void;
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useUiStore = create<UiState & UiActions>((set, get) => ({
  // ── Initial state ──────────────────────────
  theme:       resolveInitialTheme(),
  sidebarOpen: false,

  // ── Actions ────────────────────────────────

  toggleTheme: () => {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    set({ theme: next });
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  applyTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  setSidebar: (open) => set({ sidebarOpen: open }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));

// Alias for compatibility — both casings are used across the codebase
export const useUIStore = useUiStore;
