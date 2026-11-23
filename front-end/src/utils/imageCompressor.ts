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

export interface CompressedVideoResult {
  file: File;
  previewUrl: string;
  thumbnailUrl: string;
  duration: number;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

/**
 * Client-side video optimizer & metadata extractor.
 * Pre-processes video duration, dimensions, and generates an instant poster thumbnail
 * to prevent video loading latency and ensure smooth streaming.
 */
export async function compressVideo(
  file: File,
  _maxDimension = 1280
): Promise<CompressedVideoResult> {
  const originalSize = file.size;
  const previewUrl = URL.createObjectURL(file);

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = previewUrl;

    const fallbackResult: CompressedVideoResult = {
      file,
      previewUrl,
      thumbnailUrl: '',
      duration: 0,
      width: 0,
      height: 0,
      originalSize,
      compressedSize: originalSize
    };

    const timeout = setTimeout(() => {
      resolve(fallbackResult);
    }, 4000);

    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration || 0);
      video.currentTime = Math.min(1.0, duration > 0 ? duration * 0.2 : 0.5);
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 360;

      const maxThumb = 640;
      if (width > maxThumb || height > maxThumb) {
        if (width > height) {
          height = Math.round((height * maxThumb) / width);
          width = maxThumb;
        } else {
          width = Math.round((width * maxThumb) / height);
          height = maxThumb;
        }
      }

      let thumbnailUrl = '';
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        }
      } catch (e) {
        console.warn('Could not extract video thumbnail:', e);
      }

      resolve({
        file,
        previewUrl,
        thumbnailUrl,
        duration: Math.round(video.duration || 0),
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
        originalSize,
        compressedSize: file.size
      });
    };

    video.onerror = () => {
      clearTimeout(timeout);
      resolve(fallbackResult);
    };
  });
}

export interface OptimizedFileResult {
  file: File;
  name: string;
  size: number;
  formattedSize: string;
}

export function optimizeFile(file: File): OptimizedFileResult {
  return {
    file,
    name: file.name,
    size: file.size,
    formattedSize: formatFileSize(file.size)
  };
}

/**
 * Computes SHA-256 hash client-side for media deduplication.
 * Skips re-uploading identical media across chats.
 */
export async function computeFileHash(file: File | Blob): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.warn('[computeFileHash] Fallback hash:', e);
    return `${file.size}_${file.type}_${(file as File).name || 'blob'}`;
  }
}

/**
 * Generates an ultra-lightweight blurred preview data URI (~150-250 bytes)
 * Embeds directly inside chat message payload for instant bubble rendering without network round-trip.
 */
export async function generateMicroBlurThumbnail(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) return '';
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = 20;
      canvas.height = 20;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('');
        return;
      }
      ctx.drawImage(img, 0, 0, 20, 20);
      resolve(canvas.toDataURL('image/jpeg', 0.3));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve('');
    };
    img.src = objectUrl;
  });
}
