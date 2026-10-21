import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Bell, X, Trophy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'achievement' | 'loading' | 'default';

export interface ModernTopToastProps {
  id: string | number;
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  variant?: ToastVariant;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface VariantConfig {
  iconBg: string;
  iconBorder: string;
  iconNode: React.ReactNode;
  glowShadow: string;
  borderColor: string;
  accentBar: string;
}

const variantConfigs: Record<ToastVariant, VariantConfig> = {
  success: {
    iconBg: 'bg-emerald-500/15',
    iconBorder: 'border-emerald-500/30',
    iconNode: <CheckCircle2 size={15} className="text-emerald-400" />,
    glowShadow: 'shadow-[0_12px_28px_-8px_rgba(16,185,129,0.22),0_4px_16px_rgba(0,0,0,0.5)]',
    borderColor: 'border-emerald-500/30',
    accentBar: 'from-emerald-400/80 via-teal-400/40 to-transparent',
  },
  error: {
    iconBg: 'bg-rose-500/15',
    iconBorder: 'border-rose-500/30',
    iconNode: <AlertCircle size={15} className="text-rose-400" />,
    glowShadow: 'shadow-[0_12px_28px_-8px_rgba(244,63,94,0.22),0_4px_16px_rgba(0,0,0,0.5)]',
    borderColor: 'border-rose-500/30',
    accentBar: 'from-rose-500/80 via-red-400/40 to-transparent',
  },
  warning: {
    iconBg: 'bg-amber-500/15',
    iconBorder: 'border-amber-400/40',
    iconNode: <AlertTriangle size={15} className="text-amber-300" />,
    glowShadow: 'shadow-[0_12px_28px_-8px_rgba(245,158,11,0.22),0_4px_16px_rgba(0,0,0,0.5)]',
    borderColor: 'border-amber-400/40',
    accentBar: 'from-amber-400/80 via-yellow-400/40 to-transparent',
  },
  info: {
    iconBg: 'bg-sky-500/15',
    iconBorder: 'border-sky-500/30',
    iconNode: <Info size={15} className="text-sky-400" />,
    glowShadow: 'shadow-[0_12px_28px_-8px_rgba(56,189,248,0.2),0_4px_16px_rgba(0,0,0,0.5)]',
    borderColor: 'border-sky-500/30',
    accentBar: 'from-sky-400/80 via-blue-400/40 to-transparent',
  },
  achievement: {
    iconBg: 'bg-amber-400/15',
    iconBorder: 'border-amber-400/40',
    iconNode: <Trophy size={15} className="text-amber-300" />,
    glowShadow: 'shadow-[0_12px_28px_-8px_rgba(251,191,36,0.25),0_4px_16px_rgba(0,0,0,0.5)]',
    borderColor: 'border-amber-400/40',
    accentBar: 'from-amber-400/80 via-yellow-400/40 to-transparent',
  },
  loading: {
    iconBg: 'bg-white/10',
    iconBorder: 'border-white/15',
    iconNode: <Loader2 size={15} className="text-amber-400 animate-spin" />,
    glowShadow: 'shadow-[0_10px_25px_-8px_rgba(0,0,0,0.6)]',
    borderColor: 'border-white/15',
    accentBar: 'from-amber-400/60 via-white/15 to-transparent',
  },
  default: {
    iconBg: 'bg-white/10',
    iconBorder: 'border-white/15',
    iconNode: <Bell size={15} className="text-zinc-300" />,
    glowShadow: 'shadow-[0_10px_25px_-8px_rgba(0,0,0,0.6)]',
    borderColor: 'border-white/15',
    accentBar: 'from-white/30 via-white/10 to-transparent',
  }
};

export const ModernTopToast: React.FC<ModernTopToastProps> = ({
  id,
  title,
  description,
  variant = 'default',
  icon,
  action,
}) => {
  const cfg = variantConfigs[variant] || variantConfigs.default;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-[90vw] sm:max-w-[350px] mx-auto select-none pointer-events-auto"
    >
      {/* Sleek, Compact Luxury Glass Capsule with Unified Balanced Sizing */}
      <div 
        style={{ boxSizing: 'border-box' }}
        className={`relative rounded-2xl bg-[#0c0d14]/95 backdrop-blur-2xl border ${cfg.borderColor} ${cfg.glowShadow} transition-all duration-200 overflow-hidden`}
      >
        {/* Compact, clean horizontal layout */}
        <div className="flex items-center gap-3 px-3.5 py-3 text-white">
          {/* Refined Icon Frame */}
          <div className={`relative w-7 h-7 rounded-xl shrink-0 ${cfg.iconBg} border ${cfg.iconBorder} flex items-center justify-center shadow-sm shadow-black/40`}>
            {icon || cfg.iconNode}
          </div>

          {/* Typography Content */}
          <div className="flex-1 min-w-0 pr-1 text-left">
            <div className="text-[13px] font-semibold text-zinc-100 tracking-[-0.01em] leading-snug break-words line-clamp-2">
              {title}
            </div>
            {description && (
              <div className="mt-0.5 text-[11.5px] text-zinc-400 font-normal leading-normal break-words line-clamp-2">
                {description}
              </div>
            )}
            {action && (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    action.onClick();
                    toast.dismiss(id);
                  }}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-white font-medium text-[10.5px] tracking-wide rounded-lg transition-all cursor-pointer"
                >
                  {action.label}
                </button>
              </div>
            )}
          </div>

          {/* Minimalist Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toast.dismiss(id);
            }}
            className="shrink-0 w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white rounded-full hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
            title="Dismiss notice"
            aria-label="Dismiss notice"
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        </div>

        {/* Micro accent highlight line at bottom */}
        <div className={`absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r ${cfg.accentBar}`} />
      </div>
    </motion.div>
  );
};
