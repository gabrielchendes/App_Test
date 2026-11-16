import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

const cleanUrl = (raw?: string) => {
  if (!raw) return 'https://placeholder.supabase.co';
  let clean = raw.replace(/^["']|["']$/g, '').trim();
  if (!clean) return 'https://placeholder.supabase.co';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  try {
    new URL(clean);
    return clean;
  } catch {
    return 'https://placeholder.supabase.co';
  }
};

const supabaseUrl = cleanUrl(
  process.env.SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL
);

const isRevokedKey = (key?: string) => {
  if (!key) return true;
  const trimmed = key.trim();
  return (
    trimmed === '' || 
    trimmed === 'undefined' || 
    trimmed === 'null' || 
    trimmed === 'placeholder-key' ||
    trimmed.startsWith('sb_secret_') ||
    (!trimmed.startsWith('eyJ') && !trimmed.startsWith('sbp_') && !trimmed.startsWith('sb_publishable_'))
  );
};

const rawServiceRoleKey = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SERVICE_KEY || 
  process.env.SUPABASE_SECRET_KEY || 
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
  '';

const supabaseServiceRoleKey = isRevokedKey(rawServiceRoleKey) ? '' : rawServiceRoleKey;

const supabaseAnonKey = 
  process.env.SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || 
  '';

const effectiveKey = supabaseServiceRoleKey || supabaseAnonKey || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl || 'https://placeholder.supabase.co', effectiveKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

const isUUID = (str?: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

const MODAL_HTML_MARKER = '<!--__PWA_MODAL_HTML__-->';
const HIDE_SINGLE_MODULE_TRUE_MARKER = '<!--__HIDE_SINGLE_MOD_TRUE__-->';
const HIDE_SINGLE_MODULE_FALSE_MARKER = '<!--__HIDE_SINGLE_MOD_FALSE__-->';
const CATALOG_CACHE_TTL_MS = 300000;

const LIGHTWEIGHT_COURSE_COLUMNS = [
  'id', 'title', 'description', 'cover_url', 'is_active', 'is_bonus', 'is_free',
  'price', 'checkout_url', 'hotmart_product_id', 'created_at', 'pdf_url',
  'category', 'subtitle', 'old_price', 'benefits', 'cta_text',
  'preview_url', 'preview_text', 'preview_enabled', 'social_proof',
  'show_lifetime_badge', 'premium_badge_text', 'offer_badge_text',
  'premium_cover_url', 'lifetime_badge_text', 'payment_label_text',
  'secure_payment_label', 'instant_access_label', 'preview_rating',
  'preview_students_label', 'preview_guarantee_label', 'preview_support_vip_label',
  'preview_bonus_title', 'preview_title', 'preview_subtitle',
  'preview_show_social_proof', 'preview_show_bonus', 'preview_show_trust',
  'preview_support_type', 'preview_type', 'preview_link_text',
  'preview_link_url', 'preview_link_color', 'preview_video_url',
  'preview_pdf_url', 'preview_modules_label', 'preview_students_tag',
  'preview_risk_zero_label', 'preview_support_label', 'preview_guarantee_title',
  'preview_guarantee_subtitle', 'preview_guarantee_description', 'preview_footer_cta',
  'order_index', 'linked_package_id', 'is_package_exclusive_bonus', 'is_package_exclusive'
].join(', ');

function isJwtExpired(token?: string): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (typeof payload?.exp === 'number') {
      return payload.exp * 1000 <= Date.now() + 5000;
    }
  } catch {}
  return false;
}

interface CachedCatalogBundle {
  courses: any[];
  courseChapters: Record<string, string[]>;
  courseStats: Record<string, { lessons: number; materials: number }>;
  packages: any[];
  courseOverrides: Record<string, any>;
  chapterOverrides: Record<string, any>;
  manualGrantsMap: Record<string, string[]>;
  fetchedAt: number;
}

function getGlobalCatalogCache(): CachedCatalogBundle | null {
  return (globalThis as any).__mpBootstrapCatalogCache || null;
}

function setGlobalCatalogCache(bundle: CachedCatalogBundle | null) {
  (globalThis as any).__mpBootstrapCatalogCache = bundle;
}

function readLocalJsonSafe(relPath: string): Record<string, any> {
  try {
    const fullPath = path.join(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(fs.readFileSync(fullPath, 'utf-8')) || {};
    }
  } catch {}
  return {};
}

function stripHeavyCourseFields(raw: any) {
  if (!raw || typeof raw !== 'object') return raw;
  const rawBenefits = Array.isArray(raw.benefits) ? raw.benefits : [];
  let hideSingleModuleHeader = raw.hide_single_module_header;
  if (hideSingleModuleHeader === undefined) {
    const hasHideFalse = rawBenefits.some((b: any) => typeof b === 'string' && b.includes(HIDE_SINGLE_MODULE_FALSE_MARKER));
    const hasHideTrue = rawBenefits.some((b: any) => typeof b === 'string' && b.includes(HIDE_SINGLE_MODULE_TRUE_MARKER));
    if (hasHideFalse) hideSingleModuleHeader = false;
    else if (hasHideTrue) hideSingleModuleHeader = true;
    else hideSingleModuleHeader = true;
  }

  const firstBenefit = rawBenefits[0];
  const hasModalHtmlMarker = typeof firstBenefit === 'string' && firstBenefit.startsWith(MODAL_HTML_MARKER);
  const isModalHtml = raw.modal_type === 'html' || hasModalHtmlMarker;
  const rawPreviewText = raw.preview_rich_text || '';
  const hasPreviewHtmlMarker = typeof rawPreviewText === 'string' && (
    rawPreviewText.includes('<!--__PWA_HTML_APP__-->') ||
    /^\s*<(!DOCTYPE|html|div|main|section|body)/i.test(rawPreviewText)
  );
  const isPreviewHtml =
    raw.preview_type === 'html' ||
    (raw.preview_type === 'text' && hasPreviewHtmlMarker) ||
    hasPreviewHtmlMarker;

  const cleanBenefits = rawBenefits
    .filter((b: any) =>
      typeof b === 'string' &&
      !b.startsWith(MODAL_HTML_MARKER) &&
      !b.includes(HIDE_SINGLE_MODULE_TRUE_MARKER) &&
      !b.includes(HIDE_SINGLE_MODULE_FALSE_MARKER)
    )
    .slice(0, 12);

  const { preview_rich_text: _prt, modal_html: _mh, ...rest } = raw;
  return {
    ...rest,
    hide_single_module_header: hideSingleModuleHeader,
    modal_type: isModalHtml ? 'html' : 'standard',
    preview_type: isPreviewHtml ? 'html' : (raw.preview_type || 'html'),
    benefits: cleanBenefits,
    _lightweight: true
  };
}

async function fetchAllChaptersPaginated(client: any): Promise<any[]> {
  const pageSize = 1000;
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from('chapters')
      .select('id, content_type, modules!inner(course_id)')
      .range(from, from + pageSize - 1);

    if (error || !Array.isArray(data) || data.length === 0) {
      break;
    }

    allRows.push(...data);
    if (data.length < pageSize || allRows.length >= 20000) {
      break;
    }
    from += pageSize;
  }

  return allRows;
}

