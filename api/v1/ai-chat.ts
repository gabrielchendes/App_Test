import { GoogleGenAI } from '@google/genai';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Vercel serverless execution limit
export const maxDuration = 30;

const supabaseUrl = 
  process.env.SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL || 
  '';

const isRevokedKey = (key?: string) => {
  if (!key) return true;
  const trimmed = key.trim();
  return (
    trimmed === '' || 
    trimmed === 'undefined' || 
    trimmed === 'null' ||
    trimmed === 'placeholder-key' ||
    trimmed.startsWith('sb_secret_') ||
    (!trimmed.startsWith('eyJ') && !trimmed.startsWith('sbp_') && !trimmed.startsWith('sb_publishable_'))
  );
};

const rawServiceRoleKey = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SERVICE_KEY || 
  process.env.SUPABASE_SECRET_KEY || 
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
  '';

const supabaseServiceRoleKey = isRevokedKey(rawServiceRoleKey) ? '' : rawServiceRoleKey;

const supabaseAnonKey = 
  process.env.SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || 
  '';

const hasRealSupabase = Boolean(
  supabaseUrl && 
  !supabaseUrl.includes('placeholder') &&
  (supabaseServiceRoleKey || supabaseAnonKey)
);

let supabaseAdmin: ReturnType<typeof createClient> | null = null;
try {
  if (hasRealSupabase) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }
} catch (e) {
  console.warn('[AI Chat API] Supabase client init error:', e);
}

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
    aiInstance = new GoogleGenAI({
      apiKey,
    });
  }
  return aiInstance;
}

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

