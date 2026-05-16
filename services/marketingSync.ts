/**
 * services/marketingSync.ts
 * Phase 5 — Push contacts/orders to enabled marketing integrations.
 *
 * Reads enabled integrations from Firestore: marketingIntegrations/{provider}.
 * Each provider call is wrapped in try/catch — one failure never blocks others.
 *
 * NOTE: For production these calls should be proxied through a backend route
 * to keep API keys server-side. This client implementation is provided for
 * admin testing and is gated by `enabled` + `syncContacts`/`syncOrders`.
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { MarketingIntegration, Order, IntegrationProvider } from '@/types';

interface ContactPayload {
  uid: string;
  email: string;
  name: string;
  tags?: string[];
}

// ─── Loader ──────────────────────────────────────────────────────────────────
async function loadIntegrations(): Promise<MarketingIntegration[]> {
  try {
    const snap = await getDocs(collection(db, 'marketingIntegrations'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MarketingIntegration, 'id'>) }))
      .filter((i) => i.enabled && i.status === 'connected');
  } catch (e) {
    console.error('[marketingSync] failed to load integrations', e);
    return [];
  }
}

// ─── Per-provider contact pushers ────────────────────────────────────────────

async function pushMailchimpContact(i: MarketingIntegration, c: ContactPayload) {
  if (!i.apiKey || !i.listId) throw new Error('Mailchimp: apiKey + listId required');
  const dc = i.apiKey.split('-')[1] ?? 'us1';
  const [firstname, ...rest] = c.name.split(' ');
  const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${i.listId}/members`, {
    method: 'POST',
    headers: {
      Authorization: `apikey ${i.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: c.email,
      status: 'subscribed',
      merge_fields: { FNAME: firstname ?? '', LNAME: rest.join(' ') },
      tags: c.tags ?? [],
    }),
  });
  if (!res.ok) throw new Error(`Mailchimp HTTP ${res.status}`);
}

async function pushHubspotContact(i: MarketingIntegration, c: ContactPayload) {
  if (!i.apiKey) throw new Error('HubSpot: apiKey required');
  const [firstname, ...rest] = c.name.split(' ');
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${i.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { email: c.email, firstname: firstname ?? '', lastname: rest.join(' ') },
    }),
  });
  if (!res.ok) throw new Error(`HubSpot HTTP ${res.status}`);
}

async function pushMetaContact(i: MarketingIntegration, c: ContactPayload) {
  if (!i.apiKey || !i.accountId) throw new Error('Meta: apiKey (token) + accountId (pixelId) required');
  const hash = await sha256Hex(c.email.trim().toLowerCase());
  const res = await fetch(`https://graph.facebook.com/v18.0/${i.accountId}/events?access_token=${encodeURIComponent(i.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: { em: [hash], external_id: [c.uid] },
      }],
    }),
  });
  if (!res.ok) throw new Error(`Meta HTTP ${res.status}`);
}

async function pushKlaviyoContact(i: MarketingIntegration, c: ContactPayload) {
  if (!i.apiKey) throw new Error('Klaviyo: apiKey required');
  const res = await fetch('https://a.klaviyo.com/api/profiles/', {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${i.apiKey}`,
      revision: '2024-02-15',
      accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        type: 'profile',
        attributes: { email: c.email, first_name: c.name.split(' ')[0] ?? '', external_id: c.uid },
      },
    }),
  });
  if (!res.ok && res.status !== 409) throw new Error(`Klaviyo HTTP ${res.status}`);
}

async function pushSendgridContact(i: MarketingIntegration, c: ContactPayload) {
  if (!i.apiKey) throw new Error('SendGrid: apiKey required');
  const body: Record<string, unknown> = {
    contacts: [{ email: c.email, first_name: c.name.split(' ')[0] ?? '' }],
  };
  if (i.listId) body.list_ids = [i.listId];
  const res = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${i.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`SendGrid HTTP ${res.status}`);
}

// ─── Per-provider order pushers ──────────────────────────────────────────────

async function pushMetaOrder(i: MarketingIntegration, o: Order) {
  if (!i.apiKey || !i.accountId) throw new Error('Meta: apiKey + pixelId required');
  const emailHash = await sha256Hex(o.email.trim().toLowerCase());
  const res = await fetch(`https://graph.facebook.com/v18.0/${i.accountId}/events?access_token=${encodeURIComponent(i.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: { em: [emailHash], external_id: [o.buyerId] },
        custom_data: { value: o.amount, currency: o.currency, order_id: o.id },
      }],
    }),
  });
  if (!res.ok) throw new Error(`Meta HTTP ${res.status}`);
}

async function pushKlaviyoOrder(i: MarketingIntegration, o: Order) {
  if (!i.apiKey) throw new Error('Klaviyo: apiKey required');
  const res = await fetch('https://a.klaviyo.com/api/events/', {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${i.apiKey}`,
      revision: '2024-02-15',
      accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        type: 'event',
        attributes: {
          properties: { OrderId: o.id, Value: o.amount, Currency: o.currency },
          metric: { data: { type: 'metric', attributes: { name: 'Placed Order' } } },
          profile: { data: { type: 'profile', attributes: { email: o.email, external_id: o.buyerId } } },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Klaviyo HTTP ${res.status}`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

type ContactDispatcher = (i: MarketingIntegration, c: ContactPayload) => Promise<void>;
const CONTACT_DISPATCH: Record<IntegrationProvider, ContactDispatcher> = {
  mailchimp:      pushMailchimpContact,
  hubspot:        pushHubspotContact,
  'meta-business':pushMetaContact,
  klaviyo:        pushKlaviyoContact,
  sendgrid:       pushSendgridContact,
};

type OrderDispatcher = (i: MarketingIntegration, o: Order) => Promise<void>;
const ORDER_DISPATCH: Partial<Record<IntegrationProvider, OrderDispatcher>> = {
  'meta-business': pushMetaOrder,
  klaviyo:         pushKlaviyoOrder,
};

// ─── Public API ──────────────────────────────────────────────────────────────

/** Push a new contact to all enabled marketing integrations. */
export async function syncContactToIntegrations(contact: ContactPayload): Promise<void> {
  const integrations = await loadIntegrations();
  await Promise.all(integrations
    .filter((i) => i.syncContacts)
    .map(async (i) => {
      try {
        await CONTACT_DISPATCH[i.provider](i, contact);
      } catch (e) {
        console.error(`[marketingSync] ${i.provider} contact sync failed`, e);
      }
    }));
}

/** Push an order to all enabled marketing integrations (e-commerce tracking). */
export async function syncOrderToIntegrations(order: Order): Promise<void> {
  const integrations = await loadIntegrations();
  await Promise.all(integrations
    .filter((i) => i.syncOrders)
    .map(async (i) => {
      const fn = ORDER_DISPATCH[i.provider];
      if (!fn) return;
      try { await fn(i, order); }
      catch (e) { console.error(`[marketingSync] ${i.provider} order sync failed`, e); }
    }));
}
