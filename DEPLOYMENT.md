# TradeCircle — Deployment Guide

A complete, beginner-friendly, step-by-step guide to deploying the **TradeCircle** platform to **Vercel** with **Firebase** as the backend and **Cloudinary** for image hosting.

> If this is your first time deploying a Next.js app, follow each section in order. No step is optional unless explicitly marked.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [GitHub Setup](#2-github-setup)
3. [Firebase Project Setup](#3-firebase-project-setup)
4. [Cloudinary Setup](#4-cloudinary-setup)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Local Development (with bootstrap admin)](#6-local-development-with-bootstrap-admin)
7. [Vercel Deployment](#7-vercel-deployment)
8. [First-Time Admin Setup](#8-first-time-admin-setup)
9. [Firestore Security Rules Deployment](#9-firestore-security-rules-deployment)
10. [Health Check & Diagnostics](#10-health-check--diagnostics)
11. [Custom Domain](#11-custom-domain)
12. [Post-Deployment Verification](#12-post-deployment-verification)
13. [Troubleshooting](#13-troubleshooting)
14. [Common Errors Cookbook](#14-common-errors-cookbook)

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
| **A text editor** (VS Code recommended) | Editing env files and code | https://code.visualstudio.com/ |

Verify Node and Git are installed:

```bash
node --version   # should print v20.x.x or higher
git --version    # should print git version 2.x.x
```

> **Windows users**: PowerShell 5.1+ is the default shell in the documentation examples. Where bash equivalents differ, both are shown.

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

### 2.1 .gitignore essentials

Before your first push, confirm `.gitignore` includes:

```
.env
.env.local
.env.*.local
.tradecircle-local/
.next/
node_modules/
*.log
```

The `.tradecircle-local/` folder holds your **bootstrap admin credentials** (see Section 8). It MUST never be committed.

---

## 3. Firebase Project Setup

This is the most important external setup step. Get it wrong and you'll see cryptic 5xx errors in production. Follow each substep carefully.

### 3.1 Create the Firebase project

1. Go to https://console.firebase.google.com/
2. Click **Add project**, give it a name (e.g. `tradecircle-prod`), accept terms.
3. Disable Google Analytics for a simpler setup (you can always add GA4 later via the admin panel).
4. Wait ~30 seconds for the project to be created, then click **Continue**.

### 3.2 Enable Authentication (REQUIRED)

This is required before any user — including your first admin — can sign in.

1. Left sidebar: **Build → Authentication → Get started**.
2. On the **Sign-in method** tab, click **Email/Password** and toggle **Enable** → **Save**.
3. (Optional) Also enable **Google** — set a project support email, then Save.
4. (Optional) **Phone** — note: requires Blaze billing for production SMS; OK to skip for testing.

> **Without Email/Password enabled, the bootstrap admin migration step will fail with `auth/operation-not-allowed`.**

### 3.3 Enable Cloud Firestore (REQUIRED)

1. Left sidebar: **Build → Firestore Database → Create database**.
2. Pick a region close to your users:
   - **australia-southeast1** (Sydney) — recommended for AU/NZ
   - **us-central1** — North America default
   - **europe-west3** (Frankfurt) — EU
   > The region cannot be changed later. Choose carefully.
3. Start in **production mode** (we will deploy security rules in Section 9).
4. Wait for the database to provision (~30 seconds).

> **Without Firestore created, all `/api/admin/*` routes will return `5 NOT_FOUND`.**

### 3.4 Enable Cloud Storage (REQUIRED)

1. Left sidebar: **Build → Storage → Get started**.
2. Accept the default location (must match your Firestore region).
3. Start in **production mode**.

Note: TradeCircle uses Cloudinary by default for image uploads, but Firebase Storage is still required by the SDK initialization.

### 3.5 Generate the Web SDK config

1. Project home → click the gear icon → **Project settings → General**.
2. Scroll to **Your apps** → click the **`</>`** Web icon.
3. App nickname: `TradeCircle Web`. **Do NOT** check "Also set up Firebase Hosting".
4. Click **Register app**. Firebase will display a config object — keep this tab open:

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

These six values become the `NEXT_PUBLIC_FIREBASE_*` env vars in Section 5.

### 3.6 Generate a Service Account JSON (REQUIRED)

This is a **separate download** from the Web SDK config above.

1. Project Settings → **Service Accounts** tab.
2. Click **Generate new private key** → confirm **Generate key**.
3. A JSON file downloads (e.g. `tradecircle-prod-firebase-adminsdk-xxx.json`).
4. Open the JSON in a text editor — you'll paste its full contents into the `FIREBASE_SERVICE_ACCOUNT_JSON` env var in Section 5.

> **NEVER** commit this JSON to Git. Treat it like a password.
>
> The service account is **required for**:
> - `/setup` on Vercel (writing the master admin directly to Auth + Firestore)
> - `/api/admin/*` server routes (user CRUD, exports, backups)
> - `/api/session` session-cookie verification

### 3.7 Note the Web Push (VAPID) key — optional

1. Project settings → **Cloud Messaging** tab.
2. Scroll to **Web Push certificates**, click **Generate key pair**.
3. Copy the **Key pair** value — this is `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.

The Sender ID at the top of this tab is your `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`.

### 3.8 Summary — what you should now have

- [ ] A Firebase project (Web SDK config — 6 values)
- [ ] Email/Password sign-in **enabled**
- [ ] Firestore database **created** (production mode)
- [ ] Cloud Storage **enabled**
- [ ] Service account JSON downloaded to your computer
- [ ] (Optional) VAPID Web Push key

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

> If uploads fail with a 401 from Cloudinary, the preset is still Signed — re-check step 4.

---

## 5. Environment Variables Reference

Every variable the app reads, with description, example, where to get it, and which environments it belongs in.

| Variable | Required? | Description | Example | Where to get | Environments |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | **Yes** | Public web SDK API key | `AIzaSyA...` | Section 3.5 | Prod / Preview / Dev |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | **Yes** | OAuth redirect domain | `tradecircle-prod.firebaseapp.com` | Section 3.5 | Prod / Preview / Dev |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | **Yes** | Firebase project ID | `tradecircle-prod` | Section 3.5 | Prod / Preview / Dev |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | **Yes** | Cloud Storage bucket | `tradecircle-prod.firebasestorage.app` | Section 3.5 | Prod / Preview / Dev |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | **Yes** | Web app identifier | `1:123:web:abc` | Section 3.5 | Prod / Preview / Dev |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | **Yes** | FCM sender ID | `123456789` | Section 3.5 or 3.7 | Prod / Preview / Dev |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | No | Web push VAPID key | `BL...` | Section 3.7 | Prod / Preview / Dev |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Yes** | Full service-account JSON (one line) | `{"type":"service_account",...}` | Section 3.6 | Prod / Preview / Dev |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | **Yes** | Cloudinary cloud name | `dxyz12345` | Section 4.2 | Prod / Preview / Dev |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | **Yes** | Unsigned preset name | `tradecircle_unsigned` | Section 4.3 | Prod / Preview / Dev |
| `OPENAI_API_KEY` | No | AI fraud detection, recs | `sk-...` | platform.openai.com | Prod (prefer Admin UI) |
| `EMAILJS_PUBLIC_KEY` | No | Transactional email | `xxxxxxx` | emailjs.com | Prod |
| `EMAILJS_SERVICE_ID` | No | EmailJS service ID | `service_xxx` | emailjs.com | Prod |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Stripe public key | `pk_live_...` | dashboard.stripe.com | Prod |
| `STRIPE_PAYMENT_LINK_URL` | No | Stripe payment link | `https://buy.stripe.com/...` | Stripe Payment Links | Prod |
| `EWAY_API_KEY` | No | eWAY gateway | `xxxxx` | eWAY portal | Prod |
| `EWAY_PASSWORD` | No | eWAY API password | `xxxxx` | eWAY portal | Prod |
| `AWS_ACCESS_KEY_ID` | No | S3 alt storage | `AKIA...` | AWS IAM | Prod |
| `AWS_SECRET_ACCESS_KEY` | No | S3 alt storage | `xxxxx` | AWS IAM | Prod |
| `AWS_REGION` | No | S3 region | `us-east-1` | AWS | Prod |
| `AWS_S3_BUCKET` | No | S3 bucket | `tradecircle-uploads` | AWS | Prod |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | GA4 measurement ID | `G-XXXXXXXXXX` | analytics.google.com | Prod |

### 5.1 Pasting the service-account JSON

When pasting `FIREBASE_SERVICE_ACCOUNT_JSON` into Vercel's env var UI, you can paste the multi-line JSON directly into the value field — Vercel preserves it correctly.

For your local `.env.local`, you must keep it on a **single line** (the embedded `\n` sequences inside `private_key` are already escaped — leave them as-is):

```dotenv
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",...}
```

---

## 6. Local Development (with bootstrap admin)

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.example .env.local      # PowerShell: Copy-Item .env.example .env.local

# 3. Open .env.local and paste the values from Section 5
#    (Firebase config is optional for first-run — see below)

# 4. Start the dev server
npm run dev
```

Open http://localhost:3000 — the homepage should load.

### 6.1 Two ways to run locally

TradeCircle supports two local-dev modes:

1. **Full Firebase mode** — `.env.local` has every `NEXT_PUBLIC_FIREBASE_*` plus `FIREBASE_SERVICE_ACCOUNT_JSON`. The `/setup` page writes directly to Firebase Auth + Firestore.

2. **Bootstrap mode** — `.env.local` is empty (or missing Firebase keys). The `/setup` page writes the admin to a local JSON file at `.tradecircle-local/config.json`. You can later run the **Firebase Setup Wizard** at `/admin/firebase-setup` to migrate to a real Firebase project.

Bootstrap mode lets developers explore the platform without needing a Firebase project on day one.

### 6.2 Clearing dev caches

If you've just installed new dependencies or upgraded Next.js and see stale errors, clear the `.next` cache:

```powershell
# PowerShell
Remove-Item -Recurse -Force .next
npm run dev
```

```bash
# bash / zsh
rm -rf .next
npm run dev
```

---

## 7. Vercel Deployment

### 7.1 Import the project

1. Go to https://vercel.com/new.
2. Click **Add New Project → Import Git Repository** and select your TradeCircle repo.
3. Vercel auto-detects **Next.js**. Leave defaults:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build` (do not change)
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
   - **Node.js Version**: 20.x (the project requires 20+)

### 7.2 Add environment variables — BEFORE first deploy

Click **Environment Variables** and add every variable from Section 5. **Add them before clicking Deploy** — a half-configured first deployment frequently caches missing-env warnings.

For each variable:
- **Name**: e.g. `NEXT_PUBLIC_FIREBASE_API_KEY`
- **Value**: paste the actual value
- **Environments**: tick **Production**, **Preview**, and **Development** (all three)

For `FIREBASE_SERVICE_ACCOUNT_JSON`: open the downloaded JSON file in a text editor, select all (Ctrl+A), copy (Ctrl+C), and paste the entire content into the value field. Vercel handles the multi-line value correctly.

### 7.3 Deploy

Click **Deploy**. The first build takes 2–5 minutes. When it finishes you'll get a URL like `https://tradecircle-xyz.vercel.app`.

Visit the URL. The homepage should load. If it shows "Page couldn't load", jump to Section 10 (health check) before anything else.

### 7.4 Subsequent deploys

Every push to `main` triggers a new production deploy automatically. Pushes to any other branch create a Preview deployment.

To redeploy without a code change (e.g. after adding an env var):
- Vercel → Deployments → click the **⋯** menu → **Redeploy**.

---

## 8. First-Time Admin Setup

TradeCircle uses a **hybrid bootstrap** model so the platform is usable both with and without Firebase fully configured.

### 8.1 Hybrid behavior — what happens at `/setup`

| Environment | What `/setup` does |
|---|---|
| **Vercel (production)** | Detects `VERCEL=1`. Uses Firebase Admin SDK to write directly to Firebase Auth + Firestore. **Requires `FIREBASE_SERVICE_ACCOUNT_JSON`.** Never touches the filesystem. |
| **Local dev (full Firebase)** | If `.env.local` has Firebase keys, writes to Firebase Auth + Firestore. |
| **Local dev (bootstrap)** | If no Firebase keys, writes admin credentials to `.tradecircle-local/config.json`. You can migrate later. |

> The local-file path is **disabled on Vercel** to avoid `ENOENT: no such file or directory, mkdir /var/task/.tradecircle-local`. Environment detection (`process.env.VERCEL`) gates this.

### 8.2 Walk-through — the `/setup` form

1. Visit `https://yourdomain.com/setup` (or `http://localhost:3000/setup`).
2. Fill in:
   - **Full Name** — e.g. *Jane Doe*
   - **Email** — admin email (e.g. *admin@yourdomain.com*)
   - **Password** — min 8 chars, 1 uppercase, 1 number
   - **Confirm Password** — must match
3. Click **Create Master Admin**.
4. You'll be redirected to `/admin/dashboard`.

The page locks itself after first use — subsequent admins are added via the admin panel.

### 8.3 Walk-through — the Firebase Setup Wizard (local dev only)

If you started in bootstrap mode and now want to connect to a real Firebase project, visit `/admin/firebase-setup`. The wizard has four steps:

| Step | Title | What it asks for |
|---|---|---|
| 1 | **Welcome** | Overview, links to Section 3 of this guide |
| 2 | **Keys + Test** | The six `NEXT_PUBLIC_FIREBASE_*` values. Click **Test connection** to verify with a real Firebase API call. |
| 3 | **Service Account** | Paste the contents of the service account JSON. Validated client-side. |
| 4 | **Download .env** | Generates a complete `.env.local` for you to download. Restart `npm run dev` to apply. |

### 8.4 Migrate bootstrap admin to Firebase

If you created your admin in bootstrap mode and want to move them into Firebase:

1. Complete the Firebase Setup Wizard (8.3) and restart the dev server.
2. Visit `/admin/firebase-setup` again.
3. A new banner **"Migrate Admin to Firebase"** is displayed.
4. Click it. The system:
   - Creates the user in Firebase Auth using the bootstrap email + a temporary password
   - Writes the `users/{uid}` document with role `super-admin`
   - Sends a password reset email so the admin can choose their real password
   - Deletes the entry from `.tradecircle-local/config.json`

### 8.5 Resetting the local admin

If you forget the bootstrap password or want to start over:

```bash
curl -X DELETE http://localhost:3000/api/local-auth/reset
```

Or simply delete the file:

```powershell
Remove-Item .tradecircle-local\config.json
```

Then revisit `/setup`.

---

## 9. Firestore Security Rules Deployment

The `firestore.rules` file in the repo defines who can read/write each Firestore collection. **These must be deployed** — without them, every Firestore call fails with `Missing or insufficient permissions`.

### 9.1 Method A — Paste into Firebase Console (no CLI)

1. Open `firestore.rules` from the repo in your editor and **copy the entire file**.
2. Go to Firebase Console → **Firestore Database → Rules**.
3. Select all in the editor (Ctrl+A) and paste your rules over the default.
4. Click **Publish**.
5. Wait for the green confirmation banner.

Alternatively, link directly to the raw file on GitHub:

```
https://raw.githubusercontent.com/YOUR_USERNAME/tradecircle/main/firestore.rules
```

Then copy/paste into the console.

### 9.2 Method B — Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # pick your project
firebase deploy --only firestore:rules
```

### 9.3 When to redeploy rules

Redeploy any time `firestore.rules` changes — typically after pulling new code that touches access patterns (new collection, changed role checks, etc.).

### 9.4 What the rules allow (summary)

- `users/{uid}` — readable by the owner and any admin; writable by the owner or an admin
- `products/*` — public read; write restricted to the seller (`ownerId == request.auth.uid`)
- `messages/*` — readable/writable only by participants
- `adminLogs/*` — admin-only read; server-side write
- See `firestore.rules` for the authoritative list

---

## 10. Health Check & Diagnostics

The platform ships a built-in health endpoint at `/api/health`. It's the **first thing to check** if a deploy looks broken.

### 10.1 Hitting the endpoint

```bash
curl https://your-app.vercel.app/api/health
```

Sample response:

```json
{
  "ok": true,
  "firebase": true,
  "firebaseAdmin": true,
  "cloudinary": true,
  "timestamp": "2026-05-17T12:34:56.789Z"
}
```

### 10.2 What each boolean means

| Field | True when… | If false, fix by… |
|---|---|---|
| `firebase` | All six `NEXT_PUBLIC_FIREBASE_*` env vars are present | Add the missing client env vars in Vercel, redeploy |
| `firebaseAdmin` | `FIREBASE_SERVICE_ACCOUNT_JSON` parses successfully | Re-paste the service account JSON (full content, valid JSON), redeploy |
| `cloudinary` | Both cloud name + upload preset env vars are set | Add Cloudinary env vars in Vercel, redeploy |
| `ok` | All of the above are true | See specific field that is false |

### 10.3 Diagnostic workflow

1. Open `/api/health` first. If any field is `false`, fix the env var before debugging anything else.
2. If everything is `true` but pages still fail, check **Vercel → Deployments → latest → Functions** for runtime errors.
3. If Firestore reads fail, jump to Section 9 (rules deployment).
4. If Auth login fails, confirm Email/Password is enabled in Firebase (Section 3.2).

---

## 11. Custom Domain

### 11.1 Add domain in Vercel

1. Vercel project → **Settings → Domains**.
2. Type your domain (e.g. `tradecircle.com.au`), click **Add**.
3. Vercel shows DNS records to configure.

### 11.2 Configure DNS

At your registrar (GoDaddy, Cloudflare, Namecheap, etc.):

- **Root domain** (`tradecircle.com.au`): A record → `76.76.21.21`
- **www subdomain**: CNAME → `cname.vercel-dns.com`

Save. DNS propagation usually takes 1–30 minutes.

### 11.3 SSL

Vercel auto-provisions a Let's Encrypt SSL cert (typically <1 minute after DNS resolves). The domain badge turns green.

### 11.4 Update Firebase authorized domains

Firebase → **Authentication → Settings → Authorized domains** → **Add domain** → enter `tradecircle.com.au` (and `www.tradecircle.com.au` if used).

Without this, Google Sign-In and password reset emails fail on your production domain.

---

## 12. Post-Deployment Verification

Run through this checklist after the first successful deploy.

- [ ] `/api/health` returns all-true
- [ ] Homepage loads at your custom domain
- [ ] `/setup` creates the master admin (verify in Firebase → Authentication → Users)
- [ ] `/login` signs in with that admin
- [ ] `/admin/dashboard` is accessible and shows zero errors in the browser console
- [ ] `/admin/users` lists the master admin
- [ ] Create a test user from `/admin/users → Add User` — receives invite email
- [ ] `/products/new` — upload an image (verify in Cloudinary → Media Library)
- [ ] `/messages` — send a message; appears in real-time
- [ ] `/settings` — push permission prompt appears (if VAPID configured)
- [ ] No "Missing Firebase env var" warnings in browser console
- [ ] Vercel → Deployments → Functions tab: no 500 errors on `/api/session` or `/api/admin/*`

---

## 13. Troubleshooting

### "Page couldn't load" / blank screen on Vercel

Missing env vars are the #1 cause. **First step**: hit `/api/health` and check which booleans are `false`. Fix those vars in Vercel → Settings → Environment Variables, then redeploy.

### `5 NOT_FOUND` in Vercel logs

Firestore database was not created (Section 3.3). Go to Firebase Console → Firestore Database → **Create database**.

### `CONFIGURATION_NOT_FOUND` (Firebase Auth)

The Email/Password sign-in provider is not enabled. Firebase Console → Authentication → Sign-in method → **Email/Password → Enable**.

### `Missing or insufficient permissions`

`firestore.rules` has not been deployed. Follow Section 9.

### `ENOENT: no such file or directory, mkdir /var/task/.tradecircle-local`

A local-file write code path is being called on Vercel. This was **fixed** by the `process.env.VERCEL` environment guard in `/api/setup` and `/api/local-auth/*`. If you see this on a fresh deploy, pull the latest `main` branch.

### `JSON.parse: unexpected end of data`

A server route returned an empty response body. Open **Vercel → Deployments → Functions** for the route in question and read the runtime logs — there's usually a thrown error before the response is written.

### `auth/email-already-exists` on `/setup`

A master admin already exists for this email. Either:
- Use the **Forgot password** link at `/login`, or
- Delete the user from Firebase Console → Authentication → Users → ⋯ → Delete, then revisit `/setup`.

### "Incorrect email or password" on `/login`

- The email or password doesn't match what's stored in Firebase Auth.
- Use the **Forgot password** link to reset, or reset the password from Firebase Console → Authentication → Users → ⋯ → Reset password.

### Stale `.next` cache after `npm install`

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

### Vercel build fails on `/following` prerender

Fixed by wrapping the page in a server component with `export const dynamic = 'force-dynamic'`. If you still see it, ensure `app/following/page.tsx` exports `dynamic = 'force-dynamic'` and that any client logic lives in a separate child component.

### Browser error: `applyTheme is not a function`

Fixed by exposing `setTheme` as an alias on the theme provider context. If a custom theme component still throws, ensure it's importing from the project's `ThemeProvider` and not a stale module.

### Tailwind utilities not applying (especially `max-w-*`)

Fixed in `app/globals.css` with `@utility` overrides using `!important` for the t-shirt sizes. If you add a new utility and it's overridden by another rule, add it to the override block.

### Google Sign-In returns `auth/unauthorized-domain`

Your production domain is not in Firebase's authorized domain list. Firebase → Authentication → Settings → Authorized domains → Add domain.

### Phone auth doesn't work

Phone auth requires the Firebase **Blaze (pay-as-you-go)** plan in production. Upgrade in Firebase Console → Usage & billing → Modify plan.

### Push notifications never arrive

- VAPID key missing or wrong.
- Service worker not registered (DevTools → Application → Service Workers).
- Confirm `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is set, hard-refresh, accept the browser permission prompt.

### "Quota exceeded" on Firestore reads

You've hit the Spark plan's daily quota (50K reads). Upgrade to Blaze — still effectively free for small apps.

### Build fails on Vercel with TypeScript errors

`next.config.ts` ships with `typescript.ignoreBuildErrors: true` already configured. If you still see errors, confirm:

```ts
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

---

## 14. Common Errors Cookbook

A one-stop table of every error message we've seen during Phase 6 deployments, with root cause and fix.

| Error message | Root cause | Fix | Reference |
|---|---|---|---|
| Page couldn't load (blank) | Missing env vars on Vercel | Check `/api/health` and add missing vars | §10 |
| `5 NOT_FOUND` | Firestore DB not created | Create Firestore in production mode | §3.3 |
| `CONFIGURATION_NOT_FOUND` | Email/Password sign-in disabled | Enable in Firebase Auth → Sign-in method | §3.2 |
| `Missing or insufficient permissions` | Firestore rules not deployed | Paste `firestore.rules` into Firebase Console | §9 |
| `ENOENT … /var/task/.tradecircle-local` | Local-file path called on Vercel | Pull latest main (env detection added) | §13 |
| `JSON.parse: unexpected end of data` | Server route returned empty body | Read Vercel function logs | §13 |
| `auth/email-already-exists` | Admin exists already | Reset password or delete in Firebase Console | §13 |
| `Incorrect email or password` | Password mismatch | Forgot Password link, or reset in console | §13 |
| `auth/unauthorized-domain` | Domain not authorized in Firebase | Add to Authorized domains | §11.4 |
| `auth/operation-not-allowed` | Sign-in provider disabled | Enable Email/Password | §3.2 |
| `applyTheme is not a function` | Stale theme provider | Pull latest main (setTheme alias added) | §13 |
| Tailwind `max-w-*` not applying | Utility override conflict | Already fixed in `globals.css` `@utility` block | §13 |
| Cloudinary 401 on upload | Preset still Signed | Change preset to Unsigned | §4.3 |
| `firebase-admin/app` initialization failure | `FIREBASE_SERVICE_ACCOUNT_JSON` malformed | Re-paste full JSON contents | §3.6 |
| `/following` prerender failure | Static prerender on dynamic page | Confirm `dynamic = 'force-dynamic'` | §13 |
| Stale errors after dep install | `.next` cache | `Remove-Item -Recurse -Force .next` | §6.2 |
| Push notifications missing | VAPID key missing / SW not registered | Set VAPID, hard refresh, allow prompt | §13 |
| Firestore "Quota exceeded" | Spark free tier limit | Upgrade to Blaze | §13 |

---

**Need more help?** Check the project README for support links, or open an issue on GitHub.
