import React from 'react';
import { motion, useMotionValue, useTransform, animate as animateMotion } from 'motion/react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Bell, X, ChevronUp, Trophy } from 'lucide-react';
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
  badgeText: string;
  badgeBg: string;
  iconBg: string;
  iconRing: string;
  iconGlow: string;
  iconNode: React.ReactNode;
  ambientGlow: string;
  topGleam: string;
}

const variantConfigs: Record<ToastVariant, VariantConfig> = {
  success: {
    badgeLabel: 'SUCCESS',
    badgeText: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30',
    iconBg: 'bg-gradient-to-br from-emerald-500/25 via-emerald-950/40 to-black',
    iconRing: 'ring-1 ring-emerald-400/40 border border-amber-400/40',
    iconGlow: 'shadow-[0_0_15px_rgba(16,185,129,0.35)]',
    iconNode: <CheckCircle2 size={19} className="text-emerald-300" />,
    ambientGlow: 'shadow-[0_16px_45px_-10px_rgba(245,158,11,0.22),0_0_25px_rgba(16,185,129,0.15)]',
    topGleam: 'from-amber-400/0 via-amber-300/90 to-emerald-400/0',
  },
  error: {
    badgeLabel: 'ALERT',
    badgeText: 'text-rose-300',
    badgeBg: 'bg-rose-500/15 border-rose-500/30',
    iconBg: 'bg-gradient-to-br from-rose-500/25 via-rose-950/40 to-black',
    iconRing: 'ring-1 ring-rose-400/40 border border-amber-400/40',
    iconGlow: 'shadow-[0_0_15px_rgba(244,63,94,0.35)]',
    iconNode: <AlertCircle size={19} className="text-rose-300" />,
    ambientGlow: 'shadow-[0_16px_45px_-10px_rgba(244,63,94,0.25),0_0_20px_rgba(245,158,11,0.15)]',
    topGleam: 'from-amber-400/0 via-rose-400/90 to-amber-400/0',
  },
  warning: {
    badgeLabel: 'WARNING',
    badgeText: 'text-amber-300',
    badgeBg: 'bg-amber-500/15 border-amber-500/30',
    iconBg: 'bg-gradient-to-br from-amber-500/25 via-amber-950/40 to-black',
    iconRing: 'ring-1 ring-amber-400/50 border border-amber-300/50',
    iconGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',
    iconNode: <AlertTriangle size={19} className="text-amber-300" />,
    ambientGlow: 'shadow-[0_16px_45px_-10px_rgba(245,158,11,0.3)]',
    topGleam: 'from-amber-400/0 via-amber-300/90 to-amber-400/0',
  },
  info: {
    badgeLabel: 'INFORMATION',
    badgeText: 'text-sky-300',
    badgeBg: 'bg-sky-500/15 border-sky-500/30',
    iconBg: 'bg-gradient-to-br from-sky-500/25 via-sky-950/40 to-black',
    iconRing: 'ring-1 ring-sky-400/40 border border-amber-400/40',
    iconGlow: 'shadow-[0_0_15px_rgba(56,189,248,0.35)]',
    iconNode: <Info size={19} className="text-sky-300" />,
    ambientGlow: 'shadow-[0_16px_45px_-10px_rgba(56,189,248,0.2),0_0_25px_rgba(245,158,11,0.18)]',
    topGleam: 'from-amber-400/0 via-amber-300/80 to-sky-400/0',
  },
  achievement: {
    badgeLabel: 'ACHIEVEMENT',
    badgeText: 'text-amber-300',
    badgeBg: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-400/40',
    iconBg: 'bg-gradient-to-br from-amber-400/30 via-yellow-600/30 to-black',
    iconRing: 'ring-1 ring-amber-300/60 border border-yellow-200/60',
    iconGlow: 'shadow-[0_0_20px_rgba(251,191,36,0.6)]',
    iconNode: <Trophy size={19} className="text-amber-300 animate-pulse" />,
    ambientGlow: 'shadow-[0_18px_50px_-10px_rgba(251,191,36,0.4),0_0_30px_rgba(245,158,11,0.25)]',
    topGleam: 'from-yellow-400/0 via-amber-200 to-yellow-400/0',
  },
  loading: {
    badgeLabel: 'LOADING',
    badgeText: 'text-amber-300',
    badgeBg: 'bg-amber-500/15 border-amber-500/30',
    iconBg: 'bg-gradient-to-br from-amber-500/25 via-amber-950/30 to-black',
    iconRing: 'ring-1 ring-amber-400/40 border border-amber-400/40',
    iconGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    iconNode: <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />,
    ambientGlow: 'shadow-[0_16px_45px_-10px_rgba(245,158,11,0.25)]',
    topGleam: 'from-amber-400/0 via-amber-300/90 to-amber-400/0',
  },
  default: {
    badgeLabel: 'NOTIFICATION',
    badgeText: 'text-amber-300',
    badgeBg: 'bg-amber-500/15 border-amber-500/30',
    iconBg: 'bg-gradient-to-br from-amber-500/25 via-amber-950/30 to-black',
    iconRing: 'ring-1 ring-amber-400/40 border border-amber-400/40',
    iconGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    iconNode: <Bell size={19} className="text-amber-300" />,
    ambientGlow: 'shadow-[0_16px_45px_-10px_rgba(245,158,11,0.25)]',
    topGleam: 'from-amber-400/0 via-amber-300/90 to-amber-400/0',
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
  // Keep opacity visible (1 -> 0.8) while dragging/moving up, only fading out at the very end when it's already offscreen
  const opacity = useTransform(y, [-180, -120, -20, 0, 40], [0, 0.4, 0.95, 1, 0.95]);
  const scale = useTransform(y, [-180, -80, 0, 40], [0.88, 0.95, 1, 1.02]);
  const rotateX = useTransform(y, [-180, 0], [15, 0]); // Subtle 3D tilt
  const [isDismissing, setIsDismissing] = React.useState(false);

  const cfg = variantConfigs[variant] || variantConfigs.default;

  const handleDismiss = React.useCallback(() => {
    if (isDismissing) return;
    setIsDismissing(true);
    // Haptic feedback if supported on device for satisfying tactile feel
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([15]);
      }
    } catch {
      // Ignore vibration errors
    }

    // Launch upward animation by setting y with a strong velocity/motion
    animateMotion(y, -260, {
      type: 'spring',
      stiffness: 400,
      damping: 26,
      mass: 0.75,
    });

    // Dismiss from Sonner after the upward flight is complete
    setTimeout(() => {
      try {
        toast.dismiss(id);
      } catch {
        // Fallback
      }
    }, 300);
  }, [id, isDismissing, y]);

  // Touch start tracker with velocity tracking for ultra-fluid natural mobile flick
  const touchStartY = React.useRef<number | null>(null);
  const touchCurrentDiff = React.useRef<number>(0);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentDiff.current = 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || isDismissing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    touchCurrentDiff.current = diff;

    // Follow the finger upward with 1:1 direct tracking
    if (diff < 0) {
      y.set(diff);
      // As soon as the user gestures upward by even a small bit (-8px), engage dismiss!
      if (diff < -8) {
        touchStartY.current = null;
        handleDismiss();
      }
    }
  };

  const onTouchEnd = () => {
    if (touchStartY.current === null || isDismissing) return;
    const diff = touchCurrentDiff.current;
    touchStartY.current = null;

    // If there was ANY upward intent (diff < -2px), slide up and dismiss immediately
    if (diff < -2) {
      handleDismiss();
    } else {
      // Only spring back if there was no upward movement at all
      animateMotion(y, 0, {
        type: 'spring',
        stiffness: 450,
        damping: 30,
      });
    }
  };

  return (
    <motion.div
      style={{ y, opacity, scale, rotateX, transformPerspective: 1000 }}
      drag={isDismissing ? false : "y"}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.9, bottom: 0.05 }}
      onDragEnd={(_, info) => {
        if (isDismissing) return;
        // Any upward motion whatsoever dismisses up immediately
        if (info.offset.y < -3 || info.velocity.y < -10) {
          handleDismiss();
        } else {
          animateMotion(y, 0, {
            type: 'spring',
            stiffness: 450,
            damping: 30,
          });
        }
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      initial={{ opacity: 0, y: -60, scale: 0.92, filter: 'blur(6px)' }}
      animate={
        isDismissing
          ? {
              y: -220,
              opacity: [1, 0.9, 0],
              scale: 0.88,
              transition: {
                y: { type: 'spring', stiffness: 360, damping: 28 },
                opacity: { duration: 0.3, ease: 'easeIn' },
                scale: { duration: 0.3 },
              }
            }
          : {
              opacity: 1,
              scale: 1,
              filter: 'blur(0px)',
              transition: { type: 'spring', damping: 26, stiffness: 420 }
            }
      }
      className="group relative w-full max-w-[94vw] sm:max-w-md mx-auto select-none cursor-grab active:cursor-grabbing pointer-events-auto will-change-transform"
    >
      {/* Outer 24K Gold Radiant Chassis with Ambient Shimmer */}
      <div className={`relative rounded-[24px] p-[1.8px] bg-gradient-to-b from-amber-300 via-amber-500/60 to-amber-900/60 shadow-[0_18px_50px_-10px_rgba(245,158,11,0.32),0_0_28px_rgba(251,191,36,0.18)] hover:shadow-[0_20px_55px_-8px_rgba(245,158,11,0.45),0_0_35px_rgba(251,191,36,0.28)] transition-all duration-300 overflow-hidden ${cfg.ambientGlow}`}>
        
        {/* Dynamic Traveling Gold Shimmer Beam */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
          <div className="w-[120%] h-full bg-gradient-to-r from-transparent via-amber-200/35 to-transparent animate-gold-shimmer pointer-events-none" />
        </div>

        {/* Main Obsidian Glass Body */}
        <div className="relative rounded-[22px] bg-gradient-to-b from-[#141624]/98 via-[#0c0e16]/98 to-[#06070a]/98 backdrop-blur-3xl p-3.5 sm:p-4 text-white overflow-hidden ring-1 ring-inset ring-amber-400/20">
          
          {/* Top Specular Gold Horizon Beam */}
          <div className={`absolute top-0 inset-x-6 h-[1.5px] bg-gradient-to-r ${cfg.topGleam} opacity-95 shadow-[0_0_10px_rgba(251,191,36,0.8)]`} />

          {/* Luxury Ambient Radial Glow inside */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-52 h-24 bg-amber-500/12 rounded-full blur-2xl pointer-events-none" />

          {/* Header Row: Jewel-Cut Icon + Content + Close Action */}
          <div className="flex items-start gap-3.5 pt-0.5">
            {/* Jewel-Cut Icon Frame */}
            <div className={`relative p-2.5 rounded-2xl shrink-0 ${cfg.iconBg} ${cfg.iconRing} ${cfg.iconGlow} flex items-center justify-center shadow-lg shadow-black/40`}>
              {icon || cfg.iconNode}
              {/* Corner Specular Diamond Sparkle */}
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-gradient-to-br from-amber-100 to-amber-300 shadow-[0_0_8px_#fde047] ring-1 ring-white/60" />
            </div>

            {/* Content & Micro Badges */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border ${cfg.badgeBg} ${cfg.badgeText} shadow-sm`}>
                  {badge || cfg.badgeLabel}
                </span>
              </div>

              <div className="text-sm font-bold text-white tracking-tight leading-snug drop-shadow-sm">
                {title}
              </div>

              {description && (
                <div className="mt-1 text-xs text-zinc-300/90 leading-relaxed font-normal">
                  {description}
                </div>
              )}

              {action && (
                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      action.onClick();
                      handleDismiss();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500/25 via-amber-400/35 to-amber-500/25 hover:from-amber-400/40 hover:to-amber-300/50 border border-amber-300/60 text-amber-100 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer relative z-20"
                  >
                    {action.label}
                  </button>
                </div>
              )}
            </div>

            {/* Direct Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDismiss();
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              className="shrink-0 p-2 -mr-1 -mt-1 text-zinc-400 hover:text-amber-200 rounded-xl hover:bg-amber-400/15 border border-transparent hover:border-amber-400/30 transition-all cursor-pointer relative z-30 touch-manipulation"
              title="Close notification"
              aria-label="Close notification"
            >
              <X size={16} />
            </button>
          </div>

          {/* Ergonomic Luxury Bottom Pull-Tab with Animated Upward Arrow */}
          <div 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDismiss();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            className="mt-3 pt-1.5 border-t border-amber-400/15 flex items-center justify-between cursor-pointer group/handle select-none relative z-20 touch-manipulation hover:bg-white/[0.03] rounded-b-xl px-1 transition-colors"
            title="SWIPE UP - TAP TO DISMISS"
          >
            <div className="flex items-center gap-2">
              {/* Glowing Upward Arrow Capsule */}
              <div className="flex items-center justify-center w-6 h-5 rounded-lg bg-gradient-to-t from-amber-500/25 to-amber-300/30 border border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.35)] group-hover/handle:bg-amber-400/40 group-hover/handle:border-amber-300 transition-all">
                <ChevronUp size={14} className="text-amber-200 animate-float-up stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-black text-amber-300/90 group-hover/handle:text-amber-200 transition-colors tracking-wider uppercase flex items-center gap-1.5">
                SWIPE UP <span className="text-amber-400/60 text-[9px] font-extrabold">• TAP TO DISMISS</span>
              </span>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
};

