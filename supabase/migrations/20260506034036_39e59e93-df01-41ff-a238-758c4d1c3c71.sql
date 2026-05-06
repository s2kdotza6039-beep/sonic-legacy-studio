-- ============================================================
-- AI COMMAND CENTRE — Phase 1 Foundation
-- ============================================================

-- 1. AI DRAFTS (approval queue)
CREATE TABLE public.ai_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_type text NOT NULL,                    -- news_post | event | announcement | invoice | artist_update | music_update | social_caption | homepage_update | booking_reply | sponsor_reply | other
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,  -- structured data ready to insert into target table
  status text NOT NULL DEFAULT 'pending',      -- pending | approved | rejected | published
  command text,                                -- e.g. "RUN DAILY CONTENT"
  source text NOT NULL DEFAULT 'ai_assistant', -- ai_assistant | manual | command
  conversation_id uuid,
  target_table text,                           -- which table this publishes to on approval
  target_id uuid,                              -- id in target table after publish
  rejected_reason text,
  approved_by uuid,
  approved_at timestamptz,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. AI ACTIVITY LOG (audit trail)
CREATE TABLE public.ai_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT 'ai_assistant',  -- ai_assistant | founder | system
  actor_user_id uuid,
  action text NOT NULL,                        -- created_draft | approved | rejected | published | edited | deleted | command_run
  entity_type text,
  entity_id uuid,
  command text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. NEWS POSTS
CREATE TABLE public.news_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE,
  excerpt text,
  body text NOT NULL DEFAULT '',
  image_url text,
  category text NOT NULL DEFAULT 'news',
  status text NOT NULL DEFAULT 'draft',        -- draft | approved | published | archived
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. EVENTS
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  venue text,
  city text,
  country text DEFAULT 'South Africa',
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  image_url text,
  ticket_url text,
  artist_name text,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. ANNOUNCEMENTS
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  banner_color text DEFAULT 'gold',
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. INVOICES
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  client_name text NOT NULL,
  client_email text,
  client_address text,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'draft',        -- draft | sent | paid | overdue | cancelled
  issue_date date DEFAULT CURRENT_DATE,
  due_date date,
  file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. BOOKING ENQUIRIES
CREATE TABLE public.booking_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  event_type text,
  event_date date,
  venue text,
  budget numeric,
  message text,
  artist_requested text,
  status text NOT NULL DEFAULT 'new',          -- new | contacted | qualified | booked | declined
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. SPONSOR LEADS
CREATE TABLE public.sponsor_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  contact_name text,
  email text,
  phone text,
  industry text,
  budget_range text,
  message text,
  status text NOT NULL DEFAULT 'new',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIGGERS for updated_at
-- ============================================================
CREATE TRIGGER trg_ai_drafts_updated_at BEFORE UPDATE ON public.ai_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_news_posts_updated_at BEFORE UPDATE ON public.news_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_booking_enquiries_updated_at BEFORE UPDATE ON public.booking_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sponsor_leads_updated_at BEFORE UPDATE ON public.sponsor_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_leads ENABLE ROW LEVEL SECURITY;

-- Founder full control on internal tables
CREATE POLICY "Founders manage ai_drafts" ON public.ai_drafts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'))
  WITH CHECK (has_role(auth.uid(), 'founder'));

CREATE POLICY "Founders read ai_activity_log" ON public.ai_activity_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'founder'));
CREATE POLICY "Founders insert ai_activity_log" ON public.ai_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'founder'));
-- service_role can also write log
CREATE POLICY "Service role writes ai_activity_log" ON public.ai_activity_log
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Founders manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'))
  WITH CHECK (has_role(auth.uid(), 'founder'));

CREATE POLICY "Founders manage booking_enquiries" ON public.booking_enquiries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'))
  WITH CHECK (has_role(auth.uid(), 'founder'));
-- Public can submit booking enquiries
CREATE POLICY "Public can create booking_enquiries" ON public.booking_enquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Founders manage sponsor_leads" ON public.sponsor_leads
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'))
  WITH CHECK (has_role(auth.uid(), 'founder'));
CREATE POLICY "Public can create sponsor_leads" ON public.sponsor_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- News, Events, Announcements: founder manages everything; public sees only published
CREATE POLICY "Founders manage news_posts" ON public.news_posts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'))
  WITH CHECK (has_role(auth.uid(), 'founder'));
CREATE POLICY "Public reads published news" ON public.news_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Founders manage events" ON public.events
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'))
  WITH CHECK (has_role(auth.uid(), 'founder'));
CREATE POLICY "Public reads published events" ON public.events
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Founders manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'))
  WITH CHECK (has_role(auth.uid(), 'founder'));
