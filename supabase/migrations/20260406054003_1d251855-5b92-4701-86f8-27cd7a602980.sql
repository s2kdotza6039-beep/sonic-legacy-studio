
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  contract_type TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'draft',
  party_name TEXT,
  file_url TEXT,
  file_name TEXT,
  value NUMERIC DEFAULT 0,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage contracts" ON public.contracts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role))
  WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES ('contract-files', 'contract-files', false);

CREATE POLICY "Founders can upload contract files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-files' AND public.has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Founders can view contract files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contract-files' AND public.has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Founders can delete contract files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contract-files' AND public.has_role(auth.uid(), 'founder'::app_role));