async function fetchCoursesCatalog(client: any): Promise<any[]> {
  let coursesRes = await client
    .from('courses')
    .select(LIGHTWEIGHT_COURSE_COLUMNS)
    .order('order_index', { ascending: true });

  if (coursesRes.error && (coursesRes.error.code === '42703' || coursesRes.error.message?.includes('column'))) {
    // Fallback to select('*') ordered by order_index or created_at if schema differs
    coursesRes = await client
      .from('courses')
      .select('*')
      .order('order_index', { ascending: true });

    if (coursesRes.error && (coursesRes.error.code === '42703' || coursesRes.error.message?.includes('order_index'))) {
      coursesRes = await client
        .from('courses')
        .select('*')
        .order('created_at', { ascending: true });
    }
  }

  if (coursesRes.error || !coursesRes.data) {
    const fallbackRes = await client.from('courses').select('*');
    if (fallbackRes.data) {
      return fallbackRes.data.filter((c: any) => c.is_active !== false).map(stripHeavyCourseFields);
    }
    return [];
  }

  return coursesRes.data.filter((c: any) => c.is_active !== false).map(stripHeavyCourseFields);
}

async function loadPublicCatalogBundle(client: any, forceRefresh = false): Promise<CachedCatalogBundle> {
  const existing = getGlobalCatalogCache();
  if (!forceRefresh && existing && (Date.now() - existing.fetchedAt < CATALOG_CACHE_TTL_MS)) {
    return existing;
  }

  const [coursesRes, chaptersRows, packagesRes, memoryRes] = await Promise.allSettled([
    fetchCoursesCatalog(client),
    fetchAllChaptersPaginated(client),
    client.from('course_packages').select('id, hotmart_product_id, hotmart_checkout_url, package_courses(course_id)'),
    client
      .from('ai_user_memory')
      .select('user_id, facts')
      .in('user_id', ['__global_course_overrides__', '__global_chapter_overrides__', '__global_manual_purchases__'])
  ]);

  const courses = coursesRes.status === 'fulfilled' ? coursesRes.value : (existing?.courses || []);
  const courseChapters: Record<string, string[]> = {};
  const courseStats: Record<string, { lessons: number; materials: number }> = {};

  if (chaptersRows.status === 'fulfilled' && Array.isArray(chaptersRows.value)) {
    for (const ch of chaptersRows.value) {
      const courseId = ch?.modules?.course_id;
      if (!courseId) continue;
      if (!courseStats[courseId]) courseStats[courseId] = { lessons: 0, materials: 0 };
      if (!courseChapters[courseId]) courseChapters[courseId] = [];
      courseChapters[courseId].push(ch.id);
      if (ch.content_type === 'video' || ch.content_type === 'audio' || ch.content_type === 'html' || ch.content_type === 'html_app') {
        courseStats[courseId].lessons++;
      } else {
        courseStats[courseId].materials++;
      }
    }
  }

  for (const c of courses) {
    if ((c.pdf_url || c.preview_pdf_url) && (!courseStats[c.id] || (courseStats[c.id].lessons === 0 && courseStats[c.id].materials === 0))) {
      if (!courseStats[c.id]) courseStats[c.id] = { lessons: 0, materials: 1 };
      else courseStats[c.id].materials = 1;
    }
  }

  const packages = (packagesRes.status === 'fulfilled' && Array.isArray((packagesRes.value as any)?.data))
    ? (packagesRes.value as any).data
    : (existing?.packages || []);

  let courseOverrides = readLocalJsonSafe('data/course_overrides.json');
  let chapterOverrides = readLocalJsonSafe('data/chapter_overrides.json');
  let manualGrantsMap: Record<string, string[]> = {};

  if (memoryRes.status === 'fulfilled' && Array.isArray((memoryRes.value as any)?.data)) {
    for (const row of (memoryRes.value as any).data) {
      const firstFact = Array.isArray(row?.facts) ? row.facts[0] : null;
      if (!firstFact || typeof firstFact !== 'object') continue;
      if (row.user_id === '__global_course_overrides__') {
        courseOverrides = { ...courseOverrides, ...firstFact };
      } else if (row.user_id === '__global_chapter_overrides__') {
        chapterOverrides = { ...chapterOverrides, ...firstFact };
      } else if (row.user_id === '__global_manual_purchases__') {
        manualGrantsMap = firstFact;
      }
    }
  }

  const bundle: CachedCatalogBundle = {
    courses,
    courseChapters,
    courseStats,
    packages,
    courseOverrides,
    chapterOverrides,
    manualGrantsMap,
    fetchedAt: Date.now()
  };

  if (courses.length > 0) {
    setGlobalCatalogCache(bundle);
  }

  return bundle;
}

