import { useState, useEffect, useCallback, useMemo, memo, Suspense, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import BannerCarousel from '../components/BannerCarousel';
import Carousel from '../components/Carousel';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard';
import FloatingWhatsApp from '../components/FloatingWhatsApp';
import SupportSection from '../components/SupportSection';
import { HomeTestimonialCard } from '../components/HomeTestimonialCard';
import { TestimonialPage } from '../components/TestimonialPage';
import { InspiringStoriesPage } from '../components/InspiringStoriesPage';
import PullToRefresh from '../components/PullToRefresh';
import WhatsAppIcon from '../components/WhatsAppIcon';
import SmartHomeHeader from '../components/SmartHomeHeader';
import { getDeviceType, isPWAInstalled, getDeferredPrompt, promptPWAInstall, installOnAndroidDirectly, subscribeToPrompt } from '../lib/pwa';
import { toast, showToast } from '../lib/customToast';
import { X, ShoppingBag, Loader2, Play, BookOpen, Star, Sparkles, Mail as MailIcon, MessageCircle, Book, Bell, Smartphone, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createNotification } from '../lib/notifications';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { Course, Chapter, Module } from '../types/lms';
import { fromDbChapter } from '../utils/htmlAppHelper';
import { dataCache } from '../lib/cache';
import { cn } from '../lib/utils';
import { lazyWithRetry } from '../lib/lazyWithRetry';
import { GlowingSpinner } from '../components/GlowingSpinner';
import { parseCourseHtmlFunnel } from '../utils/courseFunnel';
import PWAInstallModal from '../components/PWAInstallModal';
import { applyCourseOverrides, hydrateOverridesFromBootstrap, syncOverridesFromServer, useCourseOverridesSync } from '../lib/courseOverrides';
import { getPermanentCachedCourses, stripHeavyCourseDataForCache } from '../lib/coursePreload';

const isUUID = (str?: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

function readFastAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('maternidade_premium_auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.access_token || parsed?.currentSession?.access_token || null;
    }
  } catch {}
  return null;
}

