/**
 * components/orders/InvoiceButton.tsx
 * Download/print invoice button.
 * Fetches product, seller and site config from Firestore,
 * then calls printInvoice() so the browser can save as PDF.
 *
 * Only visible when order.status !== 'pending'.
 */

'use client';

import { useState }           from 'react';
import { doc, getDoc }        from 'firebase/firestore';
import { Download, Loader2 }  from 'lucide-react';
import { db }                 from '@/services/firebase';
import { printInvoice }       from '@/services/invoice';
import type { Order }         from '@/types';

interface InvoiceButtonProps {
  orderId: string;
  order:   Order;
}

export default function InvoiceButton({ orderId, order }: InvoiceButtonProps) {
  const [loading, setLoading] = useState(false);

  // Hide for pending orders
  if (order.status === 'pending') return null;

  async function handleClick() {
    setLoading(true);
    try {
      // Fetch product
      const productSnap = await getDoc(doc(db, 'products', order.productId));
      const productData  = productSnap.exists() ? productSnap.data() : null;

      // Fetch seller
      const sellerSnap = await getDoc(doc(db, 'users', order.sellerId));
      const sellerData  = sellerSnap.exists() ? sellerSnap.data() : null;

      // Fetch site config
      const configSnap = await getDoc(doc(db, 'config', 'siteConfig'));
      const configData  = configSnap.exists() ? configSnap.data() : null;

      printInvoice({
        order,
        product: {
          name:   productData?.name   ?? 'Product',
          images: productData?.images ?? [],
        },
        seller: {
          name:  sellerData?.name  ?? 'Seller',
          email: sellerData?.email ?? '',
          brand: sellerData?.brand,
        },
        buyer: {
          name:  order.fullName,
          email: order.email,
        },
        companyName: configData?.branding?.companyName ?? 'TradeCircle',
        logoUrl:     configData?.branding?.logoUrl,
      });
    } catch (err) {
      console.error('[InvoiceButton] Failed to generate invoice:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            6,
        padding:        '6px 14px',
        background:     'var(--color-surface)',
        border:         '1px solid var(--color-border)',
        borderRadius:   'var(--radius-md, 6px)',
        color:          'var(--color-text)',
        fontWeight:     600,
        fontSize:       13,
        cursor:         loading ? 'not-allowed' : 'pointer',
        opacity:        loading ? 0.7 : 1,
        transition:     'border-color 0.15s, color 0.15s',
        whiteSpace:     'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.borderColor = 'var(--color-primary)';
          b.style.color       = 'var(--color-primary)';
        }
      }}
      onMouseLeave={(e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.borderColor = 'var(--color-border)';
        b.style.color       = 'var(--color-text)';
      }}
      title={`Download Invoice for order #${orderId.slice(-8).toUpperCase()}`}
    >
      {loading
        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
        : <Download size={14} />
      }
      {loading ? 'Preparing…' : 'Download Invoice'}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