CREATE POLICY "Public reads published announcements" ON public.announcements
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

-- ============================================================
-- approve_ai_draft RPC: copies draft payload into target table
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_ai_draft(_draft_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.ai_drafts%ROWTYPE;
  new_id uuid;
  p jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'founder') THEN
    RAISE EXCEPTION 'Only founders can approve drafts';
  END IF;

  SELECT * INTO d FROM public.ai_drafts WHERE id = _draft_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF d.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'Draft already %', d.status;
  END IF;

  p := d.payload;

  IF d.draft_type = 'news_post' THEN
    INSERT INTO public.news_posts (title, slug, excerpt, body, image_url, category, status, published_at)
    VALUES (
      COALESCE(p->>'title', d.title),
      p->>'slug',
      p->>'excerpt',
      COALESCE(p->>'body',''),
      p->>'image_url',
      COALESCE(p->>'category','news'),
      'published',
      now()
    ) RETURNING id INTO new_id;

  ELSIF d.draft_type = 'event' THEN
    INSERT INTO public.events (title, description, venue, city, country, start_date, end_date, image_url, ticket_url, artist_name, status, published_at)
    VALUES (
      COALESCE(p->>'title', d.title),
      p->>'description',
      p->>'venue',
      p->>'city',
      COALESCE(p->>'country','South Africa'),
      COALESCE((p->>'start_date')::timestamptz, now() + interval '7 days'),
      NULLIF(p->>'end_date','')::timestamptz,
      p->>'image_url',
      p->>'ticket_url',
      p->>'artist_name',
      'published',
      now()
    ) RETURNING id INTO new_id;

  ELSIF d.draft_type = 'announcement' THEN
    INSERT INTO public.announcements (title, body, banner_color, status, starts_at, ends_at, published_at)
    VALUES (
      COALESCE(p->>'title', d.title),
      COALESCE(p->>'body',''),
      COALESCE(p->>'banner_color','gold'),
      'published',
      NULLIF(p->>'starts_at','')::timestamptz,
      NULLIF(p->>'ends_at','')::timestamptz,
      now()
    ) RETURNING id INTO new_id;

  ELSIF d.draft_type = 'invoice' THEN
    INSERT INTO public.invoices (invoice_number, client_name, client_email, client_address, line_items, subtotal, tax, total, currency, status, due_date, notes)
    VALUES (
      COALESCE(p->>'invoice_number', 'INV-' || to_char(now(),'YYYYMMDD-HH24MISS')),
      COALESCE(p->>'client_name', d.title),
      p->>'client_email',
      p->>'client_address',
      COALESCE(p->'line_items','[]'::jsonb),
      COALESCE((p->>'subtotal')::numeric,0),
      COALESCE((p->>'tax')::numeric,0),
      COALESCE((p->>'total')::numeric,0),
      COALESCE(p->>'currency','ZAR'),
      'draft',
      NULLIF(p->>'due_date','')::date,
      p->>'notes'
    ) RETURNING id INTO new_id;

  ELSE
    -- generic / non-publishing drafts (social_caption, homepage_update, etc.) just mark approved
    new_id := NULL;
  END IF;

  UPDATE public.ai_drafts
     SET status = 'published',
         approved_by = auth.uid(),
         approved_at = now(),
         published_at = now(),
         target_id = new_id
   WHERE id = _draft_id;

  INSERT INTO public.ai_activity_log (actor, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES ('founder', auth.uid(), 'approved_and_published', d.draft_type, new_id, jsonb_build_object('draft_id', _draft_id));

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_ai_draft(_draft_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'founder') THEN
    RAISE EXCEPTION 'Only founders can reject drafts';
  END IF;
  UPDATE public.ai_drafts
     SET status = 'rejected', rejected_reason = _reason, approved_by = auth.uid(), approved_at = now()
   WHERE id = _draft_id;
  INSERT INTO public.ai_activity_log (actor, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES ('founder', auth.uid(), 'rejected', 'ai_draft', _draft_id, jsonb_build_object('reason', _reason));
END;
$$;

-- Auto-log when ai_drafts row is created
CREATE OR REPLACE FUNCTION public.log_ai_draft_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_activity_log (actor, actor_user_id, action, entity_type, entity_id, command, metadata)
  VALUES (NEW.source, NEW.created_by, 'created_draft', NEW.draft_type, NEW.id, NEW.command,
          jsonb_build_object('title', NEW.title, 'status', NEW.status));
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_log_ai_draft_created
  AFTER INSERT ON public.ai_drafts
  FOR EACH ROW EXECUTE FUNCTION public.log_ai_draft_created();