/**
 * services/payments/index.ts
 * Central payment gateway router for TradeCircle.
 * Routes to the appropriate gateway implementation based on gatewayId.
 */

import type { GatewaysConfig, ProductCurrency } from '@/types';
import { initiateStripe } from './stripe';
import { initiateEsewa } from './esewa';
import { initiateKhalti } from './khalti';
import { initiateEway } from './eway';

export type GatewayId =
  | 'stripe'
  | 'eway'
  | 'esewa'
  | 'khalti'
  | 'fonepay'
  | 'contact-seller';

export interface PaymentInitiateParams {
  amount: number;
  currency: ProductCurrency;
  gatewayId: GatewayId;
  config: GatewaysConfig;
  orderId?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

/**
 * Initiate a payment flow for the given gateway.
 * Each gateway has its own redirect or form-submit strategy.
 */
export async function initiatePayment(params: PaymentInitiateParams): Promise<void> {
  const { gatewayId, config, amount, orderId, returnUrl, cancelUrl } = params;

  switch (gatewayId) {
    case 'stripe': {
      const paymentLinkUrl = config.stripe.paymentLinkUrl;
      if (!paymentLinkUrl) throw new Error('Stripe payment link URL is not configured.');
      await initiateStripe(paymentLinkUrl, orderId);
      break;
    }

    case 'esewa': {
      const merchantCode = config.esewa.merchantCode;
      if (!merchantCode) throw new Error('eSewa merchant code is not configured.');
      if (!returnUrl || !cancelUrl) throw new Error('eSewa requires returnUrl and cancelUrl.');

      // Convert amount to paisa-equivalent whole number (eSewa expects full rupees for NPR)
      await initiateEsewa({
        amount,
        taxAmount: 0,
        totalAmount: amount,
        transactionId: orderId ?? `TC-${Date.now()}`,
        productCode: merchantCode,
        successUrl: returnUrl,
        failureUrl: cancelUrl,
        sandbox: config.esewa.sandboxMode ?? false,
      });
      break;
    }

    case 'khalti': {
      const publicKey = config.khalti.publishableKey;
      if (!publicKey) throw new Error('Khalti public key is not configured.');
      if (!returnUrl) throw new Error('Khalti requires a returnUrl.');

      await initiateKhalti({
        amount,
        purchaseOrderId: orderId ?? `TC-${Date.now()}`,
        purchaseOrderName: 'TradeCircle Order',
        publicKey,
        returnUrl,
        sandbox: config.khalti.sandboxMode ?? false,
      });
      break;
    }

    case 'fonepay': {
      const qrUrl = config.fonepay.merchantQrUrl;
      if (!qrUrl) throw new Error('Fonepay merchant QR URL is not configured.');
      // Show the merchant QR code by opening it in a new tab.
      // A richer QR overlay can be built on top of this primitive.
      window.open(qrUrl, '_blank', 'noopener,noreferrer');
      break;
    }

    case 'eway': {
      if (!returnUrl || !cancelUrl) throw new Error('eWAY requires returnUrl and cancelUrl.');
      await initiateEway({
        amount,
        currency,
        orderId: orderId ?? `TC-${Date.now()}`,
        returnUrl,
        cancelUrl,
      });
      break;
    }

    case 'contact-seller':
      // No-op: the UI should show the seller contact information instead.
      break;

    default: {
      const _exhaustive: never = gatewayId;
      throw new Error(`Unknown gateway: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Return the list of enabled gateway IDs in display order.
 * 'contact-seller' is always first; remaining gateways follow in config key order.
 */
export function getActiveGateways(config: GatewaysConfig): GatewayId[] {
  const order: Exclude<GatewayId, 'contact-seller'>[] = [
    'stripe',
    'eway',
    'esewa',
    'khalti',
    'fonepay',
  ];

  const enabled = order.filter((id) => config[id]?.enabled === true);
  return ['contact-seller', ...enabled];
}
