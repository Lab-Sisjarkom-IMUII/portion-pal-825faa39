/**
 * Performance Monitoring Utility
 * 
 * Tracks Core Web Vitals and application performance metrics.
 * Provides insights into user experience and application performance.
 */

import { supabase } from '@/integrations/supabase/client';
import { logPerformance } from './errorLogger';

export interface CoreWebVitals {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

// Store metrics in memory for batch reporting
const metricsBuffer: PerformanceMetric[] = [];
const MAX_BUFFER_SIZE = 50;
const REPORT_INTERVAL = 30000; // 30 seconds

let reportIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize performance monitoring
 * 
 * Sets up Core Web Vitals tracking, page load performance tracking,
 * and batch reporting of metrics. Should be called once at application startup.
 */
export function initPerformanceMonitoring(): void {
  if (typeof window === 'undefined') return;

  // Track Core Web Vitals using Web Vitals library if available
  // Otherwise, use native Performance API
  trackCoreWebVitals();

  // Track page load performance
  if (document.readyState === 'complete') {
    trackPageLoad();
  } else {
    window.addEventListener('load', trackPageLoad);
  }

  // Start batch reporting
  startBatchReporting();
}

/**
 * Track Core Web Vitals using Performance API
 */
function trackCoreWebVitals(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    // Track Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
      const lcp = lastEntry.renderTime || lastEntry.loadTime || lastEntry.startTime;
      
      if (lcp) {
        recordMetric('lcp', lcp, 'ms', {
          url: window.location.pathname,
          type: 'core-web-vital',
        });
      }
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // Track First Input Delay (FID) - requires user interaction
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        const fidEntry = entry as PerformanceEventTiming;
        if (fidEntry.processingStart && fidEntry.startTime) {
          const fid = fidEntry.processingStart - fidEntry.startTime;
          recordMetric('fid', fid, 'ms', {
            url: window.location.pathname,
            type: 'core-web-vital',
            eventType: fidEntry.name,
          });
        }
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Track Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        const layoutShift = entry as LayoutShift;
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
        }
      });
      
      // Report CLS when page is hidden or unloaded
      if (document.visibilityState === 'hidden') {
        recordMetric('cls', clsValue, 'score', {
          url: window.location.pathname,
          type: 'core-web-vital',
        });
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    // Track First Contentful Paint (FCP)
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          recordMetric('fcp', entry.startTime, 'ms', {
            url: window.location.pathname,
            type: 'core-web-vital',
          });
        }
      });
    });
    fcpObserver.observe({ entryTypes: ['paint'] });

    // Track Time to First Byte (TTFB)
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationEntry) {
      const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
      recordMetric('ttfb', ttfb, 'ms', {
        url: window.location.pathname,
        type: 'core-web-vital',
      });
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Performance monitoring initialization failed:', error);
    }
  }
}

/**
 * Track page load performance
 */
function trackPageLoad(): void {
  if (typeof window === 'undefined' || !('performance' in window)) return;

  try {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationEntry) {
      const loadTime = navigationEntry.loadEventEnd - navigationEntry.fetchStart;
      const domContentLoaded = navigationEntry.domContentLoadedEventEnd - navigationEntry.fetchStart;
      const domInteractive = navigationEntry.domInteractive - navigationEntry.fetchStart;

      recordMetric('page-load', loadTime, 'ms', {
        url: window.location.pathname,
        type: 'page-load',
      });

      recordMetric('dom-content-loaded', domContentLoaded, 'ms', {
        url: window.location.pathname,
        type: 'page-load',
      });

      recordMetric('dom-interactive', domInteractive, 'ms', {
        url: window.location.pathname,
        type: 'page-load',
      });
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Page load tracking failed:', error);
    }
  }
}

/**
 * Record a performance metric to the buffer
 * 
 * Metrics are stored in memory and reported in batches to reduce
 * database load. Buffer has a maximum size to prevent memory issues.
 * 
 * @param name - Metric name (e.g., 'lcp', 'api-call', 'edge-function')
 * @param value - Metric value
 * @param unit - Unit of measurement (default: 'ms')
 * @param context - Additional context data (optional)
 */
export function recordMetric(
  name: string,
  value: number,
  unit: string = 'ms',
  context?: Record<string, unknown>
): void {
  const metric: PerformanceMetric = {
    name,
    value,
    unit,
    timestamp: new Date().toISOString(),
    context: {
      ...context,
      userAgent: navigator.userAgent,
      url: window.location.pathname,
    },
  };

  metricsBuffer.push(metric);

  // Log to console in development
  if (import.meta.env.DEV) {
    logPerformance(name, value, {
      source: 'performanceMonitor',
      unit,
      additionalContext: context,
    });
  }

  // Prevent buffer overflow
  if (metricsBuffer.length > MAX_BUFFER_SIZE) {
    metricsBuffer.shift();
  }
}

