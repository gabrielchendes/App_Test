import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface AppSettings {
  app_name: string;
  admin_email: string;
  app_description: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  pwa_icon_url: string | null;
  android_icon_url?: string | null;
  ios_icon_url?: string | null;
  support_whatsapp: string;
  support_email: string;
  support_whatsapp_message: string;
  auth_method: 'password' | 'passwordless';
  show_support_login: boolean;
  show_support_app: boolean;
  support_whatsapp_enabled: boolean;
  support_email_enabled: boolean;
  support_whatsapp_floating_enabled: boolean;
  support_whatsapp_floating_community_enabled: boolean;
  support_whatsapp_floating_profile_enabled: boolean;
  support_whatsapp_home_enabled: boolean;
  support_email_home_enabled: boolean;
  support_whatsapp_community_enabled: boolean;
  support_email_community_enabled: boolean;
  support_whatsapp_profile_enabled: boolean;
  support_email_profile_enabled: boolean;
  support_whatsapp_login_enabled: boolean;
  support_email_login_enabled: boolean;
  support_whatsapp_login_floating?: boolean;
  support_whatsapp_app_enabled: boolean;
  support_email_app_enabled: boolean;
  support_whatsapp_course_enabled: boolean;
  support_email_course_enabled: boolean;
  support_whatsapp_floating_course_enabled: boolean;
  support_type?: 'floating' | 'box';
  login_display_type: 'title' | 'logo' | 'both';
  login_install_button_pulsing: 'pulsing' | 'static' | 'hidden' | boolean;
  login_platform_name?: string;
  logo_height?: number;
  custom_texts: { [key: string]: string };
  banner_images: string[];
  banner_interval: number;
  banner_config: Array<{ scale: number, x: number, y: number, stretch?: boolean, link?: string }>;
  banner_images_mobile?: string[];
  banner_config_mobile?: Array<{ scale: number, x: number, y: number, stretch?: boolean, link?: string }>;
  banner_sync?: boolean;
  course_pdf_auto_complete_fullscreen?: boolean;
  app_url?: string;
  gtm_id?: string;
  main_course_hotmart_id?: string;
  show_course_titles_home?: boolean;
  show_lesson_play_icon?: boolean;
  show_lesson_duration?: boolean;
  enable_testimonials?: boolean;
}

const defaultSettings: AppSettings = {
  show_course_titles_home: false,
  show_lesson_play_icon: false,
  show_lesson_duration: false,
  enable_testimonials: true,
  main_course_hotmart_id: '',
  app_name: 'Missing Trigger',
  login_platform_name: '',
  admin_email: 'atendimento@suporte.com',
  app_description: 'Access your exclusive area',
  primary_color: '#ef4444',
  secondary_color: '#dc2626',
  background_color: '#0f0f0f',
  logo_url: null,
  favicon_url: null,
  pwa_icon_url: null,
  android_icon_url: null,
  ios_icon_url: null,
  support_whatsapp: '5500000000000',
  support_email: 'atendimento@suporte.com',
  support_whatsapp_message: 'Hello, I would like to ask a question about the course.',
  auth_method: 'passwordless',
  show_support_login: true,
  show_support_app: true,
  support_whatsapp_enabled: true,
  support_email_enabled: true,
  support_whatsapp_floating_enabled: true,
  support_whatsapp_floating_community_enabled: true,
  support_whatsapp_floating_profile_enabled: true,
  support_whatsapp_home_enabled: true,
  support_email_home_enabled: true,
  support_whatsapp_community_enabled: true,
  support_email_community_enabled: true,
  support_whatsapp_profile_enabled: true,
  support_email_profile_enabled: true,
  support_whatsapp_login_enabled: true,
  support_email_login_enabled: true,
  support_whatsapp_login_floating: true,
  support_whatsapp_app_enabled: true,
  support_email_app_enabled: true,
  support_whatsapp_course_enabled: true,
  support_email_course_enabled: true,
  support_whatsapp_floating_course_enabled: true,
  support_type: 'floating',
  login_display_type: 'title',
  login_install_button_pulsing: 'pulsing',
  logo_height: 64,
  app_url: 'https://missingtrigger.vercel.app',
  gtm_id: '',
  custom_texts: {
    'auth.welcome': 'Welcome back!',
    'auth.subtitle': 'Access your exclusive area',
    'community.title': 'Community',
    'community.subtitle': 'Share your journey',
    'courses.title': 'My Courses',
    'courses.subtitle': 'Continue your learning',
    'admin.courses.paid': 'My Courses',
    'admin.courses.free': 'New Releases',
    'admin.courses.bonus': 'My Bonuses',
    'admin.security.error_length': 'Password must be at least 4 characters long',
    'admin.security.error_mismatch': 'Passwords do not match',
    'admin.security.success': 'Administrator password successfully updated!',
    'auth.user_not_found': 'User not found.',
  },
  banner_images: [
    'https://picsum.photos/seed/maternity-banner-1/1200/600',
    'https://picsum.photos/seed/maternity-banner-2/1200/600'
  ],
  banner_interval: 5000,
  banner_config: [
    { scale: 100, x: 50, y: 50, stretch: true },
    { scale: 100, x: 50, y: 50, stretch: true }
  ],
  banner_images_mobile: [],
  banner_config_mobile: [],
  banner_sync: true,
  course_pdf_auto_complete_fullscreen: false
};

