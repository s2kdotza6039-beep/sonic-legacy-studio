import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Hash, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

type DryrunRow = {
  id: string;
  created_at: string;
  metadata: { results?: Array<{ rule?: string; evaluation_hash?: string; rule_id?: string }> } | null;
};

type VerifyResult = {
  ok: boolean;
  rule_name?: string;
  stored_hash?: string;
  current_hash?: string;
  hash_match?: boolean;
  differing_fields?: string[];
  compare?: Record<string, { prev: unknown; curr: unknown } | Record<string, { prev: unknown; curr: unknown }>>;
  evaluated_at?: string;
  error?: string;
};

const fmt = (v: unknown) => v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

export default function SecurityHashVerifier() {
  const [rows, setRows] = useState<DryrunRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const loadRows = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("security_audit_log")
      .select("id, created_at, metadata")
      .eq("action", "alert_rule_dryrun")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data as DryrunRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadRows(); }, []);

  const verify = async () => {
    if (!selected) return;
    setVerifying(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("security-verify-hash", { body: { audit_id: selected } });
      if (error) throw error;
      setResult(data as VerifyResult);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Hash className="w-5 h-5" /> Hash verification</CardTitle>
          <CardDescription>
            Pick a recorded dry-run and re-run its rule against current data. We compare the stored
            <code className="mx-1">evaluation_hash</code> with a freshly computed hash and highlight any drifted fields.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={loadRows} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <select
            className="flex-1 min-w-[260px] px-2 py-1.5 text-xs bg-background border border-border rounded font-mono"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a recent dry-run…</option>
            {rows.map((r) => {
              const dr = r.metadata?.results?.[0];
              return (
                <option key={r.id} value={r.id}>
                  {new Date(r.created_at).toLocaleString()} — {dr?.rule ?? "(rule)"} — hash {dr?.evaluation_hash?.slice(0, 10) ?? "—"}
                </option>
              );
            })}
          </select>
          <Button size="sm" onClick={verify} disabled={!selected || verifying}>
            {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Hash className="w-4 h-4 mr-1" />} Verify
          </Button>
        </div>

        {result && !result.ok && (
          <div className="text-xs text-rose-600">Error: {result.error}</div>
        )}
        {result && result.ok && (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 text-sm font-medium ${result.hash_match ? "text-emerald-600" : "text-amber-600"}`}>
              {result.hash_match ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {result.hash_match ? "Hash matches — inputs unchanged." : "Hash differs — inputs have drifted."}
              <span className="text-xs text-muted-foreground ml-2">({result.rule_name})</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded border border-border bg-secondary/20">
                <div className="text-[10px] uppercase text-muted-foreground">Stored hash</div>
                <div className="truncate" title={result.stored_hash}>{result.stored_hash ?? "—"}</div>
              </div>
              <div className="p-2 rounded border border-border bg-secondary/20">
                <div className="text-[10px] uppercase text-muted-foreground">Current hash</div>
                <div className="truncate" title={result.current_hash}>{result.current_hash ?? "—"}</div>
              </div>
            </div>
            {!result.hash_match && (
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
                    <tr><th className="text-left p-2">Field</th><th className="text-left p-2">Stored</th><th className="text-left p-2">Current</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.compare ?? {}).map(([k, v]) => {
                      if (k === "detail_diff") {
                        return Object.entries(v as Record<string, { prev: unknown; curr: unknown }>).map(([dk, dv]) => (
                          <tr key={`d-${dk}`} className="border-t border-border bg-amber-500/5">
                            <td className="p-2">detail.{dk}</td>
                            <td className="p-2 font-mono">{fmt(dv.prev)}</td>
                            <td className="p-2 font-mono">{fmt(dv.curr)}</td>
                          </tr>
                        ));
                      }
                      const cv = v as { prev: unknown; curr: unknown };
                      const drift = JSON.stringify(cv.prev) !== JSON.stringify(cv.curr);
                      return (
                        <tr key={k} className={`border-t border-border ${drift ? "bg-amber-500/10" : ""}`}>
                          <td className="p-2">{k}</td>
                          <td className="p-2 font-mono">{fmt(cv.prev)}</td>
                          <td className="p-2 font-mono">{fmt(cv.curr)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">Evaluated at {result.evaluated_at}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
