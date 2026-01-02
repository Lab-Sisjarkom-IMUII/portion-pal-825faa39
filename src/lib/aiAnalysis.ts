import { supabase } from "@/integrations/supabase/client";
import { logError, logPerformance, logWarning, logInfo } from "@/lib/errorLogger";
import { compressImage } from "@/lib/imageCompression";
import { trackEdgeFunction } from "@/lib/performanceMonitor";
import { getGoalCalories } from "@/lib/goalCalculator";
import { getEnv } from "@/lib/env";
import { retryFetch, RetryPresets } from "@/lib/retry";
import { normalizeNutritionData, parseNumber } from "@/lib/mealNormalization";
import type { Database } from "@/integrations/supabase/types";
import type {
  NutritionAIResponse,
  WrappedNutritionAIResponse,
  SupabaseStorageClient,
  SupabaseFunctionsClient,
  SupabaseInsertResponse,
} from "@/types/api";

export interface PortionBreakdown {
  carbs_percentage: number;
  protein_percentage: number;
  vegetables_percentage: number;
}

export interface FoodInsight {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  suggestion: string;
  portion_breakdown?: PortionBreakdown;
  confidence_score?: number;
  aiMode?: string;
  timestamp?: string;
  health_score?: number;
  image_url?: string | null;
  goal_match?: string;
  deviation_percent?: string;
}

/**
 * Analyze food image using OpenAI API with vision capabilities
 * This function sends the image to a secure edge function that calls OpenAI API
 * 
 * SECURITY: OpenAI API key is stored in Supabase Secrets (backend), 
 * NOT in client-side environment variables
 * 
 * @param file - Image file to analyze
 * @returns Nutrition analysis and suggestions from OpenAI
 */
