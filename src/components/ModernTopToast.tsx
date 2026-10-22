import React, { useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Bell, X, Trophy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'achievement' | 'loading' | 'default';

export interface ModernTopToastProps {
  id: string | number;
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  variant?: ToastVariant;
  category?: string;
  badge?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

interface VariantConfig {
  icon: React.ReactNode;
  iconColor: string;
  badgeColor: string;
}

const variantConfigs: Record<ToastVariant, VariantConfig> = {
  success: {
    icon: <CheckCircle2 size={16} strokeWidth={2.2} className="text-emerald-400" />,
    iconColor: 'text-emerald-400',
    badgeColor: 'text-emerald-400',
  },
  error: {
    icon: <AlertCircle size={16} strokeWidth={2.2} className="text-rose-400" />,
    iconColor: 'text-rose-400',
    badgeColor: 'text-rose-400',
  },
  warning: {
    icon: <AlertTriangle size={16} strokeWidth={2.2} className="text-amber-400" />,
    iconColor: 'text-amber-400',
    badgeColor: 'text-amber-400',
  },
  info: {
    icon: <Info size={16} strokeWidth={2.2} className="text-sky-400" />,
    iconColor: 'text-sky-400',
    badgeColor: 'text-sky-400',
  },
  achievement: {
    icon: <Trophy size={16} strokeWidth={2.2} className="text-amber-300" />,
    iconColor: 'text-amber-300',
    badgeColor: 'text-amber-300',
  },
  loading: {
    icon: <Loader2 size={16} strokeWidth={2.2} className="text-amber-400 animate-spin" />,
    iconColor: 'text-amber-400',
    badgeColor: 'text-amber-400',
  },
  default: {
    icon: <Bell size={16} strokeWidth={2.2} className="text-zinc-300" />,
    iconColor: 'text-zinc-300',
    badgeColor: 'text-zinc-400',
  },
};

export const ModernTopToast: React.FC<ModernTopToastProps> = ({
  id,
  title,
  description,
  variant = 'default',
  category,
  badge,
  icon,
  action,
  onClose,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const cfg = variantConfigs[variant] || variantConfigs.default;

  const handleDismiss = useCallback(
    (e?: React.SyntheticEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if ('nativeEvent' in e && (e.nativeEvent as any)?.stopImmediatePropagation) {
          (e.nativeEvent as any).stopImmediatePropagation();
        }
      }
      setIsExiting(true);
      if (onClose) onClose();
      setTimeout(() => {
        toast.dismiss(id);
      }, 100);
    },
    [id, onClose]
  );

  const kickerText = badge || category;

  // Render icon node properly whether string emoji or React element
  const renderedIcon = React.isValidElement(icon) ? (
    icon
  ) : typeof icon === 'string' ? (
    <span className="text-base leading-none select-none">{icon}</span>
  ) : (
    cfg.icon
  );

  return (
    <div
      className={`group relative w-full max-w-[92vw] sm:max-w-[380px] mx-auto pointer-events-auto transition-all duration-150 ease-out ${
        isExiting ? 'opacity-0 -translate-y-2 scale-98 pointer-events-none' : 'animate-notice-in'
      }`}
      style={{ touchAction: 'manipulation' }}
    >
      {/* 
        Zero-Nesting Single Surface:
        One seamless, elegant card container with subtle hairline border,
        airy padding, and soft shadow without any inner nested boxes or double borders.
      */}
      <div className="relative flex items-start gap-3.5 px-4 py-3.5 rounded-2xl bg-[#0f111a]/95 backdrop-blur-xl border border-white/[0.08] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.65),0_2px_8px_rgba(0,0,0,0.4)] text-white">
        {/* Subtle, unboxed semantic icon */}
        <div className="shrink-0 mt-0.5 flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.04] text-zinc-300">
          {renderedIcon}
        </div>

        {/* Content Flow */}
        <div className="flex-1 min-w-0 pr-1 text-left">
          {/* Integrated quiet kicker (badge/category) */}
          {kickerText && (
            <div className="text-[11px] font-medium tracking-wide mb-0.5">
              <span className={cfg.badgeColor}>{kickerText}</span>
            </div>
          )}

          {/* Title */}
          <div className="text-[13.5px] font-semibold text-zinc-100 tracking-[-0.01em] leading-snug break-words">
            {title}
          </div>

          {/* Description */}
          {description && (
            <div className="mt-1 text-[12px] text-zinc-400 font-normal leading-relaxed break-words">
              {description}
            </div>
          )}

          {/* Action button */}
          {action && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  action.onClick();
                  handleDismiss(e);
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 bg-white/[0.07] hover:bg-white/[0.12] active:scale-95 border border-white/[0.08] transition-all cursor-pointer touch-manipulation"
              >
                {action.label}
              </button>
            </div>
          )}
        </div>

        {/* 
          Ergonomic Close Button:
          Large 36x36px comfortable touch zone, stops event propagation to prevent
          swiping/drag gestures from intercepting tap, with smooth micro-interaction.
        */}
        <button
          type="button"
          onClick={handleDismiss}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="shrink-0 -mr-1.5 -mt-1 w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] active:bg-white/[0.14] active:scale-90 transition-all cursor-pointer touch-manipulation relative z-20 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
          title="Fechar aviso"
          aria-label="Fechar aviso"
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
};
