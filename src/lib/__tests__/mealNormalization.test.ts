import { describe, it, expect } from 'vitest';
import {
  parseNutritionNumber,
  parseNumber,
  normalizeNutritionData,
  extractNutritionFromText,
  isNutritionEmpty,
  mergeNutrition,
} from '../mealNormalization';

describe('parseNutritionNumber', () => {
  it('should parse numbers', () => {
    expect(parseNutritionNumber(100)).toBe(100);
    expect(parseNutritionNumber(0)).toBe(0);
    expect(parseNutritionNumber(123.45)).toBe(123);
  });

  it('should parse string numbers', () => {
    expect(parseNutritionNumber('100')).toBe(100);
    expect(parseNutritionNumber('123.45')).toBe(123);
    expect(parseNutritionNumber('0')).toBe(0);
  });

  it('should parse strings with units', () => {
    expect(parseNutritionNumber('100 kcal')).toBe(100);
    expect(parseNutritionNumber('~50g')).toBe(50);
    expect(parseNutritionNumber('200 calories')).toBe(200);
  });

  it('should parse ranges and take midpoint', () => {
    expect(parseNutritionNumber('200-300')).toBe(250);
    expect(parseNutritionNumber('100 – 200')).toBe(150);
    expect(parseNutritionNumber('50 to 100')).toBe(75);
  });

  it('should handle comma decimals', () => {
    expect(parseNutritionNumber('100,5')).toBe(101);
    expect(parseNutritionNumber('123,45')).toBe(123);
  });

  it('should return 0 for null/undefined', () => {
    expect(parseNutritionNumber(null)).toBe(0);
    expect(parseNutritionNumber(undefined)).toBe(0);
  });

  it('should return 0 for invalid values', () => {
    expect(parseNutritionNumber('invalid')).toBe(0);
    expect(parseNutritionNumber('')).toBe(0);
    expect(parseNutritionNumber(NaN)).toBe(0);
  });

  it('should handle negative numbers by returning 0', () => {
    expect(parseNutritionNumber(-10)).toBe(0);
    expect(parseNutritionNumber('-50')).toBe(0);
  });
});

describe('parseNumber', () => {
  it('should parse numbers', () => {
    expect(parseNumber(100)).toBe(100);
    expect(parseNumber(0)).toBe(0);
  });

  it('should parse string numbers', () => {
    expect(parseNumber('100')).toBe(100);
    expect(parseNumber('123.45')).toBe(123);
  });

  it('should return 0 for null/undefined', () => {
    expect(parseNumber(null)).toBe(0);
    expect(parseNumber(undefined)).toBe(0);
  });
});

describe('normalizeNutritionData', () => {
  it('should normalize standard field names', () => {
    const raw = {
      calories: 200,
      protein: 20,
      carbs: 30,
      fat: 10,
    };
    
    const result = normalizeNutritionData(raw);
    
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(20);
    expect(result.carbs).toBe(30);
    expect(result.fat).toBe(10);
  });

  it('should handle alternative field names', () => {
    const raw = {
      kalori: 200,
      protein_g: 20,
      karbohidrat: 30,
      lemak: 10,
    };
    
    const result = normalizeNutritionData(raw);
    
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(20);
    expect(result.carbs).toBe(30);
    expect(result.fat).toBe(10);
  });

  it('should handle string values', () => {
    const raw = {
      calories: '200',
      protein: '20g',
      carbs: '30',
      fat: '10',
    };
    
    const result = normalizeNutritionData(raw);
    
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(20);
    expect(result.carbs).toBe(30);
    expect(result.fat).toBe(10);
  });

  it('should handle missing fields', () => {
    const raw = {};
    
    const result = normalizeNutritionData(raw);
    
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
  });

  it('should handle fiber field', () => {
    const raw = {
      calories: 200,
      protein: 20,
      carbs: 30,
      fat: 10,
      fiber: 5,
    };
    
    const result = normalizeNutritionData(raw);
    
    expect(result.fiber).toBe(5);
  });
});

describe('extractNutritionFromText', () => {
  it('should extract nutrition from text', () => {
    const text = 'Calories: 200, Protein: 20g, Carbs: 30g, Fat: 10g';
    
    const result = extractNutritionFromText(text);
    
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(20);
    expect(result.carbs).toBe(30);
    expect(result.fat).toBe(10);
  });

  it('should handle Indonesian keywords', () => {
    const text = 'Kalori: 200, Protein: 20g, Karbohidrat: 30g, Lemak: 10g';
    
    const result = extractNutritionFromText(text);
    
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(20);
    expect(result.carbs).toBe(30);
    expect(result.fat).toBe(10);
  });

  it('should handle ranges in text', () => {
    const text = 'Calories: 200-300 kcal';
    
    const result = extractNutritionFromText(text);
    
    expect(result.calories).toBe(250); // Midpoint
  });

  it('should return zeros for missing values', () => {
    const text = 'No nutrition info here';
    
    const result = extractNutritionFromText(text);
    
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
  });
});

describe('isNutritionEmpty', () => {
  it('should return true for empty nutrition', () => {
    const nutrition = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    
    expect(isNutritionEmpty(nutrition)).toBe(true);
  });

  it('should return false for non-empty nutrition', () => {
    const nutrition = {
      calories: 200,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    
    expect(isNutritionEmpty(nutrition)).toBe(false);
  });
});

describe('mergeNutrition', () => {
  it('should merge nutrition preferring primary', () => {
    const primary = {
      calories: 200,
      protein: 20,
      carbs: 30,
      fat: 10,
    };
    
    const fallback = {
      calories: 300,
      protein: 25,
      carbs: 35,
      fat: 15,
    };
    
    const result = mergeNutrition(primary, fallback);
    
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(20);
    expect(result.carbs).toBe(30);
    expect(result.fat).toBe(10);
  });

  it('should use fallback for zero values', () => {
    const primary = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    
    const fallback = {
      calories: 200,
      protein: 20,
      carbs: 30,
      fat: 10,
    };
    
    const result = mergeNutrition(primary, fallback);
    
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(20);
    expect(result.carbs).toBe(30);
    expect(result.fat).toBe(10);
  });

  it('should handle partial fallback', () => {
    const primary = {
      calories: 200,
      protein: 0,
      carbs: 30,
      fat: 0,
    };
    
    const fallback = {
      calories: 300,
      protein: 20,
      carbs: 35,
      fat: 10,
    };
    
    const result = mergeNutrition(primary, fallback);
    
    expect(result.calories).toBe(200); // From primary
    expect(result.protein).toBe(20); // From fallback
    expect(result.carbs).toBe(30); // From primary
    expect(result.fat).toBe(10); // From fallback
  });
});

