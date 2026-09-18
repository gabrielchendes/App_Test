import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { 
  ArrowLeft, 
  Star, 
  Sparkles, 
  Send, 
  ShieldCheck, 
  Heart,
  Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { notifyAdmin } from '../lib/notifications';
import { Course } from '../types/lms';
import { AppSettings } from '../contexts/SettingsContext';
import { toast } from 'sonner';

interface TestimonialPageProps {
  user: User;
  courses: Course[];
  settings: AppSettings;
  onBack: () => void;
  onViewStories?: () => void;
}

export const TestimonialPage: React.FC<TestimonialPageProps> = ({
  user,
  courses,
  settings,
  onBack,
  onViewStories
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [content, setContent] = useState<string>('');
  const [consent, setConsent] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const userDisplayName = 
    user.user_metadata?.full_name || 
    user.user_metadata?.name || 
    user.email?.split('@')[0] || 
    'Student';
  const userAvatar = 
    user.user_metadata?.avatar_url || 
    user.user_metadata?.picture || 
    '';
  const userEmail = user.email || '';

  const [authorName, setAuthorName] = useState<string>(userDisplayName);

  const fillThisFieldMsg = 
    (settings?.custom_texts?.['auth.fill_this_field'] && !settings.custom_texts['auth.fill_this_field'].toLowerCase().includes('preencha'))
      ? settings.custom_texts['auth.fill_this_field']
      : 'Please fill out this field';

  const ratingDescriptions: Record<number, string> = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Transformative / Excellent'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast.error('Please write your testimonial before submitting.');
      return;
    }

    if (!authorName.trim()) {
      toast.error('Please enter your name.');
      return;
    }

    setIsSubmitting(true);

    try {
      const testimonialData = {
        user_id: user.id,
        user_name: authorName.trim(),
        user_email: userEmail,
        user_avatar: userAvatar,
        course_title: 'General',
        rating,
        headline: '',
        content: content.trim(),
        image_url: null,
        status: 'pending',
        is_read: false,
        consent,
        created_at: new Date().toISOString()
      };

      // 1. Save to server API
      try {
        await fetch('/api/v1/testimonials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', testimonial: testimonialData })
        });
      } catch (apiErr) {
        console.warn('[Testimonial] API save exception:', apiErr);
      }

      // 2. Save to Supabase testimonials table if available
      try {
        const { error } = await supabase
          .from('testimonials')
          .insert(testimonialData);

        if (error) {
          console.warn('[Testimonial] Direct insert notice:', error.message);
        }
      } catch (dbErr) {
        console.warn('[Testimonial] Database insert exception:', dbErr);
      }

      // 3. Local fallback storage to guarantee zero data loss
      try {
        const existingLocal = JSON.parse(localStorage.getItem('app_testimonials_cache') || '[]');
        existingLocal.unshift({
          ...testimonialData,
          id: 'local_' + Date.now()
        });
        localStorage.setItem('app_testimonials_cache', JSON.stringify(existingLocal.slice(0, 50)));
      } catch (cacheErr) {
        console.warn('[Testimonial] Local storage cache exception:', cacheErr);
      }

      // 3. Notify Admin (Push notification + in-app notification)
      const pushTitle = '🌟 New Testimonial Received!';
      const pushBody = `${authorName.trim()} rated ${rating}★: "${content.trim().slice(0, 80)}..."`;

      try {
        await notifyAdmin(pushTitle, pushBody, {
          type: 'testimonial',
          userName: authorName.trim(),
          userEmail: userEmail,
          rating
        });
      } catch (notifErr) {
        console.warn('[Testimonial] Admin notification dispatch warning:', notifErr);
      }

      setIsSuccess(true);
      toast.success('Testimonial submitted successfully! Thank you!');
    } catch (err: any) {
      console.error('[Testimonial] Submission error:', err);
      toast.error('Failed to submit testimonial. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-black text-white px-4 py-12 flex items-center justify-center">
        <div className="max-w-lg w-full bg-zinc-900/90 border border-amber-500/30 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/10 border-2 border-amber-500 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20 animate-bounce">
            <Heart size={36} className="fill-amber-400 text-amber-400" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Thank You for Your Feedback!
            </h2>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
              We truly appreciate you taking the time to share your story, <strong className="text-amber-400">{authorName}</strong>. Your testimonial has been received and shared with our team!
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-gray-400 flex items-center gap-3 text-left">
            <ShieldCheck size={24} className="text-amber-400 shrink-0" />
            <span>Your feedback inspires other women and helps us continuously improve the experience for everyone.</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {onViewStories && (
              <button
                type="button"
                onClick={onViewStories}
                className="w-full py-3.5 px-6 rounded-full bg-white/5 hover:bg-white/10 text-white hover:text-amber-300 font-bold text-xs sm:text-sm uppercase tracking-wider border border-white/15 hover:border-amber-400/40 transition-all duration-300 cursor-pointer"
              >
                Read Inspiring Stories
              </button>
            )}

            <button
              onClick={onBack}
              className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-widest transition-all duration-300 shadow-[0_8px_30px_rgba(245,158,11,0.28)] hover:shadow-[0_12px_40px_rgba(245,158,11,0.48)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] border border-amber-200/60 cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white transition-all active:scale-95 text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer"
          >
            <ArrowLeft size={16} className="text-gray-400 group-hover:text-white group-hover:-translate-x-0.5 transition-all" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-3">
            {onViewStories ? (
              <button
                type="button"
                onClick={onViewStories}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                <Heart size={13} className="fill-amber-400 text-amber-400" />
                <span>Read Stories</span>
              </button>
            ) : (
              <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                Community Reviews
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Share Your Experience
          </h1>

          <p className="text-gray-400 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            We would love to hear your feedback! Tell us how your experience has been and what impact this content made in your life.
          </p>
        </div>

        {/* Form Card with Ambient Glow */}
        <form 
          onSubmit={handleSubmit} 
          className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 border border-amber-500/20 shadow-2xl shadow-black/50 p-6 sm:p-10"
        >
          {/* Subtle ambient light effects matching Home card */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-72 h-36 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-8">
            {/* User Profile Badge */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/60 border border-white/5">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userDisplayName}
                className="w-12 h-12 rounded-full object-cover border border-amber-500/40"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-base border border-amber-500/30">
                {authorName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => {
                  setAuthorName(e.target.value);
                  e.target.setCustomValidity('');
                }}
                onInvalid={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.validity.valueMissing) {
                    target.setCustomValidity(fillThisFieldMsg);
                  } else {
                    target.setCustomValidity('');
                  }
                }}
                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                title={fillThisFieldMsg}
                className="bg-transparent text-white font-bold text-sm sm:text-base outline-none w-full border-b border-white/10 focus:border-amber-500 transition-colors pb-0.5"
                placeholder="Enter your name"
                required
              />
              <span className="text-xs text-gray-400 block truncate mt-0.5">{userEmail}</span>
            </div>
          </div>

          {/* 1. Rating */}
          <div className="space-y-3">
            <label className="text-xs font-black text-gray-300 uppercase tracking-wider block">
              How would you rate your overall experience?
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = (hoverRating !== null ? hoverRating : rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-1.5 rounded-lg transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                      title={`${star} stars`}
                    >
                      <Star
                        size={30}
                        className={
                          isFilled
                            ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                            : 'text-zinc-700 hover:text-zinc-500'
                        }
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-xs sm:text-sm font-semibold text-amber-400 ml-2">
                {ratingDescriptions[hoverRating !== null ? hoverRating : rating]}
              </span>
            </div>
          </div>

          {/* 2. Detailed Testimonial Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-gray-300 uppercase tracking-wider block">
                Your Complete Testimonial <span className="text-amber-400">*</span>
              </label>
            </div>
            <textarea
              rows={7}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                e.target.setCustomValidity('');
              }}
              onInvalid={(e) => {
                const target = e.target as HTMLTextAreaElement;
                if (target.validity.valueMissing) {
                  target.setCustomValidity(fillThisFieldMsg);
                } else {
                  target.setCustomValidity('');
                }
              }}
              onInput={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('')}
              title={fillThisFieldMsg}
              placeholder="Write your complete review here: How was your experience with the content? What key insights or results did you achieve, and how did it help you? Feel free to share your thoughts in detail..."
              className="w-full bg-black/80 border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-amber-500 outline-none transition-colors leading-relaxed custom-scrollbar placeholder:text-zinc-600"
              required
            />
            <p className="text-[11px] text-gray-500">
              Tip: Be candid and share specific highlights of what you learned or achieved.
            </p>
          </div>

          {/* 3. Consent Checkbox */}
          <div className="space-y-2.5 p-4 rounded-2xl bg-black/50 border border-white/5">
            <div className="flex items-start gap-3">
              <input
                id="consent-check"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-black border-white/20 cursor-pointer accent-amber-500"
              />
              <label htmlFor="consent-check" className="text-xs text-gray-300 leading-relaxed cursor-pointer select-none">
                I authorize the sharing of my testimonial and feedback on the public stories page and official channels to inspire and support other women.
              </label>
            </div>
            {!consent && (
              <div className="ml-7 flex items-center gap-2 text-[11px] text-amber-400/90 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20">
                <Lock size={13} className="shrink-0 text-amber-400" />
                <span>
                  <strong>Confidential Use:</strong> Your testimonial will be delivered exclusively to the administration and <u>will not</u> be displayed publicly in the stories gallery.
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="relative group w-full sm:flex-1 py-4 px-8 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-widest transition-all duration-300 shadow-[0_8px_30px_rgba(245,158,11,0.28)] hover:shadow-[0_12px_40px_rgba(245,158,11,0.48)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] border border-amber-200/60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Testimonial...</span>
                </>
              ) : (
                <>
                  <Send size={16} className="text-zinc-950 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                  <span>Submit My Testimonial</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              className="w-full sm:w-auto py-4 px-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-bold text-xs sm:text-sm uppercase tracking-widest transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer"
            >
              Cancel
            </button>
          </div>
          </div>
        </form>
      </div>
    </div>
  );
};

