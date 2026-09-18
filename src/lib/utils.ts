import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parses a JSON string, returning null if parsing fails or value is invalid.
 */
export function safeParse(value: any) {
  try {
    if (!value || value === "undefined" || typeof value !== 'string') {
      return null;
    }
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

export async function safeFetch(url: string, options: RequestInit = {}, retries = 1): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      const text = await response.text();

      if (!response.ok) {
        try {
          const errorJson = JSON.parse(text);
          return { error: errorJson.error || `API Error ${response.status}: ${text.substring(0, 50)}`, status: response.status };
        } catch (e) {
          return { error: `API Error ${response.status}`, status: response.status };
        }
      }

      if (!text || text === "undefined") {
        return null;
      }

      const trimmed = text.trim();
      if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<head')) {
        return { error: 'Server returned HTML instead of JSON', isHtml: true };
      }

      try {
        return JSON.parse(text);
      } catch (err) {
        return { error: 'Server response is not valid JSON' };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { error: 'Request aborted' };
      }
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 600));
        continue;
      }
      console.warn('[safeFetch] Request notice:', url, err?.message || err);
      return { error: 'Server connection notice: ' + (err?.message || 'Failed to fetch') };
    }
  }
  return { error: 'Network request failed' };
}
