/**
 * Meal Normalization Utilities
 * 
 * Centralized logic for parsing and normalizing nutrition data from various sources.
 * Used by both frontend (aiAnalysis.ts) and Edge Functions (nutrition-ai/index.ts).
 */

import type { NutritionAIResponse } from '@/types/api';

export interface NormalizedNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

/**
 * Parse a number from various formats (number, string with units, ranges, etc.)
 * 
 * Supports:
 * - Numbers: 100
 * - Strings with units: "100 kcal", "~50g"
 * - Ranges: "200-300", "200 – 300", "200 to 300" (takes midpoint)
 * - Comma decimals: "100,5" → 100.5
 * 
 * @param value - Value to parse (can be number, string, or null/undefined)
 * @returns Parsed number (always >= 0, rounded)
 */
export function parseNutritionNumber(value: unknown): number {
  if (value == null) return 0;
  
  // If already a number, validate and return
  if (typeof value === 'number' && isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  
  // If string, parse it
  if (typeof value === 'string') {
    const s = value.replace(/,/g, '.').trim();
    
    // Handle ranges like "200-300", "200 – 300", or "200 to 300" by taking the midpoint
    const rangeMatch = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:-|–|—|to)\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      if (!isNaN(a) && !isNaN(b)) {
        return Math.max(0, Math.round((a + b) / 2));
      }
    }
    
    // Extract first float/integer from string as fallback
    const m = s.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (m) {
      return Math.max(0, Math.round(Number(m[0])));
    }
  }
  
  return 0;
}

/**
 * Simple parse number (for basic cases without range support)
 * Used in frontend where we don't need range parsing
 */
export function parseNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number' && isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const m = value.replace(/,/g, '.').match(/[-+]?[0-9]*\.?[0-9]+/);
    if (m) return Math.max(0, Math.round(Number(m[0])));
  }
  return 0;
}

/**
 * Normalize nutrition data from AI response
 * Handles various field name variations and formats
 * 
 * @param raw - Raw nutrition data from AI (can have various field names)
 * @returns Normalized nutrition data
 */
export function normalizeNutritionData(raw: NutritionAIResponse | Record<string, unknown>): NormalizedNutrition {
  return {
    calories: parseNutritionNumber(
      raw.calories ?? raw.kalori ?? raw.total_calories ?? raw.estimasi_kalori
    ),
    protein: parseNutritionNumber(
      raw.protein ?? raw.protein_g ?? raw.protein_grams ?? raw.protein_gram
    ),
    carbs: parseNutritionNumber(
      raw.carbs ?? raw.karbohidrat ?? raw.karbohidrat_g ?? raw.carbs_grams ?? raw.carbs_g
    ),
    fat: parseNutritionNumber(
      raw.fat ?? raw.lemak ?? raw.lemak_g ?? raw.fat_grams ?? raw.fat_g
    ),
    fiber: parseNutritionNumber(
      raw.fiber ?? raw.serat ?? raw.fiber_g
    ),
  };
}

/**
 * Extract nutrition values from text using regex patterns
 * Used as fallback when JSON parsing fails or returns empty values
 * 
 * @param text - Text content to search
 * @returns Extracted nutrition values
 */
export function extractNutritionFromText(text: string): NormalizedNutrition {
  const searchNumber = (keys: string[]): number | null => {
    for (const key of keys) {
      // Allow capturing possible ranges as well (e.g. "200-300 kcal")
      const re = new RegExp(
        key + "\\s*[:-]?\\s*([0-9]{1,4}(?:[.,][0-9]+)?(?:\\s*(?:-|–|—|to)\\s*[0-9]{1,4}(?:[.,][0-9]+)?)?)",
        'i'
      );
      const m = text.match(re);
      if (m && m[1]) return parseNutritionNumber(m[1]);
    }
    
    // Try unit-first pattern: "200 kcal", "50g protein"
    const unitRe = new RegExp(
      "([0-9]{1,4}(?:[.,][0-9]+)?(?:\\s*(?:-|–|—|to)\\s*[0-9]{1,4}(?:[.,][0-9]+)?)?)\\s*(?:" + keys.join('|') + ")",
      'i'
    );
    const mm = text.match(unitRe);
    if (mm && mm[1]) return parseNutritionNumber(mm[1]);
    
    return null;
  };

  const cleanedText = text.replace(/```/g, ' ');
  
  const calories = searchNumber(['calories', 'kalori', 'kcal']);
  const protein = searchNumber(['protein', 'protein_g', 'proteingrams']);
  const carbs = searchNumber(['carbs', 'carbohydrate', 'karbohidrat', 'carbs_g']);
  const fat = searchNumber(['fat', 'lemak', 'fat_g']);

  return {
    calories: calories ?? 0,
    protein: protein ?? 0,
    carbs: carbs ?? 0,
    fat: fat ?? 0,
  };
}

/**
 * Check if nutrition data looks empty (all zeros)
 */
export function isNutritionEmpty(nutrition: NormalizedNutrition): boolean {
  return (
    nutrition.calories === 0 &&
    nutrition.protein === 0 &&
    nutrition.carbs === 0 &&
    nutrition.fat === 0
  );
}

/**
 * Merge two nutrition objects, preferring non-zero values
 * Used when combining parsed JSON with fallback text extraction
 */
export function mergeNutrition(
  primary: NormalizedNutrition,
  fallback: NormalizedNutrition
): NormalizedNutrition {
  return {
    calories: primary.calories || fallback.calories,
    protein: primary.protein || fallback.protein,
    carbs: primary.carbs || fallback.carbs,
    fat: primary.fat || fallback.fat,
    fiber: primary.fiber || fallback.fiber,
  };
}

