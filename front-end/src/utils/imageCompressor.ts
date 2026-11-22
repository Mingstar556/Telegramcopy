/**
 * High-performance client-side image compression & thumbnail generator
 * Prevents network bottlenecks and optimizes rendering speed.
 */

export interface CompressedImageResult {
  file: File;
  blob: Blob;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export async function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<CompressedImageResult> {
  // If not an image or SVG/GIF, return as is (do not compress animated GIF or vector SVG)
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    const previewUrl = URL.createObjectURL(file);
    return {
      file,
      blob: file,
      previewUrl,
      originalSize: file.size,
      compressedSize: file.size,
      width: 0,
      height: 0
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Calculate aspect ratio fit
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
        // Fallback if canvas context fails
        const fallbackUrl = URL.createObjectURL(file);
        resolve({
          file,
          blob: file,
          previewUrl: fallbackUrl,
          originalSize: file.size,
          compressedSize: file.size,
          width: img.width,
          height: img.height
        });
        return;
      }

      // Smooth bicubic downscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer image/webp if supported, otherwise image/jpeg
      const outputType = 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            const fallbackUrl = URL.createObjectURL(file);
            resolve({
              file,
              blob: file,
              previewUrl: fallbackUrl,
              originalSize: file.size,
              compressedSize: file.size,
              width,
              height
            });
            return;
          }

          const compressedFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          const compressedFile = new File([blob], compressedFileName, {
            type: outputType,
            lastModified: Date.now()
          });

          // Generate fast data URL for optimistic instant bubble rendering
          const previewUrl = canvas.toDataURL('image/jpeg', 0.6);

          resolve({
            file: compressedFile,
            blob,
            previewUrl,
            originalSize: file.size,
            compressedSize: blob.size,
            width,
            height
          });
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const fallbackUrl = URL.createObjectURL(file);
      resolve({
        file,
        blob: file,
        previewUrl: fallbackUrl,
        originalSize: file.size,
        compressedSize: file.size,
        width: 0,
        height: 0
      });
    };

    img.src = objectUrl;
  });
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function svgToPngDataUrl(svgString: string, size = 512): Promise<string> {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve(dataUrl);
          return;
        }
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.src = url;
    } catch {
      resolve('');
    }
  });
}
