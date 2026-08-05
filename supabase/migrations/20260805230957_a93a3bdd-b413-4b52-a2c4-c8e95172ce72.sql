GRANT INSERT ON public.artists TO anon, authenticated;
CREATE POLICY "Public can submit pending talent" ON public.artists FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');