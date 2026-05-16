/**
 * app/api/payments/eway/route.ts
 * Server-side eWAY token exchange.
 * Fetches an AccessCode + FormActionURL from the eWAY Rapid API
 * and returns them to the client so it can redirect the user to
 * the eWAY hosted payment page.
 *
 * POST body:
 *   { amount: number; currency: string; orderId: string; returnUrl: string; cancelUrl: string }
 *
 * Success response:
 *   { accessCode: string; formActionUrl: string }
 *
 * Error responses:
 *   503  { error: 'eWAY not configured' }
 *   502  { error: string }            — eWAY API error
 *   500  { error: string }            — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';

interface EwayRequestBody {
  amount: number;
  currency: string;
  orderId: string;
  returnUrl: string;
  cancelUrl: string;
}

interface EwayAccessCodeResponse {
  AccessCode: string;
  FormActionURL: string;
  Errors?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Validate environment ──────────────────────────────────────────────
  const apiKey   = process.env.EWAY_API_KEY;
  const password = process.env.EWAY_PASSWORD;
  const endpoint = process.env.EWAY_ENDPOINT ?? 'https://api.sandbox.ewaypayments.com';

  if (!apiKey || !password) {
    return NextResponse.json(
      { error: 'eWAY not configured' },
      { status: 503 },
    );
  }

  // ── 2. Parse request body ────────────────────────────────────────────────
  let body: EwayRequestBody;
  try {
    body = (await req.json()) as EwayRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  const { amount, currency, orderId, returnUrl, cancelUrl } = body;

  if (!amount || !currency || !orderId || !returnUrl || !cancelUrl) {
    return NextResponse.json(
      { error: 'Missing required fields: amount, currency, orderId, returnUrl, cancelUrl' },
      { status: 400 },
    );
  }

  // ── 3. Build Basic Auth header ────────────────────────────────────────────
  const credentials = Buffer.from(`${apiKey}:${password}`).toString('base64');

  // ── 4. Call eWAY Rapid API — AccessCodes endpoint ────────────────────────
  //
  // eWAY expects amount in cents (integer).
  // Ref: https://eway.io/api-v3/#access-codes
  try {
    const ewayResponse = await fetch(`${endpoint}/AccessCodes`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Payment: {
          TotalAmount:    Math.round(amount * 100), // convert to cents
          CurrencyCode:   currency,
          InvoiceReference: orderId,
        },
        RedirectUrl: returnUrl,
        CancelUrl:   cancelUrl,
        Method:      'ProcessPayment',
        TransactionType: 'Purchase',
      }),
    });

    if (!ewayResponse.ok) {
      const text = await ewayResponse.text();
      return NextResponse.json(
        { error: `eWAY API error: ${ewayResponse.status} ${text}` },
        { status: 502 },
      );
    }

    const data = (await ewayResponse.json()) as EwayAccessCodeResponse;

    if (data.Errors) {
      return NextResponse.json(
        { error: `eWAY returned errors: ${data.Errors}` },
        { status: 502 },
      );
    }

    if (!data.AccessCode || !data.FormActionURL) {
      return NextResponse.json(
        { error: 'eWAY response missing AccessCode or FormActionURL' },
        { status: 502 },
      );
    }

    // ── 5. Return access code and form action URL to the client ────────────
    return NextResponse.json(
      {
        accessCode:    data.AccessCode,
        formActionUrl: data.FormActionURL,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to reach eWAY: ${message}` },
      { status: 500 },
    );
  }
}
