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

// Faster SW registration safely wrapped to prevent sandbox iframe exceptions
const isIframe = typeof window !== 'undefined' && window.self !== window.top;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isIframe) {
  try {
    registerSW({
      immediate: true,
      onOfflineReady() {
        console.log('App ready for offline use');
      }
    });
  } catch (err) {
    console.warn('Service Worker registration skipped or failed under this environment context:', err);
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(e => {
      console.warn('Fallback SW registration error:', e);
    });
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
