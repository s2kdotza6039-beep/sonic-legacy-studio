
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', true);

CREATE POLICY "Anyone can upload submissions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'submissions');

CREATE POLICY "Anyone can read submissions"
ON storage.objects FOR SELECT
USING (bucket_id = 'submissions');
