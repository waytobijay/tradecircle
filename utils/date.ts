/**
 * utils/date.ts
 * Date and time formatting helpers for the TradeCircle platform.
 */

/**
 * Convert a Firestore Timestamp literal to a JS Date.
 */
export function fromTimestamp(ts: { seconds: number; nanoseconds: number }): Date {
  return new Date(ts.seconds * 1000 + ts.nanoseconds / 1_000_000);
}

function toDate(date: Date | number): Date {
  return date instanceof Date ? date : new Date(date);
}

/**
 * Returns a human-readable relative time string.
 * Examples: "just now", "5 minutes ago", "2 hours ago", "Yesterday", "3 days ago"
 */
export function timeAgo(date: Date | number): string {
  const now = Date.now();
  const d = toDate(date);
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

/**
 * Format a date as "15 May 2026".
 */
export function formatDate(date: Date | number): string {
  return toDate(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format a date as "15 May 2026, 10:30 AM".
 */
export function formatDateTime(date: Date | number): string {
  const d = toDate(date);
  const datePart = d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

/**
 * Format a date as an HTML date-input value: "2026-05-15".
 */
export function formatDateInput(date: Date | number): string {
  const d = toDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns a time-appropriate greeting.
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
