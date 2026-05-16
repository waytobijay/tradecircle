/**
 * app/checkout/page.tsx
 * Multi-step checkout flow.
 * Spec ref: section 5.2 (Checkout Flow)
 *
 * Step 1 — Contact Information (RHF + Zod)
 * Step 2 — Payment Method Selection (gateways from Firestore config/payments)
 * Step 3 — Order Confirmation / Success screen
 *
 * On gateway selection:
 *   contact-seller → redirect to /messages?uid={sellerId}
 *   stripe         → open Payment Link in new tab (from config)
 *   eway / esewa / khalti → redirect to hosted page URL (from config)
 *   fonepay        → show merchant QR image (from config)
 *
 * Firestore order doc created before redirecting / on confirmation.
 * Cart cleared after successful order creation.
 */

'use client';

import { useEffect, useState } from 'react';
import Link                    from 'next/link';
import { useRouter }           from 'next/navigation';
import { useForm }             from 'react-hook-form';
import { zodResolver }         from '@hookform/resolvers/zod';
import { z }                   from 'zod';
import {
  Check,
  ChevronRight,
  Loader2,
  ShoppingBag,
  CreditCard,
  MessageSquare,
  Smartphone,
  QrCode,
  ArrowLeft,
  Package,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db }            from '@/services/firebase';
import { useAuthStore }  from '@/store/authStore';
import { useCartStore }  from '@/store/cartStore';
import type { CartItem } from '@/store/cartStore';
import type { PaymentGateway, ProductCurrency } from '@/types';
import BuyerLayout       from '@/components/layouts/BuyerLayout';
import SellerLayout      from '@/components/layouts/SellerLayout';
import AdvisorLayout     from '@/components/layouts/AdvisorLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GatewayConfig {
  enabled:     boolean;
  label:       string;
  description: string;
  paymentLink?: string;  // Stripe
  hostedUrl?:  string;   // eWAY / eSewa / Khalti
  qrUrl?:      string;   // Fonepay
  merchantCode?: string; // eSewa / Khalti
}

interface PaymentsConfig {
  stripe:         GatewayConfig;
  eway:           GatewayConfig;
  esewa:          GatewayConfig;
  khalti:         GatewayConfig;
  fonepay:        GatewayConfig;
  contactSeller:  GatewayConfig;
}

const CURRENCY_SYMBOL: Record<ProductCurrency, string> = {
  AUD: 'A$',
  USD: '$',
  NPR: 'रू',
  INR: '₹',
};

// ─── Zod schema ───────────────────────────────────────────────────────────────

const contactSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone:    z.string().min(6, 'Phone number is required'),
  email:    z.string().email('Valid email is required'),
  street:   z.string().min(3, 'Street address is required'),
  city:     z.string().min(2, 'City is required'),
  state:    z.string().min(1, 'State / Province is required'),
  postcode: z.string().min(2, 'Postcode is required'),
  country:  z.string().min(2, 'Country is required'),
  notes:    z.string().optional(),
});

type ContactForm = z.infer<typeof contactSchema>;

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Contact', 'Payment', 'Confirmation'] as const;

