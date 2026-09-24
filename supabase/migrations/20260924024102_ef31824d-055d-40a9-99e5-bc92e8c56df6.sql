ALTER TABLE public.fan_posts ADD COLUMN IF NOT EXISTS media_path text, ADD COLUMN IF NOT EXISTS thumb_path text;

CREATE OR REPLACE FUNCTION public.is_public_fan_media(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.fan_posts
    WHERE status='published' AND moderation_status='approved'
      AND (media_path=_name OR thumb_path=_name))
$$;

DROP POLICY IF EXISTS "Public can view approved fan post media" ON storage.objects;
CREATE POLICY "Public can view approved fan post media" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id='fan-media-coordinator' AND public.is_public_fan_media(name));