import { useEffect, useState } from "react";
import { useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { supabase } from "../lib/supabase";
import { seedDemo } from "../lib/seed";
import {
  fetchOrders, money, timeAgo, fmtDate, COMMISSION, typeKind, adjustBalance,
} from "../lib/data";
import type {
  Order, PaymentMethod, ApiKeyConfig, Profile, Product, Transaction, PayoutRequest, Ticket,
} from "../lib/types";
import { Button, Input, Textarea, Card, Spinner, Badge, EmptyState } from "../components/ui";

const TABS: [string, string][] = [
  ["overview", "📊 Overview"],
  ["orders", "⏳ Approvals"],
  ["deposits", "⬇️ Deposits"],
  ["payouts", "💸 Payout Requests"],
  ["earnings", "💰 Creator Earnings"],
  ["users", "👥 Users"],
  ["stores", "🏪 Stores"],
  ["products", "🧩 Products"],
  ["affiliates", "🎁 Affiliates"],
  ["support", "💬 Support"],
  ["broadcast", "📢 Broadcast"],
  ["payments", "💳 Payment Methods"],
  ["ai", "🤖 AI Keys"],
  ["funds", "🪙 Adjust Funds"],
  ["settings", "⚙️ Settings"],
];

export default function Admin() {
  const { profile, loading } = useAuth();
  const { navigate, query } = useRouter();
  const [tab, setTab] = useState(query.get("t") || "overview");

  useEffect(() => {
    if (!loading && profile && profile.role !== "admin") navigate("/");
  }, [profile, loading]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!profile || profile.role !== "admin")
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500">🔒 Admin access only.</p>
        <p className="mt-2 text-xs text-slate-400">Sign in with the admin email in src/lib/auth.tsx (admin@brixnode.com).</p>
      </div>
    );

  return (
    <div className="animate-fade">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Control Center 🛡️</h1>
      <p className="text-sm text-slate-500">15 modules to manage everything across Brixnode</p>

      <div className="mt-4 flex gap-1.5 overflow-x-auto border-b border-slate-200 pb-px dark:border-slate-800">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${tab === k ? "border-indigo-500 text-indigo-600 dark:text-indigo-300" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{label}</button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <Overview />}
        {tab === "orders" && <Approvals />}
        {tab === "deposits" && <Deposits />}
        {tab === "payouts" && <PayoutRequests />}
        {tab === "earnings" && <Earnings />}
        {tab === "users" && <Users />}
        {tab === "stores" && <Stores />}
        {tab === "products" && <Products />}
        {tab === "affiliates" && <Affiliates />}
        {tab === "support" && <SupportAdmin />}
        {tab === "broadcast" && <Broadcast />}
        {tab === "payments" && <Payments />}
        {tab === "ai" && <AiKeys />}
        {tab === "funds" && <Funds />}
        {tab === "settings" && <Settings />}
      </div>
    </div>
  );
}

/* ============ 1. OVERVIEW ============ */
function Overview() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [u, p, o, t] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("amount, status"),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      const orders = (o.data as Order[]) || [];
      const approved = orders.filter((x) => x.status === "approved");
      setStats({
        users: u.count || 0,
        products: p.count || 0,
        pending: orders.filter((x) => x.status === "pending").length,
        sales: approved.length,
        revenue: approved.reduce((a, x) => a + Number(x.amount), 0),
        commission: approved.reduce((a, x) => a + Number(x.amount), 0) * COMMISSION,
        tickets: t.count || 0,
      });
      setLoading(false);
    })();
  }, []);
  if (loading) return <Spinner />;
  const cards = [
    ["Total users", stats.users, "from-indigo-500 to-blue-600"],
    ["Products", stats.products, "from-violet-500 to-fuchsia-600"],
    ["Pending approvals", stats.pending, "from-amber-500 to-orange-600"],
    ["Approved sales", stats.sales, "from-emerald-500 to-teal-600"],
    ["Gross revenue", money(stats.revenue), "from-rose-500 to-pink-600"],
    ["Platform commission", money(stats.commission), "from-cyan-500 to-blue-600"],
    ["Open tickets", stats.tickets, "from-slate-500 to-slate-700"],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map(([label, val, c]) => (
        <div key={label} className={`rounded-2xl bg-gradient-to-br ${c} p-4 text-white shadow-lg`}>
          <p className="text-xs font-semibold opacity-80">{label}</p>
          <p className="mt-1 text-2xl font-black">{val}</p>
        </div>
      ))}
    </div>
  );
}

