import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { safeParseAiJson } from '../_utils/parseAiJson';
import { generateContentWithRetry } from '../_utils/geminiCallWithRetry';
import { getGeminiApiKey } from './chat';
import { TONE_DIRECTIVES } from './lessonSchema';

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

export async function handleRefineSalesCopy(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      currentHtml,
      userInstruction,
      courseTitle,
      targetAudience,
      tone = 'empathetic_persuasive',
    } = req.body || {};

    if (!userInstruction) {
      return res.status(400).json({ error: 'Instruction is required for sales page refinement.' });
    }

    const ai = getAiClient();
    const toneInstruction = TONE_DIRECTIVES[tone] || TONE_DIRECTIVES.empathetic_persuasive;

    const systemInstruction = `You are a Principal Direct-Response Copywriter, Conversion Rate Optimization (CRO) Architect, and Tailwind UI Designer.
Refine, expand, or upgrade the provided HTML Sales Page strictly according to the user's instruction.

${toneInstruction}

PRECISION DESIGN & COPY RULES:
1. SURGICAL PRESERVATION:
   - Preserve strong existing sections, interactive buttons (including any onclick postMessage purchase triggers), and visual hierarchy unless the user explicitly asks to replace them.
2. LANGUAGE CONSISTENCY:
   - Match the language of the existing sales page HTML (American English en-US by default) unless the user explicitly asks to translate it.
3. DESIGN SYSTEM (DARK LUXURY TAILWIND):
   - Use responsive Tailwind classes: elevated dark cards (<div class="p-6 rounded-2xl bg-zinc-900/75 border border-white/10 shadow-xl">), crisp headings (<h3 class="text-xl font-black tracking-tight text-white mb-3">), contrast grids (<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">), callouts (<div class="p-5 rounded-2xl bg-emerald-500/10 border-l-4 border-emerald-400 text-emerald-200">), and scannable FAQ blocks.
   - Do NOT invent fake claims, fake testimonials, or empty hype clichés.
4. OUTPUT FORMAT (RAW JSON ONLY):
   {
     "refinedHtml": "<div class='space-y-8 text-gray-200'>...complete updated HTML...</div>",
     "summaryOfChanges": "Concise 1-sentence summary of what changed"
   }`;

    const userPrompt = `Course Title: ${courseTitle || 'Mastery Course'}
Target Audience: ${targetAudience || 'Students seeking practical transformation'}
Tone: ${tone}

REFINEMENT INSTRUCTION:
"${userInstruction}"

CURRENT HTML SALES PAGE CONTENT:
${currentHtml || '<div class="space-y-6 text-gray-200"><h3>Mastery Transformation</h3><p>Discover the complete protocol...</p></div>'}

Apply the instruction precisely while keeping the layout cohesive and high-converting.`;

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
      logPrefix: '[refine-sales-copy]',
      validateResponse: (text) => safeParseAiJson(text),
    });

    const textResult = result.text;
    const parsed = result.parsed || safeParseAiJson(textResult);

    return res.status(200).json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[refine-sales-copy] Error:', error);

    const errMsg = error?.message || '';
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

    return res.status(500).json({ error: cleanError || 'Error refining sales copy with AI' });
  }
}
