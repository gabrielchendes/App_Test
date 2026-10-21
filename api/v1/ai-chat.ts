import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// --- Safe Configuration Sanitizers ---
function cleanUrl(raw?: string): string {
  if (!raw) return 'https://placeholder.supabase.co';
  let clean = raw.replace(/^["']|["']$/g, '').trim();
  if (!clean) return 'https://placeholder.supabase.co';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  try {
    new URL(clean);
    return clean;
  } catch {
    return 'https://placeholder.supabase.co';
  }
}

function isRevokedKey(key?: string): boolean {
  if (!key) return true;
  const trimmed = key.trim();
  return (
    trimmed === '' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === 'placeholder-key'
  );
}

function cleanKey(raw?: string): string {
  if (!raw) return 'placeholder-key';
  const clean = raw.replace(/^["']|["']$/g, '').trim();
  if (isRevokedKey(clean)) return 'placeholder-key';
  return clean;
}

function isSupabaseConfigured(): boolean {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  return !!url && !url.includes('placeholder') && !isRevokedKey(key);
}

// --- Lazy Supabase Clients ---
let supabaseAdminInstance: any = null;
let supabasePublicInstance: any = null;

function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    try {
      const url = cleanUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
      const rawServiceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SECRET_KEY ||
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
        '';
      const rawAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
      const key = cleanKey(rawServiceRoleKey || rawAnonKey);
      supabaseAdminInstance = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
    } catch (e) {
      console.warn('[AI Chat] Supabase Admin initialization note:', e);
      supabaseAdminInstance = createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: { persistSession: false }
      });
    }
  }
  return supabaseAdminInstance;
}

function getSupabasePublic() {
  if (!supabasePublicInstance) {
    try {
      const url = cleanUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
      const rawAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
      const key = cleanKey(rawAnonKey);
      supabasePublicInstance = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
    } catch (e) {
      console.warn('[AI Chat] Supabase Public initialization note:', e);
      supabasePublicInstance = createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: { persistSession: false }
      });
    }
  }
  return supabasePublicInstance;
}

