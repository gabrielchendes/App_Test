import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Notification } from '../lib/supabase';
import { Bell, X, Check, Info } from 'lucide-react';
import { GlowingSpinner } from './GlowingSpinner';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useI18n } from '../contexts/I18nContext';
import { safeFetch } from '../lib/utils';
import { showToast } from '../lib/customToast';

interface NotificationBellProps {
  user: User;
}

/**
 * Formats timestamps strictly in US English standard (MMM d, yyyy, h:mm a)
 * while ensuring UTC timestamps are accurately converted to local time.
 */
function formatUSDateTime(val: string | Date | number | undefined | null): string {
  if (!val) return '';
  try {
    let date: Date;
    if (val instanceof Date) {
      date = val;
    } else if (typeof val === 'number') {
      date = new Date(val);
    } else {
      let str = String(val).trim();
      if (str.includes(' ') && !str.includes('T')) {
        str = str.replace(' ', 'T');
      }
      if (!str.endsWith('Z') && !str.includes('+') && !/-\d\d:\d\d$/.test(str)) {
        str = str + 'Z';
      }
      date = new Date(str);
    }
    if (isNaN(date.getTime())) {
      date = new Date(val);
    }
    if (isNaN(date.getTime())) return String(val);

    return format(date, 'MMM d, yyyy, h:mm a', { locale: enUS });
  } catch (e) {
    return String(val);
  }
}

