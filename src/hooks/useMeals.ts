/**
 * Reusable Hook for Meals Data
 * 
 * Centralized data fetching and realtime subscription for user meals.
 * Used across Insights, History, and other pages that need meal data.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { getDateRangeForPeriod } from '@/lib/dateUtils';

export interface Meal {
  id: string;
  user_id: string;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  health_score: number | null;
  vegetables: number | null;
  image_url: string | null;
  created_at: string;
}

export interface UseMealsOptions {
  /** Filter by date period */
  datePeriod?: 'today' | 'week' | 'month' | 'all';
  /** Pagination: items per page (0 = no pagination) */
  itemsPerPage?: number;
  /** Current page (only used if itemsPerPage > 0) */
  currentPage?: number;
  /** Columns to select (default: '*') */
  columns?: string;
  /** Enable realtime subscription (default: true) */
  enableRealtime?: boolean;
  /** Order by field (default: 'created_at') */
  orderBy?: string;
  /** Order direction (default: 'desc') */
  orderDirection?: 'asc' | 'desc';
}

export interface UseMealsResult {
  meals: Meal[];
  loading: boolean;
  error: Error | null;
  totalCount: number | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing user meals data
 */
export function useMeals(options: UseMealsOptions = {}): UseMealsResult {
  const {
    datePeriod = 'all',
    itemsPerPage = 0,
    currentPage = 1,
    columns = '*',
    enableRealtime = true,
    orderBy = 'created_at',
    orderDirection = 'desc',
  } = options;

  const navigate = useNavigate();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const loadMeals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // Build query
      let query = supabase
        .from('user_meals')
        .select(columns, itemsPerPage > 0 ? { count: 'exact' } : undefined)
        .eq('user_id', session.user.id);

      // Apply date filter
      if (datePeriod !== 'all') {
        const dateRange = getDateRangeForPeriod(datePeriod);
        query = query.gte('created_at', dateRange);
      }

      // Apply pagination
      if (itemsPerPage > 0) {
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        query = query.range(from, to);
      }

      // Apply ordering
      query = query.order(orderBy, { ascending: orderDirection === 'asc' });

      const { data, error: queryError, count } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      if (data) {
        setMeals(data as Meal[]);
        if (count !== null) {
          setTotalCount(count);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      const { logError } = await import('@/lib/errorLogger');
      await logError(error, {
        source: 'useMeals',
        severity: 'medium',
        additionalContext: {
          action: 'load_meals',
          datePeriod,
          itemsPerPage,
          currentPage,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [datePeriod, itemsPerPage, currentPage, columns, orderBy, orderDirection, navigate]);

  // Load meals on mount and when dependencies change
  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  // Setup realtime subscription
  useEffect(() => {
    if (!enableRealtime) return;

    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isMounted) return;

      // Use unique channel name to prevent duplicates
      const channelName = `user_meals_realtime_${session.user.id}_${Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_meals',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            if (payload.new && isMounted) {
              setMeals((prev) => [payload.new as Meal, ...prev]);
              // Update total count if pagination is enabled
              if (itemsPerPage > 0 && totalCount !== null) {
                setTotalCount((prev) => (prev !== null ? prev + 1 : null));
              }
            }
          }
        )
        .subscribe((status) => {
          if (import.meta.env.DEV) {
            const { logInfo } = await import('@/lib/errorLogger');
            logInfo(`Realtime subscription status: ${status}`, {
              source: 'useMeals',
              additionalContext: { status },
            });
          }
        });
    };

    setupRealtime();

    // Cleanup function
    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [enableRealtime, itemsPerPage, totalCount]);

  return {
    meals,
    loading,
    error,
    totalCount,
    refetch: loadMeals,
  };
}

