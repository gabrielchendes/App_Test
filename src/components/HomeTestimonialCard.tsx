import React from 'react';
import { ArrowRight, Heart, Sparkles } from 'lucide-react';
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

  const title = settings.custom_texts?.['home.testimonial_title'] || 'Share Your Results';
  const subtitle = settings.custom_texts?.['home.testimonial_subtitle'] || 'Share your story and how this course helped you write a new chapter. Your story inspires our entire community!';
  const buttonText = settings.custom_texts?.['home.testimonial_button'] || 'Share my Results';
  const readButtonText = settings.custom_texts?.['home.read_testimonials_button'] || 'Read Success Stories From Other Women ';

  return (
    <div className="w-full px-4 sm:px-6 my-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 border border-amber-500/20 shadow-2xl shadow-black/50 p-8 sm:p-12 text-center">
        {/* Subtle ambient light effects */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-72 h-36 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider mx-auto">
              <Heart size={13} className="fill-amber-400 text-amber-400" />
              <span>REAL STORIES</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
              {title}
            </h3>

            <p className="text-sm sm:text-base text-gray-300/90 leading-relaxed max-w-xl mx-auto font-normal">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <button
              onClick={onOpenTestimonial}
              className="relative group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-widest shadow-[0_8px_30px_rgba(245,158,11,0.28)] hover:shadow-[0_12px_40px_rgba(245,158,11,0.48)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 border border-amber-200/60 cursor-pointer"
            >
              <span className="relative z-10">{buttonText}</span>
              <ArrowRight size={16} className="text-zinc-950 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
            </button>

            {onViewTestimonials && (
              <button
                onClick={onViewTestimonials}
                className="relative group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-white/5 hover:bg-white/10 text-white hover:text-amber-300 font-bold text-xs sm:text-sm uppercase tracking-wider border border-white/15 hover:border-amber-400/40 transition-all duration-300 cursor-pointer"
              >
                <Heart size={16} className="text-amber-400 fill-amber-400" />
                <span className="relative z-10">{readButtonText}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


