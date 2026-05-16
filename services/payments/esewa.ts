/**
 * services/payments/esewa.ts
 * eSewa payment gateway integration (v2 API).
 * Submits a hidden HTML form to the eSewa endpoint.
 */

const ESEWA_SANDBOX_URL =
  'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
const ESEWA_LIVE_URL =
  'https://epay.esewa.com.np/api/epay/main/v2/form';

export interface EsewaParams {
  amount: number;
  taxAmount: number;
  totalAmount: number;
  transactionId: string;
  productCode: string;
  successUrl: string;
  failureUrl: string;
  sandbox?: boolean;
}

/**
 * Redirect the user to eSewa by creating and submitting a hidden form.
 */
export async function initiateEsewa(params: EsewaParams): Promise<void> {
  const endpoint = params.sandbox ? ESEWA_SANDBOX_URL : ESEWA_LIVE_URL;

  const fields: Record<string, string> = {
    amount: String(params.amount),
    tax_amount: String(params.taxAmount),
    total_amount: String(params.totalAmount),
    transaction_uuid: params.transactionId,
    product_code: params.productCode,
    product_service_charge: '0',
    product_delivery_charge: '0',
    success_url: params.successUrl,
    failure_url: params.failureUrl,
    signed_field_names: 'total_amount,transaction_uuid,product_code',
    // signature is generated server-side; for client-only flows supply a placeholder
    signature: '',
  };

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = endpoint;
  form.style.display = 'none';

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
