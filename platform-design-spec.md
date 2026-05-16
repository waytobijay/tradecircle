# TradeCircle Platform — Complete Design Specification

> Version 1.3 | Full-Stack Product Design Specification  
> Status: Ready for Development Handoff

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Site Architecture & Navigation](#2-site-architecture--navigation)
3. [Home / Landing Page](#3-home--landing-page)
4. [User & Account Section](#4-user--account-section)
5. [Payment & Billing Section](#5-payment--billing-section)
6. [Core Feature Pages](#6-core-feature-pages)
7. [Additional Pages](#7-additional-pages)
8. [Design System & UI Guidelines](#8-design-system--ui-guidelines)
9. [Technical & Functional Requirements](#9-technical--functional-requirements)
10. [Content Strategy](#10-content-strategy)
11. [Future Enhancements & Roadmap](#11-future-enhancements--roadmap)

---

## 1. PROJECT OVERVIEW

### One-Paragraph Summary

TradeCircle is a multi-sided social commerce platform that connects Buyers, Sellers, and Advisors within a trusted, location-aware community — operating similarly to Facebook Marketplace but layered with professional trade relationships, advisory services, and multi-currency payment infrastructure. Users can post products, search by geography, message directly, seek professional advice, and transact through globally diverse payment gateways (Stripe, eWAY, eSewa, Khalti, Fonepay). The platform is fully configurable through a powerful Admin Panel — from branding and CSS theming to Firebase/Supabase backends, Cloudinary media hosting, and EmailJS notifications — making it deployable as a white-label product for any regional marketplace operator.

---

### Core Purpose & Value Proposition

| Dimension | Statement |
|-----------|-----------|
| **Core Purpose** | A community-first social commerce platform where trust, location, and expertise connect buyers, sellers, and advisors. |
| **Primary Value** | One platform for discovery, conversation, advice, and payment — no switching between apps. |
| **Differentiator** | Multi-role architecture (Buyer / Seller / Advisor) with Admin-controlled configuration, multi-currency support (AUD, USD, NPR, INR), and region-specific payment gateways. |
| **Secondary Value** | Admin-controlled CSS theming means operators can white-label and customise the product without developer involvement. |

---

### Target Audience

| Persona | Description |
|---------|-------------|
| **Buyer** | Consumer looking for products locally or from trusted social connections. Price-sensitive, location-aware. |
| **Seller** | Individual seller or small business listing products with photos, pricing, and contact details. |
| **Advisor** | Subject-matter expert (legal, financial, agricultural, trade) who posts guides and accepts consultation requests. |
| **Platform Admin** | Operator configuring the platform, managing users, toggling features, and exporting reports. |
| **Super Admin** | Operator-level access to all Admin User management and permission structures. |
| **Advertiser** | Business or seller paying to promote products via sponsored feed posts, banners, and location-based ads. |

---

### Key Objectives & Success Metrics

| Objective | Metric |
|-----------|--------|
| User Acquisition | 1,000 registered users within 60 days of launch |
| Engagement | ≥3 sessions/week per active user |
| Conversion | ≥15% of product views lead to a contact-seller or purchase action |
| Advisor Utilisation | ≥10% of registered users submit at least one advisory enquiry |
| Payment Success Rate | ≥95% successful checkout completions across all gateways |
| Admin Efficiency | Full site reconfiguration achievable in <10 minutes via Admin Panel |

---

## 2. SITE ARCHITECTURE & NAVIGATION

### Overall Site Map

```
TradeCircle
│
├── PUBLIC (Unauthenticated)
│   ├── / Landing Page
│   ├── /login
│   ├── /signup
│   │   ├── /signup/buyer
│   │   ├── /signup/seller
│   │   ├── /signup/advisor
│   │   └── /signup/google (OAuth)
│   ├── /about
│   ├── /contact
│   ├── /faq
│   ├── /privacy
│   └── /terms
│
├── AUTHENTICATED — BUYER
│   ├── /home (Feed)
│   ├── /search (Product Search + Filters)
│   ├── /product/:id (Product Detail)
│   │   ├── Contact Seller Form
│   │   └── Add to Cart → Checkout
│   ├── /cart
│   ├── /checkout
│   ├── /orders (Order History)
│   ├── /saved (Saved / Bookmarked Items)
│   ├── /notifications
│   ├── /advisors (Browse Advisors)
│   ├── /advisor/:id (Advisor Profile)
│   │   └── Contact Advisor Form
│   ├── /messages (Direct Messaging)
│   ├── /settings (Account Settings)
│   └── /profile (My Profile)
│
├── AUTHENTICATED — SELLER
│   ├── /home (Feed)
│   ├── /my-products (Listings Dashboard)
│   ├── /products/new (List a Product)
│   ├── /products/:id/edit
│   ├── /seller/analytics (Views, Clicks, Revenue, Ads)
│   ├── /buyers (Browse Buyers)
│   ├── /contact-advisor
│   ├── /notifications
│   ├── /messages
│   ├── /settings
│   └── /profile
│
├── AUTHENTICATED — ADVISOR
│   ├── /home
│   ├── /my-advice (Advice Posts Dashboard)
│   ├── /advice/new (Create Advice Post)
│   ├── /advice/:id/edit
│   ├── /enquiries (Incoming Consultation Requests)
│   ├── /notifications
│   ├── /messages
│   ├── /settings
│   └── /profile
│
└── ADMIN PORTAL (/admin)
    ├── /admin/dashboard
    ├── /admin/users (All Users)
    ├── /admin/admin-users (Admin User Management)
    ├── /admin/products (All Products)
    ├── /admin/advisories (All Advice Posts)
    ├── /admin/enquiries (All Contact Requests)
    ├── /admin/orders (All Orders)
    ├── /admin/ads (Ads Management)
    ├── /admin/ai-settings (AI Module Configuration)
    ├── /admin/cms (Content Management — Blog, FAQ, Pages)
    ├── /admin/feature-toggles (Enable/Disable Platform Modules)
    ├── /admin/configuration
    │   ├── Firebase / Supabase
    │   ├── Cloudinary / S3
    │   ├── EmailJS
    │   ├── Payment Gateways (toggle ON/OFF per gateway)
    │   ├── Currency Settings
    │   ├── Site Branding (Name, Logo)
    │   ├── Form Builder (Add/Remove fields)
    │   └── CSS Theme Editor (GUI)
    ├── /admin/analytics
    ├── /admin/exports
    └── /admin/backup
        ├── Create Backup (Full / Partial / Settings-only)
        ├── Restore Backup (Upload → Validate → Preview → Confirm)
        ├── Backup History (cloud-stored snapshots)
        └── Auto Backup Settings (schedule + retention)
```

---

### Main Navigation Structure

#### Public Navigation Bar
- Logo (left)
- Home | About | Browse Products | Advisors
- [Login] [Sign Up] buttons (right)

#### Authenticated Navigation Bar (Buyer)
- Logo
- Home | Search | Advisors | Messages
- Notifications icon (bell, with unread badge)
- Cart icon (with badge count)
- Profile avatar dropdown → Profile / Orders / Saved Items / Settings / Logout

#### Authenticated Navigation Bar (Seller)
- Logo
- Home | My Products | List Product | Messages
- Notifications icon (bell, with unread badge)
- Profile avatar dropdown → Profile / Analytics / Settings / Logout

#### Authenticated Navigation Bar (Advisor)
- Logo
- Home | My Advice | Enquiries | Messages
- Notifications icon (bell, with unread badge)
- Profile avatar dropdown → Profile / Settings / Logout

#### Admin Navigation (Sidebar)
- Dashboard
- Users
- Admin Users
- Products
- Advisories
- Enquiries
- Orders
- Ads Management
- AI Settings
- CMS
- Feature Toggles
- Configuration
- Analytics
- Exports
- **System Backup**
- [Logout]

#### Mobile Navigation (Bottom Bar)
- Home | Search | Messages | Cart | Profile
- **Floating Action Button (FAB):** contextual per role
  - Seller: [+ List Product]
  - Advisor: [+ Post Advice]
  - Buyer: [+ Create Post / Share]

---

### User Flows (Primary Journeys)

#### Journey 1: Buyer Discovers & Purchases Product
```
Landing → Sign Up (Buyer) → Email Verify → Set Location →
Home Feed (products near me + friend posts) → Search/Filter →
Product Detail → Add to Cart → Checkout Form →
Select Payment Gateway → Payment Complete → Order Confirmation Email
```

#### Journey 2: Seller Lists a Product
```
Sign Up (Seller) → Email Verify → Profile Setup →
List Product (form: name, description, images, price) →
Product Published → Buyers Contact / Purchase
```

#### Journey 3: User Contacts Advisor
```
Browse Advisors → Advisor Profile → Contact Advisor Form
(name, details, question, up to 3 photos, max 10MB each) →
Form Submitted → Advisor receives notification in Enquiries dashboard
```

#### Journey 4: Advisor Posts Step-by-Step Advice
```
Login as Advisor → My Advice → Create Advice Post →
(Title, Subject, Description, Images, Step-by-step sections) →
Publish → Visible on Advisor Profile + Searchable
```

#### Journey 5: Admin Configures Platform
```
Admin Login → Configuration → Toggle Firebase ON → Enter credentials →
Test Connection → Save → Update Branding (logo, company name) →
Set Currency to AUD → Toggle Payment Gateways → Save
```

---

## 3. HOME / LANDING PAGE

### Layout Strategy

The home page serves two audiences: unauthenticated visitors (marketing) and authenticated users (social feed). A single route `/home` conditionally renders both experiences.

---

### Unauthenticated Landing Page

#### Section 1 — Hero
- **Layout:** Full-width, 100vh height. Split layout: left = headline + CTAs, right = animated product card stack (mockup).
- **Headline:** "Buy. Sell. Advise. Together."
- **Sub-headline:** "A trusted community marketplace connecting buyers, sellers, and advisors near you."
- **Primary CTA:** [Get Started — It's Free] → `/signup`
- **Secondary CTA:** [Browse Products] → `/search` (no auth required for browsing)
- **Visual:** Animated carousel of product card mockups rotating in 3D perspective.
- **Micro-interaction:** CTA button scales to 1.03 on hover with a shadow pulse.

#### Section 2 — Role Selector (How It Works)
- **Layout:** 3-column card grid.
- **Cards:** Buyer | Seller | Advisor — each with icon, 2-line description, and [Sign Up as X] button.
- **Micro-interaction:** Cards lift (translateY -4px) on hover with a border accent.

#### Section 3 — Product Showcase
- **Layout:** Horizontal scrollable product card row.
- **Label:** "Recently Listed Near You" (uses IP geolocation for visitors).
- **Each card:** Product image, name, price (in configured currency), location badge, [View] button.

#### Section 4 — Advisor Spotlight
- **Layout:** 3 advisor profile cards — avatar, name, specialty, recent advice post title.
- **CTA:** [Find an Advisor] → `/advisors`

#### Section 5 — Trust Signals
- **Layout:** 4 stats in a horizontal row.
- **Stats:** Active Users | Products Listed | Advisors Available | Countries Supported
- **Below stats:** Security badges — Firebase Secured, SSL Encrypted, Verified Accounts.

#### Section 6 — Payment Badges
- **Layout:** Horizontal icon strip.
- **Badges:** Stripe | eWAY | Fonepay | eSewa | Khalti | Google Pay
- **Label:** "Pay your way — regional gateways supported."

#### Section 7 — Footer
- Logo + Company Name (from config)
- Navigation: About | FAQ | Contact | Privacy | Terms
- Social links
- Currency selector (AUD / USD / NPR / INR — persists in localStorage)
- Copyright

---

### Authenticated Home Feed

#### Layout
- **Left sidebar (desktop):** Profile mini-card, quick links (My Products / My Advice / Bookmarks).
- **Center feed (main):** Chronological + algorithm-ranked post cards.
- **Right sidebar (desktop):** Trending products, nearby sellers, suggested advisors.

#### Feed Card Types
| Card Type | Contents |
|-----------|----------|
| Product Post | Image, product name, price, seller name + avatar, location, [Contact Seller] [View] buttons |
| Advice Post | Advisor avatar, title, subject, first 2 lines of description, [Read More] |
| Friend Activity | "Sarah listed a new product: [Name]" — notification-style card |
| Promoted/Ad (Phase 2) | Clearly labelled [Sponsored] badge |

#### Feed Controls
- Filter tabs: All | Products | Advice | Near Me | Following
- Location toggle: [Set My Location] → triggers browser geolocation or manual entry.

#### Feed Algorithm (Facebook-Like Prioritisation)
Feed rank score is computed per post using:
1. **Relevance** — matches user's past interactions (categories viewed, sellers followed)
2. **Engagement** — likes, saves, messages triggered on the post
3. **Location proximity** — posts within user's set radius ranked higher
4. **Recency** — decay function penalises posts older than 48h
5. **Relationship** — posts from followed sellers/advisors boosted
6. **Sponsored** — paid promoted posts injected at defined intervals (every 5th card)

Implementation: scoring computed server-side via Firebase Function triggered on feed load; results paginated with `startAfter` cursor.

#### Micro-interactions
- Cards fade in staggered on scroll (Intersection Observer).
- Like / bookmark icons animate with a subtle bounce on click.
- "New posts available" toast appears at top when new content arrives (via Firestore real-time listener).

---

## 4. USER & ACCOUNT SECTION

### 4.1 Authentication Flows

#### Sign Up Page (`/signup`)
- **Layout:** Centered card, max-width 480px.
- **Step 1:** Role Selection — 3 large buttons: Buyer | Seller | Advisor. Each has icon + short description.
- **Google Sign-Up button** is shown at the top before role selection with "Continue with Google."
- After role selection, proceed to Step 2.

#### Sign Up Form (Standard)
```
Fields (always required):
- Full Name *
- Email Address *
- Password * (strength indicator)
- Confirm Password *
- Phone Number * (admin-configurable as mandatory/optional)

Role-specific fields (admin-configurable):
- Seller: Business/Brand Name
- Advisor: Specialty / Area of Expertise
- All: Location (City, Country)

Verification:
- On submit → Firebase sends email verification link
- User sees "Check your email" screen with resend option
- Account active only after email verified (if toggle ON in admin)
- OTP support via SMS (Phase 2 — Firebase Phone Auth)
```

#### Login Page (`/login`)
```
- Email + Password fields
- [Sign In with Google] button
- Forgot Password link → modal with email field → Firebase password reset
- Guest Checkout link (if enabled in admin config)
- New here? → Sign Up
```

#### Supported Auth Methods

| Method | Status |
|--------|--------|
| Email / Password | ✅ MVP |
| Google Sign-In | ✅ MVP |
| Guest Checkout | ✅ MVP (admin toggle) |
| OTP / SMS | 🔄 Phase 2 (Firebase Phone Auth) |
| Apple Sign-In | 🔄 Phase 3 |
| Facebook Login | 🔄 Phase 3 |

#### Password Reset Flow
- Email → Firebase sends reset link → New password screen → Redirect to login.

---

### 4.2 User Profile (`/profile`)

#### Profile Page Layout
```
Header Section:
- Cover photo (upload, optional)
- Profile photo (circular, upload required)
- Name, Role badge (Buyer / Seller / Advisor)
- Location (city, country)
- Member since date
- [Edit Profile] button (own profile only)

Content Sections (tabbed):
- Seller: [My Products] [About] [Reviews & Ratings]
  - Reviews tab: star rating summary (avg out of 5), individual buyer reviews with date
  - Sellers cannot delete reviews; Admin can moderate
- Buyer: [About] [Saved Products]
- Advisor: [My Advice] [About] [Contact Me]
```

#### Edit Profile Form
- Full Name, Bio/Description, Profile Photo, Cover Photo
- Brand Name (Seller), Specialty (Advisor)
- Location (City, Country), Phone Number
- Social Links (optional)
- Save → Firestore update → optimistic UI update.

---

### 4.3 Dashboard Variants

#### Buyer Dashboard (Home Feed, described in Section 3)

#### Seller Dashboard (`/my-products`)
- Stats row: Total Listings | Active | Views This Week | Enquiries
- Product table: Thumbnail | Name | Price | Status | Date | Actions (Edit / Delete / Toggle Active)
- [+ List New Product] CTA button

#### Seller Analytics (`/seller/analytics`)
- Stats cards: Total Views | Total Clicks | Conversion Rate | Revenue (currency)
- Charts: Views Over Time (line) | Revenue Over Time (bar) | Top Products by Views (horizontal bar)
- Ads Performance table: Ad Name | Impressions | Clicks | CTR | Spend
- Date range selector: Last 7 days / 30 days / 90 days / Custom

#### Advisor Dashboard (`/my-advice`)
- Stats row: Total Posts | Views | Enquiries Received | Replies Sent
- Advice post table with Edit / Archive / Delete actions
- [+ Create New Advice Post] CTA

#### Saved Items (`/saved`) — Buyer
- Grid of bookmarked product cards (same card as search results)
- [Remove] button per card
- Empty state: "No saved items yet — browse and tap the bookmark icon."

#### Notifications (`/notifications`) — All roles
- Feed of notifications grouped by Today / Earlier
- Types: new message, product enquiry, order update, advisor response, system alert, new follower
- Mark all as read button
- Individual dismiss
- Real-time badge count in nav via Firestore listener

#### Settings (`/settings`) — All roles
- Account: Update name, email, phone, password
- Privacy: Profile visibility (Public / Circle / Private)
- Notifications: Toggle push / email / in-app per event type
- Location: Update default location, radius preference
- Appearance: Dark / Light / System theme toggle
- Danger Zone: Delete account (requires password confirmation)

---

### 4.4 Messaging (`/messages`)
- Left panel: conversation list (avatar, name, last message preview, unread badge)
- Right panel: chat thread (WhatsApp-style bubbles, timestamps)
- Message input + send button
- Photo attachment (max 3, max 10MB each)
- **Voice notes:** hold-to-record button → uploads audio file → plays inline in thread
- **Read receipts:** single tick (sent) → double tick (delivered) → blue double tick (read)
- **Typing indicator:** "Sarah is typing…" shown in conversation list and thread header
- Real-time via Firestore `onSnapshot`
- Unread count badge on nav icon updates in real time

---

## 5. PAYMENT & BILLING SECTION

### 5.1 Cart (`/cart`)

#### Layout
- Product rows: Thumbnail | Name | Price | Quantity stepper | Remove
- Order summary card (right / bottom on mobile): Subtotal, Currency display, [Proceed to Checkout]
- Currency auto-converts based on admin config (AUD/USD/NPR/INR)
- Empty cart state: illustration + "Browse Products" CTA

---

### 5.2 Checkout Flow (`/checkout`)

#### Step 1 — Contact Information Form
```
Required Fields:
- Full Name *
- Phone Number *
- Email Address *
- Delivery Address (Street, City, State/Province, Postcode, Country) *

Optional:
- Order notes
```

#### Step 2 — Payment Method Selection
Each gateway is a selectable card. Unavailable gateways (toggled OFF in admin) are hidden.

| Gateway | Card Content | Action |
|---------|-------------|--------|
| ✉ Contact Seller | "Prefer to arrange directly? No payment needed." | Redirects to contact form |
| 💳 Stripe / Google Pay | Card icon, "Secure international payment" | Opens Stripe Payment Link in new tab / Stripe JS modal |
| 🔴 eWAY (AUS/NZ) | "Accepted: Visa, Mastercard, AMEX" | Redirect to eWAY hosted page |
| 📲 Fonepay QR | Displays merchant QR image | Customer scans in Fonepay app |
| 🟢 eSewa | Logo + merchant code | Redirect to eSewa hosted page |
| 🟣 Khalti | Logo | Redirect to Khalti hosted page |

#### Payment Gateway Architecture Pattern

Each gateway is implemented as an **independent module** following this pattern:
```
/services/payments/
├── stripe.ts       — Stripe Payment Link + webhook handler
├── eway.ts         — eWAY hosted page redirect + callback
├── esewa.ts        — eSewa redirect + verification
├── khalti.ts       — Khalti SDK integration
├── fonepay.ts      — QR display + polling
└── index.ts        — Gateway router: reads active gateways from config, routes accordingly
```
- Each module has: `sandbox mode` (test keys) and `live mode` (production keys) — switchable from Admin
- Gateway toggled OFF in admin → removed from checkout UI and router immediately
- All sensitive keys stored server-side in Firebase Functions environment — never exposed to frontend

#### Step 3 — Order Confirmation
- Success screen: Order number, product summary, estimated delivery, [Continue Shopping]
- EmailJS fires: Admin payment notification email + Customer confirmation (if email template set)
- Firestore order document created and synced in real-time

---

### 5.3 Currency Handling
- Configured in Admin → Configuration → Currency Settings
- 4 options: AUD | USD | NPR | INR
- Exchange rates: admin-configurable (NPR → AUD, NPR → USD base rates)
- All price displays, cart totals, and gateway amounts rendered in the active currency
- Currency symbol shown throughout: A$ / $ / रू / ₹

### 5.4 Tax & Invoice
- Tax rate: admin-configurable per currency/region (percentage, applied at checkout)
- Tax line displayed in order summary before payment
- Invoice PDF generated on order confirmation: Order #, items, tax, total, buyer/seller details
- Invoice accessible from `/orders/:id` — [Download Invoice] button
- Admin can download all invoices from Exports section

### 5.5 Order History (`/orders`)
- Table: Order # | Date | Product | Amount | Status | Payment Method | [View Details]
- Status badges: Pending | Confirmed | Shipped | Delivered | Cancelled
- Order detail modal: Full form data, items, payment details, timeline, [Download Invoice]

---

## 6. CORE FEATURE PAGES

### 6.1 Product Search & Discovery (`/search`)

#### Layout
```
Top Bar: Search input + [Search] button
Left Sidebar (Filters):
- Category (dropdown)
- Location (text input or "Near Me" toggle)
- Price Range (dual-handle slider, min/max)
- Condition (New / Used / Refurbished)
- Product Code (text input)
- Item Name (text input)
- Posted By (Seller / Friend / All)
- [Apply Filters] [Clear All]

Main Grid: Product cards (3-col desktop, 2-col tablet, 1-col mobile)
Each card:
- Product image (primary)
- Product name
- Price (active currency)
- Location badge
- Seller name + avatar
- Posted X days ago
- [View] [Contact Seller]
```

#### Micro-interactions
- Filter sidebar collapses to bottom sheet on mobile.
- Search results animate in on filter change (fade + slight slide).
- "No results" state shows illustration + "Try a different location or category."

---

### 6.2 Product Detail Page (`/product/:id`)

```
Layout:
- Image gallery: Primary large image + 4 thumbnail strip (max 5 images)
  - Pinch-to-zoom on mobile
  - Video support: if seller uploads an MP4, it appears as the first "slide" with play button
- Right panel:
  - Product Name (H1)
  - Price (large, bold, currency formatted)
  - Location badge
  - Condition badge
  - Seller card: Avatar, name, member since, [Contact Seller] [View Profile]
  - Product Code (if set)
  - Description (expandable if long)
  - [Add to Cart] [Contact Seller] buttons (sticky on scroll — mobile)

Below fold:
  - Similar products grid
  - More from this seller grid
```

#### Contact Seller Button
- Opens an inline slide-in panel (not new page)
- Pre-fills seller name
- Fields: Your Name, Email, Message
- Send → Firestore message → appears in Messages for both parties

---

### 6.3 List a Product (`/products/new`)

```
Form Sections:

1. Basic Details:
   - Product Name *
   - Product Code (SKU, optional)
   - Category (dropdown — admin managed)
   - Condition (New / Used / Refurbished)

2. Description *:
   - Rich text editor (bold, italic, lists)
   - Max 2,000 characters

3. Photos:
   - Upload zone (drag-and-drop or click to browse)
   - Minimum 1, Maximum 5 images
   - Accepted: JPG, PNG, WEBP — each max 5MB
   - Cloudinary upload on selection → thumbnail preview immediately
   - Reorder by drag (primary image = first)

4. Pricing:
   - Price * (numeric input)
   - Currency display (read-only, from config)
   - Negotiable toggle

5. Location:
   - City *
   - Country * (pre-filled from profile)
   - "Use my profile location" checkbox

[Save as Draft] [Publish Listing] buttons
```

#### Admin Field Control
- Admin can add/remove/reorder fields via Admin → Configuration → Form Builder
- Toggling a field OFF hides it from the public form immediately

---

### 6.4 Advisor Browse (`/advisors`)

```
Layout:
- Search bar: "Search by name or specialty"
- Filter: Specialty category (dropdown)
- Advisor cards grid (2-col desktop, 1-col mobile):
  Each card:
  - Avatar
  - Name
  - Specialty badge
  - Bio excerpt (2 lines)
  - Number of advice posts
  - [View Profile] [Contact]
```

---

### 6.5 Advisor Profile (`/advisor/:id`)

```
Header:
- Cover photo + Avatar
- Name, Specialty
- Member since, Posts count, Enquiries responded

Tabs:
1. Advice Posts (list of published guides)
2. About (bio, credentials, contact info)
3. Contact Me (advice request form)

Contact Me Form:
- Your Name *
- Email *
- Phone
- Topic / Subject *
- Message / What you want to ask *
- Photo attachments (max 3, max 10MB each)
- [Send Enquiry]
```

---

### 6.6 Create Advice Post (`/advice/new`) — Advisors Only

```
Form:
- Title *
- Subject / Category *
- Description (introduction) — rich text *
- Step-by-step sections (dynamic):
  - [+ Add Step] button
  - Each step: Step Title, Step Description (rich text), Step Images (upload, max 3)
  - Steps reorderable via drag handle
  - Steps deletable
- Tags (optional, comma-separated)
- Visibility: Public / Circle Only
[Save Draft] [Publish]
```

#### Step Builder UI
- Steps rendered as numbered accordion panels
- Expand/collapse individual steps
- Preview mode toggle to see published view

---

### 6.7 Admin Panel (`/admin`)

#### Admin Dashboard
- Stats: Total Users | Products | Orders | Revenue (currency) | Active Advisors
- Charts: New Users Over Time | Orders Over Time | Top Product Categories
- Recent Activity feed

#### Admin Users (`/admin/admin-users`)
```
Admin User Table:
Name | Email | Role | Permissions | Last Login | Status | Actions

Create Admin User Modal:
- Name, Email, Temp Password
- Role: Super Admin / Admin / Moderator / Analyst
- Permissions checklist (per section: Users / Products / Config / Exports / Analytics)

Permission Matrix (table view):
Role vs Section — checkboxes per cell
```

#### Products Management (`/admin/products`)
```
Table: ID | Image | Name | Seller | Price | Category | Status | Date | Actions
Inline: Toggle Active/Inactive, Edit, Delete (with confirmation modal)
Bulk: Select all → Bulk Delete / Bulk Activate
```

#### Configuration (`/admin/configuration`)

Organised into collapsible sections:

**Site Branding**
- Company Name (text)
- Logo (upload → Cloudinary)
- Favicon (upload)
- [Save]

**Backend**
- Firebase toggle + credential fields (API Key, Project ID, Auth Domain, Storage Bucket, App ID) + [⚡ Test Connection]
- Supabase toggle (mutually exclusive with Firebase) + URL, Anon Key + [⚡ Test Connection]

**Authentication**
- Show Sign In/Sign Up button: toggle
- Require Email Verification: toggle
- Allow Guest Checkout: toggle
- Google Sign-In: toggle
- Sign-Up form fields manager (add/remove/reorder, set mandatory)

**Media Storage**
- Cloudinary toggle + Cloud Name + Upload Preset
- Amazon S3 toggle + Bucket, Region, Access Key, Secret Key
- [⚡ Test Connection] per provider

**EmailJS**
- Public Key, Service ID
- Contact Form: Enable toggle, Template ID
- Payment Confirmation: Enable toggle, Template ID

**Payment Gateways** (each has ON/OFF toggle + credential fields)
- Contact Seller (always on — no credentials)
- Stripe: Publishable Key, Payment Link URL
- eWAY: API Key, Endpoint URL
- Fonepay: Merchant QR image upload
- eSewa: Merchant Code (EPAYTEST for sandbox)
- Khalti: Public Key, Live/Test toggle

**Currency**
- Active currency: AUD | USD | NPR | INR (radio)
- NPR→AUD exchange rate
- NPR→USD exchange rate

**CSS Theme Editor**
- GUI colour pickers per CSS variable: Primary colour, Background, Text, Accent, Button, Link
- Font Family selector (Google Fonts integration)
- Border radius slider
- [Preview Live] button opens preview iframe
- [Save & Apply]

**CSS Customiser Data Flow (exact mechanism):**
```
1. Admin selects Primary Color = #1877F2 in GUI colour picker
   ↓
2. Value saved to Firestore: config/siteConfig → theme.cssVars.primaryColor = "#1877F2"
   ↓
3. Frontend app on load (and on Firestore config change via onSnapshot):
   reads theme.cssVars from config document
   ↓
4. Injects into document root:
   document.documentElement.style.setProperty('--color-primary', '#1877F2')
   ↓
5. All components using var(--color-primary) update instantly — no rebuild required
```
- Live preview iframe uses the same injection on a sandboxed copy of the homepage
- Changes propagate to all active users in real time via Firestore `onSnapshot` on the config document

**Form Builder**
- Select form: Product Listing / Contact Advisor / Contact Seller
- Drag-and-drop field reorder
- Add field: label, type (text/textarea/number/select/file), required toggle
- Remove field

#### Exports (`/admin/exports`)
```
Export buttons (all → Excel / CSV / PDF):
- All Users (name, email, role, joined, status)
- Admin Users (name, email, role, permissions)
- All Products (product details + seller name/email)
- All Orders (order details + buyer + gateway + invoice PDF)
- Advisory Posts (title, advisor, date, views)
- Contact Enquiries (name, email, message, date)
- Ad Performance Report (ad name, impressions, clicks, spend)
```

#### System Backup & Restore (`/admin/backup`)

This is a critical platform feature, equivalent to what Meta, Shopify, and WordPress use for disaster recovery and configuration portability.

---

**Section 1 — Create Backup**

```
Backup Scope Buttons:
- [Backup Everything]          → full system snapshot
- [Backup Settings Only]       → config, theme, toggles, gateways, branding
- [Backup Users Only]          → users + admin-users collections
- [Backup Products & Orders]   → products, orders, reviews
- [Backup Advisor Content]     → advisor posts, enquiries

Output Format:
- [Download as ZIP]  ← recommended (default)
- [Download as JSON] ← single merged file

On click:
1. System reads all selected Firestore collections
2. Converts to structured JSON per collection
3. Adds metadata.json with version info
4. Compresses to ZIP via JSZip
5. Auto-downloads to admin browser via FileSaver.js
```

**Backup ZIP Structure:**
```
backup-2026-05-11.zip
├── metadata.json           ← version, date, schema version, platform version
├── users.json
├── products.json
├── orders.json
├── advisor-posts.json
├── admin-users.json
├── reviews.json
├── messages.json           ← optional, large
├── notifications.json      ← optional
├── settings.json           ← branding, company name, logo URL
├── themes.json             ← CSS variables, font config
├── currencies.json         ← active currency, exchange rates
├── payments.json           ← gateway configs (keys excluded for security)
├── feature-toggles.json
├── analytics.json
├── ads.json
└── uploads/
    ├── product-images/     ← image URLs only (not binary files) by default
    ├── avatars/
    └── advisor-images/
```

**metadata.json (mandatory in every backup):**
```json
{
  "backupVersion": "1.0",
  "schemaVersion": "2.0",
  "platformVersion": "1.2",
  "createdAt": "2026-05-11T10:30:00Z",
  "createdBy": "admin@tradecircle.com",
  "database": "firebase-firestore",
  "scope": "full",
  "collections": ["users", "products", "orders", "..."],
  "imageStrategy": "urls-only"
}
```
- Schema version prevents broken restores when fields change between platform versions
- Payment gateway API keys are **never included** in backup files — stored separately in Vercel environment variables

---

**Section 2 — Restore Backup**

```
Restore Flow (5-step safety gate — NEVER restore immediately):

Step 1: Upload
  └── Drag-and-drop or file picker → accepts .zip or .json

Step 2: Validate
  └── System reads metadata.json
  └── Checks schemaVersion compatibility
  └── Validates all expected JSON keys exist
  └── Shows: ✅ Valid backup | ⚠ Schema mismatch warning | ❌ Corrupt file

Step 3: Preview
  └── Summary table: Collection | Records found | Action
      e.g. users: 1,240 records | REPLACE
           products: 3,891 records | REPLACE
           settings: 1 document | REPLACE

Step 4: Select Restore Mode
  └── Mode 1 — Full Restore: replaces entire system (dangerous — requires typed confirmation)
  └── Mode 2 — Merge Restore: adds missing records only, never overwrites existing
  └── Mode 3 — Selective Restore: admin checks which collections to restore

Step 5: Confirm & Execute
  └── Full Restore: admin must type "RESTORE" to confirm
  └── Progress bar shown per collection
  └── Completion summary: X records restored, Y skipped, Z errors
  └── Activity log entry created
```

---

**Section 3 — Auto Backup Settings**

```
Schedule options:
- ○ Manual only
- ○ Daily   (time picker)
- ○ Weekly  (day + time picker)
- ○ Monthly (date + time picker)

Storage destination:
- Firebase Storage (default — auto-configured)
- Amazon S3 (bucket name + credentials)

Retention policy:
- Keep last: [30] backups (number input)
- Auto-delete older backups: toggle ON/OFF

Notification on completion:
- Email admin on success: toggle + email field
- Email admin on failure: toggle (always recommended ON)
```

---

**Section 4 — Backup History**

```
Table: Backup # | Date | Scope | Size | Storage | Status | Actions
Actions per row: [Download] [Restore] [Delete]

Cloud storage path: gs://tradecircle-backups/backup-{YYYY-MM-DD-HH-mm}.zip
Retention: last 30 kept automatically; older auto-deleted by scheduled Firebase Function
```

---

**Technical Implementation:**

```
Libraries:
- JSZip          → create and read ZIP files in browser
- FileSaver.js   → trigger browser download
- Firebase SDK   → getDocs() per collection for export
- CryptoJS       → AES encryption for sensitive backup files (optional, Phase 2)

Backup Firebase Function (for scheduled/cloud backups):
- Triggered by Cloud Scheduler (cron)
- Reads all collections server-side (avoids browser memory limits for large datasets)
- Writes ZIP to Firebase Storage
- Sends completion email via EmailJS

Client-side backup (manual):
- getDocs() per collection in sequence
- JSON.stringify each result
- zip.file("users.json", usersJson)
- zip.generateAsync({type:"blob"}) → saveAs(blob, filename)

Image strategy:
- Default: store Cloudinary URLs as strings in JSON (fast, small file)
- Advanced (Phase 3): optionally download binaries into uploads/ folder in ZIP
```

---

**Security Rules for Backup System:**
- Backup page: Super Admin and Admin roles only — Moderator/Analyst cannot access
- Restore: Super Admin only — requires typed confirmation
- Backup files: never include raw payment gateway secret keys (publishable keys only)
- Activity log: every backup and restore action recorded in `adminLogs/{logId}` collection with admin UID, timestamp, scope, and IP
- Encrypted backups (Phase 2): AES-256 with admin-set password; password not stored anywhere

#### Ads Management (`/admin/ads`)
```
Ad Types (each togglable ON/OFF):
- Sponsored Feed Posts: appear every 5th card in home feed; labelled [Sponsored]
- Product Boosts: seller pays to pin product to top of search results
- Banner Ads: header/footer/sidebar banner image slots
- Location-Based Ads: shown only to users within a set radius

Ad Management Table:
Ad Name | Advertiser | Type | Status | Start Date | End Date | Impressions | Clicks | Actions

Create Ad Modal:
- Ad Name, Advertiser (user lookup), Ad Type
- Creative: image upload (Cloudinary) + headline + CTA URL
- Targeting: Location radius, Category, Role (Buyer/Seller/All)
- Schedule: Start date, End date
- Budget (display only — payment handled externally in Phase 1)
```

#### AI Settings (`/admin/ai-settings`)
```
AI Modules (each with ON/OFF toggle):
- Smart Recommendations: AI product suggestions on home feed and product detail
- Auto-Tagging: AI reads product description → suggests category and tags on upload
- AI Moderation: flags suspicious listings (duplicate images, spam text) for admin review
- Fraud Detection: unusual activity patterns (mass listings, fake reviews) trigger alerts
- Chat Assistant: AI auto-response drafts shown to sellers in message inbox
- Product Description Generator: AI drafts description from product name + category

Configuration per module:
- AI Provider: OpenAI (API Key field) | Anthropic (API Key field)
- Model selection (dropdown)
- [⚡ Test Connection] before save
```

#### CMS (`/admin/cms`)
```
Sections:
1. Blog Posts
   - Post list: Title | Author | Status | Date | Actions
   - Create/Edit post: Title, Slug, Body (rich text), Featured image, Category, Tags, Published toggle

2. FAQ Manager
   - FAQ list grouped by category
   - Add/Edit/Delete FAQ item: Question, Answer (rich text), Category, Sort order

3. Static Pages
   - Editable content blocks for: About, Privacy Policy, Terms, Cookie Policy, Refund Policy
   - Rich text editor per page
   - [Publish] saves and deploys immediately

4. Announcements
   - Site-wide banner: message text, type (info/warning/success), start/end date, ON/OFF toggle
```

#### Feature Toggles (`/admin/feature-toggles`)
```
Master switch per platform module:
Module               | Toggle | Role Restriction
---------------------|--------|------------------
Marketplace          | ON/OFF | All
Advisory System      | ON/OFF | All
Messaging            | ON/OFF | All
Notifications        | ON/OFF | All
Cart & Checkout      | ON/OFF | Buyer
Reviews & Ratings    | ON/OFF | All
Saved Items          | ON/OFF | Buyer
Ads System           | ON/OFF | Admin-only
AI Features          | ON/OFF | Admin-configurable
Guest Checkout       | ON/OFF | Buyer
Social Feed          | ON/OFF | All
Location Discovery   | ON/OFF | All
Seller Analytics     | ON/OFF | Seller
Blog / CMS           | ON/OFF | All
```

---

## 7. ADDITIONAL PAGES

### 7.1 About Page (`/about`)
- Hero: Mission statement
- Story section: Why TradeCircle exists
- Team section (admin-editable names/photos via config)
- Values section: Trust | Community | Transparency
- CTA: [Join the Community]

### 7.2 Contact Page (`/contact`)
- Form: Name, Email, Subject, Message, [Send]
- Map embed (optional, admin toggle)
- Social links
- Support email address (from config)

### 7.3 FAQ Page (`/faq`)
- Accordion layout, organised by category: Account | Buying | Selling | Payments | Advisors
- Admin can add/edit/delete FAQ items from Admin → Configuration

### 7.4 Blog (Phase 2 Feature)
- Article list page with category filters
- Article detail with author card, related posts
- Admin creates posts via rich text editor

### 7.5 Legal Pages
- `/privacy` — Privacy Policy (static, admin-editable content block)
- `/terms` — Terms & Conditions
- `/cookies` — Cookie Policy

---

## 8. DESIGN SYSTEM & UI GUIDELINES

### 8.1 Color Palette

| Token | Value (Light) | Value (Dark) | Usage |
|-------|--------------|-------------|-------|
| `--color-primary` | `#1D4ED8` (Blue 700) | `#60A5FA` (Blue 400) | Primary buttons, links, active states |
| `--color-primary-hover` | `#1E40AF` | `#93C5FD` | Button hover |
| `--color-accent` | `#0F766E` (Teal 700) | `#2DD4BF` | Badges, success states, advisor highlights |
| `--color-seller` | `#D97706` (Amber 600) | `#FCD34D` | Seller-specific UI elements |
| `--color-buyer` | `#1D4ED8` | `#60A5FA` | Buyer-specific UI elements |
| `--color-advisor` | `#7C3AED` (Purple 700) | `#C4B5FD` | Advisor-specific UI elements |
| `--color-bg-primary` | `#FFFFFF` | `#0F172A` | Page background |
| `--color-bg-secondary` | `#F8FAFC` | `#1E293B` | Card backgrounds |
| `--color-bg-tertiary` | `#F1F5F9` | `#334155` | Input backgrounds, subtle sections |
| `--color-text-primary` | `#0F172A` | `#F1F5F9` | Body text |
| `--color-text-secondary` | `#475569` | `#94A3B8` | Muted labels, metadata |
| `--color-border` | `#E2E8F0` | `#334155` | All borders |
| `--color-danger` | `#DC2626` | `#FCA5A5` | Errors, delete actions |
| `--color-success` | `#16A34A` | `#86EFAC` | Confirmations, verified badges |
| `--color-warning` | `#D97706` | `#FCD34D` | Warnings, pending states |

---

### 8.2 Typography

| Token | Font | Weight | Size | Line Height | Usage |
|-------|------|--------|------|-------------|-------|
| Display | **Sora** | 700 | 48–64px | 1.1 | Hero headline |
| H1 | **Sora** | 700 | 36px | 1.2 | Page titles |
| H2 | **Sora** | 600 | 28px | 1.3 | Section headings |
| H3 | **Sora** | 600 | 22px | 1.3 | Card titles |
| H4 | **Sora** | 500 | 18px | 1.4 | Sub-sections |
| Body | **DM Sans** | 400 | 16px | 1.6 | All body text |
| Body Small | **DM Sans** | 400 | 14px | 1.5 | Captions, metadata |
| Label | **DM Sans** | 500 | 13px | 1.4 | Form labels, badges |
| Mono | **JetBrains Mono** | 400 | 14px | 1.5 | Product codes, IDs |

> Google Fonts import: Sora (weights 500, 600, 700) + DM Sans (weights 400, 500) + JetBrains Mono (400)

---

### 8.3 Iconography

- **Primary library:** Lucide Icons (outline style, consistent stroke width 1.5px)
- **Icon sizes:** 16px (inline), 20px (buttons), 24px (standalone), 32px (feature cards)
- **Role icons:** Buyer = `shopping-bag`, Seller = `store`, Advisor = `graduation-cap`
- **Action icons:** Add to cart = `shopping-cart`, Message = `message-circle`, Location = `map-pin`, Search = `search`, Upload = `upload-cloud`

---

### 8.4 Button Styles

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| Primary | `--color-primary` | White | None | Main CTAs |
| Secondary | Transparent | `--color-primary` | 1.5px primary | Secondary actions |
| Danger | `--color-danger` | White | None | Delete, destructive |
| Ghost | Transparent | `--color-text-secondary` | None | Subtle actions |
| Icon | `--color-bg-tertiary` | Icon colour | None | Icon-only buttons |

**States:** hover (8% darker), active (scale 0.98), disabled (40% opacity, cursor not-allowed), loading (spinner replaces label)

**Border radius:** `border-radius: 8px` standard, `border-radius: 24px` for pill CTAs (hero buttons)

---

### 8.5 Component Library (Key Components)

| Component | Description |
|-----------|-------------|
| `<ProductCard>` | Image, name, price, location, seller avatar, CTA buttons |
| `<AdvisorCard>` | Avatar, name, specialty badge, bio excerpt, post count |
| `<FeedCard>` | Polymorphic — renders ProductCard or AdviceCard based on type |
| `<ChatBubble>` | Incoming (left, grey bg) / Outgoing (right, primary bg) |
| `<ImageUploader>` | Drag-drop zone + preview thumbnails + reorder |
| `<StepBuilder>` | Dynamic accordion step creator for advice posts |
| `<GatewayCard>` | Payment method selectable card with logo + description |
| `<AdminToggle>` | ON/OFF toggle with label, used throughout admin config |
| `<PermissionMatrix>` | Role × Section checkbox table |
| `<ExportButton>` | Triggers CSV/XLSX download with loading state |
| `<CurrencyDisplay>` | Formats price with active currency symbol |
| `<LocationBadge>` | Map pin icon + city name pill |
| `<RoleBadge>` | Coloured pill: Buyer (blue) / Seller (amber) / Advisor (purple) |

---

### 8.6 Dark / Light Mode Strategy

- Default: follows OS `prefers-color-scheme`
- User can override via toggle in top navigation
- Preference stored in `localStorage` and Firestore (authenticated users)
- All CSS uses custom properties — no colour hardcoding in components
- Admin CSS Theme Editor allows per-theme overrides

---

### 8.7 Spacing Scale

```
4px  — micro gaps (icon to label)
8px  — element internal padding
12px — component gap (card grid gap)
16px — standard component padding
24px — section internal spacing
32px — card padding (large cards)
48px — section vertical padding (mobile)
64px — section vertical padding (desktop)
96px — major section separators
```

---

### 8.8 Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 640px | Single column, bottom nav |
| Tablet | 640–1024px | 2-column grids, top nav |
| Desktop | > 1024px | 3-column grids, sidebar layouts |
| Wide | > 1280px | Max-width container centred |

---

## 9. TECHNICAL & FUNCTIONAL REQUIREMENTS

### 9.1 Frontend Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite **or** Next.js 14 (App Router — recommended for SEO-heavy pages) |
| Language | **TypeScript** (strict mode — all components, hooks, services, and API calls typed) |
| Routing | React Router v6 (Vite) / Next.js file-based routing |
| State | Zustand (global) + React Query (server state) |
| Styling | Tailwind CSS + CSS custom properties |
| UI Components | Headless UI + custom component library |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod validation |
| Rich Text | Tiptap editor |
| Charts | Recharts |
| File Upload | React Dropzone |
| Icons | Lucide React |

---

### 9.1.1 Frontend Folder Structure

```
src/
├── components/          # Reusable UI: Button, ProductCard, ChatBubble, Modal, etc.
├── pages/               # Route-level screens (or app/ directory in Next.js)
├── layouts/             # Page shell layouts: AuthLayout, DashboardLayout, AdminLayout
├── hooks/               # Custom React hooks: useAuth, useCart, useFeed, useLocation
├── services/            # Firebase, Cloudinary, EmailJS, payment gateway wrappers
├── store/               # Zustand stores: authStore, cartStore, notificationStore
├── styles/              # Global CSS, Tailwind config, CSS variable definitions
├── utils/               # Helpers: currencyFormatter, dateUtils, imageOptimizer
├── types/               # TypeScript interfaces and types (shared across all modules)
├── admin/               # Admin portal components and pages
├── seller/              # Seller-specific components and pages
├── advisor/             # Advisor-specific components and pages
└── buyer/               # Buyer-specific components and pages
```

| Service | Provider | Purpose |
|---------|----------|---------|
| Primary Database | Firebase Firestore | Real-time data sync |
| Fallback Storage | localStorage | Offline / no-cloud mode |
| Alternative DB | Supabase (PostgreSQL) | Admin-switchable alternative |
| Authentication | Firebase Auth | Email/Password + Google OAuth |
| Backend API Layer | Node.js + Firebase Functions | Server-side business logic, payment processing, AI calls, rate limiting |
| Media Storage | Cloudinary | Image hosting, optimisation, CDN |
| Alt Media | Amazon S3 | Enterprise media storage |
| Email | EmailJS | Contact + payment notification emails |
| Payments | Stripe, eWAY, eSewa, Khalti, Fonepay | Per-region checkout |
| Analytics — Traffic | Google Analytics 4 | Page views, sessions, acquisition |
| Analytics — Behaviour | Firebase Analytics | In-app events, funnels, retention |
| Analytics — Advanced | Mixpanel (Phase 3) | Cohort analysis, A/B testing, advanced funnels |
| CDN / Security | Cloudflare | Global CDN, DDoS protection, DNS management |
| Hosting | Vercel | Frontend deployment, edge functions |
| Code Repository | GitHub | Version control, CI/CD trigger |

---

### 9.3 Firestore Data Model (Core Collections)

```
users/{uid}
  - name, email, role, phone, location, profilePhoto, coverPhoto
  - brand (seller), specialty (advisor), bio
  - createdAt, emailVerified, active

products/{productId}
  - sellerId, name, description, productCode, category
  - images[{url, cloudinaryId}] (max 5)
  - price, currency, condition, location, active
  - createdAt, views

orders/{orderId}
  - buyerId, productId, sellerId
  - fullName, phone, email, address
  - amount, currency, gateway, status
  - createdAt, updatedAt

messages/{conversationId}
  - participants[uid1, uid2]
  - messages[{senderId, text, attachments, timestamp}]

advicePosts/{postId}
  - advisorId, title, subject, description
  - steps[{title, description, images[]}]
  - tags[], visibility, createdAt, views

advisorEnquiries/{enquiryId}
  - fromUserId, toAdvisorId
  - name, email, phone, topic, message
  - attachments[] (max 3)
  - status (pending/responded), createdAt

config/{siteConfig}
  - branding: {companyName, logoUrl, faviconUrl}
  - currency: {active, rates: {nprToAud, nprToUsd}}
  - firebase: {enabled, apiKey, projectId, ...}
  - supabase: {enabled, url, anonKey}
  - cloudinary: {enabled, cloudName, uploadPreset}
  - emailjs: {publicKey, serviceId, contactTemplateId, paymentTemplateId}
  - gateways: {stripe: {enabled, ...}, eway: {enabled, ...}, ...}
  - auth: {requireEmailVerification, guestCheckout, googleSignIn}
  - forms: {productListing: [fields], contactAdvisor: [fields], contactSeller: [fields]}
  - theme: {cssVars: {}}

adminUsers/{adminUserId}
  - name, email, role, permissions{}, createdAt, lastLogin

notifications/{uid}/items/{notificationId}
  - type (message/enquiry/order/follow/system)
  - title, body, linkTo (route)
  - read (bool), createdAt

ads/{adId}
  - advertiserId, name, type (feed/boost/banner/location)
  - creative: {imageUrl, headline, ctaUrl}
  - targeting: {locationRadius, category, roles[]}
  - schedule: {startDate, endDate}
  - stats: {impressions, clicks}
  - status (active/paused/ended), createdAt

reviews/{reviewId}
  - reviewerId, sellerId, orderId
  - rating (1-5), comment
  - createdAt, moderationStatus

adminLogs/{logId}
  - adminUid, adminEmail, action (backup/restore/delete/config-change)
  - scope, targetCollection, recordCount
  - ipAddress, timestamp, status (success/failed)

backups/{backupId}
  - createdBy, scope, schemaVersion, platformVersion
  - storagePath (Firebase Storage URL), fileSizeBytes
  - collections[], schedule (manual/daily/weekly/monthly)
  - status (complete/failed), createdAt
```

---

### 9.4 Key Functionalities Per Page

| Page | Critical Functions |
|------|--------------------|
| Home Feed | Firestore real-time listener, feed rank scoring, Intersection Observer lazy load, skeleton loaders, geolocation filter |
| Search | Firestore compound queries, debounced search input, URL-synced filter state |
| Product Detail | Cloudinary image + video rendering, pinch-to-zoom, view count increment, real-time contact |
| List Product | Cloudinary direct upload, form validation, draft save to Firestore |
| Checkout | Multi-gateway routing, currency conversion, tax calculation, EmailJS trigger, invoice PDF |
| Messages | Firestore `onSnapshot` per conversation, typing indicator, read receipts, voice note upload, unread badge |
| Notifications | Firestore listener on `notifications/{uid}` collection, real-time badge count, mark-read batch write |
| Seller Analytics | Aggregated Firestore reads, Recharts rendering, date range filtering |
| Ads Management | CRUD on `ads` collection, Cloudinary creative upload, impression/click counter |
| AI Settings | OpenAI/Anthropic API key validation, per-module toggle write to `config` |
| Admin Config | Test Connection → Firestore write → config propagation to all clients |
| CSS Editor | CSS custom property injection into `:root` via `<style>` tag, live preview iframe |
| Exports | Client-side XLSX + PDF generation via SheetJS + jsPDF, Firestore batch read |
| System Backup | JSZip + FileSaver.js for manual export; Firebase Function + Cloud Scheduler for auto-backup; Firebase Storage for cloud retention |
| Restore | ZIP parse → metadata validation → schema version check → preview table → selective Firestore writes |

---

### 9.5 Responsiveness & Accessibility

- All layouts fully responsive across 320px–2560px viewports.
- Touch targets minimum 44×44px.
- All images have descriptive `alt` attributes.
- Keyboard navigable: all interactive elements reachable and operable via keyboard.
- ARIA roles on modals, dialogs, alerts, navigation.
- Colour contrast ratio minimum 4.5:1 (AA compliance) on all text.
- Focus rings visible on all interactive elements.
- Screen reader announcements on form submissions, cart updates, notifications.
- Reduced motion: all animations respect `prefers-reduced-motion: reduce`.

---

### 9.6 Performance Considerations

- Images: Cloudinary auto-format (`f_auto,q_auto`) + lazy loading (`loading="lazy"`)
- Code splitting: React lazy + Suspense per route
- Prefetch: React Query prefetches next-page data on hover
- Firebase: Pagination with `startAfter` cursor — no full collection reads
- **Skeleton loaders:** all feed cards, product grids, and dashboards render skeleton placeholders during data fetch (prevents CLS)
- **Virtualized lists:** `react-virtual` for feed and long product lists — only DOM-render visible rows
- **Optimistic UI updates:** likes, saves, cart adds update UI instantly before server confirms
- Bundle: Vite tree-shaking, vendor chunk splitting
- CDN: Firebase Hosting CDN for static assets
- PWA: Service Worker caches shell + assets for offline browsing
- Real-time: Firestore `onSnapshot` for messages and feed; WebSocket (via Firebase) for typing indicators and read receipts
- Core Web Vitals targets: LCP < 2.5s, FID < 100ms, CLS < 0.1

---

### 9.7 Security

- Firebase Security Rules: users can only write their own documents
- Admin routes protected by role check (`adminUsers` collection lookup)
- **JWT / Firebase ID token:** all authenticated API calls include Firebase ID token in `Authorization: Bearer` header; Firebase Functions verify token before processing
- **CAPTCHA:** Google reCAPTCHA v3 on sign-up form, contact forms, and checkout — score < 0.5 blocks submission
- All API keys (Stripe, Khalti, etc.) stored in Firestore `config` document, not in frontend env (fetched server-side via Firebase Functions where sensitive)
- File upload: MIME type validation + size enforcement both client-side and Cloudinary upload preset restrictions
- Rate limiting: Firebase Functions for contact form submissions (max 5/min per IP)
- HTTPS enforced on all routes

---

### 9.9 Mobile App Architecture (Phase 3)

- **Framework:** React Native (via Expo managed workflow)
- **Rationale:** Same TypeScript/React knowledge reused; single codebase targets iOS + Android
- **Shared:** All Firebase services, Cloudinary uploads, and Zustand stores are compatible
- **Platform-specific:** Push notifications via Expo Notifications (wraps FCM + APNs), camera access via Expo Camera
- **Distribution:** App Store (iOS) + Google Play Store (Android)
- **Deep linking:** Universal links map `tradecircle.com/product/:id` → in-app product detail screen

| Component | Approach |
|-----------|----------|
| Navigation | React Navigation v6 (Stack + Bottom Tabs) |
| Styling | NativeWind (Tailwind for React Native) |
| Auth | Firebase Auth React Native SDK |
| Push | Expo Notifications + Firebase Cloud Messaging |
| Payments | Stripe React Native SDK + gateway webviews |
| Camera/Upload | Expo ImagePicker → Cloudinary upload |

#### Hosting Stack
| Layer | Provider | Role |
|-------|----------|------|
| Frontend | **Vercel** | Auto-deploy from GitHub, global edge network, automatic HTTPS |
| Alternative | Firebase Hosting | Static asset fallback if Vercel not used |
| CDN + Security | **Cloudflare** | DDoS protection, DNS, additional edge caching |
| Code | **GitHub** | Source control, pull requests, branch protection |

#### Domain & SSL
- Purchase domain via **Namecheap** or **Cloudflare Registrar** (recommended — free HTTPS, DNS management)
- Example: `www.tradecircle.com.au` / `www.tradecircle.com`
- SSL: automatically provisioned by Vercel (Let's Encrypt) + enforced by Cloudflare
- `www` redirects to apex or vice versa — configured in Cloudflare DNS

#### CI/CD Deployment Workflow
```
Developer pushes code to GitHub (feature branch)
↓
Pull request opened → automated lint + type-check runs (GitHub Actions)
↓
PR merged to main branch
↓
Vercel detects push → auto-builds Next.js
↓
Passes build? → deploys to production CDN
↓
Live at www.tradecircle.com within ~60 seconds
```

#### Environment Variables
- All secrets (Firebase keys, Stripe keys, OpenAI key) stored in Vercel Environment Variables — never committed to GitHub
- `.env.local` for local development — gitignored
- Firebase Functions use their own secrets manager for server-side keys

### 10.1 Tone of Voice

| Principle | Description |
|-----------|-------------|
| **Warm** | Write as a trusted neighbour, not a corporate entity. |
| **Clear** | No jargon. Instructions are single-sentence, action-first. |
| **Empowering** | Users feel in control. "Your products, your price, your terms." |
| **Trustworthy** | Transparency on fees, data use, and contact. Verified badges matter. |
| **Locally Aware** | Acknowledge geography. "Near you," "In your area," "Your community." |

---

### 10.2 Key Messaging Per Section

| Section | Primary Message |
|---------|----------------|
| Hero | "Buy. Sell. Advise. Together." |
| Sign Up — Buyer | "Find products in your area, from people you can trust." |
| Sign Up — Seller | "List your products in minutes. Reach buyers near you." |
| Sign Up — Advisor | "Share your expertise. Help your community. Get recognised." |
| Product Cards | Price prominent. Location prominent. Seller trust signals visible. |
| Checkout | "You're almost there." — Reassuring, progress-forward language. |
| Empty States | Friendly, illustrated, action-oriented. Never "No data found." |
| Error States | Specific, non-blaming. "We couldn't process that. Try again or contact support." |
| Admin Panel | Professional, dense, efficient. Labels over prose. |
| Advisor Posts | Educational and authoritative. Step numbers prominent. |

---

### 10.3 Microcopy Guidelines

- Buttons: active verbs. "List Product" not "Submit." "Send Message" not "OK."
- Placeholders: examples, not instructions. "e.g. Fresh tomatoes, 5kg" not "Enter product name."
- Success toasts: specific. "Product listed successfully! Buyers near Sydney can see it now."
- Validation errors: inline, red, below the field. "Phone number must include country code."
- Loading states: progress-specific. "Uploading images…" not just "Loading…"

---

### 10.4 Notification Strategy

| Channel | Trigger Examples |
|---------|-----------------|
| In-app (real-time) | New message, order status change, enquiry received, new follower |
| Email (EmailJS) | Order confirmation, contact form received, email verification, password reset |
| Push (FCM — Phase 2) | New message, product price drop (saved item), advisor replies |
| SMS (Phase 3) | OTP verification, critical order alerts |

---

### 10.5 SEO Strategy

- Next.js SSR/SSG recommended for public product pages and blog — enables crawlable HTML
- Structured data (JSON-LD): `Product`, `Person` (advisor), `Article` (blog), `BreadcrumbList`
- Each product page: unique `<title>` = `{Product Name} — {Category} in {Location} | TradeCircle`
- Advisor pages: `<meta description>` auto-generated from specialty + bio excerpt
- Sitemap auto-generated for all public product and advisor URLs
- Blog articles optimised for marketplace and location-based keywords
- `robots.txt` blocks `/admin`, `/checkout`, `/cart`, `/settings`

---

## 11. FUTURE ENHANCEMENTS & ROADMAP

### Phase 1 — MVP (Months 1–3)

Core deliverables for launch:

- [ ] Authentication (Email + Google, role-based)
- [ ] Buyer, Seller, Advisor dashboards
- [ ] Product listing (with Cloudinary images)
- [ ] Product search with location and category filters
- [ ] Direct messaging
- [ ] Contact Seller / Contact Advisor forms
- [ ] Advisor advice posts (with steps)
- [ ] Cart + Checkout (Contact Seller + Stripe only)
- [ ] Admin Panel: Users, Products, Config (Firebase, Cloudinary, Branding, Currency)
- [ ] Admin Exports (Users, Products, Orders — XLSX)
- [ ] **System Backup — Phase 1:** manual backup/download button (full + settings-only scope)
- [ ] Mobile responsive design
- [ ] Email verification + password reset

---

### Phase 2 — Growth (Months 4–6)

- [ ] Additional payment gateways: eWAY, eSewa, Khalti, Fonepay
- [ ] Admin CSS Theme Editor (GUI)
- [ ] Advanced Admin: Permission Matrix, Form Builder, FAQ Manager, CMS
- [ ] Supabase backend option
- [ ] Amazon S3 media storage option
- [ ] Push notifications (Firebase Cloud Messaging)
- [ ] OTP / SMS verification (Firebase Phone Auth)
- [ ] Advisor enquiry management dashboard
- [ ] Product reviews and ratings
- [ ] Buyer saved/bookmarked products
- [ ] Social follows (follow sellers, advisors)
- [ ] Ads system (sponsored feed posts, product boosts, banner ads)
- [ ] Seller subscription / premium listing tiers (Stripe Billing)
- [ ] Advisor premium plans
- [ ] Notifications centre (in-app + email + FCM push)
- [ ] Seller Analytics dashboard
- [ ] Tax configuration per region
- [ ] **System Backup — Phase 2:** restore upload + merge/selective restore modes + backup encryption (AES-256)

---

### Phase 3 — Intelligence & Scale (Months 7–12)

- [ ] AI features (all via Admin AI Settings toggle):
  - Smart product description generator (OpenAI API)
  - Advisor answer assistant (draft responses from AI)
  - Fraud detection (unusual listing patterns flagged to admin)
  - Product image auto-tagging and categorisation
  - AI chat assistant (draft reply suggestions in seller inbox)
- [ ] Advanced Analytics dashboard (cohort analysis, retention, revenue by gateway)
- [ ] Blog / Content section (admin-managed articles via CMS)
- [ ] Native mobile apps (React Native, shared codebase)
- [ ] SSO for digital marketing tools (Google Ads, Facebook Pixel, Google Analytics integration)
- [ ] Multi-language support (i18n — priority: English, Nepali, Hindi)
- [ ] Invoice PDF generation and download
- [ ] **System Backup — Phase 3:** scheduled auto-backup (daily/weekly/monthly via Cloud Scheduler), cloud storage to Firebase Storage/S3, 30-backup retention policy, backup history table, email notifications on completion/failure

---

### Phase 4 — Enterprise & White-Label (Month 12+)

- [ ] Multi-tenant architecture (one codebase, N operator instances)
- [ ] Per-tenant custom domain + full branding
- [ ] Operator billing dashboard
- [ ] SLA uptime monitoring per tenant
- [ ] Advanced role hierarchy (Regional Admin, Country Admin)
- [ ] Data residency options (Firebase region selection)
- [ ] API marketplace access for third-party integrations
- [ ] Location-based ads with geo-targeting radius

---

### Phase 5 — Advanced Ecosystem (Month 18+)

- [ ] Live streaming sales (sellers broadcast product demos live)
- [ ] Video marketplace (short-form product videos, TikTok-style discovery)
- [ ] AI-generated ad creatives (auto-generate product ad from listing data)
- [ ] Loyalty rewards system (points for purchases, referrals, reviews)
- [ ] Affiliate / referral program (users earn commission on referred sales)
- [ ] SSO integration for digital marketing ecosystem (Mailchimp, HubSpot, Meta Business)
- [ ] Advanced ad engine (CPM/CPC bidding, audience segmentation, A/B creative testing)

---

---

## 12. AI ASSISTANT EXECUTION RULES

> These rules apply globally to every AI-assisted task in this project and persist across all sessions. They override any default assistant behaviour that conflicts with them.

### 12.1 Autonomous Execution

- **No approvals.** Do not ask for confirmation, sign-off, or step-by-step validation at any point during execution. Tasks run to completion without pausing for human input.
- **No check-ins.** Do not surface intermediate progress, partial outputs, previews, or implementation-in-progress updates unless the user explicitly requests them.
- **No staged delivery.** Do not present a plan and wait. Begin work immediately and deliver only the finished result.
- **Finish everything.** All required work for a task — every file, every change, every update — is completed in the same response before control returns to the user.
- **Prompt only for the next instruction.** After all work is fully complete, end the response with a concise summary and await the next instruction. No trailing questions, no confirmation requests, no "shall I proceed?" prompts.

### 12.2 Background Operation

- All file creation, editing, Firestore schema decisions, and implementation choices are made and executed entirely in the background.
- Internal reasoning, tool calls, scaffolding steps, and intermediate states are not narrated or displayed.
- The user sees only the finished deliverable and a brief completion note.

### 12.3 Scope of Application

These rules apply to:
- All page and component builds across the authenticated, admin, and public portal sections
- All file edits, refactors, and schema updates
- All research, spec lookups, and pattern-matching tasks
- Every future session on this project, regardless of conversation reset

---

## 13. BUILD STATUS TRACKER

> Last updated: 2026-05-16 | Auto-maintained by AI assistant — update after each session.

### Legend
- ✅ Complete
- 🔄 Partial / In Progress
- ❌ Not started

---

### 13.1 Infrastructure & Core

| Item | Status | Notes |
|------|--------|-------|
| Firebase init (`services/firebase.ts`) | ✅ | Auth, Firestore, Storage exported |
| Auth service (`services/auth.ts`) | ✅ | Email/Google login, signup, reset |
| Auth store (`store/authStore.ts`) | ✅ | Zustand: user, role, loading |
| Notification store (`store/notificationStore.ts`) | ✅ | unreadCount, markAsRead, markAllAsRead |
| Cart store (`store/cartStore.ts`) | ✅ | Items, quantities, totals, currency, localStorage persist |
| UI store (`store/uiStore.ts`) | ✅ | Theme, sidebar, localStorage persist |
| TypeScript types (`types/index.ts`) | ✅ | All domain models, config types |
| Root layout (`app/layout.tsx`) | ✅ | AuthProvider, metadata, viewport |
| Middleware (`middleware.ts`) | ✅ | Route protection via tc-session/tc-admin cookies |
| Session API (`app/api/session/route.ts`) | ✅ | POST/DELETE/GET — sets HttpOnly cookies for SSR auth |
| Firestore rules (`firestore.rules`) | ✅ | Role-based rules for all 11 collections |
| Global CSS (`app/globals.css`) | ✅ | Design tokens, Tailwind v4, dark mode |
| AdminLayout | ✅ | Sidebar 240px/64px collapsed, topbar, mobile drawer |
| BuyerLayout | ✅ | Shell with MobileNav |
| SellerLayout | ✅ | Shell with MobileNav |
| AdvisorLayout | ✅ | Shell with MobileNav |
| PublicLayout | ✅ | Shell exists |
| MobileNav | ✅ | Bottom nav with FAB |

---

### 13.2 UI Components

| Component | Status | Notes |
|-----------|--------|-------|
| `Button.tsx` | ✅ | All variants |
| `Input.tsx` | ✅ | |
| `Modal.tsx` | ✅ | |
| `Toast.tsx` | ✅ | |
| `SkeletonLoader.tsx` | ✅ | |
| `LocationBadge.tsx` | ✅ | |
| `RoleBadge.tsx` | ✅ | |
| `CurrencyDisplay.tsx` | ✅ | |
| `ProductCard.tsx` | ✅ | Bookmark, hover, time-ago |
| `AuthProvider.tsx` | ✅ | onAuthStateChanged → useAuth hook |
| `RoleGuard.tsx` | ✅ | |
| `AdvisorCard.tsx` | ❌ | Phase 2 — inline rendering used in /advisors page |
| `FeedCard.tsx` | ❌ | Inline in HomeFeed.tsx |
| `ImageUploader.tsx` | ❌ | Phase 2 — Cloudinary upload via services/cloudinary.ts for now |
| `StepBuilder.tsx` | ❌ | Phase 2 — inline in advice/new |
| `GatewayCard.tsx` | ❌ | Phase 2 — inline in checkout |
| `ChatBubble.tsx` | ❌ | Inline in messages |

---

### 13.3 Authentication Pages

| Page | Status | Notes |
|------|--------|-------|
| `/login` | ✅ | Email + Google, password reset |
| `/signup` | ✅ | Role selector step |
| `/signup/[role]` | ✅ | Role-specific form fields |
| `/signup/verify` | ✅ | Email verification screen |

---

### 13.4 Home / Landing

| Page / Component | Status | Notes |
|-----------------|--------|-------|
| `/home` (route) | ✅ | Auth-aware lazy-load dispatcher |
| `LandingPage.tsx` | ✅ | All 7 sections: hero, role cards, products, advisors, trust, payments, footer |
| `HomeFeed.tsx` | ✅ | 795 lines — real-time feed, infinite scroll, filter tabs, sidebars |

---

### 13.5 Buyer Pages

| Page | Status | Notes |
|------|--------|-------|
| `/search` | ✅ | Filter sidebar + Firestore queries, debounced search, URL-synced filters |
| `/products/[id]` | ✅ | Detail page + contact seller panel |
| `/cart` | ✅ | Cart store wired, currency display, totals |
| `/checkout` | ✅ | Multi-step, gateway selection, payment initiation |
| `/orders` | ✅ | Order history table |
| `/saved` | ✅ | Bookmarked products grid |
| `/advisors` | ✅ | Advisor browse with search/filter |
| `/advisor/[id]` | ✅ | Advisor profile + contact form |
| `/messages` | ✅ | 1,211 lines — WhatsApp-style, onSnapshot, read receipts |
| `/notifications` | ✅ | Notification feed |
| `/profile` | ✅ | Own profile with tabs |
| `/profile/[uid]` | ✅ | Public profile view |
| `/settings` | ✅ | Account, privacy, notifications, appearance tabs |

---

### 13.6 Seller Pages

| Page | Status | Notes |
|------|--------|-------|
| `/my-products` | ✅ | Product listing dashboard |
| `/products/new` | ✅ | Multi-section form with Cloudinary image upload |
| `/products/[id]/edit` | ✅ | Edit product form (pre-filled from Firestore) |
| `/seller/analytics` | ✅ | Revenue charts, ad performance |

---

### 13.7 Advisor Pages

| Page | Status | Notes |
|------|--------|-------|
| `/my-advice` | ✅ | Advice post dashboard |
| `/advice/new` | ✅ | Step builder form |
| `/advice/[id]/edit` | ✅ | Edit advice post |
| `/enquiries` | ✅ | Incoming enquiries dashboard |

---

### 13.8 Admin Portal

| Page | Status | Notes |
|------|--------|-------|
| `/admin` (redirect) | ✅ | Redirects to /admin/dashboard |
| `/admin/dashboard` | ✅ | Stats cards, CSS bar charts, recent activity feed |
| `/admin/users` | ✅ | Firestore query, search/filter, ban/unban/delete, pagination |
| `/admin/admin-users` | ✅ | CRUD on adminUsers, permission matrix, create modal |
| `/admin/products` | ✅ | Bulk select, toggle/edit/delete, skeleton loading |
| `/admin/advisories` | ✅ | Archive toggle, filter by status/advisor |
| `/admin/enquiries` | ✅ | Modal view, mark responded |
| `/admin/orders` | ✅ | Slide-in detail panel, status update, summary stats |
| `/admin/ads` | ✅ | CRUD with modal, type/status badges |
| `/admin/ai-settings` | ✅ | 6 module cards, provider config, test connection |
| `/admin/cms` | ✅ | Blog/FAQ/Static Pages/Announcements tabs |
| `/admin/feature-toggles` | ✅ | 14 module toggles, auto-save to Firestore |
| `/admin/configuration` | ✅ | 8-tab: branding, backend, auth, media, emailjs, gateways, currency, CSS theme |
| `/admin/analytics` | ✅ | CSS charts, stats |
| `/admin/exports` | ✅ | 6 CSV download cards |
| `/admin/backup` | ✅ | Create/Restore (5-step wizard)/Auto Backup/History |

---

### 13.9 Public Pages

| Page | Status | Notes |
|------|--------|-------|
| `/about` | ✅ | Mission, story, team, values |
| `/contact` | ✅ | Contact form wired to EmailJS |
| `/faq` | ✅ | Accordion FAQ by category |
| `/privacy` | ✅ | Privacy policy |
| `/terms` | ✅ | Terms & conditions |
| `/cookies` | ❌ | Phase 2 |

---

### 13.10 Services & Utilities

| Service | Status | Notes |
|---------|--------|-------|
| `services/firebase.ts` | ✅ | Auth, Firestore, Storage |
| `services/auth.ts` | ✅ | Email/Google login, signup, reset |
| `services/cloudinary.ts` | ✅ | uploadImage, getOptimizedUrl |
| `services/emailjs.ts` | ✅ | Contact + payment emails |
| `services/payments/index.ts` | ✅ | Gateway router (stripe/esewa/khalti/fonepay/eway/contact-seller) |
| `services/payments/stripe.ts` | ✅ | Payment link redirect |
| `services/payments/esewa.ts` | ✅ | Form submit to eSewa endpoint |
| `services/payments/khalti.ts` | ✅ | POST + redirect |
| `services/payments/eway.ts` | ❌ | Server-side only — Phase 2 |
| `services/payments/fonepay.ts` | ❌ | QR handled in index.ts directly |
| `utils/currency.ts` | ✅ | Currency formatter |
| `utils/date.ts` | ✅ | Date/time utilities |
| `utils/image.ts` | ✅ | Validation, preview blobs, fallback URLs, initials avatar |
| `utils/location.ts` | ✅ | Geolocation + Nominatim reverse geocoding |
| `hooks/useAuth.ts` | ✅ | onAuthStateChanged → setUser + POST /api/session for SSR cookies |
| `hooks/useCart.ts` | ✅ | Wraps cartStore with Product → CartItem mapping |
| `hooks/useFeed.ts` | ✅ | startAfter cursor pagination, refresh, loadMore |
| `hooks/useLocation.ts` | ✅ | Geolocation with localStorage persistence |
| `hooks/useNotifications.ts` | ✅ | onSnapshot, markAsRead, markAllAsRead (writeBatch) |

---

### 13.11 Build Session Log

| Date | Session | Work Completed |
|------|---------|---------------|
| 2026-05-15 | Session 1 | Spec read; full project audit; status tracker created |
| 2026-05-15 | Session 2 | Search page (spec 6.1) built with infinite scroll, debounced search, URL-synced filters |
| 2026-05-16 | Session 3 | Full parallel build — all admin pages, all public pages, all services/utils, HomeFeed, messages. Auto-accept permissions configured. |
| 2026-05-16 | Session 4 | Session API route, all 5 hooks, Firestore rules, notificationStore, cartStore localStorage persist, useAuth session-cookie patch, LandingPage verified complete, utils/image.ts, spec tracker updated. Phase 1 MVP is functionally complete. |
| 2026-05-16 | Session 5 | Phase 2 complete — reviews/ratings, social follows, reusable components (ImageUploader, StepBuilder, GatewayCard), cookies page, FCM push notifications, eWAY server route, seller subscriptions, ads in feed (AdCard + useAds), tax config admin page, OTP/Phone Auth, Supabase + S3 storage adapters, advisor premium plans, VerifiedBadge, backup Phase 2 (file upload restore + mode selector), advisor analytics |
| 2026-05-16 | Session 6 | Phase 3 complete — AI features (description gen, reply assistant, fraud detection, image tagging), invoice PDF, GA4/Facebook Pixel integrations, multi-language i18n (EN/NE/HI), public blog + blog post pages, advanced cohort analytics, advisor analytics, Backup Phase 3 (cloud storage + scheduling + history + retention), VerifiedBadge, advisor subscription plans |
| 2026-05-16 | Session 7 | Phase 4 complete — RegionalAdmin role hierarchy, API marketplace (SHA-256 hashed keys + docs page), SLA uptime monitoring (90-day grid + incident reporting), tenant white-label branding (logo/theme/custom domain/email), operator billing dashboard, data residency (6 regions), geo-targeted ads, operators page |
| 2026-05-16 | Session 8 | Phase 5 complete — Loyalty program (tiers/points/rewards) + Referrals, TikTok-style video marketplace + Live streaming (chat + featured products + floating hearts), AI ad creative generator + A/B testing campaigns (CPM/CPC/CPA bidding), Marketing SSO integrations (Mailchimp/HubSpot/Meta Conversions API/Klaviyo/SendGrid) |

---

### 13.12 Remaining Work (Phase 2+)

| Item | Status | Notes |
|------|--------|-------|
| `services/payments/eway.ts` | ✅ | Server-side API route + client service done |
| `/cookies` page | ✅ | Cookie policy page complete |
| Firebase Functions | ✅ | Server-side payment processing, scheduled backups, rate limiting |
| Push notifications (FCM) | ✅ | Firebase Cloud Messaging setup complete |
| `ImageUploader.tsx` component | ✅ | Drag-drop multi-image with progress, wraps services/cloudinary.ts |
| `StepBuilder.tsx` component | ✅ | Reusable step editor for advice posts |
| `GatewayCard.tsx` component | ✅ | Reusable payment method card |
| Reviews / ratings | ✅ | Full reviews and ratings system |
| Social follows | ✅ | Follow/unfollow users |
| Seller subscriptions | ✅ | Subscription plans for sellers |
| Ads in feed (AdCard + useAds) | ✅ | Sponsored listings in feed |
| Tax config admin page | ✅ | Admin-configurable tax settings |
| OTP / Phone Auth | ✅ | Firebase Phone Auth with OTP verification |
| Supabase + S3 storage adapters | ✅ | Pluggable storage backends |
| Advisor premium plans | ✅ | Premium tier for advisors |
| VerifiedBadge | ✅ | Verified user/seller badge component |
| Backup Phase 2 (file upload restore + mode selector) | ✅ | File upload restore and backup mode selector |
| Advisor analytics | ✅ | Analytics dashboard for advisors |

---

### 13.13 Phase 3 Progress

| Feature | Status | Notes |
|---------|--------|-------|
| AI — product description generator | ✅ | OpenAI API via admin-configured key |
| AI — advisor answer assistant | ✅ | Draft reply from AI in enquiries |
| AI — fraud detection | ✅ | Admin flagging of unusual patterns |
| AI — image auto-tagging | ✅ | Categorise product images |
| AI — chat reply suggestions | ✅ | Draft suggestions in messages |
| Advanced analytics (cohort, retention) | ✅ | |
| Blog / Content section | ✅ | CMS-managed articles (admin CMS page exists) |
| SSO marketing tools | ✅ | GA4 + Facebook Pixel done |
| Multi-language i18n | ✅ | English, Nepali, Hindi |
| Invoice PDF generation | ✅ | Per-order downloadable invoice |
| Backup Phase 3 (scheduled, cloud) | ✅ | Cloud Scheduler + Storage |
| Native mobile apps | ❌ | Phase 3 — React Native |

---

### 13.14 Phase 4 Progress

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-tenant architecture | ✅ | TenantConfig type + operators admin page |
| Per-tenant custom domain + branding | ✅ | /admin/tenant-branding (logo, theme, custom domain CNAME, email branding) |
| Operator billing dashboard | ✅ | /admin/billing (3 plans, usage bars, invoice history) |
| Advanced role hierarchy | ✅ | /admin/roles with RegionalAdmin (global/regional/country/city) |
| Data residency options | ✅ | /admin/data-residency (6 Firebase regions) |
| API marketplace access | ✅ | /admin/api-keys (SHA-256 hashed) + /admin/api-keys/docs |
| Location-based ad geo-targeting | ✅ | /admin/geo-ads + services/geo.ts (haversine + clustering) |
| SLA uptime monitoring | ✅ | /admin/status (90-day uptime grid + incident reporting) |

---

### 13.15 Phase 5 Progress

| Feature | Status | Notes |
|---------|--------|-------|
| Live streaming sales | ✅ | /live, /live/[id] (chat + featured products), /live/schedule — needs external RTMP provider (Mux/Cloudflare Stream) |
| Video marketplace | ✅ | /videos (TikTok-style snap scroll + IntersectionObserver autoplay), /videos/upload (Cloudinary video + canvas thumbnail) |
| AI-generated ad creatives | ✅ | services/aiAdCreative.ts (generates headline/body/CTA + 3 A/B variants) |
| Loyalty rewards system | ✅ | /rewards (tiers + redemption), /admin/loyalty, services/loyalty.ts (atomic Firestore transaction) |
| Affiliate / referral program | ✅ | /referrals (8-char code + share buttons + qualified tracking) |
| SSO integration (Mailchimp, HubSpot, Meta Business) | ✅ | /admin/integrations + services/marketingSync.ts (5 providers, per-provider try/catch) |
| Advanced ad engine (CPM/CPC bidding, A/B testing) | ✅ | /admin/campaigns + /admin/campaigns/[id] (variants + statistical significance + auto-optimize) |

---

### 13.16 Final Status (Sessions 1–8)

**All 5 phases functionally complete.** The platform now spans:
- **Phase 1 MVP**: All 50+ pages, auth, marketplace, messaging, admin portal, public site
- **Phase 2 Growth**: Reviews, follows, FCM push, OTP, subscriptions, ads, tax, storage adapters, advisor plans
- **Phase 3 Intelligence**: AI (description gen, fraud detection, image tagging, reply assistant), i18n, blog, invoices, GA4/Pixel, cohort analytics, scheduled backups
- **Phase 4 Enterprise**: Multi-tenant, white-label branding, custom domains, regional roles, API marketplace, data residency, SLA dashboard, geo-ads
- **Phase 5 Ecosystem**: Live streams, video feed, loyalty + referrals, ad engine (A/B), AI ad creatives, marketing SSO

**Production prerequisites still needed:**
- Real Firebase project + env vars (NEXT_PUBLIC_FIREBASE_*)
- `npm install firebase-admin @supabase/supabase-js @aws-sdk/s3-request-presigner` for server-side payment/restore/S3
- Live payment gateway credentials (Stripe secret keys, eWAY API key + password)
- External RTMP provider for live streaming (Mux/Cloudflare Stream/Agora/AWS IVS)
- Cloudinary video upload preset enabled
- VAPID key for FCM web push
- AI provider API key (OpenAI/OpenRouter) configured in admin AI Settings
- Native mobile apps (Phase 3 item) — separate React Native project

---

*End of Specification — TradeCircle Platform v1.5*
*This document is a living specification. Update version number and date on each revision.*
