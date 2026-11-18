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

let lastSyncTime = 0;

/**
 * Hydrates overrides synchronously from the single Dashboard bootstrap response
 * so zero extra network requests are needed on initial load.
 */
export function hydrateOverridesFromBootstrap(
  courseOverrides?: Record<string, any> | null,
  chapterOverrides?: Record<string, any> | null
): void {
  if (typeof window === 'undefined') return;
  let changed = false;

  if (courseOverrides && typeof courseOverrides === 'object' && Object.keys(courseOverrides).length > 0) {
    courseOverridesMemory = { ...courseOverridesMemory, ...courseOverrides };
    changed = true;
    try {
      localStorage.setItem(COURSE_OVERRIDES_CACHE_KEY, JSON.stringify(courseOverridesMemory));
    } catch {}
  }

  if (chapterOverrides && typeof chapterOverrides === 'object' && Object.keys(chapterOverrides).length > 0) {
    chapterOverridesMemory = { ...chapterOverridesMemory, ...chapterOverrides };
    changed = true;
    try {
      localStorage.setItem(CHAPTER_OVERRIDES_CACHE_KEY, JSON.stringify(chapterOverridesMemory));
    } catch {}
  }

  lastSyncTime = Date.now();
  if (changed) {
    notifyOverridesUpdated();
  }
}

/**
 * Sync overrides from server endpoint in background
 */
export async function syncOverridesFromServer(force = false): Promise<void> {
  if (isSyncing || typeof window === 'undefined') return;
  if (!force && lastSyncTime > 0 && Date.now() - lastSyncTime < 60000) return;
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

    // Direct cloud sync from Supabase ai_user_memory for guaranteed Vercel persistence
    try {
      const { data: rows } = await supabase
        .from('ai_user_memory')
        .select('user_id, facts')
        .in('user_id', ['__global_course_overrides__', '__global_chapter_overrides__']);

      if (Array.isArray(rows)) {
        for (const row of rows) {
          const first = Array.isArray(row?.facts) ? row.facts[0] : null;
          if (!first || typeof first !== 'object') continue;
          if (row.user_id === '__global_course_overrides__') {
            courseOverridesMemory = { ...courseOverridesMemory, ...first };
            changed = true;
            try {
              localStorage.setItem(COURSE_OVERRIDES_CACHE_KEY, JSON.stringify(courseOverridesMemory));
            } catch {}
          } else if (row.user_id === '__global_chapter_overrides__') {
            chapterOverridesMemory = { ...chapterOverridesMemory, ...first };
            changed = true;
            try {
              localStorage.setItem(CHAPTER_OVERRIDES_CACHE_KEY, JSON.stringify(chapterOverridesMemory));
            } catch {}
          }
        }
      }
    } catch {}

    lastSyncTime = Date.now();
    if (changed) {
      notifyOverridesUpdated();
    }
  } catch (err) {
    console.debug?.('[Overrides] Sync notice:', err);
  } finally {
    isSyncing = false;
  }
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

export function setCourseOverrideInMemory(courseId: string, dataToSave: Record<string, any>): Record<string, Record<string, any>> {
  courseOverridesMemory[courseId] = {
    ...(courseOverridesMemory[courseId] || {}),
    ...dataToSave
  };
  try {
    localStorage.setItem(COURSE_OVERRIDES_CACHE_KEY, JSON.stringify(courseOverridesMemory));
  } catch {}
  notifyOverridesUpdated();
  return courseOverridesMemory;
}

export function setChapterOverrideInMemory(chapterId: string, dataToSave: Record<string, any>): Record<string, Record<string, any>> {
  chapterOverridesMemory[chapterId] = {
    ...(chapterOverridesMemory[chapterId] || {}),
    ...dataToSave
  };
  try {
    localStorage.setItem(CHAPTER_OVERRIDES_CACHE_KEY, JSON.stringify(chapterOverridesMemory));
  } catch {}
  notifyOverridesUpdated();
  return chapterOverridesMemory;
}