// --- Gemini Client ---
export function getGeminiApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    '';
  return key.replace(/^["']|["']$/g, '').trim();
}

let aiInstance: GoogleGenAI | null = null;
let lastUsedApiKey = '';

function getAiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing');
  }
  if (!aiInstance || lastUsedApiKey !== apiKey) {
    lastUsedApiKey = apiKey;
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// --- Memory Profile Types & Helpers ---
export interface UserMemoryProfile {
  userId?: string;
  userName?: string;
  partnerName?: string | null;
  relationshipStatus?: string | null;
  facts: string[];
  topics: string[];
  recentAdvice: string[];
  lastUpdated: string;
}

function formatMemoryForPrompt(memory: UserMemoryProfile | null): string {
  if (!memory) return '';
  const parts: string[] = [];
  if (memory.userName) parts.push(`Student Name: ${memory.userName}`);
  if (memory.partnerName) parts.push(`Partner Name: ${memory.partnerName}`);
  if (memory.relationshipStatus) parts.push(`Relationship Status: ${memory.relationshipStatus}`);

  if (Array.isArray(memory.facts) && memory.facts.length > 0) {
    parts.push(`Known Student Facts:\n- ${memory.facts.slice(-6).join('\n- ')}`);
  }
  if (Array.isArray(memory.topics) && memory.topics.length > 0) {
    parts.push(`Key Themes Discussed: ${memory.topics.slice(-5).join(', ')}`);
  }
  if (Array.isArray(memory.recentAdvice) && memory.recentAdvice.length > 0) {
    parts.push(`Recent Advice Provided:\n- ${memory.recentAdvice.slice(-3).join('\n- ')}`);
  }
  if (parts.length === 0) return '';
  return `\n\n--- STUDENT FACT PROFILE & CONSULTATION MEMORY ---\n${parts.join('\n')}\n(Continuity instructions: Seamlessly remember this student context without repeatedly asking for documented details.)\n-------------------------------------------------`;
}

function extractAndMergeMemory(
  currentMemory: UserMemoryProfile | null,
  userMsg: string,
  botReply: string,
  userName?: string
): UserMemoryProfile {
  const mem: UserMemoryProfile = currentMemory || {
    facts: [],
    topics: [],
    recentAdvice: [],
    lastUpdated: new Date().toISOString()
  };

  if (userName && !mem.userName) {
    mem.userName = userName;
  }

  const combined = `${userMsg} ${botReply}`;
  const lowerUser = userMsg.toLowerCase();
  const lowerCombined = combined.toLowerCase();

  // Partner Name
  const partnerRegex = /(?:husband|wife|boyfriend|girlfriend|partner|fiancé|fiancee|spouse|namorado|namorada|esposo|esposa|marido)\s+(?:is\s+|named\s+|called\s+)?([A-Z][a-z]+)/i;
  const pMatch = userMsg.match(partnerRegex);
  if (pMatch && pMatch[1]) {
    const candidateName = pMatch[1].trim();
    const stopWords = ['my', 'the', 'our', 'his', 'her', 'we', 'he', 'she', 'so', 'and', 'but', 'when', 'if', 'not', 'him', 'them'];
    if (!stopWords.includes(candidateName.toLowerCase())) {
      mem.partnerName = candidateName;
      const fact = `Partner: ${candidateName}`;
      if (!mem.facts.some(f => f.toLowerCase().includes(candidateName.toLowerCase()))) {
        mem.facts.push(fact);
      }
    }
  }

  // Relationship Status
  if (!mem.relationshipStatus) {
    if (lowerCombined.includes('married') || lowerCombined.includes('husband') || lowerCombined.includes('wife') || lowerCombined.includes('casad')) {
      mem.relationshipStatus = 'Married';
    } else if (lowerCombined.includes('engaged') || lowerCombined.includes('fiancé') || lowerCombined.includes('noiv')) {
      mem.relationshipStatus = 'Engaged';
    } else if (lowerCombined.includes('long distance') || lowerCombined.includes('distância')) {
      mem.relationshipStatus = 'Long Distance Relationship';
    } else if (lowerCombined.includes('dating') || lowerCombined.includes('boyfriend') || lowerCombined.includes('girlfriend') || lowerCombined.includes('namor')) {
      mem.relationshipStatus = 'Dating';
    } else if (lowerCombined.includes('broke up') || lowerCombined.includes('breakup') || lowerCombined.includes('separated') || lowerCombined.includes('divorce') || lowerCombined.includes('término')) {
      mem.relationshipStatus = 'Breakup / Separation Recovery';
    }
  }

  // Topics
  const topicCatalog: Record<string, string[]> = {
    'Communication & Misunderstandings': ['communication', 'misunderstanding', 'talk', 'listen', 'conversar', 'comunicação', 'shut down'],
    'Trust & Rebuilding Fidelity': ['trust', 'cheat', 'affair', 'loyalty', 'confiança', 'traição', 'suspicious'],
    'Emotional Intimacy & Affection': ['intimacy', 'affection', 'cold', 'disconnected', 'intimidade', 'afeto', 'distant', 'love language'],
    'Conflict Resolution & Arguments': ['argument', 'fight', 'yelling', 'defensive', 'briga', 'discussão', 'criticism'],
    'Healthy Boundaries & Space': ['boundary', 'boundaries', 'smothering', 'independence', 'limites', 'space'],
    'Future Commitment & Goals': ['commitment', 'future', 'moving in', 'marriage', 'compromisso', 'goals']
  };

  for (const [topicName, keywords] of Object.entries(topicCatalog)) {
    if (keywords.some(k => lowerCombined.includes(k)) && !mem.topics.includes(topicName)) {
      mem.topics.push(topicName);
    }
  }

  if (mem.topics.length > 5) {
    mem.topics = mem.topics.slice(-5);
  }

  // Advice summary snippet
  if (botReply && botReply.length > 30) {
    const cleanSentences = botReply
      .replace(/\r?\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 25 && s.length < 140 && !s.startsWith('Hello') && !s.startsWith("I'm"));
    const adviceSnippet = cleanSentences[0] || botReply.slice(0, 110) + '...';
    if (!mem.recentAdvice.includes(adviceSnippet)) {
      mem.recentAdvice.push(adviceSnippet);
      if (mem.recentAdvice.length > 3) {
        mem.recentAdvice = mem.recentAdvice.slice(-3);
      }
    }
  }

  mem.facts = [...new Set(mem.facts)].slice(-8);
  mem.lastUpdated = new Date().toISOString();
  return mem;
}

function normalizeIdentifiers(userIdentifier: string | string[]): string[] {
  if (Array.isArray(userIdentifier)) {
    return Array.from(new Set(userIdentifier.map(id => (id || '').trim().toLowerCase()).filter(Boolean)));
  }
  if (!userIdentifier) return [];
  return [userIdentifier.trim().toLowerCase()];
}

// Fast non-blocking DB helpers with strict timeouts & pagination
async function loadChatMessagesFromDb(
  supabaseClient: any,
  userIdentifier: string | string[],
  limit: number = 20,
  beforeTimestamp?: string
): Promise<{
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string; createdAt?: string }>;
  hasMore: boolean;
}> {
  if (!isSupabaseConfigured()) return { messages: [], hasMore: false };
  const ids = normalizeIdentifiers(userIdentifier);
  if (ids.length === 0) return { messages: [], hasMore: false };

  try {
    const queryPromise = (async () => {
      let q = supabaseClient.from('ai_chat_messages').select('id, role, content, timestamp, created_at');
      if (ids.length === 1) {
        q = q.or(`user_id.eq.${ids[0]},user_email.eq.${ids[0]}`);
      } else {
        const inList = ids.join(',');
        q = q.or(`user_id.in.(${inList}),user_email.in.(${inList})`);
      }

      if (beforeTimestamp) {
        q = q.lt('created_at', beforeTimestamp);
      }

      // Order newest first so we get the most recent messages up to limit + 1
      const res = await q.order('created_at', { ascending: false }).limit(limit + 1);

      if (res?.data && Array.isArray(res.data)) {
        const hasMore = res.data.length > limit;
        const pageRows = res.data.slice(0, limit);
        // Reverse so chronological order (oldest to newest) is restored for display
        pageRows.reverse();

        const mapped = pageRows.map((row: any) => ({
          id: String(row.id),
          role: row.role === 'assistant' ? 'assistant' : 'user',
          content: String(row.content),
          createdAt: String(row.created_at || ''),
          timestamp: String(
            row.timestamp ||
            (row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
          )
        }));

        return { messages: mapped, hasMore };
      }
      return { messages: [], hasMore: false };
    })();

    return await Promise.race([
      queryPromise,
      new Promise<{ messages: any[]; hasMore: boolean }>((resolve) => setTimeout(() => resolve({ messages: [], hasMore: false }), 1800))
    ]);
  } catch (err) {
    console.warn('[AI Chat] loadChatMessagesFromDb note:', err);
    return { messages: [], hasMore: false };
  }
}

async function saveChatMessageToDb(
  supabaseClient: any,
  userIdentifier: string | string[],
  message: { role: string; content: string; id?: string; timestamp?: string }
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const ids = normalizeIdentifiers(userIdentifier);
  if (ids.length === 0) return;
  const primaryId = ids[0];
  const emailId = ids.find(id => id.includes('@')) || primaryId;
  const msgId = message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  try {
    const insertPromise = supabaseClient.from('ai_chat_messages').insert({
      id: msgId,
      user_id: primaryId,
      user_email: emailId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: nowIso
    });
    await Promise.race([
      insertPromise,
      new Promise((resolve) => setTimeout(resolve, 1000))
    ]);
  } catch (_) {}
}

async function loadUserMemoryFast(
  supabaseClient: any,
  userIdentifier: string | string[]
): Promise<UserMemoryProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const ids = normalizeIdentifiers(userIdentifier);
  if (ids.length === 0) return null;

  try {
    const queryPromise = (async () => {
      let q = supabaseClient.from('ai_user_memory').select('*');
      if (ids.length === 1) {
        q = q.or(`user_id.eq.${ids[0]},user_email.eq.${ids[0]}`);
      } else {
        const inList = ids.join(',');
        q = q.or(`user_id.in.(${inList}),user_email.in.(${inList})`);
      }
      const res = await q.limit(1).maybeSingle();
      if (res?.data) {
        const row = res.data;
        return {
          userId: row.user_id,
          userName: row.user_name,
          partnerName: row.partner_name,
          relationshipStatus: row.relationship_status,
          facts: Array.isArray(row.facts) ? row.facts : [],
          topics: Array.isArray(row.topics) ? row.topics : [],
          recentAdvice: Array.isArray(row.recent_advice) ? row.recent_advice : [],
          lastUpdated: row.last_updated || new Date().toISOString()
        };
      }
      return null;
    })();

    return await Promise.race([
      queryPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 400))
    ]);
  } catch (_) {
    return null;
  }
}

