
-- 1. Coordinator role helper
CREATE OR REPLACE FUNCTION public.has_role_coordinator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'coordinator'::public.app_role
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_role_coordinator(uuid) FROM anon;

-- 2. ACTION LOG
CREATE TABLE IF NOT EXISTS public.action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  summary text,
  "before" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "after" jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.action_log TO authenticated;
GRANT ALL ON public.action_log TO service_role;
ALTER TABLE public.action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read all action log"
  ON public.action_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'::public.app_role));
CREATE POLICY "Users read own action log"
  ON public.action_log FOR SELECT TO authenticated
  USING (actor_id = auth.uid());
CREATE POLICY "Founders insert action log"
  ON public.action_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'founder'::public.app_role));
CREATE POLICY "Coordinators insert own action log"
  ON public.action_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role_coordinator(auth.uid()) AND actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS action_log_actor_created_idx ON public.action_log (actor_id, created_at DESC);

-- 3. Coordinator RLS on her areas
CREATE POLICY "Coordinators manage events"
  ON public.events FOR ALL TO authenticated
  USING (public.has_role_coordinator(auth.uid()))
  WITH CHECK (public.has_role_coordinator(auth.uid()));

CREATE POLICY "Coordinators manage content posts"
  ON public.content_posts FOR ALL TO authenticated
  USING (public.has_role_coordinator(auth.uid()))
  WITH CHECK (public.has_role_coordinator(auth.uid()));

CREATE POLICY "Coordinators manage fan posts"
  ON public.fan_posts FOR ALL TO authenticated
  USING (public.has_role_coordinator(auth.uid()))
  WITH CHECK (public.has_role_coordinator(auth.uid()));

CREATE POLICY "Coordinators manage sponsor leads"
  ON public.sponsor_leads FOR ALL TO authenticated
  USING (public.has_role_coordinator(auth.uid()))
  WITH CHECK (public.has_role_coordinator(auth.uid()));

CREATE POLICY "Coordinators manage touring log"
  ON public.touring_log FOR ALL TO authenticated
  USING (public.has_role_coordinator(auth.uid()))
  WITH CHECK (public.has_role_coordinator(auth.uid()));

CREATE POLICY "Coordinators read roster"
  ON public.artists FOR SELECT TO authenticated
  USING (public.has_role_coordinator(auth.uid()));

-- Coordinators submit contract drafts through the approval queue only
CREATE POLICY "Coordinators create pending drafts"
  ON public.ai_drafts FOR INSERT TO authenticated
  WITH CHECK (public.has_role_coordinator(auth.uid()) AND status = 'pending');
CREATE POLICY "Coordinators read own drafts"
  ON public.ai_drafts FOR SELECT TO authenticated
  USING (public.has_role_coordinator(auth.uid()) AND created_by = auth.uid());

-- 4. Scoped contract templates
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS coordinator_visible boolean NOT NULL DEFAULT false;

UPDATE public.contract_templates
SET coordinator_visible = true
WHERE contract_type ILIKE '%booking%'
   OR contract_type ILIKE '%performance%'
   OR contract_type ILIKE '%venue%'
   OR contract_type ILIKE '%event%'
   OR contract_type ILIKE '%sponsor%'
   OR title ILIKE '%booking%'
   OR title ILIKE '%performance%'
   OR title ILIKE '%venue%'
   OR title ILIKE '%event%'
   OR title ILIKE '%sponsor%';

CREATE POLICY "Coordinators read shared templates"
  ON public.contract_templates FOR SELECT TO authenticated
  USING (coordinator_visible = true AND public.has_role_coordinator(auth.uid()));

-- 5. Public agent analytics
CREATE TABLE IF NOT EXISTS public.agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  event_type text NOT NULL,
  label text,
  path text,
  session_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.agent_events TO anon, authenticated;
GRANT SELECT ON public.agent_events TO authenticated;
GRANT ALL ON public.agent_events TO service_role;
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record agent events"
  ON public.agent_events FOR INSERT TO anon, authenticated
  WITH CHECK (agent IN ('palesa','mpumi'));
CREATE POLICY "Founders read agent analytics"
  ON public.agent_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'::public.app_role));

CREATE INDEX IF NOT EXISTS agent_events_agent_created_idx ON public.agent_events (agent, created_at DESC);
