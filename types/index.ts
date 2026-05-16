/**
 * TradeCircle — Shared TypeScript Types
 * Source of truth for all Firestore collections and domain models.
 * Spec ref: section 9.3 (Firestore Data Model)
 *
 * NOTE: Timestamp is a structural match for firebase/firestore Timestamp.
 * Replace the local definition with:
 *   import { Timestamp } from 'firebase/firestore'
 * once Firebase is installed.
 */

// ─────────────────────────────────────────────
// Firestore Timestamp (structural alias)
// ─────────────────────────────────────────────
export interface Timestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

// ─────────────────────────────────────────────
// Union Types
// ─────────────────────────────────────────────

export type UserRole =
  | 'buyer'
  | 'seller'
  | 'advisor';

export type AdminRole =
  | 'super-admin'
  | 'admin'
  | 'moderator'
  | 'analyst';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentGateway =
  | 'stripe'
  | 'eway'
  | 'esewa'
  | 'khalti'
  | 'fonepay'
  | 'contact-seller';

export type AdType =
  | 'feed'
  | 'boost'
  | 'banner'
  | 'location';

export type BackupScope =
  | 'full'
  | 'settings'
  | 'users'
  | 'products'
  | 'advisors';

export type RestoreMode =
  | 'full'
  | 'merge'
  | 'selective';

// ─────────────────────────────────────────────
// Shared Sub-types
// ─────────────────────────────────────────────

export interface UserLocation {
  city: string;
  country: string;
}

export interface ProductImage {
  url: string;
  cloudinaryId: string;
}

export interface AdviceStep {
  title: string;
  description: string;
  images: string[]; // Cloudinary URLs
}

export interface MessageAttachment {
  url: string;
  type: 'image' | 'audio' | 'file';
  name?: string;
}

// ─────────────────────────────────────────────
// users/{uid}
// ─────────────────────────────────────────────
export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  location?: UserLocation;
  profilePhoto?: string;
  coverPhoto?: string;
  bio?: string;
  /** Seller-specific */
  brand?: string;
  /** Advisor-specific */
  specialty?: string;
  verified?: boolean;
  createdAt: Timestamp;
  emailVerified: boolean;
  active: boolean;
}

// ─────────────────────────────────────────────
// products/{productId}
// ─────────────────────────────────────────────
export type ProductCondition = 'new' | 'used' | 'refurbished';
export type ProductCurrency = 'AUD' | 'USD' | 'NPR' | 'INR';

export interface Product {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  productCode?: string;
  category: string;
  images: ProductImage[]; // max 5
  price: number;
  currency: ProductCurrency;
  condition: ProductCondition;
  location: UserLocation;
  active: boolean;
  negotiable?: boolean;
  createdAt: Timestamp;
  views: number;
}

