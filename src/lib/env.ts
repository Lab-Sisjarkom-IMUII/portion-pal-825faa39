/**
 * Environment Variables Validation
 * 
 * Validates required environment variables at application startup.
 * Throws descriptive errors if required variables are missing.
 */

interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_ANON_KEY?: string; // Alias for SUPABASE_PUBLISHABLE_KEY
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string; // Alias for VITE_SUPABASE_ANON_KEY
  VITE_SUPABASE_PROJECT_ID?: string; // Optional, used for function URLs
  VITE_PRIVATE_STORAGE?: string; // Optional, 'true' or 'false'
  VITE_ENABLE_ERROR_LOGGING?: string; // Optional, 'true' or 'false'
  VITE_ENABLE_PERFORMANCE_LOGGING?: string; // Optional, 'true' or 'false'
}

/**
 * Validates required environment variables
 * @throws Error if required variables are missing
 */
export function validateEnv(): EnvConfig {
  const errors: string[] = [];

  // Required variables
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                            import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Validate required variables
  if (!SUPABASE_URL) {
    errors.push('VITE_SUPABASE_URL is required');
  } else if (!SUPABASE_URL.startsWith('http://') && !SUPABASE_URL.startsWith('https://')) {
    errors.push('VITE_SUPABASE_URL must be a valid URL (http:// or https://)');
  }

  if (!SUPABASE_ANON_KEY) {
    errors.push('VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY is required');
  } else if (SUPABASE_ANON_KEY.length < 20) {
    errors.push('VITE_SUPABASE_ANON_KEY appears to be invalid (too short)');
  }

  // If there are errors, throw with helpful message
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Missing or invalid required environment variables:',
      ...errors.map(e => `  - ${e}`),
      '',
      'Please check your .env.local file and ensure all required variables are set.',
      'See .env.example for a template.',
    ].join('\n');

    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Return validated config
  const config: EnvConfig = {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: SUPABASE_ANON_KEY,
    SUPABASE_ANON_KEY,
    VITE_SUPABASE_URL: SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: SUPABASE_ANON_KEY,
    VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
    VITE_PRIVATE_STORAGE: import.meta.env.VITE_PRIVATE_STORAGE,
    VITE_ENABLE_ERROR_LOGGING: import.meta.env.VITE_ENABLE_ERROR_LOGGING,
    VITE_ENABLE_PERFORMANCE_LOGGING: import.meta.env.VITE_ENABLE_PERFORMANCE_LOGGING,
  };

  // Log success in development
  if (import.meta.env.DEV) {
    console.log('✅ Environment variables validated successfully');
    console.log('📋 Config:', {
      SUPABASE_URL: SUPABASE_URL.substring(0, 30) + '...',
      hasAnonKey: !!SUPABASE_ANON_KEY,
      hasProjectId: !!config.VITE_SUPABASE_PROJECT_ID,
      privateStorage: config.VITE_PRIVATE_STORAGE === 'true',
      errorLogging: config.VITE_ENABLE_ERROR_LOGGING !== 'false',
      performanceLogging: config.VITE_ENABLE_PERFORMANCE_LOGGING === 'true',
    });
  }

  return config;
}

/**
 * Get validated environment variables
 * Use this instead of directly accessing import.meta.env
 */
export function getEnv(): EnvConfig {
  return validateEnv();
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