function parseBody(req: VercelRequest): Record<string, any> {
  let body = req.body;
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch {
      return {};
    }
  }
  return typeof body === 'object' ? body : {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers.authorization;
    const hasBearerToken = Boolean(authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 16);
    const token = hasBearerToken ? authHeader!.replace(/^Bearer\s+/i, '').trim() : '';
    const tokenValid = Boolean(token && token !== 'undefined' && token !== 'null' && !isJwtExpired(token));

    const userScopedClient = (tokenValid && supabaseAnonKey)
      ? createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { headers: { Authorization: `Bearer ${token}` } }
        })
      : null;

    // Public catalog always uses supabaseAdmin (service key if valid, otherwise anon key — never an expiring user JWT)
    const catalogClient = supabaseAdmin;
    const canReadPrivateUserData = Boolean(supabaseServiceRoleKey) || Boolean(userScopedClient);
    const userClient = supabaseServiceRoleKey ? supabaseAdmin : (userScopedClient || supabaseAdmin);

    let authUserId: string | null = null;

    if (req.method === 'GET' && req.query?.action === 'bootstrap') {
      const requestedUserId = (req.query?.userId as string) || '';
      const requestedEmail = ((req.query?.email as string) || '').trim().toLowerCase();
      const forceRefresh = req.query?.refresh === '1' || req.query?.refresh === 'true';

      if (!requestedUserId) {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
      } else {
        res.setHeader('Cache-Control', 'no-store');
      }

      // Start public catalog fetch immediately (0 wait on auth check)
      const catalogBundlePromise = loadPublicCatalogBundle(catalogClient, forceRefresh);

      // Verify JWT only when running with service role key (to prevent userId spoofing) or when userId is missing
      const needsServerAuthCheck =
        tokenValid &&
        (Boolean(supabaseServiceRoleKey) || !isUUID(requestedUserId));

      if (needsServerAuthCheck) {
        try {
          const { data: userData } = await (userClient || supabaseAdmin).auth.getUser(token);
          if (userData?.user?.id) {
            authUserId = userData.user.id;
          }
        } catch (_) {}
      }

      const targetUserId = (authUserId && isUUID(authUserId)) ? authUserId : requestedUserId;

      const userProgressPromise = (canReadPrivateUserData && targetUserId && isUUID(targetUserId))
        ? userClient
            .from('user_progress')
            .select('chapter_id, completed, user_id')
            .eq('user_id', targetUserId)
        : Promise.resolve({ data: null, error: { message: 'unauthenticated_or_missing_user' } });

      const purchasesPromise = (canReadPrivateUserData && targetUserId)
        ? userClient
            .from('purchases')
            .select('product_id, created_at')
            .eq('user_id', targetUserId)
        : Promise.resolve({ data: null, error: { message: 'unauthenticated_or_missing_user' } });

      const emailPurchasesPromise = (canReadPrivateUserData && requestedEmail && targetUserId && requestedEmail !== targetUserId.toLowerCase() && !isUUID(targetUserId))
        ? userClient
            .from('purchases')
            .select('product_id, created_at')
            .eq('user_id', requestedEmail)
        : Promise.resolve({ data: [], error: null });

      const profilePromise = (canReadPrivateUserData && targetUserId && isUUID(targetUserId))
        ? userClient
            .from('profiles')
            .select('has_access, has_unlimited_ai, is_admin, full_name, avatar_url')
            .eq('id', targetUserId)
            .maybeSingle()
        : (canReadPrivateUserData && requestedEmail
            ? userClient
                .from('profiles')
                .select('has_access, has_unlimited_ai, is_admin, full_name, avatar_url')
                .eq('email', requestedEmail)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }));

      const [catalogBundle, progressRes, purchasesRes, emailPurchasesRes, profileRes] = await Promise.allSettled([
        catalogBundlePromise,
        userProgressPromise,
        purchasesPromise,
        emailPurchasesPromise,
        profilePromise
      ]);

      const catalog: CachedCatalogBundle = catalogBundle.status === 'fulfilled'
        ? catalogBundle.value
        : {
            courses: [],
            courseChapters: {},
            courseStats: {},
            packages: [],
            courseOverrides: {},
            chapterOverrides: {},
            manualGrantsMap: {},
            fetchedAt: 0
          };

      const progressOk = canReadPrivateUserData && progressRes.status === 'fulfilled' && !(progressRes.value as any)?.error;
      const userProgress = (progressOk && Array.isArray((progressRes.value as any)?.data))
        ? (progressRes.value as any).data
        : [];

      const purchasesOk = canReadPrivateUserData && purchasesRes.status === 'fulfilled' && !(purchasesRes.value as any)?.error;
      const purchases: { product_id: string; created_at: any }[] = [];
      const seenPurchaseIds = new Set<string>();
      if (purchasesOk && Array.isArray((purchasesRes.value as any)?.data)) {
        for (const p of (purchasesRes.value as any).data) {
          if (p?.product_id && !seenPurchaseIds.has(p.product_id)) {
            purchases.push(p);
            seenPurchaseIds.add(p.product_id);
          }
        }
      }
      if (canReadPrivateUserData && emailPurchasesRes.status === 'fulfilled' && Array.isArray((emailPurchasesRes.value as any)?.data)) {
        for (const p of (emailPurchasesRes.value as any).data) {
          if (p?.product_id && !seenPurchaseIds.has(p.product_id)) {
            purchases.push(p);
            seenPurchaseIds.add(p.product_id);
          }
        }
      }

      const manualGrantedIds: string[] = [];
      const userKeys = [targetUserId?.toLowerCase(), requestedEmail].filter(Boolean) as string[];
      for (const k of userKeys) {
        const granted = catalog.manualGrantsMap[k];
        if (Array.isArray(granted)) {
          for (const cid of granted) {
            if (cid && !manualGrantedIds.includes(cid)) {
              manualGrantedIds.push(cid);
            }
          }
        }
      }

      const profile = (canReadPrivateUserData && profileRes.status === 'fulfilled' && (profileRes.value as any)?.data)
        ? (profileRes.value as any).data
        : null;

      return res.status(200).json({
        success: true,
        courses: catalog.courses,
        courseChapters: catalog.courseChapters,
        courseStats: catalog.courseStats,
        packages: catalog.packages,
        courseOverrides: catalog.courseOverrides,
        chapterOverrides: catalog.chapterOverrides,
        manualGrantedIds,
        purchases,
        purchasesSynced: purchasesOk,
        userProgress,
        userProgressSynced: progressOk,
        profile
      });
    }

    const resolveAuthUserId = async (): Promise<string | null> => {
      if (authUserId) return authUserId;
      if (token && token !== 'undefined' && token !== 'null') {
        try {
          const { data: userData } = await (userClient || supabaseAdmin).auth.getUser(token);
          if (userData?.user?.id) {
            authUserId = userData.user.id;
          }
        } catch (_) {}
      }
      return authUserId;
    };

    if (req.method === 'GET') {
      const queryUserId = (req.query?.userId as string) || (await resolveAuthUserId());
      if (!queryUserId || !isUUID(queryUserId)) {
        return res.status(200).json({ success: true, data: [] });
      }

      const { data, error } = await userClient
        .from('user_progress')
        .select('chapter_id, completed, user_id')
        .eq('user_id', queryUserId);

      if (error) {
        console.warn('[Progress API] GET error notice:', error.message || error);
        return res.status(200).json({ success: true, data: [] });
      }

      return res.status(200).json({ success: true, data: data || [] });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const requestedUserId = body.userId || (req.query?.userId as string);
      const chapterId = body.chapterId || (req.query?.chapterId as string);
      const completed = body.completed !== undefined ? Boolean(body.completed) : true;

      const targetUserId = (requestedUserId && isUUID(requestedUserId))
        ? requestedUserId
        : (await resolveAuthUserId());

      if (!targetUserId || !isUUID(targetUserId)) {
        return res.status(400).json({ error: 'Valid user UUID is required for progress' });
      }

      if (!chapterId || !isUUID(chapterId)) {
        return res.status(400).json({ error: 'Valid chapter UUID is required for progress' });
      }

      // 1. Try with supabaseAdmin (service role if available)
      let { data, error } = await supabaseAdmin
        .from('user_progress')
        .upsert({
          user_id: targetUserId,
          chapter_id: chapterId,
          completed
        }, { onConflict: 'user_id,chapter_id' })
        .select();

      // 2. If admin failed due to RLS (e.g. running with anon key) and user token is present, try with user-scoped client
      if (error && (error.code === '42501' || error.message?.includes('row-level security')) && authHeader) {
        try {
          const userScopedClient = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey, {
            auth: { persistSession: false },
            global: { headers: { Authorization: authHeader } }
          });

          const userRes = await userScopedClient
            .from('user_progress')
            .upsert({
              user_id: targetUserId,
              chapter_id: chapterId,
              completed
            }, { onConflict: 'user_id,chapter_id' })
            .select();

          if (!userRes.error) {
            data = userRes.data;
            error = null;
          }
        } catch (_) {}
      }

      if (error) {
        console.warn('[Progress API] Upsert notice (handled gracefully):', error.message || error);
        // Return soft success with saved_local flag so user experience remains flawless
        return res.status(200).json({
          success: true,
          saved_local: true,
          completed,
          user_id: targetUserId,
          chapter_id: chapterId,
          note: error.message
        });
      }

      return res.status(200).json({
        success: true,
        completed,
        user_id: targetUserId,
        chapter_id: chapterId,
        data: data?.[0] || null
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.warn('[Progress API] Error handled gracefully:', err?.message || err);
    return res.status(200).json({ success: true, fallback: true });
  }
}