// Timeout wrapper helper to guarantee DB queries never consume serverless execution window
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  try {
    return await Promise.race([
      promise.catch((err) => {
        console.warn('[withTimeout Promise Warning]:', err);
        return fallback;
      }),
      timeoutPromise
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Inlined self-contained helper functions to avoid any relative import failures in Vercel ESM
interface GeminiRetryOptions {
  ai: GoogleGenAI;
  candidateModels?: string[];
  contents: GenerateContentParameters['contents'];
  config?: GenerateContentParameters['config'];
  maxAttemptsPerModel?: number;
  baseDelayMs?: number;
  perCallTimeoutMs?: number;
  totalBudgetMs?: number;
  logPrefix?: string;
}

function isRetryableGeminiError(error: any): boolean {
  if (!error) return false;
  const rawStr = typeof error === 'string' ? error : (JSON.stringify(error) || String(error));
  const msg = (error.message || error.error?.message || rawStr).toLowerCase();
  const status = error.status || error.code || error.statusCode || error.error?.code || error.error?.status;

  if (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    status === 'UNAVAILABLE' ||
    status === 'RESOURCE_EXHAUSTED'
  ) {
    return true;
  }

  if (
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota exceeded') ||
    msg.includes('overloaded') ||
    msg.includes('try again later') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timed out') ||
    msg.includes('timeout')
  ) {
    return true;
  }

  return false;
}

async function generateContentWithRetry(
  options: GeminiRetryOptions
): Promise<{ text: string; modelUsed: string; response: GenerateContentResponse }> {
  const {
    ai,
    candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
    contents,
    config,
    maxAttemptsPerModel = 1,
    baseDelayMs = 250,
    perCallTimeoutMs = 7500,
    totalBudgetMs = 9200,
    logPrefix = '[Gemini Call]'
  } = options;

  const startTime = Date.now();
  let lastError: any = null;

  for (const modelName of candidateModels) {
    const timeElapsed = Date.now() - startTime;
    if (timeElapsed >= totalBudgetMs - 1200) {
      console.info(`${logPrefix} Approaching execution time budget (${timeElapsed}ms / ${totalBudgetMs}ms). Halting further model attempts.`);
      break;
    }

    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      const remainingTime = totalBudgetMs - (Date.now() - startTime);
      if (remainingTime < 1200) {
        console.info(`${logPrefix} Not enough time remaining (${remainingTime}ms) for attempt ${attempt} on ${modelName}.`);
        break;
      }

      const effectiveCallTimeout = Math.min(perCallTimeoutMs, remainingTime - 300);

      try {
        let timer: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Call to model ${modelName} reached deadline after ${effectiveCallTimeout}ms`));
          }, effectiveCallTimeout);
        });

        const callPromise = ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });

        const response = await Promise.race([callPromise, timeoutPromise]).finally(() => {
          if (timer) clearTimeout(timer);
        });

        if (response && response.text) {
          return {
            text: response.text,
            modelUsed: modelName,
            response,
          };
        }
      } catch (err: any) {
        lastError = err;
        const isRetryable = isRetryableGeminiError(err);
        const rawErrStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err) || String(err));

        console.info(
          `${logPrefix} Model ${modelName} note: ${rawErrStr}. Trying candidate fallback...`
        );

        const isHighDemand =
          rawErrStr.toLowerCase().includes('high demand') ||
          rawErrStr.toLowerCase().includes('spikes in demand') ||
          rawErrStr.toLowerCase().includes('unavailable') ||
          rawErrStr.toLowerCase().includes('overloaded') ||
          rawErrStr.toLowerCase().includes('timed out') ||
          rawErrStr.toLowerCase().includes('deadline') ||
          err?.status === 503 ||
          err?.code === 503 ||
          err?.error?.code === 503;

        if (isHighDemand) {
          break;
        }

        if (!isRetryable && attempt === 1) {
          break;
        }

        const delay = Math.round(
          baseDelayMs * Math.pow(1.3, attempt - 1) + Math.random() * 150
        );

        if (attempt < maxAttemptsPerModel && (Date.now() - startTime + delay) < totalBudgetMs - 1500) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError || new Error(`${logPrefix} All candidate models failed or were busy.`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = parseRequestBody(req);
    const { messages, userContext, customSystemPrompt, expertName, userId, messagesSentCount } = body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Message history is required.' });
    }

    // Check GEMINI API KEY early
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.warn('[AI Chat API] GEMINI_API_KEY missing on Vercel environment.');
      return res.status(200).json({
        success: false,
        reply: null,
        message: `${expertName || 'Victoria'} is currently preparing her consultation room. Please verify that the GEMINI_API_KEY environment variable is set in your Vercel project settings, and try again in just a moment! 💕`,
        missingKey: true,
        isHighDemand: true,
        limitDeducted: false,
      });
    }

    // Fast-path VIP check with strict 1200ms timeout
    const userIdentifier = (userId || userContext?.userId || '').trim();
    let isUserUnlimited = false;

    if (userIdentifier && supabaseAdmin && hasRealSupabase) {
      try {
        const isUUID = (str: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

        await withTimeout((async () => {
          let profile: { id?: string; has_unlimited_ai?: boolean; is_admin?: boolean; email?: string } | null = null;

          if (isUUID(userIdentifier)) {
            const { data } = await supabaseAdmin!
              .from('profiles')
              .select('id, has_unlimited_ai, is_admin, email')
              .eq('id', userIdentifier)
              .maybeSingle();
            profile = data;
          }

          if (!profile && (userIdentifier.includes('@') || userContext?.email)) {
            const emailToFind = (userContext?.email || userIdentifier).toLowerCase();
            const { data } = await supabaseAdmin!
              .from('profiles')
              .select('id, has_unlimited_ai, is_admin, email')
              .eq('email', emailToFind)
              .maybeSingle();
            profile = data;
          }

          if (profile?.has_unlimited_ai === false) {
            isUserUnlimited = false;
          } else if (profile?.has_unlimited_ai === true || profile?.is_admin === true) {
            isUserUnlimited = true;
          } else {
            const targetUid = (profile?.id && isUUID(profile.id)) ? profile.id : (isUUID(userIdentifier) ? userIdentifier : null);
            let pQuery = supabaseAdmin!.from('purchases').select('id');
            if (targetUid) {
              pQuery = pQuery.eq('user_id', targetUid);
            } else {
              pQuery = pQuery.eq('user_id', userIdentifier);
            }
            const { data: pData } = await pQuery.in('product_id', ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited']).maybeSingle();
            isUserUnlimited = !!pData;
          }
        })(), 1200, null);
      } catch (dbErr) {
        console.warn('[AI Chat API] DB check skipped on timeout/error:', dbErr);
      }
    }

    // Check message limit if user is not VIP with strict 1200ms timeout
    let limitBlockPayload: { status: number; body: any } | null = null;

    if (!isUserUnlimited && supabaseAdmin && hasRealSupabase) {
      try {
        await withTimeout((async () => {
          const { data: settingsRow } = await supabaseAdmin!
            .from('app_settings')
            .select('custom_texts')
            .eq('id', 1)
            .maybeSingle();

          const customTexts: Record<string, string> = (settingsRow as any)?.custom_texts || {};
          const isLimitEnabled = customTexts['ai_expert.enable_message_limit'] === 'true';
          const maxMessages = Math.max(1, parseInt(customTexts['ai_expert.max_messages_count'] || '3', 10));

          if (isLimitEnabled) {
            let currentSentCount = typeof messagesSentCount === 'number' ? messagesSentCount : 0;

            if (userIdentifier) {
              const startOfToday = new Date();
              startOfToday.setHours(0, 0, 0, 0);

              const { count } = await supabaseAdmin!
                .from('ai_message_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userIdentifier)
                .gte('created_at', startOfToday.toISOString());

              if (typeof count === 'number' && count > 0) {
                currentSentCount = Math.max(currentSentCount, count);
              }
            }

            if (currentSentCount >= maxMessages) {
              limitBlockPayload = {
                status: 403,
                body: {
                  error: 'VIP_REQUIRED',
                  message: customTexts['ai_expert.limit_reached_toast'] || 'You have reached the message limit for this period. Upgrade to the Unlimited VIP plan to chat without limits!',
                  isLimitReached: true,
                  isUserUnlimited: false
                }
              };
            }
          }
        })(), 1200, null);
      } catch (limitErr) {
        console.warn('[AI Chat API] Limit check skipped on timeout:', limitErr);
      }
    }

    if (limitBlockPayload) {
      return res.status(limitBlockPayload.status).json(limitBlockPayload.body);
    }

    const ai = getAiClient();

    // Optimize conversation context by taking the last 10 messages
    const trimmedMessages = messages.slice(-10);

    // Ensure conversation strictly begins with a user turn
    const validTurnMessages = [...trimmedMessages];
    while (validTurnMessages.length > 0 && validTurnMessages[0].role === 'assistant') {
      validTurnMessages.shift();
    }

    if (validTurnMessages.length === 0) {
      validTurnMessages.push({ role: 'user', content: 'Hello Victoria, I am here to chat!' });
    }

    // Map message roles to Gemini format and merge consecutive same-role messages
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const m of validTurnMessages) {
      const mappedRole: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
      if (contents.length > 0 && contents[contents.length - 1].role === mappedRole) {
        contents[contents.length - 1].parts[0].text += `\n\n${m.content}`;
      } else {
        contents.push({
          role: mappedRole,
          parts: [{ text: m.content }],
        });
      }
    }

    const name = expertName || 'Victoria';
    const defaultSystemInstruction = `You are ${name} ("Ask ${name}"), an empathetic, wise, insightful, and supportive relationship expert and coach specializing in romantic relationships, dating, effective communication, emotional intimacy, rebuilding trust, conflict resolution, breakup recovery, and establishing healthy personal boundaries.

Core Consultation Guidelines:
1. Primary Language: You are operating in the United States. Always respond in fluent, natural, warm, engaging, and constructive American English as your primary language (or seamlessly match the user's language if they explicitly write in another language).
2. Introduce yourself naturally as ${name} when appropriate, providing thoughtful, actionable, and compassionate advice tailored to couples, partners, and individuals seeking relationship growth in the US and globally.
3. Use well-structured paragraphs, bullet points when appropriate, and an encouraging, non-judgmental tone.
4. CRITICAL FORMATTING RULE: Do NOT use markdown bold stars (like **text**) or asterisks (*text*) in your output. Write in natural plain text without asterisks so responses feel completely natural and human.
5. Provide thorough, empathetic, insightful, and practical advice. Adapt the depth and length of your guidance naturally to the user's situation: when users ask complex, emotional, or detailed questions, provide rich, elaborate, step-by-step guidance with actionable communication scripts and psychological perspective, without rushing or cutting thoughts short. When questions are simple or conversational, provide clear and direct guidance.
6. Gently remind users that while you provide expert relationship guidance and communication strategies, you are a coach and not a substitute for clinical emergency therapy.
${userContext?.userName ? `User's Name: ${userContext.userName}` : ''}`;

    const systemInstruction = customSystemPrompt && customSystemPrompt.trim() !== ''
      ? `Primary Language: Respond in clear, warm American English (unless the user writes in another language).\n\n${customSystemPrompt.trim()}\n\nIMPORTANT FORMATTING RULE: Do NOT use markdown bold stars (**text**) or asterisks in output. Write in natural plain text.\n\n${userContext?.userName ? `User's Name: ${userContext.userName}` : ''}`
      : defaultSystemInstruction;

    // Highly reliable, fast models with validated Google GenAI SDK support
    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash'
    ];

    const result = await generateContentWithRetry({
      ai,
      candidateModels,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 1600, // Ample room for rich answers
      },
      maxAttemptsPerModel: 1,
      baseDelayMs: 250,
      perCallTimeoutMs: 7500, // Ample time for Gemini Flash Lite (takes ~2-5s) to produce rich guidance
      totalBudgetMs: 9200, // Strictly within the 10s Vercel Free limit (with 800ms buffer)
      logPrefix: '[Ask Victoria Chat]'
    });

    const responseText = result.text;
    const rawReply = responseText || `Hello! I'm ${name}. I am reflecting carefully on your situation. Please send your question again and I will gladly give you my full guidance and attention! 💕`;
    const reply = rawReply.replace(/\*\*/g, '');

    // Record usage count ONLY on true AI response success
    if (responseText && userIdentifier && !isUserUnlimited && supabaseAdmin && hasRealSupabase) {
      try {
        (supabaseAdmin as any)
          .from('ai_message_logs')
          .insert({
            user_id: userIdentifier,
            created_at: new Date().toISOString()
          })
          .then(() => {}, () => {});
      } catch (_) {}
    }

    if (res.headersSent) return;

    return res.status(200).json({
      success: true,
      reply,
      modelUsed: result.modelUsed,
      limitDeducted: true,
    });
  } catch (err: any) {
    if (res.headersSent) return;

    console.warn('[AI Chat API Handled Warning]:', err?.message || err);

    const errMsg = err?.message || String(err || '');

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

    // Graceful response with success: false so student daily quota is NEVER consumed on failures
    const friendlyFallback = `I'm so sorry, I cannot respond at this exact moment because I am currently in consultation assisting other students. Don't worry, your message is saved and your message limit was not consumed! Please ask again in just a moment and I will give you my full attention. 💕`;

    return res.status(200).json({
      success: false,
      reply: null,
      message: friendlyFallback,
      isHighDemand: true,
      retryable: true,
      limitDeducted: false,
      details: cleanError,
    });
  }
}
