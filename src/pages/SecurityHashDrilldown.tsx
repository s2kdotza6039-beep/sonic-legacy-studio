import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Hash, Loader2, ArrowLeft, CheckCircle2, AlertTriangle, RefreshCw, Download, Columns, Rows } from "lucide-react";

type VerifyResult = {
  ok: boolean;
  rule_name?: string;
  rule_id?: string;
  stored_hash?: string;
  current_hash?: string;
  hash_match?: boolean;
  differing_fields?: string[];
  compare?: Record<string, { prev: unknown; curr: unknown } | Record<string, { prev: unknown; curr: unknown }>>;
  evaluated_at?: string;
  error?: string;
};

type AuditRow = {
  id: string;
  created_at: string;
  metadata: { results?: Array<{ rule?: string; evaluation_hash?: string; rule_id?: string }>; request_id?: string; actor_email?: string | null } | null;
};


const fmt = (v: unknown) => v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
const isDrifted = (prev: unknown, curr: unknown) => JSON.stringify(prev) !== JSON.stringify(curr);

const diffReason = (prev: unknown, curr: unknown): string => {
  if (JSON.stringify(prev) === JSON.stringify(curr)) return "";
  if (prev == null && curr != null) return "added";
  if (prev != null && curr == null) return "removed";
  if (typeof prev !== typeof curr) return `type changed (${typeof prev} → ${typeof curr})`;
  if (typeof prev === "number" && typeof curr === "number") {
    const delta = curr - prev;
    return `numeric delta ${delta >= 0 ? "+" : ""}${delta}`;
  }
  if (typeof prev === "object") return "structural diff";
  return "value changed";
};

const csvCell = (v: unknown) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

type ViewMode = "table" | "side_by_side";

