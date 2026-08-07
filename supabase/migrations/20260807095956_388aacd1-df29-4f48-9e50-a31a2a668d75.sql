CREATE TABLE IF NOT EXISTS public.upcoming_release (
  id integer PRIMARY KEY DEFAULT 1,
  title text NOT NULL DEFAULT 'Next Release',
  subtitle text,
  release_date timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  countdown_active boolean NOT NULL DEFAULT false,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.upcoming_release TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upcoming_release TO authenticated;
GRANT ALL ON public.upcoming_release TO service_role;

ALTER TABLE public.upcoming_release ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view upcoming release"
ON public.upcoming_release FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Founders can manage upcoming release"
ON public.upcoming_release FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'founder'))
WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE TRIGGER trg_upcoming_release_updated_at
BEFORE UPDATE ON public.upcoming_release
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.upcoming_release (id, title, subtitle, release_date, countdown_active)
VALUES (1, 'Next Release', 'Something new from the s2kDOTza camp.', now() + interval '14 days', false)
ON CONFLICT (id) DO NOTHING;