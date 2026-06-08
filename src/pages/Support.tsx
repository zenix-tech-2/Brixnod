import { useEffect, useState } from "react";
import { useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { supabase } from "../lib/supabase";
import { fmtDate } from "../lib/data";
import type { Ticket } from "../lib/types";
import { Button, Input, Textarea, Card, Spinner, Badge, EmptyState } from "../components/ui";

export default function Support() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    load();
  }, [user]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setTickets((data as Ticket[]) || []);
    setLoading(false);
  }

  async function send() {
    if (!user) return;
    if (!subject || !message) { toast("Fill subject & message", "error"); return; }
    setBusy(true);
    const { error } = await supabase.from("tickets").insert({ user_id: user.id, subject, message, status: "open" });
    if (error) { toast(error.message, "error"); setBusy(false); return; }
    toast("Ticket sent! We'll reply soon.", "success");
    setSubject(""); setMessage(""); setBusy(false);
    load();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="mx-auto max-w-2xl animate-fade">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Support 💬</h1>
      <p className="text-sm text-slate-500">Get help from the Brixnode team</p>

      <Card className="mt-5 space-y-3 p-5">
        <h3 className="font-bold text-slate-900 dark:text-white">New ticket</h3>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue..." />
        <Button onClick={send} disabled={busy}>{busy ? "Sending..." : "Send ticket"}</Button>
      </Card>

      <h3 className="mb-3 mt-8 font-bold text-slate-900 dark:text-white">Your tickets</h3>
      {tickets.length === 0 ? <EmptyState icon="💬" title="No tickets" desc="Your support conversations appear here." /> : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-900 dark:text-white">{t.subject}</p>
                <Badge color={t.status === "answered" ? "green" : t.status === "closed" ? "slate" : "amber"}>{t.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">{fmtDate(t.created_at)}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.message}</p>
              {t.reply && <div className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-slate-700 dark:bg-indigo-500/10 dark:text-slate-200"><b className="text-indigo-600 dark:text-indigo-300">Admin reply:</b><p className="mt-1">{t.reply}</p></div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
