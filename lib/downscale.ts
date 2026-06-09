/**
 * lib/downscale.ts — client-side image downscale + EXIF-orientation normalize.
 *
 * Phone photos are large (easily >4.5MB) and often carry an EXIF orientation tag
 * that renders sideways on canvas. Before the dual photos (D-11) are uploaded via
 * @vercel/blob/client `upload()`, the 04 PhotoUploadSlot runs them through this
 * helper so feed cards (Phase 4) and OG (Phase 6) get upright, web-sized images.
 *
 * D-12: long edge clamped to 1080–1440px, re-encoded to WebP at quality 0.8.
 * Pitfall 3 (RESEARCH): `createImageBitmap(file, { imageOrientation: 'from-image' })`
 * bakes the EXIF rotation into the bitmap, so the canvas draw is already upright —
 * no manual transform matrix needed. Verify on a real device (A2).
 *
 * Browser-only (createImageBitmap / OffscreenCanvas-or-canvas / toBlob). Import
 * from a Client Component.
 */

/** Default long-edge ceiling (px). D-12 allows 1080–1440; 1440 keeps feed crisp. */
const DEFAULT_MAX_EDGE = 1440;
/** Default WebP encode quality (D-12). */
const DEFAULT_QUALITY = 0.8;

/**
 * downscale — normalize EXIF orientation, clamp the long edge, re-encode WebP.
 *
 * @param file    the user-selected image File/Blob.
 * @param maxEdge long-edge ceiling in px (default 1440; smaller images are NOT
 *                upscaled — the original dimensions are kept when already smaller).
 * @param quality WebP encode quality 0..1 (default 0.8).
 * @returns a WebP Blob ready for `upload()`.
 */
export async function downscale(
  file: Blob,
  maxEdge: number = DEFAULT_MAX_EDGE,
  quality: number = DEFAULT_QUALITY,
): Promise<Blob> {
  // Pitfall 3: decode with EXIF orientation applied so the bitmap is upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    const { width, height } = bitmap;
    // Never upscale — only shrink when the long edge exceeds maxEdge.
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    if (!blob) throw new Error('toBlob returned null');
    return blob;
  } finally {
    // Release decoded bitmap memory promptly.
    bitmap.close();
  }
}
