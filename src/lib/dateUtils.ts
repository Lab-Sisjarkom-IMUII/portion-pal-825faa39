/**
 * Date Utilities
 * 
 * Centralized date calculation and formatting utilities.
 * Used across multiple pages for consistent date handling.
 */

/**
 * Calculate date ranges for filtering (today, week, month)
 * 
 * @returns Object with ISO string dates for today, week start, and month start
 */
export function getDateRanges(): {
  today: string;
  week: string;
  month: string;
} {
  const now = new Date();
  
  // Today: start of current day
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Week: start of current week (Monday)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  
  // Month: start of current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  return {
    today: today.toISOString(),
    week: weekStart.toISOString(),
    month: monthStart.toISOString(),
  };
}

/**
 * Get date range for a specific period
 * 
 * @param period - 'today', 'week', or 'month'
 * @returns ISO string date for the start of the period
 */
export function getDateRangeForPeriod(period: 'today' | 'week' | 'month'): string {
  const ranges = getDateRanges();
  return ranges[period];
}

/**
 * Format date for display
 * 
 * @param date - Date string or Date object
 * @param format - 'short' (DD/MM/YYYY) or 'long' (DD Month YYYY)
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  format: 'short' | 'long' = 'short'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'short') {
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format date and time for display
 * 
 * @param date - Date string or Date object
 * @returns Formatted date and time string
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time string (e.g., "2 hours ago", "yesterday")
 * 
 * @param date - Date string or Date object
 * @returns Relative time string
 */
export function getRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit yang lalu`;
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari yang lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu yang lalu`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} bulan yang lalu`;
  return `${Math.floor(diffDays / 365)} tahun yang lalu`;
}

/**
 * Check if date is today
 */
export function isToday(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is in current week
 */
export function isThisWeek(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const ranges = getDateRanges();
  return new Date(date) >= new Date(ranges.week);
}

/**
 * Check if date is in current month
 */
export function isThisMonth(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const ranges = getDateRanges();
  return new Date(date) >= new Date(ranges.month);
}

