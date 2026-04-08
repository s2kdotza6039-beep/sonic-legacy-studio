
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  contract_type TEXT NOT NULL DEFAULT 'General',
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view templates"
ON public.contract_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create templates"
ON public.contract_templates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update templates"
ON public.contract_templates FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete templates"
ON public.contract_templates FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
