/**
 * services/invoice.ts
 * Invoice PDF generator using browser's native print/PDF capabilities.
 * No external library required.
 */

import type { Order, ProductImage } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceData {
  order: Order;
  product: { name: string; images: ProductImage[] };
  seller: { name: string; email: string; brand?: string };
  buyer: { name: string; email: string };
  companyName: string;  // from SiteConfig.branding
  logoUrl?: string;
}

// ─── Currency helpers ─────────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<string, string> = {
  AUD: 'A$',
  USD: '$',
  NPR: 'रू',
  INR: '₹',
};

const GATEWAY_LABEL: Record<string, string> = {
  stripe:           'Stripe / Google Pay',
  eway:             'eWAY',
  esewa:            'eSewa',
  khalti:           'Khalti',
  fonepay:          'Fonepay QR',
  'contact-seller': 'Contact Seller',
};

// ─── generateInvoiceHTML ──────────────────────────────────────────────────────

/** Generate an invoice as a complete HTML string (for iframe preview or printing). */
export function generateInvoiceHTML(data: InvoiceData): string {
  const { order, product, seller, buyer, companyName, logoUrl } = data;

  const symbol  = CURRENCY_SYMBOL[order.currency] ?? order.currency;
  const orderId = order.id.slice(-8).toUpperCase();
  const date    = order.createdAt
    ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('en-AU', { dateStyle: 'long' })
    : 'N/A';

  const unitPrice  = order.amount - (order.taxAmount ?? 0);
  const taxRow     = (order.taxAmount ?? 0) > 0
    ? `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">Tax (${order.taxRate ?? 0}%)</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">—</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">—</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${symbol} ${(order.taxAmount ?? 0).toFixed(2)}</td>
      </tr>`
    : '';

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="height:40px;object-fit:contain;margin-bottom:4px;" />`
    : `<div style="font-size:24px;font-weight:800;color:#111;">${companyName}</div>`;

  const addressLines = [
    order.address.street,
    `${order.address.city}, ${order.address.state} ${order.address.postcode}`,
    order.address.country,
  ].filter(Boolean).join('<br/>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice #${orderId} — ${companyName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #111;
      background: #fff;
      padding: 48px;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 36px;
      padding-bottom: 24px;
      border-bottom: 2px solid #111;
    }
    .invoice-meta { text-align: right; }
    .invoice-title {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #111;
      margin-bottom: 4px;
    }
    .order-id { font-size: 14px; color: #555; }
    .label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #888;
      margin-bottom: 4px;
    }
    .value { font-weight: 600; font-size: 14px; color: #111; }
    .section-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 32px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    thead th {
      background: #f4f4f4;
      padding: 10px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #555;
      border-bottom: 2px solid #ddd;
    }
    thead th:not(:first-child) { text-align: right; }
    thead th:nth-child(2) { text-align: center; }
    tbody td { color: #333; vertical-align: middle; }
    .total-row td {
      font-weight: 800;
      font-size: 15px;
      color: #111;
      padding: 14px 12px;
      border-top: 2px solid #111;
    }
    .payment-row {
      margin-bottom: 32px;
      padding: 12px;
      background: #f9f9f9;
      border-left: 3px solid #111;
      font-size: 13px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #888;
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>
      ${logoHtml}
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div class="order-id">Order #${orderId}</div>
      <div style="margin-top:12px;">
        <div class="label">Date</div>
        <div class="value">${date}</div>
      </div>
    </div>
  </div>

  <!-- Bill To / From -->
  <div class="section-grid">
    <div>
      <div class="label">Bill To</div>
      <div class="value">${buyer.name}</div>
      <div style="margin-top:4px;color:#555;">
        ${buyer.email}<br/>
        ${addressLines}
      </div>
    </div>
    <div>
      <div class="label">From</div>
      <div class="value">${seller.brand ?? seller.name}</div>
      <div style="margin-top:4px;color:#555;">
        ${seller.name}<br/>
        ${seller.email}
      </div>
    </div>
  </div>

  <!-- Line item table -->
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${product.name}</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center;">1</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">${symbol} ${unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">${symbol} ${unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
      ${taxRow}
      <tr class="total-row">
        <td colspan="3" style="text-align:right;padding:14px 12px;border-top:2px solid #111;">Grand Total</td>
        <td style="text-align:right;padding:14px 12px;border-top:2px solid #111;">${symbol} ${order.amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>

  <!-- Payment method -->
  <div class="payment-row">
    <strong>Payment Method:</strong> ${GATEWAY_LABEL[order.gateway] ?? order.gateway}
  </div>

  <!-- Footer -->
  <div class="footer">
    Thank you for your order. Questions? Contact us at <strong>${seller.email}</strong>
  </div>

</body>
</html>`;
}

// ─── printInvoice ─────────────────────────────────────────────────────────────

/**
 * Open a print-ready invoice in a hidden iframe and trigger window.print().
 * The browser will prompt the user to save as PDF.
 */
export function printInvoice(data: InvoiceData): void {
  const html   = generateInvoiceHTML(data);
  const iframe = document.createElement('iframe');

  iframe.style.position = 'fixed';
  iframe.style.top      = '-9999px';
  iframe.style.left     = '-9999px';
  iframe.style.width    = '0';
  iframe.style.height   = '0';
  iframe.style.border   = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }

  // Give the iframe time to render before printing
  iframe.onload = () => {
    try {
      iframe.contentWindow?.print();
    } catch {
      // Fallback: open in a new window
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    }
    // Remove the iframe after the print dialog has appeared
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  };

  // Trigger load for same-origin iframes written with srcdoc
  if (!iframe.src) {
    iframe.dispatchEvent(new Event('load'));
  }
}
