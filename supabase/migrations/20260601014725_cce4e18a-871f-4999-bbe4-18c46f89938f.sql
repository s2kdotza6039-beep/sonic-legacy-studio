DROP POLICY IF EXISTS "Public can upload submissions" ON storage.objects;
CREATE POLICY "Public can upload submissions"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'submissions'
  AND name LIKE 'careers/%'
  AND (
    lower(name) LIKE '%.mp3'
    OR lower(name) LIKE '%.wav'
    OR lower(name) LIKE '%.m4a'
    OR lower(name) LIKE '%.pdf'
  )
);
