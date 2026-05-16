# TradeCircle — Deployment Guide

A complete, beginner-friendly, step-by-step guide to deploying the **TradeCircle** platform to **Vercel** with **Firebase** as the backend and **Cloudinary** for image hosting.

> If this is your first time deploying a Next.js app, follow each section in order. No step is optional unless explicitly marked.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [GitHub Setup](#2-github-setup)
3. [Firebase Project Setup](#3-firebase-project-setup)
4. [Cloudinary Setup](#4-cloudinary-setup)
5. [Environment Variables](#5-environment-variables)
6. [Local Development](#6-local-development)
7. [Vercel Deployment](#7-vercel-deployment)
8. [Custom Domain](#8-custom-domain)
9. [Post-Deployment Verification](#9-post-deployment-verification)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

Before you begin, make sure you have:

| Requirement | Purpose | Link |
|---|---|---|
| **Node.js 20+** | Runs the dev server and builds | https://nodejs.org/ |
| **Git** | Version control | https://git-scm.com/ |
| **GitHub account** | Hosts your code | https://github.com/ |
| **Vercel account** (free tier OK) | Hosts the deployed app | https://vercel.com/signup |
| **Firebase account** (free Spark plan OK) | Auth, Firestore database, Storage, FCM push | https://firebase.google.com/ |
| **Cloudinary account** (free tier OK) | Image uploads and CDN | https://cloudinary.com/users/register_free |

Verify Node and Git are installed:

```bash
node --version   # should print v20.x.x or higher
git --version    # should print git version 2.x.x
```

---

## 2. GitHub Setup

If your project is not already in a Git repository:

```bash
# From the project root
git init
git add .
git commit -m "Initial commit"
```

Create a new **empty** repository on GitHub (do NOT add a README, .gitignore or license — your local repo already has them). Then:

```bash
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/tradecircle.git
git push -u origin main
```

> Tip: If you use HTTPS instead of SSH, use `https://github.com/YOUR_USERNAME/tradecircle.git`.

---

## 3. Firebase Project Setup

### 3.1 Create the Firebase project

1. Go to https://console.firebase.google.com/
2. Click **Add project**, give it a name (e.g. `tradecircle-prod`), accept terms, and (optionally) disable Google Analytics for simpler setup.
3. Wait for the project to be created, then click **Continue**.

### 3.2 Register a Web App

1. On the project home page click the **`</>`** Web icon.
2. App nickname: `TradeCircle Web`. **Do NOT** check "Also set up Firebase Hosting".
3. Click **Register app**. Firebase will display a config object — keep this tab open, you'll need these values in Section 5:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "tradecircle-prod.firebaseapp.com",
  projectId: "tradecircle-prod",
  storageBucket: "tradecircle-prod.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 3.3 Enable Authentication

1. In the left sidebar: **Build → Authentication → Get started**.
2. On the **Sign-in method** tab, enable:
   - **Email/Password** (Save)
   - **Google** — set a project support email, then Save
   - **Phone** (Save) — note: requires billing to be on Blaze plan for production SMS; OK to skip for testing
3. On the **Settings → Authorized domains** tab, the default `localhost` and `*.firebaseapp.com` entries are pre-listed. You'll add your custom domain later (Section 8).

### 3.4 Enable Cloud Firestore

1. Left sidebar: **Build → Firestore Database → Create database**.
2. Choose a region close to your users (e.g. `australia-southeast1` for AU/NZ, `us-central1` for North America).
3. Start in **production mode** (we will apply security rules next).
4. Once created, go to the **Rules** tab. Open the file `firestore.rules` from this repo, copy its entire contents, paste them into the Firebase console editor, and click **Publish**.

> Alternative: install the Firebase CLI (`npm i -g firebase-tools`), run `firebase login`, `firebase init firestore`, and then `firebase deploy --only firestore:rules`.

### 3.5 Enable Cloud Storage

1. Left sidebar: **Build → Storage → Get started**.
2. Accept the default location (must match your Firestore region in most cases).
3. Start in **production mode**.
4. (Optional) Update Storage rules to mirror Firestore access patterns if you plan to upload files directly to Firebase Storage. The default app uses Cloudinary for images, so this is rarely needed.

### 3.6 Generate a Service Account (for server-side admin SDK)

1. In the Firebase console, click the **gear icon → Project settings → Service accounts** tab.
2. Click **Generate new private key**, confirm **Generate key**. A JSON file will download.
3. Open the JSON in a text editor. You'll paste its full contents (as a single line) into the `FIREBASE_SERVICE_ACCOUNT_JSON` env var in Section 5.

> **NEVER** commit this JSON to Git. Treat it like a password.

### 3.7 Configure Web Push (VAPID key) — optional but recommended

1. **Project settings → Cloud Messaging** tab.
2. Scroll to **Web Push certificates**, click **Generate key pair**.
3. Copy the **Key pair** value — this is your `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.

Also note the **Sender ID** at the top of the Cloud Messaging tab — that's your `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`.

---

## 4. Cloudinary Setup

### 4.1 Create the account

1. Sign up at https://cloudinary.com/users/register_free.
2. After verifying your email, you'll land on the dashboard.

### 4.2 Get your Cloud Name

On the dashboard, you'll see **Cloud name**: e.g. `dxyz12345`. Copy this — it goes in `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.

### 4.3 Create an Unsigned Upload Preset

1. Click the gear icon → **Settings → Upload** tab.
2. Scroll to **Upload presets**, click **Add upload preset**.
3. **Preset name**: `tradecircle_unsigned` (or anything memorable).
4. **Signing mode**: change from "Signed" to **Unsigned**.
5. (Optional) Set a folder like `tradecircle/` so all uploads are grouped.
6. Click **Save**.

The preset name goes in `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.

---

## 5. Environment Variables

These are every variable the app reads. Mandatory ones are marked **required**.

```dotenv
# ─────────────────────────────────────────────
# Firebase Client (REQUIRED — public, safe in browser)
# ─────────────────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=PROJECT.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=PROJECT
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=PROJECT.firebasestorage.app
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BL...   # optional, only for web push

# ─────────────────────────────────────────────
# Firebase Admin (REQUIRED for /api/session, /api/admin/*)
# Paste the entire service account JSON as a single line
# ─────────────────────────────────────────────
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",...}

# ─────────────────────────────────────────────
# Cloudinary (REQUIRED for product/avatar image uploads)
# ─────────────────────────────────────────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=mycloud
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=tradecircle_unsigned

# ─────────────────────────────────────────────
# Optional integrations
# ─────────────────────────────────────────────

# OpenAI — for AI-driven fraud detection, recommendations, etc.
# Prefer setting via Admin Panel → AI Settings instead of env.
OPENAI_API_KEY=sk-...

# EmailJS — transactional emails
EMAILJS_PUBLIC_KEY=
EMAILJS_SERVICE_ID=

# Stripe — payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PAYMENT_LINK_URL=https://buy.stripe.com/...

# eWAY — alternative payment gateway
EWAY_API_KEY=
EWAY_PASSWORD=

# AWS S3 — alternative storage backend (instead of Cloudinary)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=

# Google Analytics 4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

> **Tip — pasting the service account JSON into Vercel**: When pasting into Vercel's env var UI, you can paste the multi-line JSON directly into the value field — Vercel preserves it correctly. For your local `.env.local`, you must keep it on a single line (escape newlines in `private_key` are already `\n` in the JSON).

---

## 6. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.example .env.local

# 3. Open .env.local and paste the values from Section 5

# 4. Start the dev server
npm run dev
```

Open http://localhost:3000 — the homepage should load.

### First-run: Create the master admin

Visit **http://localhost:3000/setup** in your browser.

- Fill in your full name, email, and a strong password (min 8 chars, 1 uppercase, 1 number).
- Click **Create Master Admin**.
- You'll be redirected to `/admin/dashboard`.

This page locks itself after the first super-admin is created — additional admins must be added from the admin panel (see `ADMIN_GUIDE.md`).

---

## 7. Vercel Deployment

### 7.1 Import the project

1. Go to https://vercel.com/new.
2. Click **Import Git Repository** and select your TradeCircle repo.
3. Vercel auto-detects **Next.js**. Leave defaults:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 7.2 Add environment variables

Click **Environment Variables** and add every variable from Section 5.

For each variable:
- **Name**: e.g. `NEXT_PUBLIC_FIREBASE_API_KEY`
- **Value**: paste the actual value
- **Environments**: tick **Production**, **Preview**, and **Development**

> Repeat for all variables. Don't deploy until they're all in.

### 7.3 Deploy

Click **Deploy**. The first build takes 2-5 minutes. When it finishes you'll get a URL like `https://tradecircle-xyz.vercel.app`.

Visit the URL — the homepage should load. If it doesn't, see Section 10.

---

## 8. Custom Domain

### 8.1 Add domain in Vercel

1. In your Vercel project: **Settings → Domains**.
2. Type your domain (e.g. `tradecircle.com.au`), click **Add**.
3. Vercel will show DNS records to configure.

### 8.2 Configure DNS

Go to your domain registrar (GoDaddy, Cloudflare, Namecheap, etc.) and add:

- **Root domain** (`tradecircle.com.au`): A record → `76.76.21.21`
- **www subdomain**: CNAME → `cname.vercel-dns.com`

Save. DNS propagation usually takes 1-30 minutes.

### 8.3 Wait for SSL

Vercel auto-provisions a Let's Encrypt SSL cert (typically <1 minute after DNS resolves). The domain badge will turn green.

### 8.4 Update Firebase authorized domains

1. Firebase console → **Authentication → Settings → Authorized domains**.
2. Click **Add domain**, enter `tradecircle.com.au` (and `www.tradecircle.com.au` if used).

Without this, Google Sign-In and password reset emails will fail on your production domain.

---

## 9. Post-Deployment Verification

Run through this checklist:

- [ ] Homepage loads at your domain
- [ ] `/signup` creates a new user (verify it appears in Firebase → Authentication → Users)
- [ ] `/login` signs in with that user
- [ ] `/admin/dashboard` is accessible after logging in as the admin from Section 6
- [ ] `/products/new` — create a product, upload an image (verify it appears in Cloudinary dashboard → Media Library)
- [ ] `/messages` — send a message to another user; verify it appears in real-time
- [ ] `/settings` — push permission prompt appears (if VAPID is configured)
- [ ] No "Missing Firebase env var" warnings in browser console
- [ ] Vercel → Deployments → latest → Functions tab: no 500 errors in `/api/session` or `/api/admin/*`

---

## 10. Troubleshooting

### "Missing Firebase env var" warning in console

Some `NEXT_PUBLIC_FIREBASE_*` variable is missing from Vercel.
**Fix**: Vercel → Settings → Environment Variables — verify all 6 (plus VAPID) are present for the Production environment. Redeploy.

### 500 error on `/api/session` or `/api/admin/*`

`FIREBASE_SERVICE_ACCOUNT_JSON` is missing or malformed.
**Fix**: Re-download the service account from Firebase Project Settings → Service Accounts, paste the entire JSON contents into the Vercel env var (no surrounding quotes needed), redeploy.

### Images fail to upload from `/products/new`

Cloudinary upload preset is **signed**, not unsigned.
**Fix**: Cloudinary → Settings → Upload → Upload presets → edit your preset → Signing mode = **Unsigned** → Save.

### Firestore "permission denied" errors in console

Security rules not deployed.
**Fix**: Either copy `firestore.rules` into Firebase Console → Firestore → Rules and click Publish, or run `firebase deploy --only firestore:rules` from your local repo.

### Build fails on Vercel with TypeScript errors

The project ships with `typescript.ignoreBuildErrors: true` already configured in `next.config.ts` to handle harmless type warnings. If you still see errors:
**Fix**: open `next.config.ts` and confirm:
```ts
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

### Google Sign-In returns "auth/unauthorized-domain"

Your production domain is not in Firebase's authorized domain list.
**Fix**: Firebase → Authentication → Settings → Authorized domains → Add domain.

### Phone auth doesn't work

Phone auth requires the Firebase **Blaze (pay-as-you-go)** plan in production.
**Fix**: upgrade in Firebase Console → Usage & billing → Modify plan.

### Push notifications never arrive

- VAPID key missing or wrong.
- Service worker not registered (check DevTools → Application → Service Workers).
**Fix**: confirm `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is set, hard-refresh, accept the browser permission prompt.

### "Quota exceeded" on Firestore reads

You've hit the free Spark plan's daily quota (50K reads).
**Fix**: upgrade to Blaze plan (still effectively free for small apps — you pay only for usage above the free allowance).

---

**Need more help?** Check the project README for support links, or open an issue on GitHub.
