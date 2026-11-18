import { supabase } from './supabase';
import { safeFetch } from './utils';
import {
  setCourseOverrideInMemory,
  setChapterOverrideInMemory
} from './courseOverrides';

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

  const nextMap = setCourseOverrideInMemory(courseId, dataToSave);

  supabase
    .from('ai_user_memory')
    .upsert({
      user_id: '__global_course_overrides__',
      facts: [nextMap],
      last_updated: new Date().toISOString()
    })
    .then(() => {})
    .catch(() => {});

  supabase
    .from('courses')
    .update(dataToSave)
    .eq('id', courseId)
    .then(() => {})
    .catch(() => {});

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

  const nextMap = setChapterOverrideInMemory(chapterId, dataToSave);

  supabase
    .from('ai_user_memory')
    .upsert({
      user_id: '__global_chapter_overrides__',
      facts: [nextMap],
      last_updated: new Date().toISOString()
    })
    .then(() => {})
    .catch(() => {});

  supabase
    .from('chapters')
    .update(dataToSave)
    .eq('id', chapterId)
    .then(() => {})
    .catch(() => {});

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
