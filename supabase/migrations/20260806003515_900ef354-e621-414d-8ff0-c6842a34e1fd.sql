CREATE TABLE public.sydney_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  source text NOT NULL DEFAULT 'founder',
  important boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sydney_memory TO authenticated;
GRANT ALL ON public.sydney_memory TO service_role;

ALTER TABLE public.sydney_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage sydney memory"
ON public.sydney_memory FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'founder'))
WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE TRIGGER trg_sydney_memory_updated_at
BEFORE UPDATE ON public.sydney_memory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();