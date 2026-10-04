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
