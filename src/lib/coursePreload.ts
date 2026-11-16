import { supabase } from './supabase';
import { dataCache } from './cache';
import { Course } from '../types/lms';

const PERMANENT_CATALOG_KEY = 'mp_permanent_courses_catalog';
const PERMANENT_CATALOG_META_KEY = 'mp_permanent_catalog_meta';
let preloadPromise: Promise<Course[]> | null = null;

export interface CachedCatalogMeta {
  courseChapters: Record<string, string[]>;
  courseStats: Record<string, { lessons: number; materials: number }>;
}

export function stripHeavyCourseDataForCache(course: any): Course {
  if (!course || typeof course !== 'object') return course;
  const { preview_rich_text: _prt, modal_html: _mh, ...rest } = course;
  const cleanBenefits = Array.isArray(rest.benefits)
    ? rest.benefits.filter((b: any) => typeof b === 'string' && !b.startsWith('<!--__PWA_MODAL_HTML__-->')).slice(0, 12)
    : rest.benefits;
  return {
    ...rest,
    benefits: cleanBenefits,
    _lightweight: true
  } as Course;
}

export function getPermanentCachedCatalogMeta(): CachedCatalogMeta | null {
  const memory = dataCache.get('global_public_catalog_meta', true);
  if (memory && memory.courseChapters && Object.keys(memory.courseChapters).length > 0) {
    return memory;
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(PERMANENT_CATALOG_META_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.courseChapters && Object.keys(parsed.courseChapters).length > 0) {
          dataCache.set('global_public_catalog_meta', parsed, 86400000, false);
          return parsed;
        }
      }
    } catch {}
  }

  return null;
}

export function savePermanentCatalogMeta(
  courseChapters: Record<string, string[]>,
  courseStats: Record<string, { lessons: number; materials: number }>
) {
  if (!courseChapters || Object.keys(courseChapters).length === 0) return;
  const meta: CachedCatalogMeta = { courseChapters, courseStats: courseStats || {} };
  dataCache.set('global_public_catalog_meta', meta, 86400000, false);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PERMANENT_CATALOG_META_KEY, JSON.stringify(meta));
    } catch {}
  }
}

export function getPermanentCachedCourses(): Course[] | null {
  // 1. Try in-memory / dataCache first
  const memory = dataCache.get('global_public_courses_catalog', true);
  if (memory && Array.isArray(memory) && memory.length > 0) {
    return memory;
  }

  // 2. Try localStorage permanent backup
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(PERMANENT_CATALOG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Warm up dataCache in memory
          dataCache.set('global_public_courses_catalog', parsed, 86400000, false);
          return parsed;
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  return null;
}

export async function preloadCoursesCatalog(): Promise<Course[]> {
  // Return cached immediately if both courses AND chapter meta are available
  const existing = getPermanentCachedCourses();
  const existingMeta = getPermanentCachedCatalogMeta();
  if (existing && existing.length > 0 && existingMeta) {
    return existing;
  }

  // Deduplicate in-flight requests
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
    // 1. Fast path: hit bootstrap endpoint (warms up server catalog cache + fetches stripped courses + chapter map in 1 request)
    try {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch('/api/v1/progress?action=bootstrap', { signal: controller.signal })
        .finally(() => clearTimeout(tId));
      if (resp.ok) {
        const boot = await resp.json();
        if (boot?.success && Array.isArray(boot.courses) && boot.courses.length > 0) {
          const active = boot.courses.map(stripHeavyCourseDataForCache);
          dataCache.set('global_public_courses_catalog', active, 86400000, false);
          if (boot.courseChapters && Object.keys(boot.courseChapters).length > 0) {
            savePermanentCatalogMeta(boot.courseChapters, boot.courseStats || {});
          }
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(PERMANENT_CATALOG_KEY, JSON.stringify(active));
              window.dispatchEvent(new CustomEvent('app_courses_catalog_updated', { detail: active }));
            } catch {}
          }
          return active;
        }
      }
    } catch {}

    // 2. Fallback: direct Supabase query
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        let res = await supabase
          .from('courses')
          .select('*')
          .order('order_index', { ascending: true });

        if (res.error && (res.error.code === '42703' || res.error.message?.includes('order_index'))) {
          res = await supabase
            .from('courses')
            .select('*')
            .order('created_at', { ascending: true });
        }

        let coursesData = res.data;
        if (!coursesData || coursesData.length === 0) {
          const fallback = await supabase.from('courses').select('*');
          if (fallback.data && fallback.data.length > 0) {
            coursesData = fallback.data;
          }
        }

        if (coursesData && coursesData.length > 0) {
          const active = coursesData
            .filter((c: any) => c.is_active !== false)
            .map(stripHeavyCourseDataForCache);
          if (active.length > 0) {
            dataCache.set('global_public_courses_catalog', active, 86400000, false);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(PERMANENT_CATALOG_KEY, JSON.stringify(active));
                window.dispatchEvent(new CustomEvent('app_courses_catalog_updated', { detail: active }));
              } catch {}
            }
            return active;
          }
        }
      } catch (err) {
        console.warn(`Preload courses attempt ${attempt} warning:`, err);
      }

      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return getPermanentCachedCourses() || [];
  })().finally(() => {
    preloadPromise = null;
  });

  return preloadPromise;
}

