/**
 * Goal Calculator Utility
 * 
 * Retrieves user's daily calorie goal from the database.
 * Used to calculate and display calorie targets in the application.
 */

import { supabase } from "@/integrations/supabase/client";

export type GoalCalories = {
  daily_target: number;
};

/**
 * Get user's daily calorie goal from the most recent goal entry
 * 
 * @param userId - User ID to fetch goal for
 * @returns Daily calorie target, or null if no goal found or error occurred
 */
export async function getGoalCalories(userId: string): Promise<GoalCalories | null> {
  try {
    const { data, error } = await supabase
      .from('user_goals')
      .select('ai_result')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      // Only log if it's not a "not found" error
      if (error.code !== 'PGRST116') {
        const { logError } = await import('@/lib/errorLogger');
        await logError(new Error(error.message), {
          source: 'goalCalculator',
          severity: 'low',
          additionalContext: {
            action: 'get_goal_calories',
            errorCode: error.code,
            userId,
          },
        });
      }
      return null;
    }
    
    type UserGoalData = { ai_result?: { daily_calories?: number | string } };
    const goalData = data as UserGoalData | null;
    const daily = Number(goalData?.ai_result?.daily_calories);
    if (!isNaN(daily) && daily > 0) return { daily_target: daily };
    return null;
  } catch (error) {
    const { logError } = await import('@/lib/errorLogger');
    await logError(error instanceof Error ? error : new Error(String(error)), {
      source: 'goalCalculator',
      severity: 'low',
      additionalContext: {
        action: 'get_goal_calories',
        userId,
      },
    });
    return null;
  }
}


