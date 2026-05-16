/**
 * app/cookies/page.tsx
 * Cookie Policy — server component (no 'use client').
 * Spec ref: section 3 (Public pages)
 */

import PublicLayout from '@/components/layouts/PublicLayout';
import Link         from 'next/link';

// ─── Cookie table data ───────────────────────────────────────────────────────

interface CookieRow {
  name:     string;
  type:     'Essential' | 'Analytics' | 'Preference';
  purpose:  string;
  duration: string;
}

const COOKIES: CookieRow[] = [
  {
    name:     'tc-session',
    type:     'Essential',
    purpose:  'Maintains your authenticated session after sign-in.',
    duration: 'Session / 14 days (if "Remember me" is selected)',
  },
  {
    name:     'tc-role',
    type:     'Essential',
    purpose:  'Stores your account role (buyer, seller, or advisor) to serve the correct UI.',
    duration: 'Session / 14 days',
  },
  {
    name:     'tc-admin',
    type:     'Essential',
    purpose:  'Grants access to the admin portal for verified administrators.',
    duration: 'Session',
  },
  {
    name:     'tc-cart',
    type:     'Essential',
    purpose:  'Preserves your shopping cart between page loads.',
    duration: '30 days',
  },
  {
    name:     'tc-location',
    type:     'Preference',
    purpose:  'Remembers your last-used city/country for localised product results.',
    duration: '90 days',
  },
  {
    name:     'tc-theme',
    type:     'Preference',
    purpose:  'Stores your light/dark mode preference.',
    duration: '1 year',
  },
];

// ─── Type badge helper ───────────────────────────────────────────────────────

const TYPE_COLORS: Record<CookieRow['type'], string> = {
  Essential:  'var(--color-primary)',
  Analytics:  'var(--color-warning)',
  Preference: 'var(--color-success)',
};

// ─── Page component ──────────────────────────────────────────────────────────

