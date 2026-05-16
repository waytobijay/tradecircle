/**
 * hooks/useAnalyticsTracking.ts
 * Initialises GA4 and Facebook Pixel from Firestore config,
 * and tracks page views on every pathname change.
 *
 * Call once in AuthProvider or root layout.
 */

'use client';

import { useEffect }       from 'react';
import { usePathname }     from 'next/navigation';
import { doc, getDoc }     from 'firebase/firestore';
import { db }              from '@/services/firebase';
import {
  initGA4,
  initFacebookPixel,
  trackPageView,
}                          from '@/services/analytics-tracking';

export function useAnalyticsTracking(): void {
  const pathname = usePathname();

  // Initialise on mount
  useEffect(() => {
    async function bootstrap() {
      try {
        const snap = await getDoc(doc(db, 'config', 'siteConfig'));
        if (!snap.exists()) return;

        const analytics = snap.data()?.analytics as {
          enabled?: boolean;
          ga4MeasurementId?: string;
          facebookPixelId?:  string;
        } | undefined;

        if (!analytics?.enabled) return;

        if (analytics.ga4MeasurementId) {
          initGA4(analytics.ga4MeasurementId);
        }

        if (analytics.facebookPixelId) {
          initFacebookPixel(analytics.facebookPixelId);
        }
      } catch {
        // Analytics is optional — never throw
      }
    }

    bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Track page view on every pathname change
  useEffect(() => {
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname]);
}
