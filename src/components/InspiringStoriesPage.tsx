import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Star, 
  Heart, 
  Sparkles, 
  ShieldCheck, 
  MessageSquareHeart, 
  Search, 
  Filter, 
  Quote, 
  Share2, 
  CheckCircle2, 
  ChevronRight,
  ExternalLink,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Testimonial } from '../types/lms';
import { AppSettings } from '../contexts/SettingsContext';
import { toast } from 'sonner';

interface InspiringStoriesPageProps {
  onBack: () => void;
  onWriteStory: () => void;
  settings: AppSettings;
}

export const InspiringStoriesPage: React.FC<InspiringStoriesPageProps> = ({
  onBack,
  onWriteStory,
  settings
}) => {
  const [stories, setStories] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<'all' | 5 | 4>('all');
  const [photoModal, setPhotoModal] = useState<{
    url: string;
    userName: string;
    headline?: string;
    type?: 'avatar' | 'attachment';
  } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchApprovedStories();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPhotoModal(null);
      }
    };
    if (photoModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [photoModal]);

  const handleOpenPhoto = (story: Testimonial, type: 'avatar' | 'attachment' = 'avatar') => {
    const targetUrl = type === 'avatar' 
      ? (story.user_avatar || story.image_url) 
      : (story.image_url || story.user_avatar);

    if (targetUrl && targetUrl.trim()) {
      setPhotoModal({
        url: targetUrl.trim(),
        userName: story.user_name || 'Aluna',
        headline: story.headline,
        type
      });
    } else {
      toast.info('This woman did not attach a profile photo to this testimonial.');
    }
  };

  const fetchApprovedStories = async () => {
    setLoading(true);
    try {
      let approvedList: Testimonial[] = [];

      // 1. Fetch approved testimonials from server API
      try {
        const res = await fetch('/api/v1/testimonials?status=approved');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            approvedList = data as Testimonial[];
          }
        }
      } catch (apiErr) {
        console.warn('[InspiringStories] API fetch notice:', apiErr);
      }

      // 2. Fallback to Supabase if API returned empty
      if (approvedList.length === 0) {
        try {
          const { data, error } = await supabase
            .from('testimonials')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

          if (!error && data && data.length > 0) {
            approvedList = data as Testimonial[];
          }
        } catch (e) {
          console.warn('[InspiringStories] Supabase fallback notice:', e);
        }
      }

      // 3. Fallback to local cache if still empty
      if (approvedList.length === 0) {
        try {
          const cached = localStorage.getItem('app_testimonials_cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              approvedList = parsed.filter((t: any) => t.status === 'approved');
            }
          }
        } catch (e) {}
      }

      setStories(approvedList);
    } catch (err) {
      console.warn('[InspiringStories] Exception fetching stories:', err);
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredStories = stories.filter(story => {
    if (ratingFilter !== 'all' && story.rating < ratingFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = story.user_name?.toLowerCase().includes(q);
      const matchContent = story.content?.toLowerCase().includes(q);
      const matchHeadline = story.headline?.toLowerCase().includes(q);
      const matchCourse = story.course_title?.toLowerCase().includes(q);
      return matchName || matchContent || matchHeadline || matchCourse;
    }
    return true;
  });

  const averageRating = stories.length > 0
    ? (stories.reduce((acc, s) => acc + (s.rating || 5), 0) / stories.length).toFixed(1)
    : '5.0';

  const getInitials = (name: string) => {
    if (!name) return 'W';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      {/* Background Glow Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-20 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-10 -left-20 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
        
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold uppercase tracking-wider border border-white/10 transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <button
            onClick={onWriteStory}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95 border border-amber-300/60 cursor-pointer"
          >
            <MessageSquareHeart size={15} />
            <span>Share Your Story</span>
          </button>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest">
            <Heart size={13} className="fill-amber-400 text-amber-400" />
            <span>Community Voices</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Inspiring Stories & Real Transformations
          </h1>

          <p className="text-base sm:text-lg text-gray-300 leading-relaxed font-normal">
            Read how women in our community are transforming their motherhood experience, finding confidence, and supporting each other every step of the way.
          </p>

          {/* Social Proof & Metrics Bar */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs font-medium text-gray-400">
            <div className="flex items-center gap-2">
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={15} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-white font-bold">{averageRating} / 5.0</span>
              <span>Community Rating</span>
            </div>

            <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-zinc-700" />

            <div className="flex items-center gap-1.5 text-gray-300">
              <ShieldCheck size={16} className="text-amber-400" />
              <span>100% Verified Community Stories</span>
            </div>

            <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-zinc-700" />

            <div className="text-gray-300">
              <strong className="text-white">{stories.length}</strong> Transformations Shared
            </div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="mb-8 p-3 sm:p-4 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stories, topics, or names..."
              className="w-full bg-black/60 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setRatingFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                ratingFilter === 'all'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-gray-300'
              }`}
            >
              All Stories ({stories.length})
            </button>
            <button
              onClick={() => setRatingFilter(5)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                ratingFilter === 5
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-gray-300'
              }`}
            >
              <Star size={12} className="fill-current" />
              <span>5 Stars Only</span>
            </button>
          </div>
        </div>

        {/* Stories Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-400">Loading inspiring stories...</p>
          </div>
        ) : filteredStories.length === 0 ? (
          <div className="py-16 text-center space-y-4 rounded-3xl bg-zinc-900/40 border border-white/5 p-8">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-gray-500 mx-auto">
              <MessageSquareHeart size={28} />
            </div>
            <h3 className="text-lg font-bold text-white">No stories match your criteria</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Try changing your search term or view all stories to get inspired.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setRatingFilter('all'); }}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStories.map((story) => {
              const hasPhoto = Boolean(story.user_avatar || story.image_url);
              return (
                <div
                  key={story.id}
                  className="group relative flex flex-col justify-between rounded-3xl bg-gradient-to-b from-[#151722]/95 via-[#101118]/95 to-[#0a0a0f] border border-amber-500/30 hover:border-amber-400/80 p-6 sm:p-7 shadow-[0_8px_30px_rgba(245,158,11,0.08)] hover:shadow-[0_16px_50px_rgba(245,158,11,0.24)] transition-all duration-300 hover:-translate-y-1.5 overflow-hidden"
                >
                  {/* Top Edge Golden Glow Line */}
                  <div className="absolute inset-x-0 -top-px h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />

                  {/* Ambient Radial Golden Glow On Hover */}
                  <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/20 group-hover:scale-125 transition-all duration-700" />
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-600/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />

                  <div className="relative z-10 space-y-4">
                    {/* Top Bar: Rating & Quote Icon */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={14}
                            className={
                              star <= (story.rating || 5)
                               ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]'
                                : 'text-zinc-700'
                            }
                          />
                        ))}
                      </div>

                      <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                        <Quote size={14} />
                      </div>
                    </div>

                    {/* Headline (if present) */}
                    {story.headline && (
                      <h3 className="text-base font-bold text-white leading-snug tracking-tight">
                        "{story.headline}"
                      </h3>
                    )}

                    {/* Testimonial Content */}
                    <p className="text-sm text-gray-300/90 leading-relaxed font-normal whitespace-pre-line">
                      {story.content}
                    </p>

                    {/* Optional Photo Attachment */}
                    {story.image_url && (
                      <div className="pt-2">
                        <div 
                          onClick={() => handleOpenPhoto(story, 'attachment')}
                          className="group/img relative rounded-2xl overflow-hidden border border-white/10 hover:border-amber-400/60 cursor-zoom-in transition-all"
                          title="Click to view the enlarged photo"
                        >
                          <img
                            src={story.image_url}
                            alt="Shared testimonial photo"
                            className="w-full h-44 object-cover group-hover/img:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-bold text-white border border-white/20">
                              Clique para ampliar
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Author Info Footer */}
                  <div className="relative z-10 pt-6 mt-6 border-t border-white/10 flex items-center justify-between gap-3">
                    <div 
                      onClick={() => handleOpenPhoto(story, 'avatar')}
                      className="group/avatar flex items-center gap-3 min-w-0 cursor-pointer"
                      title={hasPhoto ? `Click to see the photo of ${story.user_name}` : undefined}
                    >
                      {story.user_avatar ? (
                        <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-amber-500/40 group-hover/avatar:ring-amber-400 transition-all shrink-0 shadow-md">
                          <img
                            src={story.user_avatar}
                            alt={story.user_name}
                            className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 text-zinc-950 font-black text-xs flex items-center justify-center shrink-0 shadow-md ring-2 ring-amber-500/40 group-hover/avatar:ring-amber-400 transition-all">
                          {getInitials(story.user_name)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-sm truncate group-hover/avatar:text-amber-300 transition-colors">
                            {story.user_name}
                          </span>
                          <span title="Verified Community Member">
                            <ShieldCheck size={14} className="text-amber-400 shrink-0" />
                          </span>
                        </div>
                        
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Call to Action */}
        <div className="mt-16 rounded-3xl bg-gradient-to-r from-amber-500/15 via-zinc-900 to-amber-500/10 border border-amber-500/20 p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Heart size={24} className="fill-amber-400" />
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Your Story Has the Power to Inspire
            </h3>

            <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
              Every breakthrough, big or small, encourages another woman on her journey. Share what you learned and the difference it made for you.
            </p>

            <div className="pt-2">
              <button
                onClick={onWriteStory}
                className="inline-flex items-center gap-3 px-8 py-3.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all border border-amber-200/60 cursor-pointer"
              >
                <span>Write Your Testimonial</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Full-screen Image Viewer / Avatar Viewer (matching Community tab exactly) */}
      {createPortal(
        <AnimatePresence>
          {photoModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex p-4 items-center justify-center overflow-hidden"
              onClick={() => setPhotoModal(null)}
            >
              {photoModal.type === 'avatar' ? (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="relative flex flex-col items-center max-w-xs sm:max-w-sm w-full p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    className="absolute -top-12 right-4 text-white/60 hover:text-white p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all active:scale-95 shadow-lg cursor-pointer"
                    onClick={() => setPhotoModal(null)}
                    title="Fechar"
                  >
                    <X size={20} />
                  </button>
                  
                  {photoModal.userName && (
                    <div className="w-full text-center mb-6 px-4">
                      <h3 className="text-lg font-bold text-white tracking-tight drop-shadow-md">
                        {photoModal.userName}
                      </h3>
                    </div>
                  )}

                  <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden border-[6px] border-white/25 bg-zinc-950 shadow-2xl flex items-center justify-center transition-all">
                    {photoModal.url && photoModal.url.trim() ? (
                      <img
                        src={photoModal.url.trim()}
                        className="w-full h-full object-cover"
                        alt={photoModal.userName || "Perfil"}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                </motion.div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <button 
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/70 hover:text-white p-2 bg-white/10 rounded-full backdrop-blur-md z-[10000] hover:bg-white/20 transition-all active:scale-95 cursor-pointer"
                    onClick={() => setPhotoModal(null)}
                    title="Fechar"
                  >
                    <X size={24} />
                  </button>
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="max-w-4xl w-full flex items-center justify-center p-4"
                  >
                    {photoModal.url && photoModal.url.trim() ? (
                      <img
                        src={photoModal.url.trim()}
                        className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border-4 border-white/25"
                        alt={photoModal.userName || "Full screen"}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
