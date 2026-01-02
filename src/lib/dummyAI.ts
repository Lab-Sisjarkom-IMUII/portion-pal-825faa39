/**
 * AI Suggestion Service
 * 
 * Calls the nutrition-ai Edge Function to get AI-powered food suggestions
 * based on macro nutrients and health score.
 */

import { supabase } from "@/integrations/supabase/client";
import { logError, logInfo } from "@/lib/errorLogger";
import type { SupabaseFunctionsClient } from "@/types/api";

interface MacroData {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface AIResponse {
  suggestion: string;
  aiMode: string;
  timestamp: string;
}

/**
 * Get AI-powered food suggestion based on macro nutrients and health score
 * 
 * Attempts to call the nutrition-ai Edge Function via SDK invoke method first,
 * then falls back to REST API if SDK method is not available.
 * 
 * @param macros - Macro nutrients (protein, carbs, fat, fiber) in grams
 * @param healthScore - Health score (0-10) calculated from nutrition data
 * @returns AI response with suggestion, mode, and timestamp
 * @throws Error if user is not authenticated
 */
export const getAISuggestion = async (
  macros: MacroData,
  healthScore: number
): Promise<AIResponse> => {
  if (import.meta.env.DEV) {
    logInfo("Sending data to AI analyzer", {
      source: 'dummyAI',
      additionalContext: { macros, healthScore },
    });
  }

  try {
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('User must be logged in to get AI suggestions');
    }

    // Prefer SDK invoke if available (some SDK builds in browser may not expose functions.invoke)
    const functionsClient = supabase.functions as unknown as SupabaseFunctionsClient;
    if (typeof functionsClient?.invoke === 'function') {
      const { data, error } = await functionsClient.invoke('nutrition-ai', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { macros, healthScore }
      });

      if (error) {
        await logError(error instanceof Error ? error : new Error(String(error)), {
          source: 'dummyAI',
          severity: 'high',
          additionalContext: {
            action: 'call_ai_function_invoke',
          },
        });
        throw error;
      }

      if (import.meta.env.DEV) {
        logInfo("AI responded (invoke)", {
          source: 'dummyAI',
          additionalContext: { hasData: !!data },
        });
      }
      return data as AIResponse;
    }

    // Fallback: call the Edge Function via REST URL
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    let functionsHost = '';
    if (projectId) {
      functionsHost = `https://${projectId}.functions.supabase.co`;
    } else if (import.meta.env.VITE_SUPABASE_URL) {
      const m = import.meta.env.VITE_SUPABASE_URL.match(/^https?:\/\/([^/.]+)\.supabase\.co/);
      functionsHost = m ? `https://${m[1]}.functions.supabase.co` : import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '');
    }

    const url = `${functionsHost}/functions/v1/nutrition-ai`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ macros, healthScore }),
    });

    const data = await res.json();
    if (!res.ok) {
      await logError(new Error(typeof data?.error === 'string' ? data.error : 'Failed to call nutrition-ai'), {
        source: 'dummyAI',
        severity: 'high',
        additionalContext: {
          action: 'call_ai_function_fetch',
          status: res.status,
          errorData: data,
        },
      });
      throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to call nutrition-ai');
    }

    if (import.meta.env.DEV) {
      logInfo('AI responded (fetch)', {
        source: 'dummyAI',
        additionalContext: { hasData: !!data },
      });
    }
    return data as AIResponse;
  } catch (error) {
    await logError(error instanceof Error ? error : new Error(String(error)), {
      source: 'dummyAI',
      severity: 'high',
      additionalContext: {
        action: 'get_ai_suggestion',
      },
    });
    
    // Fallback response
    return {
      suggestion: "Tidak bisa terhubung ke AI saat ini. Pastikan porsi makan seimbang dengan kombinasi protein, karbohidrat, dan sayur 🌿",
      aiMode: "error-fallback",
      timestamp: new Date().toISOString(),
    };
  }
};
