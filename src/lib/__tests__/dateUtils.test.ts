import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDateRanges,
  getDateRangeForPeriod,
  formatDate,
  formatDateTime,
  getRelativeTime,
  isToday,
  isThisWeek,
  isThisMonth,
} from '../dateUtils';

describe('getDateRanges', () => {
  it('should return date ranges', () => {
    const ranges = getDateRanges();
    
    expect(ranges.today).toBeDefined();
    expect(ranges.week).toBeDefined();
    expect(ranges.month).toBeDefined();
    expect(typeof ranges.today).toBe('string');
    expect(typeof ranges.week).toBe('string');
    expect(typeof ranges.month).toBe('string');
  });

  it('should return ISO strings', () => {
    const ranges = getDateRanges();
    
    expect(() => new Date(ranges.today)).not.toThrow();
    expect(() => new Date(ranges.week)).not.toThrow();
    expect(() => new Date(ranges.month)).not.toThrow();
  });
});

describe('getDateRangeForPeriod', () => {
  it('should return today range', () => {
    const result = getDateRangeForPeriod('today');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should return week range', () => {
    const result = getDateRangeForPeriod('week');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should return month range', () => {
    const result = getDateRangeForPeriod('month');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

describe('formatDate', () => {
  it('should format date in short format', () => {
    const date = new Date('2024-01-15');
    const result = formatDate(date, 'short');
    
    expect(result).toContain('15');
    expect(result).toContain('01');
    expect(result).toContain('2024');
  });

  it('should format date in long format', () => {
    const date = new Date('2024-01-15');
    const result = formatDate(date, 'long');
    
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('should handle string dates', () => {
    const dateString = '2024-01-15T00:00:00.000Z';
    const result = formatDate(dateString);
    
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

describe('formatDateTime', () => {
  it('should format date and time', () => {
    const date = new Date('2024-01-15T14:30:00.000Z');
    const result = formatDateTime(date);
    
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should handle string dates', () => {
    const dateString = '2024-01-15T14:30:00.000Z';
    const result = formatDateTime(dateString);
    
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

describe('getRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "Baru saja" for very recent times', () => {
    const date = new Date('2024-01-15T11:59:59.000Z');
    const result = getRelativeTime(date);
    
    expect(result).toBe('Baru saja');
  });

  it('should return minutes ago', () => {
    const date = new Date('2024-01-15T11:55:00.000Z');
    const result = getRelativeTime(date);
    
    expect(result).toContain('menit yang lalu');
  });

  it('should return hours ago', () => {
    const date = new Date('2024-01-15T10:00:00.000Z');
    const result = getRelativeTime(date);
    
    expect(result).toContain('jam yang lalu');
  });

  it('should return "Kemarin" for yesterday', () => {
    const date = new Date('2024-01-14T12:00:00.000Z');
    const result = getRelativeTime(date);
    
    expect(result).toBe('Kemarin');
  });

  it('should return days ago', () => {
    const date = new Date('2024-01-13T12:00:00.000Z');
    const result = getRelativeTime(date);
    
    expect(result).toContain('hari yang lalu');
  });
});

describe('isToday', () => {
  it('should return true for today', () => {
    const today = new Date();
    expect(isToday(today)).toBe(true);
  });

  it('should return false for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);
  });

  it('should handle string dates', () => {
    const today = new Date().toISOString();
    expect(isToday(today)).toBe(true);
  });
});

describe('isThisWeek', () => {
  it('should return true for dates in current week', () => {
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 2);
    expect(isThisWeek(thisWeek)).toBe(true);
  });

  it('should return false for dates last week', () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 8);
    expect(isThisWeek(lastWeek)).toBe(false);
  });
});

describe('isThisMonth', () => {
  it('should return true for dates in current month', () => {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    expect(isThisMonth(thisMonth)).toBe(true);
  });

  it('should return false for dates last month', () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    expect(isThisMonth(lastMonth)).toBe(false);
  });
});

