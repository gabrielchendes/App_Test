const decodedImageCache = new Set<string>();
const inFlightPreloads = new Map<string, Promise<void>>();

export function isImagePreloaded(url?: string | null): boolean {
  const clean = url?.trim();
  if (!clean) return true;
  return decodedImageCache.has(clean);
}

export function markImagePreloaded(url?: string | null): void {
  const clean = url?.trim();
  if (clean) {
    decodedImageCache.add(clean);
  }
}

export function preloadImage(url?: string | null): Promise<void> {
  const clean = url?.trim();
  if (!clean || decodedImageCache.has(clean)) {
    return Promise.resolve();
  }

  const existing = inFlightPreloads.get(clean);
  if (existing) {
    return existing;
  }

  const promise = new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      decodedImageCache.add(clean);
      resolve();
      return;
    }

    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      decodedImageCache.add(clean);
      inFlightPreloads.delete(clean);
      resolve();
    };

    const safetyTimer = setTimeout(finish, 3000);

    img.onload = () => {
      clearTimeout(safetyTimer);
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {}).finally(finish);
      } else {
        finish();
      }
    };

    img.onerror = () => {
      clearTimeout(safetyTimer);
      finish();
    };

    img.src = clean;

    if (img.complete) {
      clearTimeout(safetyTimer);
      finish();
    }
  });

  inFlightPreloads.set(clean, promise);
  return promise;
}

export async function preloadImagesBatch(urls: Array<string | null | undefined>, maxWaitMs = 1500): Promise<void> {
  const uniqueUrls: string[] = [];
  const seen = new Set<string>();

  for (const raw of urls) {
    const clean = raw?.trim();
    if (clean && !seen.has(clean) && !decodedImageCache.has(clean)) {
      seen.add(clean);
      uniqueUrls.push(clean);
    }
  }

  if (uniqueUrls.length === 0) {
    return;
  }

  await Promise.race([
    Promise.all(uniqueUrls.map((u) => preloadImage(u))),
    new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs))
  ]);
}