// ─────────────────────────────────────────────
// orders/{orderId}
// ─────────────────────────────────────────────
export interface OrderAddress {
  street: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export interface Order {
  id: string;
  buyerId: string;
  productId: string;
  sellerId: string;
  /** Contact info captured at checkout */
  fullName: string;
  phone: string;
  email: string;
  address: OrderAddress;
  notes?: string;
  amount: number;
  currency: ProductCurrency;
  gateway: PaymentGateway;
  status: OrderStatus;
  taxAmount?: number;
  taxRate?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// messages/{conversationId}  (Conversation + Message)
// ─────────────────────────────────────────────
export interface Message {
  id: string;
  senderId: string;
  text: string;
  attachments: MessageAttachment[];
  timestamp: Timestamp;
  read: boolean;
}

export interface Conversation {
  id: string;
  participants: [string, string]; // [uid1, uid2]
  messages: Message[];
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  unreadCount?: Record<string, number>; // uid → unread count
}

// ─────────────────────────────────────────────
// advicePosts/{postId}
// ─────────────────────────────────────────────
export type AdviceVisibility = 'public' | 'circle';

export interface AdvicePost {
  id: string;
  advisorId: string;
  title: string;
  subject: string;
  description: string;
  steps: AdviceStep[];
  tags: string[];
  visibility: AdviceVisibility;
  createdAt: Timestamp;
  views: number;
  published: boolean;
}

// ─────────────────────────────────────────────
// advisorEnquiries/{enquiryId}
// ─────────────────────────────────────────────
export type EnquiryStatus = 'pending' | 'responded';

export interface AdvisorEnquiry {
  id: string;
  fromUserId: string;
  toAdvisorId: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  message: string;
  attachments: string[]; // Cloudinary URLs, max 3
  status: EnquiryStatus;
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────
// config/{siteConfig}  — sub-types first
// ─────────────────────────────────────────────

export interface BrandingConfig {
  companyName: string;
  logoUrl?: string;
  faviconUrl?: string;
}

export interface CurrencyRates {
  nprToAud: number;
  nprToUsd: number;
}

export interface CurrencyConfig {
  active: ProductCurrency;
  rates: CurrencyRates;
}

export interface FirebaseConfig {
  enabled: boolean;
  apiKey?: string;
  projectId?: string;
  authDomain?: string;
  storageBucket?: string;
  appId?: string;
}

export interface SupabaseConfig {
  enabled: boolean;
  url?: string;
  anonKey?: string;
}

export interface CloudinaryConfig {
  enabled: boolean;
  cloudName?: string;
  uploadPreset?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface S3Config {
  enabled: boolean;
  bucket?: string;
  region?: string;
  accessKey?: string;
}

export interface EmailJSConfig {
  publicKey?: string;
  serviceId?: string;
  contactTemplateId?: string;
  contactEnabled: boolean;
  paymentTemplateId?: string;
  paymentEnabled: boolean;
}

export interface GatewayConfig {
  enabled: boolean;
  sandboxMode?: boolean;
  /** Publishable/public keys only — secret keys never stored on client */
  publishableKey?: string;
  paymentLinkUrl?: string; // Stripe
  apiKey?: string;         // eWAY
  endpointUrl?: string;    // eWAY
  merchantQrUrl?: string;  // Fonepay
  merchantCode?: string;   // eSewa
}

export interface GatewaysConfig {
  stripe: GatewayConfig;
  eway: GatewayConfig;
  esewa: GatewayConfig;
  khalti: GatewayConfig;
  fonepay: GatewayConfig;
}

export interface AuthConfig {
  requireEmailVerification: boolean;
  guestCheckout: boolean;
  googleSignIn: boolean;
  showAuthButtons: boolean;
}

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'tel'
  | 'select'
  | 'file'
  | 'checkbox';

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select fields
  order: number;
  enabled: boolean;
}

export interface FormsConfig {
  productListing: FormField[];
  contactAdvisor: FormField[];
  contactSeller: FormField[];
}

export interface ThemeConfig {
  cssVars: Record<string, string>; // e.g. { '--color-primary': '#1877F2' }
  fontFamily?: string;
  borderRadius?: string;
}

export interface SiteConfig {
  branding: BrandingConfig;
  currency: CurrencyConfig;
  firebase: FirebaseConfig;
  supabase: SupabaseConfig;
  cloudinary: CloudinaryConfig;
  s3: S3Config;
  emailjs: EmailJSConfig;
  gateways: GatewaysConfig;
  auth: AuthConfig;
  forms: FormsConfig;
  theme: ThemeConfig;
  tax: TaxConfig;
  analytics: AnalyticsConfig;
}

// ─────────────────────────────────────────────
// adminUsers/{adminUserId}
// ─────────────────────────────────────────────
export interface AdminPermissions {
  users: boolean;
  products: boolean;
  advisories: boolean;
  enquiries: boolean;
  orders: boolean;
  ads: boolean;
  aiSettings: boolean;
  cms: boolean;
  featureToggles: boolean;
  config: boolean;
  analytics: boolean;
  exports: boolean;
  backup: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermissions;
  createdAt: Timestamp;
  lastLogin?: Timestamp;
  active: boolean;
}

// ─────────────────────────────────────────────
// notifications/{uid}/items/{notificationId}
// ─────────────────────────────────────────────
export type NotificationType =
  | 'message'
  | 'enquiry'
  | 'order'
  | 'follow'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  linkTo: string; // app route, e.g. '/messages'
  read: boolean;
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────
// ads/{adId}
// ─────────────────────────────────────────────
export type AdStatus = 'active' | 'paused' | 'ended';

export interface AdCreative {
  imageUrl: string;
  headline: string;
  ctaUrl: string;
}

export interface AdTargeting {
  locationRadius?: number; // km
  category?: string;
  roles: UserRole[];
}

export interface AdSchedule {
  startDate: Timestamp;
  endDate: Timestamp;
}

export interface AdStats {
  impressions: number;
  clicks: number;
}

export interface Ad {
  id: string;
  advertiserId: string;
  name: string;
  type: AdType;
  creative: AdCreative;
  targeting: AdTargeting;
  schedule: AdSchedule;
  stats: AdStats;
  status: AdStatus;
  budget?: number;
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────
// reviews/{reviewId}
// ─────────────────────────────────────────────
export type ReviewModerationStatus = 'pending' | 'approved' | 'removed';

export interface Review {
  id: string;
  reviewerId: string;
  sellerId: string;
  orderId: string;
  productId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: Timestamp;
  moderationStatus: ReviewModerationStatus;
}

export interface RatingAggregate {
  average: number;    // 0–5, rounded to 1 decimal
  count: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>; // count per star level
}

// ─────────────────────────────────────────────
// adminLogs/{logId}
// ─────────────────────────────────────────────
export type AdminLogAction =
  | 'backup'
  | 'restore'
  | 'delete'
  | 'config-change'
  | 'user-create'
  | 'user-update'
  | 'user-delete'
  | 'user-ban'
  | 'user-unban'
  | 'product-remove';

export type AdminLogStatus = 'success' | 'failed';

export interface AdminLog {
  id: string;
  adminUid: string;
  adminEmail?: string;
  action: AdminLogAction;
  scope?: string;
  targetCollection?: string;
  targetUid?: string;
  recordCount?: number;
  ipAddress?: string;
  timestamp: Timestamp;
  status: AdminLogStatus;
  notes?: string;
  errorMessage?: string;
}

// ─────────────────────────────────────────────
// backups/{backupId}
// ─────────────────────────────────────────────
export type BackupSchedule = 'manual' | 'daily' | 'weekly' | 'monthly';
export type BackupStatus = 'complete' | 'failed' | 'in-progress';

export interface Backup {
  id: string;
  createdBy: string;   // admin email
  scope: BackupScope;
  schemaVersion: string;
  platformVersion: string;
  storagePath?: string; // Firebase Storage URL
  fileSizeBytes?: number;
  collections: string[];
  schedule: BackupSchedule;
  status: BackupStatus;
  createdAt: Timestamp;
  errorMessage?: string;
}

// ─────────────────────────────────────────────
// follows/{followerUid}/following/{targetUid}
// ─────────────────────────────────────────────
export interface Follow {
  targetUid: string;
  targetName: string;
  targetRole: UserRole;
  targetPhoto?: string;
  followedAt: Timestamp;
}

// ─────────────────────────────────────────────
// Seller/Advisor profile stats
// ─────────────────────────────────────────────
export interface ProfileStats {
  followerCount: number;
  followingCount: number;
  productCount: number;   // sellers
  adviceCount: number;    // advisors
}

// ─────────────────────────────────────────────
// sellerSubscriptions/{uid}
// ─────────────────────────────────────────────
export type SubscriptionTierId = 'free' | 'basic' | 'pro' | 'premium';

export interface SubscriptionTier {
  id: SubscriptionTierId;
  name: string;
  priceAud: number;       // monthly AUD price (0 for free)
  maxListings: number;    // -1 for unlimited
  featuredListings: number;
  adCreditsMonthly: number;
  analyticsAccess: boolean;
  prioritySupport: boolean;
  stripePriceId?: string; // Stripe Billing price ID
}

export interface SellerSubscription {
  uid: string;
  tier: SubscriptionTierId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Timestamp;
  cancelAtPeriodEnd: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// Tax configuration (stored in config/siteConfig)
// ─────────────────────────────────────────────
export interface TaxRegion {
  code: string;       // e.g. 'AU', 'NP', 'US'
  name: string;       // e.g. 'Australia', 'Nepal'
  taxName: string;    // e.g. 'GST', 'VAT', 'Sales Tax'
  rate: number;       // percentage e.g. 10 for 10%
  enabled: boolean;
  applyToShipping: boolean;
  inclusive: boolean; // price already includes tax
}

export interface TaxConfig {
  enabled: boolean;
  regions: TaxRegion[];
  defaultRegionCode: string;
}

// ─────────────────────────────────────────────
// Analytics configuration (stored in config/siteConfig)
// ─────────────────────────────────────────────

export interface AnalyticsConfig {
  ga4MeasurementId?: string;
  facebookPixelId?:  string;
  enabled:           boolean;
}

// ─────────────────────────────────────────────
// advisorSubscriptions/{uid}
// ─────────────────────────────────────────────
export type AdvisorPlanId = 'free' | 'professional' | 'expert';

export interface AdvisorPlan {
  id: AdvisorPlanId;
  name: string;
  priceAud: number;            // 0 for free
  maxActivePosts: number;      // -1 for unlimited
  featuredProfile: boolean;
  directEnquiryPriority: boolean;
  analyticsAccess: boolean;
  verifiedBadge: boolean;
  stripePriceId?: string;
}

export interface AdvisorSubscription {
  uid: string;
  plan: AdvisorPlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Timestamp;
  cancelAtPeriodEnd: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// blogPosts/{postId}
// ─────────────────────────────────────────────
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;       // HTML or markdown
  excerpt: string;
  coverImage?: string;   // Cloudinary URL
  author: string;        // admin name
  category: string;
  tags: string[];
  published: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  views: number;
}

// ─────────────────────────────────────────────
// fraudFlags/{flagId}
// ─────────────────────────────────────────────
export type FraudSeverity = 'low' | 'medium' | 'high';
export type FraudFlagStatus = 'open' | 'reviewed' | 'dismissed';

export interface FraudFlag {
  id: string;
  targetType: 'product' | 'user' | 'order';
  targetId: string;
  targetName: string;
  reason: string;          // AI-generated explanation
  severity: FraudSeverity;
  status: FraudFlagStatus;
  detectedAt: Timestamp;
  reviewedBy?: string;     // admin email
  reviewedAt?: Timestamp;
  notes?: string;
}

// ─────────────────────────────────────────────
// Phase 4 — Multi-tenant
// ─────────────────────────────────────────────
export interface TenantConfig {
  tenantId: string;
  operatorName: string;
  domain: string;
  branding: BrandingConfig;
  billingEmail: string;
  plan: 'starter' | 'growth' | 'enterprise';
  dataRegion: string;   // e.g. 'us-central1', 'asia-southeast1'
  createdAt: Timestamp;
  active: boolean;
}

// Phase 4 — Advanced role hierarchy
export type RegionalRole = 'global-admin' | 'regional-admin' | 'country-admin' | 'city-moderator';
export interface RegionalAdmin {
  uid: string; name: string; email: string;
  role: RegionalRole;
  scope: { regions: string[]; countries: string[]; cities: string[] };  // scope of access
  permissions: AdminPermissions;
  createdAt: Timestamp; active: boolean;
}

// Phase 4 — API marketplace
export type ApiKeyScope = 'read-products' | 'write-products' | 'read-orders' | 'read-users' | 'webhooks';
export interface ApiKey {
  id: string; name: string; ownerUid: string;
  keyHash: string;                    // store hash only; show full key once on creation
  prefix: string;                     // tc_live_XXXX (first 8 chars displayed)
  scopes: ApiKeyScope[];
  rateLimit: number;                  // requests per minute
  lastUsedAt?: Timestamp;
  usageCount: number;
  createdAt: Timestamp; expiresAt?: Timestamp; revoked: boolean;
}

// Phase 4 — SLA monitoring
export type ServiceStatus = 'operational' | 'degraded' | 'partial-outage' | 'major-outage';
export interface ServiceHealth {
  id: string; name: string;                     // e.g. 'API', 'Firestore', 'Auth', 'Storage'
  status: ServiceStatus;
  uptime30d: number;                            // percentage 0-100
  avgResponseMs: number;
  lastIncident?: Timestamp;
  updatedAt: Timestamp;
}
export interface Incident {
  id: string; title: string; description: string;
  severity: 'minor' | 'major' | 'critical';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  affectedServices: string[];
  startedAt: Timestamp; resolvedAt?: Timestamp;
  updates: { message: string; timestamp: Timestamp }[];
}

// Phase 4 — Operator billing
export type OperatorPlanId = 'starter' | 'growth' | 'enterprise';
export interface OperatorPlan {
  id: OperatorPlanId;
  name: string;
  monthlyPriceAud: number;
  maxUsers: number;          // -1 = unlimited
  maxProducts: number;
  maxStorageGb: number;
  customDomain: boolean;
  whiteLabel: boolean;
  dedicatedSupport: boolean;
  slaUptime: number;         // 99.0, 99.9, 99.99
}
export interface OperatorInvoice {
  id: string; tenantId: string;
  amount: number; currency: ProductCurrency;
  status: 'paid' | 'pending' | 'overdue' | 'failed';
  periodStart: Timestamp; periodEnd: Timestamp;
  paidAt?: Timestamp;
  downloadUrl?: string;
  createdAt: Timestamp;
}

// Phase 4 — Data residency
export type DataRegion = 'us-central1' | 'us-east1' | 'europe-west1' | 'asia-southeast1' | 'asia-south1' | 'australia-southeast1';
export interface RegionInfo {
  code: DataRegion;
  name: string;             // e.g. 'Sydney, Australia'
  flag: string;             // emoji
  jurisdiction: string;     // 'AU', 'EU-GDPR', 'IN', etc.
  latencyMs: number;        // typical ping from Sydney
}

// ─────────────────────────────────────────────
// Phase 5 — Loyalty
// ─────────────────────────────────────────────
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type LoyaltyAction = 'purchase' | 'review' | 'referral' | 'signup' | 'first-order' | 'redemption';
export interface LoyaltyAccount {
  uid: string; tier: LoyaltyTier; points: number; lifetimePoints: number;
  tierProgress: number;          // points until next tier
  joinedAt: Timestamp; updatedAt: Timestamp;
}
export interface LoyaltyTransaction {
  id: string; uid: string;
  action: LoyaltyAction;
  points: number;                // positive earned, negative redeemed
  description: string;
  orderId?: string; reviewId?: string; referralId?: string;
  createdAt: Timestamp;
}
export interface LoyaltyReward {
  id: string; name: string; description: string;
  pointsCost: number;
  type: 'discount' | 'free-shipping' | 'product' | 'badge';
  value?: number;                // e.g. 10 for 10% discount
  active: boolean;
  imageUrl?: string;
}

// ─────────────────────────────────────────────
// Phase 5 — Referrals
// ─────────────────────────────────────────────
export interface ReferralCode {
  code: string;                  // 8-char unique
  ownerUid: string; ownerName: string;
  uses: number; maxUses?: number;
  rewardPoints: number;          // points awarded to owner per referral
  signupBonus: number;           // points awarded to new user
  createdAt: Timestamp; expiresAt?: Timestamp; active: boolean;
}
export interface Referral {
  id: string;
  referrerUid: string; referredUid: string;
  code: string;
  status: 'pending' | 'qualified' | 'rewarded';
  signupAt: Timestamp; firstOrderAt?: Timestamp; rewardedAt?: Timestamp;
  pointsAwarded: number;
}

// ─────────────────────────────────────────────
// Phase 5 — Advanced ad engine
// ─────────────────────────────────────────────
export type AdBiddingModel = 'cpm' | 'cpc' | 'cpa' | 'flat';
export type AdAuctionResult = 'won' | 'lost' | 'budget-exceeded';

export interface AdCampaign {
  id: string; advertiserId: string; name: string;
  budget: number; spentToDay: number; spentTotal: number;
  bidAmount: number; biddingModel: AdBiddingModel;
  startDate: Timestamp; endDate: Timestamp;
  status: AdStatus;
  // A/B testing
  variants: AdVariant[];
  activeVariantId?: string;
  winningVariantId?: string;
  createdAt: Timestamp;
}
export interface AdVariant {
  id: string; name: string;            // 'A', 'B', 'C'
  creative: AdCreative;
  impressions: number; clicks: number; conversions: number;
  spend: number;
  trafficWeight: number;               // 0-100, distribution percentage
}

// ─────────────────────────────────────────────
// Phase 5 — Marketing SSO integrations
// ─────────────────────────────────────────────
export type IntegrationProvider = 'mailchimp' | 'hubspot' | 'meta-business' | 'klaviyo' | 'sendgrid';
export interface MarketingIntegration {
  id: string;
  provider: IntegrationProvider;
  enabled: boolean;
  apiKey?: string;          // stored hashed/encrypted in prod
  accountId?: string;
  listId?: string;          // mailchimp audience / hubspot list
  syncContacts: boolean;
  syncOrders: boolean;
  lastSyncAt?: Timestamp;
  status: 'connected' | 'disconnected' | 'error';
  errorMessage?: string;
}

// Phase 5 — Video marketplace
export interface ProductVideo {
  id: string; sellerId: string; productId?: string;
  title: string; description: string;
  videoUrl: string;                  // Cloudinary or external
  thumbnailUrl: string;
  durationSec: number;
  views: number; likes: number;
  tags: string[];
  createdAt: Timestamp; active: boolean;
}

// Phase 5 — Live streaming
export type StreamStatus = 'scheduled' | 'live' | 'ended';
export interface LiveStream {
  id: string; sellerId: string; sellerName: string;
  title: string; description: string;
  productIds: string[];              // products featured in stream
  thumbnailUrl: string;
  streamUrl?: string;                // RTMP/HLS endpoint (placeholder)
  scheduledFor: Timestamp;
  startedAt?: Timestamp; endedAt?: Timestamp;
  status: StreamStatus;
  viewerCount: number; peakViewers: number;
  createdAt: Timestamp;
}
export interface StreamChatMessage {
  id: string; streamId: string;
  senderUid: string; senderName: string;
  text: string; createdAt: Timestamp;
}
