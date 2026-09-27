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
  const isStandalone = window.navigator.standalone === true;
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
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

export const promptPWAInstall = async (): Promise<boolean> => {
  const promptEvent = getDeferredPrompt();
  if (!promptEvent) {
    console.warn('[PWA] promptPWAInstall called but no deferredPrompt is available.');
    return false;
  }

  try {
    await promptEvent.prompt();
    const choiceResult = await promptEvent.userChoice;
    if (choiceResult && choiceResult.outcome === 'accepted') {
      setDeferredPrompt(null);
      return true;
    }
  } catch (err) {
    console.error('[PWA] Error invoking deferredPrompt.prompt():', err);
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
