/**
 * Reusable Hook for Goals Data
 * 
 * Centralized data fetching for user goals.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

// Use database types for better type safety
export type UserGoal = Database['public']['Tables']['user_goals']['Row'];

export interface UseGoalsOptions {
  /** Get only the latest goal (default: true) */
  latestOnly?: boolean;
}

export interface UseGoalsResult {
  goal: UserGoal | null;
  goals: UserGoal[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing user goals data
 */
export function useGoals(options: UseGoalsOptions = {}): UseGoalsResult {
  const { latestOnly = true } = options;

  const navigate = useNavigate();
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      let query = supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (latestOnly) {
        const { data, error: queryError } = await query.limit(1).maybeSingle();
        
        if (queryError && queryError.code !== 'PGRST116') {
          throw new Error(queryError.message);
        }
        
        setGoal(data as UserGoal | null);
        setGoals(data ? [data as UserGoal] : []);
      } else {
        const { data, error: queryError } = await query;
        
        if (queryError) {
          throw new Error(queryError.message);
        }
        
        setGoals(data as UserGoal[] || []);
        setGoal(data && data.length > 0 ? (data[0] as UserGoal) : null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      const { logError } = await import('@/lib/errorLogger');
      await logError(error, {
        source: 'useGoals',
        severity: 'medium',
        additionalContext: {
          action: 'load_goals',
          latestOnly,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [latestOnly, navigate]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  return {
    goal,
    goals,
    loading,
    error,
    refetch: loadGoals,
  };
}

