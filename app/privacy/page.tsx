/**
 * app/privacy/page.tsx
 * Privacy Policy — centered prose, 7 sections.
 * Spec ref: section 3 (Public pages)
 */

'use client';

import PublicLayout from '@/components/layouts/PublicLayout';

const SECTIONS = [
  {
    heading: '1. Information We Collect',
    body: `We collect information you provide directly to us when you create an account, list a product, place an order, or contact our support team. This includes your name, email address, phone number, and location. We also automatically collect certain technical information when you use our platform, such as your IP address, browser type, device identifiers, and pages visited. Payment information is collected by our PCI-compliant payment partners and is not stored on our servers.`,
  },
  {
    heading: '2. How We Use Your Information',
    body: `We use the information we collect to operate and improve the TradeCircle platform, process transactions, send transactional and promotional communications (with your consent), prevent fraud and abuse, personalise your experience, and comply with legal obligations. We may use aggregated, de-identified data for analytics and research purposes. We will never sell your personal information to third parties.`,
  },
  {
    heading: '3. Sharing of Information',
    body: `We share your information only in the following circumstances: with other users when you transact or communicate with them (e.g., sharing your name and listing details with a buyer); with trusted service providers who assist us in operating the platform (payment processors, cloud providers, email services); with law enforcement or regulatory bodies when required by law; and with a successor entity in the event of a merger or acquisition. All service providers are bound by confidentiality agreements and may only use your data to perform services on our behalf.`,
  },
  {
    heading: '4. Cookies and Tracking',
    body: `TradeCircle uses cookies and similar tracking technologies to remember your preferences, maintain your session, and improve platform performance. We use first-party cookies for authentication and preferences, and third-party cookies for analytics (e.g., Google Analytics). You can control cookie settings through your browser. Disabling certain cookies may affect platform functionality. We do not use cookies for cross-site tracking or targeted advertising without your explicit consent.`,
  },
  {
    heading: '5. Data Retention',
    body: `We retain your personal data for as long as your account is active or as necessary to provide you with our services. If you close your account, we will delete or anonymise your personal data within 90 days, except where we are required to retain it for legal, tax, or fraud-prevention purposes. Transaction records may be retained for up to 7 years in accordance with Australian financial regulations.`,
  },
  {
    heading: '6. Your Rights',
    body: `Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data; restrict or object to certain processing; request data portability; and withdraw consent at any time. To exercise these rights, contact us at privacy@tradecircle.com. We will respond within 30 days. If you are located in the EU or UK, you also have the right to lodge a complaint with your local data protection authority.`,
  },
  {
    heading: '7. Contact Us',
    body: `If you have questions about this Privacy Policy or our data practices, please contact our Privacy Officer at privacy@tradecircle.com or by post at TradeCircle Pty Ltd, Level 3, 123 Market Street, Sydney NSW 2000, Australia. We take all privacy concerns seriously and will respond promptly.`,
  },
];

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 96px' }}>

        <h1 style={{
          fontSize: 38, fontWeight: 800, color: 'var(--color-text)',
          marginBottom: 8, lineHeight: 1.15,
        }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 48 }}>
          Last updated: May 2026
        </p>

        <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: 40 }}>
          TradeCircle Pty Ltd ("we", "us", or "our") operates the TradeCircle marketplace platform. This Privacy Policy describes how we collect, use, disclose, and safeguard your personal information when you use our website, mobile application, and related services. Please read this policy carefully. By using TradeCircle, you agree to the practices described here.
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
