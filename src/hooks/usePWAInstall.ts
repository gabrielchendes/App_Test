import { useState, useEffect, useCallback } from 'react';
import { isPWAInstalled, getPWADismissed, getDeferredPrompt, setDeferredPrompt as setGlobalDeferredPrompt, promptPWAInstall } from '../lib/pwa';

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => getDeferredPrompt());
  const [isInstallable, setIsInstallable] = useState(() => !!getDeferredPrompt() && !isPWAInstalled());
  const [isInstalled, setIsInstalled] = useState(() => isPWAInstalled());
  const [isDismissed, setIsDismissed] = useState(() => getPWADismissed());

  useEffect(() => {
    // Check initial state from global
    const existing = getDeferredPrompt();
    if (existing) {
      setDeferredPrompt(existing);
      setIsInstallable(!isPWAInstalled());
    }
    setIsInstalled(isPWAInstalled());
    setIsDismissed(getPWADismissed());

    const handler = (e: any) => {
      console.log('📦 PWA: beforeinstallprompt event captured');
      e.preventDefault();
      setGlobalDeferredPrompt(e);
      setDeferredPrompt(e);
      setIsInstallable(!isPWAInstalled());
    };

    window.addEventListener('beforeinstallprompt', handler);

    const appInstalledHandler = () => {
      console.log('📦 PWA: appinstalled event captured');
      setIsInstalled(true);
      setGlobalDeferredPrompt(null);
      setDeferredPrompt(null);
      setIsInstallable(false);
    };

    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const success = await promptPWAInstall();
    if (success) {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
    }
    return success;
  }, []);

  return {
    isInstallable,
    isInstalled,
    isDismissed,
    promptInstall,
    deferredPrompt
  };
};
