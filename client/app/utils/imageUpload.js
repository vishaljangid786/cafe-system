'use client';
import api from '../services/api';

// Shared, robust image upload used by every "pick an image → get a hosted URL"
// spot in the app (cafe logo, admin Aadhaar, admin profile photo, …).
//
// Three problems it exists to solve, all of which produced the intermittent
// "image upload failed — try again a few times" the team kept hitting:
//
//   1. SIZE. A modern phone photo is 3–8 MB. Vercel's serverless functions cap
//      the REQUEST BODY at ~4.5 MB, so a large photo is rejected by the platform
//      before it ever reaches multer — a hard failure that looks random because
//      it depends on the photo. Downscaling client-side keeps every upload well
//      under that ceiling.
//   2. TIME. A big file over a cold serverless function + Cloudinary hop is slow;
//      a smaller file uploads fast, so it rarely brushes any timeout.
//   3. TRANSIENCE. Cold starts and momentary network blips fail the FIRST try.
//      One automatic retry turns "the user retries manually" into "it just works".

const MAX_DIMENSION = 1600;   // px on the longest side — plenty for a logo/ID scan
const TARGET_MAX_BYTES = 3.2 * 1024 * 1024; // stay comfortably under Vercel's ~4.5MB
// Even after compression a file must clear the platform body limit; give a small
// margin under Vercel's ~4.5MB serverless cap.
const HARD_MAX_BYTES = 4 * 1024 * 1024;
// Originals bigger than this can't be rescued by compression, so reject up front
// instead of uploading and failing.
const REJECT_ORIGINAL_BYTES = 25 * 1024 * 1024;

// What the server actually accepts (multer fileFilter): any image except SVG,
// plus PDF. Mirror it here so the user learns instantly, without a round trip.
const ALLOWED_PREFIX = 'image/';
const BLOCKED_TYPES = new Set(['image/svg+xml']);
const ALSO_ALLOWED = new Set(['application/pdf']);

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);

/**
 * Validate a chosen file BEFORE any upload, returning a specific, human error
 * string — or null when it is fine. This is the "tell me immediately" gate for
 * type and size, so the user never waits for a server round trip to learn their
 * file is a video or a 40MB RAW.
 */
export const validateImageFile = (file) => {
  if (!file) return 'Please choose an image to upload.';

  const type = file.type || '';
  if (BLOCKED_TYPES.has(type)) {
    return 'SVG images aren’t supported (for security). Please use a JPG, PNG or WEBP.';
  }
  const isImage = type.startsWith(ALLOWED_PREFIX);
  const isPdf = ALSO_ALLOWED.has(type);
  // Some phones report an empty MIME type; fall back to the extension so a real
  // JPG isn't rejected just because the browser didn't label it.
  const extOk = /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif|avif|pdf)$/i.test(file.name || '');
  if (!isImage && !isPdf && !(type === '' && extOk)) {
    return 'That doesn’t look like an image. Please upload a JPG, PNG, WEBP or PDF.';
  }

  if (file.size > REJECT_ORIGINAL_BYTES) {
    return `This file is ${mb(file.size)}MB, which is too large. Please use an image under ${mb(REJECT_ORIGINAL_BYTES)}MB.`;
  }
  return null;
};

/**
 * Turn ANY upload failure into a specific, actionable message. The server
 * already returns good text for the errors it can see (bad type, too large,
 * host rejection); this adds the client-only failures (timeout, offline) that
 * never reach the server and would otherwise show as a bare "Network Error".
 */
export const uploadErrorMessage = (err) => {
  if (typeof err === 'string') return err;

  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.message;

  if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
    return 'The upload timed out. Please check your connection and try again.';
  }
  if (err?.code === 'ERR_NETWORK' || /network error/i.test(err?.message || '')) {
    return 'Could not reach the server. Check your internet connection and try again.';
  }
  if (status === 413) {
    return 'The image is too large to upload. Please use one under 4MB (or crop it).';
  }
  if (status === 401) return 'Your session has expired. Please sign in again and retry.';
  if (status === 403) return serverMsg || 'You don’t have permission to upload here.';
  // The server sends specific text for 400s (type/size/host) — prefer it.
  if (serverMsg) return serverMsg;
  return err?.message || 'Image upload failed. Please try again.';
};

