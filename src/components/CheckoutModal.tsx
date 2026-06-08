import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { supabase } from "../lib/supabase";
import { fetchPaymentMethods, money, uploadFile, genToken, typeKind } from "../lib/data";
import type { Product, PaymentMethod } from "../lib/types";
import { Button, Spinner, Input } from "./ui";

export default function CheckoutModal({
  product,
  onClose,
  onDone,
}: {
  product: Product;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [step, setStep] = useState(0); // 0 contact, 1 method, 2 instructions, 3 proof
  const [email, setEmail] = useState(profile?.email || "");
  const [whatsapp, setWhatsapp] = useState(profile?.phone || "");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [reference, setReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingMethods, setLoadingMethods] = useState(true);

  const isStock = typeKind(product.type) === "stock";
  const available = (product.stock_items || []).filter((s) => !s.sold).length;
  const outOfStock = isStock && available <= 0;

  useEffect(() => {
    fetchPaymentMethods().then((m) => {
      setMethods(m);
      setLoadingMethods(false);
    });
  }, []);

  function pickFile(file: File | null) {
    if (!file) return;
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  }

  async function submit() {
    if (!proofFile) { toast("Upload your payment proof screenshot", "error"); return; }
    if (!email && !whatsapp) { toast("Provide an email or WhatsApp", "error"); return; }
    setSubmitting(true);
    let proofUrl = "";
    const up = await uploadFile(proofFile, "proofs");
    proofUrl = up.url || "";
    if (up.error) toast("Proof upload failed — order still sent", "info");

    const token = genToken();
    const { error } = await supabase.from("orders").insert({
      buyer_id: user?.id || null,
      product_id: product.id,
      creator_id: product.creator_id,
      amount: product.price,
      status: "pending",
      proof_url: proofUrl,
      payment_reference: reference,
      payment_method: selectedMethod,
      payout_status: "unpaid",
      contact_email: email,
      contact_whatsapp: whatsapp,
      access_token: token,
    });
    if (error) { toast(error.message, "error"); setSubmitting(false); return; }

    if (user) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Order submitted ⏳",
        body: `Your order for "${product.title}" is pending admin approval.`,
      });
    }
    toast("Order submitted! Pending admin approval ✅", "success");
    setSubmitting(false);
    onDone();
  }

  const selected = methods.find((m) => m.label === selectedMethod);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Checkout</h3>
            <p className="text-sm text-slate-500">{product.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
        </div>

        <div className="flex items-center gap-2 px-5 pt-4">
          {[0, 1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"}`} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {outOfStock ? (
            <div className="py-10 text-center">
              <p className="text-4xl">😕</p>
              <p className="mt-3 font-bold text-slate-800 dark:text-slate-100">Out of stock</p>
              <p className="text-sm text-slate-500">All slots have been sold. Check back later.</p>
            </div>
          ) : step === 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">How should we deliver your product?</h4>
              <p className="text-xs text-slate-500">After approval, your access link is sent here.</p>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div className="text-center text-xs text-slate-400">— and / or —</div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">WhatsApp number</label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+1 555 000 0000" />
              </div>
              {isStock && <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">📦 {available} slots available</p>}
              <Button className="w-full" disabled={!email && !whatsapp} onClick={() => setStep(1)}>Continue</Button>
            </div>
          ) : step === 1 ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-indigo-50 p-4 dark:bg-indigo-500/10">
                <p className="text-sm text-slate-600 dark:text-slate-300">Amount to pay</p>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-300">{money(product.price)}</p>
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Choose a payment method</h4>
              {loadingMethods ? <div className="flex justify-center py-6"><Spinner /></div> : methods.length === 0 ? (
                <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">⚠️ Admin hasn't configured payment methods yet.</p>
              ) : (
                <div className="space-y-2">
                  {methods.map((m) => (
                    <button key={m.id} onClick={() => setSelectedMethod(m.label)} className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition ${selectedMethod === m.label ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700"}`}>
                      <span className="text-2xl">{m.icon}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{m.label}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                <Button className="flex-1" disabled={!selectedMethod} onClick={() => setStep(2)}>Continue</Button>
              </div>
            </div>
          ) : step === 2 && selected ? (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{selected.icon} Pay via {selected.label}</h4>
              <div className="whitespace-pre-wrap rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-4 text-sm text-slate-700 dark:border-indigo-500/40 dark:bg-indigo-500/5 dark:text-slate-200">{selected.details || "Payment details will be shown here."}</div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">Send exactly <b>{money(product.price)}</b>, screenshot the confirmation, upload it next.</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>I've paid — Upload proof</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Upload payment proof</h4>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-800">
                {proofPreview ? <img src={proofPreview} alt="proof" className="max-h-44 rounded-lg" /> : (
                  <>
                    <span className="text-3xl">📤</span>
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tap to upload screenshot</span>
                    <span className="text-xs text-slate-400">PNG, JPG up to 10MB</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
              </label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction reference / ID (optional)" />
              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Delivery to: {email || whatsapp}. After admin approval you receive your private access link.</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button className="flex-1" onClick={submit} disabled={submitting}>{submitting ? "Submitting..." : "Submit order"}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
