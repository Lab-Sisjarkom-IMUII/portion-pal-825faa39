// ✅ PortionPal Nutrition-AI (Stable Edge Function)
import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ====== CONFIG & HELPERS ======
const safeEnv = (key: string, fallback = ""): string => {
  try {
    return Deno.env.get(key) || fallback;
  } catch {
    console.warn(`⚠️ Env ${key} tidak tersedia.`);
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
    OPENAI_API_KEY: safeEnv("OPENAI_API_KEY"),
  };

  const missing: string[] = [];
  if (!required.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!required.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!required.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");

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
// If ALLOWED_ORIGIN is set (comma separated), use it. Otherwise default to safe behavior:
// - In development: allow any origin for convenience
// - In production: echo request origin if present (safer than wildcard)
const ENV = safeEnv("ENV", "development");
const rawAllowed = safeEnv("ALLOWED_ORIGIN", "");
const allowedOrigins = rawAllowed ? rawAllowed.split(",").map((o) => o.trim()) : [];
const corsHeaders = (origin = "*") => {
  let allowed = "*";
  if (allowedOrigins.length > 0) {
    allowed = allowedOrigins.includes("*") || allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];
  } else {
    // No ALLOWED_ORIGIN provided
    if (ENV === "development") {
      allowed = "*";
    } else {
      // production: prefer echoing origin if present, otherwise block by using first origin placeholder
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

// ====== INIT SUPABASE CLIENT ======
const SUPABASE_URL = safeEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = safeEnv("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ====== SIMPLE IN-MEMORY RATE LIMITER ======
// Note: serverless instances are ephemeral; for production use a DB-backed or cache-backed limiter.
const RATE_WINDOW_MS = Number(safeEnv("RATE_WINDOW_MS", "60000")); // default 1 minute
const RATE_MAX_PER_WINDOW = Number(safeEnv("RATE_MAX_PER_WINDOW", "10"));
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string) {
  const now = Date.now();
  const arr = requestLog.get(key) || [];
  const cutoff = now - RATE_WINDOW_MS;
  const recent = arr.filter((t) => t > cutoff);
  recent.push(now);
  requestLog.set(key, recent);
  return recent.length > RATE_MAX_PER_WINDOW;
}

// ====== REQUEST HANDLER ======
Deno.serve(async (req) => {
  const startTime = performance.now();
  const origin = req.headers.get("origin") || "*";
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

  try {
    const body = await req.json().catch(() => ({}));
    console.log("📥 Input ke nutrition-ai:", body);

    const schema = z.object({
      imageUrl: z.string().optional(),
      mealType: z.string().optional(),
      description: z.string().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input format", details: parsed.error }),
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    type RequestBody = { description?: string; imageUrl?: string };
    const requestBody = body as RequestBody;
    const description =
      requestBody.description?.trim() ||
      requestBody.imageUrl?.split("/")?.pop()?.split(".")?.[0]?.replace(/[-_]/g, " ") ||
      "makanan tidak diketahui";

    const openAIKey = safeEnv("OPENAI_API_KEY");
    if (!openAIKey) {
      return new Response(
          JSON.stringify({ error: "Missing OpenAI API key" }),
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    // ====== AUTHENTICATION: require Authorization Bearer <access_token> ======
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.match(/^Bearer\s+(.+)$/i);
    let userId: string | null = null;
    
    if (bearer && bearer[1]) {
      const token = bearer[1];
      console.log("🔐 Verifying token...", { tokenLength: token.length, tokenPreview: token.substring(0, 20) + "..." });
      
      // Verify token using Supabase Admin API with service role key
      try {
        // Use Admin API to verify user token
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY, // Use service role key for Admin API
            "Content-Type": "application/json",
          },
        });
        
        console.log("🔐 Token verification response:", { status: userRes.status, ok: userRes.ok });
        
        if (userRes.ok) {
          const userJson = await userRes.json();
          type UserResponse = { id?: string };
          const extractedUserId = (userJson as UserResponse)?.id;
          if (extractedUserId && typeof extractedUserId === 'string') {
            userId = extractedUserId;
          }
          console.log("✅ Token verified, userId:", userId);
        } else {
          const errorText = await userRes.text();
          console.warn("❌ Unauthorized token for nutrition-ai", { status: userRes.status, error: errorText });
        }
      } catch (e) {
        console.error("❌ Error verifying token:", e);
      }
    } else {
      console.warn("⚠️ No Authorization header or Bearer token found");
    }

    if (!userId) {
      console.error("❌ Authentication failed - no userId");
      return new Response(JSON.stringify({ error: "Unauthorized - missing or invalid token" }), {
        status: 401,
        headers: corsHeaders(origin),
      });
    }

    // ====== RATE LIMIT CHECK (DB-backed per user) ======
    try {
      const windowMs = RATE_WINDOW_MS;
      const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
      // Use Supabase upsert-like behavior: try update, if 0 rows then insert
      const { data: existing, error: selectErr } = await supabase
        .from('rate_limits')
        .select('request_count')
        .eq('user_id', userId)
        .eq('window_start', windowStart)
        .maybeSingle();

      if (selectErr) {
        console.warn('Rate limiter select error, falling back to in-memory:', selectErr);
      }

      type RateLimitRow = { request_count: number };
      let currentCount = 0;
      if (existing && typeof (existing as RateLimitRow).request_count === 'number') {
        currentCount = (existing as RateLimitRow).request_count;
      }

      if (currentCount + 1 > RATE_MAX_PER_WINDOW) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders(origin) });
      }

      // increment count atomically using insert ... on conflict not available in supabase-js for Edge; use upsert
      const upsertPayload = { user_id: userId, window_start: windowStart, request_count: currentCount + 1 };
      const { error: upsertErr } = await supabase.from('rate_limits').upsert(upsertPayload, { onConflict: ['user_id', 'window_start'] });
      if (upsertErr) console.warn('Rate limiter upsert error:', upsertErr);
    } catch (rlErr) {
      console.warn('Rate limiter DB error, continuing (best-effort):', rlErr);
    }

    // ====== MAIN AI CALL ======
    // Process image URL: handle both base64 data URLs and public URLs
    // OpenAI Vision API requires images to be accessible, so we need to:
    // 1. Use base64 data URLs directly (best for OpenAI)
    // 2. Download public URLs and convert to base64 (if URL not accessible)
    let imageUrlForAI: string | null = null;
    
    // Log input for debugging
    console.log("📥 Input imageUrl:", {
      hasImageUrl: !!requestBody.imageUrl,
      imageUrlType: typeof requestBody.imageUrl,
      imageUrlLength: requestBody.imageUrl?.length || 0,
      imageUrlPreview: requestBody.imageUrl ? (requestBody.imageUrl.substring(0, 100) + '...') : 'null',
      isDataUrl: requestBody.imageUrl?.startsWith('data:image/') || false,
      isHttpUrl: requestBody.imageUrl?.startsWith('http://') || requestBody.imageUrl?.startsWith('https://') || false,
    });
    
    if (requestBody.imageUrl) {
      try {
        const imgUrl = requestBody.imageUrl.trim();
        // If it's already a data URL (base64), validate and use it directly
        if (imgUrl.startsWith('data:image/')) {
          // Validate base64 format
          const base64Match = imgUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
          if (!base64Match || !base64Match[2] || base64Match[2].length < 100) {
            console.error("❌ Invalid base64 format:", {
              hasPrefix: imgUrl.startsWith('data:image/'),
              length: imgUrl.length,
              preview: imgUrl.substring(0, 100),
            });
            throw new Error('Invalid base64 format: malformed data URL');
          }
          imageUrlForAI = imgUrl;
          console.log("🖼️ Detected base64 data URL");
          console.log("   - Content type:", base64Match[1]);
          console.log("   - Base64 length:", base64Match[2].length, "chars");
          console.log("   - Full data URL length:", imgUrl.length, "chars");
        } 
        // If it's a public URL (http/https), try to download and convert to base64
        // OpenAI may not be able to access Supabase Storage URLs due to CORS/auth
        else if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
          console.log("🖼️ Detected public URL, downloading and converting to base64:", imgUrl.substring(0, 50) + "...");
          try {
            // For Supabase Storage URLs, use Supabase Admin client to download
            let downloadedViaStorage = false;
            if (imgUrl.includes('.supabase.co/storage/')) {
              // Extract bucket and path from URL
              // URL format: https://project.supabase.co/storage/v1/object/public/bucket/path
              const urlMatch = imgUrl.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
              if (urlMatch) {
                const bucket = urlMatch[1];
                const path = urlMatch[2];
                console.log(`📦 Extracted bucket: ${bucket}, path: ${path}`);
                
                // Use Supabase Admin client to download from storage
                try {
                  const { data: fileData, error: downloadError } = await supabase.storage
                    .from(bucket)
                    .download(path);
                  
                  if (!downloadError && fileData) {
                    // Convert Blob to ArrayBuffer
                    const arrayBuffer = await fileData.arrayBuffer();
                    const imageBytes = new Uint8Array(arrayBuffer);
                    
                    // Check image size (OpenAI has limits, max ~20MB for base64)
                    const maxSizeBytes = 20 * 1024 * 1024; // 20MB
                    if (imageBytes.length > maxSizeBytes) {
                      throw new Error(`Image too large: ${(imageBytes.length / 1024 / 1024).toFixed(2)}MB (max 20MB)`);
                    }
                    
                    // Convert to base64 using Deno's built-in base64 encoding
                    // More reliable than String.fromCharCode for large chunks
                    let imageBase64 = '';
                    const chunkSize = 8192;
                    for (let i = 0; i < imageBytes.length; i += chunkSize) {
                      const chunk = imageBytes.slice(i, i + chunkSize);
                      // Use Array.from to safely convert Uint8Array to array for String.fromCharCode
                      const chunkArray = Array.from(chunk);
                      imageBase64 += btoa(String.fromCharCode.apply(null, chunkArray));
                    }
                    
                    // Validate base64 string
                    if (!imageBase64 || imageBase64.length === 0) {
                      throw new Error('Failed to convert image to base64');
                    }
                    
                    // Log base64 preview for debugging
                    console.log("🔍 Base64 preview (first 100 chars):", imageBase64.substring(0, 100));
                    
                    // Detect image type from file extension or default to jpeg
                    const contentType = path.toLowerCase().endsWith('.png') ? 'image/png' :
                                      path.toLowerCase().endsWith('.gif') ? 'image/gif' :
                                      path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
                    imageUrlForAI = `data:${contentType};base64,${imageBase64}`;
                    
                    // Validate data URL format
                    if (!imageUrlForAI.startsWith('data:image/')) {
                      throw new Error('Invalid data URL format');
                    }
                    
                    console.log("✅ Image downloaded from Supabase Storage and converted to base64");
                    console.log("   - Content type:", contentType);
                    console.log("   - Base64 length:", imageBase64.length, "chars");
                    console.log("   - Original size:", imageBytes.length, "bytes");
                    console.log("   - Data URL length:", imageUrlForAI.length, "chars");
                    downloadedViaStorage = true;
                  } else {
                    console.warn("⚠️ Supabase storage download failed:", downloadError);
                  }
                } catch (storageError) {
                  console.warn("⚠️ Supabase storage download error, trying direct fetch:", storageError);
                }
              }
            }
            
            // Only use fetch-based download if we didn't successfully download via Supabase storage
            if (!downloadedViaStorage) {
              let imageResponse: Response;
              
              // Try with service role key for Supabase Storage URLs
              if (imgUrl.includes('.supabase.co/storage/')) {
                const serviceRoleKey = safeEnv("SUPABASE_SERVICE_ROLE_KEY");
                if (serviceRoleKey) {
                  try {
                    imageResponse = await fetch(imgUrl, {
                      headers: {
                        'apikey': serviceRoleKey,
                        'Authorization': `Bearer ${serviceRoleKey}`,
                      },
                    });
                    if (imageResponse.ok) {
                      console.log("✅ Downloaded image using service role key via fetch");
                    } else {
                      // Fallback to public access
                      imageResponse = await fetch(imgUrl);
                    }
                  } catch (e) {
                    // Fallback to public access
                    imageResponse = await fetch(imgUrl);
                  }
                } else {
                  // No service role key, try public access
                  imageResponse = await fetch(imgUrl);
                }
              } else {
                // Not a Supabase Storage URL, try direct fetch
                imageResponse = await fetch(imgUrl);
              }
              
              if (!imageResponse.ok) {
                throw new Error(`Failed to download image: ${imageResponse.status}`);
              }
              
              const imageArrayBuffer = await imageResponse.arrayBuffer();
              const imageBytes = new Uint8Array(imageArrayBuffer);
              
              // Check image size (OpenAI has limits, max ~20MB for base64)
              const maxSizeBytes = 20 * 1024 * 1024; // 20MB
              if (imageBytes.length > maxSizeBytes) {
                throw new Error(`Image too large: ${(imageBytes.length / 1024 / 1024).toFixed(2)}MB (max 20MB)`);
              }
              
              // Convert to base64 using Deno's built-in encoder
              // Use Array.from to safely convert Uint8Array to array for String.fromCharCode
              let imageBase64 = '';
              const chunkSize = 8192; // Process in chunks to avoid memory issues
              for (let i = 0; i < imageBytes.length; i += chunkSize) {
                const chunk = imageBytes.slice(i, i + chunkSize);
                const chunkArray = Array.from(chunk);
                imageBase64 += btoa(String.fromCharCode.apply(null, chunkArray));
              }
              
              // Validate base64 string
              if (!imageBase64 || imageBase64.length === 0) {
                throw new Error('Failed to convert image to base64');
              }
              
              // Log base64 preview for debugging
              console.log("🔍 Base64 preview (first 100 chars):", imageBase64.substring(0, 100));
              
              // Detect image type from response headers or default to jpeg
              const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
              imageUrlForAI = `data:${contentType};base64,${imageBase64}`;
              
              // Validate data URL format
              if (!imageUrlForAI.startsWith('data:image/')) {
                throw new Error('Invalid data URL format');
              }
              
              console.log("✅ Image downloaded and converted to base64");
              console.log("   - Content type:", contentType);
              console.log("   - Base64 length:", imageBase64.length, "chars");
              console.log("   - Original size:", imageBytes.length, "bytes");
              console.log("   - Data URL length:", imageUrlForAI.length, "chars");
            }
          } catch (downloadError) {
            console.warn("⚠️ Failed to download/convert image, trying direct URL:", downloadError);
            // Fallback: try using URL directly (may fail if OpenAI can't access it)
            imageUrlForAI = imgUrl;
          }
        }
        // If it's base64 without data URL prefix, add the prefix
        else if (imgUrl.length > 100 && !imgUrl.includes(' ')) {
          // Likely base64, try to detect image type
          // Try to detect image type from first few bytes or default to jpeg
          imageUrlForAI = `data:image/jpeg;base64,${imgUrl}`;
          console.log("🖼️ Detected raw base64, added data URL prefix");
        } else {
          console.warn("⚠️ Image URL format tidak dikenali:", imgUrl.substring(0, 50));
        }
      } catch (e) {
        console.error("❌ Error processing image URL:", e);
        console.error("❌ Error details:", {
          errorMessage: e instanceof Error ? e.message : String(e),
          errorStack: e instanceof Error ? e.stack : undefined,
          imageUrlType: typeof requestBody.imageUrl,
          imageUrlLength: requestBody.imageUrl?.length || 0,
        });
        // Continue without image, will use text-only fallback
        imageUrlForAI = null;
      }
    } else {
      console.warn("⚠️ No imageUrl provided in request body");
      console.log("📥 Request body keys:", Object.keys(requestBody));
    }

    // Build OpenAI Vision API payload
    // If we have an image, use Vision API format; otherwise fallback to text-only
    const userContent: unknown[] = [];
    
    if (imageUrlForAI) {
      // Use Vision API with image
      userContent.push({
        type: "text",
        text: `Analisis gambar makanan ini dan berikan estimasi nutrisi. Identifikasi nama makanan yang terlihat di gambar (gunakan Bahasa Indonesia, contoh: "Nasi Goreng", "Ayam Goreng", "Pempek", dll) dan berikan estimasi nutrisi. JANGAN gunakan deskripsi "${description}" sebagai nama makanan - identifikasi dari gambar. Berikan hasil dalam format JSON dengan field: food_name (string, nama makanan dalam Bahasa Indonesia), calories (angka), protein (angka dalam gram), carbs (angka dalam gram), fat (angka dalam gram), fiber (angka dalam gram untuk serat/dietary fiber). Estimasi berdasarkan porsi yang terlihat di gambar.`
      });
      userContent.push({
        type: "image_url",
        image_url: {
          url: imageUrlForAI
        }
      });
      console.log("🖼️ Menggunakan OpenAI Vision API dengan gambar");
    } else {
      // Fallback to text-only if no image
      // IMPORTANT: OpenAI API requires content to be array of objects, not strings
      userContent.push({
        type: "text",
        text: `Analisis kandungan nutrisi untuk makanan: ${description}. Berikan hasil dalam format JSON dengan field: food_name (string, nama makanan dalam Bahasa Indonesia), calories (angka), protein (angka dalam gram), carbs (angka dalam gram), fat (angka dalam gram), fiber (angka dalam gram untuk serat/dietary fiber).`
      });
      console.log("⚠️ Tidak ada gambar, menggunakan analisis text-only");
    }

    const aiPayload = {
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Kamu adalah asisten nutrisi profesional. Analisis makanan berdasarkan gambar atau deskripsi dan kembalikan HANYA JSON valid tanpa teks tambahan. Format JSON yang WAJIB: {\"food_name\": string (nama makanan dalam Bahasa Indonesia), \"calories\": angka, \"protein\": angka, \"carbs\": angka, \"fat\": angka, \"fiber\": angka (serat/dietary fiber dalam gram)}. Field food_name WAJIB berisi nama makanan yang terdeteksi dari gambar (bukan dari deskripsi atau nama file). Semua nilai numerik HARUS berupa angka (bukan string). Jika tidak yakin, berikan estimasi yang masuk akal berdasarkan makanan Indonesia umum. Untuk fiber, berikan estimasi berdasarkan kandungan serat makanan tersebut (misalnya: sayuran dan buah biasanya tinggi serat, daging rendah serat).",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    };

    // ====== RETRY MECHANISM FOR OPENAI API ======
    const maxRetries = 3;
    const initialDelay = 1000;
    const maxDelay = 10000;
    let aiRes: Response | null = null;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAIKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(aiPayload),
        });

        // Check if response is retryable (5xx errors or 429 rate limit)
        if (!aiRes.ok && (aiRes.status >= 500 || aiRes.status === 429)) {
          if (attempt < maxRetries) {
            const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
            const jitter = delay * 0.2 * (Math.random() * 2 - 1); // ±20% jitter
            const finalDelay = Math.max(0, delay + jitter);
            console.log(`⏳ OpenAI API retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(finalDelay)}ms (status: ${aiRes.status})`);
            await new Promise((resolve) => setTimeout(resolve, finalDelay));
            continue;
          }
        }
        
        // If response is OK or non-retryable error, break
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable (network errors)
        const isNetworkError = error instanceof TypeError || 
          (error instanceof Error && (
            error.message.includes('fetch') ||
            error.message.includes('network') ||
            error.message.includes('timeout')
          ));
        
        if (isNetworkError && attempt < maxRetries) {
          const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
          const jitter = delay * 0.2 * (Math.random() * 2 - 1);
          const finalDelay = Math.max(0, delay + jitter);
          console.log(`⏳ OpenAI API retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(finalDelay)}ms (error: ${lastError.message})`);
          await new Promise((resolve) => setTimeout(resolve, finalDelay));
          continue;
        }
        
        // Not retryable or exhausted retries
        break;
      }
    }

    if (!aiRes || !aiRes.ok) {
      const status = aiRes?.status || 0;
      const statusText = aiRes?.statusText || 'Unknown error';
      const errorMsg = lastError?.message || 'Network error';
      
      // Get error details from response if available
      let errorDetails = '';
      try {
        if (aiRes) {
          const errorText = await aiRes.text();
          errorDetails = errorText.substring(0, 500);
          console.error("❌ OpenAI API error response:", errorDetails);
        }
      } catch (e) {
        console.warn("Could not read error response:", e);
      }
      
      console.error(`❌ AI fetch failed after ${maxRetries + 1} attempts:`, status, statusText, errorMsg);
      console.error("❌ Error details:", errorDetails);
      
      return new Response(
        JSON.stringify({ 
          error: "AI fetch failed", 
          status,
          statusText,
          details: errorDetails || errorMsg,
          message: status === 400
            ? "Format gambar tidak didukung atau gambar tidak dapat diakses. Coba gunakan gambar lain."
            : status >= 500 || status === 429 
            ? "OpenAI API sedang sibuk, silakan coba lagi nanti"
            : "Gagal menghubungi OpenAI API"
        }),
        { status: status >= 500 ? 502 : 500, headers: corsHeaders(origin) }
      );
    }

    let aiData;
    try {
      const responseText = await aiRes.text();
      console.log("📤 Raw response from OpenAI (first 500 chars):", responseText.substring(0, 500));
      aiData = JSON.parse(responseText);
      console.log("📤 Parsed OpenAI response:", JSON.stringify(aiData).substring(0, 500));
    } catch (err) {
      console.error("❌ Invalid JSON from AI:", err);
      return new Response(
        JSON.stringify({ error: "Invalid JSON from AI", details: String(err) }),
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    // ====== NORMALIZE RESULT ======
    const content = aiData?.choices?.[0]?.message?.content || "{}";
    console.log("📝 AI Content (first 1000 chars):", content.substring(0, 1000));
    
    let parsedData;
    try {
      const cleanedContent = content.replace(/```json|```/g, "").trim();
      parsedData = JSON.parse(cleanedContent);
      console.log("✅ Parsed JSON data:", JSON.stringify(parsedData));
    } catch (parseErr) {
      console.warn("⚠️ Gagal parse JSON:", parseErr);
      console.warn("⚠️ Raw content:", content);
      // fallback: keep raw content for regex extraction below
      parsedData = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    // Robust numeric parsing: accept numbers or strings like "100 kcal", "~50g" etc.
    const parseNumber = (v: unknown): number => {
      if (v == null) return 0;
      if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.round(v));
      if (typeof v === 'string') {
        const s = v.replace(/,/g, '.').trim();
        // Handle ranges like "200-300", "200 – 300", or "200 to 300" by taking the midpoint
        const rangeMatch = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:-|–|—|to)\s*([0-9]+(?:\.[0-9]+)?)/i);
        if (rangeMatch) {
          const a = Number(rangeMatch[1]);
          const b = Number(rangeMatch[2]);
          if (!isNaN(a) && !isNaN(b)) {
            return Math.max(0, Math.round((a + b) / 2));
          }
        }

        // extract first float/integer from string as fallback
        const m = s.match(/[-+]?[0-9]*\.?[0-9]+/);
        if (m) return Math.max(0, Math.round(Number(m[0])));
      }
      return 0;
    };

    type NutritionData = { 
      food_name?: string;
      calories?: number | string; 
      protein?: number | string; 
      carbs?: number | string; 
      fat?: number | string;
      fiber?: number | string;
      serat?: number | string; // Alternative field name in Indonesian
      nama_makanan?: string; // Alternative field name
      makanan?: string; // Alternative field name
    };
    const nutritionData = parsedData as NutritionData;
    
    // Extract food_name from AI response (prioritize food_name, then fallback to alternative names)
    const aiFoodName = nutritionData.food_name || 
                      nutritionData.nama_makanan || 
                      nutritionData.makanan || 
                      null;
    let normalized = {
      calories: parseNumber(nutritionData.calories),
      protein: parseNumber(nutritionData.protein),
      carbs: parseNumber(nutritionData.carbs),
      fat: parseNumber(nutritionData.fat),
      fiber: parseNumber(nutritionData.fiber ?? nutritionData.serat),
    };

    // If parsed JSON yielded zeros (or missing), try a more aggressive regex-based extraction
    const looksEmpty = (obj: typeof normalized) =>
      obj.calories === 0 && obj.protein === 0 && obj.carbs === 0 && obj.fat === 0 && obj.fiber === 0;

    if (looksEmpty(normalized) && typeof content === 'string') {
      const text = content.replace(/```/g, ' ');
      // helper to find a number near keyword
      const searchNumber = (keys: string[]) => {
        for (const key of keys) {
          // allow capturing possible ranges as well (e.g. "200-300 kcal")
          const re = new RegExp(key + "\\s*[:-]?\\s*([0-9]{1,4}(?:[.,][0-9]+)?(?:\\s*(?:-|–|—|to)\\s*[0-9]{1,4}(?:[.,][0-9]+)?)?)", 'i');
          const m = text.match(re);
          if (m && m[1]) return m[1];
        }
        const unitRe = new RegExp("([0-9]{1,4}(?:[.,][0-9]+)?(?:\\s*(?:-|–|—|to)\\s*[0-9]{1,4}(?:[.,][0-9]+)?)?)\\s*(?:" + keys.join('|') + ")", 'i');
        const mm = text.match(unitRe);
        if (mm && mm[1]) return mm[1];
        return null;
      };

      const c = searchNumber(['calories', 'kalori', 'kcal']);
      const p = searchNumber(['protein', 'protein_g', 'proteingrams', 'proteingrams']);
      const cb = searchNumber(['carbs', 'carbohydrate', 'karbohidrat', 'carbs_g']);
      const f = searchNumber(['fat', 'lemak', 'fat_g']);
      const fib = searchNumber(['fiber', 'serat', 'dietary.*fiber', 'fiber_g']);

      const fallback = {
        calories: c ? parseNumber(c) : 0,
        protein: p ? parseNumber(p) : 0,
        carbs: cb ? parseNumber(cb) : 0,
        fat: f ? parseNumber(f) : 0,
        fiber: fib ? parseNumber(fib) : 0,
      };

      // merge any non-zero fallback values into normalized
      normalized = {
        calories: normalized.calories || fallback.calories,
        protein: normalized.protein || fallback.protein,
        carbs: normalized.carbs || fallback.carbs,
        fat: normalized.fat || fallback.fat,
        fiber: normalized.fiber || fallback.fiber,
      };

      console.log('🔎 Fallback extraction from text:', fallback, '=> merged:', normalized);
    }
    console.log("✅ Nutrition AI Input:", {
      description,
      hasImage: !!imageUrlForAI,
      imageType: imageUrlForAI ? (imageUrlForAI.startsWith('data:') ? 'base64' : 'url') : 'none'
    });
    console.log("✅ Nutrition AI Output:", normalized);

    // Check if all values are zero - this indicates a problem
    const allZeros = normalized.calories === 0 && normalized.protein === 0 && normalized.carbs === 0 && normalized.fat === 0 && normalized.fiber === 0;
    if (allZeros) {
      console.warn("⚠️ WARNING: All nutrition values are zero! This may indicate an issue with OpenAI API response.");
      console.warn("Raw AI content:", content.substring(0, 500));
      console.warn("Parsed data:", parsedData);
    }

    // Build response with additional metadata
    // Use AI-detected food_name if available, otherwise fallback to description or default
    const detectedFoodName = aiFoodName && 
                            aiFoodName.trim() && 
                            aiFoodName.trim() !== description &&
                            !aiFoodName.toLowerCase().includes('whatsapp') &&
                            !aiFoodName.toLowerCase().includes('image') &&
                            !aiFoodName.match(/^\d{4}\s+\d{1,2}\s+\d{1,2}/) // Not a date pattern
                            ? aiFoodName.trim()
                            : (description && !description.toLowerCase().includes('whatsapp') && !description.match(/^\d{4}\s+\d{1,2}\s+\d{1,2}/)
                                ? description
                                : "Makanan Terdeteksi");
    
    const response = {
      ...normalized,
      food_name: detectedFoodName,
      suggestion: allZeros 
        ? "Tidak bisa menganalisis gambar saat ini. Pastikan koneksi internet stabil dan coba lagi 🙏"
        : "Tetap jaga porsi seimbang antara protein, karbohidrat, lemak, dan serat.",
      aiMode: "openai-vision",
      confidence_score: allZeros ? 0 : 85, // Low confidence if all zeros
    };
    
    console.log("🍽️ Food name detection:", {
      aiFoodName,
      description,
      detectedFoodName,
      usingAI: aiFoodName && aiFoodName.trim() && aiFoodName.trim() !== description,
    });

    // Log performance metrics
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`⏱️ nutrition-ai execution time: ${duration.toFixed(2)}ms`);
    
    // Optionally log to performance_logs table if it exists
    try {
      await supabase.from('performance_logs').insert({
        metric: 'edge_function_nutrition_ai',
        value: duration,
        unit: 'ms',
        source: 'nutrition-ai',
        user_id: userId,
        context: {
          hasImage: !!imageUrlForAI,
          imageType: imageUrlForAI ? (imageUrlForAI.startsWith('data:') ? 'base64' : 'url') : 'none',
          allZeros: allZeros,
        },
        timestamp: new Date().toISOString(),
      }).catch(() => {
        // Silently fail if table doesn't exist
      });
    } catch (e) {
      // Silently fail
    }

    return new Response(JSON.stringify(response), { headers: corsHeaders(origin) });
  } catch (err) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.error("Unexpected error in nutrition-ai:", err);
    console.error(`⏱️ nutrition-ai error after: ${duration.toFixed(2)}ms`);
    
    return new Response(
      JSON.stringify({ error: "Server error", details: String(err) }),
      { status: 500, headers: corsHeaders(origin) }
    );
  }
});
