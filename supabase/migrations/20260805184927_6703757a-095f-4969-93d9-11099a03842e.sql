CREATE TABLE public.knowledge_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  is_constitutional boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_vault TO authenticated;
GRANT ALL ON public.knowledge_vault TO service_role;

ALTER TABLE public.knowledge_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view knowledge vault"
ON public.knowledge_vault FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Founders can insert knowledge vault"
ON public.knowledge_vault FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Founders can update knowledge vault"
ON public.knowledge_vault FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'founder'))
WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Founders can delete knowledge vault"
ON public.knowledge_vault FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'founder'));

CREATE TRIGGER trg_knowledge_vault_updated_at
BEFORE UPDATE ON public.knowledge_vault
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_knowledge_vault_category ON public.knowledge_vault (category, priority);