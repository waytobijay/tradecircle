/**
 * services/payments/eway.ts
 * Client-side eWAY payment initiator.
 *
 * Calls the server-side API route (/api/payments/eway) to perform the
 * token exchange, then redirects the user to the eWAY hosted payment page
 * by submitting a hidden HTML form with the returned AccessCode.
 */

export interface EwayInitiateParams {
  amount: number;
  currency: string;
  orderId: string;
  returnUrl: string;
  cancelUrl: string;
}

interface EwayApiResponse {
  accessCode?: string;
  formActionUrl?: string;
  error?: string;
}

/**
 * Initiate an eWAY payment by fetching an access code from the server-side
 * API route, then redirecting the user to the eWAY hosted payment page.
 */
export async function initiateEway(params: EwayInitiateParams): Promise<void> {
  const response = await fetch('/api/payments/eway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await response.json()) as EwayApiResponse;

  if (!response.ok || data.error) {
    throw new Error(data.error ?? `eWAY API request failed with status ${response.status}`);
  }

  const { accessCode, formActionUrl } = data;

  if (!accessCode || !formActionUrl) {
    throw new Error('eWAY response is missing accessCode or formActionUrl');
  }

  // Build and submit a hidden form so the browser POSTs the AccessCode
  // directly to the eWAY hosted payment page.
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = formActionUrl;
  form.style.display = 'none';

  const input = document.createElement('input');
  input.type  = 'hidden';
  input.name  = 'AccessCode';
  input.value = accessCode;
  form.appendChild(input);

  document.body.appendChild(form);
  form.submit();
}
