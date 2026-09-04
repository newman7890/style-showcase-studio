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

/**
 * Converts a data URL or blob URL to a Blob
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Safely fetches a remote image source and converts it to a Blob,
 * handling potential CORS or direct format issues before running AI models.
 */
async function getSourceAsBlobOrUrl(source: string | File | Blob): Promise<Blob | File | string> {
  if (source instanceof File || source instanceof Blob) {
    return source;
  }

  if (typeof source === 'string') {
    // If it's a data URL or blob URL, return directly
    if (source.startsWith('data:') || source.startsWith('blob:')) {
      return source;
    }

    // If it's a remote URL, try to fetch as blob to avoid web worker CORS issues
    try {
      const res = await fetch(source, { mode: 'cors' });
      if (res.ok) {
        return await res.blob();
      }
    } catch {
      // Fallback to passing URL directly if fetch fails
      return source;
    }
  }

  return source;
}

/**
 * Removes the background of an image using AI in-browser models.
 * Returns the transparent PNG Blob, a File object ready for upload, and a Data URL preview.
 */
export async function processAiBackgroundRemoval(
  source: string | File | Blob,
  filenamePrefix = 'studio-clean'
): Promise<ProcessedStudioImage> {
  const preparedSource = await getSourceAsBlobOrUrl(source);

  const imgly = await import('@imgly/background-removal');
  const removeBgFn = imgly.removeBackground || (imgly as any).default;

  if (typeof removeBgFn !== 'function') {
    throw new Error('AI Background removal library could not be initialized.');
  }

  // Run the background removal
  const outputBlob = await removeBgFn(preparedSource, {
    progress: (_key: string, _current: number, _total: number) => {
      // Optional progress hook
    },
  });

  const timestamp = Date.now();
  const file = new File([outputBlob], `${filenamePrefix}-${timestamp}.png`, {
    type: 'image/png',
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
  bucket = 'product-images',
  customPrefix = 'img'
): Promise<string> {
  const isPng = fileOrBlob.type.includes('png');
  const fileExt = isPng ? 'png' : fileOrBlob instanceof File ? fileOrBlob.name.split('.').pop() || 'jpg' : 'png';
  const fileName = `${customPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileOrBlob, {
      contentType: fileOrBlob.type || 'image/png',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return publicUrl;
}
