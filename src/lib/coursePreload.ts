import { supabase } from './supabase';
import { dataCache } from './cache';
import { Course } from '../types/lms';

const PERMANENT_CATALOG_KEY = 'mp_permanent_courses_catalog';
let preloadPromise: Promise<Course[]> | null = null;

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
          // Warm up dataCache
          dataCache.set('global_public_courses_catalog', parsed, 86400000);
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
  // Return cached immediately if available
  const existing = getPermanentCachedCourses();
  if (existing && existing.length > 0) {
    return existing;
  }

  // Deduplicate in-flight requests
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
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
            dataCache.set('global_public_courses_catalog', active, 86400000);
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

