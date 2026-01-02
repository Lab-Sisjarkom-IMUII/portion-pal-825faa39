/**
 * Image Compression Utility
 * 
 * Compresses images before upload to reduce payload size and improve performance.
 * Uses Canvas API for client-side compression (no external dependencies).
 */

export interface CompressionOptions {
  maxSizeMB?: number; // Maximum file size in MB (default: 1MB)
  maxWidthOrHeight?: number; // Maximum width or height in pixels (default: 1920)
  quality?: number; // JPEG quality 0-1 (default: 0.8)
  useWebWorker?: boolean; // Use web worker for compression (default: false)
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compress image file using Canvas API
 * 
 * @param file - Original image file
 * @param options - Compression options
 * @returns Compressed file with metadata
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxSizeMB = 1,
    maxWidthOrHeight = 1920,
    quality = 0.8,
  } = options;

  const originalSize = file.size;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // If file is already small enough, return as-is
  if (originalSize <= maxSizeBytes) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;

          if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
            if (width > height) {
              height = (height / width) * maxWidthOrHeight;
              width = maxWidthOrHeight;
            } else {
              width = (width / height) * maxWidthOrHeight;
              height = maxWidthOrHeight;
            }
          }

          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              // If still too large, reduce quality further
              if (blob.size > maxSizeBytes && quality > 0.5) {
                canvas.toBlob(
                  (smallerBlob) => {
                    if (!smallerBlob) {
                      // Fallback: use the previous blob
                      const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                      });
                      resolve({
                        file: compressedFile,
                        originalSize,
                        compressedSize: blob.size,
                        compressionRatio: blob.size / originalSize,
                      });
                      return;
                    }

                    const compressedFile = new File([smallerBlob], file.name, {
                      type: 'image/jpeg',
                      lastModified: Date.now(),
                    });
                    resolve({
                      file: compressedFile,
                      originalSize,
                      compressedSize: smallerBlob.size,
                      compressionRatio: smallerBlob.size / originalSize,
                    });
                  },
                  'image/jpeg',
                  quality * 0.7 // Further reduce quality
                );
              } else {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve({
                  file: compressedFile,
                  originalSize,
                  compressedSize: blob.size,
                  compressionRatio: blob.size / originalSize,
                });
              }
            },
            'image/jpeg',
            quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Failed to read file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Get image dimensions without loading full image
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Failed to read file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

