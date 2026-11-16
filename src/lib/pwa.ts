export type DeviceType = 'ios' | 'android' | 'desktop';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

export const getDeviceType = (): DeviceType => {
  if (typeof window === 'undefined') return 'desktop';
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }
  if (/android/.test(ua)) {
    return 'android';
  }
  return 'desktop';
};

export const isPWAInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  // @ts-ignore - navigator.standalone is iOS-specific
  const isStandalone = (window.navigator as any)?.standalone === true;
  const isDisplayStandalone = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)').matches : false;
  return isStandalone || isDisplayStandalone;
};

export const getPWADismissed = (): boolean => {
  try {
    return localStorage.getItem('pwa_install_dismissed') === 'true';
  } catch (e) {
    return false;
  }
};

export const setPWADismissed = (value: boolean) => {
  try {
    localStorage.setItem('pwa_install_dismissed', value.toString());
  } catch (e) {}
};

export const getDeferredPrompt = (): BeforeInstallPromptEvent | null => {
  if (typeof window !== 'undefined' && !globalDeferredPrompt && (window as any).deferredPWAInstallPrompt) {
    globalDeferredPrompt = (window as any).deferredPWAInstallPrompt;
  }
  return globalDeferredPrompt;
};

export const setDeferredPrompt = (e: BeforeInstallPromptEvent | null) => {
  globalDeferredPrompt = e;
  if (typeof window !== 'undefined') {
    (window as any).deferredPWAInstallPrompt = e;
  }
  promptListeners.forEach(fn => {
    try {
      fn(e);
    } catch (err) {
      console.warn('[PWA] Error in prompt listener:', err);
    }
  });
};

export const subscribeToPrompt = (fn: (prompt: BeforeInstallPromptEvent | null) => void) => {
  promptListeners.add(fn);
  return () => {
    promptListeners.delete(fn);
  };
};

export const waitForDeferredPrompt = (timeoutMs = 3500): Promise<BeforeInstallPromptEvent | null> => {
  const current = getDeferredPrompt();
  if (current) return Promise.resolve(current);

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(getDeferredPrompt());
      }
    }, timeoutMs);

    const onPrompt = (e: any) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(e.detail || getDeferredPrompt() || e);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('pwa-prompt-available', onPrompt);
    };

    window.addEventListener('beforeinstallprompt', onPrompt, { once: true });
    window.addEventListener('pwa-prompt-available', onPrompt, { once: true });
  });
};

export const promptPWAInstall = async (timeoutMs = 400): Promise<boolean> => {
  let promptEvent = getDeferredPrompt();

  if (!promptEvent && typeof window !== 'undefined') {
    // Wait briefly in case browser evaluation takes a quick moment
    promptEvent = await waitForDeferredPrompt(timeoutMs);
  }

  if (!promptEvent) {
    return false;
  }

  try {
    await promptEvent.prompt();
    // Once prompt() resolves, the native Android system dialog is already displayed on screen
    const choiceResult = await promptEvent.userChoice;
    if (choiceResult && choiceResult.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    // Return true because the native prompt was successfully invoked to the user
    return true;
  } catch (err) {
    console.error('[PWA] Error invoking deferredPrompt.prompt():', err);
  }
  return false;
};

export const installOnAndroidDirectly = async (): Promise<boolean> => {
  // First attempt native prompt directly without annoying delays
  const success = await promptPWAInstall(400);
  if (success) return true;

  if (typeof window !== 'undefined') {
    const ua = window.navigator.userAgent.toLowerCase();
    const isWebView = /wv|webview|fbav|instagram|micromessenger|threads/i.test(ua);
    // If inside In-App browser/WebView, direct intent to Chrome brings up install
    if (isWebView) {
      window.location.href = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end;`;
      return true;
    }
  }

  return false;
};

// Global event listener setup at module initialization
if (typeof window !== 'undefined') {
  if ((window as any).deferredPWAInstallPrompt) {
    globalDeferredPrompt = (window as any).deferredPWAInstallPrompt;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    setDeferredPrompt(e as BeforeInstallPromptEvent);
  });

  window.addEventListener('pwa-prompt-available', (e: any) => {
    if (e.detail) {
      setDeferredPrompt(e.detail as BeforeInstallPromptEvent);
    }
  });

  window.addEventListener('appinstalled', () => {
    setDeferredPrompt(null);
  });
}

// ============================================================================
// 12-Hour PWA Auto-Sync & Anti-Flicker Update Controls
// ============================================================================

export const PWA_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

const CATALOG_SYNC_AT_KEY = 'pwa_last_12h_catalog_sync_at';
const SW_CHECK_AT_KEY = 'pwa_last_12h_sw_check_at';
const SW_RELOAD_AT_KEY = 'pwa_last_12h_sw_reload_at';
const SW_SESSION_RELOAD_KEY = 'pwa_sw_reloaded_session';

function readStoredTimestamp(key: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(key);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

function writeStoredTimestamp(key: string, ts = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, String(ts));
  } catch {}
}

export function is12HourCatalogSyncDue(): boolean {
  const last = readStoredTimestamp(CATALOG_SYNC_AT_KEY);
  return Date.now() - last >= PWA_SYNC_INTERVAL_MS;
}

export function mark12HourCatalogSynced(): void {
  writeStoredTimestamp(CATALOG_SYNC_AT_KEY, Date.now());
}

export function invalidate12HourCatalogSync(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CATALOG_SYNC_AT_KEY);
  } catch {}
}

export function is12HourSwCheckDue(): boolean {
  const last = readStoredTimestamp(SW_CHECK_AT_KEY);
  return Date.now() - last >= PWA_SYNC_INTERVAL_MS;
}

export function mark12HourSwChecked(): void {
  writeStoredTimestamp(SW_CHECK_AT_KEY, Date.now());
}

export function canApplySwReloadOnce(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Never reload if user is actively watching a lesson or editing in Admin
    if ((window as any).__mtBusyInLesson || (window as any).__mtBusyInAdmin) {
      return false;
    }
    // Never reload more than once per browser/PWA session
    if (sessionStorage.getItem(SW_SESSION_RELOAD_KEY) === '1') {
      return false;
    }
    // Never reload more than once every 12 hours
    const lastReload = readStoredTimestamp(SW_RELOAD_AT_KEY);
    if (Date.now() - lastReload < PWA_SYNC_INTERVAL_MS) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function markSwReloadApplied(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SW_SESSION_RELOAD_KEY, '1');
    localStorage.setItem(SW_RELOAD_AT_KEY, String(Date.now()));
  } catch {}
}