interface SettingsContextType {
  settings: AppSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  applyTheme: (s: AppSettings) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const cached = localStorage.getItem('app_settings_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.custom_texts && typeof parsed.custom_texts === 'object') {
          const adminAnswerText = parsed.custom_texts['course.admin_answer'];
          if (adminAnswerText && (
            adminAnswerText.toLowerCase().includes('teacher') || 
            adminAnswerText.toLowerCase().includes('professora') || 
            adminAnswerText.toLowerCase().includes('professor')
          )) {
            delete parsed.custom_texts['course.admin_answer'];
          }
        }
        return { ...defaultSettings, ...parsed };
      }
    } catch (e) {
      console.error('Failed to parse cached settings on build:', e);
    }
    return defaultSettings;
  });

  // Fast initialization: if we already have valid cached settings, don't block the screen
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('app_settings_cache');
    } catch {
      return false;
    }
  });

  const fetchSettings = async () => {
    // Safety timeout to prevent hanging on poor mobile connections
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 2000);

    try {
      let data: any = null;

      // 1. Try fetching server-merged settings with local persistent overrides
      try {
        const resp = await fetch('/api/v1/settings', { signal: AbortSignal.timeout(2000) });
        if (resp.ok) {
          const json = await resp.json();
          if (json && (json.app_name || json.favicon_url || json.custom_texts)) {
            data = json;
          }
        }
      } catch (_) {}

      // 2. Fall back to Supabase client if server route didn't reply
      if (!data && supabase) {
        const { data: sbData, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (error) {
          console.warn('Supabase notice fetching settings, falling back to cached/defaults:', error?.message || error);
          if (error.message && (error.message.includes('Refresh Token Not Found') || error.message.includes('invalid_grant'))) {
            console.warn('Stale auth detected in SettingsProvider, clearing...');
            localStorage.removeItem('maternidade_premium_auth');
          }
        }

        if (sbData) {
          data = sbData;
        }
      }

      if (data) {
        if (data.custom_texts && typeof data.custom_texts === 'object') {
          const adminAnswerText = data.custom_texts['course.admin_answer'];
          if (adminAnswerText && (
            adminAnswerText.toLowerCase().includes('teacher') || 
            adminAnswerText.toLowerCase().includes('professora') || 
            adminAnswerText.toLowerCase().includes('professor')
          )) {
            delete data.custom_texts['course.admin_answer'];
          }
          if (data.custom_texts['config.support_type']) {
            data.support_type = data.custom_texts['config.support_type'];
          }
          if (data.custom_texts['config.show_course_titles_home'] !== undefined) {
            data.show_course_titles_home = data.custom_texts['config.show_course_titles_home'] === 'true';
          }
          if (data.custom_texts['config.show_lesson_play_icon'] !== undefined) {
            data.show_lesson_play_icon = data.custom_texts['config.show_lesson_play_icon'] === 'true';
          }
          if (data.custom_texts['config.show_lesson_duration'] !== undefined) {
            data.show_lesson_duration = data.custom_texts['config.show_lesson_duration'] === 'true';
          }
          if (data.custom_texts['config.support_whatsapp_login_floating'] !== undefined) {
            data.support_whatsapp_login_floating = data.custom_texts['config.support_whatsapp_login_floating'] === 'true';
          }
          if (data.custom_texts['config.pwa_icon_url'] !== undefined) {
            data.pwa_icon_url = data.custom_texts['config.pwa_icon_url'] || null;
          }
          if (data.custom_texts['config.android_icon_url'] !== undefined) {
            data.android_icon_url = data.custom_texts['config.android_icon_url'] || null;
          }
          if (data.custom_texts['config.ios_icon_url'] !== undefined) {
            data.ios_icon_url = data.custom_texts['config.ios_icon_url'] || null;
          }
          if (data.custom_texts['config.favicon_url'] !== undefined) {
            data.favicon_url = data.custom_texts['config.favicon_url'] || null;
          }
          if (data.favicon_url && data.favicon_url.includes('LogoMT.png')) {
            data.favicon_url = data.favicon_url.replace('LogoMT.png', 'LogoMTiPhone.png');
          }
          if (!data.ios_icon_url && data.logo_url && data.logo_url.includes('iPhone')) {
            data.ios_icon_url = data.logo_url;
          }
          if (data.custom_texts['config.pwa_app_name']) {
            data.app_name = data.custom_texts['config.pwa_app_name'];
          }
          if (data.custom_texts['auth.platform_name'] !== undefined) {
            data.login_platform_name = data.custom_texts['auth.platform_name'];
          }
        }
        setSettings(data);
        applyTheme(data);
        try {
          localStorage.setItem('app_settings_cache', JSON.stringify(data));
        } catch (e) {
          console.error('Failed to cache settings:', e);
        }
      }
    } catch (error) {
      console.warn('Notice fetching settings, using defaults:', error);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const applyTheme = (s: AppSettings) => {
    // Apply colors to CSS variables
    document.documentElement.style.setProperty('--primary', s.primary_color);
    document.documentElement.style.setProperty('--primary-hover', s.secondary_color);
    document.documentElement.style.setProperty('--bg-main', s.background_color || '#0f0f0f');
    
    // Also update RGB for shadows
    const r = parseInt(s.primary_color.slice(1, 3), 16);
    const g = parseInt(s.primary_color.slice(3, 5), 16);
    const b = parseInt(s.primary_color.slice(5, 7), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
    }
    
    // Update title
    document.title = s.app_name;

    // 1. Update Browser Tab Favicon strictly and force browser DOM repaint with timestamp
    let rawFav = s.favicon_url || s.custom_texts?.['config.favicon_url'];
    if (rawFav && rawFav.includes('LogoMT.png')) {
      rawFav = rawFav.replace('LogoMT.png', 'LogoMTiPhone.png');
    }
    const cleanFaviconUrl = (rawFav && rawFav.trim()) 
      ? rawFav.trim() 
      : ((s.custom_texts?.['config.ios_icon_url']) || s.ios_icon_url || (s.logo_url && s.logo_url.includes('iPhone') ? s.logo_url : null) || '/favicon.png');

    if (cleanFaviconUrl) {
      // Remove all existing non-apple icon tags to force browsers to re-register the favicon
      const oldIcons = document.querySelectorAll("link[rel*='icon']:not([rel*='apple-touch-icon'])");
      oldIcons.forEach((el) => el.remove());

      const t = Date.now();
      const busterUrl = cleanFaviconUrl.startsWith('http')
        ? (cleanFaviconUrl.includes('?') ? `${cleanFaviconUrl}&_v=${t}` : `${cleanFaviconUrl}?_v=${t}`)
        : `/favicon.png?_v=${t}`;

      const link = document.createElement('link');
      link.id = 'app-favicon';
      link.rel = 'icon';
      if (cleanFaviconUrl.split('?')[0].endsWith('.svg')) {
        link.type = 'image/svg+xml';
      } else if (cleanFaviconUrl.split('?')[0].endsWith('.ico')) {
        link.type = 'image/x-icon';
      } else {
        link.type = 'image/png';
      }
      link.href = busterUrl;
      document.head.appendChild(link);

      let shortcut = document.createElement('link');
      shortcut.rel = 'shortcut icon';
      shortcut.href = busterUrl;
      document.head.appendChild(shortcut);
    }

    // 2. Update Apple Touch Icon (iPhone / iPad iOS)
    const effectiveIosIcon = (s.ios_icon_url && s.ios_icon_url.trim()) || 
      (s.custom_texts?.['config.ios_icon_url'] && s.custom_texts['config.ios_icon_url'].trim()) || 
      (s.logo_url && s.logo_url.includes('iPhone') ? s.logo_url.trim() : null) || 
      '/apple-touch-icon.png';
    if (effectiveIosIcon) {
      const appleIcons = document.querySelectorAll("link[rel='apple-touch-icon']");
      appleIcons.forEach((el) => el.remove());

      const appleTimestamp = Date.now();
      const appleBusterUrl = effectiveIosIcon.startsWith('http')
        ? (effectiveIosIcon.includes('?') ? `${effectiveIosIcon}&_v=${appleTimestamp}` : `${effectiveIosIcon}?_v=${appleTimestamp}`)
        : `/apple-touch-icon.png?_v=${appleTimestamp}`;

      const appleLink180 = document.createElement('link');
      appleLink180.rel = 'apple-touch-icon';
      appleLink180.sizes = '180x180';
      appleLink180.href = appleBusterUrl;
      document.head.appendChild(appleLink180);

      const appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.href = appleBusterUrl;
      document.head.appendChild(appleLink);

      // iOS Web App Title & Application Name
      const shortTitle = s.custom_texts?.['config.app_short_name'] || s.app_name || 'Missing Trigger';
      let appleTitle = document.querySelector("meta[name='apple-mobile-web-app-title']") as HTMLMetaElement;
      if (!appleTitle) {
        appleTitle = document.createElement('meta');
        appleTitle.name = 'apple-mobile-web-app-title';
        document.head.appendChild(appleTitle);
      }
      appleTitle.content = shortTitle;

      let appNameMeta = document.querySelector("meta[name='application-name']") as HTMLMetaElement;
      if (!appNameMeta) {
        appNameMeta = document.createElement('meta');
        appNameMeta.name = 'application-name';
        document.head.appendChild(appNameMeta);
      }
      appNameMeta.content = shortTitle;
    }

    // 3. Android Web App Manifest
    // Ensure manifest link updates dynamically with cache-busting timestamp to trigger instant re-evaluation in Chromium
    const manifestTimestamp = Date.now();
    let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    if (manifestLink) {
      manifestLink.href = `/manifest.json?_v=${manifestTimestamp}`;
    } else {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = `/manifest.json?_v=${manifestTimestamp}`;
      document.head.appendChild(manifestLink);
    }
  };

  useEffect(() => {
    applyTheme(settings);
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings, applyTheme }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
