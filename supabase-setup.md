

-- 4. Create Storage Bucket for Large Files
INSERT INTO storage.buckets (id, name, public) VALUES ('drop_files', 'drop_files', true) ON CONFLICT (id) DO NOTHING;

-- Allow public access to bucket
CREATE POLICY 'Allow public insert to drop_files' ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'drop_files');
CREATE POLICY 'Allow public select from drop_files' ON storage.objects FOR SELECT USING (bucket_id = 'drop_files');
CREATE POLICY 'Allow public delete from drop_files' ON storage.objects FOR DELETE USING (bucket_id = 'drop_files');
