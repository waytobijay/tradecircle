/**
 * services/payments/stripe.ts
 * Initiates a Stripe Checkout session by opening a Payment Link in a new tab.
 */

/**
 * Open the Stripe Payment Link in a new browser tab, optionally appending
 * a client_reference_id so the order can be reconciled in the Stripe dashboard.
 */
export async function initiateStripe(
  paymentLinkUrl: string,
  orderRef?: string,
): Promise<void> {
  const url =
    paymentLinkUrl + (orderRef ? `?client_reference_id=${orderRef}` : '');
  window.open(url, '_blank', 'noopener,noreferrer');
}
