import { supabase } from "./supabase";
import type { Product, Order, PaymentMethod, Review } from "./types";

// Delivery "kind" groups how a product is uploaded & delivered.
// file = downloadable files/links | course = chapters & lessons
// prompt = prompt list | stock = inventory slots (accounts/proxies)
export type DeliveryKind = "file" | "course" | "prompt" | "stock";

export const PRODUCT_TYPES: {
  value: string;
  label: string;
  kind: DeliveryKind;
  desc: string;
}[] = [
  { value: "template", label: "Templates", kind: "file", desc: "Notion, Canva & other ready-to-use templates" },
  { value: "prompt_pack", label: "AI Prompt Packs", kind: "prompt", desc: "Curated prompt collections & toolkits" },
  { value: "course", label: "Courses & Guides", kind: "course", desc: "Video courses with modules & lessons" },
  { value: "ebook", label: "eBooks", kind: "file", desc: "PDFs, guides & written knowledge" },
  { value: "presets", label: "Presets & LUTs", kind: "file", desc: "Lightroom presets, LUTs & filters" },
  { value: "graphics", label: "Graphics & Icons", kind: "file", desc: "Icon packs, illustrations & assets" },
  { value: "fonts", label: "Fonts", kind: "file", desc: "Typefaces & font families" },
  { value: "printables", label: "Planners & Printables", kind: "file", desc: "Digital planners & printables" },
  { value: "account", label: "Accounts", kind: "stock", desc: "Account slots delivered from inventory" },
  { value: "proxy", label: "Proxies", kind: "stock", desc: "Proxy slots delivered from inventory" },
  { value: "other", label: "Other Assets", kind: "file", desc: "Any other digital asset" },
];

export function typeLabel(t: string) {
  return PRODUCT_TYPES.find((x) => x.value === t)?.label || t;
}
export function typeKind(t: string): DeliveryKind {
  return PRODUCT_TYPES.find((x) => x.value === t)?.kind || "file";
}
export function genToken() {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

export function money(n: number) {
  return "$" + Number(n || 0).toFixed(2);
}

export function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function uploadFile(
  file: File,
  folder: string
): Promise<{ url?: string; error?: string }> {
  const ext = file.name.split(".").pop();
  const name = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("uploads")
    .upload(name, file, { upsert: false });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("uploads").getPublicUrl(name);
  return { url: data.publicUrl };
}

export async function fetchProducts(opts?: {
  type?: string;
  search?: string;
  sort?: string;
  creatorId?: string;
  status?: string;
}): Promise<Product[]> {
  let q = supabase.from("products").select("*, creator:profiles(*)");
  if (opts?.creatorId) q = q.eq("creator_id", opts.creatorId);
  if (opts?.status) q = q.eq("status", opts.status);
  else if (!opts?.creatorId) q = q.eq("status", "published");
  if (opts?.type) q = q.eq("type", opts.type);
  if (opts?.sort === "price_low") q = q.order("price", { ascending: true });
  else if (opts?.sort === "price_high")
    q = q.order("price", { ascending: false });
  else if (opts?.sort === "rating") q = q.order("rating", { ascending: false });
  else q = q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(200);
  if (error) return [];
  let list = (data || []) as Product[];
  if (opts?.search) {
    const s = opts.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.title?.toLowerCase().includes(s) ||
        p.short_desc?.toLowerCase().includes(s) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(s))
    );
  }
  return list;
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data } = await supabase
    .from("products")
    .select("*, creator:profiles(*)")
    .eq("id", id)
    .maybeSingle();
  return (data as Product) || null;
}

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("active", true);
  return (data as PaymentMethod[]) || [];
}

export async function fetchReviews(productId: string): Promise<Review[]> {
  const { data } = await supabase
    .from("reviews")
    .select("*, buyer:profiles(*)")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  return (data as Review[]) || [];
}

export async function fetchOrders(filter: {
  buyer_id?: string;
  creator_id?: string;
  status?: string;
}): Promise<Order[]> {
  let q = supabase
    .from("orders")
    .select("*, product:products(*), buyer:profiles!orders_buyer_id_fkey(*)");
  if (filter.buyer_id) q = q.eq("buyer_id", filter.buyer_id);
  if (filter.creator_id) q = q.eq("creator_id", filter.creator_id);
  if (filter.status) q = q.eq("status", filter.status);
  const { data } = await q.order("created_at", { ascending: false });
  return (data as Order[]) || [];
}

export const COMMISSION = 0.2; // platform commission

export async function fetchOrderByToken(token: string): Promise<Order | null> {
  const { data } = await supabase
    .from("orders")
    .select("*, product:products(*, creator:profiles(*))")
    .eq("access_token", token)
    .maybeSingle();
  return (data as Order) || null;
}

export async function fetchProductBySlug(
  username: string,
  slug: string
): Promise<Product | null> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (!prof) return null;
  const { data } = await supabase
    .from("products")
    .select("*, creator:profiles(*)")
    .eq("creator_id", prof.id)
    .eq("slug", slug)
    .maybeSingle();
  return (data as Product) || null;
}

export async function adjustBalance(userId: string, delta: number) {
  const { data } = await supabase
    .from("profiles")
    .select("balance")
    .eq("id", userId)
    .maybeSingle();
  const current = Number(data?.balance || 0);
  await supabase
    .from("profiles")
    .update({ balance: current + delta })
    .eq("id", userId);
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