function StepIndicator({ current }: { current: 0 | 1 | 2 }) {
  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            0,
        marginBottom:   'var(--space-8)',
      }}
    >
      {STEPS.map((label, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
          {/* Circle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
            <div
              style={{
                width:          36,
                height:         36,
                borderRadius:   '50%',
                background:     i < current
                  ? 'var(--color-primary)'
                  : i === current
                  ? 'var(--color-primary)'
                  : 'var(--color-surface-2)',
                border:         `2px solid ${i <= current ? 'var(--color-primary)' : 'var(--color-border)'}`,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                color:          i <= current ? '#fff' : 'var(--color-text-3)',
                fontWeight:     700,
                fontSize:       'var(--text-sm)',
                transition:     'background 0.3s, border-color 0.3s',
              }}
            >
              {i < current ? <Check size={16} /> : i + 1}
            </div>
            <span
              style={{
                fontSize:   'var(--text-xs)',
                fontWeight: i === current ? 700 : 500,
                color:      i === current ? 'var(--color-primary)' : 'var(--color-text-3)',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </div>

          {/* Connector */}
          {i < STEPS.length - 1 && (
            <div
              style={{
                width:      60,
                height:     2,
                background: i < current ? 'var(--color-primary)' : 'var(--color-border)',
                margin:     '0 var(--space-1)',
                marginBottom: 20,
                transition: 'background 0.3s',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Field component ──────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width:        '100%',
  padding:      'var(--space-2) var(--space-3)',
  background:   'var(--color-surface-2)',
  border:       '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color:        'var(--color-text)',
  fontSize:     'var(--text-sm)',
  outline:      'none',
  boxSizing:    'border-box',
  transition:   'border-color 0.15s',
};

function Field({
  label,
  required,
  error,
  children,
}: {
  label:    string;
  required?: boolean;
  error?:   string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-2)' }}>
        {label}{required && <span style={{ color: 'var(--color-error, #ef4444)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {error && <p style={{ margin: '4px 0 0', color: 'var(--color-error, #ef4444)', fontSize: 'var(--text-xs)' }}>{error}</p>}
    </div>
  );
}

// ─── Step 1: Contact form ─────────────────────────────────────────────────────

function ContactStep({
  user,
  onNext,
}: {
  user:   { displayName?: string | null; email?: string | null; phone?: string };
  onNext: (data: ContactForm) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ContactForm>({
    resolver:     zodResolver(contactSchema),
    defaultValues: {
      fullName: user.displayName ?? '',
      email:    user.email ?? '',
      phone:    user.phone ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)}>
      <h2 style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)' }}>
        Contact Information
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Row: name + phone */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Field label="Full Name" required error={errors.fullName?.message}>
            <input {...register('fullName')} style={INPUT_STYLE} />
          </Field>
          <Field label="Phone Number" required error={errors.phone?.message}>
            <input {...register('phone')} type="tel" style={INPUT_STYLE} placeholder="+1 234 567 8900" />
          </Field>
        </div>

        <Field label="Email Address" required error={errors.email?.message}>
          <input {...register('email')} type="email" style={INPUT_STYLE} />
        </Field>

        {/* Delivery address */}
        <div
          style={{
            background:   'var(--color-surface-2)',
            borderRadius: 'var(--radius-lg)',
            padding:      'var(--space-4)',
          }}
        >
          <p style={{ margin: '0 0 var(--space-3)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Delivery Address
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Field label="Street Address" required error={errors.street?.message}>
              <input {...register('street')} style={INPUT_STYLE} placeholder="123 Example Street" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Field label="City" required error={errors.city?.message}>
                <input {...register('city')} style={INPUT_STYLE} />
              </Field>
              <Field label="State / Province" required error={errors.state?.message}>
                <input {...register('state')} style={INPUT_STYLE} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Field label="Postcode" required error={errors.postcode?.message}>
                <input {...register('postcode')} style={INPUT_STYLE} />
              </Field>
              <Field label="Country" required error={errors.country?.message}>
                <input {...register('country')} style={INPUT_STYLE} />
              </Field>
            </div>
          </div>
        </div>

        {/* Notes */}
        <Field label="Order Notes" error={errors.notes?.message}>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Special instructions, delivery preferences…"
            style={{ ...INPUT_STYLE, resize: 'vertical' }}
          />
        </Field>
      </div>

      <button
        type="submit"
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            'var(--space-2)',
          marginTop:      'var(--space-6)',
          padding:        'var(--space-3) var(--space-6)',
          background:     'var(--color-primary)',
          color:          '#fff',
          border:         'none',
          borderRadius:   'var(--radius-md)',
          fontWeight:     700,
          fontSize:       'var(--text-base)',
          cursor:         'pointer',
          transition:     'opacity 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        Continue to Payment <ChevronRight size={18} />
      </button>
    </form>
  );
}

// ─── Gateway card ─────────────────────────────────────────────────────────────

interface GatewayCardProps {
  id:          PaymentGateway;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  selected:    boolean;
  onClick:     () => void;
}

function GatewayCard({ id, label, description, icon, selected, onClick }: GatewayCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          'var(--space-4)',
        padding:      'var(--space-4)',
        background:   selected ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'var(--color-surface)',
        border:       `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-lg)',
        cursor:       'pointer',
        textAlign:    'left',
        width:        '100%',
        transition:   'border-color 0.18s, background 0.18s',
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)';
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
      }}
    >
      <div
        style={{
          width:          48,
          height:         48,
          borderRadius:   'var(--radius-md)',
          background:     'color-mix(in srgb, var(--color-primary) 12%, transparent)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          'var(--color-primary)',
          flexShrink:     0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          {label}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-2)' }}>
          {description}
        </p>
      </div>
      <div
        style={{
          width:        20,
          height:       20,
          borderRadius: '50%',
          border:       `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
          background:   selected ? 'var(--color-primary)' : 'transparent',
          flexShrink:   0,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
        }}
      >
        {selected && <Check size={12} color="#fff" />}
      </div>
    </button>
  );
}

// ─── Step 2: Payment selection ────────────────────────────────────────────────

function PaymentStep({
  config,
  items,
  total,
  taxAmount,
  symbol,
  currency,
  onBack,
  onConfirm,
  confirming,
}: {
  config:     PaymentsConfig;
  items:      CartItem[];
  total:      number;
  taxAmount:  number;
  symbol:     string;
  currency:   ProductCurrency;
  onBack:     () => void;
  onConfirm:  (gateway: PaymentGateway) => void;
  confirming: boolean;
}) {
  const [selected, setSelected] = useState<PaymentGateway | null>(null);

  const GATEWAY_META: {
    id:   PaymentGateway;
    key:  keyof PaymentsConfig;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'contact-seller', key: 'contactSeller',
      label: 'Contact Seller', desc: 'Prefer to arrange directly? No payment needed.',
      icon: <MessageSquare size={22} />,
    },
    {
      id: 'stripe', key: 'stripe',
      label: 'Stripe / Google Pay', desc: 'Secure international card payment.',
      icon: <CreditCard size={22} />,
    },
    {
      id: 'eway', key: 'eway',
      label: 'eWAY (AUS/NZ)', desc: 'Accepted: Visa, Mastercard, AMEX.',
      icon: <CreditCard size={22} />,
    },
    {
      id: 'fonepay', key: 'fonepay',
      label: 'Fonepay QR', desc: 'Scan merchant QR in the Fonepay app.',
      icon: <QrCode size={22} />,
    },
    {
      id: 'esewa', key: 'esewa',
      label: 'eSewa', desc: 'Nepal\'s leading digital wallet.',
      icon: <Smartphone size={22} />,
    },
    {
      id: 'khalti', key: 'khalti',
      label: 'Khalti', desc: 'Pay via Khalti digital wallet.',
      icon: <Smartphone size={22} />,
    },
  ];

  const activeGateways = GATEWAY_META.filter((g) => config[g.key]?.enabled);

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display:     'inline-flex',
          alignItems:  'center',
          gap:         'var(--space-1)',
          background:  'none',
          border:      'none',
          color:       'var(--color-text-2)',
          cursor:      'pointer',
          fontSize:    'var(--text-sm)',
          padding:     '0 0 var(--space-4)',
        }}
      >
        <ArrowLeft size={15} /> Back
      </button>

      <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)' }}>
        Select Payment Method
      </h2>
      <p style={{ margin: '0 0 var(--space-5)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
        Total due: <strong style={{ color: 'var(--color-primary)' }}>{symbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
      </p>

      {/* Gateway cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        {activeGateways.length === 0 ? (
          <p style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
            No payment methods are currently available. Please contact the seller directly.
          </p>
        ) : (
          activeGateways.map((g) => (
            <GatewayCard
              key={g.id}
              id={g.id}
              label={g.label}
              description={g.desc}
              icon={g.icon}
              selected={selected === g.id}
              onClick={() => setSelected(g.id)}
            />
          ))
        )}
      </div>

      {/* Order mini-summary */}
      <div
        style={{
          background:   'var(--color-surface-2)',
          borderRadius: 'var(--radius-lg)',
          padding:      'var(--space-4)',
          marginBottom: 'var(--space-5)',
          display:      'flex',
          flexDirection: 'column',
          gap:          'var(--space-2)',
        }}
      >
        <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          {items.length} item{items.length !== 1 ? 's' : ''} · {currency}
        </p>
        {items.map((item) => (
          <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-2)' }}>
            <span>{item.name} ×{item.quantity}</span>
            <span>{symbol} {(item.price * item.quantity).toLocaleString()}</span>
          </div>
        ))}
        {taxAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-1)' }}>
            <span>Tax</span>
            <span>{symbol} {taxAmount.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
          <span>Total</span>
          <span style={{ color: 'var(--color-primary)' }}>{symbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <button
        onClick={() => selected && onConfirm(selected)}
        disabled={!selected || confirming}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            'var(--space-2)',
          padding:        'var(--space-3) var(--space-6)',
          background:     'var(--color-primary)',
          color:          '#fff',
          border:         'none',
          borderRadius:   'var(--radius-md)',
          fontWeight:     700,
          fontSize:       'var(--text-base)',
          cursor:         !selected || confirming ? 'not-allowed' : 'pointer',
          opacity:        !selected || confirming ? 0.6 : 1,
          transition:     'opacity 0.15s',
        }}
        onMouseEnter={(e) => {
          if (selected && !confirming) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
        }}
        onMouseLeave={(e) => {
          if (selected && !confirming) (e.currentTarget as HTMLButtonElement).style.opacity = '1';
        }}
      >
        {confirming ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : null}
        {confirming ? 'Placing Order…' : 'Confirm Order'}
        {!confirming && <ChevronRight size={18} />}
      </button>
    </div>
  );
}

// ─── Step 3: Confirmation ─────────────────────────────────────────────────────

function ConfirmationStep({
  orderId,
  items,
  total,
  symbol,
  gateway,
  gatewayConfig,
  sellerId,
}: {
  orderId:       string;
  items:         CartItem[];
  total:         number;
  symbol:        string;
  gateway:       PaymentGateway;
  gatewayConfig: PaymentsConfig;
  sellerId:      string;
}) {
  const router = useRouter();

  // Handle gateway-specific redirects
  useEffect(() => {
    if (gateway === 'contact-seller') {
      // Show contact seller info — no auto-redirect
      return;
    }

    const cfg =
      gateway === 'stripe' ? gatewayConfig.stripe :
      gateway === 'eway'   ? gatewayConfig.eway   :
      gateway === 'esewa'  ? gatewayConfig.esewa  :
      gateway === 'khalti' ? gatewayConfig.khalti :
      null;

    if (cfg?.paymentLink || cfg?.hostedUrl) {
      const url = cfg.paymentLink ?? cfg.hostedUrl ?? '';
      if (url) window.open(url, '_blank');
    }
  }, [gateway, gatewayConfig]);

  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
      {/* Success icon */}
      <div
        style={{
          width:          80,
          height:         80,
          borderRadius:   '50%',
          background:     'color-mix(in srgb, var(--color-success, #10b981) 15%, transparent)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          margin:         '0 auto var(--space-5)',
        }}
      >
        {gateway === 'fonepay' ? (
          <QrCode size={36} style={{ color: 'var(--color-success, #10b981)' }} />
        ) : (
          <Check size={36} style={{ color: 'var(--color-success, #10b981)' }} />
        )}
      </div>

      <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text)' }}>
        {gateway === 'contact-seller' ? 'Request Sent!' : 'Order Placed!'}
      </h2>
      <p style={{ margin: '0 0 var(--space-1)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
        Order <strong style={{ color: 'var(--color-text)' }}>#{orderId.slice(-8).toUpperCase()}</strong>
      </p>
      <p style={{ margin: '0 0 var(--space-6)', color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
        A confirmation has been noted. The seller will be in touch shortly.
      </p>

      {/* Fonepay QR */}
      {gateway === 'fonepay' && gatewayConfig.fonepay?.qrUrl && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <p style={{ margin: '0 0 var(--space-3)', fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
            Scan this QR code in your Fonepay app to complete payment:
          </p>
          <img
            src={gatewayConfig.fonepay.qrUrl}
            alt="Fonepay QR"
            style={{
              width:        200,
              height:       200,
              borderRadius: 'var(--radius-lg)',
              border:       '1px solid var(--color-border)',
              display:      'block',
              margin:       '0 auto',
            }}
          />
          <p style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
            Amount: <strong>{symbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </p>
        </div>
      )}

      {/* Contact seller prompt */}
      {gateway === 'contact-seller' && (
        <div
          style={{
            background:   'var(--color-surface-2)',
            borderRadius: 'var(--radius-lg)',
            padding:      'var(--space-4)',
            marginBottom: 'var(--space-6)',
            maxWidth:     400,
            margin:       '0 auto var(--space-6)',
          }}
        >
          <p style={{ margin: '0 0 var(--space-3)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
            Your order details have been saved. Message the seller to arrange payment and delivery.
          </p>
          <Link
            href={`/messages?uid=${sellerId}`}
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            'var(--space-2)',
              padding:        'var(--space-2) var(--space-4)',
              background:     'var(--color-primary)',
              color:          '#fff',
              borderRadius:   'var(--radius-md)',
              fontWeight:     700,
              fontSize:       'var(--text-sm)',
              textDecoration: 'none',
            }}
          >
            <MessageSquare size={15} /> Message Seller
          </Link>
        </div>
      )}

      {/* Product summary */}
      <div
        style={{
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding:      'var(--space-4)',
          maxWidth:     480,
          margin:       '0 auto var(--space-6)',
          textAlign:    'left',
        }}
      >
        <p style={{ margin: '0 0 var(--space-3)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Package size={16} style={{ color: 'var(--color-primary)' }} /> Items ordered
        </p>
        {items.map((item) => (
          <div
            key={item.productId}
            style={{
              display:      'flex',
              gap:          'var(--space-3)',
              alignItems:   'center',
              padding:      'var(--space-2) 0',
              borderTop:    '1px solid var(--color-border)',
            }}
          >
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.name}
                style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
                Qty: {item.quantity}
              </p>
            </div>
            <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--color-primary)', flexShrink: 0 }}>
              {symbol} {(item.price * item.quantity).toLocaleString()}
            </span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-1)', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          <span>Total paid</span>
          <span style={{ color: 'var(--color-primary)' }}>{symbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href="/orders"
          style={{
            padding:        'var(--space-2) var(--space-5)',
            background:     'var(--color-surface)',
            border:         '1px solid var(--color-border)',
            borderRadius:   'var(--radius-md)',
            color:          'var(--color-text)',
            fontWeight:     600,
            fontSize:       'var(--text-sm)',
            textDecoration: 'none',
          }}
        >
          View My Orders
        </Link>
        <Link
          href="/search"
          style={{
            padding:        'var(--space-2) var(--space-5)',
            background:     'var(--color-primary)',
            borderRadius:   'var(--radius-md)',
            color:          '#fff',
            fontWeight:     600,
            fontSize:       'var(--text-sm)',
            textDecoration: 'none',
          }}
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_PAYMENTS: PaymentsConfig = {
  stripe:        { enabled: true,  label: 'Stripe',          description: '' },
  eway:          { enabled: false, label: 'eWAY',            description: '' },
  esewa:         { enabled: false, label: 'eSewa',           description: '' },
  khalti:        { enabled: false, label: 'Khalti',          description: '' },
  fonepay:       { enabled: false, label: 'Fonepay',         description: '' },
  contactSeller: { enabled: true,  label: 'Contact Seller',  description: '' },
};

export default function CheckoutPage() {
  const user        = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const router      = useRouter();

  const items          = useCartStore((s) => s.items);
  const getTotalPrice  = useCartStore((s) => s.getTotalPrice);
  const storeCurrency  = useCartStore((s) => s.currency);
  const clearCart      = useCartStore((s) => s.clearCart);

  const [step, setStep]             = useState<0 | 1 | 2>(0);
  const [contactData, setContactData] = useState<ContactForm | null>(null);
  const [paymentsConfig, setPaymentsConfig] = useState<PaymentsConfig>(DEFAULT_PAYMENTS);
  const [taxRate, setTaxRate]       = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [orderId, setOrderId]       = useState('');
  const [gateway, setGateway]       = useState<PaymentGateway>('contact-seller');

  // Load payments config + tax rate
  useEffect(() => {
    async function loadConfig() {
      try {
        const [siteSnap, paymentsSnap] = await Promise.all([
          getDoc(doc(db, 'config', 'site')),
          getDoc(doc(db, 'config', 'payments')),
        ]);
        if (siteSnap.exists() && siteSnap.data().taxRate != null) {
          setTaxRate(Number(siteSnap.data().taxRate));
        }
        if (paymentsSnap.exists()) {
          setPaymentsConfig({ ...DEFAULT_PAYMENTS, ...paymentsSnap.data() } as PaymentsConfig);
        }
      } catch {
        /* keep defaults */
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && items.length === 0 && step === 0) {
      router.replace('/cart');
    }
  }, [authLoading, user, items.length, step, router]);

  if (authLoading || !user) return null;

  const subtotal  = getTotalPrice();
  const taxAmount = subtotal * (taxRate / 100);
  const total     = subtotal + taxAmount;
  const symbol    = (CURRENCY_SYMBOL as Record<string, string>)[storeCurrency] ?? storeCurrency;
  const sellerId  = items[0]?.sellerId ?? '';

  // Proceed from step 1 → 2
  function handleContactNext(data: ContactForm) {
    setContactData(data);
    setStep(1);
  }

  // Confirm order (step 2 → 3)
  async function handleConfirm(selectedGateway: PaymentGateway) {
    if (!contactData || !user) return;
    setConfirming(true);
    setGateway(selectedGateway);

    try {
      const orderRef = await addDoc(collection(db, 'orders'), {
        buyerId:   user.uid,
        sellerId,
        items:     items.map((i) => ({
          productId:  i.productId,
          name:       i.name,
          price:      i.price,
          quantity:   i.quantity,
          imageUrl:   i.imageUrl,
        })),
        fullName:  contactData.fullName,
        phone:     contactData.phone,
        email:     contactData.email,
        address: {
          street:   contactData.street,
          city:     contactData.city,
          state:    contactData.state,
          postcode: contactData.postcode,
          country:  contactData.country,
        },
        notes:     contactData.notes ?? '',
        amount:    total,
        taxAmount,
        taxRate,
        currency:  storeCurrency,
        gateway:   selectedGateway,
        status:    'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setOrderId(orderRef.id);
      clearCart();
      setStep(2);
    } catch {
      setConfirming(false);
    }
  }

  const LayoutWrapper =
    user.role === 'seller'
      ? SellerLayout
      : user.role === 'advisor'
      ? AdvisorLayout
      : BuyerLayout;

  return (
    <LayoutWrapper>
      <div
        style={{
          maxWidth: 680,
          margin:   '0 auto',
          padding:  'var(--space-6) var(--space-4)',
        }}
      >
        {/* Page title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          <ShoppingBag size={22} style={{ color: 'var(--color-primary)' }} />
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text)' }}>
            Checkout
          </h1>
        </div>

        <StepIndicator current={step} />

        {/* Card */}
        <div
          style={{
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding:      'var(--space-6)',
          }}
        >
          {step === 0 && (
            <ContactStep user={user} onNext={handleContactNext} />
          )}
          {step === 1 && (
            <PaymentStep
              config={paymentsConfig}
              items={items}
              total={total}
              taxAmount={taxAmount}
              symbol={symbol}
              currency={storeCurrency}
              onBack={() => setStep(0)}
              onConfirm={handleConfirm}
              confirming={confirming}
            />
          )}
          {step === 2 && (
            <ConfirmationStep
              orderId={orderId}
              items={items.length > 0 ? items : []}
              total={total}
              symbol={symbol}
              gateway={gateway}
              gatewayConfig={paymentsConfig}
              sellerId={sellerId}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </LayoutWrapper>
  );
}
