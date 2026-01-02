/**
 * Retry Utility with Exponential Backoff
 * 
 * Provides retry mechanism for API calls with configurable:
 * - Max retries
 * - Exponential backoff delay
 * - Retryable error conditions
 * - Jitter to prevent thundering herd
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Function to determine if error is retryable (default: retries on network errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Function to determine if response is retryable (default: retries on 5xx and 429) */
  isRetryableResponse?: (response: Response) => boolean;
  /** Custom error message prefix (default: 'Retry failed') */
  errorMessagePrefix?: string;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt);
  const delay = Math.min(exponentialDelay, maxDelay);
  
  if (jitter) {
    // Add random jitter (±20%) to prevent thundering herd
    const jitterAmount = delay * 0.2;
    const jitterValue = (Math.random() * 2 - 1) * jitterAmount;
    return Math.max(0, delay + jitterValue);
  }
  
  return delay;
}

/**
 * Default function to check if error is retryable
 */
function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    // Network errors are retryable
    return true;
  }
  if (error instanceof Error) {
    // Timeout errors are retryable
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return true;
    }
    // Network-related errors
    if (error.message.includes('network') || error.message.includes('Network')) {
      return true;
    }
  }
  return false;
}

/**
 * Default function to check if response is retryable
 */
function defaultIsRetryableResponse(response: Response): boolean {
  // Retry on server errors (5xx) and rate limits (429)
  return response.status >= 500 || response.status === 429;
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry (should return Promise)
 * @param options - Retry configuration options
 * @returns Promise with retry result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    jitter = true,
    isRetryable = defaultIsRetryable,
    isRetryableResponse = defaultIsRetryableResponse,
    errorMessagePrefix = 'Retry failed',
  } = options;

  const startTime = Date.now();
  let lastError: Error | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // If result is a Response, check if it's retryable
      if (result instanceof Response) {
        if (!result.ok && isRetryableResponse(result)) {
          lastResponse = result;
          
          // Don't retry if we've exhausted attempts
          if (attempt >= maxRetries) {
            const error = new Error(
              `${errorMessagePrefix} after ${attempt + 1} attempts: ${result.status} ${result.statusText}`
            );
            return {
              success: false,
              error,
              attempts: attempt + 1,
              totalTime: Date.now() - startTime,
            };
          }
          
          // Wait before retrying
          const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier, jitter);
          if (import.meta.env.DEV) {
            console.log(`⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms (status: ${result.status})`);
          }
          await sleep(delay);
          continue;
        }
      }
      
      // Success!
      return {
        success: true,
        data: result,
        attempts: attempt + 1,
        totalTime: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      if (!isRetryable(error)) {
        // Not retryable, return immediately
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalTime: Date.now() - startTime,
        };
      }
      
      // Don't retry if we've exhausted attempts
      if (attempt >= maxRetries) {
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalTime: Date.now() - startTime,
        };
      }
      
      // Wait before retrying
      const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier, jitter);
      if (import.meta.env.DEV) {
        console.log(`⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms (error: ${lastError.message})`);
      }
      await sleep(delay);
    }
  }
  
  // Should never reach here, but TypeScript needs it
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: maxRetries + 1,
    totalTime: Date.now() - startTime,
  };
}

/**
 * Retry a fetch request with exponential backoff
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param retryOptions - Retry configuration
 * @returns Promise with Response
 */
export async function retryFetch(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const result = await retry(
    () => fetch(url, options),
    {
      ...retryOptions,
      isRetryableResponse: (response) => {
        // Use custom or default retryable response check
        if (retryOptions.isRetryableResponse) {
          return retryOptions.isRetryableResponse(response);
        }
        return defaultIsRetryableResponse(response);
      },
    }
  );
  
  if (!result.success) {
    throw result.error || new Error('Fetch failed after retries');
  }
  
  if (!result.data) {
    throw new Error('No data returned from fetch');
  }
  
  return result.data as Response;
}

/**
 * Retry configuration presets
 */
export const RetryPresets = {
  /** Quick retries for fast operations (1s initial, 2 retries) */
  quick: {
    maxRetries: 2,
    initialDelay: 1000,
    maxDelay: 3000,
    backoffMultiplier: 2,
  },
  /** Standard retries for normal operations (1s initial, 3 retries) */
  standard: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  /** Aggressive retries for critical operations (500ms initial, 5 retries) */
  aggressive: {
    maxRetries: 5,
    initialDelay: 500,
    maxDelay: 15000,
    backoffMultiplier: 2,
  },
  /** Conservative retries for expensive operations (2s initial, 2 retries) */
  conservative: {
    maxRetries: 2,
    initialDelay: 2000,
    maxDelay: 8000,
    backoffMultiplier: 2,
  },
} as const;