/**
 * Downscale + re-encode an image File so it is small and fast to upload.
 * PDFs and anything already small are returned untouched. Failures fall back to
 * the original file — compression is an optimisation, never a gate.
 */
export const compressImage = async (file) => {
  if (!file || !isBrowser()) return file;
  // Only raster images. PDFs/SVGs and non-images pass through unchanged.
  if (!file.type?.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }
  // Small enough already — don't waste time or risk re-encoding artefacts.
  if (file.size <= 900 * 1024) return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = fit(bitmap.width, bitmap.height, MAX_DIMENSION);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // JPEG has no alpha channel, so a transparent PNG (e.g. a logo) would encode
    // its transparent areas as BLACK. Paint the canvas white first so those areas
    // come out clean — invisible on opaque photos/scans, correct on logos.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (bitmap.close) bitmap.close();

    // Step quality down until it fits the budget. JPEG for photos; the source
    // extension no longer matters since Cloudinary stores whatever we send.
    let quality = 0.85;
    let blob = await toBlob(canvas, quality);
    while (blob && blob.size > TARGET_MAX_BYTES && quality > 0.5) {
      quality -= 0.12;
      blob = await toBlob(canvas, quality);
    }
    if (!blob) return file;
    // If our "compressed" output is somehow bigger, keep the original.
    if (blob.size >= file.size) return file;

    const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file; // never block an upload because compression hiccuped
  }
};

const loadBitmap = async (file) => {
  // createImageBitmap is fast and handles EXIF orientation on modern browsers.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // fall through to the <img> path
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
};

const fit = (w, h, max) => {
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
};

const toBlob = (canvas, quality) =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));

const isRetryable = (err) => {
  // Timeout, aborted request, or a network drop — none of which mean the file
  // is bad, so retrying is worthwhile. A 4xx (bad file, too large, forbidden)
  // is NOT retried; the same request would fail identically.
  const status = err?.response?.status;
  if (status && status < 500) return false;
  return (
    err?.code === 'ECONNABORTED'
    || err?.code === 'ERR_NETWORK'
    || /timeout|Network Error/i.test(err?.message || '')
    || (status && status >= 500)
  );
};

/**
 * Upload a single image file and return its hosted URL.
 *
 * @param {File}   file
 * @param {Object} [opts]
 * @param {String} [opts.endpoint='/cafes/upload-image']  server route (field name 'image')
 * @param {String} [opts.field='image']
 * @param {Number} [opts.retries=1]  automatic retries on a transient failure
 * @returns {Promise<string>} the hosted URL
 */
export const uploadImageFile = async (file, { endpoint = '/cafes/upload-image', field = 'image', retries = 1 } = {}) => {
  // Type/size gate first — instant, specific, no round trip.
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);

  const prepared = await compressImage(file);

  // A scan that is still over the platform limit even after compression must be
  // caught here, with a clear reason, rather than failing as an opaque 413.
  if (prepared.size > HARD_MAX_BYTES) {
    throw new Error(
      `This image is ${mb(prepared.size)}MB even after compression, which is over the ${mb(HARD_MAX_BYTES)}MB limit. Please crop it or use a smaller photo.`
    );
  }

  const send = async () => {
    const data = new FormData();
    data.append(field, prepared);
    // The api interceptor already lifts FormData requests to a 60s timeout.
    const res = await api.post(endpoint, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    const url = res.data?.url || res.data?.data?.url;
    if (!url) throw new Error('Upload succeeded but no URL was returned');
    return url;
  };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await send();
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isRetryable(err)) continue;
      break;
    }
  }
  // Re-throw with a specific, human message so every caller can show it directly.
  const e = new Error(uploadErrorMessage(lastErr));
  e.original = lastErr;
  throw e;
};