export default function NotificationBell({ user }: NotificationBellProps) {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      // 1. Fetch from Supabase directly
      let sbNotifs: any[] = [];
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, user_id, broadcast_id, title, body, message, is_read, read, read_at, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (!error && Array.isArray(data)) {
          sbNotifs = data;
        } else if (error) {
          // Retry without ORDER BY to bypass compound index scans on busy tables
          const { data: fallbackData } = await supabase
            .from('notifications')
            .select('id, user_id, broadcast_id, title, body, message, is_read, read, read_at, created_at')
            .eq('user_id', user.id)
            .limit(50);
          if (Array.isArray(fallbackData)) {
            sbNotifs = fallbackData;
          }
        }
      } catch (sbErr) {
        console.warn('[NotificationBell] Supabase fetch notice:', sbErr);
      }

      // 2. Fetch from Central API endpoint with session auth
      let apiNotifs: any[] = [];
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await safeFetch(
          `/api/v1/notifications?action=user-notifications&userId=${encodeURIComponent(user.id)}`,
          { headers }
        );
        if (res && res.success && Array.isArray(res.notifications)) {
          apiNotifs = res.notifications;
        }
      } catch (apiErr) {
        console.warn('[NotificationBell] API fetch notice:', apiErr);
      }

      // 3. Merge & Deduplicate by ID
      const notifMap = new Map<string, any>();
      [...apiNotifs, ...sbNotifs].forEach(n => {
        if (!n || !n.id) return;
        const isRead = Boolean(n.is_read || n.read || n.read_at);
        const existing = notifMap.get(n.id);
        if (existing) {
          notifMap.set(n.id, {
            ...existing,
            ...n,
            is_read: existing.is_read || isRead,
            read: existing.read || isRead,
            body: n.body || n.message || existing.body || existing.message || '',
            message: n.body || n.message || existing.body || existing.message || ''
          });
        } else {
          notifMap.set(n.id, {
            ...n,
            is_read: isRead,
            read: isRead,
            body: n.body || n.message || '',
            message: n.body || n.message || ''
          });
        }
      });

      const mergedList = Array.from(notifMap.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      setNotifications(mergedList);
      setUnreadCount(mergedList.filter(n => !n.is_read && !n.read).length);
    } catch (error) {
      console.warn('[NotificationBell] Notice fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchNotifications();

    // Periodic polling every 20s to ensure internal notifications appear reliably
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      fetchNotifications();
    }, 20000);

    // Real-time subscription
    const channelId = Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(`user_notifications_${channelId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload: any) => {
          fetchNotifications();
          if (payload.eventType === 'INSERT' && payload.new) {
            const notif = payload.new;
            const title = notif.title || 'New Notice';
            const body = notif.body || notif.message || '';
            showToast.info(title, {
              description: body,
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    // Click outside to close
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user.id, fetchNotifications]);

  // Refresh whenever user opens the dropdown
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const markAsRead = async (id: string) => {
    const now = new Date().toISOString();
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      // 1. Update in Supabase
      supabase
        .from('notifications')
        .update({ is_read: true, read: true, read_at: now })
        .eq('id', id)
        .then(() => {})
        .catch(err => console.warn('[NotificationBell] Supabase markAsRead notice:', err));

      // 2. Update in centralized API
      safeFetch('/api/v1/notifications?action=mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, userId: user.id })
      }).catch(err => console.warn('[NotificationBell] Central API markAsRead notice:', err));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const now = new Date().toISOString();
    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read: true })));
    setUnreadCount(0);

    try {
      // 1. Update in Supabase
      supabase
        .from('notifications')
        .update({ is_read: true, read: true, read_at: now })
        .eq('user_id', user.id)
        .or('is_read.eq.false,is_read.is.null')
        .then(() => {})
        .catch(err => console.warn('[NotificationBell] Supabase markAllAsRead notice:', err));

      // 2. Update in centralized API
      safeFetch('/api/v1/notifications?action=mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).catch(err => console.warn('[NotificationBell] Central API markAllAsRead notice:', err));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-all active:scale-95"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={28} className={unreadCount > 0 ? "text-primary animate-pulse" : ""} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-white text-[12px] font-black px-1.5 rounded-full min-w-[22px] h-[22px] flex items-center justify-center border-2 border-zinc-900 shadow-lg animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] md:hidden"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 360 }}
              style={{ boxSizing: 'border-box' }}
              className="relative fixed inset-x-3 sm:inset-x-6 top-[max(4.75rem,calc(env(safe-area-inset-top)+4rem))] md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 w-auto md:w-96 bg-[#0e1017]/98 backdrop-blur-2xl border-[3px] border-amber-400 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.55),0_0_15px_rgba(251,191,36,0.75),0_0_60px_rgba(245,158,11,0.35)] overflow-hidden z-[1000] max-h-[calc(80vh-env(safe-area-inset-top))] flex flex-col"
            >
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                    <Bell size={15} />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-white tracking-tight">
                    {t('notifications.title') && t('notifications.title') !== 'Avisos & Notificações' ? t('notifications.title') : 'Notices & Announcements'}
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-[10px] text-amber-300 hover:text-amber-200 font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]"
                    >
                      {t('notifications.clear_all') && t('notifications.clear_all') !== 'Marcar lidas' ? t('notifications.clear_all') : 'Mark all read'}
                    </button>
                  )}
                  <button 
                    onClick={() => setIsOpen(false)} 
                    className="w-7 h-7 flex items-center justify-center text-amber-300 hover:text-white rounded-full bg-[#13151f]/90 hover:bg-[#1c2030] border border-amber-400/60 hover:border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)] hover:shadow-[0_0_14px_rgba(251,191,36,0.6)] active:scale-95 transition-all cursor-pointer"
                    aria-label="Close notice"
                    title="Close notice"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <GlowingSpinner size="md" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-500 px-6 text-center">
                    <div className="w-14 h-14 bg-amber-400/5 rounded-2xl flex items-center justify-center mb-3 border border-amber-400/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                      <Bell size={24} className="text-amber-400/40" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-200">{t('notifications.empty') && t('notifications.empty') !== 'Tudo em dia!' ? t('notifications.empty') : 'All caught up!'}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{t('notifications.empty_desc') && t('notifications.empty_desc') !== 'Nenhum novo aviso no momento.' ? t('notifications.empty_desc') : 'No new notices at this time.'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        onClick={() => {
                          if (!notification.is_read) {
                            markAsRead(notification.id);
                          }
                          const targetUrl = (notification as any).data?.url || (notification as any).url;
                          if (targetUrl) {
                            setIsOpen(false);
                            if (targetUrl.startsWith('/')) {
                              window.location.href = targetUrl;
                            }
                          }
                        }}
                        className={`p-4 transition-all hover:bg-white/[0.04] relative group cursor-pointer ${!notification.is_read ? 'bg-amber-500/[0.06]' : ''}`}
                      >
                        <div className="flex justify-between items-start gap-3 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {!notification.is_read && (
                              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                            )}
                            <h4 className={`text-xs sm:text-[13px] font-semibold leading-snug truncate ${!notification.is_read ? 'text-white' : 'text-zinc-400'}`}>
                              {notification.title}
                            </h4>
                          </div>
                          {!notification.is_read && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="text-[10px] text-amber-300 hover:text-white px-2 py-0.5 rounded-md hover:bg-amber-400/10 transition-colors shrink-0 font-medium"
                              title={t('notifications.mark_as_read') || 'Mark as read'}
                            >
                              {t('notifications.mark_as_read') && t('notifications.mark_as_read') !== 'marcar como lida' ? t('notifications.mark_as_read') : 'Mark read'}
                            </button>
                          )}
                        </div>
                        <p className={`text-xs leading-relaxed mb-2 line-clamp-2 ${!notification.is_read ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          {notification.body || (notification as any).message}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-normal">
                          <Info size={11} className="shrink-0 opacity-60" />
                          <span>{formatUSDateTime(notification.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-3.5 bg-amber-400/[0.03] border-t border-amber-400/20 text-center">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2.5 text-xs text-amber-200/80 hover:text-white font-bold uppercase tracking-[0.18em] transition-all cursor-pointer rounded-xl hover:bg-amber-400/10"
                  title="Close notice"
                  aria-label="Close notice"
                >
                  Close notice
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
