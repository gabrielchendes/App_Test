import React from 'react';
import { motion, useMotionValue, useTransform, animate as animateMotion } from 'motion/react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Bell, X, Trophy } from 'lucide-react';
import { toast } from 'sonner';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'achievement' | 'loading' | 'default';

export interface ModernTopToastProps {
  id: string | number;
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  variant?: ToastVariant;
  icon?: React.ReactNode;
  badge?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface VariantConfig {
  badgeLabel: string;
  kickerColor: string;
  iconBg: string;
  iconBorder: string;
  iconNode: React.ReactNode;
  glowShadow: string;
  borderColor: string;
  accentBar: string;
}

const variantConfigs: Record<ToastVariant, VariantConfig> = {
  success: {
    badgeLabel: 'Success',
    kickerColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
    iconBorder: 'border-emerald-500/30',
    iconNode: <CheckCircle2 size={15} className="text-emerald-400" />,
    glowShadow: 'shadow-[0_12px_28px_-8px_rgba(16,185,129,0.22),0_4px_16px_rgba(0,0,0,0.5)]',
    borderColor: 'border-emerald-500/30',
    accentBar: 'from-emerald-400/80 via-teal-400/40 to-transparent',
  },
  error: {
    badgeLabel: 'Alert',
    kickerColor: 'text-rose-400',
    iconBg: 'bg-rose-500/15',
    iconBorder: 'border-rose-500/30',
    iconNode: <AlertCircle size={15} className="text-rose-400" />,
    glowShadow: 'shadow-[0_12px_28px_-8px_rgba(244,63,94,0.22),0_4px_16px_rgba(0,0,0,0.5)]',
    borderColor: 'border-rose-500/30',
    accentBar: 'from-rose-500/80 via-red-400/40 to-transparent',
  },
  warning: {
    badgeLabel: 'Notice',
    kickerColor: 'text-amber-300 font-bold',
    iconBg: 'bg-amber-500/20',
    iconBorder: 'border-amber-400/60',
    iconNode: <AlertTriangle size={15} className="text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />,
    glowShadow: 'shadow-[0_0_20px_rgba(245,158,11,0.25),0_0_35px_rgba(0,0,0,0.85)]',
    borderColor: 'border-amber-400',
    accentBar: 'from-transparent to-transparent',
  },
  info: {
    badgeLabel: 'Information',
    kickerColor: 'text-sky-400',
    iconBg: 'bg-sky-500/15',
    iconBorder: 'border-sky-500/30',
    iconNode: <Info size={15} className="text-sky-400" />,
    glowShadow: 'shadow-[0_12px_28px_-8px_rgba(56,189,248,0.2),0_4px_16px_rgba(0,0,0,0.5)]',
    borderColor: 'border-sky-500/30',
    accentBar: 'from-sky-400/80 via-blue-400/40 to-transparent',
  },
  achievement: {
    badgeLabel: 'Achievement',
    kickerColor: 'text-amber-300 font-bold',
    iconBg: 'bg-gradient-to-br from-amber-500/25 to-yellow-500/20',
    iconBorder: 'border-amber-400/60',
    iconNode: <Trophy size={15} className="text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />,
    glowShadow: 'shadow-[0_0_20px_rgba(245,158,11,0.25),0_0_35px_rgba(0,0,0,0.85)]',
    borderColor: 'border-amber-400',
    accentBar: 'from-transparent to-transparent',
  },
  loading: {
    badgeLabel: 'Loading...',
    kickerColor: 'text-zinc-400',
    iconBg: 'bg-white/5',
    iconBorder: 'border-white/10',
    iconNode: <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />,
    glowShadow: 'shadow-[0_10px_25px_-8px_rgba(0,0,0,0.6)]',
    borderColor: 'border-white/10',
    accentBar: 'from-zinc-400/40 via-white/15 to-transparent',
  },
  default: {
    badgeLabel: 'Notice',
    kickerColor: 'text-amber-300 font-bold',
    iconBg: 'bg-amber-500/20',
    iconBorder: 'border-amber-400/60',
    iconNode: <Bell size={15} className="text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />,
    glowShadow: 'shadow-[0_0_20px_rgba(245,158,11,0.25),0_0_35px_rgba(0,0,0,0.85)]',
    borderColor: 'border-amber-400',
    accentBar: 'from-transparent to-transparent',
  }
};

export const ModernTopToast: React.FC<ModernTopToastProps> = ({
  id,
  title,
  description,
  variant = 'default',
  icon,
  badge,
  action,
}) => {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-100, -50, 0, 30], [0, 0.6, 1, 0.95]);
  const scale = useTransform(y, [-100, 0, 30], [0.94, 1, 1.01]);
  const [isDismissing, setIsDismissing] = React.useState(false);

  const cfg = variantConfigs[variant] || variantConfigs.default;

  const handleDismiss = React.useCallback(() => {
    if (isDismissing) return;
    setIsDismissing(true);
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([10]);
      }
    } catch {}

    animateMotion(y, -140, {
      type: 'spring',
      stiffness: 420,
      damping: 30,
    });

    setTimeout(() => {
      try {
        toast.dismiss(id);
      } catch {}
    }, 200);
  }, [id, isDismissing, y]);

  // Touch tracking for intuitive upward swipe dismissal
  const touchStartY = React.useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || isDismissing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff < 0) {
      y.set(diff);
      if (diff < -15) {
        touchStartY.current = null;
        handleDismiss();
      }
    }
  };

  const onTouchEnd = () => {
    if (touchStartY.current === null || isDismissing) return;
    touchStartY.current = null;
    animateMotion(y, 0, {
      type: 'spring',
      stiffness: 450,
      damping: 30,
    });
  };

  return (
    <motion.div
      style={{ y, opacity, scale }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      initial={{ opacity: 0, y: -24, scale: 0.96 }}
      animate={
        isDismissing
          ? { opacity: 0, y: -80, scale: 0.92, transition: { duration: 0.2 } }
          : { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 26, stiffness: 380 } }
      }
      className="group relative w-full max-w-[88vw] sm:max-w-[360px] mx-auto select-none pointer-events-auto will-change-transform"
    >
      {/* Sleek, Compact Luxury Glass Capsule */}
      <div 
        style={{ boxSizing: 'border-box' }}
        className={`relative rounded-2xl bg-[#0c0e16]/95 backdrop-blur-2xl border ${cfg.borderColor} ${cfg.glowShadow} transition-all duration-300 overflow-hidden`}
      >
        
        {/* Compact, balanced inner layout */}
        <div className="flex items-center gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 text-white">
          {/* Refined Icon Frame */}
          <div className={`relative w-7 h-7 rounded-xl shrink-0 ${cfg.iconBg} border ${cfg.iconBorder} flex items-center justify-center shadow-sm shadow-black/40`}>
            {icon || cfg.iconNode}
          </div>

          {/* Typography Content */}
          <div className="flex-1 min-w-0 pr-1 text-left">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`text-[9.5px] font-bold tracking-wider uppercase ${cfg.kickerColor}`}>
                {badge || cfg.badgeLabel}
              </span>
            </div>
            <div className="text-xs sm:text-[12.5px] font-semibold text-white tracking-tight leading-snug drop-shadow-sm line-clamp-2">
              {title}
            </div>
            {description && (
              <div className="mt-0.5 text-[11px] text-zinc-400 font-normal leading-relaxed line-clamp-2">
                {description}
              </div>
            )}
            {action && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    action.onClick();
                    handleDismiss();
                  }}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/15 text-white font-medium text-[10px] tracking-wide rounded-md transition-all active:scale-95 cursor-pointer"
                >
                  {action.label}
                </button>
              </div>
            )}
          </div>

          {/* Polished Close Button with border */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDismiss();
            }}
            className="shrink-0 w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white rounded-full bg-white/5 hover:bg-white/15 border border-white/15 hover:border-white/35 active:scale-95 transition-all cursor-pointer"
            title="Close notice"
            aria-label="Close notice"
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