/* ============ 2. APPROVALS (with delivery on approve) ============ */
function Approvals() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [viewProof, setViewProof] = useState<string | null>(null);

  async function load() { setLoading(true); setOrders(await fetchOrders({ status: filter })); setLoading(false); }
  useEffect(() => { load(); }, [filter]);

  async function approve(o: Order) {
    const updates: Record<string, unknown> = { status: "approved" };
    // consume a stock slot for account/proxy products
    if (o.product && typeKind(o.product.type) === "stock") {
      const items = [...(o.product.stock_items || [])];
      const idx = items.findIndex((s) => !s.sold);
      if (idx === -1) { toast("Out of stock — cannot approve", "error"); return; }
      items[idx].sold = true;
      updates.delivered_payload = { value: items[idx].value };
      await supabase.from("products").update({ stock_items: items, stock_count: items.filter((s) => !s.sold).length }).eq("id", o.product.id);
    }
    await supabase.from("orders").update(updates).eq("id", o.id);
    // credit creator earnings to balance
    if (o.creator_id) await adjustBalance(o.creator_id, Number(o.amount) * (1 - COMMISSION));
    if (o.creator_id) await supabase.from("transactions").insert({ user_id: o.creator_id, type: "sale", amount: Number(o.amount) * (1 - COMMISSION), status: "approved", method: o.payment_method });
    if (o.buyer_id) await supabase.from("notifications").insert({ user_id: o.buyer_id, title: "Order approved ✅", body: `"${o.product?.title}" is unlocked. Access: ${accessUrl(o)}` });
    toast("Approved & delivered ✅", "success");
    load();
  }
  async function reject(o: Order) {
    const note = prompt("Rejection reason (optional):") || "";
    await supabase.from("orders").update({ status: "rejected", admin_note: note }).eq("id", o.id);
    if (o.buyer_id) await supabase.from("notifications").insert({ user_id: o.buyer_id, title: "Order rejected", body: `Your order was rejected. ${note}` });
    toast("Rejected", "info"); load();
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${filter === s ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{s}</button>
        ))}
      </div>
      {loading ? <Spinner /> : orders.length === 0 ? <EmptyState icon="✅" title={`No ${filter} orders`} desc="All caught up." /> : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex flex-wrap items-start gap-4">
                {o.proof_url ? (
                  <button onClick={() => setViewProof(o.proof_url)} className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"><img src={o.proof_url} alt="proof" className="h-full w-full object-cover" /></button>
                ) : <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400 dark:bg-slate-800">No proof</div>}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">{o.product?.title}</p>
                  <p className="text-sm text-slate-500">📧 {o.contact_email || "—"} {o.contact_whatsapp && `· 📱 ${o.contact_whatsapp}`}</p>
                  <p className="text-sm text-slate-500">{o.payment_method} · Ref: {o.payment_reference || "—"}</p>
                  <p className="text-xs text-slate-400">{timeAgo(o.created_at)}</p>
                  {o.status === "approved" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={accessUrl(o)} target="_blank" rel="noreferrer" className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600 dark:bg-indigo-500/10">Open access link</a>
                      {o.contact_whatsapp && <a href={waLink(o)} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/10">Send via WhatsApp</a>}
                      {o.contact_email && <a href={mailLink(o)} className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-bold text-sky-600 dark:bg-sky-500/10">Send via Email</a>}
                    </div>
                  )}
                </div>
                <p className="text-lg font-black text-slate-900 dark:text-white">{money(o.amount)}</p>
              </div>
              {filter === "pending" && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => approve(o)}>✓ Approve & deliver</Button>
                  <Button size="sm" variant="danger" onClick={() => reject(o)}>✕ Reject</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {viewProof && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" onClick={() => setViewProof(null)}><img src={viewProof} alt="proof" className="max-h-[90vh] max-w-full rounded-xl" /></div>}
    </div>
  );
}
function accessUrl(o: Order) { return `${window.location.origin}/access/${o.access_token}`; }
function waLink(o: Order) { return `https://wa.me/${o.contact_whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Your Brixnode product "${o.product?.title}" is ready! Access it here: ${accessUrl(o)}`)}`; }
function mailLink(o: Order) { return `mailto:${o.contact_email}?subject=${encodeURIComponent("Your Brixnode product is ready")}&body=${encodeURIComponent(`Access your product here: ${accessUrl(o)}`)}`; }

/* ============ 3. DEPOSITS ============ */
function Deposits() {
  const toast = useToast();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    const { data } = await supabase.from("transactions").select("*, user:profiles(*)").eq("type", "deposit").order("created_at", { ascending: false });
    setTxs((data as Transaction[]) || []); setLoading(false);
  }
  useEffect(() => { load(); }, []);
  async function decide(t: Transaction, status: "approved" | "rejected") {
    await supabase.from("transactions").update({ status }).eq("id", t.id);
    if (status === "approved") { await adjustBalance(t.user_id, Number(t.amount)); await supabase.from("notifications").insert({ user_id: t.user_id, title: "Deposit approved", body: `${money(t.amount)} added to your wallet.` }); }
    toast(`Deposit ${status}`, "success"); load();
  }
  if (loading) return <Spinner />;
  if (!txs.length) return <EmptyState icon="⬇️" title="No deposits" desc="Deposit requests appear here." />;
  return (
    <div className="space-y-3">
      {txs.map((t) => (
        <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            {t.proof_url && <a href={t.proof_url} target="_blank" rel="noreferrer"><img src={t.proof_url} className="h-14 w-14 rounded-lg object-cover" alt="" /></a>}
            <div><p className="font-bold text-slate-900 dark:text-white">{money(t.amount)} · {t.method}</p><p className="text-xs text-slate-400">@{t.user?.username} · {fmtDate(t.created_at)}</p></div>
          </div>
          {t.status === "pending" ? <div className="flex gap-2"><Button size="sm" onClick={() => decide(t, "approved")}>Approve</Button><Button size="sm" variant="danger" onClick={() => decide(t, "rejected")}>Reject</Button></div> : <Badge color={t.status === "approved" ? "green" : "rose"}>{t.status}</Badge>}
        </Card>
      ))}
    </div>
  );
}

/* ============ 4. PAYOUT REQUESTS ============ */
function PayoutRequests() {
  const toast = useToast();
  const [reqs, setReqs] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    const { data } = await supabase.from("payout_requests").select("*, user:profiles(*)").order("created_at", { ascending: false });
    setReqs((data as PayoutRequest[]) || []); setLoading(false);
  }
  useEffect(() => { load(); }, []);
  async function decide(r: PayoutRequest, status: "processed" | "rejected") {
    const note = status === "rejected" ? (prompt("Reason:") || "") : "";
    await supabase.from("payout_requests").update({ status, admin_note: note }).eq("id", r.id);
    if (status === "processed") await adjustBalance(r.user_id, -Number(r.amount));
    await supabase.from("notifications").insert({ user_id: r.user_id, title: status === "processed" ? "Payout processed 💸" : "Payout rejected", body: status === "processed" ? `${money(r.amount)} sent via ${r.method}.` : note });
    toast(`Payout ${status}`, "success"); load();
  }
  if (loading) return <Spinner />;
  if (!reqs.length) return <EmptyState icon="💸" title="No payout requests" />;
  return (
    <div className="space-y-3">
      {reqs.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="font-bold text-slate-900 dark:text-white">{money(r.amount)} · {r.method}</p><p className="text-xs text-slate-400">@{r.user?.username} · {fmtDate(r.created_at)}</p><p className="mt-1 text-xs text-slate-500">{r.details}</p></div>
          {r.status === "pending" ? <div className="flex gap-2"><Button size="sm" onClick={() => decide(r, "processed")}>Mark paid</Button><Button size="sm" variant="danger" onClick={() => decide(r, "rejected")}>Reject</Button></div> : <Badge color={r.status === "processed" ? "green" : "rose"}>{r.status}</Badge>}
        </Card>
      ))}
    </div>
  );
}

/* ============ 5. CREATOR EARNINGS ============ */
function Earnings() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const o = await fetchOrders({ status: "approved" });
      setOrders(o);
      const ids = [...new Set(o.map((x) => x.creator_id).filter(Boolean))];
      if (ids.length) { const { data } = await supabase.from("profiles").select("*").in("id", ids); const m: Record<string, Profile> = {}; (data || []).forEach((p) => (m[p.id] = p as Profile)); setProfiles(m); }
      setLoading(false);
    })();
  }, []);
  if (loading) return <Spinner />;
  const by: Record<string, number> = {};
  orders.forEach((o) => { if (o.creator_id) by[o.creator_id] = (by[o.creator_id] || 0) + Number(o.amount); });
  const entries = Object.entries(by);
  if (!entries.length) return <EmptyState icon="💰" title="No earnings yet" />;
  return (
    <div className="space-y-2">
      {entries.map(([cid, gross]) => (
        <Card key={cid} className="flex items-center justify-between p-4">
          <div><p className="font-bold text-slate-900 dark:text-white">@{profiles[cid]?.username || cid.slice(0, 8)}</p><p className="text-xs text-slate-400">{profiles[cid]?.payout_method || "no payout method"}</p></div>
          <div className="text-right"><p className="text-xs text-slate-400">Net (after {COMMISSION * 100}%)</p><p className="text-lg font-black text-emerald-600">{money(gross * (1 - COMMISSION))}</p></div>
        </Card>
      ))}
    </div>
  );
}

/* ============ 6. USERS (ban/suspend/notify) ============ */
function Users() {
  const toast = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  async function load() { const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }); setUsers((data as Profile[]) || []); setLoading(false); }
  useEffect(() => { load(); }, []);
  async function setStatus(u: Profile, status: string) { await supabase.from("profiles").update({ status }).eq("id", u.id); await supabase.from("notifications").insert({ user_id: u.id, title: "Account update", body: `Your account status is now: ${status}.` }); toast(`@${u.username} → ${status}`, "success"); load(); }
  async function setRole(u: Profile, role: string) { await supabase.from("profiles").update({ role }).eq("id", u.id); toast(`@${u.username} → ${role}`, "success"); load(); }
  async function notify(u: Profile) { const body = prompt(`Notify @${u.username}:`); if (!body) return; await supabase.from("notifications").insert({ user_id: u.id, title: "Message from Admin", body }); toast("Sent", "success"); }
  const filtered = users.filter((u) => (u.username || "").includes(q) || (u.email || "").includes(q));
  if (loading) return <Spinner />;
  return (
    <div>
      <Input className="mb-4 max-w-xs" placeholder="🔍 Search users..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-2">
        {filtered.map((u) => (
          <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">{(u.username || "?").charAt(0).toUpperCase()}</span>
              <div><p className="font-semibold text-slate-900 dark:text-white">@{u.username}</p><p className="text-xs text-slate-400">{u.email} · {money(u.balance || 0)}</p></div>
              <Badge color={u.role === "admin" ? "rose" : u.role === "creator" ? "indigo" : "slate"}>{u.role}</Badge>
              {u.status !== "active" && <Badge color="rose">{u.status}</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setRole(u, u.role === "creator" ? "buyer" : "creator")}>{u.role === "creator" ? "Demote" : "Make creator"}</Button>
              {u.status === "active" ? <>
                <Button size="sm" variant="outline" onClick={() => setStatus(u, "suspended")}>Suspend</Button>
                <Button size="sm" variant="danger" onClick={() => setStatus(u, "banned")}>Ban</Button>
              </> : <Button size="sm" onClick={() => setStatus(u, "active")}>Unban/Restore</Button>}
              <Button size="sm" variant="soft" onClick={() => notify(u)}>Notify</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============ 7. STORES ============ */
function Stores() {
  const toast = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() { const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }); setUsers((data as Profile[]) || []); setLoading(false); }
  useEffect(() => { load(); }, []);
  async function setStore(u: Profile, store_status: string) { await supabase.from("profiles").update({ store_status }).eq("id", u.id); toast(`Store ${store_status}`, "success"); load(); }
  async function deleteStore(u: Profile) { if (!confirm(`Reset @${u.username}'s store design?`)) return; await supabase.from("profiles").update({ store_blocks: [], store_theme: {} }).eq("id", u.id); toast("Store reset", "success"); load(); }
  if (loading) return <Spinner />;
  return (
    <div className="space-y-2">
      {users.map((u) => (
        <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div><p className="font-bold text-slate-900 dark:text-white">{u.store_name || `@${u.username}'s Store`}</p><a href={`/@${u.username}`} className="text-xs text-indigo-500">/@{u.username} ↗</a> <Badge color={u.store_status === "suspended" ? "rose" : "green"}>{u.store_status || "active"}</Badge></div>
          <div className="flex gap-2">
            {u.store_status === "suspended" ? <Button size="sm" onClick={() => setStore(u, "active")}>Unsuspend</Button> : <Button size="sm" variant="outline" onClick={() => setStore(u, "suspended")}>Suspend</Button>}
            <Button size="sm" variant="danger" onClick={() => deleteStore(u)}>Delete design</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ============ 8. PRODUCTS ============ */
function Products() {
  const toast = useToast();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  async function load() { const { data } = await supabase.from("products").select("*, creator:profiles(*)").order("created_at", { ascending: false }); setProducts((data as Product[]) || []); setLoading(false); }
  useEffect(() => { load(); }, []);
  async function setStatus(p: Product, status: string) { await supabase.from("products").update({ status }).eq("id", p.id); toast(`Product ${status}`, "success"); load(); }
  async function feature(p: Product) { await supabase.from("products").update({ featured: !p.featured }).eq("id", p.id); load(); }
  async function del(p: Product) { if (!confirm(`Delete "${p.title}"?`)) return; await supabase.from("products").delete().eq("id", p.id); toast("Deleted", "success"); load(); }
  async function seed() { if (!user) return; setSeeding(true); const { error } = await seedDemo(user.id); if (error) toast(error, "error"); else toast("Demo products added 🎉", "success"); setSeeding(false); load(); }
  if (loading) return <Spinner />;
  return (
    <div className="space-y-2">
      <div className="mb-2 flex items-center justify-between"><p className="text-sm text-slate-500">{products.length} products</p><Button size="sm" variant="soft" onClick={seed} disabled={seeding}>{seeding ? "Seeding..." : "🎉 Seed demo"}</Button></div>
      {products.length === 0 && <EmptyState icon="🧩" title="No products" />}
      {products.map((p) => (
        <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">{p.cover_url ? <img src={p.cover_url} className="h-full w-full object-cover" alt="" /> : <div className="flex h-full items-center justify-center">📦</div>}</div>
            <div><p className="line-clamp-1 font-semibold text-slate-900 dark:text-white">{p.title}</p><p className="text-xs text-slate-400">@{p.creator?.username} · {money(p.price)}</p></div>
            <Badge color={p.status === "published" ? "green" : "amber"}>{p.status}</Badge>{p.featured && <Badge color="amber">⭐</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => feature(p)}>{p.featured ? "Unfeature" : "Feature"}</Button>
            {p.status === "published" ? <Button size="sm" variant="outline" onClick={() => setStatus(p, "rejected")}>Unpublish</Button> : <Button size="sm" onClick={() => setStatus(p, "published")}>Publish</Button>}
            <Button size="sm" variant="danger" onClick={() => del(p)}>Delete</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ============ 9. AFFILIATES ============ */
function Affiliates() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { supabase.from("profiles").select("*").then(({ data }) => { setUsers((data as Profile[]) || []); setLoading(false); }); }, []);
  if (loading) return <Spinner />;
  const counts: Record<string, number> = {};
  users.forEach((u) => { if (u.referred_by) counts[u.referred_by] = (counts[u.referred_by] || 0) + 1; });
  const ranked = users.map((u) => ({ u, refs: counts[u.username] || 0 })).filter((x) => x.refs > 0).sort((a, b) => b.refs - a.refs);
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">Affiliate ID = username. Tracks users who signed up via <code>?ref=username</code>.</p>
      {ranked.length === 0 ? <EmptyState icon="🎁" title="No referrals yet" desc="Affiliate signups will be tracked here." /> : (
        <div className="space-y-2">
          {ranked.map(({ u, refs }, i) => (
            <Card key={u.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3"><span className="text-lg font-black text-slate-300">#{i + 1}</span><div><p className="font-bold text-slate-900 dark:text-white">@{u.username}</p><p className="text-xs text-slate-400">{u.email}</p></div></div>
              <Badge color="indigo">{refs} referrals</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ 10. SUPPORT ============ */
function SupportAdmin() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() { const { data } = await supabase.from("tickets").select("*, user:profiles(*)").order("created_at", { ascending: false }); setTickets((data as Ticket[]) || []); setLoading(false); }
  useEffect(() => { load(); }, []);
  async function reply(t: Ticket) {
    const r = prompt(`Reply to "${t.subject}":`); if (!r) return;
    await supabase.from("tickets").update({ reply: r, status: "answered" }).eq("id", t.id);
    await supabase.from("notifications").insert({ user_id: t.user_id, title: "Support replied 💬", body: r });
    toast("Reply sent", "success"); load();
  }
  async function close(t: Ticket) { await supabase.from("tickets").update({ status: "closed" }).eq("id", t.id); load(); }
  if (loading) return <Spinner />;
  if (!tickets.length) return <EmptyState icon="💬" title="No tickets" />;
  return (
    <div className="space-y-3">
      {tickets.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="flex items-center justify-between"><p className="font-bold text-slate-900 dark:text-white">{t.subject}</p><Badge color={t.status === "answered" ? "green" : t.status === "closed" ? "slate" : "amber"}>{t.status}</Badge></div>
          <p className="text-xs text-slate-400">@{t.user?.username} · {fmtDate(t.created_at)}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.message}</p>
          {t.reply && <p className="mt-2 rounded-lg bg-indigo-50 p-2 text-sm text-slate-700 dark:bg-indigo-500/10 dark:text-slate-200"><b>You:</b> {t.reply}</p>}
          <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => reply(t)}>Reply</Button><Button size="sm" variant="outline" onClick={() => close(t)}>Close</Button></div>
        </Card>
      ))}
    </div>
  );
}

/* ============ 11. BROADCAST ============ */
function Broadcast() {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!title || !body) { toast("Fill title & message", "error"); return; }
    setBusy(true);
    const { data } = await supabase.from("profiles").select("id");
    const rows = (data || []).map((u) => ({ user_id: u.id, title, body, broadcast: true }));
    // chunk insert
    for (let i = 0; i < rows.length; i += 200) await supabase.from("notifications").insert(rows.slice(i, i + 200));
    toast(`Sent to ${rows.length} users 📢`, "success");
    setTitle(""); setBody(""); setBusy(false);
  }
  return (
    <Card className="max-w-lg space-y-3 p-5">
      <h3 className="font-bold text-slate-900 dark:text-white">📢 Broadcast to all users</h3>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" />
      <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message to everyone..." />
      <Button onClick={send} disabled={busy}>{busy ? "Sending..." : "Send broadcast"}</Button>
    </Card>
  );
}

/* ============ 12. PAYMENT METHODS ============ */
const PRESET = [["🏦", "Bank Transfer"], ["🅿️", "PayPal"], ["₿", "Crypto (BTC/USDT)"], ["🌍", "Wise"], ["📱", "M-Pesa"], ["📲", "MTN MoMo"], ["🟠", "Orange Money"], ["🟡", "Airtel Money"], ["💚", "Moov Money"], ["🇳🇬", "Opay/Flutterwave"]];
function Payments() {
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: "", label: "", icon: "💳", details: "" });
  async function load() { const { data } = await supabase.from("payment_methods").select("*").order("label"); setMethods((data as PaymentMethod[]) || []); setLoading(false); }
  useEffect(() => { load(); }, []);
  async function save() {
    if (!form.label || !form.details) { toast("Fill label & details", "error"); return; }
    const res = form.id
      ? await supabase.from("payment_methods").update({ label: form.label, icon: form.icon, details: form.details }).eq("id", form.id)
      : await supabase.from("payment_methods").insert({ label: form.label, icon: form.icon, details: form.details, active: true });
    if (res.error) { toast(res.error.message + " — did you run the v3 SQL?", "error"); return; }
    toast(form.id ? "Updated ✅" : "Added ✅", "success");
    setForm({ id: "", label: "", icon: "💳", details: "" });
    load();
  }
  async function toggle(m: PaymentMethod) { const { error } = await supabase.from("payment_methods").update({ active: !m.active }).eq("id", m.id); if (error) toast(error.message, "error"); load(); }
  async function remove(id: string) { if (!confirm("Delete this method?")) return; const { error } = await supabase.from("payment_methods").delete().eq("id", id); if (error) toast(error.message, "error"); load(); }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-3 p-5">
        <h3 className="font-bold text-slate-900 dark:text-white">{form.id ? "Edit payment method" : "Add payment method"}</h3>
        <div className="flex flex-wrap gap-1.5">{PRESET.map(([icon, label]) => <button key={label} onClick={() => setForm({ ...form, label, icon })} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold dark:bg-slate-800">{icon} {label}</button>)}</div>
        <div className="flex gap-2"><Input className="w-20" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Icon" /><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Method label" /></div>
        <Textarea rows={4} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder={"Account: 123\nName: Brixnode\nBank: Example"} />
        <div className="flex gap-2">
          <Button onClick={save}>{form.id ? "Update method" : "Add method"}</Button>
          {form.id && <Button variant="ghost" onClick={() => setForm({ id: "", label: "", icon: "💳", details: "" })}>Cancel edit</Button>}
        </div>
        <p className="text-xs text-slate-400">These appear at checkout for all buyers.</p>
      </Card>
      <div className="space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white">Configured methods ({methods.length})</h3>
        {loading ? <Spinner /> : methods.length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : methods.map((m) => (
          <Card key={m.id} className="p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-xl">{m.icon}</span><span className="font-semibold text-slate-900 dark:text-white">{m.label}</span><Badge color={m.active ? "green" : "slate"}>{m.active ? "active" : "hidden"}</Badge></div><div className="flex gap-2"><Button size="sm" variant="soft" onClick={() => setForm({ id: m.id, label: m.label, icon: m.icon, details: m.details })}>Edit</Button><Button size="sm" variant="outline" onClick={() => toggle(m)}>{m.active ? "Hide" : "Show"}</Button><Button size="sm" variant="danger" onClick={() => remove(m.id)}>Delete</Button></div></div><p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{m.details}</p></Card>
        ))}
      </div>
    </div>
  );
}

/* ============ 13. AI KEYS ============ */
function AiKeys() {
  const toast = useToast();
  const [keys, setKeys] = useState<ApiKeyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ provider: "OpenAI", key_value: "", model: "gpt-4o-mini" });
  async function load() { const { data } = await supabase.from("api_keys").select("*"); setKeys((data as ApiKeyConfig[]) || []); setLoading(false); }
  useEffect(() => { load(); }, []);
  async function add() { if (!form.key_value) { toast("Enter the key", "error"); return; } await supabase.from("api_keys").insert({ ...form, active: true }); toast("Saved 🔐", "success"); setForm({ provider: "OpenAI", key_value: "", model: "gpt-4o-mini" }); load(); }
  async function toggle(k: ApiKeyConfig) { if (!k.active) await supabase.from("api_keys").update({ active: false }).neq("id", k.id); await supabase.from("api_keys").update({ active: !k.active }).eq("id", k.id); load(); }
  async function remove(id: string) { await supabase.from("api_keys").delete().eq("id", id); load(); }
  const providers = ["OpenAI", "Grok (xAI)", "Gemini (Google)", "Groq", "Anthropic"];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-3 p-5">
        <h3 className="font-bold text-slate-900 dark:text-white">Add / rotate AI key</h3>
        <div className="flex flex-wrap gap-1.5">{providers.map((p) => <button key={p} onClick={() => setForm({ ...form, provider: p })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${form.provider === p ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>{p}</button>)}</div>
        <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model (gpt-4o-mini, grok-2, gemini-1.5-flash)" />
        <Input type="password" value={form.key_value} onChange={(e) => setForm({ ...form, key_value: e.target.value })} placeholder="API key" />
        <Button onClick={add}>Save key</Button>
      </Card>
      <div className="space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white">Providers</h3>
        {loading ? <Spinner /> : keys.length === 0 ? <p className="text-sm text-slate-400">No keys (AI in demo mode).</p> : keys.map((k) => (
          <Card key={k.id} className="flex items-center justify-between p-4"><div><p className="font-semibold text-slate-900 dark:text-white">{k.provider}</p><p className="text-xs text-slate-400">{k.model} · ••••{k.key_value.slice(-4)}</p></div><div className="flex items-center gap-2"><Badge color={k.active ? "green" : "slate"}>{k.active ? "active" : "off"}</Badge><Button size="sm" variant="outline" onClick={() => toggle(k)}>{k.active ? "Disable" : "Enable"}</Button><Button size="sm" variant="danger" onClick={() => remove(k.id)}>✕</Button></div></Card>
        ))}
      </div>
    </div>
  );
}

/* ============ 14. ADJUST FUNDS ============ */
function Funds() {
  const toast = useToast();
  const [usernameQ, setUsernameQ] = useState("");
  const [found, setFound] = useState<Profile | null>(null);
  const [amount, setAmount] = useState("");
  async function search() { const { data } = await supabase.from("profiles").select("*").eq("username", usernameQ).maybeSingle(); if (!data) { toast("User not found", "error"); setFound(null); } else setFound(data as Profile); }
  async function adjust(sign: 1 | -1) {
    if (!found || !Number(amount)) return;
    const delta = sign * Number(amount);
    await adjustBalance(found.id, delta);
    await supabase.from("transactions").insert({ user_id: found.id, type: sign > 0 ? "admin_credit" : "admin_debit", amount: Number(amount), status: "approved", method: "admin adjustment" });
    await supabase.from("notifications").insert({ user_id: found.id, title: "Wallet adjusted", body: `${sign > 0 ? "Added" : "Deducted"} ${money(Number(amount))} ${sign > 0 ? "to" : "from"} your wallet.` });
    toast("Balance updated", "success");
    search();
  }
  return (
    <Card className="max-w-lg space-y-3 p-5">
      <h3 className="font-bold text-slate-900 dark:text-white">🪙 Add / deduct user funds</h3>
      <div className="flex gap-2"><Input value={usernameQ} onChange={(e) => setUsernameQ(e.target.value)} placeholder="username" /><Button onClick={search}>Find</Button></div>
      {found && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
          <p className="text-sm">@{found.username} · Balance: <b className="text-emerald-600">{money(found.balance || 0)}</b></p>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
          <div className="flex gap-2"><Button onClick={() => adjust(1)}>+ Add funds</Button><Button variant="danger" onClick={() => adjust(-1)}>− Deduct</Button></div>
        </div>
      )}
    </Card>
  );
}

/* ============ 15. SETTINGS ============ */
function Settings() {
  return (
    <Card className="max-w-xl space-y-3 p-5">
      <h3 className="font-bold text-slate-900 dark:text-white">⚙️ Platform settings</h3>
      <SettingRow label="Platform commission" value={`${COMMISSION * 100}%`} note="Edit COMMISSION in src/lib/data.ts" />
      <SettingRow label="Admin email" value="admin@brixnode.com" note="Edit ADMIN_EMAILS in src/lib/auth.tsx" />
      <SettingRow label="Storage bucket" value="uploads (public)" note="Create in Supabase dashboard" />
      <SettingRow label="Schema" value="supabase_schema.sql" note="Run in Supabase SQL editor" />
      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">⚠️ For production, route admin writes through a server using the service-role key and add admin-only RLS policies.</p>
    </Card>
  );
}
function SettingRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
      <div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p><p className="text-xs text-slate-400">{note}</p></div>
      <span className="font-mono text-sm text-indigo-600 dark:text-indigo-300">{value}</span>
    </div>
  );
}
