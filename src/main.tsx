import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Toaster } from 'sonner';
import { SettingsProvider } from './contexts/SettingsContext';
import { I18nProvider } from './contexts/I18nContext';
import { TenantProvider } from './contexts/TenantContext';
import ErrorBoundary from './components/ErrorBoundary';

import { registerSW } from 'virtual:pwa-register';
import {
  is12HourSwCheckDue,
  mark12HourSwChecked,
  canApplySwReloadOnce,
  markSwReloadApplied
} from './lib/pwa';

// Unified Service Worker registration (strictly 12h check cycle, zero-flicker guards)
const isIframe = typeof window !== 'undefined' && window.self !== window.top;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isIframe) {
  try {
    let swUpdateCheckAttached = false;
    let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | undefined;

    const triggerControlledSwCheck = (registration?: ServiceWorkerRegistration) => {
      if (!registration) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!is12HourSwCheckDue()) return;

      mark12HourSwChecked();
      registration.update().catch(() => {});
    };

    updateSWFn = registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // Initial 12h-gated check
        triggerControlledSwCheck(registration);

        if (!swUpdateCheckAttached) {
          swUpdateCheckAttached = true;
          const handleResume = () => triggerControlledSwCheck(registration);
          window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              handleResume();
            }
          });
          window.addEventListener('focus', handleResume);
        }
      },
      onNeedRefresh() {
        // Apply new app shell at most once per 12h & session, never mid-lesson or mid-admin edit
        if (canApplySwReloadOnce()) {
          markSwReloadApplied();
          updateSWFn?.(true).catch(() => {});
        }
      },
      onOfflineReady() {
        console.log('App ready for offline use');
      }
    });
  } catch (err) {
    console.warn('Service Worker registration skipped or failed under this environment context:', err);
  }
}

// Prevent Vite dev overlay and browser from crashing on harmless ResizeObserver loop notifications
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    const msg = (e.message || (e.error && e.error.message) || '').toString();
    if (msg.includes('ResizeObserver') || msg.includes('undelivered notifications')) {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
      return true;
    }
  }, true);
}

import { NoticeBoard } from './components/NoticeBoard';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <TenantProvider>
      <SettingsProvider>
        <I18nProvider>
          <App />
          <NoticeBoard />
          <Toaster 
            position="top-center" 
            theme="dark" 
            offset="32px"
            duration={4000}
            toastOptions={{
              className: 'modern-top-toast-container',
            }}
          />
        </I18nProvider>
      </SettingsProvider>
    </TenantProvider>
  </ErrorBoundary>,
);
