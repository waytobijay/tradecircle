/**
 * app/api/ai/fraud-scan/route.ts
 * Server-side fraud detection endpoint.
 *
 * POST body: { type: 'product' | 'user'; id: string }
 *
 * Returns: { flagged: boolean; severity: FraudSeverity; reason: string; flagId?: string }
 *
 * If flagged, writes a FraudFlag doc to the `fraudFlags` Firestore collection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue }     from 'firebase-admin/firestore';

// ─── Firebase Admin init (idempotent) ─────────────────────────────────────────

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccount) {
      initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
    } else {
      initializeApp();
    }
  }
  return getFirestore();
}

// ─── AI helper ────────────────────────────────────────────────────────────────

interface AIAnalysisResult {
  severity: 'low' | 'medium' | 'high';
  reason: string;
  flagged: boolean;
}

async function runAIFraudAnalysis(prompt: string, req: NextRequest): Promise<AIAnalysisResult> {
  const origin = req.nextUrl.origin;
  const res = await fetch(`${origin}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 300,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI service error: ${res.status}`);
  }

  const data = await res.json() as { text?: string; error?: string };
  const text = data.text ?? '';

  // Extract JSON from the response (may be wrapped in markdown code fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { severity: 'low', reason: 'Unable to parse AI response.', flagged: false };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<AIAnalysisResult>;
    return {
      severity: parsed.severity ?? 'low',
      reason:   parsed.reason   ?? 'No reason provided.',
      flagged:  parsed.flagged  ?? false,
    };
  } catch {
    return { severity: 'low', reason: 'Unable to parse AI response.', flagged: false };
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { type?: string; id?: string };
  const { type, id } = body;

  if (!type || !id || !['product', 'user'].includes(type)) {
    return NextResponse.json(
      { error: 'Body must include { type: "product" | "user"; id: string }' },
      { status: 400 },
    );
  }

  const db = getAdminDb();
  let prompt = '';
  let targetName = '';

  try {
    if (type === 'product') {
      // ── Fetch product ──────────────────────────────────────────────────────
      const snap = await db.doc(`products/${id}`).get();
      if (!snap.exists) {
        return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
      }
      const product = snap.data() as {
        name?: string;
        price?: number;
        currency?: string;
        description?: string;
        sellerId?: string;
      };

      targetName = product.name ?? id;
      prompt = `Analyse this product listing for fraud indicators. Return JSON only (no markdown): { "severity": "low"|"medium"|"high", "reason": string, "flagged": boolean }
Product: ${product.name ?? 'Unknown'}, Price: ${product.price ?? 0} ${product.currency ?? 'AUD'}, Description: ${(product.description ?? '').slice(0, 400)}, Seller ID: ${product.sellerId ?? 'unknown'}
Look for: unrealistic prices, suspicious descriptions, counterfeit indicators, copy-paste content, gibberish text, missing details.`;

    } else {
      // ── Fetch user + product count + order count ───────────────────────────
      const [userSnap, productsSnap, ordersSnap] = await Promise.all([
        db.doc(`users/${id}`).get(),
        db.collection('products').where('sellerId', '==', id).count().get(),
        db.collection('orders').where('sellerId', '==', id).count().get(),
      ]);

      if (!userSnap.exists) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }
      const user = userSnap.data() as {
        name?: string;
        email?: string;
        role?: string;
        verified?: boolean;
        createdAt?: { seconds: number };
      };

      targetName = user.name ?? user.email ?? id;
      const productCount = productsSnap.data().count;
      const orderCount   = ordersSnap.data().count;

      prompt = `Analyse this marketplace user account for fraud indicators. Return JSON only (no markdown): { "severity": "low"|"medium"|"high", "reason": string, "flagged": boolean }
User: ${user.name ?? 'Unknown'}, Email: ${user.email ?? 'unknown'}, Role: ${user.role ?? 'unknown'}, Verified: ${user.verified ?? false}, Products listed: ${productCount}, Orders: ${orderCount}
Look for: unusual activity patterns, suspicious email patterns, high listing volume with no orders, signs of impersonation or fake accounts.`;
    }

    // ── Run AI analysis ──────────────────────────────────────────────────────
    const analysis = await runAIFraudAnalysis(prompt, req);

    // ── Write FraudFlag if flagged ───────────────────────────────────────────
    let flagId: string | undefined;
    if (analysis.flagged) {
      const flagRef = db.collection('fraudFlags').doc();
      await flagRef.set({
        targetType: type,
        targetId:   id,
        targetName,
        reason:     analysis.reason,
        severity:   analysis.severity,
        status:     'open',
        detectedAt: FieldValue.serverTimestamp(),
      });
      flagId = flagRef.id;
    }

    return NextResponse.json({
      flagged:  analysis.flagged,
      severity: analysis.severity,
      reason:   analysis.reason,
      flagId,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
