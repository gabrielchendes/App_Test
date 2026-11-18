import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { safeParseAiJson } from '../_utils/parseAiJson';
import { generateContentWithRetry } from '../_utils/geminiCallWithRetry';
import { getGeminiApiKey } from './chat';
import {
  LESSON_BLOCK_SCHEMAS_PROMPT,
  TONE_DIRECTIVES,
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

export async function handleGenerateLesson(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      courseTitle,
      moduleTitle,
      lessonTitle,
      lessonGoal,
      aiInstructions,
      action = 'generate',
      existingBlocks = [],
      referenceImage,
      language = 'en',
      tone = 'authoritative_empathetic',
    } = req.body || {};

    if (!lessonGoal && !aiInstructions && !referenceImage) {
      return res.status(400).json({ error: 'Lesson goal, instructions, or a reference image is required.' });
    }

    const ai = getAiClient();
    const targetLangName = resolveLanguageName(language);
    const toneInstruction = TONE_DIRECTIVES[tone] || TONE_DIRECTIVES.authoritative_empathetic;

    const systemInstruction = `You are a Principal Instructional Designer, Behavioral Scientist, and Interactive Masterclass Architect.
Your task is to craft ONE deeply practical, intellectually rigorous, experiential lesson in strict JSON matching the exact renderer schema.

${toneInstruction}

PEDAGOGICAL ARCHITECTURE (4-PHASE INSTRUCTIONAL ARC — 4 TO 6 BLOCKS TOTAL):
Every lesson MUST follow a deliberate learning progression (never output a shallow summary or checklist-only stub):
- Phase 1 — Mechanism & Reframe ("text" block):
  Explain the underlying psychological, behavioral, or technical mechanism (WHY people struggle here). Include at least ONE counterintuitive insight, ONE concrete real-world example or word-for-word script/template where applicable, and ONE highlighted strategic callout:
  <div class="p-4 bg-emerald-500/10 border-l-4 border-emerald-400 rounded-r-2xl my-4 text-emerald-200"><strong>Strategic Rule:</strong> ...</div>
  Format with clean <h3>, <h4>, <p>, <ul>, <li>, <strong>.
- Phase 2 — Contrast or Progression ("comparison" OR "timeline" block):
  Show 2–3 hyper-specific contrasts ("Common Flawed Habit ❌" vs "Calibrated Master Protocol ✅") OR a chronological phased roadmap. Avoid abstract slogans; depict realistic phrasing, timing, and actions.
- Phase 3 — Applied Interactive Practice (pick the 1–2 BEST fitting blocks for this exact goal):
  • Decision-making / communication / judgment -> "simulator" (realistic stakes; wrong options must be tempting everyday mistakes, NOT absurd caricatures, with insightful "consequences").
  • Self-audit / readiness / diagnostic scoring -> "readiness_evaluator" (observable criteria + calibrated 3-tier "result_tiers").
  • Habit formation / streak / multi-day discipline -> "tracker" (adapt "tracker_label" and "tracker_milestones" strictly to THIS lesson's domain) + optional "chart".
  • Incoming message / text analysis -> "ai_analyzer" (with domain-calibrated "analyzer_criteria").
  • Concept verification -> "quiz" (scenario-based questions with crisp "explanation" rationales).
- Phase 4 — Execution & Integration ("action_plan" or "checklist" + "reflection"):
  • "action_plan" / "checklist": 3–5 immediate execution steps where every item's "description" explains HOW to do it and WHY it works.
  • "reflection": 1 laser-focused coaching prompt tied directly to a real situation the student faces today.

ANTI-CLICHÉ & QUALITY CONSTRAINTS (STRICT):
1. BANNED FLUFF: Never use empty filler phrases like "unlock your potential", "dive deep", "game-changer", "embark on a journey", "transform your life overnight", or vague 4-word checklist items. Every sentence must deliver concrete tactical value.
2. ACTION MODE DISCIPLINE:
   - If Requested Action is "IMPROVE" and existingBlocks are provided: perform SURGICAL upgrades. Preserve existing block IDs and strong blocks while expanding depth, sharpening examples, or adding only what the improvement prompt asks for.
   - If "GENERATE" or "REGENERATE": build a complete 4–6 block cohesive lesson from scratch.
3. REFERENCE IMAGE BLUEPRINT (WHEN ATTACHED):
   Treat the attached image as a direct structural & UI blueprint. Recreate its interactive widgets, counters, progression steps, metrics, and layout faithfully using the available block types below.
4. LANGUAGE RULE:
   Write ALL student-facing titles, summaries, HTML copy, checklist items, simulator scenarios, and reflections in ${targetLangName} by default, UNLESS the user prompt explicitly commands a different output language (e.g., "em português", "in Spanish"). Set "language" to the matching ISO code ("en", "pt-BR", or "es").

${LESSON_BLOCK_SCHEMAS_PROMPT}

REQUIRED TOP-LEVEL JSON OUTPUT FORMAT:
{
  "title": "Compelling, Specific Lesson Title",
  "description": "Concise 1–2 sentence transformation outcome of this lesson",
  "language": "${language || 'en'}",
  "duration_minutes": 20,
  "blocks": [ ...4 to 6 schema-compliant blocks... ]
}`;

    let promptText = `Requested Action: ${String(action).toUpperCase()}
Course Title: ${courseTitle || 'General'}
Module Title: ${moduleTitle || 'Main Module'}
Suggested Lesson Title: ${lessonTitle || 'Create an engaging, outcome-driven title'}
Core Pedagogical Goal: ${lessonGoal || 'Practical mastery and immediate real-world application'}
Additional Instructions: ${aiInstructions || 'Prioritize clarity, concrete real-world scripts/examples, and high-engagement interactivity.'}`;

    if (action === 'improve' && Array.isArray(existingBlocks) && existingBlocks.length > 0) {
      promptText += `\n\nEXISTING LESSON BLOCKS TO IMPROVE SURGICALLY (preserve IDs and strengths):\n${JSON.stringify(existingBlocks, null, 2)}`;
    }

    const contents: any[] = [];
    if (referenceImage && referenceImage.data) {
      const cleanBase64 = referenceImage.data.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: referenceImage.mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      });
      promptText += `\n\n[VISUAL BLUEPRINT ATTACHED: Reconstruct the UI mechanics, interactive flows, counters, diagnostics, and layout shown in the image faithfully using structured interactive blocks. Do NOT flatten into plain text.]`;
    }
    contents.push(promptText);

    const candidateModels = [
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-flash-latest',
    ];

    const result = await generateContentWithRetry({
      ai,
      candidateModels,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
      maxAttemptsPerModel: 1,
      baseDelayMs: 400,
      perCallTimeoutMs: 28000,
      totalBudgetMs: 52000,
      logPrefix: '[Generate Lesson API]',
      validateResponse: (text) => safeParseAiJson(text),
    });

    const responseText = result.text;

    let parsedData: any = result.parsed || null;
    if (!parsedData) {
      try {
        parsedData = safeParseAiJson(responseText);
      } catch {
        console.warn('[Generate Lesson API] Failed to parse JSON:', responseText.slice(0, 300));
        return res.status(500).json({
          error: 'The AI generated a response, but it could not be formatted as structured JSON.',
          rawText: responseText,
        });
      }
    }

    // POST-GENERATION NORMALIZATION & CONTEXT-AWARE ENFORCEMENT
    const fullTextSearch = `${lessonGoal || ''} ${aiInstructions || ''} ${lessonTitle || ''}`.toLowerCase();
    const isTrackerRequested = /tracker|no\s*-?\s*contact|desafio|challenge|contador|h[aá]bito|habit|streak|rastreador/.test(fullTextSearch);
    const isNoContactTopic = /no\s*-?\s*contact|contato\s*zero|ex\b|breakup|t[eé]rmino/.test(fullTextSearch);
    const isCalculatorRequested = /calculadora|calculator|score|pontua[cç][aã]o|prontid[aã]o|readiness/.test(fullTextSearch);
    const isAnalyzerRequested = /analyzer|analisador|an[aá]lise\s+de\s+mensagem|message\s+analy|subtexto|temperatura/.test(fullTextSearch);

    const normalizedBlocks = normalizeLessonBlocks(parsedData.blocks || [], 'block');
    const outLang = parsedData.language || language || 'en';
    const isPt = outLang.toLowerCase().startsWith('pt');
    const isEs = outLang.toLowerCase().startsWith('es');

    const hasTrackerBlock = normalizedBlocks.some((b) => b.type === 'tracker');
    const hasCalculatorBlock = normalizedBlocks.some((b) => b.type === 'readiness_evaluator');
    const hasAnalyzerBlock = normalizedBlocks.some((b) => b.type === 'ai_analyzer');

    if (isTrackerRequested && !hasTrackerBlock) {
      const topicLabel = lessonTitle?.trim() || (isNoContactTopic ? 'No Contact' : isPt ? 'Consistência Diária' : isEs ? 'Consistencia Diaria' : 'Daily Consistency');
      normalizedBlocks.push({
        id: `block_auto_tracker_${Date.now()}`,
        type: 'tracker',
        title: isPt ? `Rastreador: ${topicLabel}` : isEs ? `Rastreador: ${topicLabel}` : `${topicLabel} Tracker`,
        description: isPt
          ? 'Defina sua data de início e acompanhe sua sequência contínua dia a dia.'
          : isEs
          ? 'Define tu fecha de inicio y sigue tu racha diaria en tiempo real.'
          : 'Select your start date, track your streak, and unlock progression milestones.',
        tracker_label: isNoContactTopic
          ? (isPt ? 'Sequência de No Contact' : 'No Contact Streak Tracker')
          : `${topicLabel} Streak`,
        tracker_target_days: 30,
        tracker_milestones: [
          { day: 1, title: isPt ? 'Primeiro Dia Concluído' : isEs ? 'Primer Día Completado' : 'Day 1 Commitment', reward_badge: '🛡️' },
          { day: 7, title: isPt ? '1 Semana de Foco' : isEs ? '1 Semana de Enfoque' : '7-Day Momentum', reward_badge: '🔥' },
          { day: 14, title: isPt ? '2 Semanas Consistentes' : isEs ? '2 Semanas Consistentes' : '14-Day Clarity', reward_badge: '⚡' },
          { day: 30, title: isPt ? '30 Dias de Maestria' : isEs ? '30 Días de Maestría' : '30-Day Mastery', reward_badge: '👑' },
        ],
      });
    }

    if (isCalculatorRequested && !hasCalculatorBlock) {
      normalizedBlocks.push({
        id: `block_auto_calc_${Date.now()}`,
        type: 'readiness_evaluator',
        title: isPt ? 'Autoavaliação de Prontidão' : isEs ? 'Evaluación de Preparación' : 'Readiness Diagnostic Scorecard',
        description: isPt
          ? 'Marque as afirmações verdadeiras para calcular seu nível atual.'
          : isEs
          ? 'Marca las afirmaciones verdaderas para calcular tu nivel actual.'
          : 'Check every statement that currently holds true to calculate your readiness score.',
        items: [
          { id: 'rc1', title: isPt ? 'Compreendi os gatilhos principais desta aula sem reagir por impulso' : 'I recognize the core triggers taught in this lesson without reacting impulsively', weight: 25 },
          { id: 'rc2', title: isPt ? 'Consigo executar a técnica inicial mesmo sob pressão emocional' : 'I can execute the primary protocol even under high pressure', weight: 25 },
          { id: 'rc3', title: isPt ? 'Tenho meu plano de ação imediato definido para as próximas 24 horas' : 'I have defined my concrete next step for the next 24 hours', weight: 25 },
          { id: 'rc4', title: isPt ? 'Substituí hábitos reativos antigos por limites claros e consistentes' : 'I have replaced reactive patterns with clear, measurable boundaries', weight: 25 },
        ],
        result_tiers: [
          { min_score: 0, max_score: 50, title: isPt ? 'Fase de Base' : 'Building Foundations', recommendation: isPt ? 'Revise o protocolo da Fase 1 e pratique o plano de ação antes de avançar.' : 'Revisit the core mechanism and complete the action plan steps first.' },
          { min_score: 51, max_score: 100, title: isPt ? 'Alta Prontidão' : 'Execution Ready', recommendation: isPt ? 'Você tem clareza sólida para aplicar o próximo módulo.' : 'You have strong clarity and are ready to apply the protocol consistently.' },
        ],
      });
    }

    if (isAnalyzerRequested && !hasAnalyzerBlock) {
      normalizedBlocks.push({
        id: `block_auto_analyzer_${Date.now()}`,
        type: 'ai_analyzer',
        title: isPt ? 'Analisador de Mensagens por IA' : isEs ? 'Analizador de Mensajes con IA' : 'AI Message Diagnostic Analyzer',
        description: isPt
          ? 'Cole uma mensagem real para receber leitura de tom, subtexto e postura recomendada.'
          : 'Paste a real message to get an instant evaluation of tone, subtext, and strategic posture.',
        instructions: isPt ? 'Cole a mensagem aqui para o diagnóstico:' : 'Paste the message here for instant diagnosis:',
        placeholder: isPt ? 'Ex: "Oi, podemos conversar?"' : 'Ex: "Hey, are you free to talk?"',
        analyzer_type: 'temperature',
        analyzer_criteria: lessonGoal || lessonTitle || 'Communication intent, emotional boundaries, and strategic posture',
      });
    }

    parsedData.language = outLang;
    parsedData.blocks = normalizedBlocks;

    return res.status(200).json({
      success: true,
      lesson: parsedData,
    });
  } catch (err: any) {
    console.error('[Generate Lesson API Error]:', err);

    const errMsg = err?.message || '';
    const isQuotaError =
      err.status === 'RESOURCE_EXHAUSTED' ||
      err.status === 429 ||
      err.statusCode === 429 ||
      errMsg.includes('429') ||
      errMsg.includes('quota') ||
      errMsg.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError) {
      return res.status(429).json({
        error: 'AI request limit temporarily reached. Please wait 30 seconds and try again.',
      });
    }

    if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand')) {
      return res.status(503).json({
        error: 'AI servers are experiencing temporary high demand. Please wait a few seconds and try again.',
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

    return res.status(500).json({
      error: 'Error generating lesson with AI: ' + (cleanError || 'Unknown error'),
    });
  }
}
