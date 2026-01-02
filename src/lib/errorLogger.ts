/**
 * Centralized Error Logging Service
 * 
 * This service provides a unified way to log errors across the application.
 * Errors can be logged to:
 * - Console (development)
 * - Supabase Database (production)
 * - External error tracking service (optional, e.g., Sentry)
 */

import { supabase } from "@/integrations/supabase/client";

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  userId?: string;
  userEmail?: string;
  route?: string;
  userAgent?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface LoggedError {
  id?: string;
  message: string;
  error?: string;
  stack?: string;
  severity: ErrorSeverity;
  context: ErrorContext;
  source: string; // e.g., 'aiAnalysis', 'goalCalculator', 'auth'
  timestamp: string;
}

/**
 * Log error to console and optionally to Supabase
 */
export async function logError(
  error: Error | unknown,
  context: {
    source: string;
    severity?: ErrorSeverity;
    additionalContext?: Record<string, unknown>;
  }
): Promise<void> {
  const severity = context.severity || 'medium';
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const errorName = error instanceof Error ? error.name : 'UnknownError';

  // Build context object
  const errorContext: ErrorContext = {
    ...context.additionalContext,
    route: window.location.pathname,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  // Get user info if available
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      errorContext.userId = user.id;
      errorContext.userEmail = user.email;
    }
  } catch (e) {
    // Ignore auth errors when logging
  }

  // Always log to console
  const logMessage = `[${context.source}] ${errorMessage}`;
  const logData = {
    error: errorName,
    message: errorMessage,
    stack: errorStack,
    severity,
    context: errorContext,
  };

  switch (severity) {
    case 'critical':
    case 'high':
      console.error('🔴', logMessage, logData);
      break;
    case 'medium':
      console.warn('🟡', logMessage, logData);
      break;
    case 'low':
      console.info('🔵', logMessage, logData);
      break;
  }

  // In production, also log to Supabase (if table exists)
  if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_ERROR_LOGGING === 'true') {
    try {
      await logErrorToSupabase({
        message: errorMessage,
        error: errorName,
        stack: errorStack,
        severity,
        context: errorContext,
        source: context.source,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      // Don't throw if error logging fails
      console.warn('Failed to log error to Supabase:', e);
    }
  }

  // Optional: Send to external error tracking service (e.g., Sentry)
  // Uncomment and configure if you want to use Sentry
  /*
  if (window.Sentry) {
    window.Sentry.captureException(error, {
      tags: {
        source: context.source,
        severity,
      },
      extra: errorContext,
    });
  }
  */
}

/**
 * Log error to Supabase database
 * Requires an 'error_logs' table in Supabase
 */
async function logErrorToSupabase(error: LoggedError): Promise<void> {
  try {
    // Check if error_logs table exists by attempting to insert
    const { error: insertError } = await supabase
      .from('error_logs')
      .insert({
        message: error.message,
        error: error.error,
        stack: error.stack,
        severity: error.severity,
        context: error.context,
        source: error.source,
        timestamp: error.timestamp,
        user_id: error.context.userId || null,
      });

    if (insertError) {
      // Table might not exist, that's okay
      if (import.meta.env.DEV) {
        console.warn('Error logs table not found or insert failed:', insertError.message);
      }
    }
  } catch (e) {
    // Silently fail - don't break the app if error logging fails
    if (import.meta.env.DEV) {
      console.warn('Error logging to Supabase failed:', e);
    }
  }
}

/**
 * Log warning (non-critical issues)
 */
export function logWarning(
  message: string,
  context: {
    source: string;
    additionalContext?: Record<string, unknown>;
  }
): void {
  logError(new Error(message), {
    ...context,
    severity: 'low',
  });
}

/**
 * Log info message
 */
export function logInfo(
  message: string,
  context: {
    source: string;
    additionalContext?: Record<string, unknown>;
  }
): void {
  if (import.meta.env.DEV) {
    console.info(`[${context.source}]`, message, context.additionalContext || {});
  }
}

/**
 * Track performance metrics
 */
export async function logPerformance(
  metric: string,
  value: number,
  context: {
    source: string;
    unit?: string;
    additionalContext?: Record<string, unknown>;
  }
): Promise<void> {
  if (import.meta.env.DEV) {
    console.log(`⏱️ [${context.source}] ${metric}:`, value, context.unit || 'ms', context.additionalContext || {});
  }

  // Optionally log to Supabase for analytics
  if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_PERFORMANCE_LOGGING === 'true') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('performance_logs').insert({
        metric,
        value,
        unit: context.unit || 'ms',
        source: context.source,
        user_id: user?.id || null,
        context: context.additionalContext || {},
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      // Silently fail
    }
  }
}

