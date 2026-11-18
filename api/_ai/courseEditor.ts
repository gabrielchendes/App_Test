import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { safeParseAiJson } from '../_utils/parseAiJson';
import { generateContentWithRetry } from '../_utils/geminiCallWithRetry';
import { getGeminiApiKey } from './chat';
import {
  LESSON_BLOCK_SCHEMAS_PROMPT,
  resolveLanguageName,
  normalizeLessonBlocks,
} from './lessonSchema';

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

function sanitizeEditedPayload(data: any): any {
  if (!data || typeof data !== 'object') return data;

  // Chapter scope
  if (Array.isArray(data.blocks)) {
    data.blocks = normalizeLessonBlocks(data.blocks, 'blk_edit');
  }
  if (data.interactive_content && Array.isArray(data.interactive_content.blocks)) {
    data.interactive_content.blocks = normalizeLessonBlocks(data.interactive_content.blocks, 'blk_edit');
    data.rich_text = JSON.stringify(data.interactive_content);
  }

  // Course / Module scopes containing modules or chapters
  if (Array.isArray(data.modules)) {
    data.modules = data.modules.map((mod: any, mIdx: number) => {
      if (Array.isArray(mod?.chapters)) {
        mod.chapters = mod.chapters.map((ch: any, cIdx: number) => {
          if (ch?.interactive_content && Array.isArray(ch.interactive_content.blocks)) {
            ch.interactive_content.blocks = normalizeLessonBlocks(ch.interactive_content.blocks, `blk_${mIdx}_${cIdx}`);
            ch.rich_text = JSON.stringify(ch.interactive_content);
          }
          return ch;
        });
      }
      return mod;
    });
  } else if (Array.isArray(data.chapters)) {
    data.chapters = data.chapters.map((ch: any, cIdx: number) => {
      if (ch?.interactive_content && Array.isArray(ch.interactive_content.blocks)) {
        ch.interactive_content.blocks = normalizeLessonBlocks(ch.interactive_content.blocks, `blk_m_${cIdx}`);
        ch.rich_text = JSON.stringify(ch.interactive_content);
      }
      return ch;
    });
  }

  return data;
}

export async function handleAiCourseEditor(req: VercelRequest, res: VercelResponse) {
  try {
    const {
      scope = 'course', // 'course' | 'module' | 'chapter' | 'element'
      instruction,
      currentData,
      parentContext = {},
      language = 'en',
    } = req.body || {};

    if (!instruction || !instruction.trim()) {
      return res.status(400).json({ error: 'An edit instruction is required.' });
    }

    if (!currentData) {
      return res.status(400).json({ error: 'Current data to modify is required.' });
    }

    const ai = getAiClient();
    const candidateModels = [
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-flash-latest',
    ];

    const targetLangName = resolveLanguageName(language);

    const systemInstruction = `You are a Principal Surgical Course Editor, Instructional Designer, and Conversion Copy Specialist.
Your mission is to apply the user's requested edit cleanly while keeping every unrelated part of the JSON intact.

SURGICAL EDITING RULES:
1. MINIMAL BLAST RADIUS:
   - Modify ONLY what the user's instruction asks to change, expand, add, or rewrite.
   - Strictly preserve existing JSON keys, object structure, IDs, order_index values, URLs, and unaffected content.
   - Never delete or summarize away untouched modules, chapters, or blocks.
2. RENDERER-COMPATIBLE INTERACTIVE BLOCKS:
   - Whenever adding or updating lesson blocks (in scope "chapter", "module", or "course"), follow the EXACT schemas below so the UI renders 100% of blocks cleanly (always use "readiness_evaluator" instead of "calculator"; keep simulator options + consequences; keep checklist/action_plan items with title + description).
3. ANTI-CLICHÉ QUALITY:
   - Avoid generic fluff ("unlock your potential", "dive deep", "game-changer"). Write sharp, domain-specific content, concrete scripts, and realistic practice scenarios.
4. LANGUAGE CONSISTENCY:
   - Keep modified or newly added text strictly in ${targetLangName} (matching the existing entity's language unless told to translate).
5. OUTPUT FORMAT:
   - Return ONLY a valid raw JSON object matching the exact top-level structure of Current Data. No markdown fences.

${LESSON_BLOCK_SCHEMAS_PROMPT}`;

    const userPrompt = `Target Scope: ${scope}
Edit Instruction: "${instruction}"

Parent Context (for coherence):
${JSON.stringify(parentContext, null, 2)}

Current Data to Modify:
${JSON.stringify(currentData, null, 2)}

Apply the instruction surgically and return ONLY the updated JSON.`;

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
      logPrefix: '[AI Course Editor API]',
      validateResponse: (text) => safeParseAiJson(text),
    });

    const responseText = result.text;

    let parsedResult: any = result.parsed || null;
    if (!parsedResult) {
      try {
        parsedResult = safeParseAiJson(responseText);
      } catch {
        console.warn('[AI Course Editor API] Failed to parse JSON:', responseText.slice(0, 300));
        return res.status(500).json({
          error: 'The AI modified the content, but the response could not be parsed as valid JSON.',
          rawText: responseText,
        });
      }
    }

    parsedResult = sanitizeEditedPayload(parsedResult);

    return res.status(200).json({
      success: true,
      modifiedData: parsedResult,
      scope,
      appliedInstruction: instruction,
    });
  } catch (error: any) {
    console.error('[AI Course Editor API] Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error while editing with AI',
    });
  }
}
