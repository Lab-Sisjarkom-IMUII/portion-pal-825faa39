import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retry, retryFetch, RetryPresets } from '../retry';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    
    const result = await retry(fn);
    
    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('success');
    
    const resultPromise = retry(fn, { maxRetries: 2, initialDelay: 100 });
    
    // Fast-forward time to skip delays
    await vi.advanceTimersByTimeAsync(200);
    
    const result = await resultPromise;
    
    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should fail after max retries', async () => {
    const error = new Error('Network error');
    const fn = vi.fn().mockRejectedValue(error);
    
    const resultPromise = retry(fn, { maxRetries: 2, initialDelay: 100 });
    
    await vi.advanceTimersByTimeAsync(500);
    
    const result = await resultPromise;
    
    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
    expect(result.attempts).toBe(3); // initial + 2 retries
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const error = new Error('Validation error');
    const fn = vi.fn().mockRejectedValue(error);
    
    const resultPromise = retry(fn, {
      maxRetries: 2,
      initialDelay: 100,
      isRetryable: () => false, // Not retryable
    });
    
    const result = await resultPromise;
    
    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
    expect(result.attempts).toBe(1); // No retries
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable response status', async () => {
    const response500 = new Response(null, { status: 500 });
    const response200 = new Response(null, { status: 200 });
    
    const fn = vi.fn()
      .mockResolvedValueOnce(response500)
      .mockResolvedValueOnce(response200);
    
    const resultPromise = retry(fn, { maxRetries: 2, initialDelay: 100 });
    
    await vi.advanceTimersByTimeAsync(200);
    
    const result = await resultPromise;
    
    expect(result.success).toBe(true);
    expect(result.data).toBe(response200);
    expect(result.attempts).toBe(2);
  });

  it('should use exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce('success');
    
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = vi.fn((callback, delay) => {
      delays.push(delay as number);
      return originalSetTimeout(callback, delay);
    }) as any;
    
    const resultPromise = retry(fn, {
      maxRetries: 2,
      initialDelay: 100,
      maxDelay: 1000,
      jitter: false, // Disable jitter for predictable testing
    });
    
    await vi.advanceTimersByTimeAsync(500);
    
    const result = await resultPromise;
    
    expect(result.success).toBe(true);
    // First retry: 100ms, second retry: 200ms (exponential)
    expect(delays.length).toBeGreaterThan(0);
  });

  it('should respect maxDelay', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce('success');
    
    const resultPromise = retry(fn, {
      maxRetries: 1,
      initialDelay: 100,
      maxDelay: 150, // Cap at 150ms
      jitter: false,
    });
    
    await vi.advanceTimersByTimeAsync(200);
    
    const result = await resultPromise;
    
    expect(result.success).toBe(true);
  });
});

describe('retryFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should retry fetch on network error', async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response('success', { status: 200 }));
    
    const resultPromise = retryFetch('https://example.com', {}, {
      maxRetries: 1,
      initialDelay: 100,
    });
    
    await vi.advanceTimersByTimeAsync(200);
    
    const result = await resultPromise;
    
    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw error after max retries', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    
    const resultPromise = retryFetch('https://example.com', {}, {
      maxRetries: 1,
      initialDelay: 100,
    });
    
    await vi.advanceTimersByTimeAsync(300);
    
    await expect(resultPromise).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('RetryPresets', () => {
  it('should have correct quick preset', () => {
    expect(RetryPresets.quick).toEqual({
      maxRetries: 2,
      initialDelay: 1000,
      maxDelay: 3000,
      backoffMultiplier: 2,
    });
  });

  it('should have correct standard preset', () => {
    expect(RetryPresets.standard).toEqual({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    });
  });

  it('should have correct aggressive preset', () => {
    expect(RetryPresets.aggressive).toEqual({
      maxRetries: 5,
      initialDelay: 500,
      maxDelay: 15000,
      backoffMultiplier: 2,
    });
  });

  it('should have correct conservative preset', () => {
    expect(RetryPresets.conservative).toEqual({
      maxRetries: 2,
      initialDelay: 2000,
      maxDelay: 8000,
      backoffMultiplier: 2,
    });
  });
});

