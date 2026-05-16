# TradeCircle — Admin Guide

A friendly guide to administering your TradeCircle platform. Written for non-technical operators — no coding required.

> **Looking to deploy the app?** See `DEPLOYMENT.md` instead.

---

## Table of Contents

1. [First-Time Setup](#1-first-time-setup)
2. [Logging In](#2-logging-in)
3. [Admin Dashboard Overview](#3-admin-dashboard-overview)
4. [Creating Additional Admins](#4-creating-additional-admins)
5. [User Management](#5-user-management)
6. [Authentication & Session](#6-authentication--session)
7. [Permissions System](#7-permissions-system)
8. [Common Workflows](#8-common-workflows)
9. [Maintenance Schedule](#9-maintenance-schedule)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. First-Time Setup

Right after the app is deployed for the first time, you need to create the master administrator account.

1. Open your domain in a browser: `https://yourdomain.com/setup`
2. Fill in the form:
   - **Full Name** — e.g. *Jane Doe*
   - **Email** — your admin email (e.g. *admin@yourdomain.com*)
   - **Password** — minimum 8 characters, at least 1 uppercase letter and 1 number
   - **Confirm Password** — same as above
3. Click **Create Master Admin**.
4. You'll be redirected to `/admin/dashboard`.

> The `/setup` page **locks itself permanently** after the first super-admin is created. All additional admins must be added from inside the admin panel (see Section 4).

---

## 2. Logging In

1. Visit `https://yourdomain.com/login`.
2. Enter your admin email and password.
3. After signing in, click your avatar (top right). If you're an admin, you'll see an **Admin Dashboard** link.
4. Click it to enter `/admin/dashboard`.

> If you forget your password, use the **Forgot password?** link on the login page. A reset email will be sent.

---

## 3. Admin Dashboard Overview

The admin panel is organized as a left-hand sidebar. Each entry below opens a dedicated page.

| Section | What it does |
|---|---|
| **Dashboard** | High-level stats: total users, active listings, GMV, recent activity feed. |
| **Users** | Manage buyers, sellers and advisors — search, view, ban, unban, delete. |
| **Admin Users** | Manage administrator accounts — create new admins, assign roles, toggle module permissions. |
| **Fraud Flags** | Review listings/users flagged by AI for suspicious activity. Dismiss or take action. |
| **Products** | Moderate marketplace listings — feature, hide, remove, bulk-edit. |
| **Advisories** | Moderate advisor posts and articles. |
| **Enquiries** | View incoming contact-form submissions and respond. |
| **Orders** | Order history, payment status, refunds, fulfillment notes. |
| **Ads** | Manage banner ads and sponsored content placement. |
| **Ad Campaigns** | A/B test ad creatives and track conversions. |
| **Marketing SSO** | Connect Mailchimp / HubSpot / Meta accounts for marketing automation. |
| **Loyalty Program** | Configure point earning rules, tiers, and reward catalogue. |
| **AI Settings** | Configure OpenAI (or alternative) API key, model, and feature toggles. |
| **CMS** | Edit blog posts, FAQ entries, and static pages (About, Terms, Privacy). |
| **Tax** | Define regional tax rates (GST/VAT/sales tax). |
| **Feature Toggles** | Turn entire modules (chat, advisors, loyalty, etc.) ON/OFF without redeploying. |
| **Configuration** | Branding (logo/colors), backend selection (Firebase vs. Supabase), payment gateways, currency, theme. |
| **Tenant Branding** | White-label settings for multi-tenant deployments. |
| **Operator Billing** | Manage subscription tiers for tenants/operators. |
| **Operators** | List and manage multi-tenant operator accounts. |
| **Storage** | Switch active storage backend between Cloudinary and AWS S3. |
| **Analytics** | KPIs, charts, top sellers, GMV trends. |
| **Integrations** | GA4 measurement ID, Facebook Pixel ID, other tracking. |
| **Exports** | Download CSV reports (users, orders, products, transactions). |
| **System Backup** | Create, restore, and schedule Firestore backups. |
| **Roles** | Define regional admin hierarchies (country/region managers). |
| **API Keys** | Generate and revoke API keys for third-party integrations. |
| **System Status** | Service Level Agreement (SLA), incident log, current health. |
| **Geo-Targeted Ads** | Location-based ad delivery rules. |
| **Data Residency** | Choose Firebase region for compliance (e.g. EU, AU). |

---

## 4. Creating Additional Admins

1. From the sidebar, click **Admin Users**.
2. Click **Add Admin** (top right).
3. Fill in:
   - **Name** — the new admin's full name
   - **Email** — their work email (login email)
   - **Role** — pick one of:
     - **super-admin** — full access to everything
     - **admin** — broad access, but cannot manage other admins
     - **moderator** — limited to user/content moderation
     - **analyst** — read-only access to analytics & exports
4. Toggle individual **module permissions** on/off as needed.
5. Click **Save**.

The new admin will receive a **password reset email**. They click the link, set their own password, and can then log in at `/login`.

> You can change roles or permissions any time by clicking the admin in the list and editing.

---

## 5. User Management

1. Sidebar → **Users**.
2. Use the search bar at the top — search by email, name, or user ID.
3. Click a row to expand the user's detail panel.
4. Available actions:
   - **Ban** — sets `active = false`. User cannot log in. Listings hidden.
   - **Unban** — restores access.
   - **Delete** — permanent. Wipes user record and revokes auth.
   - **View Activity** — orders, messages, listings, login history.

> Banning is recoverable. Deletion is **not**. When in doubt, ban first.

---

## 6. Authentication & Session

The platform uses HTTP-only secure cookies to maintain logged-in sessions:

| Cookie | Purpose |
|---|---|
| `tc-session` | Encrypted ID token (validates user identity on every request) |
| `tc-role` | User role (buyer/seller/advisor/admin) for fast UI rendering |
| `tc-admin` | Admin flag for gated admin routes |

- **Session duration**: 7 days. After that, the user must log in again.
- **Logout**: clicking Logout clears all three cookies and revokes the refresh token on Firebase, immediately ending the session on all devices.

---

## 7. Permissions System

Each admin has **13 module-level permission flags**. They control which sidebar entries are visible to that admin.

- **super-admin** — all 13 flags automatically `true`. Cannot be reduced. Full power.
- **admin** — preset with most flags `true` except admin-user-management.
- **moderator** — preset focused on Users, Products, Advisories, Fraud Flags, Enquiries.
- **analyst** — preset focused on Analytics, Exports (read-only).

You can override any preset by toggling individual permissions in the Admin Users edit dialog. Saving instantly updates that admin's access (they may need to refresh).

---

## 8. Common Workflows

### Workflow 1 — Approve or reject a flagged product

1. Sidebar → **Fraud Flags**.
2. Browse the list (most recent first).
3. Click a row to open details — see the flag reason, AI confidence score, and the listing preview.
4. Decide:
   - **Dismiss flag** — listing stays live, flag cleared.
   - **Remove listing** — listing is hidden, seller notified.
   - **Ban seller** — escalate if the seller has multiple flags.

### Workflow 2 — Ban a problem user

1. Sidebar → **Users**.
2. Search by email or name.
3. Click their row.
4. Click **Ban** → confirm. The user is signed out immediately on all devices.

### Workflow 3 — Update site branding

1. Sidebar → **Configuration**.
2. Open the **Branding** tab.
3. Upload your logo (PNG or SVG), set primary/accent colors, set tagline.
4. Click **Save**. Changes go live within ~30 seconds.

### Workflow 4 — Schedule a weekly Firestore backup

1. Sidebar → **System Backup**.
2. Open the **Auto Backup** tab.
3. Toggle **Enabled** on.
4. Frequency: **Weekly**, Day: **Sunday**, Time: **02:00**.
5. Retention: 8 weeks.
6. Click **Save**. The system will run the backup automatically.

### Workflow 5 — Set up Google Analytics 4 tracking

1. Get your GA4 Measurement ID from https://analytics.google.com/ (format: `G-XXXXXXXXXX`).
2. Sidebar → **Integrations**.
3. Paste the ID into the **GA4 Measurement ID** field.
4. Click **Save**. Pageviews start tracking within a few minutes.

---

## 9. Maintenance Schedule

A recommended cadence to keep the platform healthy:

| Frequency | Tasks |
|---|---|
| **Daily** | Review **Fraud Flags**, respond to open **Enquiries**, scan **System Status** for incidents. |
| **Weekly** | Review **Analytics** trends, verify last **Backup** ran, check **Orders** for stuck payments. |
| **Monthly** | Review user growth, subscription/loyalty metrics, top sellers, and revenue. |
| **Quarterly** | Clean up archived data, **rotate API keys**, review admin user list (remove ex-employees), audit role permissions. |

---

## 10. Troubleshooting

### "Can't log in"
- Use **Forgot password?** on the login page to reset.
- Make sure the email is exactly the one you registered with.
- If still stuck, ask a super-admin to delete and re-create your admin record.

### "Permission denied" when opening a sidebar item
- Your admin role doesn't include that module flag.
- Ask a super-admin to enable the module for you in **Admin Users** → your row → toggle the flag.

### "Page won't load" / blank screen
- Check **System Status** for active incidents.
- Hard refresh the browser (Ctrl/Cmd + Shift + R).
- Try an Incognito window to rule out a broken cookie.
- Check the deployed app's status page in Vercel.

### "Image won't upload"
- Verify in **Storage** that an upload backend is selected and credentials are filled in.
- Ensure your Cloudinary preset is **unsigned** (see `DEPLOYMENT.md` §4.3).

### "AI features aren't working"
- Sidebar → **AI Settings** — verify the OpenAI API key is set and the toggle is on.
- Check that your OpenAI account has credit.

### "User got an email I didn't intend to send"
- Sidebar → **CMS / Marketing SSO** — review automation rules.
- Disable any automation triggers you don't recognize.

---

**Need more help?** Contact your technical administrator or refer to `DEPLOYMENT.md` for infrastructure-level issues.
