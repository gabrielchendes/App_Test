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
    <div className="fixed top-[max(1.5rem,calc(env(safe-area-inset-top)+1rem))] left-1/2 -translate-x-1/2 z-[9999] pointer-events-none max-w-[88vw] sm:max-w-[380px] w-full px-2 flex justify-center">
      <AnimatePresence mode="wait">
        {isOffline ? (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ boxSizing: 'border-box' }}
            className="pointer-events-auto flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#0c0e16]/95 border-[3px] border-amber-400 text-amber-200 text-xs shadow-[0_0_30px_rgba(245,158,11,0.55),0_0_15px_rgba(251,191,36,0.75),0_0_60px_rgba(245,158,11,0.35)] backdrop-blur-xl w-full"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/60 shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.35)]">
                <WifiOff size={13} />
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <span className="font-bold text-white tracking-tight leading-tight truncate">
                  {t('offline.banner_title') && t('offline.banner_title') !== 'Você está offline' ? t('offline.banner_title') : 'You are offline'}
                </span>
                <span className="text-[10.5px] text-zinc-300 font-normal leading-snug line-clamp-1">
                  {t('offline.banner_desc') && !t('offline.banner_desc').includes('Progresso salvo') ? t('offline.banner_desc') : 'Progress saved locally. Will sync automatically upon reconnecting.'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-[#13151f]/90 hover:bg-[#1c2030] text-amber-300 hover:text-white border border-amber-400/60 hover:border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)] hover:shadow-[0_0_14px_rgba(251,191,36,0.6)] active:scale-95 transition-all shrink-0 cursor-pointer"
              aria-label="Close notice"
              title="Close notice"
            >
              <X size={13} strokeWidth={2.2} />
            </button>
          </motion.div>
        ) : showReconnected ? (
          <motion.div
            key="online-banner"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="pointer-events-auto flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#0c0e16]/95 border-2 border-emerald-400/80 text-emerald-200 text-xs shadow-[0_0_24px_rgba(16,185,129,0.35),0_12px_28px_-6px_rgba(0,0,0,0.8)] backdrop-blur-xl ring-1 ring-emerald-300/40"
          >
            <div className="flex items-center gap-2 min-w-0 text-left">
              <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shrink-0">
                <Wifi size={13} />
              </div>
              <span className="font-semibold text-emerald-100 text-xs tracking-tight">
                {t('offline.back_online') && !t('offline.back_online').includes('Conexão') ? t('offline.back_online') : 'Connection restored! All data synchronized.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowReconnected(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              aria-label="Close notice"
              title="Close notice"
            >
              <X size={13} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
