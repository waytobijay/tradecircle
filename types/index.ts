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
  | 'user-ban'
  | 'product-remove';

export type AdminLogStatus = 'success' | 'failed';

export interface AdminLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: AdminLogAction;
  scope?: string;
  targetCollection?: string;
  recordCount?: number;
  ipAddress?: string;
  timestamp: Timestamp;
  status: AdminLogStatus;
  notes?: string;
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