export default function CookiesPage() {
  return (
    <PublicLayout>
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 96px' }}>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 32, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <Link href="/" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
            Home
          </Link>
          <span aria-hidden="true" style={{ color: 'var(--color-border)' }}>/</span>
          <span style={{ color: 'var(--color-text)' }}>Cookie Policy</span>
        </nav>

        {/* Page heading */}
        <h1 style={{
          fontSize: 38, fontWeight: 800, color: 'var(--color-text)',
          marginBottom: 8, lineHeight: 1.15,
        }}>
          Cookie Policy
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 48 }}>
          Last updated: May 2026
        </p>

        {/* ── Section 1: What are cookies? ─────────────────────────────────── */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>1. What Are Cookies?</h2>
          <p style={bodyStyle}>
            Cookies are small text files that a website places on your device when you visit. They
            allow the site to remember information about your visit — such as your preferred
            language, whether you are signed in, or items in your shopping cart — so you do not
            have to re-enter them on every page. Cookies are widely used to make websites work more
            efficiently and to provide a better browsing experience.
          </p>
          <p style={{ ...bodyStyle, marginTop: 12 }}>
            Cookies do not contain executable code and cannot carry viruses. They can only be read
            by the domain that set them. TradeCircle only uses cookies that are necessary for the
            platform to function correctly and to remember your preferences.
          </p>
        </div>

        {/* ── Section 2: How we use cookies (table) ───────────────────────── */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>2. How We Use Cookies</h2>
          <p style={{ ...bodyStyle, marginBottom: 20 }}>
            The table below describes each cookie we set, its purpose, and how long it remains on
            your device.
          </p>

          {/* Scrollable wrapper for narrow viewports */}
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--color-border)' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
            }}>
              <thead>
                <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                  {(['Name', 'Type', 'Purpose', 'Duration'] as const).map((col) => (
                    <th key={col} style={{
                      padding: '12px 14px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      whiteSpace: 'nowrap',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COOKIES.map((row, i) => (
                  <tr key={row.name} style={{
                    borderBottom: i < COOKIES.length - 1 ? '1px solid var(--color-border)' : 'none',
                    background: i % 2 === 0 ? 'var(--color-background)' : 'var(--color-surface)',
                  }}>
                    <td style={{ padding: '11px 14px', verticalAlign: 'top' }}>
                      <code style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '1px 6px',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                      }}>
                        {row.name}
                      </code>
                    </td>
                    <td style={{ padding: '11px 14px', verticalAlign: 'top' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: `${TYPE_COLORS[row.type]}20`,
                        color: TYPE_COLORS[row.type],
                        whiteSpace: 'nowrap',
                      }}>
                        {row.type}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, verticalAlign: 'top' }}>
                      {row.purpose}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      {row.duration}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 3: Essential vs analytics ───────────────────────────── */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>3. Essential vs. Analytics Cookies</h2>

          <h3 style={h3Style}>Essential cookies</h3>
          <p style={bodyStyle}>
            Essential cookies are necessary for the platform to function. Without them, you would
            not be able to sign in, add items to your cart, or access protected pages. These
            cookies do not collect personal information for marketing purposes and cannot be
            disabled while you use TradeCircle.
          </p>

          <h3 style={{ ...h3Style, marginTop: 16 }}>Analytics cookies</h3>
          <p style={bodyStyle}>
            Analytics cookies help us understand how visitors interact with the platform by
            collecting anonymised, aggregated data — such as which pages are most visited and
            how users navigate between them. TradeCircle currently uses only first-party analytics
            and does not share this data with advertising networks. You can opt out of analytics
            at any time via your browser settings or the controls described in section 4.
          </p>
        </div>

        {/* ── Section 4: How to control cookies ───────────────────────────── */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>4. How to Control Cookies</h2>
          <p style={bodyStyle}>
            Most web browsers allow you to view, manage, delete, and block cookies. Please note
            that deleting or blocking essential cookies will affect your ability to use certain
            features of TradeCircle, including signing in.
          </p>
          <ul style={{ paddingLeft: 20, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { browser: 'Google Chrome', href: 'https://support.google.com/chrome/answer/95647' },
              { browser: 'Mozilla Firefox', href: 'https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer' },
              { browser: 'Safari', href: 'https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac' },
              { browser: 'Microsoft Edge', href: 'https://support.microsoft.com/en-us/windows/manage-cookies-in-microsoft-edge-168dab11-0753-043d-7c16-ede5947fc64d' },
            ].map(({ browser, href }) => (
              <li key={browser} style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                >
                  {browser} — cookie settings guide
                </a>
              </li>
            ))}
          </ul>
          <p style={{ ...bodyStyle, marginTop: 14 }}>
            You may also visit{' '}
            <a
              href="https://www.aboutcookies.org"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
            >
              aboutcookies.org
            </a>{' '}
            for browser-independent guidance on managing cookies across all major browsers.
          </p>
        </div>

        {/* ── Section 5: Contact us ────────────────────────────────────────── */}
        <div style={{ ...sectionStyle, borderBottom: 'none', marginBottom: 0 }}>
          <h2 style={h2Style}>5. Contact Us</h2>
          <p style={bodyStyle}>
            If you have any questions about our use of cookies or this Cookie Policy, please get in
            touch with our Privacy team. We are happy to help.
          </p>
          <p style={{ ...bodyStyle, marginTop: 12 }}>
            <Link
              href="/contact"
              style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '10px 22px',
                background: 'var(--color-primary)',
                color: '#fff',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Contact Us
            </Link>
          </p>
        </div>

      </section>
    </PublicLayout>
  );
}

// ─── Shared style objects ────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  borderTop:    '1px solid var(--color-border)',
  paddingTop:   32,
  marginBottom: 32,
};

const h2Style: React.CSSProperties = {
  fontSize:     22,
  fontWeight:   700,
  color:        'var(--color-text)',
  marginBottom: 14,
  lineHeight:   1.3,
};

const h3Style: React.CSSProperties = {
  fontSize:     16,
  fontWeight:   600,
  color:        'var(--color-text)',
  marginBottom: 8,
  lineHeight:   1.3,
};

const bodyStyle: React.CSSProperties = {
  fontSize:   15,
  color:      'var(--color-text-secondary)',
  lineHeight: 1.85,
  margin:     0,
};
