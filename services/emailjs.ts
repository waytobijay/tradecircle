/**
 * services/emailjs.ts
 * EmailJS integration for contact forms and payment confirmations.
 * Uses the REST API directly — no SDK required.
 */

const EMAILJS_API = 'https://api.emailjs.com/api/v1.0/email/send';

interface EmailJSBody {
  service_id: string;
  template_id: string;
  user_id: string;
  template_params: Record<string, string>;
}

async function sendEmail(body: EmailJSBody): Promise<void> {
  const response = await fetch(EMAILJS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`EmailJS request failed (${response.status}): ${text}`);
  }
}

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Send a contact-form submission through EmailJS.
 */
export async function sendContactForm(
  data: ContactFormData,
  publicKey: string,
  serviceId: string,
  templateId: string,
): Promise<void> {
  await sendEmail({
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      from_name: data.name,
      from_email: data.email,
      subject: data.subject,
      message: data.message,
    },
  });
}

export interface PaymentConfirmationData {
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  productName: string;
  amount: string;
  currency: string;
  gateway: string;
}

/**
 * Send a payment-confirmation email through EmailJS.
 */
export async function sendPaymentConfirmation(
  data: PaymentConfirmationData,
  publicKey: string,
  serviceId: string,
  templateId: string,
): Promise<void> {
  await sendEmail({
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      order_number: data.orderNumber,
      buyer_name: data.buyerName,
      buyer_email: data.buyerEmail,
      product_name: data.productName,
      amount: data.amount,
      currency: data.currency,
      gateway: data.gateway,
    },
  });
}
