import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronRight, RefreshCw, Filter } from "lucide-react";

type LogRow = {
  id: string;
  created_at: string;
  m_payment_id: string | null;
  payment_id: string | null;
  signature_ok: boolean;
  amount_ok: boolean;
  was_idempotent_skip: boolean;
  pf_payment_status: string | null;
  expected_amount_cents: number | null;
  received_amount: string | null;
  verify_reason: string | null;
  outcome: string;
  source_ip: string | null;
  raw_payload: Record<string, unknown> | null;
  raw_body_hash: string | null;
};

const OUTCOMES = ["all", "paid", "failed", "invalid", "ignored", "unknown_payment"];

const badgeClass = (o: string) =>
  o === "paid" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" :
  o === "failed" || o === "invalid" ? "bg-destructive/15 text-destructive border-destructive/30" :
  "bg-muted text-muted-foreground border-border";

export default function PayFastAuditLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    let q = supabase.from("payfast_notify_log").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("outcome", filter);
    const { data } = await q;
    setRows((data ?? []) as LogRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-2xl font-bold">PayFast Notify Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Every inbound ITN call — signature, amount match, idempotency, and outcome.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-secondary border border-border rounded-md px-2 py-1 text-xs">
            {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <Button onClick={load} variant="ghost" size="sm" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <Card className="divide-y divide-border">
        {loading ? (
          <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No notify calls yet.</div>
        ) : rows.map((r) => {
          const isOpen = open[r.id];
          return (
            <div key={r.id}>
              <button
                onClick={() => setOpen((s) => ({ ...s, [r.id]: !isOpen }))}
                className="w-full text-left p-4 flex items-center gap-3 hover:bg-secondary/30 transition-colors"
              >
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <Badge variant="outline" className={badgeClass(r.outcome)}>{r.outcome}</Badge>
                <span className="text-xs text-muted-foreground tabular-nums">{new Date(r.created_at).toLocaleString()}</span>
                <span className="text-xs font-mono truncate flex-1">{r.m_payment_id ?? "—"}</span>
                <span className="text-xs flex gap-1">
                  <span className={r.signature_ok ? "text-emerald-500" : "text-destructive"}>sig</span>
                  <span className={r.amount_ok ? "text-emerald-500" : "text-destructive"}>amt</span>
                  {r.was_idempotent_skip && <span className="text-muted-foreground">idem</span>}
                </span>
              </button>
              {isOpen && (
                <div className="p-4 bg-secondary/20 text-xs space-y-2">
                  <Grid>
                    <Cell k="payment_id" v={r.payment_id ?? "—"} />
                    <Cell k="pf_payment_status" v={r.pf_payment_status ?? "—"} />
                    <Cell k="expected_amount_cents" v={String(r.expected_amount_cents ?? "—")} />
                    <Cell k="received_amount" v={r.received_amount ?? "—"} />
                    <Cell k="source_ip" v={r.source_ip ?? "—"} />
                    <Cell k="verify_reason" v={r.verify_reason ?? "—"} />
                    <Cell k="raw_body_hash" v={r.raw_body_hash ?? "—"} />
                  </Grid>
                  {r.raw_payload && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">raw_payload</summary>
                      <pre className="mt-2 p-3 bg-background border border-border rounded-md overflow-x-auto text-[11px] font-mono">
                        {JSON.stringify(r.raw_payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">{children}</div>;
}
function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-40 shrink-0">{k}</span>
      <span className="font-mono break-all">{v}</span>
    </div>
  );
}
