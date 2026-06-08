export type Role = "buyer" | "creator" | "admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  role: Role;
  is_creator: boolean;
  payout_method: string;
  payout_details: string;
  referral_name: string;
  referred_by: string;
  links: string;
  phone: string;
  country: string;
  balance: number;
  status: "active" | "suspended" | "banned";
  store_name: string;
  store_status: "active" | "suspended";
  store_theme: StoreTheme;
  store_blocks: StoreBlock[];
  created_at: string;
}

export interface StoreTheme {
  primary?: string;
  accent?: string;
  bg?: string;
  text?: string;
  font?: string;
  headingFont?: string;
  layout?: "grid" | "list" | "magazine";
  rounded?: string;
  heroStyle?: "gradient" | "image" | "solid";
  preset?: string;
  maxWidth?: string;
  shadow?: string;
}

export type StoreBlockType =
  | "hero" | "heading" | "text" | "products" | "product_single" | "image"
  | "gallery" | "video" | "spacer" | "button" | "testimonial" | "divider"
  | "features" | "faq" | "stats" | "pricing" | "cta_banner" | "logos"
  | "newsletter" | "social" | "countdown" | "embed" | "html" | "marquee"
  | "team" | "steps" | "quote" | "badge_row" | "two_column" | "accordion"
  | "map" | "contact" | "announcement" | "cards" | "icon_grid" | "footer"
  | "image_text" | "banner";

export interface StoreBlock {
  id: string;
  type: StoreBlockType;
  props: Record<string, unknown>;
}

export type ProductType =
  | "template"
  | "prompt_pack"
  | "course"
  | "ebook"
  | "presets"
  | "graphics"
  | "fonts"
  | "printables"
  | "account"
  | "proxy"
  | "other";

// Type-specific delivery payloads
export interface CourseModule {
  id: string;
  title: string;
  lessons: CourseLesson[];
}
export interface CourseLesson {
  id: string;
  title: string;
  video_url: string;
  description: string;
  duration: string;
  attachment_url?: string;
}
export interface StockItem {
  value: string;
  sold: boolean;
}
export interface DeliveryPayload {
  // files (template, ebook, graphics, fonts, presets, printables, other)
  files?: { name: string; url: string }[];
  external_links?: { label: string; url: string }[];
  // course
  modules?: CourseModule[];
  // prompt pack
  prompts?: { title: string; body: string }[];
  // account / proxy delivered via stock_items
  account_instructions?: string;
  // generic note shown after purchase
  access_note?: string;
}

export interface Product {
  id: string;
  creator_id: string;
  title: string;
  slug: string;
  type: ProductType;
  short_desc: string;
  description: string;
  price: number;
  is_recurring: boolean;
  tags: string[];
  category: string;
  cover_url: string;
  gallery: string[];
  preview_text: string;
  whats_included: string;
  status: "draft" | "pending" | "published" | "rejected";
  featured: boolean;
  views: number;
  rating: number;
  rating_count: number;
  delivery: DeliveryPayload;
  stock_items: StockItem[];
  stock_count: number;
  created_at: string;
  creator?: Profile;
}

export type OrderStatus = "pending" | "approved" | "rejected";

export interface Order {
  id: string;
  buyer_id: string | null;
  product_id: string;
  creator_id: string;
  amount: number;
  status: OrderStatus;
  proof_url: string;
  payment_reference: string;
  payment_method: string;
  admin_note: string;
  payout_status: "unpaid" | "processed";
  contact_email: string;
  contact_whatsapp: string;
  access_token: string;
  delivered_payload: Record<string, unknown>;
  created_at: string;
  product?: Product;
  buyer?: Profile;
}

export interface Review {
  id: string;
  product_id: string;
  buyer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  buyer?: Profile;
}

export interface PaymentMethod {
  id: string;
  label: string;
  icon: string;
  details: string;
  active: boolean;
}

export interface ApiKeyConfig {
  id: string;
  provider: string;
  key_value: string;
  model: string;
  active: boolean;
}

export interface AppNotification {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  read: boolean;
  broadcast: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: "deposit" | "payout" | "sale" | "admin_credit" | "admin_debit";
  amount: number;
  status: "pending" | "approved" | "rejected" | "processed";
  method: string;
  details: string;
  proof_url: string;
  admin_note: string;
  created_at: string;
  user?: Profile;
}

export interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  details: string;
  status: "pending" | "processed" | "rejected";
  admin_note: string;
  created_at: string;
  user?: Profile;
}

export interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  reply: string;
  status: "open" | "answered" | "closed";
  created_at: string;
  user?: Profile;
}

export interface Progress {
  id: string;
  user_id: string;
  product_id: string;
  completed_lessons: string[];
  updated_at: string;
}
