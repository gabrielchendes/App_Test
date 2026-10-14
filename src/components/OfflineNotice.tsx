import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi, X } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { toast } from '../lib/customToast';

export const OfflineNotice: React.FC = () => {
  const { t } = useI18n();
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });
  const [showReconnected, setShowReconnected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
      setDismissed(false);
      
      const title = t('offline.banner_title') || 'You are offline';
      const desc = t('offline.banner_desc') || 'Your progress is saved locally and will sync once you reconnect.';
      toast.warning(title, { description: desc, duration: 5000 });
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      setDismissed(false);

      const backOnline = t('offline.back_online') || 'Back online! All data is synchronized.';
      toast.success(backOnline, { duration: 4000 });

      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);

      return () => clearTimeout(timer);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [t]);

  if (dismissed || (!isOffline && !showReconnected)) {
    return null;
  }

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none max-w-[92vw] sm:max-w-md w-full px-2 flex justify-center">
      <AnimatePresence mode="wait">
        {isOffline ? (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-full bg-zinc-950/95 border border-amber-500/40 text-amber-200 text-xs sm:text-sm font-medium shadow-[0_12px_35px_-8px_rgba(245,158,11,0.3)] backdrop-blur-md w-full"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 shrink-0">
                <WifiOff size={14} />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-amber-100 truncate">
                  {t('offline.banner_title') || 'You are offline'}
                </span>
                <span className="text-[11px] text-amber-300/80 line-clamp-1">
                  {t('offline.banner_desc') || 'Your progress is saved locally and will sync once you reconnect.'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1 rounded-full text-amber-300/60 hover:text-amber-200 hover:bg-amber-500/10 transition-colors shrink-0"
              aria-label="Dismiss offline notice"
            >
              <X size={14} />
            </button>
          </motion.div>
        ) : showReconnected ? (
          <motion.div
            key="online-banner"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-2 rounded-full bg-zinc-950/95 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm font-medium shadow-[0_12px_35px_-8px_rgba(16,185,129,0.3)] backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                <Wifi size={13} className="animate-pulse" />
              </div>
              <span className="font-medium text-emerald-100">
                {t('offline.back_online') || 'Back online! All data is synchronized.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowReconnected(false)}
              className="p-1 rounded-full text-emerald-300/60 hover:text-emerald-200 hover:bg-emerald-500/10 transition-colors shrink-0"
              aria-label="Dismiss reconnected notice"
            >
              <X size={13} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
