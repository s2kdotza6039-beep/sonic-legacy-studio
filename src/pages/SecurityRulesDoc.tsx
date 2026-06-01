import Layout from "@/components/Layout";
import { ShieldCheck, AlertTriangle, Database, KeyRound, Lock } from "lucide-react";

const Section = ({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="flex items-center gap-2 text-2xl font-display font-bold mb-3">
      <Icon className="w-5 h-5 text-primary" /> {title}
    </h2>
    <div className="prose prose-invert max-w-none text-sm leading-relaxed">{children}</div>
  </section>
);

const Code = ({ children }: { children: React.ReactNode }) => (
  <pre className="bg-secondary/40 border border-border rounded-md p-3 text-xs overflow-x-auto"><code>{children}</code></pre>
);

export default function SecurityRulesDoc() {
  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="text-primary" size={20} />
            <p className="text-sm uppercase tracking-widest text-primary">Developer Reference</p>
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-bold">RLS & SECURITY DEFINER Rules</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            The contract every migration must respect. Breaking any rule below will either
            lock the founder out of the dashboard or expose private data to the public anon key.
          </p>
        </div>
      </div>

      <div className="section-padding max-w-4xl mx-auto">
        <Section icon={Lock} title="1. Founder is the only privileged role">
          <p>
            All admin-only tables (artists, deals, contracts, payments, invoices, royalty_*,
            betting_*, ai_*, ceo_*, command_*, idea_*, email_drafts, send-logs)
            are gated by a single policy:
          </p>
          <Code>{`CREATE POLICY "Founders manage X"
ON public.X
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'founder'))
WITH CHECK (has_role(auth.uid(), 'founder'));`}</Code>
          <p>
            Roles live in <code>public.user_roles</code>. Never store roles on{" "}
            <code>profiles</code> or any other table — it enables privilege escalation.
          </p>
        </Section>

        <Section icon={Database} title="2. Public-readable tables">
          <ul className="list-disc pl-5 space-y-1">
            <li><code>releases</code>, <code>tracks</code> (minus <code>r2_object_key</code>), <code>announcements</code>, <code>events</code>, <code>news_posts</code> — public reads, founder-only writes.</li>
            <li><code>booking_enquiries</code>, <code>sponsor_leads</code> — public INSERT with strict <code>WITH CHECK</code> length/email constraints; only founders may read.</li>
            <li><code>playback_events</code>, <code>release_clicks</code> — public INSERT, but the check clause enforces <code>event_kind</code> enum, length limits, and <code>(user_id IS NULL OR user_id = auth.uid())</code>.</li>
          </ul>
          <p className="mt-3 font-semibold text-amber-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Never use <code>WITH CHECK (true)</code> on a writable policy. CI will block the PR.
          </p>
        </Section>

        <Section icon={KeyRound} title="3. tracks.r2_object_key is a secret">
          <p>
            The R2 object key gives any holder direct access to the audio file, bypassing
            the Cloudflare Worker token gate and tier percentage cap. It must never reach
            anon or authenticated.
          </p>
          <Code>{`-- Enforced in production:
REVOKE SELECT ON public.tracks FROM anon, authenticated;
GRANT  SELECT (id, slug, title, artist_name, artist_slug, cover_url,
               duration_seconds, price_standard_cents, price_gold_cents,
               price_download_cents, pct_free, pct_standard, pct_gold,
               is_active, sort_order, created_at, updated_at)
ON public.tracks TO anon, authenticated;`}</Code>
          <p>
            Frontend code must <code>.select(...)</code> explicit columns — never{" "}
            <code>.select("*")</code> on tracks. The <code>stream-track</code> edge function
            reads <code>r2_object_key</code> using the service role.
          </p>
        </Section>

        <Section icon={ShieldCheck} title="4. SECURITY DEFINER functions">
          <p>
            Definer functions run as the database owner and bypass RLS, so EXECUTE access
            is tightly controlled.
          </p>
          <table className="w-full text-xs border border-border rounded-md overflow-hidden">
            <thead className="bg-secondary/40">
              <tr>
                <th className="text-left p-2">Function</th>
                <th className="text-left p-2">EXECUTE granted to</th>
                <th className="text-left p-2">Why</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><td className="p-2"><code>has_role</code></td><td className="p-2">anon + authenticated</td><td className="p-2">Called by every RLS policy.</td></tr>
              <tr className="border-t border-border"><td className="p-2"><code>approve_ai_draft</code> / <code>reject_ai_draft</code></td><td className="p-2">authenticated</td><td className="p-2">Founder RPCs. Role check via <code>RAISE EXCEPTION</code> inside the body.</td></tr>
              <tr className="border-t border-border"><td className="p-2">All other helpers (<code>handle_new_user</code>, <code>update_updated_at_column</code>, <code>log_ai_draft_*</code>, <code>enforce_ai_draft_permissions</code>, <code>block_non_founder_writes</code>, email queue helpers)</td><td className="p-2">service_role only</td><td className="p-2">Trigger or background-job internals. Never call from the client.</td></tr>
            </tbody>
          </table>
          <p className="mt-3">
            New definer functions MUST: set <code>SET search_path = public</code>, perform an
            explicit role check, and explicitly REVOKE EXECUTE FROM PUBLIC.
          </p>
        </Section>

        <Section icon={Lock} title="5. AI assistant write rules">
          <ul className="list-disc pl-5 space-y-1">
            <li>AI may only INSERT into <code>ai_drafts</code> with <code>source = 'ai_assistant'</code> and <code>status = 'pending'</code>.</li>
            <li>AI may NOT pre-approve, publish, or write <code>target_id</code> — enforced by <code>enforce_ai_draft_permissions</code> trigger.</li>
            <li>Publication only happens through <code>approve_ai_draft(uuid)</code>, which inserts into <code>news_posts</code>, <code>events</code>, <code>announcements</code>, or <code>invoices</code> on behalf of a founder.</li>
            <li>Every transition is appended to <code>ai_activity_log</code>; surfaced in <strong>Dashboard → Security Events</strong>.</li>
          </ul>
        </Section>

        <Section icon={Database} title="6. Storage buckets">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>submissions</strong> — private bucket. Public INSERT is restricted to{" "}
              <code>name LIKE 'careers/%'</code> with <code>.mp3 / .wav / .m4a / .pdf</code> only. Read/update/delete restricted to founders.</li>
            <li><strong>contract-files</strong> — private bucket. All operations (SELECT/INSERT/UPDATE/DELETE) require <code>has_role(auth.uid(), 'founder')</code>.</li>
          </ul>
        </Section>

        <Section icon={ShieldCheck} title="7. CI guards">
          <p>The <code>.github/workflows/security.yml</code> job runs on every PR and:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Runs <code>src/test/rlsAccess.test.ts</code> against the live anon endpoint.</li>
            <li>Fails the PR if any new migration contains <code>WITH CHECK (true)</code> on a writable policy.</li>
            <li>Fails the PR if a migration re-grants <code>r2_object_key</code> to anon/authenticated.</li>
            <li>Runs <code>npm audit</code> at high severity and blocks on findings.</li>
          </ul>
        </Section>

        <Section icon={ShieldCheck} title="8. Security monitoring tables & alert validation">
          <p>
            The security monitoring stack lives in five founder-only tables:
            <code>security_audit_log</code>, <code>security_alert_rules</code>,
            <code>security_alert_dispatch_log</code>, <code>security_alert_dlq</code>,
            and <code>security_retention_config</code>. Every policy is{" "}
            <code>has_role(auth.uid(), 'founder')</code>; anon has zero access and{" "}
            <code>rlsAccess.test.ts</code> asserts both reads and inserts are blocked.
          </p>
          <p className="mt-3">
            A <code>BEFORE INSERT OR UPDATE</code> trigger{" "}
            <code>validate_security_alert_rule()</code> enforces:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Email destinations must match the email regex (≤255 chars).</li>
            <li>Webhook destinations must start with <code>https://</code>.</li>
            <li>Numeric bounds: threshold ≥ 1, window ≥ 1m, cooldown ≥ 0.</li>
            <li>For <code>event_source = 'delivery_meta'</code>, <code>event_kind</code> must be one of{" "}
              <code>delivery_spike</code>, <code>retry_rate_high</code>, <code>dlq_rate_high</code>;
              rate-based kinds require threshold to be a percentage 1–100.</li>
          </ul>
          <p className="mt-3">
            <code>delivery_meta</code> rules let founders alert on the alerting pipeline itself —
            a spike in attempts, climbing retry rate, or DLQ rate breach. Evaluated by{" "}
            <code>process-security-alerts</code>, which excludes the meta-rule's own dispatches
            to prevent feedback loops.
          </p>
        </Section>

        <Section icon={KeyRound} title="9. log-security-export entity whitelist">
          <p>
            The <code>log-security-export</code> edge function is the only place CSV exports of
            security data are recorded. It is founder-only (JWT + <code>has_role</code> check)
            and writes one row to <code>security_audit_log</code> per export with:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code>actor_user_id</code> from the verified JWT (never client-supplied).</li>
            <li><code>ip</code> from <code>x-forwarded-for</code> / <code>cf-connecting-ip</code> (capped 64 chars).</li>
            <li><code>user_agent</code> from the request header (capped 512 chars).</li>
            <li><code>entity</code> restricted to the whitelist: <code>security_events</code> and{" "}
              <code>security_audit_log</code>. Any other value falls back to <code>security_events</code>.</li>
          </ul>
          <p className="mt-3">
            E2E coverage in <code>supabase/functions/log-security-export/index_test.ts</code>
            asserts anon callers are rejected with 401/403 AND that no audit row is written.
            Both the Security Events panel and the Audit Log viewer route CSV exports through
            this function before downloading.
          </p>
        </Section>

        <Section icon={AlertTriangle} title="10. Accepted scanner false positives">
          <p>
            The Supabase linter cannot read column-level GRANTs or function bodies, so it
            keeps flagging:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code>tracks.r2_object_key</code> "publicly readable" — actually revoked at the column level (verified by <code>rlsAccess.test.ts</code>).</li>
            <li><code>has_role</code>, <code>approve_ai_draft</code>, <code>reject_ai_draft</code> "callable by signed-in users" — intentional; role-gated internally.</li>
          </ul>
          <p>
            These are recorded in <code>mem://security/memory</code> and should remain ignored.
          </p>
        </Section>
      </div>
    </Layout>
  );
}
