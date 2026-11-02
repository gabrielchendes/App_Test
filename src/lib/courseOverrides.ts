import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { safeFetch } from './utils';

const COURSE_OVERRIDES_CACHE_KEY = 'mt_course_overrides_v1';
const CHAPTER_OVERRIDES_CACHE_KEY = 'mt_chapter_overrides_v1';

// Synchronous in-memory caches loaded from localStorage
let courseOverridesMemory: Record<string, Record<string, any>> = (() => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(COURSE_OVERRIDES_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
})();

let chapterOverridesMemory: Record<string, Record<string, any>> = (() => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CHAPTER_OVERRIDES_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
})();

let isSyncing = false;

function notifyOverridesUpdated() {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('mt_overrides_updated', {
        detail: {
          courses: courseOverridesMemory,
          chapters: chapterOverridesMemory
        }
      }));
    } catch {}
  }
}

/**
 * Hook to force component re-render whenever server overrides arrive or update
 */
export function useCourseOverridesSync(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick(t => t + 1);
    window.addEventListener('mt_overrides_updated', handleUpdate);
    return () => window.removeEventListener('mt_overrides_updated', handleUpdate);
  }, []);

  return tick;
}

/**
 * Sync overrides from server endpoint in background
 */
export async function syncOverridesFromServer(): Promise<void> {
  if (isSyncing || typeof window === 'undefined') return;
  isSyncing = true;
  try {
    const [cRes, chRes] = await Promise.allSettled([
      safeFetch('/api/v1/admin?action=course-overrides'),
      safeFetch('/api/v1/admin?action=chapter-overrides')
    ]);

    let changed = false;

    if (cRes.status === 'fulfilled' && cRes.value && typeof cRes.value === 'object') {
      courseOverridesMemory = { ...courseOverridesMemory, ...cRes.value };
      changed = true;
      try {
        localStorage.setItem(COURSE_OVERRIDES_CACHE_KEY, JSON.stringify(courseOverridesMemory));
      } catch {}
    }

    if (chRes.status === 'fulfilled' && chRes.value && typeof chRes.value === 'object') {
      chapterOverridesMemory = { ...chapterOverridesMemory, ...chRes.value };
      changed = true;
      try {
        localStorage.setItem(CHAPTER_OVERRIDES_CACHE_KEY, JSON.stringify(chapterOverridesMemory));
      } catch {}
    }

    if (changed) {
      notifyOverridesUpdated();
    }
  } catch (err) {
    console.debug?.('[Overrides] Sync notice:', err);
  } finally {
    isSyncing = false;
  }
}

// Automatically initiate sync in client environment
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncOverridesFromServer();
  }, 50);
}

/**
 * Applies course overrides (e.g. cover_url, premium_cover_url)
 */
export function applyCourseOverrides<T>(courses: T[]): T[] {
  if (!Array.isArray(courses)) return [];
  return courses.map(course => applySingleCourseOverride(course));
}

export function applySingleCourseOverride<T>(course: T): T {
  if (!course || !(course as any).id) return course;
  const override = courseOverridesMemory[(course as any).id];
  if (!override) return course;
  return {
    ...course,
    ...override
  };
}

/**
 * Applies chapter/lesson overrides (e.g. cover_url)
 */
export function applyChapterOverrides<T>(chapters: T[]): T[] {
  if (!Array.isArray(chapters)) return [];
  return chapters.map(chapter => applySingleChapterOverride(chapter));
}

export function applySingleChapterOverride<T>(chapter: T): T {
  if (!chapter || !(chapter as any).id) return chapter;
  const override = chapterOverridesMemory[(chapter as any).id];
  if (!override) return chapter;
  return {
    ...chapter,
    ...override
  };
}

/**
 * Helper to get active admin bearer token
 */
async function getAuthTokenSafe(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.access_token) return refreshed.session.access_token;
  } catch {}
  return null;
}

/**
 * Persists course updates to backend server & local cache with full resilience
 */
export async function saveCourseViaApi(courseId: string, dataToSave: Record<string, any>): Promise<boolean> {
  if (!courseId || !dataToSave) return false;

  // 1. Immediately store in client memory and localStorage for 0ms reactivity
  courseOverridesMemory[courseId] = {
    ...(courseOverridesMemory[courseId] || {}),
    ...dataToSave
  };
  try {
    localStorage.setItem(COURSE_OVERRIDES_CACHE_KEY, JSON.stringify(courseOverridesMemory));
  } catch {}
  notifyOverridesUpdated();

  // 2. Send to backend admin API (persists in server data/course_overrides.json & Supabase DB)
  try {
    const token = await getAuthTokenSafe();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await safeFetch('/api/v1/admin?action=course-save', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        courseId,
        data: dataToSave
      })
    });

    if (response && response.success) {
      return true;
    }
  } catch (err) {
    console.warn('[Overrides] saveCourseViaApi server notice:', err);
  }

  return true;
}

/**
 * Persists chapter updates to backend server & local cache with full resilience
 */
export async function saveChapterViaApi(chapterId: string, dataToSave: Record<string, any>): Promise<boolean> {
  if (!chapterId || !dataToSave) return false;

  // 1. Immediately store in client memory and localStorage for 0ms reactivity
  chapterOverridesMemory[chapterId] = {
    ...(chapterOverridesMemory[chapterId] || {}),
    ...dataToSave
  };
  try {
    localStorage.setItem(CHAPTER_OVERRIDES_CACHE_KEY, JSON.stringify(chapterOverridesMemory));
  } catch {}
  notifyOverridesUpdated();

  // 2. Send to backend admin API (persists in server data/chapter_overrides.json & Supabase DB)
  try {
    const token = await getAuthTokenSafe();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await safeFetch('/api/v1/admin?action=chapter-save', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        chapterId,
        data: dataToSave
      })
    });

    if (response && response.success) {
      return true;
    }
  } catch (err) {
    console.warn('[Overrides] saveChapterViaApi server notice:', err);
  }

  return true;
}
