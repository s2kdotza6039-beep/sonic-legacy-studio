CREATE POLICY "Coordinators manage fan messages"
ON public.fan_messages FOR ALL TO authenticated
USING (public.has_role_coordinator(auth.uid()))
WITH CHECK (public.has_role_coordinator(auth.uid()));

CREATE POLICY "Coordinators manage fan media"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'fan-media' AND public.has_role_coordinator(auth.uid()))
WITH CHECK (bucket_id = 'fan-media' AND public.has_role_coordinator(auth.uid()));