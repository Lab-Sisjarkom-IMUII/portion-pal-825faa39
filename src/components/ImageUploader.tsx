import { useState, useRef } from "react";
import { Upload, X, AlertCircle, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { compressImage, formatFileSize } from "@/lib/imageCompression";
import { imageFileSchema, isValidFileSize, isValidFileType } from "@/lib/validators";
import type { SupabaseFunctionsClient } from "@/types/api";

interface ImageUploaderProps {
  onImageSelect?: (file: File) => void;
  onAnalyzeResult?: (result: unknown) => void;
  maxSizeMB?: number;
  acceptedFormats?: string[];
}

export function ImageUploader({
  onImageSelect,
  onAnalyzeResult,
  maxSizeMB = 10,
  acceptedFormats = ["image/jpeg", "image/jpg", "image/png"],
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Use centralized validator
    const result = imageFileSchema.safeParse(file);
    if (!result.success) {
      return result.error.errors[0]?.message || 'File tidak valid';
    }
    
    // Additional check for maxSizeMB (if different from default)
    if (!isValidFileSize(file, maxSizeMB)) {
      const sizeMB = file.size / (1024 * 1024);
      return `Ukuran file terlalu besar. Maksimal ${maxSizeMB}MB (file: ${sizeMB.toFixed(1)}MB)`;
    }
    
    // Additional check for accepted formats
    if (!isValidFileType(file, acceptedFormats)) {
      return `Format tidak didukung. Gunakan: ${acceptedFormats
        .map((f) => f.split("/")[1].toUpperCase())
        .join(", ")}`;
    }
    
    return null;
  };

  const handleFile = async (file: File) => {
    setError("");
    setSelectedFile(file);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Compress image before processing
    let processedFile = file;
    try {
      const compressionResult = await compressImage(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        quality: 0.8,
      });
      processedFile = compressionResult.file;
      
      if (import.meta.env.DEV) {
        const { logInfo } = await import('@/lib/errorLogger');
        const originalSize = formatFileSize(compressionResult.originalSize);
        const compressedSize = formatFileSize(compressionResult.compressedSize);
        const ratio = (compressionResult.compressionRatio * 100).toFixed(1);
        logInfo(`Image compressed: ${originalSize} → ${compressedSize} (${ratio}% of original)`, {
          source: 'ImageUploader',
          additionalContext: {
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
            ratio: compressionResult.compressionRatio,
          },
        });
      }
    } catch (compressionError) {
      // If compression fails, use original file
      const { logWarning } = await import('@/lib/errorLogger');
      logWarning('Image compression failed, using original file', {
        source: 'ImageUploader',
        additionalContext: { error: compressionError },
      });
      processedFile = file;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
      onImageSelect?.(processedFile); // Use compressed file
    };
    reader.readAsDataURL(processedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearPreview = () => {
    setPreview("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 🧠 Analisis makanan via Supabase Edge Function
  const analyzeFood = async () => {
    if (!preview) return;
      try {
        setIsAnalyzing(true);
        setError("");

        // Prefer SDK invoke so supabase client resolves the functions URL & auth
        // Get session token to call function as the user
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Silakan login terlebih dahulu untuk menganalisis gambar.');
          return;
        }
  // prepare body with image data and description derived from filename
  const description = selectedFile?.name?.split('.')?.[0]?.replace(/[-_]/g, ' ') || 'makanan dari gambar';
  const body = { description, imageUrl: preview };

        const functionsClient = supabase.functions as unknown as SupabaseFunctionsClient;
        if (session && typeof functionsClient?.invoke === "function") {
          const invoke = await functionsClient.invoke('nutrition-ai', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            body,
          });
          if (invoke.error) throw invoke.error;
          if (import.meta.env.DEV) {
            const { logInfo } = await import('@/lib/errorLogger');
            logInfo("Hasil analisis AI (invoke)", {
              source: 'ImageUploader',
              additionalContext: { hasData: !!invoke.data },
            });
          }
          onAnalyzeResult?.(invoke.data);
        } else {
          // Fallback: call function via URL built from env
          const url = `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/functions/v1/nutrition-ai`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: session ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          const errorMsg = (data && typeof data === 'object' && 'error' in data ? (data as { error: unknown }).error : undefined);
          if (!res.ok) throw new Error((typeof errorMsg === 'string' ? errorMsg : undefined) || "Gagal menganalisis gambar.");
          if (import.meta.env.DEV) {
            const { logInfo } = await import('@/lib/errorLogger');
            logInfo("Hasil analisis AI (fetch)", {
              source: 'ImageUploader',
              additionalContext: { hasData: !!data },
            });
          }
          onAnalyzeResult?.(data);
        }
        } catch (err: unknown) {
        const { logError } = await import('@/lib/errorLogger');
        await logError(err instanceof Error ? err : new Error(String(err)), {
          source: 'ImageUploader',
          severity: 'high',
          additionalContext: {
            action: 'analyze_food',
          },
        });
        setError("Tidak bisa menganalisis gambar saat ini. Pastikan koneksi internet stabil dan coba lagi!");
      } finally {
        setIsAnalyzing(false);
      }
  };

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm"
          >
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            <p>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {preview ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
          <Card className="overflow-hidden">
            <img 
              src={preview} 
              alt={selectedFile?.name ? `Preview gambar ${selectedFile.name}` : "Preview gambar makanan"} 
              className="w-full h-64 object-cover"
            />
          </Card>

          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={clearPreview}
            aria-label="Hapus gambar"
            title="Hapus gambar"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>

          <div className="flex flex-col items-center gap-3 mt-4">
            <Button
              onClick={analyzeFood}
              disabled={isAnalyzing}
              className="gap-2 w-full sm:w-auto"
              aria-label={isAnalyzing ? "Sedang menganalisis gambar" : "Analisis gambar makanan"}
              aria-busy={isAnalyzing}
            >
              <Brain className="w-4 h-4" aria-hidden="true" />
              {isAnalyzing ? "Menganalisis..." : "Analisis Gambar"}
            </Button>
            <p className="text-xs text-muted-foreground">
              AI akan mengidentifikasi makanan dan menghitung nutrisinya
            </p>
          </div>
        </motion.div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onKeyDown={(e) => {
            // Allow keyboard activation
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Area upload gambar. Tekan Enter atau Spasi untuk memilih file"
          aria-describedby="upload-instructions"
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-border hover:border-primary/50"
          }`}
        >
          <Upload
            className={`w-12 h-12 mx-auto mb-4 ${
              isDragging ? "text-primary" : "text-muted-foreground"
            }`}
            aria-hidden="true"
          />
          <h3 className="text-lg font-semibold mb-2">
            {isDragging ? "Lepaskan gambar di sini" : "Drag & Drop Gambar"}
          </h3>
          <p id="upload-instructions" className="text-sm text-muted-foreground mb-4">
            atau klik tombol di bawah untuk memilih file
          </p>
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            aria-label="Pilih file gambar"
          >
            Pilih File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats.join(",")}
            onChange={handleFileInput}
            className="hidden"
            aria-label="Input file gambar"
            aria-describedby="file-format-info"
          />
          <p id="file-format-info" className="text-xs text-muted-foreground mt-4">
            Format: JPG, JPEG, PNG • Maksimal {maxSizeMB}MB
          </p>
        </div>
      )}
    </div>
  );
}