function mergeLocalProgress(userId: string | undefined, serverProgress: any[]): any[] {
  const map = new Map<string, any>();
  if (Array.isArray(serverProgress)) {
    for (const p of serverProgress) {
      if (p?.chapter_id) {
        map.set(p.chapter_id, p);
      }
    }
  }
  if (typeof window !== 'undefined' && userId) {
    try {
      const prefix = `user_progress_${userId}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const chapId = key.substring(prefix.length);
          const isDone = localStorage.getItem(key) === 'true';
          const existing = map.get(chapId);
          if (existing) {
            if (isDone && !existing.completed) {
              map.set(chapId, { ...existing, completed: true });
            }
          } else if (isDone) {
            map.set(chapId, { user_id: userId, chapter_id: chapId, completed: true });
          }
        }
      }
    } catch {}
  }
  return Array.from(map.values());
}

// Lazy load heavy components and modals
const Profile = lazyWithRetry(() => import('../components/Profile'));
const Community = lazyWithRetry(() => import('../components/Community'));
const AdminPanel = lazyWithRetry(() => import('../components/AdminPanel'));
const CourseViewer = lazyWithRetry(() => import('../components/CourseViewer'));
const CoursePreviewViewer = lazyWithRetry(() => import('../components/CoursePreviewViewer'));
const AiAssistantModal = lazyWithRetry(() => import('../components/AiAssistantModal'));
const AccessDeniedModal = lazyWithRetry(() => import('../components/AccessDeniedModal'));

const ComponentLoader = () => (
  <div className="w-full py-20 flex items-center justify-center">
    <GlowingSpinner size="md" />
  </div>
);

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  useCourseOverridesSync();
  const { settings } = useSettings();
  const { t } = useI18n();

  // Instant synchronous cache retrieval for 0ms initial render
  const cacheKey = `dashboard_data_${user?.id}`;
  const profileCacheKey = `dashboard_profile_${user?.id}`;
  const initialCached = useMemo(() => {
    const userCached = user?.id ? dataCache.getSync(cacheKey, null) : null;
    if (userCached?.courses?.length) {
      return {
        ...userCached,
        courses: applyCourseOverrides(userCached.courses),
        isFullUserCache: true
      };
    }

    // Fallback: check global catalog cache (memory or localStorage permanent backup) so screen has courses immediately
    const permanentCached = getPermanentCachedCourses();
    if (permanentCached && Array.isArray(permanentCached) && permanentCached.length > 0) {
      return {
        courses: applyCourseOverrides(permanentCached),
        purchases: [],
        userProgress: [],
        courseStats: {},
        courseChapters: {},
        isFullUserCache: false
      };
    }
    return null;
  }, [user?.id, cacheKey]);

  const [courses, setCourses] = useState<Course[]>(() => initialCached?.courses || []);
  const [courseChapters, setCourseChapters] = useState<Record<string, string[]>>(() => initialCached?.courseChapters || {});
  const [courseStats, setCourseStats] = useState<Record<string, { lessons: number, materials: number }>>(() => initialCached?.courseStats || {});
  const [purchases, setPurchases] = useState<{product_id: string, created_at: any}[]>(() => initialCached?.purchases || []);
  const [userProgress, setUserProgress] = useState<any[]>(() => mergeLocalProgress(user?.id, initialCached?.userProgress || []));
  const [userProfile, setUserProfile] = useState<{ has_access?: boolean; has_unlimited_ai?: boolean; is_admin?: boolean } | null>(() => {
    if (user?.id) {
      return dataCache.getSync(profileCacheKey, null);
    }
    return null;
  });
  // Loading is only false if we already have the full user cache (both courses and purchases)
  const [loading, setLoading] = useState(() => !initialCached?.isFullUserCache);
  const [hasInitialFetchCompleted, setHasInitialFetchCompleted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isWritingTestimonial, setIsWritingTestimonial] = useState(false);
  const [isViewingTestimonials, setIsViewingTestimonials] = useState(false);

  // Lifecycles and deduplication refs
  const fetchInProgressRef = useRef(false);
  const hasFetchedOnceRef = useRef(false);
  const prevViewingCourseIdRef = useRef<string | null>(null);
  const userProgressRef = useRef<any[]>(userProgress);
  useEffect(() => {
    userProgressRef.current = userProgress;
  }, [userProgress]);

  const syncProgressToDashboardCache = useCallback((nextProgress: any[]) => {
    if (!user?.id) return;
    const existing = dataCache.get(cacheKey, true);
    if (existing && Array.isArray(existing.courses) && existing.courses.length > 0) {
      dataCache.set(cacheKey, { ...existing, userProgress: nextProgress }, 600000);
    }
  }, [user?.id, cacheKey]);

  // Listen for background catalog preloads so if courses were empty, they populate immediately
  useEffect(() => {
    const handleCatalogUpdate = (e: any) => {
      const updatedCourses = e.detail;
      if (Array.isArray(updatedCourses) && updatedCourses.length > 0) {
        setCourses(prev => prev.length === 0 ? applyCourseOverrides(updatedCourses) : prev);
      }
    };
    window.addEventListener('app_courses_catalog_updated', handleCatalogUpdate);
    return () => window.removeEventListener('app_courses_catalog_updated', handleCatalogUpdate);
  }, []);

  // Safety ceiling to prevent permanent loading spinner in case of offline/network failure
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setHasInitialFetchCompleted(prev => prev || courses.length > 0);
    }, 8000);
    return () => clearTimeout(safetyTimer);
  }, [courses.length]);


  useEffect(() => {
    if (isAiModalOpen && user?.id) {
      const fetchProfile = async () => {
        const isUUID = (str?: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

        let profileData = null;
        if (isUUID(user.id)) {
          const { data } = await supabase
            .from('profiles')
            .select('has_access, has_unlimited_ai, is_admin')
            .eq('id', user.id)
            .maybeSingle();
          profileData = data;
        }

        if (!profileData && user.email) {
          const { data } = await supabase
            .from('profiles')
            .select('has_access, has_unlimited_ai, is_admin')
            .eq('email', user.email.toLowerCase())
            .maybeSingle();
          profileData = data;
        }

        if (profileData) {
          setUserProfile(profileData);
        }
      };

      fetchProfile().catch(e => console.warn('Error fetching profile in AI modal:', e));
    }
  }, [isAiModalOpen, user?.id, user?.email]);
  const [activeTab, setActiveTab] = useState<'home' | 'profile' | 'community' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam === 'community' || tabParam === 'admin' || tabParam === 'profile' || tabParam === 'home') {
        return tabParam;
      }
      if (urlParams.get('subtab') === 'testimonials' || urlParams.get('subtab') === 'questions') {
        return 'admin';
      }
      const hash = window.location.hash.replace('#', '');
      if (hash === 'community' || hash === 'admin' || hash === 'profile' || hash === 'home') {
        return hash as any;
      }
      if (hash === 'testimonials' || hash === 'questions') {
        return 'admin';
      }
    }
    return 'home';
  });

  useEffect(() => {
    const handleUrlChange = () => {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam === 'community' || tabParam === 'admin' || tabParam === 'profile' || tabParam === 'home') {
          setActiveTab(tabParam as any);
        } else if (urlParams.get('subtab') === 'testimonials' || urlParams.get('subtab') === 'questions') {
          setActiveTab('admin');
        }
        const hash = window.location.hash.replace('#', '');
        if (hash === 'community' || hash === 'admin' || hash === 'profile' || hash === 'home') {
          setActiveTab(hash as any);
        } else if (hash === 'testimonials' || hash === 'questions') {
          setActiveTab('admin');
        }
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const handleGlobalRefresh = async () => {
    if (activeTab === 'home') {
      await fetchData(true); // User explicitly triggered pull-to-refresh
    }
    setRefreshKey(prev => prev + 1);
    await new Promise(resolve => setTimeout(resolve, 600));
  };

  // Silently sync progress when user closes CourseViewer, WITHOUT fetching courses
  useEffect(() => {
    if (prevViewingCourseIdRef.current && !viewingCourseId && user?.id) {
      if (isUUID(user.id)) {
        supabase
          .from('user_progress')
          .select('chapter_id, completed, user_id')
          .eq('user_id', user.id)
          .then(({ data }) => {
            if (data && data.length > 0) {
              const merged = mergeLocalProgress(user.id, data);
              setUserProgress(merged);
              syncProgressToDashboardCache(merged);
            }
          })
          .catch(() => {});
      }
    }
    prevViewingCourseIdRef.current = viewingCourseId;
  }, [viewingCourseId, user?.id, syncProgressToDashboardCache]);

  useEffect(() => {
    // Only update hash if it's not already correct to avoid unnecessary history changes
    if (window.location.hash !== `#${activeTab}`) {
      window.history.replaceState(null, '', `#${activeTab}`);
    }

    // Always scroll to top when changing tabs (NO refetch on tab switch)
    window.scrollTo(0, 0);
  }, [activeTab]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showPWAInstall, setShowPWAInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => getDeferredPrompt());
  const [canInstall, setCanInstall] = useState(() => !isPWAInstalled());

  // Check installation status smoothly without background polling
  useEffect(() => {
    const updateInstallStatus = () => {
      const installed = isPWAInstalled();
      setCanInstall(!installed);
    };

    updateInstallStatus();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      updateInstallStatus();
    };

    const handleAppInstalled = () => {
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const unsubscribe = subscribeToPrompt((prompt) => {
      setDeferredPrompt(prompt);
      updateInstallStatus();
    });

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setCanInstall(false);
      } else {
        updateInstallStatus();
      }
    };
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    // Deferred background chunk preloading during idle time so initial progress & dashboard data load at top priority
    const scheduleIdle = (cb: () => void, delayMs: number) => {
      return setTimeout(() => {
        if (typeof (window as any).requestIdleCallback === 'function') {
          (window as any).requestIdleCallback(cb, { timeout: 2000 });
        } else {
          cb();
        }
      }, delayMs);
    };

    // 1. High Priority: CourseViewer and CoursePreviewViewer
    const courseViewerTimer = scheduleIdle(() => {
      import('../components/CourseViewer');
      import('../components/CoursePreviewViewer');
    }, 1400);

    // 2. Medium Priority: Community and Ask Victoria
    const highPriorityTimer = scheduleIdle(() => {
      import('../components/Community');
      import('../components/AiAssistantModal');
      const victoriaAvatar = settings?.custom_texts?.['ai_expert.avatar_url']?.trim() || 'https://fhnmpltilhongdofnzbj.supabase.co/storage/v1/object/public/contents/Victoria.webp';
      const img = new Image();
      img.src = victoriaAvatar;
    }, 2600);

    // 3. Low Priority: Profile tab
    const profileTimer = scheduleIdle(() => {
      import('../components/Profile');
    }, 4000);

    // 4. Admin Panel is strictly on-demand (only loaded when an admin clicks the admin tab)

    return () => {
      clearTimeout(courseViewerTimer);
      clearTimeout(highPriorityTimer);
      clearTimeout(profileTimer);
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    
    // Single, stable initial load of courses on login/mount
    if (!hasFetchedOnceRef.current && user?.id) {
      hasFetchedOnceRef.current = true;
      fetchData(false);
    }

    // Subscribe to real-time progress updates silently without wiping cache
    const channel = supabase
      .channel(`user_progress_dashboard_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_progress',
          filter: `user_id=eq.${user.id}`
        },
        async () => {
          const { data: progressData } = await supabase
            .from('user_progress')
            .select('chapter_id, completed, user_id')
            .eq('user_id', user.id);
            
          if (mounted && progressData) {
            const merged = mergeLocalProgress(user.id, progressData);
            setUserProgress(merged);
            syncProgressToDashboardCache(merged);
          }
        }
      )
      .subscribe();
    
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user.id, syncProgressToDashboardCache]);

  useEffect(() => {
    // Preload top banner assets gently for instant display
    if (settings.banner_images?.length) {
      settings.banner_images.slice(0, 2).forEach((url: string) => {
        const img = new Image();
        img.src = url;
      });
    }

    // Check if push prompt should be shown, strictly without auto-downloading Firebase
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const dismissed = localStorage.getItem(`push_modal_dismissed_${user.id}`);
        if (!dismissed) {
          setShowWelcomeModal(true);
        }
      } else if (Notification.permission === 'granted') {
        // Returning user with permission already granted: sync token & foreground listener lazily in idle time
        import('../lib/pushNotifications').then(({ initPushIfGranted }) => {
          initPushIfGranted(user.id);
        }).catch(() => {});
      }
    }
  }, [user.id, settings.banner_images]);

  const fetchData = async (forceNoCache = false) => {
    if (!user?.id) return;
    
    // Guard against simultaneous overlapping fetches
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;

    const cachedData = forceNoCache ? null : dataCache.get(cacheKey, true);
    
    if (cachedData && cachedData.courses && cachedData.courses.length > 0) {
      setCourses(applyCourseOverrides(cachedData.courses));
      setPurchases(cachedData.purchases || []);
      setUserProgress(mergeLocalProgress(user.id, cachedData.userProgress || []));
      setCourseStats(cachedData.courseStats || {});
      setCourseChapters(cachedData.courseChapters || {});
      setLoading(false);
    }

    let fetchedCoursesData: Course[] = [];

    const finalizeAndCache = (
      rawCourses: any[],
      basePurchases: { product_id: string; created_at: any }[],
      packagesList: any[],
      stats: Record<string, { lessons: number; materials: number }>,
      chapterMap: Record<string, string[]>,
      progData: any[],
      profileData: any
    ) => {
      if (profileData) {
        setUserProfile(profileData);
        dataCache.set(profileCacheKey, profileData, 86400000);
        if (profileData.full_name || profileData.avatar_url) {
          try {
            if (profileData.full_name) localStorage.setItem(`cached_full_name_${user.id}`, profileData.full_name);
            if (profileData.avatar_url) localStorage.setItem(`cached_avatar_url_${user.id}`, profileData.avatar_url);
            window.dispatchEvent(new CustomEvent('user-profile-updated', {
              detail: { full_name: profileData.full_name, avatar_url: profileData.avatar_url }
            }));
          } catch {}
        }
      }

      const purchasedIds = basePurchases.map(p => p.product_id);
      const unlockedByPackages = new Set<string>();
      const packageUnlockDates: Record<string, string> = {};
      const courseToPackageCheckout: Record<string, string> = {};

      if (Array.isArray(packagesList)) {
        packagesList.forEach((pkg: any) => {
          if (pkg.hotmart_checkout_url) {
            pkg.package_courses?.forEach((pc: any) => {
              if (!courseToPackageCheckout[pc.course_id]) {
                courseToPackageCheckout[pc.course_id] = pkg.hotmart_checkout_url!;
              }
            });
          }

          const purchase = basePurchases.find(p => p.product_id === pkg.hotmart_product_id || p.product_id === pkg.id);
          if (purchase) {
            pkg.package_courses?.forEach((pc: any) => {
              unlockedByPackages.add(pc.course_id);
              packageUnlockDates[pc.course_id] = purchase.created_at;
            });
          }
        });
      }

      const mainPrice = parseFloat(settings?.custom_texts?.['main_price'] || '0') || 0;
      const mainCheckoutUrl = settings?.custom_texts?.['main_checkout_url'] || '';

      const processedCourses = applyCourseOverrides(rawCourses).map((c: any) => {
        const funnelParsed = parseCourseHtmlFunnel(c);
        const isMainCourse = !!c.is_free && !c.is_bonus;
        const effectivePdf = c.pdf_url || c.preview_pdf_url || '';
        return {
          ...c,
          ...funnelParsed,
          pdf_url: effectivePdf,
          preview_pdf_url: c.preview_pdf_url || effectivePdf,
          price: isMainCourse ? mainPrice : c.price,
          checkout_url: isMainCourse ? mainCheckoutUrl : (courseToPackageCheckout[c.id] || c.checkout_url)
        };
      });

      const allPurchases = [...basePurchases];
      Array.from(unlockedByPackages).forEach(id => {
        if (!purchasedIds.includes(id)) {
          allPurchases.push({ product_id: id, created_at: packageUnlockDates[id] });
        }
      });

      // Ensure courses with PDF materials reflect at least 1 material in stats
      processedCourses.forEach((c: any) => {
        if ((c.pdf_url || c.preview_pdf_url) && (!stats[c.id] || (stats[c.id].lessons === 0 && stats[c.id].materials === 0))) {
          if (!stats[c.id]) stats[c.id] = { lessons: 0, materials: 1 };
          else stats[c.id].materials = 1;
        }
      });

      const mergedProgress = mergeLocalProgress(user.id, progData);

      if (processedCourses.length > 0) {
        setCourses(processedCourses);
        const lightweightForCatalog = processedCourses.map(stripHeavyCourseDataForCache);
        dataCache.set('global_public_courses_catalog', lightweightForCatalog, 86400000);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('mp_permanent_courses_catalog', JSON.stringify(lightweightForCatalog));
          } catch {}
        }
      }
      setPurchases(allPurchases);
      setUserProgress(mergedProgress);
      setCourseStats(stats);
      setCourseChapters(chapterMap);

      if (processedCourses.length > 0) {
        const lightweightCourses = processedCourses.map(stripHeavyCourseDataForCache);
        dataCache.set(cacheKey, {
          courses: lightweightCourses,
          purchases: allPurchases,
          userProgress: mergedProgress,
          courseStats: stats,
          courseChapters: chapterMap
        }, 600000);
      }
    };

    try {
      // FAST PATH: Single consolidated server bootstrap (server-cached catalog + parallel user progress/purchases)
      let bootstrapHandled = false;
      try {
        let token = readFastAccessToken();
        if (!token) {
          const { data: sess } = await Promise.race([
            supabase.auth.getSession(),
            new Promise<any>((resolve) => setTimeout(() => resolve({ data: { session: null } }), 350))
          ]);
          token = sess?.session?.access_token || null;
        }

        const params = new URLSearchParams({
          action: 'bootstrap',
          userId: user.id
        });
        if (user.email) params.set('email', user.email);
        if (forceNoCache) params.set('refresh', '1');

        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);
        const resp = await fetch(`/api/v1/progress?${params.toString()}`, {
          headers,
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        if (resp.ok) {
          const boot = await resp.json();
          if (boot?.success && Array.isArray(boot.courses) && boot.courses.length > 0) {
            hydrateOverridesFromBootstrap(boot.courseOverrides, boot.chapterOverrides);
            fetchedCoursesData = boot.courses;

            const basePurchases: { product_id: string; created_at: any }[] = Array.isArray(boot.purchases) ? [...boot.purchases] : [];
            const existingProductIds = new Set(basePurchases.map(p => p.product_id));
            if (Array.isArray(boot.manualGrantedIds)) {
              for (const cid of boot.manualGrantedIds) {
                if (cid && !existingProductIds.has(cid)) {
                  basePurchases.push({ product_id: cid, created_at: new Date().toISOString() });
                  existingProductIds.add(cid);
                }
              }
            }

            let progData: any[] = Array.isArray(boot.userProgress) ? boot.userProgress : [];

            // If server bootstrap couldn't read user_progress directly (e.g. missing token/service key), fetch it directly on client
            if (!boot.userProgressSynced && isUUID(user.id)) {
              try {
                const { data: directProg } = await supabase
                  .from('user_progress')
                  .select('chapter_id, completed, user_id')
                  .eq('user_id', user.id);
                if (Array.isArray(directProg)) {
                  progData = directProg;
                }
              } catch {}
            }

            finalizeAndCache(
              fetchedCoursesData,
              basePurchases,
              Array.isArray(boot.packages) ? boot.packages : [],
              boot.courseStats || {},
              boot.courseChapters || {},
              progData,
              boot.profile || null
            );

            bootstrapHandled = true;
          }
        }
      } catch (bootErr) {
        console.debug?.('[Dashboard] Bootstrap fast-path fallback to direct queries:', bootErr);
      }

      if (bootstrapHandled) {
        return;
      }

      // FALLBACK PATH: Direct parallel Supabase queries with progressive immediate state updates (no waiting for slowest query!)
      syncOverridesFromServer(forceNoCache).catch(() => {});
      let liveProgress: any[] = [];
      let liveStats: Record<string, { lessons: number; materials: number }> = {};
      let liveChapterMap: Record<string, string[]> = {};

      const fetchCoursesPromise = (async (): Promise<Course[]> => {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            let coursesRes = await supabase
              .from('courses')
              .select('*')
              .order('order_index', { ascending: true });

            if (coursesRes.error && (coursesRes.error.code === '42703' || coursesRes.error.message?.includes('order_index'))) {
              coursesRes = await supabase
                .from('courses')
                .select('*')
                .order('created_at', { ascending: true });
            }

            if (coursesRes.data && coursesRes.data.length > 0) {
              return applyCourseOverrides(
                coursesRes.data
                  .filter((c: any) => c.is_active !== false)
                  .map(stripHeavyCourseDataForCache)
              );
            } else if (coursesRes.error) {
              const fallbackRes = await supabase.from('courses').select('*');
              if (fallbackRes.data && fallbackRes.data.length > 0) {
                return applyCourseOverrides(
                  fallbackRes.data
                    .filter((c: any) => c.is_active !== false)
                    .map(stripHeavyCourseDataForCache)
                );
              }
            }
          } catch (err) {
            console.warn(`Courses query attempt ${attempt} error:`, err);
          }

          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 300));
          }
        }

        const permanentBackup = getPermanentCachedCourses();
        if (permanentBackup && permanentBackup.length > 0) {
          return applyCourseOverrides(permanentBackup);
        }

        return [];
      })();

      // Progressive progress query: updates state IMMEDIATELY when it resolves
      const progressPromise = isUUID(user.id)
        ? supabase
            .from('user_progress')
            .select('chapter_id, completed, user_id')
            .eq('user_id', user.id)
            .then((res) => {
              if (Array.isArray(res.data)) {
                liveProgress = res.data;
                setUserProgress(mergeLocalProgress(user.id, res.data));
              }
              return res;
            })
        : Promise.resolve({ data: [], error: null } as any);

      // Progressive chapters query: updates courseChapters & courseStats IMMEDIATELY when it resolves
      const chaptersPromise = supabase
        .from('chapters')
        .select('id, content_type, modules!inner(course_id)')
        .then((res) => {
          if (Array.isArray(res.data)) {
            const s: Record<string, { lessons: number; materials: number }> = {};
            const chMap: Record<string, string[]> = {};
            res.data.forEach((ch: any) => {
              const courseId = ch.modules?.course_id;
              if (courseId) {
                if (!s[courseId]) s[courseId] = { lessons: 0, materials: 0 };
                if (!chMap[courseId]) chMap[courseId] = [];
                chMap[courseId].push(ch.id);
                if (ch.content_type === 'video' || ch.content_type === 'audio' || ch.content_type === 'html' || ch.content_type === 'html_app') {
                  s[courseId].lessons++;
                } else {
                  s[courseId].materials++;
                }
              }
            });
            liveStats = s;
            liveChapterMap = chMap;
            setCourseStats(s);
            setCourseChapters(chMap);
          }
          return res;
        });

      const [coursesResult, purchasesByIdResult, _progressResult, packagesResult, _chaptersResult, profileResult, manualGrantsResult] = await Promise.allSettled([
        fetchCoursesPromise,
        supabase.from('purchases').select('product_id, created_at').eq('user_id', user.id),
        progressPromise,
        supabase.from('course_packages').select('id, hotmart_product_id, hotmart_checkout_url, package_courses(course_id)'),
        chaptersPromise,
        isUUID(user.id) ? supabase.from('profiles').select('has_access, has_unlimited_ai, is_admin, full_name, avatar_url').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
        supabase.from('ai_user_memory').select('facts').eq('user_id', '__global_manual_purchases__').maybeSingle()
      ]);

      if (coursesResult.status === 'fulfilled' && Array.isArray(coursesResult.value) && coursesResult.value.length > 0) {
        fetchedCoursesData = coursesResult.value;
      }

      if (fetchedCoursesData.length === 0) {
        if (courses.length > 0) {
          fetchedCoursesData = courses;
        } else {
          const globalCatalog = getPermanentCachedCourses();
          if (globalCatalog && Array.isArray(globalCatalog) && globalCatalog.length > 0) {
            fetchedCoursesData = globalCatalog;
          }
        }
      }

      let basePurchases: { product_id: string; created_at: any }[] = [];
      if (purchasesByIdResult.status === 'fulfilled' && (purchasesByIdResult.value as any)?.data) {
        basePurchases = (purchasesByIdResult.value as any).data;
      }

      if (user.email && user.email.toLowerCase() !== user.id && !isUUID(user.id)) {
        try {
          const { data: emailPurchases, error: emailPurErr } = await supabase
            .from('purchases')
            .select('product_id, created_at')
            .eq('user_id', user.email.toLowerCase());
          if (!emailPurErr && emailPurchases && emailPurchases.length > 0) {
            const existingProductIds = new Set(basePurchases.map(p => p.product_id));
            emailPurchases.forEach(ep => {
              if (!existingProductIds.has(ep.product_id)) {
                basePurchases.push(ep);
                existingProductIds.add(ep.product_id);
              }
            });
          }
        } catch {}
      }

      if (manualGrantsResult.status === 'fulfilled' && (manualGrantsResult.value as any)?.data?.facts?.[0]) {
        try {
          const cloudMap = (manualGrantsResult.value as any).data.facts[0];
          const userKeys = [user.id?.toLowerCase(), user.email?.toLowerCase()].filter(Boolean) as string[];
          const existingProductIds = new Set(basePurchases.map(p => p.product_id));
          for (const k of userKeys) {
            const grantedCourses = cloudMap[k];
            if (Array.isArray(grantedCourses)) {
              for (const cid of grantedCourses) {
                if (cid && !existingProductIds.has(cid)) {
                  basePurchases.push({ product_id: cid, created_at: new Date().toISOString() });
                  existingProductIds.add(cid);
                }
              }
            }
          }
        } catch (mErr) {
          console.warn('[Dashboard] Cloud manual grants merge note:', mErr);
        }
      }

      let profileData = null;
      if (profileResult.status === 'fulfilled' && (profileResult.value as any)?.data) {
        profileData = (profileResult.value as any).data;
      }
      if (!profileData && user.email) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('has_access, has_unlimited_ai, is_admin, full_name, avatar_url')
            .eq('email', user.email.toLowerCase())
            .maybeSingle();
          profileData = data;
        } catch {}
      }

      const packagesList = (packagesResult.status === 'fulfilled' && (packagesResult.value as any)?.data)
        ? (packagesResult.value as any).data
        : [];

      finalizeAndCache(
        fetchedCoursesData,
        basePurchases,
        packagesList,
        liveStats,
        liveChapterMap,
        liveProgress,
        profileData
      );
    } catch (error: any) {
      console.warn('Notice during data fetch (retaining member session):', error?.message || error);
    } finally {
      setLoading(false);
      if (fetchedCoursesData.length > 0 || courses.length > 0) {
        setHasInitialFetchCompleted(true);
      } else {
        setTimeout(() => {
          fetchData(true);
        }, 1200);
      }
      fetchInProgressRef.current = false;
    }
  };


  const isAdmin = useMemo(() => {
    return !!user?.email && (
      (settings?.admin_email && user.email.toLowerCase() === settings.admin_email.toLowerCase()) ||
      user.email.toLowerCase() === 'gabrielchendes@gmail.com'
    );
  }, [user, settings]);

  const isUnlocked = useCallback((course: Course) => {
    // 1. If it has a direct purchase or is part of an owned package, it's unlocked
    if (purchases.some(p => p.product_id === course.id || (course.hotmart_product_id && p.product_id === course.hotmart_product_id))) return true;

    // 2. If a course is a Main Product (is_free = true, is_bonus = false), it's always unlocked for all users
    const isMainCourse = !!course.is_free && !course.is_bonus;
    if (isMainCourse) return true;

    // 3. If it's exclusive to package, it's ONLY unlocked if owned (handled by purchases check above)
    if (course.is_package_exclusive_bonus) return false;

    // 4. If it's marked as free, it's unlocked (standard free courses)
    if (course.is_free) return true;
    
    // 5. If it's a general bonus course (not exclusive), it's usually unlocked for everyone
    if (course.is_bonus) return true;

    // 6. Administrador tem acesso mestre/liberado a todos os outros cursos, EXCEPT paid courses that are not purchased,
    // so they can test the purchase flow on the dashboard.
    const isPaidCourse = !course.is_free && !course.is_bonus;
    if (isAdmin && !isPaidCourse) return true;

    return false;
  }, [purchases, courses, isAdmin]);

  const handleOpenCourse = useCallback(async (courseOrPartial: any) => {
    if (!courseOrPartial) return;
    // Look up full course object from state if partial object passed from smart header
    const course = courses.find(c => c.id === courseOrPartial.id) || courseOrPartial;

    if (isUnlocked(course)) {
      // Update last viewed for the "Resume" button
      try {
        localStorage.setItem(`last_viewed_${user.id}`, JSON.stringify({
          courseId: course.id,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Storage write failed', e);
      }

      // Open the viewer with immediate course context (handles video, PDF, and interactive lessons)
      setViewingCourse({
        ...course,
        pdf_url: course.pdf_url || course.preview_pdf_url || '',
        preview_pdf_url: course.preview_pdf_url || course.pdf_url || ''
      });
      setViewingCourseId(course.id);
    } else {
      // Direct access to preview page for paid/locked courses
      setPreviewCourse(course);
    }
  }, [courses, viewingCourseId, isUnlocked, courseStats, user?.id]);

  // O(1) Set of completed chapter IDs for instant progress calculation across all courses
  const completedChapterIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const p of userProgress) {
      if (p?.completed && p.chapter_id) {
        set.add(p.chapter_id);
      }
    }
    return set;
  }, [userProgress]);

  const getCourseProgress = useCallback((courseId: string) => {
    const chaptersInCourse = courseChapters[courseId];
    if (!chaptersInCourse || chaptersInCourse.length === 0) return 0;

    let completedCount = 0;
    for (let i = 0; i < chaptersInCourse.length; i++) {
      if (completedChapterIdSet.has(chaptersInCourse[i])) {
        completedCount++;
      }
    }

    return Math.min(100, Math.round((completedCount / chaptersInCourse.length) * 100));
  }, [courseChapters, completedChapterIdSet]);

  // High-performance course prefetching: fetches modules and chapters into cache ahead of time
  const prefetchCourse = useCallback(async (courseOrId: Course | string) => {
    const cId = typeof courseOrId === 'string' ? courseOrId : courseOrId?.id;
    if (!cId || dataCache.get(`course_full_${cId}`)) return;
    try {
      import('../components/CourseViewer');

      const { data: modulesData } = await supabase
        .from('modules')
        .select('*, chapters(*)')
        .eq('course_id', cId)
        .order('order_index');

      if (modulesData && Array.isArray(modulesData)) {
        const chaptersList: Chapter[] = [];
        const cleanModules: Module[] = modulesData.map((m: any) => {
          const { chapters: rawChs, ...modProps } = m;
          if (Array.isArray(rawChs)) {
            const sorted = [...rawChs].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
            chaptersList.push(...sorted.map(fromDbChapter));
          }
          return modProps as Module;
        });

        const targetCourse = typeof courseOrId === 'object' ? courseOrId : courses.find(c => c.id === cId);
        dataCache.set(`course_full_${cId}`, {
          course: targetCourse || null,
          modules: cleanModules,
          chapters: chaptersList,
          progress: userProgressRef.current || []
        }, 600000);
      }
    } catch (_) {}
  }, [courses]);

  // Silently warm up only the first 2 unlocked courses AFTER initial dashboard data settles
  useEffect(() => {
    if (!hasInitialFetchCompleted || courses.length === 0) return;
    const conn = (navigator as any)?.connection;
    if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') {
      return;
    }

    const unlocked = courses.filter(c => isUnlocked(c)).slice(0, 2);
    const timers = unlocked.map((c, idx) =>
      setTimeout(() => {
        prefetchCourse(c);
      }, 2000 + idx * 700)
    );
    return () => {
      timers.forEach(tId => clearTimeout(tId));
    };
  }, [hasInitialFetchCompleted, courses, isUnlocked, prefetchCourse]);

  const unlockedCourses = useMemo(() => {
    return courses.filter(p => isUnlocked(p) && !p.is_bonus);
  }, [courses, isUnlocked]);

  const mainCourses = useMemo(() => {
    // 1. Default free/main courses
    const defaultList = courses.filter(c => !!c.is_free && !c.is_bonus);
    const sortedDefault = [...defaultList].sort((a, b) => {
      const orderA = a.order_index ?? 9999;
      const orderB = b.order_index ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    // 2. Paid courses that are purchased
    const purchasedPaidList = courses.filter(c => !c.is_free && !c.is_bonus && purchases.some(p => p.product_id === c.id || (c.hotmart_product_id && p.product_id === c.hotmart_product_id)));
    const sortedPurchasedPaid = [...purchasedPaidList].sort((a, b) => {
      const orderA = a.order_index ?? 9999;
      const orderB = b.order_index ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    // 3. Combine: default free courses first, purchased paid courses always at the end!
    return [...sortedDefault, ...sortedPurchasedPaid];
  }, [courses, purchases]);

  const paidCourses = useMemo(() => {
    // Paid courses that are NOT purchased
    const list = courses.filter(c => !c.is_free && !c.is_bonus && !purchases.some(p => p.product_id === c.id || (c.hotmart_product_id && p.product_id === c.hotmart_product_id)));
    return [...list].sort((a, b) => {
      const orderA = a.order_index ?? 9999;
      const orderB = b.order_index ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
  }, [courses, purchases]);

  const bonusCourses = useMemo(() => {
    const list = courses.filter(p => !!p.is_bonus && isUnlocked(p));
    return [...list].sort((a, b) => {
      const orderA = a.order_index ?? 9999;
      const orderB = b.order_index ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
  }, [courses, isUnlocked]);

  const globalStats = useMemo(() => {
    const allUnlocked = [...unlockedCourses, ...bonusCourses];
    if (allUnlocked.length === 0) return { totalProgress: 0, lastCourse: undefined };

    let totalChapters = 0;
    let completedChapters = 0;
    let lastActiveCourse: any = undefined;
    let maxProgress = -1;

    // Try to get from localStorage first
    const lastViewedStr = localStorage.getItem(`last_viewed_${user.id}`);
    if (lastViewedStr) {
      try {
        const lastViewed = JSON.parse(lastViewedStr);
        const course = allUnlocked.find(c => c.id === lastViewed.courseId);
        if (course) {
          const progress = getCourseProgress(course.id);
          if (progress < 100) {
            lastActiveCourse = {
              id: course.id,
              title: course.title,
              cover_url: course.cover_url,
              progress: Math.round(progress)
            };
          }
        }
      } catch (e) {}
    }

    let firstNotCompleted: Course | undefined;

    for (let i = 0; i < allUnlocked.length; i++) {
      const course = allUnlocked[i];
      try {
        const chapters = courseChapters[course.id] || [];
        totalChapters += chapters.length;

        let compCount = 0;
        for (let j = 0; j < chapters.length; j++) {
          if (completedChapterIdSet.has(chapters[j])) {
            compCount++;
          }
        }

        completedChapters += compCount;
        const progress = chapters.length > 0 ? (compCount / chapters.length) * 100 : 0;

        if (!firstNotCompleted && progress < 100) {
          firstNotCompleted = course;
        }

        // Use highest progress that is not completed as "Continue watching"
        if (progress > 0 && progress < 100 && progress > maxProgress) {
          maxProgress = progress;
          lastActiveCourse = {
            id: course.id,
            title: course.title,
            cover_url: course.cover_url,
            progress: Math.round(progress)
          };
        }
      } catch (err) {
        console.warn('Error calculating stats for course:', course.id, err);
      }
    }

    // Fallback if none are in progress
    if (!lastActiveCourse && firstNotCompleted) {
      lastActiveCourse = {
        id: firstNotCompleted.id,
        title: firstNotCompleted.title,
        cover_url: firstNotCompleted.cover_url,
        progress: getCourseProgress(firstNotCompleted.id)
      };
    }

    const totalProgress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

    return { totalProgress, lastCourse: lastActiveCourse };
  }, [unlockedCourses, bonusCourses, courseChapters, completedChapterIdSet, getCourseProgress, user.id]);

  const lastProgressRef = useRef<number>(globalStats.totalProgress);

  // Track milestones and show "Parabéns"
  useEffect(() => {
    // Check if progress actually increased
    const hasIncreased = globalStats.totalProgress > lastProgressRef.current;
    lastProgressRef.current = globalStats.totalProgress;

    if (!hasIncreased || globalStats.totalProgress <= 0) return;

    const storageKey = `milestone_celebrated_${user.id}`;
    const celebratedMilestones = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    // Milestones are 25, 50, 75, 100
    const currentMilestone = [25, 50, 75, 100].reverse().find(m => globalStats.totalProgress >= m);

    if (currentMilestone && !celebratedMilestones.includes(currentMilestone)) {
      // Save to persistent localStorage so it never repeats for this user
      celebratedMilestones.push(currentMilestone);
      localStorage.setItem(storageKey, JSON.stringify(celebratedMilestones));
      
      const messages = {
        25: settings.custom_texts?.['celebration.25'] || t('celebration.25') || "🔥 Congratulations! You've already completed 25% of the content! Keep it up!",
        50: settings.custom_texts?.['celebration.50'] || t('celebration.50') || "⭐ Sensational! You're halfway there! The top is within reach!",
        75: settings.custom_texts?.['celebration.75'] || t('celebration.75') || "🚀 Impressive! 75% complete. You're pure determination!",
        100: settings.custom_texts?.['celebration.100'] || t('celebration.100') || "🏆 LEGENDARY! 100% COMPLETE! You've mastered all the content! Congratulations!"
      };

      toast.achievement(messages[currentMilestone as keyof typeof messages] || `Amazing! You've reached ${currentMilestone}% progress!`, {
        duration: 5000,
        icon: currentMilestone === 100 ? '🏆' : '✨',
      });
    }
  }, [globalStats.totalProgress, user.id]);

  // Full-screen loading only if we have NO data at all
  const hasCoursesLoaded = courses.length > 0;
  
  if (loading && !hasCoursesLoaded) {
    return <GlowingSpinner fullScreen size="lg" />;
  }

  if (isViewingTestimonials) {
    return (
      <InspiringStoriesPage
        settings={settings}
        onBack={() => setIsViewingTestimonials(false)}
        onWriteStory={() => {
          setIsViewingTestimonials(false);
          setIsWritingTestimonial(true);
        }}
      />
    );
  }

  if (isWritingTestimonial) {
    return (
      <TestimonialPage 
        user={user} 
        courses={courses} 
        settings={settings} 
        onBack={() => setIsWritingTestimonial(false)} 
        onViewStories={() => {
          setIsWritingTestimonial(false);
          setIsViewingTestimonials(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-[#0b0c10]">
      <AnimatePresence>
        {viewingCourseId && (
          <Suspense fallback={
            <div className="fixed inset-0 bg-[#0b0c10] flex items-center justify-center z-[250]">
              <GlowingSpinner size="lg" />
            </div>
          }>
            <CourseViewer 
              courseId={viewingCourseId} 
              initialCourse={viewingCourse}
              initialProgress={userProgress}
              onProgressChange={(updatedProgress) => {
                setUserProgress(updatedProgress);
                syncProgressToDashboardCache(updatedProgress);
              }}
              userId={user.id} 
              onClose={() => {
                setViewingCourseId(null);
                setViewingCourse(null);
              }} 
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Welcome Notification Modal */}
<AnimatePresence>
{showWelcomeModal && (
<div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl">
<motion.div 
initial={{ opacity: 0, scale: 0.9, y: 30 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.9, y: 30 }}
className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
>
<div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]" />
<div className="p-10 text-center">
<div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-primary/20 rotate-3">
<Bell className="text-primary animate-pulse" size={36} />
</div>
<h3 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-4">
{settings.custom_texts?.['push.title'] || t('push.title') || 'Important Notices!'}
</h3>
<p className="text-gray-400 text-sm mb-10 leading-relaxed font-medium">
{settings.custom_texts?.['push.description'] || t('push.description') || 'Would you like to receive notifications about new classes, materials, and important announcements directly on your mobile phone?'}
</p>
<div className="flex flex-col gap-4">
<button 
onClick={async () => {
localStorage.setItem(`push_modal_dismissed_${user.id}`, 'true');
setShowWelcomeModal(false);
try {
const { requestNotificationPermission } = await import('../lib/pushNotifications');
const granted = await requestNotificationPermission(user.id);
if (granted) {
toast.success(settings.custom_texts?.['push.success'] || t('push.success') || 'Notifications enabled successfully!');
}
} catch (err) {
console.warn('Notification activation error:', err);
}
}}
className="w-full bg-primary hover:bg-primary-hover text-white font-black py-5 rounded-2xl shadow-2xl shadow-primary/30 active:scale-95 transition-all text-xs tracking-[0.2em] uppercase italic"
>
{settings.custom_texts?.['push.allow'] || t('push.allow') || 'Turn on notifications'}
</button>
<button 
onClick={() => {
localStorage.setItem(`push_modal_dismissed_${user.id}`, 'true');
setShowWelcomeModal(false);
}}
className="w-full py-3 text-[10px] text-gray-600 font-bold uppercase tracking-[0.3em] hover:text-white transition-colors"
>
{settings.custom_texts?.['push.deny'] || t('push.deny') || 'Not now'}
</button>
</div>
</div>
</motion.div>
</div>
)}
</AnimatePresence>

      <Navbar 
        user={user} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onOpenAi={() => setIsAiModalOpen(true)}
        isAiOpen={isAiModalOpen}
        canInstall={canInstall}
        onInstall={async () => {
          const device = getDeviceType();
          if (device === 'desktop') {
            setShowPWAInstall(true);
            return;
          }
          if (device === 'android') {
            const directSuccess = await installOnAndroidDirectly();
            if (directSuccess) return;
          }
          const success = await promptPWAInstall();
          if (!success) {
            if (device === 'android') {
              const isWebView = /wv|webview|fbav|instagram|micromessenger|threads/i.test(navigator.userAgent);
              if (isWebView) {
                window.location.href = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end;`;
                return;
              }
            }
            setShowPWAInstall(true);
          }
        }}
        totalProgress={globalStats.totalProgress}
        onOpenProgress={() => setShowProgressModal(true)}
      />

      {/* Tab Content and Transitions */}
      {isAiModalOpen ? (
        <div className="fixed inset-0 bg-black z-10 w-full h-full" />
      ) : (
        <div className={cn(
          "w-full pb-32",
          activeTab !== 'home' ? "pt-20 min-h-screen" : "min-h-screen"
        )}>
          {activeTab === 'home' ? (
              <PullToRefresh onRefresh={handleGlobalRefresh}>
                <div className="flex flex-col">
                  {/* Banner Section */}
                  <div className="w-full">
                    <BannerCarousel 
                      images={(settings.banner_sync !== false) 
                        ? (settings.banner_images || []) 
                        : (getDeviceType() === 'desktop' ? (settings.banner_images || []) : (settings.banner_images_mobile || settings.banner_images || []))
                      } 
                      interval={settings.banner_interval || 5000} 
                      config={(settings.banner_sync !== false)
                        ? (settings.banner_config || [])
                        : (getDeviceType() === 'desktop' ? (settings.banner_config || []) : (settings.banner_config_mobile || settings.banner_config || []))
                      }
                    />
                  </div>

                  {/* Gamification Header */}
                  <SmartHomeHeader 
                    totalProgress={globalStats.totalProgress} 
                    lastCourse={globalStats.lastCourse}
                    onContinueCourse={(course) => handleOpenCourse(course as any)}
                    settings={settings}
                    t={t}
                    showModal={showProgressModal}
                    onCloseModal={() => setShowProgressModal(false)}
                  />

                  {/* Content Sections */}
                  <div className="relative z-10 space-y-4 mt-2">
                    <Carousel 
                      title={settings.custom_texts?.['dashboard.courses_paid'] || t('dashboard.courses_paid') || 'Your Main Journey 🔥'}
                    >
                      {(loading || !hasInitialFetchCompleted || courses.length === 0) && mainCourses.length === 0 ? (
                        <>
                          <ProductCardSkeleton />
                          <ProductCardSkeleton />
                          <ProductCardSkeleton />
                          <ProductCardSkeleton />
                        </>
                      ) : mainCourses.length > 0 ? (
                        mainCourses.map(course => (
                          <ProductCard
                            key={course.id}
                            product={course}
                            isUnlocked={isUnlocked(course)}
                            progress={getCourseProgress(course.id)}
                            stats={courseStats[course.id]}
                            settings={settings}
                            onOpen={handleOpenCourse}
                            onPrefetch={prefetchCourse}
                          />
                        ))
                      ) : (hasInitialFetchCompleted && courses.length > 0 && !loading) ? (
                        <div className="w-full h-48 flex flex-col items-center justify-center text-gray-600 border border-white/5 rounded-3xl bg-white/5">
                          <Book size={32} className="mb-4 opacity-20" />
                          <p className="font-bold text-xs uppercase tracking-widest text-center px-4">
                            {settings.custom_texts?.['dashboard.empty_locked'] || t('dashboard.empty_locked') || 'You do not have any courses available yet.'}
                          </p>
                        </div>
                      ) : (
                        <>
                          <ProductCardSkeleton />
                          <ProductCardSkeleton />
                          <ProductCardSkeleton />
                          <ProductCardSkeleton />
                        </>
                      )}
                    </Carousel>


                    {bonusCourses.length > 0 && (
                      <Carousel 
                        title={settings.custom_texts?.['dashboard.courses_bonus'] || t('dashboard.courses_bonus') || 'Exclusive Prizes and Bonuses 🎁'}
                      >
                        {bonusCourses.map(course => (
                          <ProductCard
                            key={course.id}
                            product={course}
                            isUnlocked={true}
                            progress={getCourseProgress(course.id)}
                            stats={courseStats[course.id]}
                            settings={settings}
                            onOpen={handleOpenCourse}
                            onPrefetch={prefetchCourse}
                          />
                        ))}
                      </Carousel>
                    )}

                    <Carousel 
                      title={settings.custom_texts?.['dashboard.courses_free'] || t('dashboard.courses_free') || 'Acelere sua Evolução  🚀'}
                    >
                      {(loading || !hasInitialFetchCompleted || courses.length === 0) && paidCourses.length === 0 ? (
                        <>
                          <ProductCardSkeleton />
                          <ProductCardSkeleton />
                          <ProductCardSkeleton />
                        </>
                      ) : paidCourses.length > 0 ? (
                        paidCourses.map(course => (
                          <ProductCard
                            key={course.id}
                            product={course}
                            isUnlocked={isUnlocked(course)}
                            progress={getCourseProgress(course.id)}
                            stats={courseStats[course.id]}
                            settings={settings}
                            onOpen={handleOpenCourse}
                            onPrefetch={prefetchCourse}
                          />
                        ))
                      ) : (hasInitialFetchCompleted && courses.length > 0 && !loading) ? (
                        <div className="w-full py-16 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-white/5 rounded-3xl">
                          <p className="font-bold text-center px-4">{settings.custom_texts?.['dashboard.empty_all_unlocked'] || t('dashboard.empty_all_unlocked') || 'Você já possui todos os cursos disponíveis!'}</p>
                        </div>
                      ) : (
                        <>
                          <ProductCardSkeleton />
                          <ProductCardSkeleton />
                          <ProductCardSkeleton />
                        </>
                      )}
                    </Carousel>


                    <HomeTestimonialCard
                      settings={settings}
                      t={t}
                      onOpenTestimonial={() => setIsWritingTestimonial(true)}
                      onViewTestimonials={() => setIsViewingTestimonials(true)}
                    />

                    <SupportSection page="home" settings={settings} t={t} />
                  </div>
                </div>
              </PullToRefresh>
            ) : activeTab === 'community' ? (
                <PullToRefresh onRefresh={handleGlobalRefresh}>
                  <Suspense fallback={<ComponentLoader />}>
                    <Community key={`community-${refreshKey}`} user={user} />
                    <SupportSection page="community" settings={settings} t={t} />
                  </Suspense>
                </PullToRefresh>
              ) : activeTab === 'admin' ? (
                <Suspense fallback={<ComponentLoader />}>
                  <AdminPanel key={`admin-${refreshKey}`} user={user} />
                </Suspense>
              ) : (
                <PullToRefresh onRefresh={handleGlobalRefresh}>
                  <Suspense fallback={<ComponentLoader />}>
                    <Profile 
                      key={`profile-${refreshKey}`} 
                      user={user} 
                      canInstall={canInstall}
                      onInstall={() => setShowPWAInstall(true)}
                    />
                    <SupportSection page="profile" settings={settings} t={t} />
                  </Suspense>
                </PullToRefresh>
              )}
        </div>
      )}

      {/* Improved Course Preview Experience */}
      <AnimatePresence>
        {previewCourse && (
          <Suspense fallback={
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[310] backdrop-blur-md">
              <GlowingSpinner size="lg" />
            </div>
          }>
            <CoursePreviewViewer 
              course={previewCourse} 
              onClose={() => setPreviewCourse(null)}
              onPurchase={() => {
                setPreviewCourse(null);
                // handleSimulatePurchase uses selectedCourse, but we can call it directly if we ensure it's still set
                // or just handle it here Since we are in the dashboard, we know handleSimulatePurchase exists
                if (previewCourse.checkout_url) {
                  window.location.href = previewCourse.checkout_url;
                } else {
                  toast.error(t('course.purchase_unavailable') || 'This course does not yet have a purchase link.');
                }
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {!viewingCourseId && (
        <BottomNav 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          onOpenAi={() => setIsAiModalOpen(true)}
          isAiOpen={isAiModalOpen}
          userEmail={user.email} 
        />
      )}
      <FloatingWhatsApp page={activeTab as any} />
      <Suspense fallback={null}>
        <AiAssistantModal 
          userId={user?.id}
          userEmail={user?.email}
          userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]} 
          userAvatar={user?.user_metadata?.avatar_url}
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          hasUnlimitedAi={
            (userProfile?.has_unlimited_ai === false || user?.user_metadata?.has_unlimited_ai === false)
              ? false
              : Boolean(
                  userProfile?.has_unlimited_ai === true || 
                  userProfile?.is_admin === true ||
                  user?.user_metadata?.has_unlimited_ai === true ||
                  (Array.isArray(purchases) && purchases.some(p => ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited'].includes(p.product_id)))
                )
          }
        />
      </Suspense>
      
      {showPWAInstall && (
        <PWAInstallModal 
          isOpen={showPWAInstall} 
          onClose={() => setShowPWAInstall(false)}
          onInstall={async () => {
            const prompt = deferredPrompt || getDeferredPrompt();
            if (prompt) {
              try {
                await prompt.prompt();
                const { outcome } = await prompt.userChoice;
                if (outcome === 'accepted') {
                  setDeferredPrompt(null);
                  setCanInstall(false);
                  return true;
                }
              } catch (e) {
                console.error('Error invoking install prompt:', e);
              }
            }
            return await promptPWAInstall();
          }}
        />
      )}

      {/* Access Denied / Inactive Subscription Overlay */}
      {userProfile && userProfile.has_access === false && !isAdmin && (
        <Suspense fallback={null}>
          <AccessDeniedModal userEmail={user.email || ''} />
        </Suspense>
      )}
    </div>
  );
}