/**
 * Track API call performance
 * 
 * Wraps an API call to automatically measure and record its duration.
 * Records both successful and failed calls with appropriate context.
 * 
 * @param apiName - Name identifier for the API call
 * @param apiCall - Function that performs the API call
 * @param context - Additional context data (optional)
 * @returns The result of the API call
 * @throws Re-throws any error from the API call
 */
export async function trackAPICall<T>(
  apiName: string,
  apiCall: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await apiCall();
    const duration = performance.now() - startTime;
    
    recordMetric(`api-${apiName}`, duration, 'ms', {
      ...context,
      success: true,
      type: 'api-call',
    });

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    recordMetric(`api-${apiName}`, duration, 'ms', {
      ...context,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      type: 'api-call',
    });

    throw error;
  }
}

/**
 * Track Edge Function call performance
 * 
 * Wraps an Edge Function call to automatically measure and record its duration.
 * Records both successful and failed calls with HTTP status information.
 * 
 * @param functionName - Name identifier for the Edge Function
 * @param functionCall - Function that performs the Edge Function call
 * @param context - Additional context data (optional)
 * @returns The Response from the Edge Function
 * @throws Re-throws any error from the Edge Function call
 */
export async function trackEdgeFunction<T>(
  functionName: string,
  functionCall: () => Promise<Response>,
  context?: Record<string, unknown>
): Promise<Response> {
  const startTime = performance.now();
  
  try {
    const response = await functionCall();
    const duration = performance.now() - startTime;
    
    recordMetric(`edge-${functionName}`, duration, 'ms', {
      ...context,
      success: response.ok,
      status: response.status,
      type: 'edge-function',
    });

    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    recordMetric(`edge-${functionName}`, duration, 'ms', {
      ...context,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      type: 'edge-function',
    });

    throw error;
  }
}

/**
 * Start batch reporting of metrics
 */
function startBatchReporting(): void {
  if (reportIntervalId) return;

  reportIntervalId = setInterval(() => {
    if (metricsBuffer.length > 0) {
      reportMetrics();
    }
  }, REPORT_INTERVAL);

  // Report on page unload
  window.addEventListener('beforeunload', () => {
    if (metricsBuffer.length > 0) {
      // Use sendBeacon for reliable reporting on page unload
      reportMetrics(true);
    }
  });
}

/**
 * Report metrics to Supabase (if enabled)
 */
async function reportMetrics(useBeacon: boolean = false): Promise<void> {
  if (metricsBuffer.length === 0) return;

  const metricsToReport = [...metricsBuffer];
  metricsBuffer.length = 0; // Clear buffer

  // In production, send to Supabase if enabled
  if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_PERFORMANCE_LOGGING === 'true') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (useBeacon && navigator.sendBeacon) {
        // Use sendBeacon for page unload scenarios
        const data = JSON.stringify({
          metrics: metricsToReport,
          user_id: user?.id || null,
          timestamp: new Date().toISOString(),
        });
        navigator.sendBeacon('/api/performance', data);
      } else {
        // Regular fetch for normal reporting
        await supabase.from('performance_logs').insert(
          metricsToReport.map((metric) => ({
            metric: metric.name,
            value: metric.value,
            unit: metric.unit,
            source: 'performanceMonitor',
            user_id: user?.id || null,
            context: metric.context || {},
            timestamp: metric.timestamp,
          }))
        );
      }
    } catch (error) {
      // Silently fail - don't break the app
      if (import.meta.env.DEV) {
        console.warn('Failed to report performance metrics:', error);
      }
    }
  }
}

/**
 * Get current metrics buffer (for debugging)
 * 
 * Returns a copy of all metrics currently in the buffer.
 * Useful for debugging or manual metric inspection.
 * 
 * @returns Array of performance metrics
 */
export function getMetricsBuffer(): PerformanceMetric[] {
  return [...metricsBuffer];
}

/**
 * Clear metrics buffer
 * 
 * Removes all metrics from the buffer. Useful for testing
 * or when you want to reset metrics collection.
 */
export function clearMetricsBuffer(): void {
  metricsBuffer.length = 0;
}

/**
 * Stop performance monitoring
 * 
 * Stops batch reporting and reports any remaining metrics.
 * Should be called when the application is shutting down
 * or when performance monitoring is no longer needed.
 */
export function stopPerformanceMonitoring(): void {
  if (reportIntervalId) {
    clearInterval(reportIntervalId);
    reportIntervalId = null;
  }
  
  // Report any remaining metrics
  if (metricsBuffer.length > 0) {
    reportMetrics();
  }
}

// Type definitions for Performance API
interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
}

