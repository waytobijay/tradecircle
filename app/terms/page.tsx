/**
 * app/terms/page.tsx
 * Terms & Conditions — centered prose, 9 sections.
 * Spec ref: section 3 (Public pages)
 */

'use client';

import PublicLayout from '@/components/layouts/PublicLayout';

const SECTIONS = [
  {
    heading: '1. Acceptance of Terms',
    body: `By accessing or using the TradeCircle platform, including our website, mobile applications, and related services (collectively the "Platform"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you must not use the Platform. We may update these Terms from time to time, and your continued use of the Platform constitutes acceptance of any changes. We will notify registered users of material changes by email or in-platform notification.`,
  },
  {
    heading: '2. Eligibility and Account Registration',
    body: `You must be at least 18 years of age to create an account and use the Platform. By registering, you represent that all information you provide is accurate, current, and complete. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must notify us immediately at security@tradecircle.com if you suspect unauthorised access to your account. We reserve the right to suspend or terminate accounts that violate these Terms.`,
  },
  {
    heading: '3. User Roles and Responsibilities',
    body: `TradeCircle supports three user roles: Buyers, Sellers, and Advisors. Buyers may browse and purchase products. Sellers may list, promote, and sell products and are solely responsible for the accuracy of their listings, including descriptions, pricing, availability, and compliance with applicable laws. Advisors may publish educational content and respond to enquiries. All users agree not to engage in fraudulent, deceptive, or misleading conduct, and to comply with all applicable local, national, and international laws.`,
  },
  {
    heading: '4. Listings and Content',
    body: `Sellers may not list items that are illegal, counterfeit, hazardous, or that infringe third-party intellectual property rights. TradeCircle reserves the right to remove any listing that violates these Terms or our Content Policy without notice. By posting content on the Platform (listings, reviews, advisory posts), you grant TradeCircle a non-exclusive, royalty-free, worldwide licence to use, display, and reproduce that content in connection with operating and promoting the Platform. You represent that you own or have the necessary rights to the content you post.`,
  },
  {
    heading: '5. Payments and Fees',
    body: `Transactions on TradeCircle are processed by third-party payment gateways including Stripe, eWAY, eSewa, Khalti, and Fonepay. TradeCircle may charge platform fees, listing fees, or commission on sales as set out in our current Fee Schedule, available in your account dashboard. All fees are inclusive of applicable taxes unless otherwise stated. We are not responsible for any additional fees charged by your bank or payment provider. Disputes regarding charges must be raised within 30 days of the transaction date.`,
  },
  {
    heading: '6. Prohibited Conduct',
    body: `You agree not to: (a) use the Platform for any unlawful purpose; (b) scrape, crawl, or systematically download Platform content; (c) attempt to circumvent security measures; (d) post false, misleading, or defamatory content; (e) harass, threaten, or intimidate other users; (f) use automated bots or scripts without our written consent; (g) engage in any conduct that could damage the reputation or operation of TradeCircle. Violations may result in immediate account suspension, legal action, or both.`,
  },
  {
    heading: '7. Limitation of Liability',
    body: `To the maximum extent permitted by law, TradeCircle and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the Platform. Our total liability to you for any claim arising under these Terms shall not exceed the total fees paid by you to TradeCircle in the 12 months preceding the event giving rise to the claim. Nothing in these Terms limits liability for fraud, personal injury caused by negligence, or any liability that cannot be excluded by law.`,
  },
  {
    heading: '8. Intellectual Property',
    body: `The TradeCircle name, logo, software, design, and all related intellectual property are owned by TradeCircle Pty Ltd and are protected by copyright, trademark, and other applicable laws. You may not copy, modify, distribute, sell, or lease any part of our Platform or software without our explicit written permission. Any feedback, suggestions, or ideas you provide about the Platform may be used by us without restriction or compensation to you.`,
  },
  {
    heading: '9. Governing Law and Dispute Resolution',
    body: `These Terms are governed by the laws of New South Wales, Australia, without regard to its conflict-of-law provisions. Any dispute arising from or in connection with these Terms shall first be attempted to be resolved through good-faith negotiation. If unresolved within 30 days, disputes shall be submitted to mediation in Sydney, Australia. If mediation fails, disputes shall be resolved in the courts of New South Wales. If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.`,
  },
];

export default function TermsPage() {
  return (
    <PublicLayout>
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 96px' }}>

        <h1 style={{
          fontSize: 38, fontWeight: 800, color: 'var(--color-text)',
          marginBottom: 8, lineHeight: 1.15,
        }}>
          Terms &amp; Conditions
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 48 }}>
          Last updated: May 2026
        </p>

        <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: 40 }}>
          These Terms and Conditions govern your use of the TradeCircle platform operated by TradeCircle Pty Ltd (ABN 12 345 678 901). Please read these Terms carefully before using the Platform. If you have any questions, contact us at legal@tradecircle.com.
        </p>

        <div>
          {SECTIONS.map((section) => (
            <div
              key={section.heading}
              style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: 32, marginBottom: 32,
              }}
            >
              <h2 style={{
                fontSize: 20, fontWeight: 700, color: 'var(--color-text)',
                marginBottom: 14, lineHeight: 1.3,
              }}>
                {section.heading}
              </h2>
              <p style={{
                fontSize: 15, color: 'var(--color-text-secondary)',
                lineHeight: 1.85, margin: 0,
              }}>
                {section.body}
              </p>
            </div>
          ))}
        </div>

      </section>
    </PublicLayout>
  );
}
