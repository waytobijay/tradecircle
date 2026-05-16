/**
 * app/cart/page.tsx
 * Buyer shopping cart.
 * Spec ref: section 5.1 (Cart)
 *
 * Layout:
 *   Left  — product rows (thumbnail, name, price, quantity stepper, remove)
 *   Right — order summary card (subtotal, tax, total, [Proceed to Checkout])
 *
 * Currency: read from config/site → applied to display + cart store.
 * Empty state: illustration + "Browse Products" CTA.
 */

'use client';

import { useEffect, useState } from 'react';
import Link                    from 'next/link';
import { useRouter }           from 'next/navigation';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Package,
  Tag,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db }            from '@/services/firebase';
import { useAuthStore }  from '@/store/authStore';
import { useCartStore }  from '@/store/cartStore';
import type { CartItem } from '@/store/cartStore';
import type { ProductCurrency } from '@/types';
import BuyerLayout       from '@/components/layouts/BuyerLayout';
import SellerLayout      from '@/components/layouts/SellerLayout';
import AdvisorLayout     from '@/components/layouts/AdvisorLayout';
import PublicLayout      from '@/components/layouts/PublicLayout';

// ─── Currency symbols ─────────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<ProductCurrency, string> = {
  AUD: 'A$',
  USD: '$',
  NPR: 'रू',
  INR: '₹',
};

// ─── Cart row ─────────────────────────────────────────────────────────────────

