/**
 * utils/currency.ts
 * Currency formatting and conversion helpers.
 */

export type SupportedCurrency = 'AUD' | 'USD' | 'NPR' | 'INR';

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  AUD: 'A$',
  USD: '$',
  NPR: 'रू',
  INR: '₹',
};

/**
 * Format a numeric amount as a localised currency string.
 * Example: formatCurrency(1299, 'AUD') → "A$ 1,299.00"
 */
export function formatCurrency(amount: number, currency: SupportedCurrency): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = amount.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}

/**
 * Convert an NPR amount to another supported currency using provided exchange rates.
 */
export function convertFromNPR(
  amountNPR: number,
  to: SupportedCurrency,
  rates: { nprToAud: number; nprToUsd: number },
): number {
  switch (to) {
    case 'AUD':
      return amountNPR * rates.nprToAud;
    case 'USD':
      return amountNPR * rates.nprToUsd;
    case 'NPR':
      return amountNPR;
    case 'INR':
      // Approximate: 1 NPR ≈ 0.6 INR — caller can override via rates extension if needed.
      return amountNPR * 0.6;
    default:
      return amountNPR;
  }
}

/**
 * Return the symbol for a given currency.
 */
export function getCurrencySymbol(currency: SupportedCurrency): string {
  return CURRENCY_SYMBOLS[currency];
}

/**
 * Parse a formatted currency string back to a plain number.
 * Strips currency symbols, spaces and commas before parsing.
 * Example: parseCurrencyString("A$ 1,299.00") → 1299
 */
export function parseCurrencyString(value: string): number {
  // Remove everything that is not a digit or decimal point
  const cleaned = value.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
