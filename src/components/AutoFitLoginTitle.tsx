import React from 'react';

interface AutoFitLoginTitleProps {
  title: string;
  font?: string;
  titleColor?: string;
  primaryColor?: string;
  sizeVariant?: 'full' | 'preview';
  showHalo?: boolean;
  fontSize?: number | string;
}

export default function AutoFitLoginTitle({
  title,
  font = 'inter',
  titleColor,
  primaryColor,
  sizeVariant = 'full',
  showHalo = false,
  fontSize,
}: AutoFitLoginTitleProps) {
  const isPreview = sizeVariant === 'preview';

  // Base configurations for typography presets
  const getFontDetails = (f?: string) => {
    switch (f) {
      case 'inter':
      case 'default':
      case 'original':
        return {
          fontFamily: "'Inter', sans-serif",
          fontWeight: '800',
          fontClass: 'font-sans font-extrabold tracking-tight',
          defaultSize: 28,
          letterSpacing: '-0.02em',
          isUpper: false,
        };
      case 'cinzel':
        return {
          fontFamily: "'Cinzel', serif",
          fontWeight: '700',
          fontClass: 'font-cinzel uppercase font-bold sm:font-extrabold',
          defaultSize: 26,
          letterSpacing: '0.08em',
          isUpper: true,
        };
      case 'jakarta':
        return {
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: '800',
          fontClass: 'font-jakarta font-extrabold tracking-tight',
          defaultSize: 26,
          letterSpacing: '-0.01em',
          isUpper: false,
        };
      case 'outfit':
        return {
          fontFamily: "'Outfit', sans-serif",
          fontWeight: '700',
          fontClass: 'font-outfit font-bold uppercase',
          defaultSize: 26,
          letterSpacing: '0.04em',
          isUpper: true,
        };
      case 'playfair':
        return {
          fontFamily: "'Playfair Display', serif",
          fontWeight: '700',
          fontClass: 'font-serif font-bold',
          defaultSize: 28,
          letterSpacing: '0.01em',
          isUpper: false,
        };
      case 'cormorant':
        return {
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: '600',
          fontClass: 'font-cormorant font-semibold italic',
          defaultSize: 30,
          letterSpacing: '0.03em',
          isUpper: false,
        };
      default:
        // Default is the original font (Inter / Clean Sans)
        return {
          fontFamily: "'Inter', sans-serif",
          fontWeight: '800',
          fontClass: 'font-sans font-extrabold tracking-tight',
          defaultSize: 28,
          letterSpacing: '-0.02em',
          isUpper: false,
        };
    }
  };

  const fontConfig = getFontDetails(font || 'inter');

  // Controlled font size configured via AdminPanel
  const parsedFontSize = fontSize ? parseInt(String(fontSize), 10) : null;
  const configuredSize = parsedFontSize && !isNaN(parsedFontSize) && parsedFontSize > 0 
    ? parsedFontSize 
    : fontConfig.defaultSize;

  // In preview mode (compact mobile mockup in admin panel), scale proportionately
  const activeFontSize = isPreview 
    ? Math.max(11, Math.round(configuredSize * 0.54))
    : configuredSize;

  if (isPreview) {
    return (
      <div className="mb-1 flex flex-col items-center justify-center w-full max-w-full">
        {/* Clean Title without moldura / frame */}
        <h2 
          className={`${fontConfig.fontClass} leading-tight whitespace-nowrap text-center overflow-hidden text-ellipsis max-w-full`} 
          style={{ 
            fontSize: `${activeFontSize}px`,
            letterSpacing: fontConfig.letterSpacing,
            color: titleColor || '#ffffff',
          }}
        >
          <span className="inline-block whitespace-nowrap drop-shadow-sm">
            {title}
          </span>
        </h2>
      </div>
    );
  }

  return (
    <div className="relative mb-2 group/title flex flex-col items-center justify-center w-full max-w-full">
      {/* Subtle Ethereal Ambient Halo behind title (clean, no yellow) */}
      {showHalo && (
        <div 
          className="absolute -inset-x-6 -top-3 -bottom-3 rounded-full blur-2xl opacity-25 pointer-events-none transition-opacity duration-500"
          style={{
            background: primaryColor 
              ? `radial-gradient(ellipse at center, ${primaryColor}30 0%, transparent 70%)`
              : 'radial-gradient(ellipse at center, rgba(244, 63, 94, 0.20) 0%, transparent 70%)'
          }}
        />
      )}

      {/* Title in single line, completely without moldura / enclosing box */}
      <h1 
        className={`relative ${fontConfig.fontClass} leading-tight select-none whitespace-nowrap text-center max-w-full overflow-hidden text-ellipsis`}
        style={{
          fontSize: `${activeFontSize}px`,
          letterSpacing: fontConfig.letterSpacing,
          color: titleColor || '#ffffff',
        }}
      >
        <span 
          className="inline-block whitespace-nowrap drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]"
          style={{
            color: titleColor || '#ffffff',
          }}
        >
          {title}
        </span>
      </h1>
    </div>
  );
}
