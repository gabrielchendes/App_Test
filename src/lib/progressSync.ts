import { UserProgress } from '../types/lms';
import { supabase } from './supabase';
import { dataCache } from './cache';
import { safeFetch } from './utils';

export const PROGRESS_UPDATED_EVENT = 'mt_user_progress_updated';
const PROGRESS_BROADCAST_CHANNEL = 'mt_user_progress_channel';

const isUUID = (str?: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

export interface ProgressUpdateDetail {
  userId: string;
  courseId?: string;
  chapterId?: string;
  completed?: boolean;
  progressList?: UserProgress[];
  courseChapterIds?: string[];
  timestamp?: number;
}

function getDirtyStorageKey(userId: string): string {
  return `mp_dirty_progress_${userId}`;
}

export function getDirtyProgressChapterIds(userId?: string): Set<string> {
  if (typeof window === 'undefined' || !userId) return new Set();
  try {
    const raw = localStorage.getItem(getDirtyStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((id) => typeof id === 'string' && id.length > 0));
    }
  } catch {}
  return new Set();
}

export function markProgressChapterDirty(userIds: (string | undefined)[], chapterId: string): void {
  if (typeof window === 'undefined' || !chapterId) return;
  const distinctIds = Array.from(new Set(userIds.filter((id): id is string => Boolean(id && id.trim()))));
  for (const uid of distinctIds) {
    try {
      const dirty = getDirtyProgressChapterIds(uid);
      dirty.add(chapterId);
      localStorage.setItem(getDirtyStorageKey(uid), JSON.stringify(Array.from(dirty)));
    } catch {}
  }
}

export function clearProgressChapterDirty(userIds: (string | undefined)[], chapterId: string): void {
  if (typeof window === 'undefined' || !chapterId) return;
  const distinctIds = Array.from(new Set(userIds.filter((id): id is string => Boolean(id && id.trim()))));
  for (const uid of distinctIds) {
    try {
      const dirty = getDirtyProgressChapterIds(uid);
      if (dirty.has(chapterId)) {
        dirty.delete(chapterId);
        if (dirty.size === 0) {
          localStorage.removeItem(getDirtyStorageKey(uid));
        } else {
          localStorage.setItem(getDirtyStorageKey(uid), JSON.stringify(Array.from(dirty)));
        }
      }
    } catch {}
  }
}

export function readLocalProgressEntries(
  userIds: (string | undefined)[],
  onlyDirty = false
): UserProgress[] {
  if (typeof window === 'undefined') return [];
  const distinctIds = Array.from(
    new Set(userIds.filter((id): id is string => Boolean(id && id.trim())))
  );
  const byChapter = new Map<string, UserProgress>();

  for (const uid of distinctIds) {
    const dirtySet = onlyDirty ? getDirtyProgressChapterIds(uid) : null;
    const prefix = `user_progress_${uid}_`;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const chapId = key.substring(prefix.length);
          if (!chapId) continue;
          // Synthetic non-UUID chapters (e.g. pdf-<courseId>) live only in localStorage
          const isSynthetic = !isUUID(chapId);
          if (onlyDirty && dirtySet && !dirtySet.has(chapId) && !isSynthetic) {
            continue;
          }
          const isDone = localStorage.getItem(key) === 'true';
          byChapter.set(chapId, {
            user_id: uid,
            chapter_id: chapId,
            completed: isDone,
          });
        }
      }
    } catch {}
  }

  return Array.from(byChapter.values());
}

export function writeLocalProgressEntry(
  userIds: (string | undefined)[],
  chapterId: string,
  completed: boolean
): void {
  if (typeof window === 'undefined' || !chapterId) return;
  const distinctIds = Array.from(
    new Set(userIds.filter((id): id is string => Boolean(id && id.trim())))
  );
  for (const uid of distinctIds) {
    try {
      localStorage.setItem(`user_progress_${uid}_${chapterId}`, String(completed));
    } catch {}
  }
}

export function mergeProgressLists(
  baseList: UserProgress[] = [],
  overrideList: UserProgress[] = []
): UserProgress[] {
  const byChapter = new Map<string, UserProgress>();

  for (const item of baseList) {
    if (item && item.chapter_id) {
      byChapter.set(item.chapter_id, { ...item, completed: Boolean(item.completed) });
    }
  }

  for (const item of overrideList) {
    if (item && item.chapter_id) {
      byChapter.set(item.chapter_id, { ...item, completed: Boolean(item.completed) });
    }
  }

  return Array.from(byChapter.values());
}

export function upsertProgressItem(
  list: UserProgress[] = [],
  userId: string,
  chapterId: string,
  completed: boolean
): UserProgress[] {
  return mergeProgressLists(list, [{ user_id: userId, chapter_id: chapterId, completed }]);
}

