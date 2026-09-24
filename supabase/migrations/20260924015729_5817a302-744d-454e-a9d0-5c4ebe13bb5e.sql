DROP POLICY IF EXISTS "ceo_note_media_founder_select" ON storage.objects;
DROP POLICY IF EXISTS "ceo_note_media_founder_insert" ON storage.objects;
DROP POLICY IF EXISTS "ceo_note_media_founder_update" ON storage.objects;
DROP POLICY IF EXISTS "ceo_note_media_founder_delete" ON storage.objects;
CREATE POLICY "ceo_note_media_founder_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ceo-note-media' AND public.has_role(auth.uid(), 'founder') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "ceo_note_media_founder_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ceo-note-media' AND public.has_role(auth.uid(), 'founder') AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif'));
CREATE POLICY "ceo_note_media_founder_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ceo-note-media' AND public.has_role(auth.uid(), 'founder') AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'ceo-note-media' AND public.has_role(auth.uid(), 'founder') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "ceo_note_media_founder_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ceo-note-media' AND public.has_role(auth.uid(), 'founder') AND (storage.foldername(name))[1] = auth.uid()::text);