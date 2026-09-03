CREATE OR REPLACE FUNCTION public.approve_ai_draft(_draft_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d public.ai_drafts%ROWTYPE;
  new_id uuid;
  p jsonb;
  det jsonb;
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

  ELSIF d.draft_type = 'contract' THEN
    det := COALESCE(p->'details', '{}'::jsonb);
    INSERT INTO public.contracts (title, description, contract_type, status, party_name, value, start_date, notes, created_by)
    VALUES (
      d.title,
      COALESCE(p->>'content', ''),
      COALESCE(p->>'contract_type','Booking'),
      'active',
      NULLIF(det->>'party',''),
      NULLIF(regexp_replace(COALESCE(det->>'amount',''), '[^0-9.]', '', 'g'),'')::numeric,
      NULLIF(det->>'event_date','')::date,
      NULLIF(det->>'notes',''),
      COALESCE(d.source, 'coordinator')
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
$function$;