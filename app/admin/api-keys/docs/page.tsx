/**
 * app/admin/api-keys/docs/page.tsx
 * Phase 4 — TradeCircle API documentation.
 */

'use client';

import AdminLayout from '@/components/layouts/AdminLayout';

const CODE_BG = '#1e1e1e';
const CODE_FG = '#d4d4d4';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  scope?: string;
  description: string;
  example: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET', path: '/api/v1/products',
    scope: 'read-products',
    description: 'List products with pagination, filtering, and search.',
    example: `curl https://api.tradecircle.com/api/v1/products?limit=20&category=electronics \\
  -H "Authorization: Bearer tc_live_xxxxxxxx"`,
  },
  {
    method: 'GET', path: '/api/v1/products/:id',
    scope: 'read-products',
    description: 'Fetch a single product by ID.',
    example: `curl https://api.tradecircle.com/api/v1/products/abc123 \\
  -H "Authorization: Bearer tc_live_xxxxxxxx"`,
  },
  {
    method: 'POST', path: '/api/v1/products',
    scope: 'write-products',
    description: 'Create a new product listing.',
    example: `curl -X POST https://api.tradecircle.com/api/v1/products \\
  -H "Authorization: Bearer tc_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My Product","price":99,"currency":"AUD"}'`,
  },
  {
    method: 'GET', path: '/api/v1/orders',
    scope: 'read-orders',
    description: 'List orders for the authenticated account.',
    example: `curl https://api.tradecircle.com/api/v1/orders?status=pending \\
  -H "Authorization: Bearer tc_live_xxxxxxxx"`,
  },
  {
    method: 'GET', path: '/api/v1/users/:id',
    scope: 'read-users',
    description: 'Fetch a user profile by ID (public fields only).',
    example: `curl https://api.tradecircle.com/api/v1/users/uid_abc \\
  -H "Authorization: Bearer tc_live_xxxxxxxx"`,
  },
  {
    method: 'POST', path: '/api/v1/webhooks/subscribe',
    scope: 'webhooks',
    description: 'Subscribe a URL to receive webhook events.',
    example: `curl -X POST https://api.tradecircle.com/api/v1/webhooks/subscribe \\
  -H "Authorization: Bearer tc_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://yourapp.com/hook","events":["order.created"]}'`,
  },
];

