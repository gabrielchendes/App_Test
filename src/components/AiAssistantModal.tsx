import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, User as UserIcon, RefreshCw, Copy, Check, AlertCircle, Loader2, GraduationCap, ArrowLeft, Clock, Lock, ExternalLink, ShoppingBag, Sparkles, Infinity as InfinityIcon, Info, HelpCircle } from 'lucide-react';
import { GlowingSpinner } from './GlowingSpinner';
import { toast } from '../lib/customToast';
import { useSettings } from '../contexts/SettingsContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import HtmlAppViewer from './HtmlAppViewer';
import { DEFAULT_UNLIMITED_INFO_HTML } from '../constants/defaultUnlimitedHtml';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
  retryQuery?: string;
}

interface AiAssistantModalProps {
  userId?: string;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  isOpen?: boolean;
  onClose?: () => void;
  hasUnlimitedAi?: boolean;
}

const DEFAULT_AVATAR = 'https://fhnmpltilhongdofnzbj.supabase.co/storage/v1/object/public/contents/Victoria.png';

const DEFAULT_QUICK_PROMPTS = [
  'How to improve communication with my partner?',
  'Ways to rebuild trust after a disagreement',
  'How to set healthy emotional boundaries',
  'Navigating long-distance relationship challenges'
];

export default function AiAssistantModal({ userId, userEmail, userName, userAvatar, isOpen: externalIsOpen, onClose: externalOnClose, hasUnlimitedAi }: AiAssistantModalProps) {
  const { settings } = useSettings();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  // Custom AI Expert settings from custom_texts
  const isAiEnabled = settings?.custom_texts?.['ai_expert.enabled'] !== 'false';
  const isLimitEnabled = settings?.custom_texts?.['ai_expert.enable_message_limit'] === 'true';
  const maxMessages = Math.max(1, parseInt(settings?.custom_texts?.['ai_expert.max_messages_count'] || '3', 10));
  const frequency = settings?.custom_texts?.['ai_expert.limit_frequency'] || 'daily';
  
  const limitTitle = settings?.custom_texts?.['ai_expert.limit_reached_title'] || 'Message Limit Reached';
  const limitReachedMsg = settings?.custom_texts?.['ai_expert.limit_reached_message'] || 'You have reached your message limit for this period. Upgrade your plan or try again later.';
  const buyMoreButtonText = settings?.custom_texts?.['ai_expert.buy_more_button_text'] || 'Upgrade to Unlimited Monthly';
  const buyMoreUrl = settings?.custom_texts?.['ai_expert.buy_more_url'] || '';
  const benefit1 = settings?.custom_texts?.['ai_expert.benefit_1'] || 'Unlimited messages 24 hours a day, 7 days a week';
  const benefit2 = settings?.custom_texts?.['ai_expert.benefit_2'] || 'Instant access with zero commitments';
  const errorMessage = settings?.custom_texts?.['ai_expert.error_message'] || `${settings?.custom_texts?.['ai_expert.name'] || 'Victoria'} is currently assisting other students and cannot reply right now. Please ask again in just a moment!`;
  const limitToast = settings?.custom_texts?.['ai_expert.limit_reached_toast'] || 'You have reached your message limit for this period.';
  const copiedToast = settings?.custom_texts?.['ai_expert.copied_toast'] || 'Response copied!';
  const inputDisabledPlaceholder = settings?.custom_texts?.['ai_expert.input_disabled_placeholder'] || 'Message limit reached for this period.';

  // Unlimited Explanation HTML Modal state and texts
  const [showUnlimitedInfoModal, setShowUnlimitedInfoModal] = useState(false);
  const customUnlimitedHtml = settings?.custom_texts?.['ai_expert.unlimited_html'];
  const resolvedUnlimitedHtml = (customUnlimitedHtml && customUnlimitedHtml.trim())
    ? customUnlimitedHtml.trim()
    : DEFAULT_UNLIMITED_INFO_HTML;
  const unlimitedModalTitle = settings?.custom_texts?.['ai_expert.unlimited_modal_title'] || `How Unlimited Works • Ask ${settings?.custom_texts?.['ai_expert.name'] || 'Victoria'}`;
  const unlimitedBtnLabel = settings?.custom_texts?.['ai_expert.unlimited_btn_label'] || 'Unlimited';
  const unlimitedBtnTooltip = settings?.custom_texts?.['ai_expert.unlimited_btn_tooltip'] || 'Get Unlimited Messages';
  const learnMoreButtonText = settings?.custom_texts?.['ai_expert.learn_more_button_text'] || 'How Unlimited Works • Learn More';

  // Listen for iframe checkout messages
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'purchase') {
        if (buyMoreUrl) {
          window.open(buyMoreUrl, '_blank');
        }
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [buyMoreUrl]);

  const expertName = settings?.custom_texts?.['ai_expert.name'] || 'Victoria';
  const expertSubtitle = settings?.custom_texts?.['ai_expert.subtitle'] || 'Psychologist & Relationship Expert';
  const expertAvatar = (settings?.custom_texts?.['ai_expert.avatar_url'] && settings.custom_texts['ai_expert.avatar_url'].trim())
    ? settings.custom_texts['ai_expert.avatar_url'].trim()
    : DEFAULT_AVATAR;
  const customWelcome = settings?.custom_texts?.['ai_expert.welcome_message'];
  const typingText = settings?.custom_texts?.['ai_expert.typing_indicator'] || `${expertName} is typing...`;
  const inputPlaceholder = settings?.custom_texts?.['ai_expert.input_placeholder'] || `Ask ${expertName}...`;
  const enableQuickPrompts = settings?.custom_texts?.['ai_expert.enable_quick_prompts'] === 'true';
  const systemPromptContext = settings?.custom_texts?.['ai_expert.system_prompt'] || '';

  const quickPromptsRaw = settings?.custom_texts?.['ai_expert.quick_prompts'];
  const quickPrompts = quickPromptsRaw && quickPromptsRaw.trim()
    ? quickPromptsRaw.split('\n').map(p => p.trim()).filter(Boolean)
    : DEFAULT_QUICK_PROMPTS;

  const defaultWelcomeText = customWelcome && customWelcome.trim()
    ? customWelcome
    : `Hello${userName ? `, ${userName}` : ''}! ❤️ I’m Victoria Hayes, your Relationship Expert.\n\nWhatever is happening between you and him, you don’t have to figure it out alone.\n\nTell me what’s going on — what he said, what he did, how things have changed, or what you’re hoping will happen.\n\nI’m here to help with whatever you need, and together, we’ll figure out what’s happening and what to do next. 💕`;

  const resetChatWelcome = settings?.custom_texts?.['ai_expert.reset_chat_welcome'] || `Chat reset! ❤️ I'm ${expertName}, how can I help you now?`;

  // Admin-configurable response timing settings:
  // Checkbox: responder o mais rápido possível (instantâneo)
  const isFastResponseMode = (settings?.custom_texts?.['ai_expert.fast_response_mode'] ?? 'false') === 'true';
  // Target response times in seconds (Defaults: short=9s, medium=16s, long=30s)
  const targetSecShort = Math.max(1, parseInt(settings?.custom_texts?.['ai_expert.typing_speed_short'] || '9', 10) || 9);
  const targetSecMedium = Math.max(1, parseInt(settings?.custom_texts?.['ai_expert.typing_speed_medium'] || '16', 10) || 16);
  const targetSecLong = Math.max(1, parseInt(settings?.custom_texts?.['ai_expert.typing_speed_long'] || '30', 10) || 30);

  // Message Limit Storage and Checks per User (Synced with Supabase + LocalStorage fallback)
  const getStorageKey = (): string => {
    if (userId && userId.trim()) return `ai_expert_sent_messages_history_${userId.trim()}`;
    if (userName && userName.trim()) return `ai_expert_sent_messages_history_${userName.trim()}`;
    return 'ai_expert_sent_messages_history_guest';
  };

  const getSentMessageTimestamps = (): number[] => {
    try {
      const key = getStorageKey();
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const recordSentTimestamp = (): number => {
    const ts = Date.now();
    try {
      const key = getStorageKey();
      const list = getSentMessageTimestamps();
      list.push(ts);
      localStorage.setItem(key, JSON.stringify(list));

      if (isSupabaseConfigured && supabase && userId && userId.trim()) {
        supabase
          .from('ai_message_logs')
          .insert({
            user_id: userId.trim(),
            created_at: new Date(ts).toISOString()
          })
          .then(({ error }) => {
            if (error) {
              console.warn('[AI Expert] Supabase ai_message_logs insert warning:', error.message);
            }
          })
          .catch((err) => {
            console.warn('[AI Expert] Supabase ai_message_logs catch:', err);
          });
      }
    } catch (e) {
      console.error(e);
    }
    return ts;
  };

  const removeSentTimestamp = (ts: number) => {
    try {
      const key = getStorageKey();
      const list = getSentMessageTimestamps().filter(t => t !== ts);
      localStorage.setItem(key, JSON.stringify(list));

      if (isSupabaseConfigured && supabase && userId && userId.trim()) {
        const isoString = new Date(ts).toISOString();
        supabase
          .from('ai_message_logs')
          .delete()
          .eq('user_id', userId.trim())
          .eq('created_at', isoString)
          .then(() => {})
          .catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [sentTimestamps, setSentTimestamps] = useState<number[]>(getSentMessageTimestamps);

  // VIP Unlimited Status Check
  const [isUserUnlimited, setIsUserUnlimited] = useState<boolean>(() => {
    if (hasUnlimitedAi) return true;
    return false;
  });
  const [isCheckingVip, setIsCheckingVip] = useState<boolean>(false);

  useEffect(() => {
    if (userId && isSupabaseConfigured && supabase) {
      checkUserVipStatus(false);
    } else if (hasUnlimitedAi) {
      setIsUserUnlimited(true);
    } else {
      setIsUserUnlimited(false);
    }
  }, [hasUnlimitedAi, userId]);

  const checkUserVipStatus = async (showToastOnCheck = false) => {
    if (!userId || !userId.trim()) {
      setIsUserUnlimited(false);
      if (showToastOnCheck) toast.info('No account detected. Unlock your VIP access!');
      return;
    }
    const cleanId = userId.trim();
    if (showToastOnCheck) setIsCheckingVip(true);

    try {
      // Query Supabase profiles & purchases table for live status
      if (isSupabaseConfigured && supabase) {
        const isUUID = (str: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

        let profileData: { id?: string; has_unlimited_ai?: boolean; is_admin?: boolean; email?: string } | null = null;

        if (isUUID(cleanId)) {
          const { data } = await supabase
            .from('profiles')
            .select('id, has_unlimited_ai, is_admin, email')
            .eq('id', cleanId)
            .maybeSingle();
          profileData = data;
        }

        if (!profileData && (cleanId.includes('@') || userEmail)) {
          const emailToFind = (userEmail || cleanId).toLowerCase();
          const { data } = await supabase
            .from('profiles')
            .select('id, has_unlimited_ai, is_admin, email')
            .eq('email', emailToFind)
            .maybeSingle();
          profileData = data;
        }

        let isUnlimited = false;

        if (profileData) {
          if (profileData.has_unlimited_ai === false) {
            isUnlimited = false;
          } else if (profileData.has_unlimited_ai === true) {
            isUnlimited = true;
          } else {
            let q = supabase.from('purchases').select('id');
            const targetUid = isUUID(cleanId) ? cleanId : (profileData.id && isUUID(profileData.id) ? profileData.id : null);
            if (targetUid) {
              q = q.eq('user_id', targetUid);
            } else {
              q = q.eq('user_id', cleanId);
            }
            const { data: pRes } = await q.in('product_id', ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited']).maybeSingle();
            isUnlimited = !!pRes;
          }
        } else {
          isUnlimited = Boolean(hasUnlimitedAi);
        }

        setIsUserUnlimited(isUnlimited);

        try {
          localStorage.removeItem(`unlimited_ai_user_${cleanId}`);
          if (profileData?.email) {
            localStorage.removeItem(`unlimited_ai_user_${profileData.email}`);
          }
        } catch (e) {}

        if (showToastOnCheck) {
          if (isUnlimited) {
            toast.success('VIP Unlimited access verified successfully! 🎉 Enjoy unlimited conversations.');
          } else {
            toast.info('No active VIP subscription found at this time.');
          }
        }
      } else {
        setIsUserUnlimited(hasUnlimitedAi || false);
      }
    } catch (err) {
      console.warn('VIP Check Note:', err);
    } finally {
      if (showToastOnCheck) setIsCheckingVip(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const syncLogs = async () => {
      // 1. Immediately load local storage cache for instant rendering
      const localList = getSentMessageTimestamps();
      setSentTimestamps(localList);

      // 2. If user is logged in & Supabase is configured, fetch real records from database
      if (isOpen && isSupabaseConfigured && supabase && userId && userId.trim()) {
        try {
          const { data, error } = await supabase
            .from('ai_message_logs')
            .select('created_at')
            .eq('user_id', userId.trim());

          if (!error && data && Array.isArray(data)) {
            const dbTimestamps = data
              .map((item: { created_at: string }) => new Date(item.created_at).getTime())
              .filter(t => !isNaN(t));

            if (isMounted) {
              setSentTimestamps(dbTimestamps);
              // Save to localStorage as fallback cache
              try {
                const key = getStorageKey();
                localStorage.setItem(key, JSON.stringify(dbTimestamps));
              } catch (e) {}
            }
          }
        } catch (err) {
          console.warn('[AI Expert] Supabase logs sync note:', err);
        }
      }
    };

    if (isOpen) {
      syncLogs();
      if (userId) {
        checkUserVipStatus(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, userName]);

  const getMessagesSentInWindow = (timestamps: number[], freq: string): number => {
    const now = new Date();
    
    if (freq === 'daily') {
      // Calendar day reset (resets at 00:00:00 AM local time on the next day)
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return timestamps.filter(ts => ts >= startOfToday).length;
    } else if (freq === 'weekly') {
      // Calendar week reset (resets at 00:00:00 AM on Monday of current week)
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff).getTime();
      return timestamps.filter(ts => ts >= startOfWeek).length;
    } else if (freq === 'monthly') {
      // Calendar month reset (resets at 00:00:00 AM on the 1st day of current month)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return timestamps.filter(ts => ts >= startOfMonth).length;
    } else if (freq === 'lifetime') {
      return timestamps.length;
    }

    // Default to daily calendar reset
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return timestamps.filter(ts => ts >= startOfToday).length;
  };

  const messagesSentCount = getMessagesSentInWindow(sentTimestamps, frequency);
  const remainingMessages = Math.max(0, maxMessages - messagesSentCount);
  const isLimitReached = !isUserUnlimited && isLimitEnabled && messagesSentCount >= maxMessages;

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return 'per day';
      case 'weekly': return 'per week';
      case 'monthly': return 'per month';
      case 'lifetime': return 'total';
      default: return 'per day';
    }
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: defaultWelcomeText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  // Sync welcome message if settings change and conversation hasn't started
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'welcome') {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: defaultWelcomeText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    }
  }, [expertName, customWelcome, userName]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const typingAbortRef = useRef<boolean>(false);
  const activeFetchAbortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleClose = React.useCallback(() => {
    typingAbortRef.current = true;
    if (activeFetchAbortRef.current) {
      try {
        activeFetchAbortRef.current.abort();
      } catch (_) {}
      activeFetchAbortRef.current = null;
    }
    setLoading(false);
    setStatusText('');
    if (externalOnClose) {
      externalOnClose();
    }
    setInternalIsOpen(false);
  }, [externalOnClose]);

  useEffect(() => {
    return () => {
      typingAbortRef.current = true;
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, loading, statusText, isOpen]);

  // Simulates a genuine human typing and reflection delay that scales realistically with response length
  const simulateHumanTypingDelay = async (delayMs: number, name: string) => {
    if (delayMs <= 0) return;

    // Build realistic stages of human contemplation & typing in English
    const stages: { at: number; text: string }[] = [];
    if (delayMs > 20000) {
      stages.push({ at: 0, text: `${name} is reading your situation...` });
      stages.push({ at: Math.floor(delayMs * 0.15), text: `${name} is thinking carefully about your question...` });
      stages.push({ at: Math.floor(delayMs * 0.35), text: `${name} is typing...` });
      stages.push({ at: Math.floor(delayMs * 0.65), text: `${name} is writing your detailed guidance...` });
      stages.push({ at: Math.floor(delayMs * 0.88), text: `Almost ready, ${name} is finalizing her advice...` });
    } else if (delayMs > 10000) {
      stages.push({ at: 0, text: `${name} is reading your message...` });
      stages.push({ at: Math.floor(delayMs * 0.25), text: `${name} is typing...` });
      stages.push({ at: Math.floor(delayMs * 0.70), text: `${name} is writing personal advice for you...` });
      stages.push({ at: Math.floor(delayMs * 0.90), text: `${name} is reviewing her message...` });
    } else if (delayMs > 5000) {
      stages.push({ at: 0, text: `${name} is reading your message...` });
      stages.push({ at: Math.floor(delayMs * 0.35), text: `${name} is typing...` });
      stages.push({ at: Math.floor(delayMs * 0.85), text: `${name} is finishing her reply...` });
    } else {
      stages.push({ at: 0, text: `${name} is typing...` });
      stages.push({ at: Math.floor(delayMs * 0.65), text: `${name} is finishing her reply...` });
    }

    const startTime = Date.now();
    for (let i = 0; i < stages.length; i++) {
      if (typingAbortRef.current) break;
      const stage = stages[i];
      const nextTime = i < stages.length - 1 ? stages[i + 1].at : delayMs;
      setStatusText(stage.text);
      scrollToBottom();

      const timeToWait = Math.max(0, nextTime - (Date.now() - startTime));
      if (timeToWait > 0) {
        const sliceEndTime = Date.now() + timeToWait;
        while (Date.now() < sliceEndTime) {
          if (typingAbortRef.current) break;
          await new Promise(r => setTimeout(r, Math.min(200, sliceEndTime - Date.now())));
        }
      }
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    typingAbortRef.current = false;
    const requestStartTime = Date.now();

    if (isLimitReached) {
      toast.error(limitToast);
      return;
    }

    // If retrying from a previous error card, clean up the trailing error card
    setMessages(prev => {
      if (prev.length > 0 && prev[prev.length - 1].isError && prev[prev.length - 1].retryQuery === query) {
        return prev.slice(0, -1);
      }
      return prev;
    });

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // If retrying, check if user message was already rendered
    setMessages(prev => {
      const lastUserMsg = [...prev].reverse().find(m => m.role === 'user');
      if (textToSend && lastUserMsg && lastUserMsg.content === query) {
        return prev;
      }
      return [...prev, userMsg];
    });

    if (!textToSend) {
      setInput('');
    }
    setLoading(true);
    setStatusText(typingText);

    // Optimized history for lightning-fast generation under Vercel serverless budget
    const validHistory = messages.filter(m => !m.isError);
    const updatedHistory = [...validHistory, userMsg];
    const historyForApi = updatedHistory.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }));

    const MAX_CLIENT_ATTEMPTS = 3;
    let finalSuccessReply: string | null = null;
    let finalErrorMessage: string = errorMessage;

    for (let attempt = 1; attempt <= MAX_CLIENT_ATTEMPTS; attempt++) {
      if (typingAbortRef.current) {
        setLoading(false);
        return;
      }

      try {
        if (attempt === 1) {
          setStatusText(`${expertName} is reading your message and writing...`);
        } else if (attempt === 2) {
          setStatusText(`${expertName} is preparing detailed guidance for you...`);
        } else if (attempt === 3) {
          setStatusText(`${expertName} is finalizing your personal advice...`);
        }

        const controller = new AbortController();
        activeFetchAbortRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), 16000);

        let res: Response;
        try {
          res = await fetch('/api/v1/ai-chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({
              action: 'ai-chat',
              messages: historyForApi,
              userContext: { userName, userId, email: userEmail },
              customSystemPrompt: systemPromptContext || undefined,
              expertName: expertName || undefined,
              userId: userId || undefined,
              messagesSentCount,
              clientAttempt: attempt,
            })
          });
        } finally {
          clearTimeout(timeoutId);
          activeFetchAbortRef.current = null;
        }

        if (typingAbortRef.current) {
          setLoading(false);
          return;
        }

        const responseText = await res.text();
        let data: any = {};
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          data = {};
        }

        // Limit reached check
        if (res.status === 403 || data.error === 'VIP_REQUIRED' || data.isLimitReached || (data.error && data.error.code === 'VIP_REQUIRED')) {
          setIsUserUnlimited(false);
          const limitMsg = typeof data.message === 'string' ? data.message : (data.error?.message || limitToast);
          toast.error(limitMsg);
          setLoading(false);
          return;
        }

        // Check if this is a genuine successful AI response (NOT an error, high demand, or retry fallback)
        const isGenuineSuccess = 
          res.ok && 
          data.success === true && 
          !data.isHighDemand && 
          !data.retryable && 
          !data.isError && 
          typeof data.reply === 'string' && 
          data.reply.trim().length > 0;

        if (isGenuineSuccess) {
          finalSuccessReply = data.reply;
          break; // Succeeded! Exit retry loop
        }

        const isRetryableStatus = res.status === 503 || res.status === 504 || res.status === 502 || res.status === 500 || res.status === 429;
        const isExplicitRetryable = data.retryable === true || data.isHighDemand === true || data.success === false;
        const rawMsg = (typeof data.error === 'string' ? data.error : data.message) || responseText || '';
        const isBusySignal = rawMsg.toLowerCase().includes('busy') || 
                             rawMsg.toLowerCase().includes('demand') || 
                             rawMsg.toLowerCase().includes('conversation') || 
                             rawMsg.toLowerCase().includes('consultation') || 
                             rawMsg.toLowerCase().includes('student') || 
                             rawMsg.toLowerCase().includes('timeout') || 
                             rawMsg.toLowerCase().includes('timed out') || 
                             rawMsg.toLowerCase().includes('rate limit');

        if (isRetryableStatus || isExplicitRetryable || isBusySignal) {
          finalErrorMessage = `${expertName} is currently helping other students. Please try again in a few moments.`;
          if (attempt < MAX_CLIENT_ATTEMPTS) {
            const delayMs = 1200 * attempt + Math.floor(Math.random() * 400);
            console.warn(`[Ask Victoria] Attempt ${attempt}/${MAX_CLIENT_ATTEMPTS} busy in consultation. Retrying in ${delayMs}ms...`);
            await new Promise(r => setTimeout(r, delayMs));
            if (typingAbortRef.current) {
              setLoading(false);
              return;
            }
            continue;
          }
        } else {
          finalErrorMessage = `${expertName} is currently assisting other students. Please try asking again shortly.`;
          break;
        }
      } catch (netErr: any) {
        if (typingAbortRef.current) {
          setLoading(false);
          return;
        }
        console.warn(`[Ask Victoria] Attempt ${attempt}/${MAX_CLIENT_ATTEMPTS} timeout/retry:`, netErr?.name || netErr?.message);
        finalErrorMessage = `${expertName} is currently assisting other students. Please try asking again shortly.`;

        if (attempt < MAX_CLIENT_ATTEMPTS) {
          const delayMs = 1200 * attempt + Math.floor(Math.random() * 400);
          await new Promise(r => setTimeout(r, delayMs));
          if (typingAbortRef.current) {
            setLoading(false);
            return;
          }
          continue;
        }
      }
    }

    if (typingAbortRef.current) {
      setLoading(false);
      return;
    }

    if (finalSuccessReply) {
      const cleanReply = finalSuccessReply.replace(/\*\*/g, '');
      const totalChars = cleanReply.length;
      const networkDuration = Date.now() - requestStartTime;

      if (!isFastResponseMode) {
        // Calculate target duration using admin-configured values:
        // - Respostas curtas (~250 caracteres): targetSecShort (padrão: 9s)
        // - Respostas médias (~700 caracteres): targetSecMedium (padrão: 16s)
        // - Respostas longas (~1500-2000 caracteres): targetSecLong (padrão: 30s)
        let targetTotalSec = targetSecMedium;
        if (totalChars <= 250) {
          targetTotalSec = targetSecShort;
        } else if (totalChars <= 700) {
          const ratio = (totalChars - 250) / (700 - 250);
          targetTotalSec = targetSecShort + ratio * (targetSecMedium - targetSecShort);
        } else if (totalChars <= 1800) {
          const ratio = (totalChars - 700) / (1800 - 700);
          targetTotalSec = targetSecMedium + ratio * (targetSecLong - targetSecMedium);
        } else {
          // Para respostas ultra-longas (> 1800 chars), escala suavemente até no máximo +15%
          const extraRatio = Math.min(1, (totalChars - 1800) / 700);
          targetTotalSec = targetSecLong + extraRatio * (targetSecLong * 0.15);
        }

        // Adiciona sutil variação humana natural (+- 350ms)
        const varianceMs = Math.floor(Math.random() * 700) - 350;
        const targetHumanMs = Math.max(1000, Math.round(targetTotalSec * 1000) + varianceMs);

        // Tempo restante de simulação descontando o tempo que a requisição de rede já levou
        const remainingDelayMs = Math.max(300, targetHumanMs - networkDuration);

        // Simula o tempo de digitação humana com avisos dinâmicos em inglês
        await simulateHumanTypingDelay(remainingDelayMs, expertName);

        if (typingAbortRef.current) return;
      }

      setLoading(false);

      // ONLY record message usage count when AI generation was successful
      recordSentTimestamp();
      setSentTimestamps(getSentMessageTimestamps());

      // Add completed message all at once (no typewriter streaming, no skip)
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, botMsg]);
      scrollToBottom();
    } else {
      setLoading(false);
      toast.error(`${expertName} is currently assisting other students. Please try again in a moment.`);
      const errBotMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I'm so sorry, I cannot respond at the moment because I'm currently helping other students in consultation. Don't worry, your message is saved and your message limit was NOT deducted! Whenever you're ready, tap the button below and I'll give you my full attention. 💕`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        retryQuery: query,
      };
      setMessages(prev => [...prev, errBotMsg]);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(copiedToast);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: resetChatWelcome,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  };

  return (
    <AnimatePresence>
      {isOpen && isAiEnabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[500] w-full h-full bg-black text-white flex flex-col overflow-hidden"
        >
          {/* Top Full Screen Navigation Bar */}
          <div className="flex items-center justify-between px-3 sm:px-8 py-3 sm:py-4 border-b border-white/10 bg-black/90 backdrop-blur-2xl shrink-0 gap-2 sm:gap-4 relative z-[510]">
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <button
                type="button"
                onClick={handleClose}
                className="group relative p-2.5 sm:p-3 hover:bg-white/10 active:bg-white/20 rounded-2xl transition-all active:scale-95 bg-white/5 border border-white/10 overflow-hidden shrink-0 cursor-pointer touch-manipulation z-30"
                title="Back"
                aria-label="Back"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <ArrowLeft size={18} className="text-white/80 group-hover:text-white relative z-10" />
              </button>

              <div className="relative shrink-0">
                <img
                  src={expertAvatar}
                  alt={expertName}
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-full aspect-square object-cover border-2 border-pink-500/50 shadow-md shadow-pink-500/20 shrink-0"
                  onError={(e) => {
                    // Fallback image if custom image URL fails
                    (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                  }}
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 border-2 border-zinc-900 rounded-full" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                  <h3 className="text-white font-bold text-sm sm:text-lg leading-tight truncate">
                    {expertName}
                  </h3>
                  {isUserUnlimited ? (
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)] shrink-0 animate-pulse">
                      <Sparkles size={11} className="text-amber-400" />
                      <span>VIP Unlimited</span>
                    </span>
                  ) : isLimitEnabled ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 shrink-0">
                      <Clock size={11} className="text-rose-400" />
                      <span>{messagesSentCount}/{maxMessages} {getFrequencyLabel(frequency)}</span>
                    </span>
                  ) : null}
                </div>
                <p className="text-gray-400 text-[10px] sm:text-xs whitespace-nowrap leading-tight">{expertSubtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowUnlimitedInfoModal(true)}
                title={unlimitedBtnTooltip}
                className="group relative px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl transition-all active:scale-95 bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-rose-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 shadow-md shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <InfinityIcon size={16} className="text-amber-400 shrink-0" />
                <span className="hidden sm:inline text-xs font-black tracking-wide uppercase">{unlimitedBtnLabel}</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                title="Close chat"
                aria-label="Close chat"
                className="group relative p-2.5 sm:p-3 hover:bg-white/10 active:bg-white/20 rounded-2xl transition-all active:scale-95 bg-white/5 border border-white/10 overflow-hidden shrink-0 cursor-pointer text-gray-400 hover:text-white touch-manipulation z-30"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <X size={18} className="relative z-10" />
              </button>
            </div>
          </div>

          {/* Chat Body - Max Width Centered for Large Screens */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 max-w-4xl mx-auto w-full">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {msg.role === 'user' ? (
                  userAvatar && userAvatar.trim() ? (
                    <img
                      src={userAvatar.trim()}
                      alt={userName || 'User'}
                      className="w-9 h-9 rounded-full object-cover border border-rose-500/40 shadow-md shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <UserIcon size={18} />
                    </div>
                  )
                ) : (
                  <img
                    src={expertAvatar}
                    alt={expertName}
                    className="w-9 h-9 rounded-full object-cover border border-pink-500/40 shadow-md shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                    }}
                  />
                )}

                <div className={`group relative max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 text-sm sm:text-base leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-rose-600 text-white rounded-tr-none'
                    : msg.isError
                    ? 'bg-zinc-900 border border-rose-500/30 text-rose-100 rounded-tl-none shadow-lg shadow-rose-950/20'
                    : 'bg-zinc-900 border border-white/10 text-gray-100 rounded-tl-none shadow-lg'
                }`}>
                  <div className="whitespace-pre-wrap font-normal">{msg.content.replace(/\*\*/g, '')}</div>

                  {msg.isError && msg.retryQuery && (
                    <div className="mt-3.5 pt-2.5 border-t border-rose-500/20 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-rose-300/80 font-medium">{expertName} is assisting other students</span>
                      <button
                        onClick={() => handleSend(msg.retryQuery)}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                        Ask {expertName} again
                      </button>
                    </div>
                  )}

                  <div className={`flex items-center justify-between mt-3 pt-2 border-t text-[11px] ${
                    msg.role === 'user' ? 'border-white/20 text-rose-200' : 'border-white/10 text-gray-400'
                  }`}>
                    <span>{msg.timestamp}</span>
                    {msg.role === 'assistant' && !msg.isError && (
                      <button
                        onClick={() => handleCopy(msg.content.replace(/\*\*/g, ''), msg.id)}
                        className="hover:text-white transition-colors flex items-center gap-1 opacity-60 group-hover:opacity-100"
                        title={copiedId === msg.id ? 'Copied' : 'Copy message'}
                      >
                        {copiedId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        {copiedId === msg.id ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 sm:gap-4"
              >
                <img
                  src={expertAvatar}
                  alt={expertName}
                  className="w-9 h-9 rounded-full object-cover border border-pink-500/40 shadow-md shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                  }}
                />
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 text-sm text-gray-300 rounded-tl-none flex items-center gap-3 shadow-lg">
                  <div className="flex items-center gap-1 px-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.9s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '180ms', animationDuration: '0.9s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '360ms', animationDuration: '0.9s' }} />
                  </div>
                  <span className="animate-pulse font-medium text-pink-200/90 text-xs sm:text-sm">
                    {statusText || `${expertName} is writing...`}
                  </span>
                </div>
              </motion.div>
            )}

            {isLimitReached && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mx-auto my-6 max-w-md bg-gradient-to-br from-zinc-900 via-zinc-900 to-rose-950/90 border border-amber-500/30 rounded-3xl p-6 sm:p-7 text-center shadow-2xl shadow-rose-950/60 backdrop-blur-md relative overflow-hidden"
              >
                {/* Decorative background glows */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Header Badge */}
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 text-amber-300 border border-amber-500/30 shadow-sm mb-4">
                  <Sparkles size={13} className="text-amber-400" />
                  <span>VIP Unlimited Plan</span>
                </div>

                <h4 className="text-white font-black text-lg sm:text-xl leading-snug mb-2">
                  {limitTitle || "Unlock Unlimited Conversations"}
                </h4>
                <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mb-5">
                  {limitReachedMsg || "Get 24/7 unlimited relationship & psychological advice with Victoria, with no daily or monthly message limits."}
                </p>

                {/* Benefits List */}
                <div className="bg-black/50 border border-white/10 rounded-2xl p-3.5 mb-6 text-left space-y-2.5 text-xs text-gray-200">
                  {benefit1 && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                        <Check size={12} />
                      </div>
                      <span>{benefit1}</span>
                    </div>
                  )}
                  {benefit2 && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                        <Check size={12} />
                      </div>
                      <span>{benefit2}</span>
                    </div>
                  )}
                </div>

                {/* Main CTA */}
                <div className="space-y-3">
                  {buyMoreUrl ? (
                    <a
                      href={buyMoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-black text-xs sm:text-sm tracking-wider uppercase transition-all shadow-xl shadow-pink-500/25 active:scale-95 cursor-pointer"
                    >
                      <Sparkles size={16} />
                      <span>{buyMoreButtonText || "Upgrade to Unlimited Monthly"}</span>
                      <ExternalLink size={14} className="opacity-80" />
                    </a>
                  ) : null}

                  {/* Learn More / How Unlimited Works button */}
                  <button
                    type="button"
                    onClick={() => setShowUnlimitedInfoModal(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-zinc-800/90 hover:bg-zinc-700/90 text-amber-300 hover:text-amber-200 border border-amber-500/35 font-bold text-xs sm:text-sm tracking-wide transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <Info size={16} className="text-amber-400 shrink-0" />
                    <span>{learnMoreButtonText}</span>
                  </button>

                  {/* Verify / Refresh Button */}
                  <button
                    onClick={() => checkUserVipStatus(true)}
                    disabled={isCheckingVip}
                    className="text-xs text-gray-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto py-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isCheckingVip ? "animate-spin text-pink-400" : ""} />
                    <span>Already subscribed? Check access</span>
                  </button>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts (Only if enabled in Admin and not at limit) */}
          {enableQuickPrompts && messages.length <= 2 && !loading && !isLimitReached && (
            <div className="px-4 py-3 border-t border-white/5 bg-black max-w-4xl mx-auto w-full flex flex-wrap gap-2">
              <span className="text-xs text-gray-400 w-full mb-1 flex items-center gap-1.5 font-medium">
                <GraduationCap size={15} className="text-pink-400" /> Suggested questions for {expertName}:
              </span>
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="text-xs bg-zinc-800/90 hover:bg-zinc-700 text-gray-200 hover:text-white border border-white/10 px-3.5 py-2 rounded-xl transition-all text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Footer Input */}
          <div className="p-4 sm:p-6 border-t border-white/10 bg-black shrink-0">
            <div className="max-w-4xl mx-auto w-full">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2 sm:gap-3"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isLimitReached ? inputDisabledPlaceholder : inputPlaceholder}
                  disabled={loading || isLimitReached}
                  className="flex-1 bg-zinc-800/90 border border-white/10 rounded-2xl px-4 sm:px-5 py-3.5 text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading || isLimitReached}
                  className="px-5 sm:px-6 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-pink-500/20"
                >
                  {loading ? <GlowingSpinner size="xs" color="white" /> : <Send size={20} />}
                </button>
              </form>
            </div>
          </div>

          {/* Unlimited Explanation HTML Modal */}
          <AnimatePresence>
            {showUnlimitedInfoModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex flex-col justify-center items-center p-0 sm:p-4 md:p-6"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 15 }}
                  className="bg-[#090d16] border border-white/15 w-full h-full sm:h-[92vh] sm:max-w-4xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl relative"
                >
                  {/* Modal Top Bar */}
                  <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-black/80 backdrop-blur-xl shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-pink-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <InfinityIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white font-bold text-sm sm:text-base leading-tight truncate">
                          {unlimitedModalTitle}
                        </h3>
                        <p className="text-[11px] text-gray-400 truncate">
                          {settings?.custom_texts?.['ai_expert.name'] || 'Victoria'} • VIP
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {buyMoreUrl && (
                        <a
                          href={buyMoreUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-600 hover:to-pink-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                        >
                          <Sparkles size={13} />
                          <span>{buyMoreButtonText || 'Upgrade Now'}</span>
                          <ExternalLink size={12} className="opacity-80" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowUnlimitedInfoModal(false)}
                        className="p-2 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white cursor-pointer"
                        title="Close"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Modal Body / Iframe */}
                  <div className="flex-1 w-full h-full overflow-hidden bg-[#090d16] relative">
                    <iframe
                      title="Unlimited Info"
                      srcDoc={resolvedUnlimitedHtml}
                      className="w-full h-full border-none"
                      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-forms allow-top-navigation"
                    />
                  </div>

                  {/* Mobile Sticky Footer if checkout link is available */}
                  {buyMoreUrl && (
                    <div className="sm:hidden p-3 border-t border-white/10 bg-black/90 backdrop-blur-lg shrink-0">
                      <a
                        href={buyMoreUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-rose-600 text-white font-black text-xs uppercase tracking-wider shadow-lg"
                      >
                        <Sparkles size={15} />
                        <span>{buyMoreButtonText || 'Upgrade to Unlimited'}</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

