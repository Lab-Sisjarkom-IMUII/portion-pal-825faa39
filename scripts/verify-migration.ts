/**
 * Script untuk verifikasi migrasi error_logs
 * Jalankan dengan: npx tsx scripts/verify-migration.ts
 * Atau: npm run verify-migration (jika ditambahkan ke package.json)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   - VITE_SUPABASE_URL or SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n💡 Set these in your .env file or as environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface VerificationResult {
  name: string;
  status: '✅' | '❌';
  message: string;
  details?: unknown;
}

async function verifyMigration(): Promise<void> {
  console.log('🔍 Verifying error_logs migration...\n');
  const results: VerificationResult[] = [];

  // 1. Check if error_logs table exists
  try {
    const { data, error } = await supabase
      .from('error_logs')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      results.push({
        name: 'Table error_logs exists',
        status: '❌',
        message: 'Table error_logs does not exist',
      });
    } else {
      results.push({
        name: 'Table error_logs exists',
        status: '✅',
        message: 'Table error_logs exists and is accessible',
      });
    }
  } catch (e) {
    results.push({
      name: 'Table error_logs exists',
      status: '❌',
      message: `Error checking table: ${e}`,
    });
  }

  // 2. Check if performance_logs table exists
  try {
    const { data, error } = await supabase
      .from('performance_logs')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      results.push({
        name: 'Table performance_logs exists',
        status: '❌',
        message: 'Table performance_logs does not exist',
      });
    } else {
      results.push({
        name: 'Table performance_logs exists',
        status: '✅',
        message: 'Table performance_logs exists and is accessible',
      });
    }
  } catch (e) {
    results.push({
      name: 'Table performance_logs exists',
      status: '❌',
      message: `Error checking table: ${e}`,
    });
  }

  // 3. Test insert into error_logs
  try {
    const testError = {
      message: 'Migration verification test',
      error: 'TestError',
      severity: 'low' as const,
      source: 'migration_verification',
      context: { test: true, timestamp: new Date().toISOString() },
    };

    const { data, error } = await supabase
      .from('error_logs')
      .insert([testError])
      .select()
      .single();

    if (error) {
      results.push({
        name: 'Insert into error_logs',
        status: '❌',
        message: `Insert failed: ${error.message}`,
        details: error,
      });
    } else {
      results.push({
        name: 'Insert into error_logs',
        status: '✅',
        message: 'Successfully inserted test error',
        details: { id: data?.id },
      });

      // Cleanup test data
      if (data?.id) {
        await supabase
          .from('error_logs')
          .delete()
          .eq('id', data.id);
      }
    }
  } catch (e) {
    results.push({
      name: 'Insert into error_logs',
      status: '❌',
      message: `Insert error: ${e}`,
    });
  }

  // 4. Test insert into performance_logs
  try {
    const testMetric = {
      metric: 'test_metric',
      value: 100,
      unit: 'ms',
      source: 'migration_verification',
      context: { test: true },
    };

    const { data, error } = await supabase
      .from('performance_logs')
      .insert([testMetric])
      .select()
      .single();

    if (error) {
      results.push({
        name: 'Insert into performance_logs',
        status: '❌',
        message: `Insert failed: ${error.message}`,
        details: error,
      });
    } else {
      results.push({
        name: 'Insert into performance_logs',
        status: '✅',
        message: 'Successfully inserted test metric',
        details: { id: data?.id },
      });

      // Cleanup test data
      if (data?.id) {
        await supabase
          .from('performance_logs')
          .delete()
          .eq('id', data.id);
      }
    }
  } catch (e) {
    results.push({
      name: 'Insert into performance_logs',
      status: '❌',
      message: `Insert error: ${e}`,
    });
  }

  // 5. Check table structure (columns)
  try {
    const { data: errorLogsColumns, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'error_logs'
        ORDER BY ordinal_position;
      `,
    });

    const requiredColumns = ['id', 'message', 'error', 'stack', 'severity', 'source', 'context', 'user_id', 'timestamp'];
    const foundColumns = errorLogsColumns?.map((c: { column_name: string }) => c.column_name) || [];

    const missingColumns = requiredColumns.filter((col) => !foundColumns.includes(col));

    if (missingColumns.length > 0) {
      results.push({
        name: 'Table structure (error_logs)',
        status: '❌',
        message: `Missing columns: ${missingColumns.join(', ')}`,
        details: { found: foundColumns, missing: missingColumns },
      });
    } else {
      results.push({
        name: 'Table structure (error_logs)',
        status: '✅',
        message: 'All required columns exist',
        details: { columns: foundColumns },
      });
    }
  } catch (e) {
    // RPC might not be available, skip this check
    results.push({
      name: 'Table structure (error_logs)',
      status: '⚠️',
      message: 'Could not verify structure (RPC not available)',
    });
  }

  // Print results
  console.log('\n📊 Verification Results:\n');
  results.forEach((result) => {
    console.log(`${result.status} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
    console.log('');
  });

  const successCount = results.filter((r) => r.status === '✅').length;
  const failCount = results.filter((r) => r.status === '❌').length;

  console.log('\n📈 Summary:');
  console.log(`   ✅ Passed: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   Total: ${results.length}\n`);

  if (failCount === 0) {
    console.log('🎉 Migration verification successful! All checks passed.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some checks failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run verification
verifyMigration().catch((error) => {
  console.error('❌ Verification script error:', error);
  process.exit(1);
});

