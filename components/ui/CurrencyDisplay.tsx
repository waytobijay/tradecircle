/**
 * components/ui/CurrencyDisplay.tsx
 * Formats a monetary amount using the platform's active currency.
 * Spec ref: section 8.5 (CurrencyDisplay component), section 5.3 (Currency Settings)
 *
 * Reads active currency from Firestore config/site on first mount (cached).
 * Format rules:
 *   AUD → A$1,200
 *   USD → $1,200
 *   NPR → रू1,200
 *   INR → ₹1,200
 *
 * Props:
 *  - amount    number   — raw value
 *  - currency  string   — override active currency (optional)
 *  - showCode  boolean  — append currency code, e.g. "A$1,200 AUD"
 */

'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc }         from 'firebase/firestore';
import { db }                  from '@/services/firebase';
import type { ProductCurrency } from '@/types';

// ─── Currency format helpers ──────────────────────────────────────────────────

const SYMBOL_MAP: Record<string, string> = {
  AUD: 'A$',
  USD: '$',
  NPR: 'रू',
  INR: '₹',
};

function formatAmount(amount: number, currency: string): string {
  const symbol  = SYMBOL_MAP[currency] ?? currency + ' ';
  const rounded = Math.abs(amount).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${rounded}`;
}

// ─── Module-level cache (avoids repeated Firestore reads per session) ─────────

let cachedCurrency: ProductCurrency | null = null;
let fetchPromise:   Promise<void>   | null = null;

async function fetchActiveCurrency(): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'config', 'site'));
    if (snap.exists()) {
      const active = snap.data()?.currency?.active as ProductCurrency | undefined;
      if (active) cachedCurrency = active;
    }
  } catch {
    // use fallback
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CurrencyDisplayProps {
  amount:     number;
  currency?:  string;  // explicit override — skips config read
  showCode?:  boolean;
  className?: string;
  style?:     React.CSSProperties;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CurrencyDisplay({
  amount,
  currency: currencyOverride,
  showCode  = false,
  className,
  style,
}: CurrencyDisplayProps) {
  const [activeCurrency, setActiveCurrency] = useState<string>(
    cachedCurrency ?? 'AUD',
  );

  useEffect(() => {
    // If caller passes explicit currency, skip config fetch
    if (currencyOverride) return;
    // Already cached
    if (cachedCurrency) { setActiveCurrency(cachedCurrency); return; }
    // Fetch once, shared across all instances
    if (!fetchPromise) fetchPromise = fetchActiveCurrency();
    void fetchPromise.then(() => {
      if (cachedCurrency) setActiveCurrency(cachedCurrency);
    });
  }, [currencyOverride]);

  const currency   = currencyOverride ?? activeCurrency;
  const formatted  = formatAmount(amount, currency);
  const display    = showCode ? `${formatted} ${currency}` : formatted;

  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
}
