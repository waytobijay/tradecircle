/**
 * services/analytics-tracking.ts
 * Marketing analytics integration — Google Analytics 4 + Facebook Pixel.
 *
 * All functions are safe to call even when tracking IDs are not configured.
 * Script injection is idempotent (will not inject twice).
 */

// ─── Window augmentation ─────────────────────────────────────────────────────

declare global {
  interface Window {
    gtag:       (...args: unknown[]) => void;
    dataLayer:  unknown[];
    fbq:        ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; push?: (...args: unknown[]) => void; loaded?: boolean; version?: string };
    _fbq:       Window['fbq'];
  }
}

// ─── GA4 ──────────────────────────────────────────────────────────────────────

/**
 * Initialise GA4 with a measurement ID.
 * Injects the gtag script if not already present.
 */
export function initGA4(measurementId: string): void {
  if (typeof window === 'undefined' || !measurementId) return;
  if (document.getElementById('gtag-script')) return; // already injected

  // Bootstrap dataLayer + gtag function
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });

  // Inject the GA4 loader script
  const script   = document.createElement('script');
  script.id      = 'gtag-script';
  script.async   = true;
  script.src     = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}

// ─── Facebook Pixel ───────────────────────────────────────────────────────────

/**
 * Initialise Facebook Pixel with a pixel ID.
 * Injects the fbq script if not already present.
 */
export function initFacebookPixel(pixelId: string): void {
  if (typeof window === 'undefined' || !pixelId) return;
  if (document.getElementById('fbq-script')) return; // already injected

  // Bootstrap fbq stub
  if (!window.fbq) {
    const fbq: Window['fbq'] = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        (fbq.queue ?? []).push(args);
      }
    };
    fbq.queue   = [];
    fbq.loaded  = true;
    fbq.version = '2.0';
    fbq.push    = fbq;
    window.fbq  = fbq;
    window._fbq = fbq;
  }

  window.fbq('init', pixelId);

  // Inject the pixel script
  const script   = document.createElement('script');
  script.id      = 'fbq-script';
  script.async   = true;
  script.src     = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  // Noscript fallback (best-effort — SSR will not reach here)
  const noscript = document.createElement('noscript');
  const img      = document.createElement('img');
  img.height     = 1;
  img.width      = 1;
  img.style.display = 'none';
  img.src        = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
  noscript.appendChild(img);
  document.head.appendChild(noscript);
}

// ─── Page view ────────────────────────────────────────────────────────────────

/** Track a page view. Call this on route changes. */
export function trackPageView(path: string): void {
  if (typeof window === 'undefined') return;

  // GA4
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', { page_path: path });
  }

  // Facebook Pixel
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'PageView');
  }
}

// ─── Custom event ─────────────────────────────────────────────────────────────

/** Track a custom event. */
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params ?? {});
  }

  if (typeof window.fbq === 'function') {
    window.fbq('trackCustom', eventName, params ?? {});
  }
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

/** Track a purchase event (call after successful checkout). */
export function trackPurchase(order: {
  id:       string;
  amount:   number;
  currency: string;
  gateway:  string;
}): void {
  if (typeof window === 'undefined') return;

  const params = {
    transaction_id: order.id,
    value:          order.amount,
    currency:       order.currency,
    payment_type:   order.gateway,
  };

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'purchase', params);
  }

  if (typeof window.fbq === 'function') {
    window.fbq('track', 'Purchase', {
      value:    order.amount,
      currency: order.currency,
    });
  }
}

// ─── Product view ─────────────────────────────────────────────────────────────

/** Track a product view. */
export function trackProductView(product: {
  id:       string;
  name:     string;
  category: string;
  price:    number;
}): void {
  if (typeof window === 'undefined') return;

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'view_item', {
      items: [
        {
          item_id:       product.id,
          item_name:     product.name,
          item_category: product.category,
          price:         product.price,
        },
      ],
    });
  }

  if (typeof window.fbq === 'function') {
    window.fbq('track', 'ViewContent', {
      content_ids:  [product.id],
      content_name: product.name,
      content_type: 'product',
      value:        product.price,
    });
  }
}