export function patchCachedProgress(
  userId: string | undefined,
  courseId: string | undefined,
  updatedProgressList?: UserProgress[],
  chapterId?: string,
  completed?: boolean,
  updatedCourseChapterIds?: string[]
): void {
  if (courseId) {
    const courseCacheKey = `course_full_${courseId}`;
    const existingCourseCache = dataCache.get(courseCacheKey, true);
    if (existingCourseCache && typeof existingCourseCache === 'object') {
      let nextCourseProgress: UserProgress[] = existingCourseCache.progress || [];
      if (updatedProgressList) {
        nextCourseProgress = mergeProgressLists(nextCourseProgress, updatedProgressList);
      } else if (chapterId !== undefined && completed !== undefined && userId) {
        nextCourseProgress = upsertProgressItem(nextCourseProgress, userId, chapterId, completed);
      }
      dataCache.set(
        courseCacheKey,
        {
          ...existingCourseCache,
          progress: nextCourseProgress,
        },
        600000
      );
    }
  }

  if (userId) {
    const dashCacheKey = `dashboard_data_${userId}`;
    const existingDashCache = dataCache.get(dashCacheKey, true);
    if (existingDashCache && typeof existingDashCache === 'object') {
      let nextDashProgress: UserProgress[] = existingDashCache.userProgress || [];
      if (updatedProgressList) {
        nextDashProgress = mergeProgressLists(nextDashProgress, updatedProgressList);
      } else if (chapterId !== undefined && completed !== undefined) {
        nextDashProgress = upsertProgressItem(nextDashProgress, userId, chapterId, completed);
      }

      const nextCourseChapters = { ...(existingDashCache.courseChapters || {}) };
      if (courseId && updatedCourseChapterIds && updatedCourseChapterIds.length > 0) {
        nextCourseChapters[courseId] = updatedCourseChapterIds;
      }

      dataCache.set(
        dashCacheKey,
        {
          ...existingDashCache,
          userProgress: nextDashProgress,
          courseChapters: nextCourseChapters,
        },
        600000
      );
    }
  }
}

export function emitProgressUpdated(detail: ProgressUpdateDetail): void {
  if (typeof window === 'undefined') return;
  const payload: ProgressUpdateDetail = {
    ...detail,
    timestamp: detail.timestamp || Date.now(),
  };

  try {
    window.dispatchEvent(new CustomEvent<ProgressUpdateDetail>(PROGRESS_UPDATED_EVENT, { detail: payload }));
  } catch {}

  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(PROGRESS_BROADCAST_CHANNEL);
      bc.postMessage(payload);
      bc.close();
    }
  } catch {}
}

export function subscribeProgressChannel(
  handler: (detail: ProgressUpdateDetail) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const onWindowEvent = (e: Event) => {
    const customEvent = e as CustomEvent<ProgressUpdateDetail>;
    if (customEvent?.detail) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(PROGRESS_UPDATED_EVENT, onWindowEvent);

  let bc: BroadcastChannel | null = null;
  const onBcMessage = (e: MessageEvent<ProgressUpdateDetail>) => {
    if (e?.data) {
      handler(e.data);
    }
  };

  try {
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel(PROGRESS_BROADCAST_CHANNEL);
      bc.addEventListener('message', onBcMessage);
    }
  } catch {}

  return () => {
    window.removeEventListener(PROGRESS_UPDATED_EVENT, onWindowEvent);
    if (bc) {
      try {
        bc.removeEventListener('message', onBcMessage);
        bc.close();
      } catch {}
    }
  };
}

export async function fetchUserProgressWithFallback(
  userId?: string,
  extraUserIds: (string | undefined)[] = []
): Promise<{ data: UserProgress[]; fromRemote: boolean }> {
  const allIds = Array.from(new Set([userId, ...extraUserIds].filter((id): id is string => Boolean(id && id.trim()))));
  let remoteRows: UserProgress[] | null = null;

  const targetUuid = allIds.find((id) => isUUID(id));

  if (targetUuid) {
    let userToken: string | undefined;
    let hasActiveMatchingSession = false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      userToken = sessionData?.session?.access_token;
      hasActiveMatchingSession = Boolean(sessionData?.session?.user?.id && sessionData.session.user.id === targetUuid);
    } catch {}

    // Only trust direct RLS-filtered client query when an active matching Supabase session exists
    if (hasActiveMatchingSession) {
      try {
        const { data, error } = await supabase
          .from('user_progress')
          .select('chapter_id, completed, user_id')
          .eq('user_id', targetUuid);

        if (!error && Array.isArray(data)) {
          remoteRows = data as UserProgress[];
        }
      } catch {}
    }

    // If session is not active or direct Supabase query failed, query backend endpoint (uses service role)
    if (remoteRows === null) {
      try {
        const apiRes = await safeFetch(`/api/v1/progress?userId=${encodeURIComponent(targetUuid)}`, {
          method: 'GET',
          headers: {
            ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
          },
        });

        if (apiRes?.success && Array.isArray(apiRes.data)) {
          remoteRows = apiRes.data as UserProgress[];
        }
      } catch {}
    }

    // Final safety fallback: try direct query anyway if API failed (e.g. offline/anon granted)
    if (remoteRows === null && !hasActiveMatchingSession) {
      try {
        const { data, error } = await supabase
          .from('user_progress')
          .select('chapter_id, completed, user_id')
          .eq('user_id', targetUuid);

        if (!error && Array.isArray(data) && data.length > 0) {
          remoteRows = data as UserProgress[];
        }
      } catch {}
    }
  }

  if (remoteRows !== null) {
    // Sync remote state back to localStorage for non-dirty chapters, then overlay any pending/synthetic local entries
    const dirtySet = new Set<string>();
    for (const uid of allIds) {
      getDirtyProgressChapterIds(uid).forEach((id) => dirtySet.add(id));
    }

    for (const row of remoteRows) {
      if (row?.chapter_id && !dirtySet.has(row.chapter_id)) {
        writeLocalProgressEntry(allIds, row.chapter_id, Boolean(row.completed));
      }
    }

    const pendingOrSynthetic = readLocalProgressEntries(allIds, true);
    return {
      data: mergeProgressLists(remoteRows, pendingOrSynthetic),
      fromRemote: true,
    };
  }

  // Fallback when offline or remote unreachable: keep all localStorage entries
  return {
    data: readLocalProgressEntries(allIds, false),
    fromRemote: false,
  };
}
