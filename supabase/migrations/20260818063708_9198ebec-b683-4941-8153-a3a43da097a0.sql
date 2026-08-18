CREATE TABLE public.fan_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  media_url text,
  media_type text NOT NULL DEFAULT 'image',
  artist_tag text,
  status text NOT NULL DEFAULT 'published',
  scheduled_at timestamptz,
  likes integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fan_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fan_posts TO authenticated;
GRANT ALL ON public.fan_posts TO service_role;

ALTER TABLE public.fan_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published fan posts"
ON public.fan_posts FOR SELECT
USING (status = 'published');

CREATE POLICY "Founders manage fan posts"
ON public.fan_posts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'founder'))
WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE TRIGGER update_fan_posts_updated_at
BEFORE UPDATE ON public.fan_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fan_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_name text NOT NULL,
  fan_email text,
  subject text,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  is_public boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new',
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.fan_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fan_messages TO authenticated;
GRANT ALL ON public.fan_messages TO service_role;

ALTER TABLE public.fan_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can send a fan message"
ON public.fan_messages FOR INSERT
WITH CHECK (
  status = 'new'
  AND is_public = false
  AND admin_reply IS NULL
  AND length(message) BETWEEN 1 AND 4000
  AND length(fan_name) BETWEEN 1 AND 120
);

CREATE POLICY "Anyone can view published public fan messages"
ON public.fan_messages FOR SELECT
USING (is_public = true AND status = 'published');

CREATE POLICY "Founders manage fan messages"
ON public.fan_messages FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'founder'))
WITH CHECK (public.has_role(auth.uid(), 'founder'));