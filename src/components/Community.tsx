import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User } from '@supabase/supabase-js';
import { supabase, CommunityPost, PostComment } from '../lib/supabase';
import { Send, User as UserIcon, Trash2, Loader2, Image as ImageIcon, X, Edit3, ShieldCheck, Check } from 'lucide-react';
import { GlowingSpinner } from './GlowingSpinner';
import { toast } from '../lib/customToast';
import { m, AnimatePresence } from 'motion/react';
import { format, subDays, isAfter, formatRelative } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { safeFetch } from '../lib/utils';
import { dataCache } from '../lib/cache';
import { CommunityPostCard, parseCommentContent, formatCommentContent } from './CommunityPostCard';

export { parseCommentContent, formatCommentContent };

const POSTS_PER_PAGE = 15;
const LOCALES_MAP: Record<string, any> = { ptBR, enUS, es };
const formattedDateCache = new Map<string, string>();
const POST_SELECT_COLUMNS =
  'id, user_id, user_email, user_name, user_avatar_url, content, image_url, likes_count, comments_count, created_at, reply_to_id, reply_to_content, reply_to_user_name';

interface CommunityProps {
  user: User;
  isImportMode?: boolean;
  isActive?: boolean;
}

export default function Community({ user, isImportMode = false, isActive = true }: CommunityProps) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const cachedInitialPosts = useMemo(() => {
    if (typeof window === 'undefined') return [] as CommunityPost[];
    return (dataCache.getSync<CommunityPost[]>('community_cached_posts', []) || []).slice(0, POSTS_PER_PAGE);
  }, []);
  const [posts, setPosts] = useState<CommunityPost[]>(() => cachedInitialPosts);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !cachedInitialPosts.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [sending, setSending] = useState(false);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [likedComments, setLikedComments] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('liked_comments');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [expandedComments, setExpandedComments] = useState<string[]>([]);
  const [comments, setComments] = useState<Record<string, PostComment[]>>({});
  const [replyingTo, setReplyingTo] = useState<CommunityPost | null>(null);

  const [selectedPostImage, setSelectedPostImage] = useState<string | null>(null);
  const [isAvatarPreview, setIsAvatarPreview] = useState(false);
  const [previewUserName, setPreviewUserName] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<{ id: string; imageUrl?: string } | null>(null);

  // Admin features
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editingComment, setEditingComment] = useState<{ id: string; postId: string; content: string } | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [adminMode] = useState(isImportMode);
  const [personaActive, setPersonaActive] = useState(false);
  const [manualAuthorName, setManualAuthorName] = useState('');
  const [manualAvatarUrl] = useState('');
  const [manualAvatarFile, setManualAvatarFile] = useState<File | null>(null);
  const [manualAvatarPreview, setManualAvatarPreview] = useState<string | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<{ id: string; postId: string } | null>(null);

  const isAdmin = isImportMode || user.email?.toLowerCase() === settings?.admin_email?.toLowerCase();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualAvatarInputRef = useRef<HTMLInputElement>(null);
  const postInputRef = useRef<HTMLTextAreaElement>(null);
  const postsRef = useRef<CommunityPost[]>(cachedInitialPosts);
  const postLikesMapRef = useRef<Record<string, number> | null>(null);
  const commentLikesCacheRef = useRef<Record<string, number> | null>(null);
  const fetchInFlightRef = useRef<Set<number>>(new Set());
  const processingLikesRef = useRef<Set<string>>(new Set());
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const likedPostsSet = useMemo(() => new Set(likedPosts), [likedPosts]);
  const likedCommentsSet = useMemo(() => new Set(likedComments), [likedComments]);
  const expandedCommentsSet = useMemo(() => new Set(expandedComments), [expandedComments]);
  const likedPostsRef = useRef(likedPostsSet);
  likedPostsRef.current = likedPostsSet;
  const likedCommentsListRef = useRef(likedComments);
  likedCommentsListRef.current = likedComments;
  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  const getCommentLikesCache = useCallback((): Record<string, number> => {
    if (commentLikesCacheRef.current) return commentLikesCacheRef.current;
    try {
      const parsed = JSON.parse(localStorage.getItem('comment_likes_cache') || '{}');
      commentLikesCacheRef.current = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      commentLikesCacheRef.current = {};
    }
    return commentLikesCacheRef.current!;
  }, []);

  const notifyAdmin = async (type: 'post' | 'comment', content: string, postId?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const authorName = (adminMode && personaActive) 
        ? (manualAuthorName || 'Aluna') 
        : (user.user_metadata?.full_name || user.email?.split('@')[0] || 'Aluna');
      
      const title = type === 'post' 
        ? '💬 Novo post na Comunidade' 
        : '💬 Novo comentário na Comunidade';

      const cleanSnippet = content.trim().substring(0, 100) + (content.length > 100 ? '...' : '');
      const body = type === 'post' 
        ? `${authorName}: "${cleanSnippet}"`
        : `${authorName} comentou: "${cleanSnippet}"`;

      console.log('🔔 [Community] Disparando notificação PUSH para o Admin:', { title, body, type, postId });

      safeFetch('/api/v1/notifications?action=notify-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title,
          body,
          data: {
            type: type === 'post' ? 'community_post' : 'community_comment',
            url: '/?tab=community',
            postId: postId || null
          }
        })
      }).catch(e => console.warn('[Community] Erro ao notificar admin:', e));
    } catch (e) {
      console.warn('Notice notifying admin:', e);
    }
  };

  const formatDate = useCallback((dateString?: string) => {
    try {
      const safeDateStr = dateString || new Date().toISOString();
      const localeCode = t('community.locale') || 'ptBR';
      const formatStr = t('community.date_format') || "dd 'de' MMMM 'às' HH:mm";
      const now = new Date();
      const cacheKey = `${safeDateStr}|${localeCode}|${formatStr}|${now.toDateString()}`;
      const cached = formattedDateCache.get(cacheKey);
      if (cached !== undefined) return cached;

      const date = new Date(safeDateStr);
      if (isNaN(date.getTime())) return '';
      const locale = LOCALES_MAP[localeCode] || ptBR;

      let result: string;
      if (isAfter(date, subDays(now, 6))) {
        const relative = formatRelative(date, now, { locale });
        result = relative.charAt(0).toUpperCase() + relative.slice(1);
      } else {
        result = format(date, formatStr, { locale });
      }

      if (formattedDateCache.size > 500) {
        formattedDateCache.clear();
      }
      formattedDateCache.set(cacheKey, result);
      return result;
    } catch {
      return dateString || '';
    }
  }, [t]);
  const inputAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPosts(0, true);
    fetchUserLikes();

    safeFetch('/api/v1/admin?action=comment-likes-map').then((res: any) => {
      if (res && typeof res === 'object' && !res.error) {
        try {
          const merged = { ...getCommentLikesCache(), ...res };
          commentLikesCacheRef.current = merged;
          localStorage.setItem('comment_likes_cache', JSON.stringify(merged));
        } catch {}
      }
    }).catch(() => {});

    // Listen to new post creation events from admin creator or actions
    const handleCommunityPostCreated = (e: any) => {
      console.log('🔔 [Community] Detected community-post-created event:', e?.detail);
      dataCache.invalidate('community_cached_posts');
      fetchPosts(0, true, true);
    };
    window.addEventListener('community-post-created', handleCommunityPostCreated);

    const channelId = Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(`community_changes_${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newPost = payload.new as CommunityPost;
            setPosts(prev => {
              if (prev.some(p => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedPost = payload.new as CommunityPost;
            setPosts(prev => prev.map(p => {
              if (p.id === updatedPost.id) {
                return { ...p, ...updatedPost };
              }
              return p;
            }));
          } else if (payload.eventType === 'DELETE') {
            setPosts(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        (payload: any) => {
          const postId = payload.new?.post_id || payload.old?.post_id;
          if (postId) {
            if (payload.eventType === 'INSERT') {
              const newComment = payload.new as PostComment;
              setComments(prev => {
                const postComments = prev[postId] || [];
                if (postComments.some(c => c.id === newComment.id)) return prev;
                return { ...prev, [postId]: [...postComments, newComment] };
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedComment = payload.new as PostComment;
              setComments(prev => {
                const postComments = prev[postId] || [];
                return {
                  ...prev,
                  [postId]: postComments.map(c => c.id === updatedComment.id ? updatedComment : c)
                };
              });
            } else if (payload.eventType === 'DELETE') {
              setComments(prev => ({
                ...prev,
                [postId]: (prev[postId] || []).filter(c => c.id !== payload.old.id)
              }));
            }
          }
        }
      )
      .subscribe();

    // Polling fallback every 60 seconds — paused when tab or document is hidden
    const interval = setInterval(() => {
      if (!isActiveRef.current || document.hidden) return;
      fetchPosts(0, false);
    }, 60000);

    return () => {
      window.removeEventListener('community-post-created', handleCommunityPostCreated);
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user.id]);

  const fetchPosts = async (pageNum = 0, isInitial = false, force = false) => {
    if (!force && fetchInFlightRef.current.has(pageNum)) {
      return;
    }
    fetchInFlightRef.current.add(pageNum);

    try {
      if (isInitial) {
        if (postsRef.current.length === 0) {
          setLoading(true);
        }
      } else if (pageNum > 0) {
        setLoadingMore(true);
      }

      const from = pageNum * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;

      const [sbRaw, apiRes, likesMapResult] = await Promise.all([
        (async () => {
          try {
            const { data, error } = await supabase
              .from('community_posts')
              .select(POST_SELECT_COLUMNS)
              .order('created_at', { ascending: false })
              .range(from, to + 1);
            return !error && Array.isArray(data) ? data : [];
          } catch (sbErr) {
            console.warn('Supabase fetch posts note:', sbErr);
            return [] as CommunityPost[];
          }
        })(),
        (async () => {
          try {
            const res = await safeFetch(
              `/api/v1/community?action=list-posts&offset=${from}&limit=${POSTS_PER_PAGE}`
            );
            return res && res.success ? res : null;
          } catch (apiErr) {
            console.warn('API fetch posts note:', apiErr);
            return null;
          }
        })(),
        pageNum === 0 && !postLikesMapRef.current
          ? safeFetch('/api/v1/admin?action=post-likes-map').catch(() => null)
          : Promise.resolve(postLikesMapRef.current)
      ]);

      const moreFromSb = sbRaw.length > POSTS_PER_PAGE;
      const sbResult = sbRaw.slice(0, POSTS_PER_PAGE);
      const apiResult: CommunityPost[] = Array.isArray(apiRes?.posts) ? apiRes.posts : [];
      const moreFromApi = Boolean(apiRes?.hasMore);

      if (likesMapResult && typeof likesMapResult === 'object' && !likesMapResult.error) {
        postLikesMapRef.current = likesMapResult;
      }
      const likesOverrides = postLikesMapRef.current;

      // Merge both collections by unique ID
      const postsMap = new Map<string, CommunityPost>();
      for (const p of sbResult) {
        if (p && p.id) postsMap.set(p.id, p);
      }
      for (const p of apiResult) {
        if (p && p.id) {
          const existing = postsMap.get(p.id) || ({} as CommunityPost);
          postsMap.set(p.id, { ...existing, ...p });
        }
      }

      // Sort strictly by created_at (most recent first) and apply likes overrides
      const mergedList = Array.from(postsMap.values()).map(p =>
        likesOverrides && likesOverrides[p.id] !== undefined
          ? { ...p, likes_count: likesOverrides[p.id] }
          : p
      );
      mergedList.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });

      if (isInitial || pageNum === 0) {
        const finalPage = mergedList.slice(0, POSTS_PER_PAGE);
        if (finalPage.length > 0) {
          dataCache.set('community_cached_posts', finalPage, 300000);
        }
        const prev = postsRef.current;
        const isIdentical =
          prev.length === finalPage.length &&
          prev.every((p, idx) => {
            const n = finalPage[idx];
            return (
              p.id === n.id &&
              p.content === n.content &&
              p.likes_count === n.likes_count &&
              p.comments_count === n.comments_count &&
              p.image_url === n.image_url &&
              p.user_avatar_url === n.user_avatar_url &&
              p.user_name === n.user_name
            );
          });
        if (!isIdentical) {
          setPosts(finalPage);
        }
        setHasMore(moreFromSb || moreFromApi || mergedList.length > POSTS_PER_PAGE);
      } else {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = mergedList.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
        setHasMore(moreFromSb || moreFromApi || mergedList.length >= POSTS_PER_PAGE);
      }

      setPage(pageNum);
    } catch (error: any) {
      console.error('Error fetching posts:', error);
      toast.error(t('community.load_error'));
    } finally {
      fetchInFlightRef.current.delete(pageNum);
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchPosts(page + 1);
    }
  };

  const fetchUserLikes = async () => {
    try {
      const { data, error } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id);

      if (error) throw error;
      setLikedPosts(data?.map(l => l.post_id) || []);
    } catch (error) {
      console.error('Error fetching likes:', error);
    }
  };

  const fetchComments = useCallback(async (postId: string) => {
    try {
      // 1. Fetch from Supabase
      let sbComments: PostComment[] = [];
      try {
        const { data, error } = await supabase
          .from('post_comments')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(data)) {
          sbComments = data;
        }
      } catch (sbErr) {
        console.warn('Supabase comments fetch note:', sbErr);
      }

      // 2. Fetch from API endpoint (which handles local fallback comments)
      let apiComments: PostComment[] = [];
      try {
        const res = await safeFetch(`/api/v1/community?action=list-comments&postId=${postId}`);
        if (res && res.success && Array.isArray(res.comments)) {
          apiComments = res.comments;
        }
      } catch (apiErr) {
        console.warn('API comments fetch note:', apiErr);
      }

      // 3. Merge comments deduplicating by ID
      const commentsMap = new Map<string, PostComment>();
      for (const c of sbComments) {
        if (c && c.id) commentsMap.set(c.id, c);
      }
      for (const c of apiComments) {
        if (c && c.id) {
          const existing = commentsMap.get(c.id) || ({} as PostComment);
          commentsMap.set(c.id, { ...existing, ...c });
        }
      }

      let commentsList = Array.from(commentsMap.values());
      commentsList.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      });

      const localOverrides = getCommentLikesCache();
      commentsList = commentsList.map(c => {
        if (localOverrides[c.id] !== undefined) {
          const { text } = parseCommentContent(c.content);
          const overriddenLikes = localOverrides[c.id];
          return {
            ...c,
            content: overriddenLikes > 0 ? `${text} [likes:${overriddenLikes}]` : text
          };
        }
        return c;
      });

      setComments(prev => ({ ...prev, [postId]: commentsList }));
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  }, [getCommentLikesCache]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;
    const { id: postId, imageUrl } = postToDelete;

    // Optimistic delete
    const previousPosts = [...posts];
    setPosts(prev => prev.filter(p => p.id !== postId));
    setPostToDelete(null); // Close modal immediately

    try {
      // Delete image from storage if exists
      if (imageUrl) {
        const fileName = imageUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('community_images').remove([`posts/${fileName}`]).catch(() => {});
        }
      }

      // 1. Delete from Supabase
      try {
        await supabase.from('community_posts').delete().eq('id', postId);
      } catch (err: any) {
        console.warn('Supabase post delete notice:', err);
      }

      // 2. Always notify backend to prune from local and cloud storage
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          const refreshed = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
          session = refreshed.data.session;
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Admin-Email': user?.email || 'gabrielchendes@gmail.com'
        };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        await safeFetch('/api/v1/community?action=delete-post', {
          method: 'POST',
          headers,
          body: JSON.stringify({ postId, imageUrl })
        });
      } catch (apiErr) {
        console.warn('Backend API delete-post notice:', apiErr);
      }

      // 3. Invalidate client-side cache
      try {
        dataCache.invalidate('community_cached_posts');
      } catch {}

      toast.success(t('community.delete_success'));
    } catch (error) {
      console.error('Error deleting post:', error);
      setPosts(previousPosts); // Revert on failure
      toast.error(t('community.delete_error'));
    }
  };

  const handleManualAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setManualAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setManualAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadManualAvatar = useCallback(async (): Promise<string> => {
    if (!manualAvatarFile) return manualAvatarUrl;

    try {
      const { default: imageCompression } = await import('browser-image-compression');
      const options = {
        maxSizeMB: 0.05,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(manualAvatarFile, options);

      const fileExt = manualAvatarFile.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('community_images')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('community_images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading manual avatar:', error);
      return manualAvatarUrl;
    }
  }, [manualAvatarFile, manualAvatarUrl]);

  const handleDeleteComment = async () => {
    if (!commentToDelete) return;
    const { id: commentId, postId } = commentToDelete;

    try {
      let deleteSuccess = false;
      try {
        const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
        if (!error) deleteSuccess = true;
      } catch {}

      if (!deleteSuccess) {
        const { data: { session } } = await supabase.auth.getSession();
        await safeFetch('/api/v1/admin?action=comment-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ commentId })
        });
      }

      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
      }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p));
      toast.success(t('community.comment_delete_success'));
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error(t('community.comment_delete_error') || 'Erro ao excluir comentário');
    } finally {
      setCommentToDelete(null);
    }
  };

  const handleLikeComment = useCallback(async (postId: string, commentId: string, targetLikes: number, _currentLikes?: number) => {
    if (!user) return;

    const newLikes = Math.max(0, targetLikes);

    // Cache in memory + localStorage immediately
    try {
      const cached = getCommentLikesCache();
      cached[commentId] = newLikes;
      localStorage.setItem('comment_likes_cache', JSON.stringify(cached));
    } catch {}

    // 1. Optimistic state update
    setComments(prev => {
      const postComments = prev[postId] || [];
      return {
        ...prev,
        [postId]: postComments.map(c => {
          if (c.id === commentId) {
            const { text } = parseCommentContent(c.content);
            return {
              ...c,
              content: newLikes > 0 ? `${text} [likes:${newLikes}]` : text
            };
          }
          return c;
        })
      };
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await safeFetch('/api/v1/admin?action=comment-like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          commentId,
          likesCount: newLikes
        })
      });

      if (response && response.error && !response.id) {
        throw new Error(response.error);
      }
    } catch (error: any) {
      console.warn('Comment like background sync warning:', error);
    }
  }, [user, getCommentLikesCache]);

  const handleLikeCommentToggle = useCallback(async (postId: string, commentId: string, currentLikes: number) => {
    const currentList = likedCommentsListRef.current;
    const isLiked = currentList.includes(commentId);
    const targetLikes = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    const nextLiked = isLiked ? currentList.filter(id => id !== commentId) : [...currentList, commentId];
    setLikedComments(nextLiked);
    try {
      localStorage.setItem('liked_comments', JSON.stringify(nextLiked));
    } catch {}

    await handleLikeComment(postId, commentId, targetLikes, currentLikes);
  }, [handleLikeComment]);

  const handlePostLikesDirect = useCallback(async (postId: string, targetLikes: number, _currentLikes: number) => {
    if (!isImportMode) return;

    const newLikes = Math.max(0, targetLikes);

    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: newLikes } : p));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await safeFetch('/api/v1/admin?action=post-likes-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          postId,
          likesCount: newLikes
        })
      });

      if (response && response.error && !response.id) {
        throw new Error(response.error);
      }
    } catch (error: any) {
      console.warn('Post likes background sync warning:', error);
    }
  }, [isImportMode]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newPostContent.trim();
    if ((!content && !selectedImage) || sending) return;

    setSending(true);
    let imageUrl = '';
    const tempId = `temp-${Date.now()}`;
    let finalAvatarUrl = manualAvatarUrl;

    const authorName = (adminMode && personaActive) ? manualAuthorName : (user.user_metadata?.full_name || user.email?.split('@')[0]);
    const authorAvatar = (adminMode && personaActive) ? finalAvatarUrl : (user.user_metadata?.avatar_url || null);

    // Create optimistic post
    const optimisticPost: CommunityPost = {
      id: tempId,
      user_id: user.id,
      user_name: authorName,
      user_avatar_url: authorAvatar,
      content: content,
      image_url: imagePreview || null, // Show preview immediately
      likes_count: 0,
      comments_count: 0,
      user_email: user.email || '',
      created_at: new Date().toISOString(),
      reply_to_id: replyingTo?.id || null,
      reply_to_content: replyingTo?.content || null,
      reply_to_user_name: replyingTo?.user_name || null,
    };

    // 1. Update UI immediately
    setPosts(prev => [optimisticPost, ...prev]);
    
    // Clear inputs immediately for better UX
    setNewPostContent('');
    setSelectedImage(null);
    setImagePreview(null);
    setReplyingTo(null);

    // Scroll to top to show the new post
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      if (adminMode && manualAvatarFile) {
        finalAvatarUrl = await uploadManualAvatar();
      }

      if (selectedImage) {
        const { default: imageCompression } = await import('browser-image-compression');
        // Slightly better quality for posts (target ~100KB)
        const options = {
          maxSizeMB: 0.1,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(selectedImage, options);
        
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('community_images')
          .upload(filePath, compressedFile);

        if (uploadError) {
          console.error('Upload error details:', uploadError);
          // Revert optimistic update if upload fails
          setPosts(prev => prev.filter(p => p.id !== tempId));
          throw new Error(t('community.upload_error'));
        }

        const { data: { publicUrl } } = supabase.storage
          .from('community_images')
          .getPublicUrl(filePath);
        
        imageUrl = publicUrl;
      }

      console.log('🔎 Query Supabase: community_posts (insert)');
      let newPost: CommunityPost | null = null;
      let insertError: any = null;

      try {
        const { data, error } = await supabase.from('community_posts').insert({
          user_id: user.id,
          user_email: user.email,
          user_name: authorName,
          user_avatar_url: (adminMode && personaActive) ? finalAvatarUrl : authorAvatar,
          content: content,
          image_url: imageUrl || null,
          reply_to_id: optimisticPost.reply_to_id,
          reply_to_content: optimisticPost.reply_to_content,
          reply_to_user_name: optimisticPost.reply_to_user_name,
        }).select().single();

        if (error) {
          insertError = error;
        } else if (data) {
          newPost = data as CommunityPost;
        }
      } catch (err: any) {
        insertError = err;
      }

      // If direct insert failed (e.g. RLS 42501, session mismatch, or permissions), route via backend community API
      if (insertError || !newPost) {
        console.warn('Direct Supabase insert note (RLS or policy), routing via backend community API fallback:', insertError?.code || insertError?.message);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const apiRes = await safeFetch('/api/v1/community?action=create-post', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
            },
            body: JSON.stringify({
              user_id: user.id,
              user_email: user.email,
              user_name: authorName,
              user_avatar_url: (adminMode && personaActive) ? finalAvatarUrl : authorAvatar,
              content: content,
              image_url: imageUrl || null,
              reply_to_id: optimisticPost.reply_to_id,
              reply_to_content: optimisticPost.reply_to_content,
              reply_to_user_name: optimisticPost.reply_to_user_name,
            })
          });

          if (apiRes?.post) {
            newPost = apiRes.post as CommunityPost;
          } else if (apiRes?.data) {
            newPost = apiRes.data as CommunityPost;
          } else if (apiRes && !apiRes.error) {
            newPost = { ...optimisticPost, id: apiRes.id || `post_${Date.now()}` };
          } else if (apiRes?.error) {
            throw new Error(apiRes.error);
          }
        } catch (apiErr: any) {
          console.error('Community API create fallback error:', apiErr);
          if (!newPost) {
            setPosts(prev => prev.filter(p => p.id !== tempId));
            throw (insertError || apiErr);
          }
        }
      }

      if (newPost) {
        // Replace temp post with real one
        setPosts(prev => prev.map(p => p.id === tempId ? newPost as CommunityPost : p));
        
        // Notify Admin if student posting or persona active
        if (!adminMode || personaActive) {
          notifyAdmin('post', content, newPost.id).catch(e => console.warn('Notification failed:', e));
        }
      }

      toast.success(t('community.post_sent'));
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(error.message || t('community.create_error'));
      // If we didn't already remove it in the specific catch above
      setPosts(prev => prev.filter(p => p.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleUpdatePost = async () => {
    if (!editingPost || !editContent.trim()) return;
    try {
      console.log('🔎 Query Supabase: community_posts (update)');
      let updateError: any = null;
      try {
        const { error } = await supabase
          .from('community_posts')
          .update({ content: editContent })
          .eq('id', editingPost.id);
        if (error) updateError = error;
      } catch (err: any) {
        updateError = err;
      }

      if (updateError) {
        const { data: { session } } = await supabase.auth.getSession();
        await safeFetch('/api/v1/community?action=update-post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
          },
          body: JSON.stringify({
            postId: editingPost.id,
            content: editContent
          })
        });
      }

      setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: editContent } : p));
      setEditingPost(null);
      toast.success(t('community.post_updated'));
    } catch (error) {
      toast.error(t('community.update_error') || 'Erro ao atualizar post');
    }
  };

  const handleUpdateComment = async () => {
    if (!editingComment || !editCommentContent.trim()) return;
    const { id: commentId, postId } = editingComment;
    const newContent = editCommentContent.trim();

    try {
      const currentComment = comments[postId]?.find(c => c.id === commentId);
      let finalContent = newContent;
      if (currentComment) {
        const { likes } = parseCommentContent(currentComment.content);
        if (likes > 0 && !newContent.includes('[likes:')) {
          finalContent = `${newContent} [likes:${likes}]`;
        }
      }

      let updateError: any = null;
      try {
        const { error } = await supabase
          .from('post_comments')
          .update({ content: finalContent })
          .eq('id', commentId);
        if (error) updateError = error;
      } catch (err: any) {
        updateError = err;
      }

      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const refreshed = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
        session = refreshed.data.session;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Admin-Email': user?.email || 'gabrielchendes@gmail.com'
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      await safeFetch('/api/v1/community?action=update-comment', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          commentId,
          postId,
          content: finalContent
        })
      });

      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).map(c => c.id === commentId ? { ...c, content: finalContent } : c)
      }));

      setEditingComment(null);
      setEditCommentContent('');
      toast.success(t('community.comment_updated') || 'Comentário atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error(t('community.comment_update_error') || 'Erro ao atualizar comentário');
    }
  };

  const handleLike = useCallback(async (postId: string) => {
    const isLiked = likedPostsRef.current.has(postId);

    if (processingLikesRef.current.has(postId)) return;
    processingLikesRef.current.add(postId);

    const targetPost = postsRef.current.find(p => p.id === postId);
    const currentLikes = targetPost?.likes_count || 0;
    const newLikes = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    setLikedPosts(prev => isLiked ? prev.filter(id => id !== postId) : [...prev, postId]);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: newLikes } : p));

    try {
      if (isImportMode) {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await safeFetch('/api/v1/admin?action=post-likes-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            postId,
            likesCount: newLikes
          })
        });

        if (response && response.error) {
          throw new Error(response.error);
        }
      } else {
        if (isLiked) {
          await supabase.from('post_likes').delete().match({ user_id: user.id, post_id: postId });
        } else {
          await supabase.from('post_likes').insert({ user_id: user.id, post_id: postId });
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      if (!isImportMode) {
        fetchUserLikes();
      } else {
        setLikedPosts(prev => isLiked ? [...prev, postId] : prev.filter(id => id !== postId));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: currentLikes } : p));
      }
    } finally {
      setTimeout(() => {
        processingLikesRef.current.delete(postId);
      }, 400);
    }
  }, [isImportMode, user.id]);

  const handleAddComment = useCallback(async (postId: string, rawContent: string) => {
    const content = rawContent.trim();
    if (!content) return;

    let finalAvatarUrl = manualAvatarUrl;
    if (adminMode && manualAvatarFile) {
      finalAvatarUrl = await uploadManualAvatar();
    }

    const tempCommentId = `temp-comment-${Date.now()}`;
    const authorName = (adminMode && personaActive) ? manualAuthorName : (user.user_metadata?.full_name || user.email?.split('@')[0]);
    const authorAvatar = (adminMode && personaActive) ? finalAvatarUrl : (user.user_metadata?.avatar_url || null);

    const tempComment: PostComment = {
      id: tempCommentId,
      post_id: postId,
      user_id: user.id,
      user_name: authorName,
      user_avatar_url: authorAvatar,
      content: content,
      created_at: new Date().toISOString(),
    };

    setComments(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), tempComment]
    }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
    setExpandedComments(prev => (prev.includes(postId) ? prev : [...prev, postId]));

    try {
      let data: any = null;
      let insertError: any = null;

      try {
        const res = await supabase.from('post_comments').insert({
          post_id: postId,
          user_id: user.id,
          user_name: authorName,
          user_avatar_url: authorAvatar,
          content: content,
        }).select().single();
        if (res.error) insertError = res.error;
        else data = res.data;
      } catch (err: any) {
        insertError = err;
      }

      if (insertError || !data) {
        const { data: { session } } = await supabase.auth.getSession();
        const apiRes = await safeFetch('/api/v1/community?action=create-comment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
          },
          body: JSON.stringify({
            postId,
            user_id: user.id,
            user_name: authorName,
            user_avatar_url: authorAvatar,
            content
          })
        });

        if (apiRes?.comment) {
          data = apiRes.comment;
        } else if (apiRes && !apiRes.error) {
          data = { ...tempComment, id: apiRes.id || `comment_${Date.now()}` };
        } else {
          setComments(prev => ({
            ...prev,
            [postId]: (prev[postId] || []).filter(c => c.id !== tempCommentId)
          }));
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } : p));
          throw insertError || new Error('Falha ao adicionar comentário');
        }
      }

      if (data) {
        setComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(c => c.id === tempCommentId ? data : c)
        }));

        if (!adminMode || personaActive) {
          notifyAdmin('comment', content, postId).catch(e => console.warn(e));
        }

        try {
          const { data: post } = await supabase.from('community_posts').select('user_id').eq('id', postId).single();
          if (post && post.user_id && post.user_id !== user.id) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              fetch('/api/v1/notifications?action=notification-push', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                  title: t('notifications.user_comment') || 'Novo comentário no seu post',
                  body: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
                  userIds: [post.user_id]
                })
              }).catch(e => console.warn(e));
            }
          }
        } catch (e) {}
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error(t('community.comment_error'));
    }
  }, [adminMode, personaActive, manualAuthorName, manualAvatarFile, manualAvatarUrl, uploadManualAvatar, user.id, user.user_metadata, user.email, t]);

  const toggleComments = useCallback((postId: string) => {
    setExpandedComments(prev => {
      if (prev.includes(postId)) {
        return prev.filter(id => id !== postId);
      }
      if (!commentsRef.current[postId]) {
        fetchComments(postId);
      }
      return [...prev, postId];
    });
  }, [fetchComments]);

  const handlePreviewAvatar = useCallback((url: string, userName: string) => {
    setIsAvatarPreview(true);
    setPreviewUserName(userName);
    setSelectedPostImage(url);
  }, []);

  const handlePreviewPostImage = useCallback((url: string) => {
    setIsAvatarPreview(false);
    setSelectedPostImage(url);
  }, []);

  const handleStartEditPost = useCallback((post: CommunityPost) => {
    setEditingPost(post);
    setEditContent(post.content);
  }, []);

  const handleRequestDeletePost = useCallback((postId: string, imageUrl?: string | null) => {
    setPostToDelete({ id: postId, imageUrl: imageUrl || undefined });
  }, []);

  const handleReplyPost = useCallback((post: CommunityPost) => {
    setReplyingTo(post);
    setTimeout(() => {
      inputAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      postInputRef.current?.focus();
    }, 100);
  }, []);

  const handleStartEditComment = useCallback((commentId: string, postId: string, text: string) => {
    setEditingComment({ id: commentId, postId, content: text });
    setEditCommentContent(text);
  }, []);

  const handleRequestDeleteComment = useCallback((commentId: string, postId: string) => {
    setCommentToDelete({ id: commentId, postId });
  }, []);

  const showCommentAvatar = !isImportMode || (isImportMode && personaActive);
  const commentAvatarUrl = (adminMode && personaActive)
    ? (manualAvatarPreview || null)
    : (user.user_metadata?.avatar_url || null);
  const commentPlaceholder = (adminMode && personaActive)
    ? `Comentar como ${manualAuthorName}`
    : adminMode
      ? 'Configure uma persona acima...'
      : (t('community.comment_placeholder') || 'Escreva um comentário...');
  const commentDisabled = adminMode && !personaActive;
  const replyingToLabel = t('community.replying_to') || 'Em resposta a';
  const replyLabel = t('community.reply') || 'Responder';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <GlowingSpinner size="md" color={isImportMode ? 'blue' : 'primary'} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)] max-w-2xl mx-auto px-4 pb-20">
      {/* Header - Even higher */}
      <div className="py-1 text-center border-b border-white/5 mb-2">
        <h2 className="text-lg font-bold">{t('community.title') || 'Comunidade'}</h2>
        <p className="text-gray-400 text-[10px]">{t('community.subtitle') || 'Compartilhe sua jornada com outras mães'}</p>
      </div>

      {/* Post Creation Card with Static Luxury Luminous Frame & Obsidian Glass Chassis */}
      <div 
        ref={inputAreaRef} 
        className="relative rounded-[24px] p-[1.5px] bg-gradient-to-b from-amber-400/40 via-primary/30 to-amber-900/30 shadow-[0_12px_36px_-10px_rgba(245,158,11,0.18),0_0_20px_rgba(244,63,94,0.08)] mb-6 transition-all duration-300 overflow-hidden"
      >
        {/* Main Obsidian Glass Body */}
        <div className="relative rounded-[22.5px] bg-gradient-to-b from-[#141624]/98 via-[#0c0e16]/98 to-[#06070a]/98 backdrop-blur-md p-4 sm:p-5 text-white overflow-hidden ring-1 ring-inset ring-amber-400/15">
          {/* Top Specular Horizon Gleam */}
          <div className="absolute top-0 inset-x-8 h-[1px] bg-gradient-to-r from-transparent via-amber-300/60 to-transparent pointer-events-none" />

          {/* Ambient Glow Aura */}
          <div
            className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-24 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.14) 0%, transparent 70%)' }}
          />
        {isAdmin && isImportMode && (
          <div className="flex flex-col gap-4 mb-4 pb-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${isImportMode ? 'text-blue-500' : 'text-primary'}`}>
                <ShieldCheck size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Painel de Importação</span>
              </div>
            </div>

            <AnimatePresence>
              {adminMode && (
                <m.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-4"
                >
                  {!personaActive ? (
                    <>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Configurar Perfil de Importação</p>
                      <div className="flex items-center gap-4">
                        <div 
                          className="relative w-16 h-16 rounded-full bg-zinc-800 border-2 border-white/10 flex items-center justify-center overflow-hidden cursor-pointer group shrink-0"
                          onClick={() => manualAvatarInputRef.current?.click()}
                        >
                          {manualAvatarPreview && manualAvatarPreview.trim() ? (
                            <img src={manualAvatarPreview.trim()} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon size={24} className="text-gray-600" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ImageIcon size={16} className="text-white" />
                          </div>
                        </div>
                        <div className="flex-1 space-y-2">
                          <input 
                            type="text" 
                            placeholder={t('admin.persona_name_placeholder')}
                            value={manualAuthorName}
                            onChange={e => setManualAuthorName(e.target.value)}
                            className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-${isImportMode ? 'blue-500' : 'primary'}`}
                          />
                          <button 
                            onClick={() => {
                              if (!manualAuthorName.trim()) {
                                toast.error(t('admin.persona_name_required'));
                                return;
                              }
                              setPersonaActive(true);
                              toast.success(`${t('admin.persona_active')} ${manualAuthorName}`);
                            }}
                            className={`w-full ${isImportMode ? 'bg-blue-500/20 hover:bg-blue-500/40 text-blue-500' : 'bg-primary/20 hover:bg-primary/40 text-primary'} text-[10px] font-black py-2 rounded-lg transition-all`}
                          >
                            {t('admin.confirm_persona')}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-zinc-800 border ${isImportMode ? 'border-blue-500/30' : 'border-primary/30'} overflow-hidden`}>
                          {manualAvatarPreview && manualAvatarPreview.trim() ? (
                            <img src={manualAvatarPreview.trim()} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                              <UserIcon size={20} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('admin.posting_as')}</p>
                          <p className="text-sm font-bold text-white">{manualAuthorName}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setPersonaActive(false)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-black rounded-lg transition-all"
                      >
                        {t('admin.change_persona')}
                      </button>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={manualAvatarInputRef} 
                    onChange={handleManualAvatarSelect} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </m.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <form onSubmit={handleCreatePost} className="space-y-4">
          
          <AnimatePresence>
            {replyingTo && (
              <m.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`bg-white/5 rounded-xl p-3 border-l-4 ${isImportMode ? 'border-blue-500' : 'border-primary'} relative mb-2`}
              >
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="absolute top-2 right-2 text-gray-500 hover:text-white"
                >
                  <X size={16} />
                </button>
                <p className={`text-[10px] ${isImportMode ? 'text-blue-500' : 'text-primary'} font-bold mb-1 uppercase tracking-wider`}>{t('community.replying_to') || 'Em resposta a'} {replyingTo.user_name}</p>
                <p className="text-xs text-gray-400 line-clamp-2 italic">"{replyingTo.content}"</p>
              </m.div>
            )}
          </AnimatePresence>

            <div className="flex gap-3">
              {(!isImportMode || (isImportMode && personaActive)) && (
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 border border-white/5 shrink-0 overflow-hidden">
                  {(adminMode && personaActive) ? (
                    manualAvatarPreview && manualAvatarPreview.trim() ? (
                      <img src={manualAvatarPreview.trim()} alt="Avatar" loading="lazy" decoding="async" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserIcon size={20} />
                    )
                  ) : (user.user_metadata?.avatar_url && user.user_metadata.avatar_url.trim()) ? (
                    <img src={user.user_metadata.avatar_url.trim()} alt="Avatar" loading="lazy" decoding="async" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon size={20} />
                  )}
                </div>
              )}
              <textarea
                ref={postInputRef}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder={(adminMode && personaActive) ? `Postar como ${manualAuthorName}` : (adminMode ? t('community.admin_placeholder') || "Configure uma persona acima para postar..." : t('community.input_placeholder') || "O que você está pensando?")}
                disabled={adminMode && !personaActive}
                className="w-full bg-transparent border-none focus:ring-0 text-base resize-none placeholder:text-gray-600 min-h-[60px] disabled:opacity-50"
                style={{ fontSize: '16px' }} // Fix mobile zoom
              />
            </div>

          <AnimatePresence>
            {imagePreview && imagePreview.trim() && (
              <m.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative rounded-xl overflow-hidden aspect-video bg-black/20"
              >
                <img src={imagePreview.trim()} className="w-full h-full object-cover" alt="Preview" />
                <button
                  type="button"
                  onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
                >
                  <X size={18} />
                </button>
              </m.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group/photo relative flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-amber-400/40 transition-all duration-300 active:scale-95 text-xs font-semibold tracking-wide text-zinc-300 hover:text-white shadow-sm hover:shadow-[0_0_16px_rgba(245,158,11,0.12)] cursor-pointer overflow-hidden"
            >
              {/* Specular Light Reflection */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/0 via-amber-400/10 to-primary/0 opacity-0 group-hover/photo:opacity-100 transition-opacity pointer-events-none" />
              
              {/* Icon Capsule */}
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400/20 via-primary/20 to-black border border-amber-400/30 group-hover/photo:border-amber-400/60 flex items-center justify-center text-amber-300 group-hover/photo:text-amber-200 transition-all shadow-sm">
                <ImageIcon size={13} className="stroke-[2.2]" />
              </div>

              <span className="relative z-10 font-bold text-zinc-300 group-hover/photo:text-amber-200 transition-colors">
                {t('community.add_photo') || 'Add Photo'}
              </span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageSelect} 
              accept="image/*" 
              className="hidden" 
            />
            
            <button
              type="submit"
              disabled={(!newPostContent.trim() && !selectedImage) || sending}
              className={`${isImportMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary hover:bg-primary-hover'} text-white px-6 py-2 rounded-full font-bold text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2`}
            >
              {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              {replyingTo 
                ? (t('community.send_reply') || 'Enviar Resposta') 
                : (t('community.post') || 'Publicar')}
            </button>
          </div>
        </form>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg font-medium">{t('community.empty_title') || 'Ainda não há publicações.'}</p>
            <p className="text-sm">{t('community.empty_subtitle') || 'Comece compartilhando algo com a comunidade!'}</p>
          </div>
        ) : (
          posts.map((post, idx) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              index={idx}
              isLiked={likedPostsSet.has(post.id)}
              isExpanded={expandedCommentsSet.has(post.id)}
              postComments={comments[post.id]}
              likedCommentsSet={likedCommentsSet}
              currentUserId={user.id}
              isAdmin={isAdmin}
              isImportMode={isImportMode}
              showCommentAvatar={showCommentAvatar}
              commentAvatarUrl={commentAvatarUrl}
              commentPlaceholder={commentPlaceholder}
              commentDisabled={commentDisabled}
              replyingToLabel={replyingToLabel}
              replyLabel={replyLabel}
              formatDate={formatDate}
              onPreviewAvatar={handlePreviewAvatar}
              onPreviewPostImage={handlePreviewPostImage}
              onEditPost={handleStartEditPost}
              onDeletePost={handleRequestDeletePost}
              onLikePost={handleLike}
              onDirectLikePost={handlePostLikesDirect}
              onToggleComments={toggleComments}
              onReplyPost={handleReplyPost}
              onAddComment={handleAddComment}
              onToggleLikeComment={handleLikeCommentToggle}
              onDirectLikeComment={handleLikeComment}
              onEditComment={handleStartEditComment}
              onDeleteComment={handleRequestDeleteComment}
            />
          ))
        )}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center pb-8">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-bold text-gray-300 hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('community.loading_posts') || 'Carregando publicações...'}
              </>
            ) : (
              t('community.load_more') || 'Ver mais publicações'
            )}
          </button>
        </div>
      )}

      {/* Full-screen Image Viewer / Avatar Viewer */}
      {createPortal(
        <AnimatePresence>
          {selectedPostImage && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex p-4 items-center justify-center overflow-hidden"
              onClick={() => {
                setSelectedPostImage(null);
                setPreviewUserName(null);
                setIsAvatarPreview(false);
              }}
            >
              {isAvatarPreview ? (
                <m.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="relative flex flex-col items-center max-w-xs sm:max-w-sm w-full p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    className="absolute -top-12 right-4 text-white/60 hover:text-white p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all active:scale-95 shadow-lg"
                    onClick={() => {
                      setSelectedPostImage(null);
                      setPreviewUserName(null);
                      setIsAvatarPreview(false);
                    }}
                  >
                    <X size={20} />
                  </button>
                  
                  {previewUserName && (
                    <div className="w-full text-center mb-6 px-4">
                      <h3 className="text-lg font-bold text-white tracking-tight drop-shadow-md">
                        {previewUserName}
                      </h3>
                    </div>
                  )}

                  <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden border-[6px] border-white/25 bg-zinc-950 shadow-2xl flex items-center justify-center transition-all">
                    {selectedPostImage && selectedPostImage.trim() ? (
                      <img
                        src={selectedPostImage.trim()}
                        className="w-full h-full object-cover"
                        alt={previewUserName || "Perfil"}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                </m.div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <button 
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/70 hover:text-white p-2 bg-white/10 rounded-full backdrop-blur-md z-[10000] hover:bg-white/20 transition-all active:scale-95"
                    onClick={() => {
                      setSelectedPostImage(null);
                      setPreviewUserName(null);
                      setIsAvatarPreview(false);
                    }}
                  >
                    <X size={24} />
                  </button>
                  <m.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="max-w-4xl w-full flex items-center justify-center p-4"
                  >
                    {selectedPostImage && selectedPostImage.trim() ? (
                      <img
                        src={selectedPostImage.trim()}
                        className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border-4 border-white/25"
                        alt="Full screen"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </m.div>
                </div>
              )}
            </m.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {createPortal(
        <AnimatePresence>
          {(postToDelete || commentToDelete) && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => { setPostToDelete(null); setCommentToDelete(null); }}
            >
              <m.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-xl font-bold text-center mb-2">
                  {postToDelete ? t('community.delete_post_confirm') || 'Excluir Publicação?' : t('community.delete_comment_confirm') || 'Excluir Comentário?'}
                </h3>
                <p className="text-gray-400 text-center text-sm mb-6">
                  {postToDelete ? (t('community.delete_post_desc') || 'Esta ação não pode ser desfeita. A publicação e sua imagem serão removidas permanentemente.') : (t('community.delete_comment_desc') || 'O comentário será removido permanentemente.')}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setPostToDelete(null); setCommentToDelete(null); }}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all active:scale-95"
                  >
                    {t('global.cancel') || 'Cancelar'}
                  </button>
                  <button
                    onClick={postToDelete ? handleDeletePost : handleDeleteComment}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all active:scale-95"
                  >
                    {t('global.delete') || 'Excluir'}
                  </button>
                </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Edit Post Modal */}
      {createPortal(
        <AnimatePresence>
          {editingPost && (
            <m.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setEditingPost(null)}
            >
              <m.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                  <h3 className="font-bold text-white">{t('community.edit_post') || 'Editar Publicação'}</h3>
                  <button onClick={() => setEditingPost(null)} className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"><X size={20} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <textarea 
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className={`w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-${isImportMode ? 'blue-500' : 'primary'} outline-none min-h-[150px] text-sm`}
                    placeholder={t('community.edit_placeholder') || "Conteúdo do post..."}
                  />
                  <button 
                    onClick={handleUpdatePost}
                    className={`w-full ${isImportMode ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 'bg-primary hover:bg-primary-hover shadow-primary/20'} text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-98`}
                  >
                    {t('profile.save_changes') || 'Salvar Alterações'}
                  </button>
                </div>
              </m.div>
            </m.div>
          )}

          {editingComment && (
            <m.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setEditingComment(null)}
            >
              <m.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Edit3 size={18} className={isImportMode ? 'text-blue-500' : 'text-primary'} />
                    {t('community.edit_comment') || 'Editar Comentário'}
                  </h3>
                  <button onClick={() => setEditingComment(null)} className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <textarea 
                    value={editCommentContent}
                    onChange={e => setEditCommentContent(e.target.value)}
                    className={`w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-${isImportMode ? 'blue-500' : 'primary'} outline-none min-h-[130px] text-sm resize-y`}
                    placeholder={t('community.edit_comment_placeholder') || "Texto do comentário..."}
                    autoFocus
                  />
                  <div className="flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => setEditingComment(null)}
                      className="w-1/3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold py-3.5 rounded-xl transition-all text-xs uppercase tracking-wider"
                    >
                      {t('global.cancel') || 'Cancelar'}
                    </button>
                    <button 
                      type="button"
                      onClick={handleUpdateComment}
                      className={`flex-1 ${isImportMode ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 'bg-primary hover:bg-primary-hover shadow-primary/20'} text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-98 text-xs uppercase tracking-wider flex items-center justify-center gap-2`}
                    >
                      <Check size={16} />
                      {t('profile.save_changes') || 'Salvar Alterações'}
                    </button>
                  </div>
                </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
