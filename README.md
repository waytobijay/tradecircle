# TradeCircle

> A full-featured, multi-tenant, white-label marketplace platform with built-in advisor network, loyalty program, AI-powered fraud detection, and real-time messaging.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20FCM-FFCA28?logo=firebase)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/)

---

## Quick Start

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

Open http://localhost:3000 and navigate to `/setup` to create your master admin account.

> **First time?** Follow the full deployment walkthrough in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## Documentation

| Document | Audience | What's inside |
|---|---|---|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | DevOps / developers | End-to-end deploy guide: Firebase + Cloudinary + Vercel, bootstrap admin, `/api/health`, custom domain, full troubleshooting + errors cookbook. |
| [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) | Operators / admins | How to use the admin panel: user CRUD, bootstrap admin flow, Firebase Setup Wizard, login media, health diagnostics, common workflows. |
| [TradeCircle-Documentation.pdf](./TradeCircle-Documentation.pdf) | All audiences | Combined PDF of DEPLOYMENT + ADMIN_GUIDE with cover page, TOC, and page numbers. |
| [platform-design-spec.md](./platform-design-spec.md) | Architects / product | Full project specification: modules, data model, design tokens, feature catalogue. |
| [.env.example](./.env.example) | Developers | Annotated list of every environment variable the app reads. |

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, Server Components)
- **Language**: TypeScript
- **Backend (primary)**: Firebase — Auth, Firestore, Cloud Storage, FCM
- **Backend (optional adapter)**: Supabase
- **Image hosting**: Cloudinary (with optional AWS S3 adapter)
- **Styling**: Tailwind CSS 4
- **Hosting**: Vercel
- **AI**: OpenAI (configurable provider)
- **Payments**: Stripe and eWAY adapters

---

## Features

- Marketplace listings (buy / sell / advisor services)
- Real-time messaging between users
- AI-driven fraud flagging and recommendations
- Advisor network with bookings and content
- Loyalty program with tiers, points and rewards
- Multi-tenant white-label support (per-tenant branding, billing, configuration)
- Admin dashboard with 30+ modules (users, orders, products, ads, analytics, backups, etc.)
- Granular role-based permissions
- Web push notifications via Firebase Cloud Messaging
- Geo-targeted ads and regional tax configuration
- CMS (blog, FAQ, static pages)
- CSV exports and scheduled Firestore backups
- GA4 + Facebook Pixel integration
- Configurable backend (Firebase or Supabase) and storage (Cloudinary or S3)

For the full feature spec, see the in-repo specification files or the Admin Guide module reference.

---

## Project Scripts

```bash
npm run dev      # start local dev server (http://localhost:3000)
npm run build    # production build
npm run start    # serve a production build locally
npm run lint     # run ESLint
```

---

## Repository Layout

```
app/              Next.js App Router pages and API routes
  admin/          Admin dashboard (modules listed in ADMIN_GUIDE.md §3)
  api/            Server routes (session, admin, payments, AI)
components/      Shared React components
lib/             Firebase clients, adapters, helpers
types/           TypeScript type definitions
firestore.rules  Firestore security rules (deploy to Firebase Console)
DEPLOYMENT.md    Full deployment guide
ADMIN_GUIDE.md   Admin panel operator guide
```

---

## Contributing

This is a private platform. Internal contributors should branch from `main` and open a pull request. Run `npm run lint` before pushing.

---

## License

Proprietary. All rights reserved.

Copyright (c) TradeCircle.