function CartRow({
  item,
  symbol,
  onQuantity,
  onRemove,
}: {
  item:       CartItem;
  symbol:     string;
  onQuantity: (id: string, qty: number) => void;
  onRemove:   (id: string) => void;
}) {
  return (
    <div
      style={{
        display:      'flex',
        gap:          'var(--space-4)',
        padding:      'var(--space-4) 0',
        borderBottom: '1px solid var(--color-border)',
        alignItems:   'center',
      }}
    >
      {/* Thumbnail */}
      <Link href={`/products/${item.productId}`} style={{ flexShrink: 0 }}>
        <div
          style={{
            width:        80,
            height:       80,
            borderRadius: 'var(--radius-lg)',
            overflow:     'hidden',
            background:   'var(--color-surface-2)',
            flexShrink:   0,
          }}
        >
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width:          '100%',
                height:         '100%',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                color:          'var(--color-text-3)',
              }}
            >
              <Package size={24} />
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          href={`/products/${item.productId}`}
          style={{ textDecoration: 'none' }}
        >
          <p
            style={{
              margin:       0,
              fontWeight:   600,
              fontSize:     'var(--text-sm)',
              color:        'var(--color-text)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {item.name}
          </p>
        </Link>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
          Sold by {item.sellerName}
        </p>
        <p style={{ margin: 'var(--space-1) 0 0', fontWeight: 700, color: 'var(--color-primary)', fontSize: 'var(--text-sm)' }}>
          {symbol} {item.price.toLocaleString()}
        </p>
      </div>

      {/* Quantity stepper */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          'var(--space-1)',
          background:   'var(--color-surface-2)',
          borderRadius: 'var(--radius-md)',
          border:       '1px solid var(--color-border)',
          overflow:     'hidden',
          flexShrink:   0,
        }}
      >
        <button
          onClick={() => onQuantity(item.productId, item.quantity - 1)}
          style={{
            width:          32,
            height:         32,
            border:         'none',
            background:     'transparent',
            color:          'var(--color-text-2)',
            cursor:         'pointer',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            transition:     'color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-2)'; }}
        >
          <Minus size={14} />
        </button>
        <span
          style={{
            minWidth:   28,
            textAlign:  'center',
            fontWeight: 700,
            fontSize:   'var(--text-sm)',
            color:      'var(--color-text)',
            userSelect: 'none',
          }}
        >
          {item.quantity}
        </span>
        <button
          onClick={() => onQuantity(item.productId, item.quantity + 1)}
          style={{
            width:          32,
            height:         32,
            border:         'none',
            background:     'transparent',
            color:          'var(--color-text-2)',
            cursor:         'pointer',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            transition:     'color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-2)'; }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Line total */}
      <p
        style={{
          margin:     0,
          fontWeight: 700,
          fontSize:   'var(--text-sm)',
          color:      'var(--color-text)',
          minWidth:   72,
          textAlign:  'right',
          flexShrink: 0,
        }}
      >
        {symbol} {(item.price * item.quantity).toLocaleString()}
      </p>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.productId)}
        title="Remove item"
        style={{
          width:          32,
          height:         32,
          borderRadius:   'var(--radius-md)',
          border:         '1px solid var(--color-border)',
          background:     'var(--color-surface)',
          color:          'var(--color-text-3)',
          cursor:         'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
          transition:     'color 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.color       = 'var(--color-error, #ef4444)';
          b.style.borderColor = 'var(--color-error, #ef4444)';
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.color       = 'var(--color-text-3)';
          b.style.borderColor = 'var(--color-border)';
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Order summary ────────────────────────────────────────────────────────────

function OrderSummary({
  items,
  subtotal,
  taxRate,
  symbol,
  currency,
  onCheckout,
}: {
  items:      CartItem[];
  subtotal:   number;
  taxRate:    number;
  symbol:     string;
  currency:   ProductCurrency;
  onCheckout: () => void;
}) {
  const taxAmount = subtotal * (taxRate / 100);
  const total     = subtotal + taxAmount;

  return (
    <div
      style={{
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding:      'var(--space-5)',
        position:     'sticky',
        top:          88,
      }}
    >
      <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)' }}>
        Order Summary
      </h2>

      {/* Line items summary */}
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.map((item) => (
          <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-text-2)' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {item.name} <span style={{ color: 'var(--color-text-3)' }}>×{item.quantity}</span>
            </span>
            <span style={{ flexShrink: 0, marginLeft: 'var(--space-2)' }}>
              {symbol} {(item.price * item.quantity).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: 'var(--space-3)',
          display:    'flex',
          flexDirection: 'column',
          gap:        'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-text-2)' }}>
          <span>Subtotal</span>
          <span>{symbol} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        {taxRate > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-text-2)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <Tag size={12} /> Tax ({taxRate}%)
            </span>
            <span>{symbol} {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}

        <div
          style={{
            display:       'flex',
            justifyContent: 'space-between',
            fontWeight:    800,
            fontSize:      'var(--text-base)',
            color:         'var(--color-text)',
            borderTop:     '1px solid var(--color-border)',
            paddingTop:    'var(--space-3)',
            marginTop:     'var(--space-1)',
          }}
        >
          <span>Total</span>
          <span style={{ color: 'var(--color-primary)' }}>
            {symbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-3)', textAlign: 'center' }}>
          Prices shown in {currency}
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={onCheckout}
        style={{
          width:          '100%',
          marginTop:      'var(--space-4)',
          padding:        'var(--space-3)',
          background:     'var(--color-primary)',
          color:          '#fff',
          border:         'none',
          borderRadius:   'var(--radius-md)',
          fontWeight:     700,
          fontSize:       'var(--text-base)',
          cursor:         'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            'var(--space-2)',
          transition:     'opacity 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        Proceed to Checkout
        <ArrowRight size={18} />
      </button>

      <p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)', textAlign: 'center' }}>
        Secure checkout — multiple payment options available
      </p>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyCart() {
  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        'var(--space-16) var(--space-4)',
        textAlign:      'center',
        gap:            'var(--space-4)',
      }}
    >
      {/* Illustration */}
      <div
        style={{
          width:          120,
          height:         120,
          borderRadius:   '50%',
          background:     'color-mix(in srgb, var(--color-primary) 10%, transparent)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        <ShoppingCart size={52} style={{ color: 'var(--color-primary)', opacity: 0.7 }} />
      </div>

      <div>
        <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)' }}>
          Your cart is empty
        </h2>
        <p style={{ margin: 0, color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', maxWidth: 320 }}>
          Browse products and tap <strong>Add to Cart</strong> to add items here.
        </p>
      </div>

      <Link
        href="/search"
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            'var(--space-2)',
          padding:        'var(--space-3) var(--space-6)',
          background:     'var(--color-primary)',
          color:          '#fff',
          borderRadius:   'var(--radius-md)',
          fontWeight:     700,
          fontSize:       'var(--text-sm)',
          textDecoration: 'none',
          transition:     'opacity 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.88'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
      >
        Browse Products
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CartPage() {
  const user        = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const router      = useRouter();

  const items          = useCartStore((s) => s.items);
  const removeItem     = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const getTotalPrice  = useCartStore((s) => s.getTotalPrice);
  const setCurrency    = useCartStore((s) => s.setCurrency);
  const storeCurrency  = useCartStore((s) => s.currency);

  const [taxRate, setTaxRate]   = useState(0);
  const [configLoading, setConfigLoading] = useState(true);

  // Load currency + tax rate from admin config
  useEffect(() => {
    async function loadConfig() {
      try {
        const snap = await getDoc(doc(db, 'config', 'site'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.currency) setCurrency(data.currency);
          if (data.taxRate != null) setTaxRate(Number(data.taxRate));
        }
      } finally {
        setConfigLoading(false);
      }
    }
    loadConfig();
  }, [setCurrency]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  const symbol   = CURRENCY_SYMBOL[storeCurrency] ?? storeCurrency;
  const subtotal = getTotalPrice();

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
          maxWidth: 1100,
          margin:   '0 auto',
          padding:  'var(--space-6) var(--space-4)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          'var(--space-3)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <ShoppingCart size={24} style={{ color: 'var(--color-primary)' }} />
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text)' }}>
            Cart
          </h1>
          {items.length > 0 && (
            <span
              style={{
                padding:      '2px 10px',
                background:   'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                color:        'var(--color-primary)',
                borderRadius: 'var(--radius-full)',
                fontSize:     'var(--text-sm)',
                fontWeight:   700,
              }}
            >
              {items.reduce((s, i) => s + i.quantity, 0)} item{items.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: '1fr 360px',
              gap:                 'var(--space-6)',
              alignItems:         'start',
            }}
          >
            {/* Cart items */}
            <div
              style={{
                background:   'var(--color-surface)',
                border:       '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding:      '0 var(--space-5)',
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display:      'grid',
                  gridTemplateColumns: '80px 1fr 120px 100px 100px 40px',
                  gap:          'var(--space-3)',
                  padding:      'var(--space-3) 0',
                  borderBottom: '2px solid var(--color-border)',
                  alignItems:   'center',
                }}
              >
                {['', 'Product', 'Price', 'Quantity', 'Total', ''].map((h, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize:      'var(--text-xs)',
                      fontWeight:    700,
                      color:         'var(--color-text-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      textAlign:     i >= 4 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {items.map((item) => (
                <CartRow
                  key={item.productId}
                  item={item}
                  symbol={symbol}
                  onQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}

              {/* Footer actions */}
              <div
                style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  padding:        'var(--space-4) 0',
                }}
              >
                <Link
                  href="/search"
                  style={{
                    fontSize:       'var(--text-sm)',
                    color:          'var(--color-primary)',
                    textDecoration: 'none',
                    fontWeight:     600,
                  }}
                >
                  ← Continue Shopping
                </Link>
                <button
                  onClick={() => {
                    if (window.confirm('Remove all items from cart?')) {
                      items.forEach((i) => removeItem(i.productId));
                    }
                  }}
                  style={{
                    background: 'none',
                    border:     'none',
                    color:      'var(--color-text-3)',
                    fontSize:   'var(--text-sm)',
                    cursor:     'pointer',
                    fontWeight: 500,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error, #ef4444)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-3)'; }}
                >
                  Clear cart
                </button>
              </div>
            </div>

            {/* Order summary sidebar */}
            <OrderSummary
              items={items}
              subtotal={subtotal}
              taxRate={taxRate}
              symbol={symbol}
              currency={storeCurrency}
              onCheckout={() => router.push('/checkout')}
            />
          </div>
        )}
      </div>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 768px) {
          .cart-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </LayoutWrapper>
  );
}