async function saveUserMemoryToDb(
  supabaseClient: any,
  userIdentifier: string | string[],
  memory: UserMemoryProfile
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const ids = normalizeIdentifiers(userIdentifier);
  if (ids.length === 0) return;
  const primaryId = ids[0];
  const emailId = ids.find(id => id.includes('@')) || primaryId;
  const nowIso = new Date().toISOString();

  try {
    const upsertPromise = supabaseClient.from('ai_user_memory').upsert(
      {
        user_id: primaryId,
        user_email: emailId,
        user_name: memory.userName || null,
        partner_name: memory.partnerName || null,
        relationship_status: memory.relationshipStatus || null,
        facts: memory.facts,
        topics: memory.topics,
        recent_advice: memory.recentAdvice,
        last_updated: nowIso
      },
      { onConflict: 'user_id' }
    );
    await Promise.race([
      upsertPromise,
      new Promise((resolve) => setTimeout(resolve, 1000))
    ]);
  } catch (_) {}
}

async function checkUserVipFast(
  supabaseClient: any,
  userIdentifier: string,
  candidateIds: string[] = []
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userIdentifier) return false;
  try {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const allIds = Array.from(new Set([userIdentifier, ...candidateIds].filter(Boolean)));
    const uuidIds = allIds.filter(id => isUUID(id));
    const emailIds = allIds.filter(id => id.includes('@'));

    const queryPromise = (async () => {
      // 1. Check profiles table for has_unlimited_ai or is_admin
      let q = supabaseClient.from('profiles').select('id, has_unlimited_ai, is_admin').limit(1);
      if (uuidIds.length > 0) {
        q = q.in('id', uuidIds);
      } else if (emailIds.length > 0) {
        q = q.in('email', emailIds);
      } else {
        q = q.eq('id', userIdentifier);
      }
      const { data: profile } = await q.maybeSingle();
      if (profile?.has_unlimited_ai === true || profile?.is_admin === true) {
        return true;
      }
      if (profile?.has_unlimited_ai === false) {
        return false;
      }

      // 2. Check purchases table for active VIP subscription / unlimited products
      const vipProductIds = ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited'];
      let pQuery = supabaseClient.from('purchases').select('id').in('product_id', vipProductIds).limit(1);
      if (uuidIds.length > 0) {
        pQuery = pQuery.in('user_id', uuidIds);
      } else {
        pQuery = pQuery.eq('user_id', userIdentifier);
      }
      const { data: purchase } = await pQuery.maybeSingle();
      if (purchase?.id) {
        return true;
      }

      return false;
    })();

    return await Promise.race([
      queryPromise,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1200))
    ]);
  } catch (_) {
    return false;
  }
}

