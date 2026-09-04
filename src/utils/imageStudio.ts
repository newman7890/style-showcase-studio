import { supabase } from "@/integrations/supabase/client";

/**
 * AI Studio Image Processing Utilities
 * Powered by @imgly/background-removal
 */

export interface ProcessedStudioImage {
  blob: Blob;
  file: File;
  previewUrl: string;
}

export interface ProcessStudioOptions {
  onProgress?: (message: string, percent?: number) => void;
  maxDimension?: number;
  timeoutMs?: number;
}

/**
 * Converts a data URL or blob URL to a Blob
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Pre-processes and downscales large images (e.g. 4000x3000 camera photos)
 * to a maximum dimension (default 1024px) before sending to in-browser AI.
 * This prevents browser memory exhaustion and speeds up background removal 10x-20x.
 */
async function optimizeImageForAi(
  source: string | File | Blob,
  maxDimension = 1024
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    let srcUrl = "";
    let isTempUrl = false;

    if (source instanceof Blob || source instanceof File) {
      srcUrl = URL.createObjectURL(source);
      isTempUrl = true;
    } else if (typeof source === "string") {
      srcUrl = source;
    } else {
      return reject(new Error("Invalid image source provided."));
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        let { naturalWidth: width, naturalHeight: height } = img;
        if (!width || !height) {
          width = img.width;
          height = img.height;
        }

        // If already within dimensions and already a Blob, reuse directly
        if (width <= maxDimension && height <= maxDimension && source instanceof Blob) {
          if (isTempUrl) URL.revokeObjectURL(srcUrl);
          return resolve(source);
        }

        // Scale proportionally if exceeds maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          if (isTempUrl) URL.revokeObjectURL(srcUrl);
          if (source instanceof Blob) return resolve(source);
          return reject(new Error("Could not initialize 2D canvas context."));
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (isTempUrl) URL.revokeObjectURL(srcUrl);
            if (blob) {
              resolve(blob);
            } else if (source instanceof Blob) {
              resolve(source);
            } else {
              reject(new Error("Canvas conversion to image blob failed."));
            }
          },
          "image/png"
        );
      } catch (err) {
        if (isTempUrl) URL.revokeObjectURL(srcUrl);
        if (source instanceof Blob) return resolve(source);
        reject(err);
      }
    };

    img.onerror = () => {
      if (isTempUrl) URL.revokeObjectURL(srcUrl);
      if (source instanceof Blob) return resolve(source);
      reject(new Error("Could not load image. If this is a remote URL, CORS may be preventing access."));
    };

    img.src = srcUrl;
  });
}

/**
 * Preload AI models into browser cache
 */
export async function preloadAiModels(): Promise<void> {
  try {
    const imgly = await import("@imgly/background-removal");
    if (typeof imgly.preload === "function") {
      await imgly.preload({ model: "isnet_quint8" as any });
    }
  } catch (err) {
    console.warn("Background removal model preloading warning:", err);
  }
}

/**
 * Removes the background of an image using in-browser AI models.
 * Returns the transparent PNG Blob, a File object ready for upload, and a Data URL preview.
 */
export async function processAiBackgroundRemoval(
  source: string | File | Blob,
  filenamePrefix = "studio-clean",
  options?: ProcessStudioOptions
): Promise<ProcessedStudioImage> {
  const timeoutMs = options?.timeoutMs || 90000; // 90 seconds timeout
  options?.onProgress?.("Optimizing image for AI analysis...", 5);

  // 1. Optimize and resize image before passing to heavy WASM
  const preparedBlob = await optimizeImageForAi(source, options?.maxDimension || 1024);

  options?.onProgress?.("Loading AI background removal engine...", 15);

  // 2. Dynamically import library
  let imgly: any;
  try {
    imgly = await import("@imgly/background-removal");
  } catch (importErr: any) {
    throw new Error(
      "Failed to load AI model library. Please check your internet connection and refresh the page."
    );
  }

  const removeBgFn = imgly.removeBackground || imgly.default;
  if (typeof removeBgFn !== "function") {
    throw new Error("AI Background removal function could not be initialized.");
  }

  // 3. Execution promise with model config
  const removalPromise = removeBgFn(preparedBlob, {
    model: "isnet_quint8" as any, // Fast quantized model (40MB vs 80MB)
    output: {
      format: "image/png",
      quality: 0.9,
    },
    progress: (key: string, current: number, total: number) => {
      if (options?.onProgress && total > 0) {
        const pct = Math.min(99, Math.round((current / total) * 100));
        if (key.includes("fetch") || key.includes("download")) {
          options.onProgress(`Downloading AI model (${pct}%)...`, pct);
        } else if (key.includes("compute") || key.includes("inference")) {
          options.onProgress(`Removing background (${pct}%)...`, pct);
        } else {
          options.onProgress(`Enhancing image (${pct}%)...`, pct);
        }
      }
    },
  });

  // 4. Timeout promise to avoid infinite spinning
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          "AI background removal timed out. This may happen if the connection is slow when downloading models for the first time. Please try again."
        )
      );
    }, timeoutMs);

    removalPromise.finally(() => clearTimeout(timer));
  });

  // Run with timeout race
  const outputBlob: Blob = await Promise.race([removalPromise, timeoutPromise]);

  options?.onProgress?.("Finalizing studio photo...", 100);

  const timestamp = Date.now();
  const file = new File([outputBlob], `${filenamePrefix}-${timestamp}.png`, {
    type: "image/png",
  });

  // Create preview URL
  const previewUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(outputBlob);
  });

  return {
    blob: outputBlob,
    file,
    previewUrl,
  };
}

/**
 * Uploads a File or Blob directly to Supabase Storage bucket and returns the public URL.
 */
export async function uploadImageToStorage(
  fileOrBlob: File | Blob,
  bucket = "product-images",
  customPrefix = "img"
): Promise<string> {
  const isPng = fileOrBlob.type.includes("png");
  const fileExt = isPng ? "png" : fileOrBlob instanceof File ? fileOrBlob.name.split(".").pop() || "jpg" : "png";
  const fileName = `${customPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileOrBlob, {
      contentType: fileOrBlob.type || "image/png",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return publicUrl;
}
