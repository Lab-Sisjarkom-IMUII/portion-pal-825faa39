// ✅ PortionPal Goal-Calculator (Stable Edge Function)
import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const safeEnv = (key: string, fallback = ""): string => {
  try {
    return Deno.env.get(key) || fallback;
  } catch {
    return fallback;
  }
};

/**
 * Validate required environment variables
 * Throws error if required vars are missing
 */
function validateRequiredEnv(): void {
  const required = {
    SUPABASE_URL: safeEnv("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: safeEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };

  const missing: string[] = [];
  if (!required.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!required.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    const errorMsg = `❌ Missing required environment variables: ${missing.join(", ")}\n` +
      `Please set these via Supabase Dashboard > Edge Functions > Secrets or CLI: supabase secrets set KEY=value`;
    console.error(errorMsg);
    // Don't throw here, but log error - will fail gracefully when used
  }
}

// Validate on module load
validateRequiredEnv();

// ====== CORS SETUP ======
// Handle multiple origins properly (browser only allows single value)
const ENV = safeEnv("ENV", "development");
const rawAllowed = safeEnv("ALLOWED_ORIGIN", "");
const allowedOrigins = rawAllowed ? rawAllowed.split(",").map((o) => o.trim()) : [];

const corsHeaders = (origin = "*") => {
  let allowed = "*";
  if (allowedOrigins.length > 0) {
    // If request origin is in allowed list, use it; otherwise use first allowed origin
    allowed = allowedOrigins.includes("*") || allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];
  } else {
    // No ALLOWED_ORIGIN provided
    if (ENV === "development") {
      allowed = "*";
    } else {
      // production: prefer echoing origin if present, otherwise block
      allowed = origin || "*";
    }
  }

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Content-Type": "application/json",
  } as const;
};

