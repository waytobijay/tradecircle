/**
 * services/payments/khalti.ts
 * Khalti ePay integration (v2 API).
 * Initiates payment via the Khalti initiation API, then redirects to the payment URL.
 */

const KHALTI_INITIATE_URL = 'https://khalti.com/api/v2/epayment/initiate/';

export interface KhaltiParams {
  amount: number;
  purchaseOrderId: string;
  purchaseOrderName: string;
  publicKey: string;
  returnUrl: string;
  sandbox?: boolean;
}

interface KhaltiInitiateResponse {
  pidx: string;
  payment_url: string;
  expires_at: string;
  expires_in: number;
  user_defined_meta?: Record<string, unknown>;
}

/**
 * Initiate a Khalti payment and redirect the user to the Khalti checkout page.
 * Note: The Khalti API must be called server-side in production to protect the secret key.
 * This client-side implementation is suitable for sandbox / development environments.
 */
export async function initiateKhalti(params: KhaltiParams): Promise<void> {
  const response = await fetch(KHALTI_INITIATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${params.publicKey}`,
    },
    body: JSON.stringify({
      return_url: params.returnUrl,
      website_url: window.location.origin,
      amount: params.amount,
      purchase_order_id: params.purchaseOrderId,
      purchase_order_name: params.purchaseOrderName,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Khalti initiation failed (${response.status}): ${JSON.stringify(errorData)}`,
    );
  }

  const data = (await response.json()) as KhaltiInitiateResponse;

  if (!data.payment_url) {
    throw new Error('Khalti did not return a payment URL.');
  }

  window.location.href = data.payment_url;
}
