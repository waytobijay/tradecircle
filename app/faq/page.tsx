/**
 * app/faq/page.tsx
 * FAQ page — search filter, category tabs, accordion.
 * Spec ref: section 3 (Public pages)
 */

'use client';

import { useState, useMemo } from 'react';
import PublicLayout from '@/components/layouts/PublicLayout';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Data ─────────────────────────────────────────────────────────────────────

type FaqCategory = 'Account' | 'Buying' | 'Selling' | 'Payments' | 'Advisors';

interface Faq {
  id:       number;
  question: string;
  answer:   string;
  category: FaqCategory;
}

const FAQS: Faq[] = [
  {
    id: 1,
    category: 'Account',
    question: 'How do I create an account?',
    answer:
      'Click "Sign Up" on the homepage and choose your role — Buyer, Seller, or Advisor. Fill in your name, email, and password, then verify your email address to activate your account.',
  },
  {
    id: 2,
    category: 'Account',
    question: 'Can I change my role after signing up?',
    answer:
      'Yes. Go to Settings → Profile → Role to request a role change. Some roles (such as Advisor) require additional verification before they are approved by our team.',
  },
  {
    id: 3,
    category: 'Buying',
    question: 'How do I contact a seller?',
    answer:
      'Open any product listing and tap "Contact Seller". You will need a verified account to send a message. You can also submit an enquiry via the listing page without creating an account.',
  },
  {
    id: 4,
    category: 'Buying',
    question: 'Is it safe to buy on TradeCircle?',
    answer:
      'Yes. All transactions use industry-standard encryption. We verify sellers, display public ratings and reviews, and offer escrow-style payment flows for high-value items. Always review a seller\'s rating before purchasing.',
  },
  {
    id: 5,
    category: 'Buying',
    question: 'What payment methods are accepted?',
    answer:
      'We accept credit and debit cards via Stripe, eWAY bank transfers, eSewa, Khalti, and Fonepay depending on your region. Availability may vary based on the seller\'s location.',
  },
  {
    id: 6,
    category: 'Selling',
    question: 'How do I list a product?',
    answer:
      'Log in as a Seller and navigate to My Products → New Listing. Fill in the product name, category, description, price, condition, and photos, then click Publish. Your listing will go live immediately after basic moderation.',
  },
  {
    id: 7,
    category: 'Selling',
    question: 'How many photos can I add per product?',
    answer:
      'You can upload up to 5 photos per product listing. We recommend high-resolution images from multiple angles. Photos are automatically optimised for fast loading.',
  },
  {
    id: 8,
    category: 'Selling',
    question: 'Can I edit a listing after it has been published?',
    answer:
      'Yes. Open the listing in My Products and click Edit at any time. Changes go live immediately. Note that editing the price of a listing with active orders may require buyer confirmation.',
  },
  {
    id: 9,
    category: 'Payments',
    question: 'What currencies does TradeCircle support?',
    answer:
      'TradeCircle supports AUD, USD, NPR, and INR. Prices are displayed in your selected currency using live exchange rates. Payouts are made in the seller\'s base currency.',
  },
  {
    id: 10,
    category: 'Payments',
    question: 'Are payments secure?',
    answer:
      'All card and bank transactions are encrypted with TLS. We do not store card details — that is handled exclusively by our PCI-DSS compliant payment partners. You can also review transaction history in your dashboard.',
  },
  {
    id: 11,
    category: 'Advisors',
    question: 'What is a Trade Advisor?',
    answer:
      'Trade Advisors are verified experts — agribusiness consultants, import/export specialists, finance professionals — who publish guides, tips, and advisory posts on TradeCircle. Buyers can contact them directly through the platform.',
  },
];

const CATEGORIES: FaqCategory[] = ['Account', 'Buying', 'Selling', 'Payments', 'Advisors'];
const ALL_CAT = 'All';
type Tab = typeof ALL_CAT | FaqCategory;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FaqPage() {
  const [search,   setSearch]   = useState('');
  const [tab,      setTab]      = useState<Tab>(ALL_CAT);
  const [openId,   setOpenId]   = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return FAQS.filter((faq) => {
      const matchesTab = tab === ALL_CAT || faq.category === tab;
      const matchesSearch =
        !q ||
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [search, tab]);

  function toggle(id: number) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  const TABS: Tab[] = [ALL_CAT, ...CATEGORIES];

  return (
    <PublicLayout>
      <style>{`
        .faq-accordion-item {
          border: 1px solid var(--color-border);
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 10px;
          transition: box-shadow 0.15s;
        }
        .faq-accordion-item:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
        .faq-q-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; cursor: pointer; gap: 16px;
          background: var(--color-surface);
          user-select: none;
        }
        .faq-answer {
          padding: 14px 20px 18px;
          font-size: 14px; line-height: 1.75;
          color: var(--color-text-secondary);
          border-top: 1px solid var(--color-border);
          background: var(--color-background);
        }
      `}</style>

      <section style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 80px' }}>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 12px' }}>
            Frequently Asked Questions
          </h1>
          <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', margin: 0 }}>
            Find answers to the most common questions about TradeCircle.
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 28 }}>
          <Search
            size={17}
            style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-text-secondary)', pointerEvents: 'none',
            }}
          />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpenId(null); }}
            placeholder="Search FAQs…"
            style={{
              width: '100%', padding: '12px 14px 12px 42px', borderRadius: 10,
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text)',
              fontSize: 15, boxSizing: 'border-box', outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Category tabs */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12, padding: 6, width: 'fit-content',
        }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setOpenId(null); }}
              style={{
                padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: tab === t ? 'var(--color-primary)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* FAQ list */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-secondary)', fontSize: 15 }}>
            No FAQs match your search.
          </div>
        ) : (
          <div>
            {filtered.map((faq) => {
              const isOpen = openId === faq.id;
              return (
                <div key={faq.id} className="faq-accordion-item">
                  <div className="faq-q-row" onClick={() => toggle(faq.id)}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.4 }}>
                      {faq.question}
                    </span>
                    <span style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }}>
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="faq-answer">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Still need help? */}
        <div style={{
          marginTop: 48, textAlign: 'center', padding: '32px',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 14,
        }}>
          <p style={{ fontSize: 15, color: 'var(--color-text)', fontWeight: 600, marginBottom: 8 }}>
            Still have questions?
          </p>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Our support team is happy to help.
          </p>
          <a href="/contact" style={{
            display: 'inline-block', padding: '10px 24px', borderRadius: 8,
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            Contact Support
          </a>
        </div>

      </section>
    </PublicLayout>
  );
}
