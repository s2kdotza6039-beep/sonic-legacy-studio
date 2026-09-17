CREATE TABLE public.assistant_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_kind text NOT NULL,
  tier integer NOT NULL DEFAULT 2,
  summary text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_entity text,
  target_id text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  risk text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_by_email text,
  conversation_id uuid,
  executed_at timestamptz,
  result jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_pending_actions TO authenticated;
GRANT ALL ON public.assistant_pending_actions TO service_role;
ALTER TABLE public.assistant_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage pending assistant actions"
ON public.assistant_pending_actions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'founder'))
WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE INDEX idx_pending_actions_status ON public.assistant_pending_actions (status, created_at DESC);

CREATE TRIGGER update_assistant_pending_actions_updated_at
BEFORE UPDATE ON public.assistant_pending_actions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sydney_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_role text NOT NULL DEFAULT 'sydney',
  founder_user_id uuid,
  founder_email text,
  action text NOT NULL,
  tier integer,
  entity_type text NOT NULL,
  entity_id text,
  location text,
  summary text,
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text,
  conversation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sydney_action_log TO authenticated;
GRANT ALL ON public.sydney_action_log TO service_role;
ALTER TABLE public.sydney_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read sydney action log"
ON public.sydney_action_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'founder'));

CREATE INDEX idx_sydney_action_log_created ON public.sydney_action_log (created_at DESC);

ALTER TABLE public.ceo_contacts REPLICA IDENTITY FULL;
ALTER TABLE public.ceo_notes REPLICA IDENTITY FULL;
ALTER TABLE public.ceo_todos REPLICA IDENTITY FULL;
ALTER TABLE public.sydney_memory REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ceo_contacts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ceo_notes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ceo_todos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sydney_memory; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.assistant_pending_actions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sydney_action_log; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;