import { useEffect, useState } from "react";
import { useRouter, Link } from "../lib/router";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { supabase } from "../lib/supabase";
import { money, fmtDate, uploadFile } from "../lib/data";
import type { Transaction } from "../lib/types";
import { Button, Input, Card, Spinner, Badge, EmptyState } from "../components/ui";

export default function Transactions() {
  const { user, profile } = useAuth();
  const { navigate } = useRouter();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showDeposit, setShowDeposit] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    load();
  }, [user]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setTxs((data as Transaction[]) || []);
    setLoading(false);
  }

  const filtered = txs.filter((t) => filter === "all" || t.type === filter);
  const icons: Record<string, string> = { deposit: "⬇️", payout: "⬆️", sale: "💰", admin_credit: "➕", admin_debit: "➖" };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="mx-auto max-w-3xl animate-fade">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transactions 🧾</h1>
          <p className="text-sm text-slate-500">Wallet balance & full history</p>
        </div>
        <div className="flex gap-2">
          <Link to="/payouts"><Button variant="outline">Payouts</Button></Link>
          <Button onClick={() => setShowDeposit(true)}>+ Deposit</Button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white">
        <p className="text-xs opacity-80">Wallet balance</p>
        <p className="text-3xl font-black">{money(profile?.balance || 0)}</p>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {["all", "deposit", "payout", "sale", "admin_credit", "admin_debit"].map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${filter === t ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{t.replace("_", " ")}</button>
        ))}
      </div>

      {filtered.length === 0 ? <div className="mt-6"><EmptyState icon="🧾" title="No transactions" desc="Deposits, sales and payouts will appear here." /></div> : (
        <div className="mt-4 space-y-2">
          {filtered.map((t) => (
            <Card key={t.id} className="flex items-center gap-3 p-4">
              <span className="text-2xl">{icons[t.type] || "•"}</span>
              <div className="flex-1">
                <p className="font-semibold capitalize text-slate-900 dark:text-white">{t.type.replace("_", " ")}</p>
                <p className="text-xs text-slate-400">{t.method || "—"} · {fmtDate(t.created_at)}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${["payout", "admin_debit"].includes(t.type) ? "text-rose-500" : "text-emerald-600"}`}>{["payout", "admin_debit"].includes(t.type) ? "-" : "+"}{money(t.amount)}</p>
                <Badge color={t.status === "approved" || t.status === "processed" ? "green" : t.status === "rejected" ? "rose" : "amber"}>{t.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} onDone={() => { setShowDeposit(false); load(); }} />}
    </div>
  );
}

function DepositModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!user) return;
    if (!Number(amount) || !method) { toast("Fill amount & method", "error"); return; }
    setSubmitting(true);
    let proofUrl = "";
    if (proof) { const up = await uploadFile(proof, "deposits"); proofUrl = up.url || ""; }
    const { error } = await supabase.from("transactions").insert({ user_id: user.id, type: "deposit", amount: Number(amount), status: "pending", method, proof_url: proofUrl });
    if (error) { toast(error.message, "error"); setSubmitting(false); return; }
    toast("Deposit submitted — pending admin approval", "success");
    setSubmitting(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between"><h3 className="text-lg font-bold text-slate-900 dark:text-white">Deposit funds</h3><button onClick={onClose} className="text-slate-400">✕</button></div>
        <div className="mt-4 space-y-3">
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (USD)" />
          <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Payment method used" />
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
            {proof ? `✓ ${proof.name}` : "📤 Upload payment proof"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setProof(e.target.files?.[0] || null)} />
          </label>
          <Button className="w-full" onClick={submit} disabled={submitting}>{submitting ? "Submitting..." : "Submit deposit"}</Button>
        </div>
      </Card>
    </div>
  );
}
