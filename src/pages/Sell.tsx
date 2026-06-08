import { useEffect, useState } from "react";
import { useRouter, Link } from "../lib/router";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { supabase } from "../lib/supabase";
import {
  fetchProducts,
  fetchOrders,
  money,
  slugify,
  uploadFile,
  PRODUCT_TYPES,
  COMMISSION,
  typeLabel,
  typeKind,
} from "../lib/data";
import { aiChat } from "../lib/ai";
import type { Product, Order, DeliveryPayload, StockItem, ProductType } from "../lib/types";
import { Button, Input, Textarea, Card, Spinner, Badge, EmptyState } from "../components/ui";
import { TypeIcon, ArrowRightIcon } from "../components/Icons";
import DeliveryEditor from "../components/DeliveryEditor";

export default function Sell() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [tab, setTab] = useState<"dashboard" | "products" | "new">("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    reload();
  }, [user]);

  async function reload() {
    if (!user) return;
    setLoading(true);
    const [p, o] = await Promise.all([
      fetchProducts({ creatorId: user.id }),
      fetchOrders({ creator_id: user.id }),
    ]);
    setProducts(p);
    setOrders(o);
    setLoading(false);
  }

  const approved = orders.filter((o) => o.status === "approved");
  const pending = orders.filter((o) => o.status === "pending");
  const gross = approved.reduce((a, o) => a + Number(o.amount), 0);
  const net = gross * (1 - COMMISSION);
  const totalViews = products.reduce((a, p) => a + (p.views || 0), 0);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Creator Studio</h1>
        <div className="flex gap-2">
          <Link to="/store-designer"><Button variant="outline">🎨 Store Designer</Button></Link>
          <Button onClick={() => { setEditing(null); setTab("new"); }}>+ New product</Button>
        </div>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {[["dashboard", "Dashboard"], ["products", `Products (${products.length})`], ["new", editing ? "Edit product" : "Upload"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === k ? "border-indigo-500 text-indigo-600 dark:text-indigo-300" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{label}</button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Net earnings" value={money(net)} sub={`after ${COMMISSION * 100}% fee`} color="emerald" />
              <Stat label="Approved sales" value={String(approved.length)} color="indigo" />
              <Stat label="Pending" value={String(pending.length)} color="amber" />
              <Stat label="Total views" value={String(totalViews)} color="violet" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link to="/payouts"><Card className="p-4 transition hover:shadow-md"><p className="font-bold text-slate-900 dark:text-white">💸 Request Payout</p><p className="text-xs text-slate-500">Withdraw your earnings</p></Card></Link>
              <Link to="/store-designer"><Card className="p-4 transition hover:shadow-md"><p className="font-bold text-slate-900 dark:text-white">🎨 Design Store</p><p className="text-xs text-slate-500">Premium canvas builder</p></Card></Link>
              <Link to="/transactions"><Card className="p-4 transition hover:shadow-md"><p className="font-bold text-slate-900 dark:text-white">🧾 Transactions</p><p className="text-xs text-slate-500">History & deposits</p></Card></Link>
            </div>
            <Card className="p-5">
              <h3 className="mb-3 font-bold text-slate-900 dark:text-white">Recent activity</h3>
              {orders.length === 0 ? <p className="text-sm text-slate-400">No sales yet. Upload a product to start earning!</p> : (
                <div className="space-y-2">
                  {orders.slice(0, 6).map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                      <span className="line-clamp-1 text-sm text-slate-700 dark:text-slate-200">{o.product?.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{money(o.amount)}</span>
                        <Badge color={o.status === "approved" ? "green" : o.status === "rejected" ? "rose" : "amber"}>{o.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === "products" && (
          products.length === 0 ? (
            <EmptyState icon="🧩" title="No products yet" desc="Upload your first digital product." action={<Button onClick={() => setTab("new")}>Upload product</Button>} />
          ) : (
            <div className="space-y-3">
              {products.map((p) => (
                <Card key={p.id} className="flex items-center gap-4 p-3">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-indigo-400 dark:bg-slate-800">
                    {p.cover_url ? <img src={p.cover_url} alt="" className="h-full w-full object-cover" /> : <TypeIcon type={p.type} className="h-7 w-7" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 font-semibold text-slate-900 dark:text-white">{p.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <Badge color={p.status === "published" ? "green" : p.status === "rejected" ? "rose" : "slate"}>{p.status}</Badge>
                      <span>{p.views || 0} views</span>
                      <span>{typeLabel(p.type)}</span>
                      {typeKind(p.type) === "stock" && <span>{(p.stock_items || []).filter((s) => !s.sold).length} in stock</span>}
                    </div>
                  </div>
                  <span className="font-bold">{money(p.price)}</span>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(p); setTab("new"); }}>Edit</Button>
                </Card>
              ))}
            </div>
          )
        )}

        {tab === "new" && <ProductForm existing={editing} onSaved={() => { reload(); setTab("products"); setEditing(null); }} />}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const c: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    indigo: "from-indigo-500 to-blue-600",
    amber: "from-amber-500 to-orange-600",
    violet: "from-violet-500 to-fuchsia-600",
  };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${c[color]} p-4 text-white shadow-lg`}>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      {sub && <p className="text-[10px] opacity-70">{sub}</p>}
    </div>
  );
}

function ProductForm({ existing, onSaved }: { existing: Product | null; onSaved: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(existing ? 2 : 1);
  const [f, setF] = useState({
    title: existing?.title || "",
    type: existing?.type || "template",
    short_desc: existing?.short_desc || "",
    description: existing?.description || "",
    price: existing?.price?.toString() || "",
    is_recurring: existing?.is_recurring || false,
    tags: (existing?.tags || []).join(", "),
    whats_included: existing?.whats_included || "",
    preview_text: existing?.preview_text || "",
    cover_url: existing?.cover_url || "",
    gallery: existing?.gallery || [],
  });
  const [delivery, setDelivery] = useState<DeliveryPayload>(existing?.delivery || {});
  const [stockItems, setStockItems] = useState<StockItem[]>(existing?.stock_items || []);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  async function aiGenerate() {
    if (!f.title) { toast("Enter a title first", "error"); return; }
    setAiLoading(true);
    const out = await aiChat([
      { role: "system", content: "You write marketplace product listings. Return JSON only." },
      { role: "user", content: `Write a listing for a ${typeLabel(f.type)} titled "${f.title}". Return JSON: {"short_desc":"~1 sentence","description":"2 short paragraphs","tags":"comma separated 6 tags","price":"suggested USD number"}` },
    ]);
    try {
      const j = JSON.parse(out.replace(/```json|```/g, "").trim());
      setF((s) => ({ ...s, short_desc: j.short_desc || s.short_desc, description: j.description || s.description, tags: j.tags || s.tags, price: s.price || (j.price?.toString() || "") }));
      toast("AI filled your listing ✨", "success");
    } catch {
      setF((s) => ({ ...s, description: out }));
      toast("AI suggestion added", "info");
    }
    setAiLoading(false);
  }

  async function uploadCover(file: File | null, isGallery = false) {
    if (!file) return;
    const up = await uploadFile(file, "products");
    if (up.url) {
      if (isGallery) setF((s) => ({ ...s, gallery: [...s.gallery, up.url!] }));
      else setF((s) => ({ ...s, cover_url: up.url! }));
      toast("Image uploaded", "success");
    } else toast("Upload failed (create 'uploads' bucket)", "error");
  }

  async function save() {
    if (!user || !f.title) { toast("Title required", "error"); return; }
    setSaving(true);
    const payload = {
      creator_id: user.id,
      title: f.title,
      slug: slugify(f.title),
      type: f.type,
      short_desc: f.short_desc,
      description: f.description,
      price: Number(f.price) || 0,
      is_recurring: f.is_recurring,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      whats_included: f.whats_included,
      preview_text: f.preview_text,
      cover_url: f.cover_url,
      gallery: f.gallery,
      delivery,
      stock_items: stockItems,
      stock_count: stockItems.filter((s) => !s.sold).length,
      status: "published",
    };
    const res = existing
      ? await supabase.from("products").update(payload).eq("id", existing.id)
      : await supabase.from("products").insert(payload);
    if (res.error) { toast(res.error.message, "error"); setSaving(false); return; }
    toast(existing ? "Product updated ✅" : "Product published 🚀", "success");
    setSaving(false);
    onSaved();
  }

  // Step 1: choose type
  if (step === 1) {
    return (
      <div>
        <h3 className="mb-1 font-bold text-slate-900 dark:text-white">What are you selling?</h3>
        <p className="mb-4 text-sm text-slate-500">Each type has a tailored upload & delivery flow.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_TYPES.map((t) => (
            <button key={t.value} onClick={() => { setF((s) => ({ ...s, type: t.value as ProductType })); setStep(2); }} className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white dark:bg-indigo-500/10">
                <TypeIcon type={t.value} className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-bold text-slate-900 dark:text-white">{t.label}</span>
                <span className="block text-xs text-slate-500">{t.desc}</span>
                <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">{t.kind} delivery</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: details + delivery
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10"><TypeIcon type={f.type} className="h-5 w-5" /></span>
          <h3 className="font-bold text-slate-900 dark:text-white">{existing ? "Edit" : "New"} {typeLabel(f.type)}</h3>
        </div>
        <div className="flex gap-2">
          {!existing && <Button size="sm" variant="ghost" onClick={() => setStep(1)}>Change type</Button>}
          <Button size="sm" variant="soft" onClick={aiGenerate} disabled={aiLoading}>{aiLoading ? "Thinking..." : "🤖 AI assist"}</Button>
        </div>
      </div>

      <Field label="Product title *"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ultimate Notion Dashboard" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price (USD)"><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="0 for free" /></Field>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={f.is_recurring} onChange={(e) => setF({ ...f, is_recurring: e.target.checked })} className="h-4 w-4 rounded" />
            Recurring subscription
          </label>
        </div>
      </div>
      <Field label="Short description"><Input value={f.short_desc} onChange={(e) => setF({ ...f, short_desc: e.target.value })} placeholder="One catchy sentence" /></Field>
      <Field label="Full description"><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Tags (comma separated)"><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="notion, productivity" /></Field>
      <Field label="What you'll get (one per line)"><Textarea rows={3} value={f.whats_included} onChange={(e) => setF({ ...f, whats_included: e.target.value })} placeholder={"50+ templates\nLifetime updates"} /></Field>
      <Field label="Preview sample (watermarked)"><Textarea rows={2} value={f.preview_text} onChange={(e) => setF({ ...f, preview_text: e.target.value })} /></Field>

      <Field label="Cover image">
        <div className="flex items-center gap-3">
          {f.cover_url && <img src={f.cover_url} alt="" className="h-16 w-24 rounded-lg object-cover" />}
          <label className="cursor-pointer rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 dark:border-slate-700">Upload cover<input type="file" accept="image/*" className="hidden" onChange={(e) => uploadCover(e.target.files?.[0] || null)} /></label>
        </div>
      </Field>
      <Field label="Gallery / preview images">
        <div className="flex flex-wrap items-center gap-2">
          {f.gallery.map((g, i) => (
            <div key={i} className="relative"><img src={g} alt="" className="h-16 w-16 rounded-lg object-cover" /><button onClick={() => setF((s) => ({ ...s, gallery: s.gallery.filter((_, x) => x !== i) }))} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs text-white">✕</button></div>
          ))}
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 text-2xl text-slate-400 dark:border-slate-700">+<input type="file" accept="image/*" className="hidden" onChange={(e) => uploadCover(e.target.files?.[0] || null, true)} /></label>
        </div>
      </Field>

      <DeliveryEditor type={f.type} delivery={delivery} setDelivery={setDelivery} stockItems={stockItems} setStockItems={setStockItems} />

      <Button className="w-full" size="lg" onClick={save} disabled={saving}>
        {saving ? "Saving..." : existing ? "Update product" : "Publish product"} <ArrowRightIcon className="h-4 w-4" />
      </Button>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</label>
      {children}
    </div>
  );
}
