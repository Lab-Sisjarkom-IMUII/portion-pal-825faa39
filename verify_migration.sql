-- Script untuk verifikasi migrasi error_logs
-- Jalankan di Supabase Dashboard > SQL Editor

-- 1. Cek apakah tabel error_logs ada
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('error_logs', 'performance_logs')
ORDER BY table_name;

-- 2. Cek struktur tabel error_logs
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'error_logs'
ORDER BY ordinal_position;

-- 3. Cek indexes pada error_logs
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'error_logs'
ORDER BY indexname;

-- 4. Cek RLS policies pada error_logs
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'error_logs'
ORDER BY policyname;

-- 5. Cek apakah RLS enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('error_logs', 'performance_logs');

-- 6. Test insert (harus berhasil jika migrasi benar)
-- Note: Ini akan insert test data, bisa dihapus setelahnya
INSERT INTO public.error_logs (
  message,
  error,
  severity,
  source,
  context,
  timestamp
) VALUES (
  'Test migration verification',
  'TestError',
  'low',
  'migration_test',
  '{"test": true}'::jsonb,
  now()
) RETURNING id, message, timestamp;

-- 7. Cek data yang baru di-insert
SELECT 
  id,
  message,
  severity,
  source,
  timestamp
FROM public.error_logs
WHERE source = 'migration_test'
ORDER BY timestamp DESC
LIMIT 5;

-- 8. Cleanup test data (optional)
-- DELETE FROM public.error_logs WHERE source = 'migration_test';

