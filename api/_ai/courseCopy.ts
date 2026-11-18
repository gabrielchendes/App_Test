import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { safeParseAiJson } from '../_utils/parseAiJson';
import { generateContentWithRetry } from '../_utils/geminiCallWithRetry';
import { getGeminiApiKey } from './chat';
import { TONE_DIRECTIVES, resolveLanguageName } from './lessonSchema';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing');
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

export async function handleGenerateCourseCopy(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      topicOrTitle,
      targetAudience,
      mainPainOrDesire,
      priceTier = 97,
      tone = 'empathetic_persuasive',
      language = 'en',
      includeOldPrice = false,
      oldPriceTier,
      existingCourse = null,
    } = req.body || {};

    if (!topicOrTitle && !mainPainOrDesire) {
      return res.status(400).json({ error: 'Topic or main pain point is required.' });
    }

    const ai = getAiClient();

    const targetPriceCents = Math.max(0, Math.round(Number(priceTier) * 100));
    const isFree = targetPriceCents === 0;
    const targetOldPriceCents =
      !isFree && includeOldPrice
        ? oldPriceTier
          ? Math.round(Number(oldPriceTier) * 100)
          : Math.round(Number(priceTier) * 2.8) * 100
        : 0;

    const targetLangName = resolveLanguageName(language);
    const toneInstruction = TONE_DIRECTIVES[tone] || TONE_DIRECTIVES.empathetic_persuasive;

    const systemInstruction = `You are a Principal Direct-Response Copywriter, Conversion Architect, and Curriculum Strategist for premium digital academies.
Generate high-converting course positioning, card copy, a persuasive Tailwind HTML sales letter, and a 3–4 module progressive curriculum outline in strict JSON.

${toneInstruction}

CRITICAL DIRECTIVES:
1. STRICT LANGUAGE RULE:
   - Write EVERY string value (title, subtitle, description, benefits, badges, CTAs, guarantee, HTML sales copy, suggested module & chapter titles/descriptions) strictly in ${targetLangName}.
2. MECHANISM-DRIVEN CONVERSION (EUGENE SCHWARTZ + CLARITY):
   - Lead with the real mechanism and tangible relief—not generic hype.
   - BANNED CLICHÉS: Never write hollow infoproduct fluff ("revolutionary secret", "unlock your limitless potential", "100% overnight miracle", "game-changing journey").
   - Make every benefit follow the formula: [Concrete Deliverable/Tool] + [Tangible Outcome for the Student].
   - In "preview_rich_text", write clean semantic HTML using Tailwind classes ('space-y-6 text-gray-200', elevated cards 'p-6 rounded-2xl bg-zinc-900/80 border border-white/10', 2-column contrast grid 'grid grid-cols-1 sm:grid-cols-2 gap-4', callout box 'p-5 rounded-2xl bg-emerald-500/10 border-l-4 border-emerald-400 text-emerald-200', and 3–4 domain-specific FAQ objections). Never wrap HTML in markdown code fences.
3. PRICING & PROMOTION LOGIC:
   ${
     isFree
       ? `- FREE ACCESS MODE: Set "price": 0, "old_price": 0, "offer_badge_text": "". Frame CTAs around free instant enrollment.`
       : includeOldPrice
       ? `- PROMOTIONAL OFFER ENABLED: Set "price": ${targetPriceCents}, "old_price": ${targetOldPriceCents}, and a crisp "offer_badge_text" (e.g., "FOUNDERS ENROLLMENT • SPECIAL OFFER").`
       : `- PROMOTIONAL OFFER DISABLED: Set "price": ${targetPriceCents}, "old_price": 0, and "offer_badge_text": "". Do NOT invent strikethrough discounts or percentage-off claims.`
   }
4. PROGRESSIVE CURRICULUM OUTLINE ("suggestedModules"):
   - Create 3 to 4 progressive modules (Diagnostic/Mechanism -> Core Method -> Real-World Execution -> Sustainment), with 2 to 3 specific, outcome-driven interactive lessons per module so downstream lesson generation has rich context.

STRICT JSON SCHEMA (RETURN ONLY RAW JSON):
{
  "title": "Short, memorable, specific course title",
  "subtitle": "Clear mechanism + promised transformation sub-headline",
  "description": "Compelling 2-sentence overview for course cards",
  "price": ${targetPriceCents},
  "old_price": ${targetOldPriceCents},
  "benefits": [
    "Specific Deliverable 1 + tangible outcome",
    "Specific Deliverable 2 + tangible outcome",
    "Specific Deliverable 3 + tangible outcome",
    "Specific Deliverable 4 + tangible outcome",
    "Specific Deliverable 5 + tangible outcome"
  ],
  "cta_text": "UNLOCK ACCESS NOW",
  "premium_badge_text": "EXCLUSIVE METHOD",
  "offer_badge_text": "${!isFree && includeOldPrice ? 'SPECIAL ENROLLMENT' : ''}",
  "lifetime_badge_text": "LIFETIME ACCESS",
  "social_proof": "Step-by-step guided protocol",
  "payment_label_text": "${isFree ? 'Free Access' : 'Secure Checkout'}",
  "secure_payment_label": "100% Encrypted & Safe",
  "instant_access_label": "Instant Access in Your Account",
  "preview_enabled": true,
  "preview_type": "text",
  "preview_title": "Sales Preview Headline",
  "preview_subtitle": "Hook explaining why this mechanism works where surface tips failed",
  "preview_rating": "4.9 ⭐",
  "preview_students_label": "Guided Curriculum",
  "preview_guarantee_label": "7-Day Money-Back Guarantee",
  "preview_support_vip_label": "Expert Support",
  "preview_bonus_title": "Interactive Tools & Resources Included",
  "preview_modules_label": "Curriculum & Method Modules",
  "preview_students_tag": "Instant & Lifetime Access",
  "preview_risk_zero_label": "100% Risk-Free",
  "preview_guarantee_title": "100% Risk-Free 7-Day Guarantee",
  "preview_guarantee_subtitle": "Evaluate the entire program with peace of mind.",
  "preview_guarantee_description": "Full 7 days to explore every module and interactive tool. Request a full 100% refund anytime within 7 days if it does not deliver clear value.",
  "preview_footer_cta": "${includeOldPrice && !isFree ? 'GET INSTANT ACCESS WITH SPECIAL OFFER' : 'GET INSTANT ACCESS NOW'}",
  "preview_text": "PREVIEW COURSE",
  "preview_rich_text": "<div class='space-y-6 text-gray-200'>...clean responsive Tailwind HTML sections: Mechanism Breakdown, Outdated vs Modern Comparison, Module Highlights, FAQ Objections...</div>",
  "suggestedModules": [
    {
      "title": "Module 1: Foundations & Root Diagnostic",
      "chapters": [
        { "title": "Lesson 1: Title", "description": "Specific learning objective & practical output", "duration_minutes": 18, "content_type": "interactive" },
        { "title": "Lesson 2: Title", "description": "Specific learning objective & practical output", "duration_minutes": 20, "content_type": "interactive" }
      ]
    }
  ]
}`;

    const userPrompt = `Generate high-converting course copy, sales page HTML, and curriculum structure in ${targetLangName}:
Topic / Working Title: ${topicOrTitle || 'N/A'}
Target Audience: ${targetAudience || 'Individuals seeking practical, measurable transformation'}
Core Pain / Desired Shift: ${mainPainOrDesire || 'Replacing guesswork and inconsistency with a clear, reliable framework'}
Offer Price: $ ${priceTier} ${isFree ? '(FREE)' : ''}
Promotional Old Price: ${!isFree && includeOldPrice ? `$ ${oldPriceTier || Math.round(Number(priceTier) * 2.8)} (Enabled)` : 'DISABLED (old_price = 0, offer_badge_text = "")'}
Voice & Tone: ${tone}
${existingCourse ? `Existing Course Data to Enhance:\n${JSON.stringify(existingCourse, null, 2)}` : ''}`;

    const candidateModels = [
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-flash-latest',
    ];

    const result = await generateContentWithRetry({
      ai,
      candidateModels,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
      maxAttemptsPerModel: 1,
      baseDelayMs: 500,
      perCallTimeoutMs: 28000,
      totalBudgetMs: 52000,
      logPrefix: '[generate-course-copy]',
      validateResponse: (text) => safeParseAiJson(text),
    });

    const textResult = result.text;
    const parsed = result.parsed || safeParseAiJson(textResult);

    if (isFree || !includeOldPrice) {
      parsed.old_price = 0;
      parsed.offer_badge_text = '';
    }
    if (isFree) {
      parsed.price = 0;
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[generate-course-copy] Error:', error);

    const errMsg = error?.message || '';
    const isQuotaError =
      error.status === 'RESOURCE_EXHAUSTED' ||
      error.status === 429 ||
      error.statusCode === 429 ||
      errMsg.includes('429') ||
      errMsg.includes('quota') ||
      errMsg.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError) {
      return res.status(429).json({
        error: 'Temporary request limit reached. Please wait a few seconds and try again.',
      });
    }

    if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand')) {
      return res.status(503).json({
        error: 'The service is currently experiencing temporary high demand. Please wait a few seconds and try again.',
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

    return res.status(500).json({ error: cleanError || 'Internal error generating course copy with AI' });
  }
}
