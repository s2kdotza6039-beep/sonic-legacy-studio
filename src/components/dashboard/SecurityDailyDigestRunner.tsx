import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Loader2, Send, Mail } from "lucide-react";

type Preview = { subject: string; html: string; templateData: Record<string, unknown> };

export default function SecurityDailyDigestRunner() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const loadPreview = async () => {
    setPreviewing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("security-daily-report", { body: { preview: true } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "preview failed");
      setPreview({ subject: data.subject, html: data.html, templateData: data.templateData });
    } catch (e) {
      setResult("Preview failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPreviewing(false);
    }
  };

  const sendNow = async () => {
    if (!confirm("Send the daily security digest to all founders now?")) return;
    setSending(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("security-daily-report", { body: { manual: true } });
      if (error) throw error;
      const sent = (data?.sent ?? []) as Array<{ to: string; ok: boolean }>;
      const okCount = sent.filter((s) => s.ok).length;
      setResult(`Sent: ${okCount}/${sent.length} recipients.`);
    } catch (e) {
      setResult("Send failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Daily security digest</CardTitle>
          <CardDescription>
            Preview the digest content and trigger an immediate send. Manual runs are audited as
            <code className="mx-1">daily_report_manual_run</code> in the Security Audit Log.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadPreview} disabled={previewing || sending}>
            {previewing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Eye className="w-4 h-4 mr-1" />} Preview
          </Button>
          <Button size="sm" onClick={sendNow} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />} Send now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {result && <div className="text-xs text-muted-foreground">{result}</div>}
        {preview && (
          <div className="border border-border rounded-md overflow-hidden">
            <div className="bg-secondary/40 px-3 py-2 text-xs font-mono border-b border-border truncate" title={preview.subject}>
              Subject: {preview.subject}
            </div>
            <iframe
              title="digest-preview"
              srcDoc={preview.html}
              className="w-full bg-white"
              style={{ height: 480, border: 0 }}
              sandbox=""
            />
          </div>
        )}
        {!preview && !previewing && (
          <div className="text-xs text-muted-foreground">Click <strong>Preview</strong> to render the digest with the latest 24h metrics.</div>
        )}
      </CardContent>
    </Card>
  );
}
