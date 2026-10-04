import express from 'express';
import { createServer as createViteServer, loadEnv } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Ensure DOMException is available globally
if (typeof (globalThis as any).DOMException === 'undefined') {
  (globalThis as any).DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || 'DOMException';
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const mode = process.env.NODE_ENV || 'development';
  const env = loadEnv(mode, process.cwd(), '');
  
  // Inject loaded env into process.env if they are not already there
  Object.assign(process.env, env);

  // Clean invalid or placeholder keys
  const isInvalidKey = (k?: string) => {
    if (!k) return true;
    const trimmed = k.trim();
    return (
      trimmed === '' || 
      trimmed === 'undefined' || 
      trimmed === 'null' || 
      trimmed === 'placeholder-key'
    );
  };

  if (isInvalidKey(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (isInvalidKey(process.env.SUPABASE_SERVICE_KEY)) {
    delete process.env.SUPABASE_SERVICE_KEY;
  }
  if (isInvalidKey(process.env.SUPABASE_SECRET_KEY)) {
    delete process.env.SUPABASE_SECRET_KEY;
  }
  if (isInvalidKey(process.env.VITE_SUPABASE_SERVICE_ROLE_KEY)) {
    delete process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  }

  // Active validation probe: test whether SUPABASE_SERVICE_ROLE_KEY is registered for this Supabase project (non-blocking)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const targetUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (targetUrl) {
      fetch(`${targetUrl}/rest/v1/profiles?select=id&limit=1`, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        signal: AbortSignal.timeout(1500)
      }).then(async (testRes) => {
        if (!testRes.ok) {
          const bodyTxt = await testRes.text();
          if (bodyTxt.includes('Unregistered API key') || testRes.status === 401) {
            console.warn('[Server Init] SUPABASE_SERVICE_ROLE_KEY is unregistered on this Supabase project. Clearing it so endpoints safely use valid publishable keys and user auth tokens.');
            delete process.env.SUPABASE_SERVICE_ROLE_KEY;
            delete process.env.SUPABASE_SERVICE_KEY;
            delete process.env.SUPABASE_SECRET_KEY;
            delete process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
          }
        }
      }).catch((probeErr) => {
        console.warn('[Server Init] Warning verifying SUPABASE_SERVICE_ROLE_KEY:', probeErr);
      });
    }
  }
  
  console.log('[Server Init] Loaded Env Vars:', Object.keys(env).filter(k => !k.includes('SECRET') && !k.includes('KEY')));
  console.log('[Server Init] Important Vars Present:', {
    hasUrl: !!process.env.VITE_SUPABASE_URL,
    hasAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const app = express();
  
  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  // CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Path to persistent local settings override
  const SETTINGS_FILE = path.join(__dirname, 'data', 'app_settings.json');

  // Helper to fetch current settings from Supabase merged with local persistent settings
  let cachedAppSettings: any = null;
  let lastSettingsFetchTime = 0;
  async function fetchCurrentAppSettings() {
    const now = Date.now();
    if (cachedAppSettings && now - lastSettingsFetchTime < 1000) {
      return cachedAppSettings;
    }

    let localOverride: any = {};
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const fileContent = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        localOverride = JSON.parse(fileContent);
      }
    } catch (e) {
      console.warn('[Server] Error reading local settings file:', e);
    }

    let dbSettings: any = {};
    const targetUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (targetUrl && anonKey) {
      try {
        const resp = await fetch(`${targetUrl}/rest/v1/app_settings?id=eq.1&limit=1`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`
          },
          signal: AbortSignal.timeout(4000)
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.[0]) {
            dbSettings = data[0];
          }
        }
      } catch (err: any) {
        // Silently fall back to local settings on timeout/abort without generating loud console warnings
        const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError' || (err?.message && (err.message.includes('timeout') || err.message.includes('aborted')));
        if (!isTimeout) {
          console.log('[Server] Note fetching remote settings, using local/cached baseline');
        }
      }
    }

    // Deep merge: dbSettings baseline + localOverride on top
    const merged = {
      ...dbSettings,
      ...localOverride,
      custom_texts: {
        ...(dbSettings.custom_texts || {}),
        ...(localOverride.custom_texts || {})
      }
    };

    // Auto-fix any legacy broken reference
    if (merged.favicon_url && merged.favicon_url.includes('LogoMT.png')) {
      merged.favicon_url = merged.favicon_url.replace('LogoMT.png', 'LogoMTiPhone.png');
    }
    if (merged.custom_texts?.['config.favicon_url'] && merged.custom_texts['config.favicon_url'].includes('LogoMT.png')) {
      merged.custom_texts['config.favicon_url'] = merged.custom_texts['config.favicon_url'].replace('LogoMT.png', 'LogoMTiPhone.png');
    }

    cachedAppSettings = merged;
    lastSettingsFetchTime = now;
    return merged;
  }

  // Invalidation endpoint to immediately purge cached app settings and icon buffers
  app.all(['/api/v1/clear-cache', '/api/clear-cache'], (_req, res) => {
    cachedAppSettings = null;
    lastSettingsFetchTime = 0;
    imageStreamCache.clear();
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, cleared: true, timestamp: Date.now() });
  });

  // Dedicated settings read endpoint
  app.get(['/api/v1/settings', '/api/settings'], async (_req, res) => {
    try {
      const s = await fetchCurrentAppSettings();
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return res.json(s);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Dedicated settings update endpoint that guarantees persistent saving of all branding icons
  app.post(['/api/v1/update-settings', '/api/update-settings'], async (req, res) => {
    try {
      const body = req.body || {};
      const newSettings = body.settings || body;
      
      console.log('[Server API] Updating app branding and settings:', {
        favicon_url: newSettings.favicon_url,
        android_icon_url: newSettings.android_icon_url,
        ios_icon_url: newSettings.ios_icon_url,
        pwa_icon_url: newSettings.pwa_icon_url,
        app_name: newSettings.app_name
      });

      // 1. Persist to local JSON file
      let currentLocal: any = {};
      try {
        if (fs.existsSync(SETTINGS_FILE)) {
          currentLocal = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        }
      } catch (_) {}

      const updatedLocal = {
        ...currentLocal,
        ...newSettings,
        custom_texts: {
          ...(currentLocal.custom_texts || {}),
          ...(newSettings.custom_texts || {})
        }
      };

      const dataDir = path.dirname(SETTINGS_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updatedLocal, null, 2), 'utf-8');

      // 2. Immediately purge cache and buffers so newest icons stream instantly
      cachedAppSettings = null;
      lastSettingsFetchTime = 0;
      imageStreamCache.clear();

      // 3. Attempt async background sync to Supabase if credentials exist
      const targetUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
      const authHeader = req.headers.authorization;
      if (targetUrl && (anonKey || authHeader)) {
        try {
          const authKey = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : anonKey;
          const sbPayload = { ...newSettings };
          delete sbPayload.android_icon_url;
          delete sbPayload.ios_icon_url;
          
          fetch(`${targetUrl}/rest/v1/app_settings?id=eq.1`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: anonKey || authKey,
              Authorization: `Bearer ${authKey || anonKey}`,
              Prefer: 'return=representation'
            },
            body: JSON.stringify(sbPayload)
          }).then(async (sbRes) => {
            if (!sbRes.ok) {
              const txt = await sbRes.text();
              console.warn('[Server Sync] Supabase update warning:', sbRes.status, txt);
            } else {
              console.log('[Server Sync] Supabase updated successfully');
            }
          }).catch((syncErr) => {
            console.warn('[Server Sync] Background sync error:', syncErr.message);
          });
        } catch (_) {}
      }

      res.setHeader('Cache-Control', 'no-store');
      return res.json({ 
        success: true, 
        message: 'Configurações e ícones atualizados com sucesso!', 
        settings: updatedLocal 
      });
    } catch (err: any) {
      console.error('[Server API] Error updating settings:', err);
      return res.status(500).json({ error: err.message || 'Erro ao salvar configurações' });
    }
  });

  // In-memory buffer cache for dynamic icons to ensure fast 200 OK responses with binary image bytes
  const imageStreamCache = new Map<string, { buffer: Buffer; contentType: string; time: number }>();
  async function streamRemoteOrLocal(
    imageUrl: string | null | undefined,
    fallbackFileName: string,
    defaultContentType: string,
    res: any
  ) {
    try {
      let resolvedUrl = imageUrl;
      // Auto-fix typo LogoMT.png (which is 404 in storage) to LogoMTiPhone.png (which is valid)
      if (resolvedUrl && typeof resolvedUrl === 'string' && resolvedUrl.includes('LogoMT.png')) {
        resolvedUrl = resolvedUrl.replace('LogoMT.png', 'LogoMTiPhone.png');
      }

      if (resolvedUrl && typeof resolvedUrl === 'string' && resolvedUrl.startsWith('http')) {
        const now = Date.now();
        const cached = imageStreamCache.get(resolvedUrl);
        if (cached && now - cached.time < 30000) { // 30 seconds TTL
          res.setHeader('Content-Type', cached.contentType);
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          return res.send(cached.buffer);
        }

        const fetchResp = await fetch(resolvedUrl, { signal: AbortSignal.timeout(3000) });
        if (fetchResp.ok) {
          const arrayBuf = await fetchResp.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          const cType = fetchResp.headers.get('content-type') || defaultContentType;
          imageStreamCache.set(resolvedUrl, { buffer: buf, contentType: cType, time: now });
          res.setHeader('Content-Type', cType);
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          return res.send(buf);
        }
      }
    } catch (err) {
      console.warn('[Server] Error streaming icon, falling back to local file:', err);
    }
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return res.sendFile(path.join(__dirname, 'public', fallbackFileName));
  }

  // 1. Dynamic Apple Touch Icon handler (iPhone / iPad / iOS Safari Home Screen)
  app.get([
    '/apple-touch-icon.png',
    '/apple-touch-icon-precomposed.png',
    '/apple-touch-icon-180x180.png',
    '/apple-touch-icon-152x152.png',
    '/apple-touch-icon-120x120.png'
  ], async (_req, res) => {
    try {
      const s = await fetchCurrentAppSettings();
      const customTexts = s.custom_texts || {};
      const rawIos = customTexts['config.ios_icon_url'] || 
                     s.ios_icon_url ||
                     (s.logo_url && s.logo_url.includes('iPhone') ? s.logo_url : null) || 
                     '/apple-touch-icon.png';
      return await streamRemoteOrLocal(rawIos, 'apple-touch-icon.png', 'image/png', res);
    } catch (_) {
      return res.sendFile(path.join(__dirname, 'public', 'apple-touch-icon.png'));
    }
  });

  // 2. Dynamic Favicon handler (Browser Tabs)
  app.get(['/favicon.ico', '/favicon.png', '/favicon.svg'], async (req, res) => {
    try {
      const s = await fetchCurrentAppSettings();
      const customTexts = s.custom_texts || {};
      let fav = customTexts['config.favicon_url'] || s.favicon_url;
      if (fav && fav.includes('LogoMT.png')) {
        fav = fav.replace('LogoMT.png', 'LogoMTiPhone.png');
      }
      if (!fav || !fav.startsWith('http')) {
        fav = customTexts['config.ios_icon_url'] || s.ios_icon_url || (s.logo_url && s.logo_url.includes('iPhone') ? s.logo_url : null) || '/favicon.png';
      }
      const defaultFile = req.path.endsWith('.svg') ? 'favicon.svg' : 'favicon.png';
      const cType = req.path.endsWith('.svg') ? 'image/svg+xml' : (req.path.endsWith('.ico') ? 'image/x-icon' : 'image/png');
      return await streamRemoteOrLocal(fav, defaultFile, cType, res);
    } catch (_) {
      const defaultFile = req.path.endsWith('.svg') ? 'favicon.svg' : 'favicon.png';
      return res.sendFile(path.join(__dirname, 'public', defaultFile));
    }
  });

  // 3. Dynamic Android PWA Icons (/icon-192.png, /icon-512.png)
  // Delivers HTTP 200 with raw binary image bytes so Google Chrome WebAPK minting and Samsung Internet succeed
  app.get(['/icon-192.png', '/icon-512.png'], async (_req, res) => {
    try {
      const s = await fetchCurrentAppSettings();
      const customTexts = s.custom_texts || {};
      const androidIcon = customTexts['config.android_icon_url'] || s.android_icon_url || s.pwa_icon_url || customTexts['config.pwa_icon_url'] || '/icon-512.png';
      return await streamRemoteOrLocal(androidIcon, 'icon-512.png', 'image/png', res);
    } catch (_) {
      return res.sendFile(path.join(__dirname, 'public', 'icon-512.png'));
    }
  });

  // Dynamic manifest.json endpoint to provide Android App Icon and App Name from database/settings
  app.get(['/manifest.json', '/manifest.webmanifest'], async (_req, res) => {
    try {
      const s = await fetchCurrentAppSettings();
      let appName = 'Missing Trigger';
      let shortName = '';
      let themeColor = '#0b0c10';
      let bgColor = '#0b0c10';

      if (s) {
        const customTexts = s.custom_texts || {};
        if (customTexts['config.pwa_app_name'] && typeof customTexts['config.pwa_app_name'] === 'string' && customTexts['config.pwa_app_name'].trim()) {
          appName = customTexts['config.pwa_app_name'].trim();
        } else if (s.app_name && typeof s.app_name === 'string' && s.app_name.trim()) {
          appName = s.app_name.trim();
        }

        if (customTexts['config.app_short_name'] && typeof customTexts['config.app_short_name'] === 'string' && customTexts['config.app_short_name'].trim()) {
          shortName = customTexts['config.app_short_name'].trim();
        } else if (customTexts['config.pwa_short_name'] && typeof customTexts['config.pwa_short_name'] === 'string' && customTexts['config.pwa_short_name'].trim()) {
          shortName = customTexts['config.pwa_short_name'].trim();
        }

        if (s.primary_color) themeColor = s.primary_color;
        if (s.background_color) bgColor = s.background_color;
      }

      if (!shortName) {
        shortName = appName;
      }

      const androidIcon = (s?.custom_texts && s.custom_texts['config.android_icon_url']) || s?.android_icon_url || s?.pwa_icon_url || '';
      const iconKey = androidIcon ? Buffer.from(androidIcon).toString('base64url').slice(-8) : Date.now();

      const manifestIcons: Array<{ src: string; sizes: string; type: string; purpose?: string }> = [];

      if (androidIcon && androidIcon.startsWith('http')) {
        manifestIcons.push({
          src: androidIcon,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        });
      }

      manifestIcons.push(
        {
          src: `/icon-192.png?v=${iconKey}`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/icon-512.png?v=${iconKey}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/icon-192.png?v=${iconKey}`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: `/icon-512.png?v=${iconKey}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      );

      const manifest = {
        id: '/',
        name: appName,
        short_name: shortName,
        description: `${appName} - Exclusive members area.`,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: bgColor,
        theme_color: themeColor,
        icons: manifestIcons
      };
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return res.json(manifest);
    } catch (e: any) {
      console.warn('[Manifest Endpoint] Fallback to static manifest:', e);
      return res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
    }
  });

  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, 'public')));

  // Helper to handle API routes similarly to Vercel
  app.all('/api/*', async (req, res, next) => {
    // Skip if it's Vite's internal stuff
    if (req.path.includes('/@vite/') || req.path.includes('/node_modules/')) {
      return next();
    }

    console.log(`[API Request] ${req.method} ${req.path}`);

    try {
      let apiPath = req.path.replace(/^\/api\//, '');
      
      // Simulate vercel.json rewrites
      const rewrites: Record<string, string> = {
        'v1/login-verify': 'v1/auth?action=login-verify',
        'v1/user-magic-link': 'v1/auth?action=user-magic-link',
        'v1/user-password-set': 'v1/auth?action=user-password-set',
        'v1/users-list': 'v1/admin?action=users-list',
        'v1/user-create': 'v1/admin?action=user-create',
        'v1/notification-push': 'v1/notifications?action=notification-push',
        'v1/notification-history': 'v1/notifications?action=notification-history',
        'v1/notification-clear': 'v1/notifications?action=notification-clear',
        'v1/notify-admin': 'v1/notifications?action=notify-admin',
        'v1/sub-topic': 'v1/notifications?action=sub-topic',
        'v1/generate-permanent-link': 'v1/admin?action=generate-permanent-link',
        'v1/hotmart-webhook': 'v1/hotmart-webhook',
        'v1/webhooks/hotmart': 'v1/hotmart-webhook',
        'v1/webhook-hotmart': 'v1/hotmart-webhook',
        'v1/ai-chat': 'v1/ai-chat',
        'v1/ai-course-editor': 'v1/ai?action=ai-course-editor',
        'v1/analyze-message': 'v1/ai?action=analyze-message',
        'v1/build-complete-course': 'v1/ai?action=build-complete-course',
        'v1/generate-course-copy': 'v1/ai?action=generate-course-copy',
        'v1/generate-lesson': 'v1/ai?action=generate-lesson',
        'v1/refine-sales-copy': 'v1/ai?action=refine-sales-copy',
      };

      if (apiPath.startsWith('v1/ai/')) {
        const subAction = apiPath.replace('v1/ai/', '');
        apiPath = 'v1/ai';
        req.query.action = subAction;
      }

      if (apiPath.startsWith('v1/notifications/')) {
        const subAction = apiPath.replace('v1/notifications/', '');
        apiPath = 'v1/notifications';
        req.query.action = subAction;
      }

      if (rewrites[apiPath]) {
        const [newPath, newQuery] = rewrites[apiPath].split('?');
        apiPath = newPath;
        if (newQuery) {
          const params = new URLSearchParams(newQuery);
          params.forEach((value, key) => {
            req.query[key] = value;
          });
        }
      }

      const segments = apiPath.split('/');
      
      // Try to find the file in /api directory
      let filePath = '';
      let possiblePaths = [
        path.join(__dirname, 'api', apiPath + '.ts'),
        path.join(__dirname, 'api', apiPath, 'index.ts'),
      ];

      // Handle dynamic routes like [id].ts
      if (segments.length >= 2) {
        const lastSegment = segments[segments.length - 1];
        const secondToLast = segments.slice(0, -1).join('/');
        possiblePaths.push(path.join(__dirname, 'api', secondToLast, '[id].ts'));
      }

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          filePath = p;
          break;
        }
      }

      if (filePath) {
        console.log(`[API] Serving from ${filePath}`);
        
        // Debug env presence
        console.log('[API Env Check]', {
          hasUrl: !!process.env.VITE_SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        });

        const module = await vite.ssrLoadModule(filePath);
        if (module.default) {
          if (filePath.endsWith('[id].ts')) {
             const segments = apiPath.split('/');
             req.query.id = segments[segments.length - 1];
          }
          return await module.default(req, res);
        } else {
          console.error(`[API ERROR] No default export found in ${filePath}`);
        }
      } else {
        console.warn(`[API] No file found for ${req.path}. Checked:`, possiblePaths);
      }

      // If no API file found, let Vite handle it
      next();
    } catch (err: any) {
      console.error('Dev API Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Use vite's connect instance as middleware
  app.use(vite.middlewares);

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
