import React, { useState } from 'react';
import { Smartphone, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../contexts/SettingsContext';
import { getDeviceType } from '../lib/pwa';

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
  onClick
}: PWAInstallBadgeProps) => {
  const { settings } = useSettings();
  const [iconLoadError, setIconLoadError] = useState(false);
  const device = getDeviceType();
  const rawDynamicIcon = device === 'ios'
    ? (settings.ios_icon_url || settings.custom_texts?.['config.ios_icon_url'] || settings.pwa_icon_url || settings.favicon_url)
    : (settings.android_icon_url || settings.custom_texts?.['config.android_icon_url'] || settings.pwa_icon_url || settings.favicon_url || settings.ios_icon_url);
  const dynamicIconUrl = (!iconLoadError && rawDynamicIcon && rawDynamicIcon.trim()) ? rawDynamicIcon.trim() : null;

  // Render expanded pill button (used in desktop Navbar or when showLabel is true)
  if (showLabel) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 backdrop-blur-md text-white transition-all duration-300 active:scale-95 cursor-pointer select-none shadow-sm",
          className
        )}
        title={label || "Install App"}
      >
        <div className="relative w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-zinc-800 border border-white/20 shrink-0">
          {dynamicIconUrl ? (
            <img 
              src={dynamicIconUrl} 
              alt="App" 
              onError={() => setIconLoadError(true)}
              className="w-full h-full object-cover" 
            />
          ) : (
            <Download size={13} className="text-primary" />
          )}
        </div>
        <span className="text-xs font-semibold tracking-wide text-zinc-100 group-hover:text-white transition-colors truncate">
          {label || "Instalar App"}
        </span>
      </button>
    );
  }

  // Render compact circular button (used in mobile Navbar header, harmonizing with the user progress chip and bell)
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-10 h-10'
  }[size];

  const innerAvatarSize = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-8 h-8'
  }[size];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative rounded-full bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all duration-300 active:scale-95 cursor-pointer select-none shadow-sm shrink-0",
        sizeClasses,
        className
      )}
      title={label || "Instalar App"}
      aria-label={label || "Instalar App"}
    >
      <div className={cn("rounded-full overflow-hidden flex items-center justify-center bg-zinc-800 border border-white/20 shrink-0", innerAvatarSize)}>
        {dynamicIconUrl ? (
          <img 
            src={dynamicIconUrl} 
            alt="App Icon" 
            onError={() => setIconLoadError(true)}
            className="w-full h-full object-cover" 
          />
        ) : (
          <Smartphone size={size === 'sm' ? 12 : 14} className="text-primary" />
        )}
      </div>

      {/* Discrete primary badge */}
      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-black flex items-center justify-center shadow-md border border-zinc-900 group-hover:scale-110 transition-transform">
        <Download size={8} strokeWidth={3} />
      </div>
    </button>
  );
};

export default PWAInstallBadge;