export default function SecurityHashDrilldown() {
  const { auditId } = useParams<{ auditId: string }>();
  const [audit, setAudit] = useState<AuditRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const loadAndVerify = async () => {
    if (!auditId) return;
    setLoading(true);
    setResult(null);
    const { data } = await supabase
      .from("security_audit_log")
      .select("id, created_at, metadata")
      .eq("id", auditId)
      .maybeSingle();
    setAudit(data as AuditRow | null);

    setLoading(false);
    if (data) await runVerify();
  };

  const runVerify = async () => {
    if (!auditId) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("security-verify-hash", { body: { audit_id: auditId } });
      if (error) throw error;
      setResult(data as VerifyResult);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => { loadAndVerify(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [auditId]);

  const storedSnippet = audit?.metadata?.results?.[0];
  const compareEntries: Array<{ field: string; prev: unknown; curr: unknown; nested?: boolean }> = [];
  if (result?.compare) {
    for (const [k, v] of Object.entries(result.compare)) {
      if (k === "detail_diff") {
        for (const [dk, dv] of Object.entries(v as Record<string, { prev: unknown; curr: unknown }>)) {
          compareEntries.push({ field: `detail.${dk}`, prev: dv.prev, curr: dv.curr, nested: true });
        }
      } else {
        const cv = v as { prev: unknown; curr: unknown };
        compareEntries.push({ field: k, prev: cv.prev, curr: cv.curr });
      }
    }
  }
  const differingSet = new Set(result?.differing_fields ?? []);

  // Group/summary
  const sourceOf = (field: string): string => {
    if (field.startsWith("detail.")) return "detail";
    if (field === "stored_hash" || field === "current_hash" || field.includes("hash")) return "hash";
    return "top-level";
  };
  const entriesWithDrift = compareEntries.map((e) => ({
    ...e,
    drift: differingSet.has(e.field) || isDrifted(e.prev, e.curr),
    source: sourceOf(e.field),
    reason: diffReason(e.prev, e.curr),
  }));
  const totalFields = entriesWithDrift.length;
  const matchedFields = entriesWithDrift.filter((e) => !e.drift).length;
  const driftedFields = totalFields - matchedFields;
  const bySource = entriesWithDrift.reduce<Record<string, { match: number; diff: number }>>((acc, e) => {
    acc[e.source] ??= { match: 0, diff: 0 };
    if (e.drift) acc[e.source].diff++; else acc[e.source].match++;
    return acc;
  }, {});

  const exportDriftCsv = () => {
    const drifted = entriesWithDrift.filter((e) => e.drift);
    const headers = ["field", "source", "old_value", "new_value", "diff_reason"];
    const lines = [headers.join(",")];
    drifted.forEach((e) => {
      lines.push([e.field, e.source, fmt(e.prev), fmt(e.curr), e.reason].map(csvCell).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url; a.download = `hash-drift-${auditId?.slice(0, 8) ?? "audit"}-${stamp}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("table")}
                className={`px-2 py-1 text-xs inline-flex items-center gap-1 ${viewMode === "table" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-secondary/60 text-muted-foreground"}`}
                title="Table view"
              >
                <Rows className="w-3.5 h-3.5" /> Table
              </button>
              <button
                onClick={() => setViewMode("side_by_side")}
                className={`px-2 py-1 text-xs inline-flex items-center gap-1 border-l border-border ${viewMode === "side_by_side" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-secondary/60 text-muted-foreground"}`}
                title="Side-by-side view"
              >
                <Columns className="w-3.5 h-3.5" /> Side-by-side
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={exportDriftCsv} disabled={driftedFields === 0} title="Export drifted fields to CSV">
              <Download className="w-4 h-4 mr-1" /> Drift CSV
            </Button>
            <Button variant="outline" size="sm" onClick={runVerify} disabled={verifying || !audit}>
              {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />} Re-verify
            </Button>
          </div>
        </div>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Hash className="w-5 h-5" /> Hash verification drill-down</CardTitle>
            <CardDescription>
              Compares the stored <code className="mx-1">evaluation_hash</code> for this dry-run with a freshly computed
              hash against current inputs, and highlights every drifted field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading audit entry…
              </div>
            )}

            {!loading && !audit && (
              <div className="text-rose-600 text-xs">Audit entry not found or not accessible.</div>
            )}

            {audit && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded border border-border bg-secondary/20">
                  <div className="text-[10px] uppercase text-muted-foreground">Audit ID</div>
                  <div className="font-mono break-all">{audit.id}</div>
                </div>
                <div className="p-3 rounded border border-border bg-secondary/20">
                  <div className="text-[10px] uppercase text-muted-foreground">Captured at</div>
                  <div>{new Date(audit.created_at).toLocaleString()}</div>
                </div>
                <div className="p-3 rounded border border-border bg-secondary/20">
                  <div className="text-[10px] uppercase text-muted-foreground">Actor</div>
                  <div className="truncate" title={audit.metadata?.actor_email ?? ""}>{audit.metadata?.actor_email ?? "—"}</div>
                </div>
                <div className="p-3 rounded border border-border bg-secondary/20">
                  <div className="text-[10px] uppercase text-muted-foreground">Rule</div>
                  <div className="font-mono truncate">{result?.rule_name ?? storedSnippet?.rule ?? "—"}</div>
                </div>
              </div>
            )}

            {result && !result.ok && (
              <div className="text-xs text-rose-600">Error: {result.error}</div>
            )}

            {result && result.ok && (
              <>
                <div className={`flex items-center gap-2 text-base font-medium ${result.hash_match ? "text-emerald-600" : "text-amber-600"}`}>
                  {result.hash_match ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  {result.hash_match ? "Hash matches — inputs unchanged." : "Hash differs — inputs have drifted."}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded border border-border bg-secondary/20">
                    <div className="text-[10px] uppercase text-muted-foreground font-sans">Stored hash</div>
                    <div className="break-all">{result.stored_hash ?? "—"}</div>
                  </div>
                  <div className={`p-3 rounded border bg-secondary/20 ${result.hash_match ? "border-emerald-500/30" : "border-amber-500/40"}`}>
                    <div className="text-[10px] uppercase text-muted-foreground font-sans">Current hash</div>
                    <div className="break-all">{result.current_hash ?? "—"}</div>
                  </div>
                </div>

                {!result.hash_match && (result.differing_fields?.length ?? 0) > 0 && (
                  <div className="text-xs px-3 py-2 rounded border border-amber-500/30 bg-amber-500/5">
                    <span className="font-medium">Differing fields ({result.differing_fields!.length}):</span>{" "}
                    <span className="font-mono">{result.differing_fields!.join(", ")}</span>
                  </div>
                )}

                {/* Summary panel */}
                {totalFields > 0 && (
                  <div className="border border-border rounded-md p-3 bg-secondary/10 space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="font-medium">Field summary</div>
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {matchedFields} match
                      </span>
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="w-3.5 h-3.5" /> {driftedFields} differ
                      </span>
                      <span className="text-muted-foreground">of {totalFields} computed fields</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {Object.entries(bySource).map(([src, c]) => (
                        <div key={src} className="px-2 py-1 rounded border border-border bg-background">
                          <span className="font-mono mr-1">{src}</span>
                          <span className="text-emerald-600">{c.match} ✓</span>
                          <span className="mx-1 text-muted-foreground">/</span>
                          <span className={c.diff > 0 ? "text-amber-600" : "text-muted-foreground"}>{c.diff} ✗</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {compareEntries.length > 0 && viewMode === "table" && (
                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
                        <tr>
                          <th className="text-left p-2 w-1/4">Field</th>
                          <th className="text-left p-2">Stored (dry-run)</th>
                          <th className="text-left p-2">Current</th>
                          <th className="text-left p-2 w-20">Status</th>
                          <th className="text-left p-2 w-32">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entriesWithDrift.map(({ field, prev, curr, nested, drift, reason }) => (
                          <tr key={field} className={`border-t border-border ${drift ? "bg-amber-500/10" : ""}`}>
                            <td className={`p-2 ${nested ? "pl-4 text-muted-foreground" : "font-medium"}`}>{field}</td>
                            <td className="p-2 font-mono break-all">{fmt(prev)}</td>
                            <td className={`p-2 font-mono break-all ${drift ? "text-amber-700 dark:text-amber-400 font-semibold" : ""}`}>{fmt(curr)}</td>
                            <td className="p-2">
                              {drift ? (
                                <span className="inline-flex items-center gap-1 text-amber-600 text-[10px] font-medium">
                                  <AlertTriangle className="w-3 h-3" /> drifted
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-medium">
                                  <CheckCircle2 className="w-3 h-3" /> same
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-[10px] text-muted-foreground">{reason || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {compareEntries.length > 0 && viewMode === "side_by_side" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-border rounded-md overflow-hidden">
                      <div className="bg-secondary/40 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                        Dry-run (stored)
                      </div>
                      <div className="divide-y divide-border">
                        {entriesWithDrift.map(({ field, prev, drift, nested }) => (
                          <div key={`l-${field}`} className={`px-3 py-1.5 text-xs ${drift ? "bg-amber-500/10" : ""}`}>
                            <div className={`text-[10px] uppercase ${nested ? "text-muted-foreground" : "font-medium"}`}>{field}</div>
                            <div className="font-mono break-all">{fmt(prev)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border border-border rounded-md overflow-hidden">
                      <div className="bg-secondary/40 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                        Current (latest inputs)
                      </div>
                      <div className="divide-y divide-border">
                        {entriesWithDrift.map(({ field, curr, drift, nested, reason }) => (
                          <div key={`r-${field}`} className={`px-3 py-1.5 text-xs ${drift ? "bg-amber-500/10 border-l-2 border-amber-500" : ""}`}>
                            <div className={`text-[10px] uppercase flex items-center justify-between gap-2 ${nested ? "text-muted-foreground" : "font-medium"}`}>
                              <span>{field}</span>
                              {drift && <span className="text-amber-600 normal-case text-[10px]">{reason}</span>}
                            </div>
                            <div className={`font-mono break-all ${drift ? "text-amber-700 dark:text-amber-400 font-semibold" : ""}`}>{fmt(curr)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}


                <div className="text-[10px] text-muted-foreground">Evaluated at {result.evaluated_at}</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
