CREATE POLICY "Coordinators manage coordinator fan media"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'fan-media-coordinator' AND public.has_role_coordinator(auth.uid()))
  WITH CHECK (bucket_id = 'fan-media-coordinator' AND public.has_role_coordinator(auth.uid()));

CREATE POLICY "Founders manage coordinator fan media"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'fan-media-coordinator' AND public.has_role(auth.uid(), 'founder'::app_role))
  WITH CHECK (bucket_id = 'fan-media-coordinator' AND public.has_role(auth.uid(), 'founder'::app_role));