export async function analyzeFoodImage(file: File): Promise<FoodInsight> {
  const startTime = performance.now();
  console.log('[aiAnalysis] analyzeFoodImage called', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  });
  
  if (import.meta.env.DEV) {
    logInfo("Analyzing food image with OpenAI Vision", {
      source: 'aiAnalysis',
      additionalContext: { fileName: file.name },
    });
  }

  try {
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log('[aiAnalysis] Session check', {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
    });
    
    if (!session) {
      console.error('[aiAnalysis] No session found');
      throw new Error('User must be logged in to analyze food images');
    }

    // Compress image before processing (reduces payload size and improves performance)
    if (import.meta.env.DEV) {
      logInfo("Memulai analisis gambar", { source: 'aiAnalysis' });
    }
    let processedFile = file;
    try {
      const compressionResult = await compressImage(file, {
        maxSizeMB: 1, // Compress to max 1MB
        maxWidthOrHeight: 1920, // Max dimension 1920px
        quality: 0.8, // 80% quality
      });
      processedFile = compressionResult.file;
      if (import.meta.env.DEV) {
        const originalMB = (compressionResult.originalSize / (1024 * 1024)).toFixed(2);
        const compressedMB = (compressionResult.compressedSize / (1024 * 1024)).toFixed(2);
        const ratio = (compressionResult.compressionRatio * 100).toFixed(1);
        logInfo(`Image compressed: ${originalMB}MB → ${compressedMB}MB (${ratio}% of original)`, {
          source: 'aiAnalysis',
          additionalContext: {
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
            ratio: compressionResult.compressionRatio,
          },
        });
      }
    } catch (compressionError) {
      // If compression fails, use original file
      await logWarning(
        'Image compression failed, using original file',
        {
          source: 'aiAnalysis',
          additionalContext: { error: compressionError },
        }
      );
      processedFile = file;
    }

    // Convert image to base64 (used as fallback for OpenAI Vision API)
    // CRITICAL: Base64 is required for OpenAI Vision API to work reliably
    let base64: string;
    console.log('[aiAnalysis] Starting base64 conversion', {
      fileName: processedFile.name,
      fileSize: processedFile.size,
      fileType: processedFile.type,
    });
    try {
      base64 = await fileToBase64(processedFile); // This returns data:image/...;base64,<data>
      console.log('[aiAnalysis] Base64 conversion completed', {
        hasBase64: !!base64,
        base64Length: base64?.length || 0,
        startsWithDataImage: base64?.startsWith('data:image/') || false,
        preview: base64?.substring(0, 50) + '...',
      });
      
      // Validate base64 format
      if (!base64 || !base64.startsWith('data:image/')) {
        console.error('[aiAnalysis] Invalid base64 format: missing data URL prefix', {
          hasBase64: !!base64,
          base64Length: base64?.length || 0,
          preview: base64?.substring(0, 50),
        });
        throw new Error('Invalid base64 format: missing data URL prefix');
      }
      // Validate base64 content (should have base64, prefix)
      const base64Match = base64.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!base64Match || !base64Match[1] || base64Match[1].length < 100) {
        console.error('[aiAnalysis] Invalid base64 content: too short or malformed', {
          hasMatch: !!base64Match,
          base64DataLength: base64Match?.[1]?.length || 0,
        });
        throw new Error('Invalid base64 content: too short or malformed');
      }
      
      console.log('[aiAnalysis] Base64 validation passed', {
        base64Length: base64.length,
        base64DataLength: base64Match[1].length,
        contentType: base64Match[1] ? base64.substring(5, base64.indexOf(';')) : 'unknown',
      });
      
      await logInfo("Base64 conversion successful", {
        source: 'aiAnalysis',
        additionalContext: {
          base64Length: base64.length,
          base64Preview: base64.substring(0, 50) + '...',
        },
      });
    } catch (base64Error) {
      console.error('[aiAnalysis] Base64 conversion failed', {
        error: base64Error instanceof Error ? base64Error.message : String(base64Error),
        stack: base64Error instanceof Error ? base64Error.stack : undefined,
        fileName: processedFile.name,
        fileSize: processedFile.size,
        fileType: processedFile.type,
      });
      await logError(
        base64Error instanceof Error ? base64Error : new Error(String(base64Error)),
        {
          source: 'aiAnalysis',
          severity: 'high',
          additionalContext: {
            action: 'fileToBase64',
            fileName: processedFile.name,
            fileSize: processedFile.size,
            fileType: processedFile.type,
          },
        }
      );
      throw new Error(`Failed to convert image to base64: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
    }
    // Keep full data URL format for OpenAI Vision API compatibility

    // Try uploading image to Supabase Storage for smaller DB footprint
    let imagePublicUrl: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'anonymous';
      const safeFileName = processedFile.name.replace(/[^a-zA-Z0-9-_.]/g, '_');
      const filename = `${userId}/${Date.now()}-${safeFileName}`;
      const bucket = 'user-images';
      // attempt upload (use compressed file)
      const uploadRes = await supabase.storage.from(bucket).upload(filename, processedFile, { upsert: false });
      if (uploadRes.error) {
        await logWarning(
          'Upload ke storage gagal',
          {
            source: 'aiAnalysis',
            additionalContext: {
              error: uploadRes.error.message,
              filename,
              bucket,
            },
          }
        );
      } else {
        // If storage is private, create signed URL
        // Use validated env vars
        const env = getEnv();
        const isPrivate = env.VITE_PRIVATE_STORAGE === 'true' || false;
        const storageClient = supabase.storage as unknown as SupabaseStorageClient;
        if (isPrivate && storageClient?.from(bucket).createSignedUrl) {
          try {
            const signed = await storageClient.from(bucket).createSignedUrl(filename, 60 * 60); // 1 hour
            if (signed?.data?.signedUrl) imagePublicUrl = signed.data.signedUrl;
          } catch (e) {
            await logWarning(
              'createSignedUrl failed',
              {
                source: 'aiAnalysis',
                additionalContext: { error: e, filename, bucket },
              }
            );
          }
        }

        if (!imagePublicUrl) {
          const pub = supabase.storage.from(bucket).getPublicUrl(filename);
          if (pub?.data?.publicUrl) imagePublicUrl = pub.data.publicUrl;
        }
      }
    } catch (e) {
      await logWarning(
        'Upload fallback failed',
        {
          source: 'aiAnalysis',
          additionalContext: { error: e },
        }
      );
    }

    // Resolve function URL: prefer SDK invoke. If not available, build REST URL from project id.
    const functionsClient = supabase.functions as unknown as SupabaseFunctionsClient;
    const functionUrlFromClient = typeof functionsClient?.url === 'function'
      ? functionsClient.url('nutrition-ai')
      : null;

    // Build REST endpoint properly: prefer PROJECT_ID so we get the functions domain
    // Use validated env vars from env utility
    const env = getEnv();
    const projectId = env.VITE_SUPABASE_PROJECT_ID;
    let nutritionUrl: string | null = null;
    if (functionUrlFromClient) {
      nutritionUrl = functionUrlFromClient;
    } else if (projectId) {
      nutritionUrl = `https://${projectId}.functions.supabase.co/functions/v1/nutrition-ai`;
    } else if (env.VITE_SUPABASE_URL) {
      // fallback: convert <project>.supabase.co -> <project>.functions.supabase.co
      nutritionUrl = env.VITE_SUPABASE_URL.replace(/\.supabase\.co\/?$/, '.functions.supabase.co') + '/functions/v1/nutrition-ai';
    }
    if (import.meta.env.DEV) {
      logInfo("Resolved nutrition URL", {
        source: 'aiAnalysis',
        additionalContext: {
          functionUrlFromClient,
          nutritionUrl,
        },
      });
    }
  const description = ((file.name || 'makanan tidak diketahui').split('.')?.[0] || '').replace(/[-_]/g, ' ') || 'makanan tidak diketahui';
  
  // ALWAYS use base64 data URL for OpenAI Vision API (more reliable than public URLs)
  // OpenAI may not be able to access Supabase Storage URLs due to CORS/auth restrictions
  // Base64 is embedded in the request, so it's always accessible
  // CRITICAL: Base64 is required - if not available, throw error
  if (!base64 || !base64.startsWith('data:image/')) {
    const errorMsg = 'Base64 image is required but not available';
    await logError(new Error(errorMsg), {
      source: 'aiAnalysis',
      severity: 'high',
      additionalContext: {
        hasBase64: !!base64,
        base64Length: base64?.length || 0,
        hasPublicUrl: !!imagePublicUrl,
      },
    });
    throw new Error(errorMsg);
  }
  
  // Always use base64 - never use public URL for OpenAI Vision API
  const imageUrl = base64;
  
  console.log('[aiAnalysis] Preparing to send to Edge Function', {
    hasBase64: !!base64,
    base64Length: base64.length,
    hasPublicUrl: !!imagePublicUrl,
    imageUrlLength: imageUrl.length,
    description,
  });
  
  // Log which type we're sending (always log, not just in DEV)
  await logInfo("Image URL type", {
    source: 'aiAnalysis',
    additionalContext: {
      hasBase64: !!base64,
      base64Length: base64.length,
      hasPublicUrl: !!imagePublicUrl,
      usingBase64: true, // Always true now
      finalImageUrlType: 'base64',
    },
  });
  
  await logInfo("Mengirim data ke AI", {
    source: 'aiAnalysis',
    additionalContext: {
      description,
      imageType: 'base64',
      imageUrlLength: imageUrl.length,
      imageUrlPreview: imageUrl.substring(0, 50) + '...',
    },
  });
    
    // Try using Supabase SDK invoke first (handles auth automatically)
    // BUT: Skip SDK invoke for base64 images as it may not send body correctly
    // SDK invoke has issues with base64 data URLs, so always use direct fetch for base64 images
    let data: unknown | null = null;
    
    // Check if imageUrl is base64 (data URL)
    const isBase64Image = imageUrl && imageUrl.startsWith('data:image/');
    
    // Prefer SDK invoke ONLY if:
    // 1. SDK invoke is available
    // 2. AND imageUrl is NOT base64 (e.g., public URL or no image)
    // For base64 images, always use direct fetch to ensure body is sent correctly
    if (typeof functionsClient?.invoke === 'function' && !isBase64Image) {
      if (import.meta.env.DEV) {
        logInfo("Using Supabase SDK invoke method", {
          source: 'aiAnalysis',
        });
      }
      
      try {
        // Ensure body is properly formatted
        const requestBody = { description, imageUrl };
        
        console.log('[aiAnalysis] Sending to nutrition-ai via SDK', {
          hasImageUrl: !!imageUrl,
          imageUrlType: imageUrl ? (imageUrl.startsWith('data:image/') ? 'base64' : 'url') : 'none',
          imageUrlLength: imageUrl?.length || 0,
          description,
          bodyKeys: Object.keys(requestBody),
          bodyStringLength: JSON.stringify(requestBody).length,
        });
        
        // Log what we're sending (always log, not just in DEV)
        await logInfo("Sending to nutrition-ai via SDK", {
          source: 'aiAnalysis',
          additionalContext: {
            hasImageUrl: !!imageUrl,
            imageUrlType: imageUrl ? (imageUrl.startsWith('data:image/') ? 'base64' : 'url') : 'none',
            imageUrlLength: imageUrl?.length || 0,
            description,
            bodyKeys: imageUrl ? ['description', 'imageUrl'] : ['description'],
          },
        });
        
        await logInfo("Request body prepared", {
          source: 'aiAnalysis',
          additionalContext: {
            hasDescription: !!requestBody.description,
            hasImageUrl: !!requestBody.imageUrl,
            imageUrlType: requestBody.imageUrl ? typeof requestBody.imageUrl : 'undefined',
            imageUrlLength: requestBody.imageUrl?.length || 0,
            bodyStringLength: JSON.stringify(requestBody).length,
          },
        });
        
        console.log('[aiAnalysis] Calling functionsClient.invoke', {
          functionName: 'nutrition-ai',
          hasBody: !!requestBody,
          bodyKeys: Object.keys(requestBody),
        });
        
        const { data: invokeData, error: invokeError } = await functionsClient.invoke('nutrition-ai', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: requestBody,
        });
        
        console.log('[aiAnalysis] SDK invoke response', {
          hasData: !!invokeData,
          hasError: !!invokeError,
          error: invokeError ? JSON.stringify(invokeError) : null,
        });
        
        if (invokeError) {
          throw new Error(`SDK invoke error: ${JSON.stringify(invokeError)}`);
        }
        
        data = invokeData;
        
        if (import.meta.env.DEV) {
          logInfo("nutrition-ai response from SDK", {
            source: 'aiAnalysis',
            additionalContext: {
              hasData: !!data,
              dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
            },
          });
        }
      } catch (invokeErr) {
        await logWarning('SDK invoke failed, falling back to direct fetch', {
          source: 'aiAnalysis',
          additionalContext: { error: invokeErr },
        });
        // Fall through to direct fetch
      }
    } else {
      // Skip SDK invoke for base64 images or if SDK invoke not available - use direct fetch
      console.log('[aiAnalysis] Skipping SDK invoke', {
        reason: isBase64Image ? 'base64 image - SDK invoke unreliable' : 'SDK invoke not available',
        isBase64Image,
        hasImageUrl: !!imageUrl,
      });
      await logInfo("Skipping SDK invoke - using direct fetch", {
        source: 'aiAnalysis',
        additionalContext: {
          reason: isBase64Image ? 'base64 image - SDK invoke unreliable' : 'SDK invoke not available',
          isBase64Image,
          hasImageUrl: !!imageUrl,
        },
      });
    }
    
    // Fallback to direct REST fetch if SDK invoke not available or failed
    if (!data) {
      // Refresh session to ensure we have a valid token
      const { data: { session: refreshedSession }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError) {
        await logWarning('Failed to refresh session, using existing session', {
          source: 'aiAnalysis',
          additionalContext: { error: sessionError },
        });
      }
      
      // Use refreshed session if available, otherwise use original session
      const activeSession = refreshedSession || session;
      
      if (!activeSession || !activeSession.access_token) {
        throw new Error('No valid session token available for authentication');
      }
      
      if (import.meta.env.DEV) {
        logInfo("Session token ready for direct fetch", {
          source: 'aiAnalysis',
          additionalContext: {
            hasToken: !!activeSession.access_token,
            tokenLength: activeSession.access_token?.length || 0,
            tokenPreview: activeSession.access_token?.substring(0, 20) + '...',
          },
        });
      }
      
      try {
        // Use direct REST fetch to avoid SDK runtime differences in browser builds
        if (!nutritionUrl) throw new Error('No function URL available to call nutrition-ai');
        
        // Ensure body is properly formatted
        const requestBody = { description, imageUrl };
        
        console.log('[aiAnalysis] Sending to nutrition-ai via direct fetch', {
          hasImageUrl: !!imageUrl,
          imageUrlType: imageUrl ? (imageUrl.startsWith('data:image/') ? 'base64' : 'url') : 'none',
          imageUrlLength: imageUrl?.length || 0,
          description,
          bodyKeys: Object.keys(requestBody),
        });
        
        // Log what we're sending (always log, not just in DEV)
        await logInfo("Sending to nutrition-ai via direct fetch", {
          source: 'aiAnalysis',
          additionalContext: {
            hasImageUrl: !!imageUrl,
            imageUrlType: imageUrl ? (imageUrl.startsWith('data:image/') ? 'base64' : 'url') : 'none',
            imageUrlLength: imageUrl?.length || 0,
            description,
            bodyKeys: imageUrl ? ['description', 'imageUrl'] : ['description'],
            bodyStringLength: JSON.stringify(requestBody).length,
          },
        });
        
        // Use retry mechanism for fetch call with performance tracking
        const bodyString = JSON.stringify(requestBody);
        
        console.log('[aiAnalysis] Request body stringified', {
          bodyStringLength: bodyString.length,
          bodyStringPreview: bodyString.substring(0, 200) + '...',
          hasImageUrl: bodyString.includes('imageUrl'),
        });
        
        await logInfo("Request body stringified", {
          source: 'aiAnalysis',
          additionalContext: {
            bodyStringLength: bodyString.length,
            bodyStringPreview: bodyString.substring(0, 200) + '...',
          },
        });
        
        const res = await trackEdgeFunction(
          'nutrition-ai',
          () => retryFetch(
            nutritionUrl!,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${activeSession.access_token}`,
                apikey: env.VITE_SUPABASE_ANON_KEY, // Required by Supabase Edge Functions
                'Content-Type': 'application/json',
              },
              body: bodyString,
            },
          {
            ...RetryPresets.standard,
            errorMessagePrefix: 'Failed to call nutrition-ai',
            isRetryableResponse: (response) => {
              // Retry on server errors (5xx) and rate limits (429)
              return response.status >= 500 || response.status === 429;
            },
          }
        ),
        {
          hasImage: !!imageUrl,
          imageType: imagePublicUrl ? 'public_url' : 'base64',
          description: description.substring(0, 50), // Truncate for logging
        }
      );
      
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`nutrition-ai fetch failed: ${res.status} ${text}`);
      }
      const responseText = await res.text();
      if (import.meta.env.DEV) {
        logInfo("nutrition-ai raw response", {
          source: 'aiAnalysis',
          additionalContext: { 
            status: res.status,
            responseLength: responseText.length,
            responsePreview: responseText.substring(0, 200),
          },
        });
      }
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        await logError(new Error(`Failed to parse nutrition-ai response: ${parseError}`), {
          source: 'aiAnalysis',
          severity: 'high',
          additionalContext: {
            responseText: responseText.substring(0, 500),
            status: res.status,
          },
        });
        throw new Error(`Invalid JSON response from nutrition-ai: ${responseText.substring(0, 100)}`);
      }
      
      if (import.meta.env.DEV) {
        logInfo("nutrition-ai response parsed", {
          source: 'aiAnalysis',
          additionalContext: { 
            hasData: !!data,
            dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
            dataPreview: JSON.stringify(data).substring(0, 300),
          },
        });
      }
      
      // Check if response has error
      if (data && typeof data === 'object' && 'error' in data) {
        const errorMessage = (data as { error?: string }).error || 'Unknown error from nutrition-ai';
        await logError(new Error(errorMessage), {
          source: 'aiAnalysis',
          severity: 'high',
          additionalContext: {
            responseData: data,
          },
        });
        throw new Error(errorMessage);
      }
      } catch (fetchErr) {
        await logError(fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr)), {
          source: 'aiAnalysis',
          severity: 'high',
          additionalContext: {
            action: 'call_nutrition_ai_direct_fetch',
            nutritionUrl,
          },
        });
        throw fetchErr; // bubble up to outer catch for fallback handling
      }
    }
    
    // If we still don't have data, something went wrong
    if (!data) {
      throw new Error('Failed to get response from nutrition-ai Edge Function');
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    await logPerformance('ai_analysis_total', totalTime, {
      source: 'aiAnalysis',
      unit: 'ms',
      additionalContext: {
        hasImage: !!imageUrl,
        imageType: imagePublicUrl ? 'public_url' : 'base64',
      },
    });
    if (import.meta.env.DEV) {
      logInfo(`OpenAI analysis complete in ${(totalTime / 1000).toFixed(2)}s`, {
        source: 'aiAnalysis',
        additionalContext: { duration: totalTime },
      });
    }

    // Support both wrapped and direct result shapes
    // Edge Function now returns: { calories, protein, carbs, fat, food_name, suggestion, aiMode, confidence_score }
    const wrappedResponse = data as WrappedNutritionAIResponse;
    const rawCandidate: NutritionAIResponse = wrappedResponse?.ai_result || (data as NutritionAIResponse);
    
    if (import.meta.env.DEV) {
      logInfo("Parsing AI response", {
        source: 'aiAnalysis',
        additionalContext: {
          hasWrappedResponse: !!wrappedResponse?.ai_result,
          rawCandidateKeys: rawCandidate && typeof rawCandidate === 'object' ? Object.keys(rawCandidate) : [],
          rawCandidatePreview: JSON.stringify(rawCandidate).substring(0, 500),
        },
      });
    }
    
    if (!rawCandidate || typeof rawCandidate !== 'object') {
      await logError(new Error('Invalid AI response: expected object'), {
        source: 'aiAnalysis',
        severity: 'high',
        additionalContext: {
          dataType: typeof data,
          dataPreview: JSON.stringify(data).substring(0, 500),
        },
      });
      throw new Error('Invalid AI response: expected object');
    }
    const raw = rawCandidate;

    // Use centralized normalization utility
    const nutritionData = normalizeNutritionData(raw);
    
    if (import.meta.env.DEV) {
      logInfo("Nutrition data normalized", {
        source: 'aiAnalysis',
        additionalContext: {
          calories: nutritionData.calories,
          protein: nutritionData.protein,
          carbs: nutritionData.carbs,
          fat: nutritionData.fat,
          fiber: nutritionData.fiber,
          isEmpty: nutritionData.calories === 0 && nutritionData.protein === 0 && nutritionData.carbs === 0 && nutritionData.fat === 0,
        },
      });
    }
    
    // Check if normalization resulted in all zeros - this indicates a problem
    if (nutritionData.calories === 0 && nutritionData.protein === 0 && nutritionData.carbs === 0 && nutritionData.fat === 0) {
      await logWarning('Normalized nutrition data is all zeros - AI response may be invalid', {
        source: 'aiAnalysis',
        additionalContext: {
          rawData: raw,
          normalizedData: nutritionData,
        },
      });
    }

    // Edge Function now includes food_name, suggestion, aiMode, confidence_score in response
    const normalized: FoodInsight = {
      food_name: String(
        (data as { food_name?: string })?.food_name ?? 
        raw.food_name ?? 
        raw.nama_makanan ?? 
        raw.makanan ?? 
        'Makanan Terdeteksi'
      ),
      calories: nutritionData.calories,
      protein: nutritionData.protein,
      carbs: nutritionData.carbs,
      fat: nutritionData.fat,
      fiber: nutritionData.fiber ?? 0,
      suggestion: String(
        (data as { suggestion?: string })?.suggestion ??
        raw.suggestion ?? 
        raw.advice ?? 
        raw.saran ?? 
        'Tetap jaga porsi seimbang antara protein, karbohidrat, lemak, dan serat.'
      ),
      portion_breakdown: raw.portion_breakdown ? {
        carbs_percentage: raw.portion_breakdown.carbs_percentage ?? 0,
        protein_percentage: raw.portion_breakdown.protein_percentage ?? 0,
        vegetables_percentage: raw.portion_breakdown.vegetables_percentage ?? 0,
      } : undefined,
      confidence_score: parseNumber(
        (data as { confidence_score?: number | string })?.confidence_score ??
        raw.confidence_score
      ),
      aiMode: String(
        (data as { aiMode?: string })?.aiMode ??
        wrappedResponse?.aiMode ?? 
        raw.aiMode ?? 
        'openai-vision'
      ),
      timestamp: new Date().toISOString(),
      image_url: imagePublicUrl ?? base64,
    };

    if (import.meta.env.DEV) {
      logInfo("Hasil normalisasi nutrisi", {
        source: 'aiAnalysis',
        additionalContext: {
          foodName: normalized.food_name,
          calories: normalized.calories,
          hasPortionBreakdown: !!normalized.portion_breakdown,
        },
      });
    }

    // Compute health_score (0-10) based on macro ratios and calories
    const totalMacros = Math.max(1, normalized.protein + normalized.carbs + normalized.fat);
    const proteinRatio = normalized.protein / totalMacros;
    const fatRatio = normalized.fat / totalMacros;
    const carbRatio = normalized.carbs / totalMacros;
    let healthScore100 = 100;
    if (proteinRatio < 0.2) healthScore100 -= 15;
    if (fatRatio > 0.4) healthScore100 -= 10;
    if (carbRatio > 0.55) healthScore100 -= 10;
    if (normalized.calories > 700) healthScore100 -= 10;
    healthScore100 = Math.max(0, Math.min(100, healthScore100));
    const macroKeys: Array<keyof Pick<FoodInsight, 'calories' | 'carbs' | 'protein' | 'fat'>> = ['calories','carbs','protein','fat'];
    const confidence = Math.round((macroKeys.filter(k => normalized[k] > 0).length / 4) * 100);
    normalized.health_score = Number((healthScore100 / 10).toFixed(1));
    normalized.confidence_score = confidence;

    // Integrate goal comparison if available
    // Use static import to avoid dynamic import issues in production builds
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          // Use static import (already imported at top of file)
          // This avoids dynamic import errors in production builds
          const goal = await getGoalCalories(user.id);
          if (goal?.daily_target && goal.daily_target > 0) {
            const deviation = ((normalized.calories - goal.daily_target) / goal.daily_target) * 100;
            let goalStatus = 'Seimbang';
            if (deviation > 15) goalStatus = 'Terlalu tinggi';
            if (deviation < -15) goalStatus = 'Terlalu rendah';
            normalized.goal_match = goalStatus;
            normalized.deviation_percent = deviation.toFixed(1);
            if (import.meta.env.DEV) {
              logInfo("Perbandingan dengan goal", {
                source: 'aiAnalysis',
                additionalContext: {
                  goalMatch: normalized.goal_match,
                  deviationPercent: normalized.deviation_percent,
                },
              });
            }
          }
        } catch (goalError) {
          // Silently skip goal comparison if it fails - this is a non-critical feature
          // Log only in dev mode
          if (import.meta.env.DEV) {
            console.warn('[aiAnalysis] Goal comparison failed, skipping', goalError);
          }
        }
      }
    } catch (e) {
      // Silently skip goal comparison if user check fails
      // This is a non-critical feature, so we don't want to break the main flow
      if (import.meta.env.DEV) {
        console.warn('[aiAnalysis] Goal comparison skipped', e);
      }
    }

    // Persist to Supabase user_meals (non-blocking) using normalized result
    try {
      const { data: { user } } = await supabase.auth.getUser();
        if (user) {
        // Skip saving if all core macros are zero
        if (
          normalized.calories === 0 &&
          normalized.carbs === 0 &&
          normalized.protein === 0 &&
          normalized.fat === 0
        ) {
          await logWarning(
            'Hasil AI kosong, tidak disimpan',
            {
              source: 'aiAnalysis',
              additionalContext: { normalized },
            }
          );
        } else {
          // Explicitly define payload to ensure only valid columns are included
          // DO NOT include 'fat' column as it doesn't exist in user_meals table schema
          const payload = {
            user_id: user.id,
            food_name: normalized.food_name || 'Makanan Terdeteksi',
            calories: normalized.calories ?? 0,
            carbs: normalized.carbs ?? 0,
            protein: normalized.protein ?? 0,
            health_score: normalized.health_score ?? 0,
            vegetables: normalized.portion_breakdown?.vegetables_percentage ?? null,
            image_url: normalized.image_url || null,
            created_at: new Date().toISOString(),
          } as const;

          // Type-safe insert using Database types
          type UserMealInsert = Database['public']['Tables']['user_meals']['Insert'];
          const typedPayload: UserMealInsert = {
            user_id: payload.user_id,
            food_name: payload.food_name,
            calories: payload.calories,
            carbs: payload.carbs,
            protein: payload.protein,
            health_score: payload.health_score,
            vegetables: payload.vegetables,
            image_url: payload.image_url,
            created_at: payload.created_at,
          };

          if (import.meta.env.DEV) {
            logInfo("Data dikirim ke Supabase", {
              source: 'aiAnalysis',
              additionalContext: {
                foodName: typedPayload.food_name,
                calories: typedPayload.calories,
                payloadKeys: Object.keys(typedPayload),
              },
            });
          }

          // Fire-and-forget insert with type-safe payload
          supabase
            .from('user_meals')
            .insert([typedPayload])
            .then((res) => {
              const insertResponse = res as SupabaseInsertResponse;
              if (insertResponse.error) {
                logError(new Error(insertResponse.error.message), {
                  source: 'aiAnalysis',
                  severity: 'medium',
                  additionalContext: {
                    action: 'save_to_user_meals',
                    payload: payload,
                    errorCode: insertResponse.error.code,
                  },
                });
              } else if (import.meta.env.DEV) {
                logInfo("Hasil tersimpan ke Supabase", {
                  source: 'aiAnalysis',
                  additionalContext: { 
                    mealId: Array.isArray(insertResponse.data) && insertResponse.data[0] && typeof insertResponse.data[0] === 'object' && 'id' in insertResponse.data[0] 
                      ? (insertResponse.data[0] as { id: string }).id 
                      : undefined 
                  },
                });
              }
            });
        }
      }
    } catch (e) {
      await logError(e, {
        source: 'aiAnalysis',
        severity: 'medium',
        additionalContext: {
          action: 'save_to_user_meals',
        },
      });
    }

    return normalized;
  } catch (error) {
    // Log error to error tracking service
    await logError(error, {
      source: 'aiAnalysis',
      severity: 'high',
      additionalContext: {
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type,
      },
    });
    
    // Fallback response
    return {
      food_name: "Makanan Terdeteksi",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      suggestion: "Tidak bisa menganalisis gambar saat ini. Pastikan koneksi internet stabil dan coba lagi 🙏",
      aiMode: "error-fallback",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Convert File to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
