import React from 'react';
import { Smartphone, Download, ArrowDown } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface PWAInstallBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  className?: string;
  onClick?: () => void;
  animateArrow?: boolean;
}

export const PWAInstallBadge = ({
  size = 'md',
  showLabel = false,
  label,
  className,
  onClick,
  animateArrow = false
}: PWAInstallBadgeProps) => {
  // Dimension configurations
  const dimensions = {
    sm: {
      container: 'w-7 h-7 rounded-lg p-[1px]',
      inner: 'rounded-[7px]',
      phoneSize: 13,
      arrowSize: 6,
      badge: 'w-3 h-3 -bottom-1 -right-1',
      downloadIconSize: 6,
      downloadStroke: 3.5,
      halo: 'blur-[3px]'
    },
    md: {
      container: 'w-9 h-9 rounded-xl p-[1.5px]',
      inner: 'rounded-[10px]',
      phoneSize: 16,
      arrowSize: 8,
      badge: 'w-4 h-4 -bottom-1 -right-1',
      downloadIconSize: 8,
      downloadStroke: 3.5,
      halo: 'blur-md'
    },
    lg: {
      container: 'w-11 h-11 rounded-2xl p-[2px]',
      inner: 'rounded-[14px]',
      phoneSize: 20,
      arrowSize: 10,
      badge: 'w-5 h-5 -bottom-1.5 -right-1.5',
      downloadIconSize: 10,
      downloadStroke: 3.5,
      halo: 'blur-lg'
    }
  }[size];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 transition-all duration-300 active:scale-95 cursor-pointer select-none",
        className
      )}
      title={label || "Install App"}
    >
      {/* Icon Wrapper */}
      <div className="relative shrink-0 flex items-center justify-center">
        {/* Luminous Ambient Halo Glow */}
        <div 
          className={cn(
            "absolute -inset-1 rounded-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
            animateArrow && "animate-pulse",
            dimensions.halo
          )}
          style={{
            background: 'radial-gradient(circle, #fbbf24 0%, #f59e0b 60%, transparent 80%)'
          }}
        />

        {/* Metallic Radiant Golden Frame */}
        <div 
          className={cn(
            "relative shadow-[0_4px_16px_rgba(251,191,36,0.4)] transition-transform duration-300 group-hover:scale-105",
            dimensions.container
          )}
          style={{
            background: 'linear-gradient(135deg, #fef08a 0%, #fbbf24 35%, #ffffff 65%, #f59e0b 100%)'
          }}
        >
          {/* Glossy Jewel Core */}
          <div 
            className={cn(
              "w-full h-full flex items-center justify-center relative overflow-hidden",
              dimensions.inner
            )}
            style={{
              background: 'radial-gradient(circle at 45% 25%, rgba(251, 191, 36, 0.4) 0%, rgba(24, 21, 36, 0.98) 60%, rgba(12, 14, 24, 1) 100%)'
            }}
          >
            {/* Top Specular Arc Reflex */}
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-b from-white/40 via-white/10 to-transparent pointer-events-none" />
            
            {/* Smartphone Device Symbol */}
            <Smartphone 
              size={dimensions.phoneSize} 
              className="relative z-10 text-white stroke-[2.3] drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] group-hover:scale-105 transition-transform" 
            />
            
            {/* Micro-arrow: stationary by default, animated only when explicitly requested */}
            {animateArrow ? (
              <motion.div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                animate={{ y: [-1.5, 1, -1.5], opacity: [0.75, 1, 0.75] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              >
                <ArrowDown 
                  size={dimensions.arrowSize} 
                  className="text-yellow-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] stroke-[3]" 
                />
              </motion.div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <ArrowDown 
                  size={dimensions.arrowSize} 
                  className="text-yellow-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] stroke-[3]" 
                />
              </div>
            )}
          </div>

          {/* High-Visibility Download Corner Badge */}
          <div 
            className={cn(
              "absolute rounded-full flex items-center justify-center text-black font-black shadow-md border border-[#0f111c] z-30 transition-transform duration-300 group-hover:scale-110",
              dimensions.badge
            )}
            style={{
              background: 'linear-gradient(135deg, #fef08a 0%, #fbbf24 100%)'
            }}
          >
            <Download 
              size={dimensions.downloadIconSize} 
              strokeWidth={dimensions.downloadStroke} 
              className="text-black" 
            />
          </div>
        </div>
      </div>

      {/* Optional Label (Desktop / Expanded) */}
      {showLabel && (
        <span className="text-xs font-black uppercase tracking-wider text-amber-200 group-hover:text-amber-100 transition-colors drop-shadow-sm truncate">
          {label || "Install App"}
        </span>
      )}
    </button>
  );
};

export default PWAInstallBadge;