const supabase = createClient(
  safeEnv("SUPABASE_URL"),
  safeEnv("SUPABASE_SERVICE_ROLE_KEY")
);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "*";
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

  try {
    const body = await req.json().catch(() => ({}));

    // Accept either client form shape or explicit field names
    const schema = z.object({
      // client may send goal_type, activity, target_time etc. Accept both shapes
      age: z.number().optional(),
      height: z.number().optional(),
      weight: z.number().optional(),
      gender: z.string().optional(),
      activityLevel: z.string().optional(),
      activity: z.string().optional(),
      goal: z.string().optional(),
      goal_type: z.string().optional(),
      target_time: z.string().optional(),
      target_weight: z.number().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input format" }), {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    // Map incoming fields to expected variables
    const incoming = parsed.data;
    
    // Debug: Log raw incoming data first
    console.log("📥 Raw incoming data:", JSON.stringify(incoming, null, 2));
    
    const age = incoming.age ?? 25;
    const height = incoming.height ?? 170;
    const weight = incoming.weight ?? 70;
    const gender = (incoming.gender || 'male') as string;
    const activityLevel = (incoming.activityLevel || incoming.activity || 'moderate') as string;
    
    // IMPORTANT: Check both 'goal' and 'goal_type' fields
    // Frontend sends 'goal_type' with values 'lose_weight' or 'reduce_calories'
    const goalRaw = (incoming.goal || incoming.goal_type || 'maintain') as string;
    
    // IMPORTANT: Check both 'target_time' (from frontend) and 'targetTime' (camelCase variant)
    const targetTime = (incoming.target_time || incoming.targetTime || '') as string;
    
    // IMPORTANT: Check both 'target_weight' (from frontend) and 'targetWeight' (camelCase variant)
    const targetWeight = incoming.target_weight !== undefined ? incoming.target_weight : (incoming.targetWeight !== undefined ? incoming.targetWeight : undefined);
    
    // Debug logging
    console.log("📥 Parsed input data:", {
      age,
      height,
      weight,
      gender,
      activityLevel,
      goalRaw,
      targetTime,
      targetWeight,
      hasTargetTime: !!targetTime,
      hasTargetWeight: targetWeight !== undefined && targetWeight !== null,
      incomingKeys: Object.keys(incoming),
    });
    
    // normalize goal: accept values like 'lose_weight', 'lose', 'gain', 'maintain', 'reduce_calories'
    let goal = 'maintain';
    if (typeof goalRaw === 'string') {
      const g = goalRaw.toLowerCase();
      if (g.includes('lose') || g.includes('reduce')) goal = 'lose';
      else if (g.includes('gain')) goal = 'gain';
    }
    
    console.log(`🎯 Goal normalized: "${goalRaw}" -> "${goal}"`);
    
    /**
     * Parse target_time string to days
     * Examples: "1 bulan" -> 30, "3 bulan" -> 90, "1 tahun" -> 365
     */
    function parseTargetTimeToDays(targetTimeStr: string): number {
      if (!targetTimeStr || targetTimeStr.trim() === '') {
        console.log("⚠️ Target time is empty");
        return 0;
      }
      
      const cleaned = targetTimeStr.trim().toLowerCase();
      console.log("🔍 Parsing target time:", cleaned);
      
      // Extract number
      const numberMatch = cleaned.match(/^\d+/);
      if (!numberMatch) {
        console.log("⚠️ No number found in target time");
        return 0;
      }
      const number = parseInt(numberMatch[0]);
      
      // Extract unit
      let days = 0;
      if (cleaned.includes('tahun') || cleaned.includes('year') || cleaned.includes('y')) {
        days = number * 365;
      } else if (cleaned.includes('bulan') || cleaned.includes('month') || cleaned.includes('m')) {
        days = number * 30;
      } else if (cleaned.includes('minggu') || cleaned.includes('week') || cleaned.includes('w')) {
        days = number * 7;
      } else if (cleaned.includes('hari') || cleaned.includes('day') || cleaned.includes('h')) {
        days = number;
      } else {
        // If no unit specified, assume months (backward compatibility)
        days = number * 30;
      }
      
      console.log(`✅ Parsed "${targetTimeStr}" -> ${days} days`);
      return days;
    }

    if ([age, height, weight].some((v) => v <= 0 || isNaN(v))) {
      return new Response(JSON.stringify({ error: "Invalid numeric input" }), {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    const bmr =
      gender === "male"
        ? 88.36 + 13.4 * weight + 4.8 * height - 5.7 * age
        : 447.6 + 9.2 * weight + 3.1 * height - 4.3 * age;

    const activityMap = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };

    const tdee = bmr * (activityMap[activityLevel as keyof typeof activityMap] || 1.2);

    // Calculate goal calories based on target weight and target time
    let goalCalories = tdee;
    let calorieAdjustment = 0;
    
    console.log(`🔍 Checking conditions: goal="${goal}", targetWeight=${targetWeight}, weight=${weight}, targetTime="${targetTime}"`);
    console.log(`🔍 Condition check: goal === "lose" = ${goal === "lose"}, targetWeight exists = ${!!targetWeight}, targetWeight < weight = ${targetWeight ? targetWeight < weight : false}`);
    
    if (goal === "lose" && targetWeight && targetWeight < weight) {
      // Calculate weight to lose
      const weightToLose = weight - targetWeight; // in kg
      console.log(`🎯 Weight loss goal: ${weight}kg -> ${targetWeight}kg (${weightToLose}kg to lose)`);
      
      // Calculate total calorie deficit needed (1 kg fat = ~7700 calories)
      const totalDeficitNeeded = weightToLose * 7700;
      console.log(`📊 Total deficit needed: ${totalDeficitNeeded} calories`);
      
      // Parse target time to days
      const targetDays = parseTargetTimeToDays(targetTime);
      console.log(`📅 Target time: "${targetTime}" = ${targetDays} days`);
      
      if (targetDays > 0) {
        // Calculate daily deficit needed
        const dailyDeficitNeeded = totalDeficitNeeded / targetDays;
        console.log(`📊 Daily deficit needed: ${dailyDeficitNeeded.toFixed(2)} calories/day`);
        
        // Limit to safe maximum deficit (max 1000 calories/day for safety)
        // Minimum safe deficit is 300 calories/day
        const maxSafeDeficit = 1000;
        const minSafeDeficit = 300;
        calorieAdjustment = Math.max(minSafeDeficit, Math.min(maxSafeDeficit, Math.round(dailyDeficitNeeded)));
        
        goalCalories = tdee - calorieAdjustment;
        
        console.log(`✅ Final calculation: TDEE ${tdee.toFixed(0)} - ${calorieAdjustment} deficit = ${goalCalories.toFixed(0)} cal/day`);
        console.log(`📊 Weight loss calculation: ${weightToLose}kg in ${targetDays} days = ${calorieAdjustment} cal/day deficit`);
      } else {
        // Fallback to default 300 calorie deficit if no target time
        console.log("⚠️ No target time provided, using default 300 cal/day deficit");
        calorieAdjustment = 300;
        goalCalories = tdee - calorieAdjustment;
      }
    } else if (goal === "gain" && targetWeight && targetWeight > weight) {
      // Calculate weight to gain
      const weightToGain = targetWeight - weight; // in kg
      
      // Calculate total calorie surplus needed (1 kg muscle = ~5500 calories, but we use 7700 for safety)
      const totalSurplusNeeded = weightToGain * 7700;
      
      // Parse target time to days
      const targetDays = parseTargetTimeToDays(targetTime);
      
      if (targetDays > 0) {
        // Calculate daily surplus needed
        const dailySurplusNeeded = totalSurplusNeeded / targetDays;
        
        // Limit to safe maximum surplus (max 1000 calories/day for safety)
        // Minimum safe surplus is 300 calories/day
        const maxSafeSurplus = 1000;
        const minSafeSurplus = 300;
        calorieAdjustment = Math.max(minSafeSurplus, Math.min(maxSafeSurplus, Math.round(dailySurplusNeeded)));
        
        goalCalories = tdee + calorieAdjustment;
        
        console.log(`📊 Weight gain calculation: ${weightToGain}kg in ${targetDays} days = ${calorieAdjustment} cal/day surplus`);
      } else {
        // Fallback to default 300 calorie surplus if no target time
        calorieAdjustment = 300;
        goalCalories = tdee + calorieAdjustment;
      }
    } else if (goal === "lose") {
      // Default deficit for lose weight without specific target
      calorieAdjustment = 300;
      goalCalories = tdee - calorieAdjustment;
    } else if (goal === "gain") {
      // Default surplus for gain weight without specific target
      calorieAdjustment = 300;
      goalCalories = tdee + calorieAdjustment;
    }
    
    // Ensure goal calories is not below BMR (minimum safe calories)
    const minCalories = bmr * 0.8; // 80% of BMR as absolute minimum
    goalCalories = Math.max(minCalories, goalCalories);

    // Calculate macronutrients
    const calories = Math.round(goalCalories);
    const proteinGrams = Math.round(weight * 1.8);
    const carbsGrams = Math.round((goalCalories * 0.5) / 4);
    const fatGrams = Math.round((goalCalories * 0.25) / 9);
    
    // Calculate percentages
    const proteinCalories = proteinGrams * 4;
    const carbsCalories = carbsGrams * 4;
    const fatCalories = fatGrams * 9;
    const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;
    
    const proteinPercent = totalMacroCalories > 0 ? Math.round((proteinCalories / totalMacroCalories) * 100) : 0;
    const carbsPercent = totalMacroCalories > 0 ? Math.round((carbsCalories / totalMacroCalories) * 100) : 0;
    const fatPercent = totalMacroCalories > 0 ? Math.round((fatCalories / totalMacroCalories) * 100) : 0;

    // Generate suggestion based on goal, target time, and calorie adjustment
    let suggestion = "Pertahankan pola makan seimbang dengan mengonsumsi makanan bergizi.";
    if (goal === "lose") {
      if (targetWeight && targetTime) {
        const weightToLose = weight - targetWeight;
        const targetDays = parseTargetTimeToDays(targetTime);
        const weeklyLoss = (weightToLose / (targetDays / 7)).toFixed(1);
        
        if (calorieAdjustment > 800) {
          suggestion = `Target menurunkan ${weightToLose}kg dalam ${targetTime} membutuhkan defisit ${calorieAdjustment} kalori/hari (${weeklyLoss}kg/minggu). Ini adalah target yang cukup agresif. Pastikan untuk: 1) Konsumsi protein tinggi (minimal ${Math.round(weight * 2)}g/hari) untuk menjaga massa otot, 2) Olahraga rutin untuk mempertahankan metabolisme, 3) Monitor kesehatan secara berkala. Jika merasa terlalu sulit, pertimbangkan memperpanjang target waktu.`;
        } else if (calorieAdjustment > 500) {
          suggestion = `Target menurunkan ${weightToLose}kg dalam ${targetTime} membutuhkan defisit ${calorieAdjustment} kalori/hari (${weeklyLoss}kg/minggu). Fokus pada: 1) Konsumsi protein tinggi (${Math.round(weight * 1.8)}g/hari) untuk menjaga massa otot, 2) Perbanyak sayuran dan serat untuk kenyang lebih lama, 3) Olahraga 3-4x/minggu untuk membakar kalori ekstra.`;
        } else {
          suggestion = `Target menurunkan ${weightToLose}kg dalam ${targetTime} membutuhkan defisit ${calorieAdjustment} kalori/hari (${weeklyLoss}kg/minggu). Ini adalah target yang sehat dan berkelanjutan. Fokus pada: 1) Konsumsi protein tinggi untuk menjaga massa otot, 2) Perbanyak sayuran dan serat, 3) Olahraga rutin untuk hasil optimal.`;
        }
      } else {
        suggestion = "Fokus pada defisit kalori yang sehat. Konsumsi lebih banyak protein untuk menjaga massa otot dan perbanyak sayuran untuk meningkatkan rasa kenyang.";
      }
    } else if (goal === "gain") {
      if (targetWeight && targetTime) {
        const weightToGain = targetWeight - weight;
        const targetDays = parseTargetTimeToDays(targetTime);
        const weeklyGain = (weightToGain / (targetDays / 7)).toFixed(1);
        
        suggestion = `Target menambah ${weightToGain}kg dalam ${targetTime} membutuhkan surplus ${calorieAdjustment} kalori/hari (${weeklyGain}kg/minggu). Fokus pada: 1) Konsumsi protein tinggi (${Math.round(weight * 2)}g/hari) untuk membangun otot, 2) Karbohidrat kompleks untuk energi, 3) Latihan beban 3-4x/minggu untuk mengkonversi kalori menjadi otot, bukan lemak.`;
      } else {
        suggestion = "Tingkatkan asupan kalori secara bertahap dengan fokus pada makanan padat nutrisi. Kombinasikan karbohidrat kompleks dengan protein berkualitas tinggi.";
      }
    }

    // Format response according to GoalCalculatorResponse interface
    const result = {
      calories,
      protein: proteinGrams,
      carbs: carbsGrams,
      fat: fatGrams,
      ai_result: {
        daily_calories: calories,
        carbs_percent: carbsPercent,
        protein_percent: proteinPercent,
        fat_percent: fatPercent,
        carbs_grams: carbsGrams,
        protein_grams: proteinGrams,
        fat_grams: fatGrams,
        suggestion,
      },
      aiMode: 'local-fallback' as const, // Using local calculation, not OpenAI
    };

    return new Response(JSON.stringify(result), { headers: corsHeaders(origin) });
  } catch (err) {
    console.error("Unexpected error in goal-calculator:", err);
    return new Response(JSON.stringify({ error: "Server error", details: String(err) }), {
      status: 500,
      headers: corsHeaders(origin),
    });
  }
});
