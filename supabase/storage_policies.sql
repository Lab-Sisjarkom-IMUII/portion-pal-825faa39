-- Storage Bucket Policy untuk user-images (Private)
-- Jalankan ini di Supabase Dashboard > Storage > user-images > Policies

-- Policy: Allow authenticated users to upload their own images
CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Allow users to read their own images
CREATE POLICY "Users can read own images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'user-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Allow users to delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user-images' AND (storage.foldername(name))[1] = auth.uid()::text);
