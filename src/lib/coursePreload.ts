import { supabase } from './supabase';
import { dataCache } from './cache';
import { Course } from '../types/lms';

let preloadPromise: Promise<Course[]> | null = null;

export async function preloadCoursesCatalog(): Promise<Course[]> {
  // Return cached immediately if available
  const cached = dataCache.get('global_public_courses_catalog', true);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  // Deduplicate in-flight requests
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
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

      if (res.data && res.data.length > 0) {
        const active = res.data.filter((c: any) => c.is_active !== false);
        dataCache.set('global_public_courses_catalog', active, 600000); // 10 minutes cache
        return active;
      } else if (res.error) {
        const fallback = await supabase.from('courses').select('*');
        if (fallback.data && fallback.data.length > 0) {
          const active = fallback.data.filter((c: any) => c.is_active !== false);
          dataCache.set('global_public_courses_catalog', active, 600000);
          return active;
        }
      }
      return [];
    } catch (err) {
      console.warn('Preload courses warning:', err);
      return [];
    } finally {
      preloadPromise = null;
    }
  })();

  return preloadPromise;
}
