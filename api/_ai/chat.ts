import { GoogleGenAI } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateContentWithRetry, isRetryableGeminiError } from '../_utils/geminiCallWithRetry';

// Vercel Free (Hobby) tier maximum execution limit is 10 seconds
export const maxDuration = 10;

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
    trimmed === 'placeholder-key'
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

const supabaseAdmin = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceRoleKey || supabaseAnonKey || 'placeholder-key', {
  auth: { persistSession: false }
});

let aiInstance: GoogleGenAI | null = null;

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

export async function handleAiChat(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    const { messages, userContext, customSystemPrompt, expertName, userId, messagesSentCount } = body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Message history is required.' });
    }

    // Server-side VIP / Unlimited access check against Supabase
    const userIdentifier = (userId || userContext?.userId || '').trim();
    let isUserUnlimited = false;

    if (userIdentifier) {
      try {
        const isUUID = (str: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

        let profile: { id?: string; has_unlimited_ai?: boolean; is_admin?: boolean; email?: string } | null = null;

        if (isUUID(userIdentifier)) {
          const { data } = await supabaseAdmin
            .from('profiles')
            .select('id, has_unlimited_ai, is_admin, email')
            .eq('id', userIdentifier)
            .maybeSingle();
          profile = data;
        }

        if (!profile && (userIdentifier.includes('@') || userContext?.email)) {
          const emailToFind = (userContext?.email || userIdentifier).toLowerCase();
          const { data } = await supabaseAdmin
            .from('profiles')
            .select('id, has_unlimited_ai, is_admin, email')
            .eq('email', emailToFind)
            .maybeSingle();
          profile = data;
        }

        if (profile?.has_unlimited_ai === false) {
          isUserUnlimited = false;
        } else if (profile?.has_unlimited_ai === true) {
          isUserUnlimited = true;
        } else {
          // Fallback check purchases table
          const targetUid = (profile?.id && isUUID(profile.id)) ? profile.id : (isUUID(userIdentifier) ? userIdentifier : null);
          let pQuery = supabaseAdmin.from('purchases').select('id');
          if (targetUid) {
            pQuery = pQuery.eq('user_id', targetUid);
          } else {
            pQuery = pQuery.eq('user_id', userIdentifier);
          }
          const { data: pData } = await pQuery.in('product_id', ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited']).maybeSingle();
          isUserUnlimited = !!pData;
        }
      } catch (dbErr) {
        console.warn('[AI Chat API] Error checking VIP status in DB:', dbErr);
      }
    }

    // Check message limit if user is not VIP
    if (!isUserUnlimited) {
      try {
        const { data: settingsRow } = await supabaseAdmin
          .from('app_settings')
          .select('custom_texts')
          .eq('id', 1)
          .maybeSingle();

        const customTexts = settingsRow?.custom_texts || {};
        const isLimitEnabled = customTexts['ai_expert.enable_message_limit'] === 'true';
        const maxMessages = Math.max(1, parseInt(customTexts['ai_expert.max_messages_count'] || '3', 10));

        if (isLimitEnabled) {
          let currentSentCount = typeof messagesSentCount === 'number' ? messagesSentCount : 0;

          if (userIdentifier) {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const { count } = await supabaseAdmin
              .from('ai_message_logs')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userIdentifier)
              .gte('created_at', startOfToday.toISOString());

            if (typeof count === 'number' && count > 0) {
              currentSentCount = Math.max(currentSentCount, count);
            }
          }

          if (currentSentCount >= maxMessages) {
            return res.status(403).json({
              error: 'VIP_REQUIRED',
              message: customTexts['ai_expert.limit_reached_toast'] || 'You have reached the message limit for this period. Upgrade to the Unlimited VIP plan to chat without limits!',
              isLimitReached: true,
              isUserUnlimited: false
            });
          }
        }
      } catch (limitErr) {
        console.warn('[AI Chat API] Limit verification note:', limitErr);
      }
    }

    const ai = getAiClient();

    // Optimize conversation context by taking the last 12 messages to keep response fast and under Vercel execution limits
    const trimmedMessages = messages.slice(-12);

    // Map message roles to Gemini expected format: user | model
    const contents = trimmedMessages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const name = expertName || 'Victoria';
    const defaultSystemInstruction = `You are ${name} ("Ask ${name}"), an empathetic, wise, insightful, and supportive relationship expert and coach specializing in romantic relationships, dating, effective communication, emotional intimacy, rebuilding trust, conflict resolution, breakup recovery, and establishing healthy personal boundaries.

Core Consultation Guidelines:
1. Respond in clear, warm, engaging, and constructive Portuguese (or match the language if the user writes in another language).
2. Introduce yourself naturally as ${name} when appropriate, providing thoughtful, actionable, and compassionate advice tailored to couples, partners, and individuals seeking relationship growth.
3. Use well-structured paragraphs, bullet points when appropriate, and an encouraging, non-judgmental tone.
4. CRITICAL FORMATTING RULE: Do NOT use markdown bold stars (like **text**) or asterisks (*text*) in your output. Write in natural plain text without asterisks so responses feel completely natural and human.
5. Provide thorough, empathetic, insightful, and practical advice. Adapt the depth and length of your guidance naturally to the user's situation: when users ask complex, emotional, or detailed questions, provide rich, elaborate, step-by-step guidance with actionable communication scripts and psychological perspective, without rushing or cutting thoughts short. When questions are simple or conversational, provide clear and direct guidance.
6. Gently remind users that while you provide expert relationship guidance and communication strategies, you are a coach and not a substitute for clinical emergency therapy.
${userContext?.userName ? `User's Name: ${userContext.userName}` : ''}`;

    const systemInstruction = customSystemPrompt && customSystemPrompt.trim() !== ''
      ? `${customSystemPrompt.trim()}\n\nIMPORTANT FORMATTING RULE: Do NOT use markdown bold stars (**text**) or asterisks in output. Write in natural plain text.\n\n${userContext?.userName ? `User's Name: ${userContext.userName}` : ''}`
      : defaultSystemInstruction;

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
        maxOutputTokens: 1600,
      },
      maxAttemptsPerModel: 1,
      baseDelayMs: 250,
      perCallTimeoutMs: 8500,
      totalBudgetMs: 13500,
      logPrefix: '[Ask Victoria Chat]'
    });

    const responseText = result.text;

    const rawReply = responseText || `Olá! Sou a ${name}. No momento estou refletindo com muito carinho sobre a sua situação. Por favor, envie novamente a sua dúvida para eu te responder com todos os detalhes! 💕`;
    const reply = rawReply.replace(/\*\*/g, '');

    // Record usage log only after successful AI response
    if (responseText && userIdentifier && !isUserUnlimited) {
      try {
        await supabaseAdmin
          .from('ai_message_logs')
          .insert({
            user_id: userIdentifier,
            created_at: new Date().toISOString()
          });
      } catch (logErr) {
        console.warn('[AI Chat API] Note: Failed to log message in ai_message_logs:', logErr);
      }
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

    if (errMsg.includes('GEMINI_API_KEY environment variable is missing')) {
      return res.status(200).json({
        success: false,
        reply: null,
        message: `Victoria is currently preparing her consultation room. Please verify that the GEMINI_API_KEY environment variable is configured in Vercel project settings, and try again in just a moment! 💕`,
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

    const friendlyFallback = `I'm so sorry, I cannot respond at this exact moment because I am currently in consultation assisting other students. Don't worry, your message is saved and your message limit was not consumed! Please ask again in just a moment and I will give you my full attention. 💕`;

    return res.status(200).json({
      success: false,
      reply: null,
      message: friendlyFallback,
      isHighDemand: true,
      retryable: true,
      limitDeducted: false,
      details: cleanError
    });
  }
}
