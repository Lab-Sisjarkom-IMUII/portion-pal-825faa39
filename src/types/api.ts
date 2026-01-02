/**
 * Type definitions for API responses and requests
 * Centralized type definitions for better type safety
 */

// ====== Nutrition AI API Types ======

export interface NutritionAIResponse {
  calories?: number | string;
  protein?: number | string;
  carbs?: number | string;
  fat?: number | string;
  fiber?: number | string;
  food_name?: string;
  nama_makanan?: string;
  makanan?: string;
  kalori?: number | string;
  total_calories?: number | string;
  estimasi_kalori?: number | string;
  protein_g?: number | string;
  protein_grams?: number | string;
  protein_gram?: number | string;
  karbohidrat?: number | string;
  karbohidrat_g?: number | string;
  carbs_grams?: number | string;
  carbs_g?: number | string;
  lemak?: number | string;
  lemak_g?: number | string;
  fat_grams?: number | string;
  fat_g?: number | string;
  serat?: number | string;
  fiber_g?: number | string;
  suggestion?: string;
  advice?: string;
  saran?: string;
  portion_breakdown?: {
    carbs_percentage?: number;
    protein_percentage?: number;
    vegetables_percentage?: number;
  };
  confidence_score?: number | string;
  aiMode?: string;
}

export interface WrappedNutritionAIResponse {
  ai_result?: NutritionAIResponse;
  aiMode?: string;
  success?: boolean;
  error?: string;
}

// ====== Goal Calculator API Types ======

export interface GoalCalculatorRequest {
  age?: number;
  height?: number;
  weight?: number;
  gender?: string;
  activityLevel?: string;
  activity?: string;
  goal?: string;
  goal_type?: string;
  target_time?: string;
  target_weight?: number;
}

export interface GoalCalculatorResponse {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ai_result?: {
    daily_calories: number;
    carbs_percent: number;
    protein_percent: number;
    fat_percent: number;
    carbs_grams: number;
    protein_grams: number;
    fat_grams: number;
    suggestion: string;
  };
  aiMode?: 'openai' | 'local-fallback' | 'error-fallback';
  error?: string;
  warning?: string;
}

// ====== Supabase Storage Types ======

export interface SupabaseStorageClient {
  from: (bucket: string) => {
    upload: (path: string, file: File, options?: { upsert?: boolean }) => Promise<{
      data: { path: string } | null;
      error: { message: string; statusCode?: string } | null;
    }>;
    getPublicUrl: (path: string) => { data: { publicUrl: string } };
    createSignedUrl?: (path: string, expiresIn: number) => Promise<{
      data: { signedUrl: string } | null;
      error: unknown;
    }>;
  };
}

export interface SupabaseFunctionsClient {
  url?: (name: string) => string;
  invoke?: (
    name: string,
    options?: {
      headers?: Record<string, string>;
      body?: unknown;
    }
  ) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
}

// ====== Supabase Response Types ======

export interface SupabaseInsertResponse<T = unknown> {
  data: T[] | null;
  error: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  } | null;
}

// ====== Utility Types ======

export type SafeRecord<T = unknown> = Record<string, T>;

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

