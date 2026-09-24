import React from 'react';
import { ArrowRight, Heart } from 'lucide-react';
import { AppSettings } from '../contexts/SettingsContext';

interface HomeTestimonialCardProps {
  settings: AppSettings;
  t: (key: string) => string;
  onOpenTestimonial: () => void;
  onViewTestimonials?: () => void;
}

export const HomeTestimonialCard: React.FC<HomeTestimonialCardProps> = ({
  settings,
  t,
  onOpenTestimonial,
  onViewTestimonials
}) => {
  // Check if enabled (default is true)
  const isEnabled = 
    settings.enable_testimonials !== false && 
    settings.custom_texts?.['home.enable_testimonials'] !== 'false';

  if (!isEnabled) {
    return null;
  }

  const rawTitle = settings.custom_texts?.['home.testimonial_title'];
  const title = (rawTitle && rawTitle.trim()) || 'Share Your Results';

  const rawSubtitle = settings.custom_texts?.['home.testimonial_subtitle'];
  const subtitle = (rawSubtitle && rawSubtitle.trim()) || 'Share your story and how this course helped you write a new chapter. Your story inspires our entire community!';

  const rawTag = settings.custom_texts?.['home.testimonial_tag'];
  const tagText = (rawTag && rawTag.trim()) || 'REAL STORIES';

  const rawButtonText = settings.custom_texts?.['home.testimonial_button'];
  const buttonText = (rawButtonText && rawButtonText.trim()) || 'Share my Results';

  const rawReadButtonText = settings.custom_texts?.['home.read_testimonials_button'];
  const readButtonText = (rawReadButtonText && rawReadButtonText.trim()) || 'Read Success Stories From Other Women';

  return (
    <div className="w-full px-4 sm:px-6 my-8">
      <div className="relative overflow-hidden rounded-[2.2rem] sm:rounded-[2.6rem] bg-gradient-to-b from-zinc-900/95 via-zinc-900/90 to-zinc-950 border border-amber-500/25 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8),0_0_30px_rgba(245,158,11,0.06)] p-7 sm:p-11 text-center">
        {/* Top subtle specular reflection line */}
        <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent pointer-events-none" />

        {/* Ambient radial glows */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-80 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] sm:text-xs font-black uppercase tracking-widest mx-auto shadow-sm">
              <Heart size={13} className="text-amber-400 fill-amber-400 shrink-0" />
              <span>{tagText}</span>
            </div>

            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
              {title}
            </h3>

            <p className="text-sm sm:text-base text-gray-300/90 leading-relaxed max-w-xl mx-auto font-normal">
              {subtitle}
            </p>
          </div>

          {/* Symmetrical, beautiful CTA Buttons Container */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5 sm:gap-4 pt-2 max-w-xl mx-auto">
            {/* Primary Button: Share results */}
            <button
              type="button"
              onClick={onOpenTestimonial}
              className="relative group flex-1 min-h-[54px] sm:min-h-[58px] inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:via-amber-200 hover:to-amber-400 text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-wider text-center leading-snug shadow-[0_10px_25px_-5px_rgba(245,158,11,0.38)] hover:shadow-[0_14px_35px_-5px_rgba(245,158,11,0.55)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 border border-amber-200/80 cursor-pointer"
            >
              <span className="relative z-10 line-clamp-2">{buttonText}</span>
              <ArrowRight size={17} className="text-zinc-950 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
            </button>

            {/* Secondary Button: Read community stories */}
            {onViewTestimonials && (
              <button
                type="button"
                onClick={onViewTestimonials}
                className="relative group flex-1 min-h-[54px] sm:min-h-[58px] inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 text-white hover:text-amber-300 font-black text-xs sm:text-sm uppercase tracking-wider text-center leading-snug border border-white/15 hover:border-amber-400/50 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6)] hover:shadow-[0_14px_35px_-5px_rgba(245,158,11,0.2)] backdrop-blur-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 cursor-pointer"
              >
                <Heart size={17} className="text-amber-400 fill-amber-400 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                <span className="relative z-10 line-clamp-2">{readButtonText}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
