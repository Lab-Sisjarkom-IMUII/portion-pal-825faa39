/**
 * Quick verification script untuk cek migrasi error_logs
 * Jalankan dengan: node scripts/quick-verify.js
 * 
 * Pastikan set environment variables:
 * - VITE_SUPABASE_URL atau SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('   Required: VITE_SUPABASE_URL (or SUPABASE_URL)');
  console.error('   Required: SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)');
  console.error('\n💡 Create .env file or set environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function quickVerify() {
  console.log('🔍 Quick Migration Verification\n');
  console.log(`📍 Supabase URL: ${SUPABASE_URL.replace(/\/$/, '')}\n`);

  const checks = [];

  // Check 1: error_logs table
  try {
    const { data, error } = await supabase
      .from('error_logs')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        checks.push({ name: 'error_logs table', status: '❌', message: 'Table does not exist' });
      } else {
        checks.push({ name: 'error_logs table', status: '⚠️', message: `Error: ${error.message}` });
      }
    } else {
      checks.push({ name: 'error_logs table', status: '✅', message: 'Table exists and accessible' });
    }
  } catch (e) {
    checks.push({ name: 'error_logs table', status: '❌', message: `Exception: ${e.message}` });
  }

  // Check 2: performance_logs table
  try {
    const { data, error } = await supabase
      .from('performance_logs')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        checks.push({ name: 'performance_logs table', status: '❌', message: 'Table does not exist' });
      } else {
        checks.push({ name: 'performance_logs table', status: '⚠️', message: `Error: ${error.message}` });
      }
    } else {
      checks.push({ name: 'performance_logs table', status: '✅', message: 'Table exists and accessible' });
    }
  } catch (e) {
    checks.push({ name: 'performance_logs table', status: '❌', message: `Exception: ${e.message}` });
  }

  // Check 3: Test insert to error_logs
  try {
    const testData = {
      message: 'Quick verification test',
      severity: 'low',
      source: 'verification_script',
      context: { test: true, timestamp: new Date().toISOString() },
    };

    const { data, error } = await supabase
      .from('error_logs')
      .insert([testData])
      .select()
      .single();

    if (error) {
      checks.push({ name: 'Insert test (error_logs)', status: '❌', message: error.message });
    } else {
      checks.push({ name: 'Insert test (error_logs)', status: '✅', message: `Inserted ID: ${data.id}` });
      
      // Cleanup
      await supabase.from('error_logs').delete().eq('id', data.id);
    }
  } catch (e) {
    checks.push({ name: 'Insert test (error_logs)', status: '❌', message: e.message });
  }

  // Print results
  console.log('📊 Results:\n');
  checks.forEach(check => {
    console.log(`${check.status} ${check.name}`);
    console.log(`   ${check.message}\n`);
  });

  const passed = checks.filter(c => c.status === '✅').length;
  const failed = checks.filter(c => c.status === '❌').length;

  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log('🎉 Migration verification successful!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some checks failed. Please review the migration.\n');
    console.log('💡 Tips:');
    console.log('   - Check Supabase Dashboard > Table Editor');
    console.log('   - Run: supabase db push');
    console.log('   - Or run SQL manually in Supabase Dashboard > SQL Editor\n');
    process.exit(1);
  }
}

quickVerify().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});