const METHOD_COLORS: Record<string, { bg: string; color: string }> = {
  GET:    { bg: '#EFF6FF', color: '#1D4ED8' },
  POST:   { bg: '#F0FDF4', color: '#16A34A' },
  PUT:    { bg: '#FFF7ED', color: '#C2410C' },
  DELETE: { bg: '#FEF2F2', color: '#DC2626' },
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre style={{
      background: CODE_BG, color: CODE_FG,
      padding: 16, borderRadius: 8,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 12.5, lineHeight: 1.6,
      overflowX: 'auto', margin: '12px 0',
      whiteSpace: 'pre',
    }}>
      <code>{children}</code>
    </pre>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12, padding: 24, marginBottom: 20,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--color-text)' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function ApiDocsPage() {
  return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 960 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px', color: 'var(--color-text)' }}>
            TradeCircle API Documentation
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>
            REST API for products, orders, users, and webhook subscriptions. Base URL: <code style={{ fontFamily: 'monospace' }}>https://api.tradecircle.com</code>
          </p>
        </div>

        {/* Authentication */}
        <Section title="Authentication" id="auth">
          <p style={{ fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 8px' }}>
            All requests must include an <code style={{ fontFamily: 'monospace' }}>Authorization</code> header with a Bearer token containing your API key:
          </p>
          <CodeBlock>{`Authorization: Bearer tc_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</CodeBlock>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>
            Keys must have the required scope for each endpoint (e.g. <code style={{ fontFamily: 'monospace' }}>write-products</code> to create products). Revoked or expired keys return <code style={{ fontFamily: 'monospace' }}>401 Unauthorized</code>.
          </p>
        </Section>

        {/* Endpoints */}
        <Section title="Endpoints" id="endpoints">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {ENDPOINTS.map((ep) => {
              const c = METHOD_COLORS[ep.method];
              return (
                <div key={`${ep.method}-${ep.path}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      padding: '3px 10px', borderRadius: 6,
                      background: c.bg, color: c.color,
                    }}>{ep.method}</span>
                    <code style={{
                      fontFamily: 'monospace', fontSize: 14, fontWeight: 600,
                      color: 'var(--color-text)',
                    }}>{ep.path}</code>
                    {ep.scope && (
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        padding: '2px 7px', borderRadius: 9999,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }}>scope: {ep.scope}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>
                    {ep.description}
                  </p>
                  <CodeBlock>{ep.example}</CodeBlock>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Rate Limits */}
        <Section title="Rate Limits" id="rate-limits">
          <p style={{ fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 12px' }}>
            Rate limits are set per API key (10–1000 requests per minute, configured when you generate the key). The following headers are returned with every response:
          </p>
          <CodeBlock>{`X-RateLimit-Limit:     100
X-RateLimit-Remaining: 87
X-RateLimit-Reset:     1716000000`}</CodeBlock>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>
            Exceeding the limit returns <code style={{ fontFamily: 'monospace' }}>429 Too Many Requests</code>. Implement exponential backoff for retries.
          </p>
        </Section>

        {/* Webhooks */}
        <Section title="Webhooks" id="webhooks">
          <p style={{ fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 12px' }}>
            Subscribe to events to receive HTTP POST notifications. Supported events: <code style={{ fontFamily: 'monospace' }}>order.created</code>, <code style={{ fontFamily: 'monospace' }}>order.updated</code>, <code style={{ fontFamily: 'monospace' }}>product.created</code>, <code style={{ fontFamily: 'monospace' }}>user.registered</code>.
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text)', margin: '0 0 4px' }}>Example payload:</p>
          <CodeBlock>{`{
  "event": "order.created",
  "timestamp": "2026-05-16T10:30:00Z",
  "data": {
    "orderId": "ord_abc123",
    "amount": 199.00,
    "currency": "AUD"
  }
}`}</CodeBlock>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>
            Each request includes an <code style={{ fontFamily: 'monospace' }}>X-TC-Signature</code> header (HMAC-SHA256 of the body, using your webhook secret). Verify signatures to ensure authenticity.
          </p>
        </Section>

        {/* Code Examples */}
        <Section title="Code Examples" id="examples">
          <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: 'var(--color-text)' }}>
            cURL — list products
          </h4>
          <CodeBlock>{`curl -X GET "https://api.tradecircle.com/api/v1/products?limit=10" \\
  -H "Authorization: Bearer tc_live_xxxxxxxx" \\
  -H "Accept: application/json"`}</CodeBlock>

          <h4 style={{ fontSize: 13, fontWeight: 700, margin: '20px 0 8px', color: 'var(--color-text)' }}>
            JavaScript (fetch) — create a product
          </h4>
          <CodeBlock>{`const res = await fetch('https://api.tradecircle.com/api/v1/products', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.TC_API_KEY,
    'Content-Type':  'application/json',
  },
  body: JSON.stringify({
    name:     'Vintage Camera',
    price:    349.00,
    currency: 'AUD',
    category: 'electronics',
  }),
});

if (!res.ok) throw new Error('API error: ' + res.status);
const product = await res.json();
console.log('Created:', product.id);`}</CodeBlock>

          <h4 style={{ fontSize: 13, fontWeight: 700, margin: '20px 0 8px', color: 'var(--color-text)' }}>
            JavaScript — verify a webhook signature
          </h4>
          <CodeBlock>{`import crypto from 'node:crypto';

function verifySignature(rawBody, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature),
  );
}`}</CodeBlock>
        </Section>
      </div>
    </AdminLayout>
  );
}