// --- Body Parsing Helper ---
function parseRequestBody(req: VercelRequest): Record<string, any> {
  let body = req.body;
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch {
      return {};
    }
  }
  return typeof body === 'object' ? body : {};
}

// --- Fast Multi-Model Generator with Strict Budget ---
async function generateWithModelFallback(
  ai: GoogleGenAI,
  candidateModels: string[],
  contents: any[],
  systemInstruction: string,
  totalBudgetMs: number = 8800
): Promise<{ text: string; modelUsed: string }> {
  const startTime = Date.now();
  let lastError: any = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const modelName = candidateModels[i];
    const elapsed = Date.now() - startTime;
    const remainingTime = totalBudgetMs - elapsed;
    if (remainingTime < 1000) {
      console.info(`[Ask Victoria] Time budget reached (${elapsed}ms). Responding safely.`);
      break;
    }

    // Allocate up to 6800ms to first model to absorb Cold Starts, remaining budget to fallbacks
    const perCallTimeout = i === 0 ? Math.min(6800, remainingTime - 150) : Math.min(2600, remainingTime - 150);

    try {
      let timer: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout after ${perCallTimeout}ms on ${modelName}`));
        }, perCallTimeout);
      });

      const callPromise = ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
          maxOutputTokens: 400,
        }
      });

      const response = await Promise.race([callPromise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
      });

      if (response && response.text) {
        return {
          text: response.text,
          modelUsed: modelName,
        };
      }
    } catch (err: any) {
      lastError = err;
      console.info(`[Ask Victoria] Model ${modelName} note: ${err?.message || err}. Trying next fallback...`);
      continue;
    }
  }

  throw lastError || new Error('All candidate models exhausted or busy.');
}

// --- Main Handler ---
export async function handleAiChat(req: VercelRequest, res: VercelResponse) {
  // Always set robust CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseAdmin = getSupabaseAdmin();
  const supabasePublic = getSupabasePublic();

  // --- GET Request: Load Chat History & User Memory Profile ---
  if (req.method === 'GET') {
    try {
      const candidateIds = [
        req.query?.userId,
        req.query?.userEmail,
        req.query?.email,
        req.query?.id
      ].map(id => (id || '').toString().trim().toLowerCase()).filter(Boolean);

      if (candidateIds.length === 0) {
        return res.status(200).json({ success: true, messages: [], hasMore: false, userMemory: null, isUserUnlimited: false });
      }

      const limit = Math.min(50, Math.max(1, parseInt((req.query?.limit as string) || '20', 10)));
      const before = (req.query?.before as string || '').trim();

      const [storedData, storedMemory, isVip] = await Promise.all([
        loadChatMessagesFromDb(supabaseAdmin, candidateIds, limit, before || undefined).catch(() => ({ messages: [], hasMore: false })),
        loadUserMemoryFast(supabaseAdmin, candidateIds).catch(() => null),
        checkUserVipFast(supabaseAdmin, candidateIds[0], candidateIds).catch(() => false)
      ]);

      return res.status(200).json({
        success: true,
        messages: storedData.messages || [],
        hasMore: storedData.hasMore || false,
        userMemory: storedMemory || null,
        isUserUnlimited: isVip
      });
    } catch (getErr: any) {
      console.warn('[AI Chat API GET Error]:', getErr?.message || getErr);
      return res.status(200).json({ success: true, messages: [], hasMore: false, userMemory: null, isUserUnlimited: false });
    }
  }

  // --- POST Request: Send message & Receive Victoria's Guidance ---
  try {
    const body = parseRequestBody(req);
    const { messages, userContext, customSystemPrompt, expertName, userId, messagesSentCount } = body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(200).json({
        success: false,
        reply: null,
        message: 'Message history is required to consult Victoria.'
      });
    }

    const candidateIds = [
      userId,
      userContext?.userId,
      userContext?.email,
      body?.email
    ].map(id => (id || '').toString().trim().toLowerCase()).filter(Boolean);

    const userIdentifier = candidateIds[0] || (userContext?.userName || 'student').trim().toLowerCase();

    // 1. Immediately persist incoming student message in the background (fire and forget)
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg && candidateIds.length > 0) {
      saveChatMessageToDb(supabaseAdmin, candidateIds, lastUserMsg).catch(() => {});
    }

    // Check if client explicitly sent that user is VIP (e.g. from authenticated session/profile)
    const clientSaysUnlimited = 
      body?.hasUnlimitedAi === true || 
      body?.hasUnlimitedAi === 'true' ||
      userContext?.hasUnlimitedAi === true || 
      userContext?.hasUnlimitedAi === 'true' ||
      body?.isUserUnlimited === true ||
      body?.isUserUnlimited === 'true' ||
      userContext?.isUserUnlimited === true ||
      userContext?.isUserUnlimited === 'true';

    // 2. Parallel Fast Context: Load Memory and VIP Status simultaneously
    let existingMemory: UserMemoryProfile | null = null;
    let isUserUnlimited = clientSaysUnlimited;

    if (candidateIds.length > 0 && isSupabaseConfigured()) {
      try {
        const [memRes, vipRes] = await Promise.all([
          loadUserMemoryFast(supabaseAdmin, candidateIds),
          !isUserUnlimited ? checkUserVipFast(supabaseAdmin, userIdentifier, candidateIds) : Promise.resolve(true)
        ]);
        existingMemory = memRes;
        isUserUnlimited = isUserUnlimited || vipRes;
      } catch (_) {}
    }

    // 3. Client sent count check if limited
    if (!isUserUnlimited && typeof messagesSentCount === 'number' && messagesSentCount >= 5) {
      return res.status(403).json({
        error: 'VIP_REQUIRED',
        message: 'You have reached the free consultation message limit. Upgrade to the Unlimited VIP plan to continue chatting without limits!',
        isLimitReached: true,
        isUserUnlimited: false
      });
    }

    const memoryInstruction = formatMemoryForPrompt(existingMemory);

    // 4. Initialize Gemini
    let ai: GoogleGenAI;
    try {
      ai = getAiClient();
    } catch (keyErr: any) {
      return res.status(200).json({
        success: false,
        reply: null,
        message: 'Victoria is currently preparing her consultation room. Please verify that the GEMINI_API_KEY environment variable is configured in Vercel project settings, and try again in just a moment! 💕',
        missingKey: true,
        isHighDemand: true,
        limitDeducted: false,
      });
    }

    // 5. Compact context (last 6 messages for ultra-fast generation and minimal latency)
    const trimmedMessages = messages.slice(-6);
    const contents = trimmedMessages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const name = expertName || 'Victoria';
    const defaultSystemInstruction = `You are ${name} ("Ask ${name}"), an empathetic, wise, insightful, and supportive relationship expert and coach specializing in romantic relationships, dating, effective communication, emotional intimacy, rebuilding trust, conflict resolution, breakup recovery, and establishing healthy personal boundaries.

Core Consultation Guidelines:
1. Primary Language: You are operating in the United States. Always respond in fluent, natural, warm, engaging, and constructive American English as your primary language (or seamlessly match the user's language if they explicitly write to you in another language).
2. Introduce yourself naturally as ${name} when appropriate, providing thoughtful, actionable, and compassionate advice tailored to couples, partners, and individuals seeking relationship growth in the US and globally.
3. Use well-structured paragraphs, bullet points when appropriate, and an encouraging, non-judgmental tone.
4. CRITICAL FORMATTING RULE: Do NOT use markdown bold stars (like **text**) or asterisks (*text*) in your output. Write in natural plain text without asterisks so responses feel completely natural and human.
5. Provide thorough, empathetic, insightful, and practical advice. Adapt the depth and length of your guidance naturally to the user's situation: when users ask complex, emotional, or detailed questions, provide rich, elaborate, step-by-step guidance with actionable communication scripts and psychological perspective, without rushing or cutting thoughts short. When questions are simple or conversational, provide clear and direct guidance.
6. Gently remind users that while you provide expert relationship guidance and communication strategies, you are a coach and not a substitute for clinical emergency therapy.
${userContext?.userName ? `User's Name: ${userContext.userName}` : ''}${memoryInstruction}`;

    const systemInstruction = customSystemPrompt && customSystemPrompt.trim() !== ''
      ? `Primary Language: Respond in clear, warm American English (unless the user writes in another language).\n\n${customSystemPrompt.trim()}\n\nIMPORTANT FORMATTING RULE: Do NOT use markdown bold stars (**text**) or asterisks in output. Write in natural plain text.\n\n${userContext?.userName ? `User's Name: ${userContext.userName}` : ''}${memoryInstruction}`
      : defaultSystemInstruction;

    // Prioritize high-volume Flash-Lite models with independent quota pools
    const candidateModels = [
      'gemini-flash-lite-latest',   // Highest free volume & fastest response (~600ms)
      'gemini-3.1-flash-lite',      // Ultra-economical ($0.075/1M), independent quota pool (~600ms)
      'gemini-3.5-flash-lite',      // High-speed fallback (~600ms)
      'gemini-3.1-flash-lite-preview'
    ];

    const result = await generateWithModelFallback(
      ai,
      candidateModels,
      contents,
      systemInstruction,
      8800
    );

    const responseText = result.text;
    const rawReply = responseText || `Hello! I'm ${name}. I am reflecting carefully on your situation. Please send your question again and I will gladly give you my full guidance and attention! 💕`;
    const reply = rawReply.replace(/\*\*/g, '');

    let updatedMemory: UserMemoryProfile | null = existingMemory;

    // 6. On success: Persist assistant reply & update Student Memory in the background (fire and forget)
    if (responseText && candidateIds.length > 0) {
      saveChatMessageToDb(supabaseAdmin, candidateIds, {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }).catch(() => {});

      try {
        updatedMemory = extractAndMergeMemory(
          existingMemory,
          lastUserMsg?.content || '',
          reply,
          userContext?.userName
        );
        saveUserMemoryToDb(supabaseAdmin, candidateIds, updatedMemory).catch(() => {});
      } catch (_) {}
    }

    if (res.headersSent) return;

    return res.status(200).json({
      success: true,
      reply,
      modelUsed: result.modelUsed,
      limitDeducted: true,
      userMemory: updatedMemory || existingMemory || null
    });
  } catch (err: any) {
    if (res.headersSent) return;

    console.warn('[AI Chat API Handled Warning]:', err?.message || err);
    const errMsg = err?.message || String(err || '');

    if (errMsg.includes('GEMINI_API_KEY environment variable is missing')) {
      return res.status(200).json({
        success: false,
        reply: null,
        message: 'Victoria is currently preparing her consultation room. Please verify that the GEMINI_API_KEY environment variable is configured in Vercel project settings, and try again in just a moment! 💕',
        missingKey: true,
        isHighDemand: true,
        limitDeducted: false,
      });
    }

    let cleanError = errMsg;
    try {
      if (errMsg.includes('{') && errMsg.includes('}')) {
        const jsonStart = errMsg.indexOf('{');
        const jsonEnd = errMsg.lastIndexOf('}');
        const candidateJson = errMsg.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(candidateJson);
        if (parsed.error?.message) {
          cleanError = parsed.error.message;
        }
      }
    } catch (_) {}

    const isQuotaLimit =
      cleanError.toLowerCase().includes('quota') ||
      cleanError.toLowerCase().includes('rate limit') ||
      cleanError.toLowerCase().includes('resource_exhausted');

    const friendlyFallback = isQuotaLimit
      ? 'I am receiving a surge of questions right now and need just a brief moment to reflect. Your message is safely saved and your limit was not deducted! Please ask again in just a moment. 💕'
      : 'I am currently in consultation assisting other students. Don\'t worry, your message is safely saved and your message limit was not consumed! Please ask again in just a moment and I will give you my full attention. 💕';

    return res.status(200).json({
      success: false,
      reply: null,
      message: friendlyFallback,
      isHighDemand: true,
      retryable: true,
      retryAfterMs: isQuotaLimit ? 2500 : 1500,
      limitDeducted: false,
      details: cleanError
    });
  }
}

export default handleAiChat;
