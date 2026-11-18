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

const THEMATIC_VISUAL_ASSETS: Record<string, string[]> = {
  relationship: [
    'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80',
  ],
  coaching_mindset: [
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1493612276216-ee3925520721?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
  ],
  maternal_health: [
    'https://images.unsplash.com/photo-1555252333-9f8e92e65ee9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544717302-de2939b7ef71?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1200&q=80',
  ],
  default: [
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80',
  ],
};

function selectThematicCovers(topic: string, count: number): string[] {
  const t = topic.toLowerCase();
  let pool = THEMATIC_VISUAL_ASSETS.default;

  if (
    t.includes('ex') ||
    t.includes('breakup') ||
    t.includes('attraction') ||
    t.includes('love') ||
    t.includes('relat') ||
    t.includes('couple') ||
    t.includes('dating') ||
    t.includes('marriage') ||
    t.includes('casamento') ||
    t.includes('reconquista')
  ) {
    pool = THEMATIC_VISUAL_ASSETS.relationship;
  } else if (
    t.includes('mother') ||
    t.includes('baby') ||
    t.includes('matern') ||
    t.includes('parent') ||
    t.includes('family') ||
    t.includes('child') ||
    t.includes('mãe') ||
    t.includes('bebê') ||
    t.includes('pós-parto')
  ) {
    pool = THEMATIC_VISUAL_ASSETS.maternal_health;
  } else if (
    t.includes('mind') ||
    t.includes('confiden') ||
    t.includes('psychol') ||
    t.includes('habit') ||
    t.includes('leader') ||
    t.includes('career') ||
    t.includes('success') ||
    t.includes('focus') ||
    t.includes('boundary') ||
    t.includes('limites')
  ) {
    pool = THEMATIC_VISUAL_ASSETS.coaching_mindset;
  }

  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    results.push(pool[i % pool.length]);
  }
  return results;
}

export interface SalesCopySections {
  badge?: string;
  headline?: string;
  subhead?: string;
  metrics?: { value: string; label: string }[];
  problem_title?: string;
  problem_body?: string;
  problem_bottleneck?: string;
  pillars_title?: string;
  pillars?: { title: string; description: string }[];
  deliverables_title?: string;
  deliverables?: string[];
  for_you_title?: string;
  for_you?: string[];
  not_for_you_title?: string;
  not_for_you?: string[];
  guarantee_title?: string;
  guarantee_body?: string;
  guarantee_badge?: string;
  faq_title?: string;
  faqs?: { q: string; a: string }[];
  cta_top?: string;
  cta_bottom?: string;
  cta_sub?: string;
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPersuasiveSalesPageHtml(params: {
  title: string;
  subtitle: string;
  command: string;
  language?: string;
  priceTier: number;
  includeOldPrice?: boolean;
  sections?: SalesCopySections;
}): string {
  const {
    title,
    subtitle,
    command,
    language = 'en',
    priceTier,
    includeOldPrice = true,
    sections = {},
  } = params;

  const langLow = String(language || 'en').toLowerCase();
  const isPt = langLow.startsWith('pt');
  const isEs = langLow.startsWith('es');
  const isFree = Number(priceTier) <= 0;

  const priceFormatted = isFree
    ? isPt
      ? 'Acesso Gratuito'
      : isEs
      ? 'Acceso Gratuito'
      : 'Free Access'
    : (Number(priceTier) || 97).toLocaleString(isPt ? 'pt-BR' : 'en-US', {
        style: 'currency',
        currency: 'USD',
      });
  const oldPriceFormatted = (Number(priceTier) * 2 || 197).toLocaleString(
    isPt ? 'pt-BR' : 'en-US',
    { style: 'currency', currency: 'USD' }
  );

  const topic =
    command
      .trim()
      .replace(/^crie\s+um\s+curso\s+(sobre\s+|de\s+)?/i, '')
      .replace(/^create\s+a\s+course\s+(about\s+|on\s+)?/i, '') || title;

  const badge =
    sections.badge ||
    (isPt
      ? '🔥 PROGRAMA OFICIAL • ACESSO VITALÍCIO'
      : isEs
      ? '🔥 PROGRAMA OFICIAL • ACCESO DE POR VIDA'
      : '🔥 OFFICIAL MASTERCLASS • LIFETIME ACCESS');

  const headline = sections.headline || title;
  const subhead =
    sections.subhead ||
    subtitle ||
    (isPt
      ? 'Um sistema prático e estruturado para gerar clareza imediata, segurança emocional e resultados consistentes.'
      : isEs
      ? 'Un sistema práctico y estructurado para generar claridad inmediata y resultados consistentes.'
      : 'A proven, actionable transformation system engineered for immediate clarity, strategic focus, and measurable mastery.');

  const metrics =
    Array.isArray(sections.metrics) && sections.metrics.length > 0
      ? sections.metrics
      : isPt
      ? [
          { value: '100% Prático', label: 'Aplicação Passo a Passo' },
          { value: 'Acesso Vitalício', label: 'Estude no Seu Ritmo' },
          { value: 'Risco Zero', label: 'Garantia de 7 Dias' },
        ]
      : isEs
      ? [
          { value: '100% Práctico', label: 'Currículo Paso a Paso' },
          { value: 'Acceso Vitalicio', label: 'A Tu Propio Ritmo' },
          { value: 'Cero Riesgo', label: 'Garantía de 7 Días' },
        ]
      : [
          { value: '100% Practical', label: 'Step-by-Step Curriculum' },
          { value: 'Lifetime Access', label: 'Self-Paced Architecture' },
          { value: 'Zero Risk', label: '7-Day Money-Back Guarantee' },
        ];

  const ctaTop =
    sections.cta_top ||
    (isFree
      ? isPt
        ? '⚡ LIBERAR ACESSO GRATUITO AGORA'
        : isEs
        ? '⚡ DESBLOQUEAR ACCESO GRATUITO AHORA'
        : '⚡ UNLOCK FREE ACCESS NOW'
      : isPt
      ? '⚡ GARANTIR ACESSO IMEDIATO AO PROGRAMA'
      : isEs
      ? '⚡ OBTENER ACCESO INMEDIATO AHORA'
      : '⚡ GET INSTANT ACCESS NOW');

  const ctaSub =
    sections.cta_sub ||
    (isPt
      ? '🔒 Ambiente 100% Seguro • Acesso Imediato Vitalício • Garantia Incondicional de 7 Dias'
      : isEs
      ? '🔒 Pago 100% Seguro • Acceso Inmediato Vitalicio • Garantía de 7 Días'
      : '🔒 256-Bit Encrypted & Safe Checkout • Immediate Lifetime Access • 7-Day Money-Back Guarantee');

  const problemTitle =
    sections.problem_title ||
    (isPt
      ? `❌ Por Que Abordagens Superficiais Mantêm Você Presa no Mesmo Ciclo`
      : isEs
      ? `❌ Por Qué los Consejos Superficiales Te Mantienen Estancada`
      : `❌ Why Traditional Advice on ${topic} Keeps You Stuck`);

  const problemBody =
    sections.problem_body ||
    (isPt
      ? 'Tentar resolver no improviso ou seguir conselhos genéricos gera desgaste emocional e decisões impulsivas. Sem um protocolo estruturado, cada escolha parece incerta e custosa.'
      : isEs
      ? 'Improvisar bajo presión o seguir consejos genéricos genera desgaste y errores reactivos. Sin un sistema claro, cada paso se vuelve incierto.'
      : 'Relying on guesswork, generic surface advice, or raw willpower leads to burnout and reactive mistakes. Without a structured protocol, every decision feels uncertain and costly.');

  const problemBottleneck =
    sections.problem_bottleneck ||
    (isPt
      ? 'O Gargalo Real: Agir no calor da emoção sem um sistema prático de diagnóstico e resposta.'
      : isEs
      ? 'El Obstáculo Real: Reaccionar por impulso sin un protocolo claro de ejecución.'
      : 'The Core Bottleneck: Reacting under pressure without a clear, testable framework.');

  const pillarsTitle =
    sections.pillars_title ||
    (isPt
      ? '✨ Os Pilares da Metodologia'
      : isEs
      ? '✨ Los Pilares del Método'
      : '✨ The Core Architecture of Mastery');

  const pillars =
    Array.isArray(sections.pillars) && sections.pillars.length > 0
      ? sections.pillars
      : isPt
      ? [
          { title: 'Pilar 1 • Diagnóstico Claro', description: 'Identifique padrões ocultos, elimine erros reativos e construa sua base desde o primeiro dia.' },
          { title: 'Pilar 2 • Execução Tática', description: 'Checklists, simuladores de decisão e scripts reais para agir com precisão.' },
          { title: 'Pilar 3 • Consistência Prática', description: 'Rastreadores diários para consolidar hábitos sem depender apenas de motivação.' },
          { title: 'Pilar 4 • Sustentação de Longo Prazo', description: 'Critérios objetivos para manter seus resultados com segurança.' },
        ]
      : [
          { title: 'Pillar 1 • Precision Diagnostic', description: 'Uncover hidden behavioral bottlenecks, stop reactive traps, and establish your baseline from day one.' },
          { title: 'Pillar 2 • Tactical Execution', description: 'Interactive decision simulators, exact frameworks, and step-by-step action plans.' },
          { title: 'Pillar 3 • Measurable Consistency', description: 'Progress trackers and diagnostics to sustain daily momentum without guesswork.' },
          { title: 'Pillar 4 • Long-Term Grounding', description: 'Permanent boundaries and habits that compound over time.' },
        ];

  const deliverablesTitle =
    sections.deliverables_title ||
    (isPt
      ? '🎯 O Que Você Recebe ao Entrar Hoje:'
      : isEs
      ? '🎯 Lo Que Recibes Hoy:'
      : '🎯 What You Receive With Immediate Access:');

  const deliverables =
    Array.isArray(sections.deliverables) && sections.deliverables.length > 0
      ? sections.deliverables
      : isPt
      ? [
          'Acesso vitalício imediato a todos os módulos progressivos e atualizações futuras.',
          'Rastreadores interativos para acompanhar evolução e constância dia após dia.',
          'Simuladores práticos de decisão para testar respostas antes de agir na vida real.',
          'Checklists de ação imediata e exercícios de diagnóstico guiados.',
        ]
      : [
          'Full lifetime access to every progressive module and all future updates.',
          'Interactive trackers to monitor daily consistency and milestone progress.',
          'Real-world decision simulators to test responses before high-stakes moments.',
          'Guided diagnostic evaluators, concrete scripts, and immediate action plans.',
        ];

  const forYouTitle =
    sections.for_you_title ||
    (isPt ? '✅ Este Programa É Para Você Se:' : isEs ? '✅ Esto Es Para Ti Si:' : '✅ This Protocol Is For You If:');
  const forYou =
    Array.isArray(sections.for_you) && sections.for_you.length > 0
      ? sections.for_you
      : isPt
      ? [
          'Você quer parar de agir por impulso e passar a decidir com clareza.',
          'Você valoriza ferramentas práticas aplicáveis no dia a dia.',
          'Você busca transformação consistente em vez de atalhos rasos.',
        ]
      : [
          'You are ready to replace guesswork with clear, tested frameworks.',
          'You value practical interactive tools you can apply immediately.',
          'You want genuine long-term mastery instead of shallow surface tips.',
        ];

  const notForYouTitle =
    sections.not_for_you_title ||
    (isPt ? '❌ Não É Para Você Se:' : isEs ? '❌ No Es Para Ti Si:' : '❌ This Is NOT For You If:');
  const notForYou =
    Array.isArray(sections.not_for_you) && sections.not_for_you.length > 0
      ? sections.not_for_you
      : isPt
      ? [
          'Você espera soluções mágicas sem colocar as práticas em ação.',
          'Você prefere manter padrões reativos sem autorresponsabilidade.',
          'Você não está disposta a dedicar 15 minutos por dia à sua evolução.',
        ]
      : [
          'You expect effortless miracles without applying the frameworks.',
          'You prefer reactive habits over structured personal accountability.',
          'You are unwilling to invest 15 focused minutes a day.',
        ];

  const guaranteeTitle =
    sections.guarantee_title ||
    (isPt
      ? 'Garantia Incondicional de 7 Dias — Risco Zero'
      : isEs
      ? 'Garantía Incondicional de 7 Días — Cero Riesgo'
      : '100% Risk-Free 7-Day Money-Back Guarantee');
  const guaranteeBody =
    sections.guarantee_body ||
    (isPt
      ? 'Entre hoje, explore as aulas e utilize todas as ferramentas interativas. Se dentro de 7 dias você não sentir clareza prática e valor real, devolvemos 100% do seu investimento sem burocracia.'
      : isEs
      ? 'Inscríbete hoy y explora todas las lecciones y herramientas. Si en 7 días no sientes claridad real, te devolvemos el 100% sin preguntas.'
      : 'Enroll today and experience the full curriculum and interactive tools. If within 7 days you do not feel tangible clarity and practical value, request an immediate 100% refund with zero hassle.');
  const guaranteeBadge =
    sections.guarantee_badge ||
    (isPt
      ? '✓ Reembolso Integral Sem Perguntas'
      : isEs
      ? '✓ Reembolso Completo Sin Preguntas'
      : '✓ Full Refund With No Questions Asked');

  const faqTitle =
    sections.faq_title ||
    (isPt ? '❓ Perguntas Frequentes' : isEs ? '❓ Preguntas Frecuentes' : '❓ Frequently Asked Questions');
  const faqs =
    Array.isArray(sections.faqs) && sections.faqs.length > 0
      ? sections.faqs
      : isPt
      ? [
          { q: 'Como e quando recebo o acesso?', a: 'O acesso é liberado imediatamente após a confirmação e enviado direto para o seu e-mail.' },
          { q: 'Por quanto tempo terei acesso?', a: 'O acesso é vitalício. Você pode assistir e revisar as ferramentas quando quiser, no celular ou computador.' },
          { q: 'Funciona para quem está começando agora?', a: 'Sim. A trilha foi organizada do diagnóstico inicial até a aplicação avançada passo a passo.' },
        ]
      : [
          { q: 'How and when do I receive access?', a: 'Access is unlocked immediately upon confirmation and delivered straight to your account.' },
          { q: 'How long do I have access?', a: 'You receive lifetime access across desktop, tablet, and mobile so you can move at your own pace.' },
          { q: 'Does this work if I am starting from scratch?', a: 'Yes. The curriculum progresses systematically from foundational diagnostics to advanced real-world execution.' },
        ];

  const ctaBottom =
    sections.cta_bottom ||
    (isFree
      ? ctaTop
      : isPt
      ? '🚀 LIBERAR MEU ACESSO VITALÍCIO AGORA'
      : isEs
      ? '🚀 DESBLOQUEAR MI ACCESO DE POR VIDA'
      : '🚀 UNLOCK MY LIFETIME ACCESS NOW');

  const pillarColors = ['#fbbf24', '#10b981', '#60a5fa', '#c084fc'];

  return `<!DOCTYPE html>
<html lang="${isPt ? 'pt-BR' : isEs ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: #07090e; color: #f1f5f9; padding: 32px 18px 72px; line-height: 1.6; }
    .container { max-width: 820px; margin: 0 auto; }
    .top-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(245, 158, 11, 0.12); color: #fbbf24; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; padding: 6px 16px; border-radius: 9999px; border: 1px solid rgba(245, 158, 11, 0.3); margin-bottom: 16px; }
    h1 { font-size: 32px; font-weight: 900; color: #ffffff; margin-bottom: 14px; line-height: 1.22; letter-spacing: -0.025em; text-align: center; }
    .subhead { font-size: 16px; color: #94a3b8; margin-bottom: 28px; text-align: center; line-height: 1.55; max-width: 680px; margin-left: auto; margin-right: auto; }
    .metrics-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 30px; }
    .metric-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 18px; text-align: center; }
    .metric-value { font-size: 18px; font-weight: 900; color: #fbbf24; margin-bottom: 4px; }
    .metric-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .cta-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 18px 24px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; font-weight: 900; font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; border: none; border-radius: 16px; cursor: pointer; box-shadow: 0 12px 35px -5px rgba(245, 158, 11, 0.45); transition: transform 0.15s ease, filter 0.15s ease; text-decoration: none; }
    .cta-btn:hover { filter: brightness(1.08); }
    .cta-btn:active { transform: scale(0.98); }
    .cta-sub { font-size: 11.5px; color: #64748b; text-align: center; margin-top: 10px; }
    .section-title { font-size: 21px; font-weight: 900; color: #fff; margin-bottom: 16px; letter-spacing: -0.01em; }
    .card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 24px; margin-bottom: 24px; }
    .problem-box { background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 20px; padding: 24px; margin-bottom: 28px; }
    .solution-box { background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 20px; padding: 24px; margin-bottom: 28px; }
    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 18px; margin-bottom: 28px; }
    .pill { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; font-size: 13.5px; color: #cbd5e1; }
    .pill:last-child { margin-bottom: 0; }
    .check { color: #10b981; font-weight: 900; font-size: 16px; flex-shrink: 0; }
    .cross { color: #f43f5e; font-weight: 900; font-size: 16px; flex-shrink: 0; }
    .guarantee-box { background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 78, 59, 0.2)); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 22px; padding: 28px; text-align: center; margin-bottom: 32px; }
    .faq-item { border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding: 16px 0; }
    .faq-item:last-child { border-bottom: none; }
    .faq-q { font-size: 14.5px; font-weight: 800; color: #ffffff; margin-bottom: 6px; }
    .faq-a { font-size: 13px; color: #94a3b8; line-height: 1.5; }
    .price-box { text-align: center; padding: 28px 20px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 22px; margin-bottom: 24px; }
    .old-price { font-size: 14px; color: #64748b; text-decoration: line-through; }
    .new-price { font-size: 36px; font-weight: 900; color: #fbbf24; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center;">
      <span class="top-badge">${escapeHtml(badge)}</span>
      <h1>${escapeHtml(headline)}</h1>
      <p class="subhead">${escapeHtml(subhead)}</p>
    </div>

    <div class="metrics-bar">
      ${metrics
        .slice(0, 3)
        .map(
          (m) => `
      <div class="metric-card">
        <div class="metric-value">${escapeHtml(m.value)}</div>
        <div class="metric-label">${escapeHtml(m.label)}</div>
      </div>`
        )
        .join('')}
    </div>

    <div style="margin-bottom: 36px;">
      <button type="button" class="cta-btn" onclick="window.parent.postMessage({ type: 'purchase' }, '*')">
        ${escapeHtml(ctaTop)}
      </button>
      <p class="cta-sub">${escapeHtml(ctaSub)}</p>
    </div>

    <div class="problem-box">
      <h2 style="font-size: 19px; font-weight: 900; color: #fca5a5; margin-bottom: 10px;">
        ${escapeHtml(problemTitle)}
      </h2>
      <p style="font-size: 13.5px; color: #cbd5e1; line-height: 1.6; margin-bottom: 12px;">
        ${escapeHtml(problemBody)}
      </p>
      <div style="padding: 12px 16px; background: rgba(0,0,0,0.3); border-radius: 12px; font-size: 13px; color: #f87171; font-weight: 600;">
        ${escapeHtml(problemBottleneck)}
      </div>
    </div>

    <div class="card">
      <h2 class="section-title">${escapeHtml(pillarsTitle)}</h2>
      <div class="grid-2" style="margin-bottom: 0;">
        ${pillars
          .slice(0, 4)
          .map(
            (p, idx) => `
        <div style="background: rgba(255,255,255,0.02); padding: 18px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="color: ${pillarColors[idx % pillarColors.length]}; font-weight: 900; font-size: 13px; text-transform: uppercase; margin-bottom: 6px;">${escapeHtml(p.title)}</div>
          <p style="font-size: 13px; color: #cbd5e1;">${escapeHtml(p.description)}</p>
        </div>`
          )
          .join('')}
      </div>
    </div>

    <div class="solution-box">
      <h2 style="font-size: 20px; font-weight: 900; color: #34d399; margin-bottom: 14px;">
        ${escapeHtml(deliverablesTitle)}
      </h2>
      ${deliverables
        .map(
          (d) => `<div class="pill"><span class="check">✓</span><span>${escapeHtml(d)}</span></div>`
        )
        .join('')}
    </div>

    <div class="grid-2">
      <div style="background: rgba(16,185,129,0.04); border: 1px solid rgba(16,185,129,0.18); border-radius: 18px; padding: 20px;">
        <h3 style="font-size: 15px; font-weight: 900; color: #34d399; margin-bottom: 12px;">${escapeHtml(forYouTitle)}</h3>
        ${forYou
          .map((f) => `<div class="pill"><span class="check">✓</span><span>${escapeHtml(f)}</span></div>`)
          .join('')}
      </div>
      <div style="background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.18); border-radius: 18px; padding: 20px;">
        <h3 style="font-size: 15px; font-weight: 900; color: #f87171; margin-bottom: 12px;">${escapeHtml(notForYouTitle)}</h3>
        ${notForYou
          .map((nf) => `<div class="pill"><span class="cross">✕</span><span>${escapeHtml(nf)}</span></div>`)
          .join('')}
      </div>
    </div>

    ${
      !isFree
        ? `
    <div class="guarantee-box">
      <div style="font-size: 36px; margin-bottom: 10px;">🛡️</div>
      <h2 style="font-size: 21px; font-weight: 900; color: #ffffff; margin-bottom: 8px;">${escapeHtml(guaranteeTitle)}</h2>
      <p style="font-size: 13.5px; color: #cbd5e1; max-width: 600px; margin: 0 auto 16px; line-height: 1.55;">${escapeHtml(guaranteeBody)}</p>
      <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(16,185,129,0.2); border-radius: 9999px; font-size: 11px; font-weight: 800; color: #6ee7b7; text-transform: uppercase;">
        ${escapeHtml(guaranteeBadge)}
      </div>
    </div>`
        : ''
    }

    <div class="card">
      <h2 class="section-title">${escapeHtml(faqTitle)}</h2>
      ${faqs
        .map(
          (f) => `
      <div class="faq-item">
        <div class="faq-q">${escapeHtml(f.q)}</div>
        <div class="faq-a">${escapeHtml(f.a)}</div>
      </div>`
        )
        .join('')}
    </div>

    <div class="price-box">
      <span class="top-badge">${escapeHtml(badge)}</span>
      <div style="margin: 12px 0;">
        ${!isFree && includeOldPrice ? `<div class="old-price">${isPt ? 'De ' : isEs ? 'Antes ' : 'Normally '}${escapeHtml(oldPriceFormatted)}</div>` : ''}
        <div class="new-price">${isFree ? escapeHtml(priceFormatted) : `${isPt ? 'Por apenas ' : isEs ? 'Solo ' : 'Only '}${escapeHtml(priceFormatted)}`}</div>
        <div style="font-size: 12px; color: #94a3b8;">${
          isPt
            ? 'Acesso vitalício • Sem mensalidades recorrentes'
            : isEs
            ? 'Acceso vitalicio • Sin suscripciones recurrentes'
            : 'One-time enrollment • No recurring subscriptions • Lifetime Access'
        }</div>
      </div>
      <button type="button" class="cta-btn" onclick="window.parent.postMessage({ type: 'purchase' }, '*')">
        ${escapeHtml(ctaBottom)}
      </button>
      <p class="cta-sub">${escapeHtml(ctaSub)}</p>
    </div>
  </div>
</body>
</html>`;
}

function buildResilientFallbackCourse(params: {
  command: string;
  language: string;
  priceTier: number;
  includeOldPrice?: boolean;
  tone?: string;
  targetAudience?: string;
}) {
  const { command, language, priceTier, includeOldPrice = true, targetAudience } = params;
  const isPt = language.toLowerCase().startsWith('pt');
  const isEs = language.toLowerCase().startsWith('es');
  const targetPriceCents = Math.max(0, Math.round(Number(priceTier) * 100));
  const targetOldPriceCents = includeOldPrice && targetPriceCents > 0 ? Math.round(targetPriceCents * 2) : 0;

  const cleanTopic = command
    .trim()
    .replace(/^crie\s+um\s+curso\s+(sobre\s+|de\s+)?/i, '')
    .replace(/^create\s+a\s+course\s+(about\s+|on\s+)?/i, '');
  const capitalizedTopic = cleanTopic ? cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1) : 'Mastery Protocol';

  const title = isPt
    ? `Protocolo Prático: ${capitalizedTopic}`
    : isEs
    ? `Protocolo Práctico: ${capitalizedTopic}`
    : `Applied Mastery: ${capitalizedTopic}`;

  const subtitle = isPt
    ? `O método estruturado com ferramentas interativas para dominar ${cleanTopic} com clareza e constância.`
    : isEs
    ? `El método estructurado con herramientas interactivas para dominar ${cleanTopic} con claridad.`
    : `The structured behavioral and tactical protocol to master ${cleanTopic} with measurable clarity.`;

  const description = isPt
    ? `Programa completo com aulas interativas, simuladores de decisão, planos de ação imediatos e rastreadores diários.`
    : `Complete curriculum featuring interactive frameworks, decision simulators, immediate action plans, and progress trackers.`;

  const salesPageHtml = buildPersuasiveSalesPageHtml({
    title,
    subtitle,
    command,
    language,
    priceTier,
    includeOldPrice,
  });

  const course = {
    title,
    subtitle,
    description,
    price: targetPriceCents,
    old_price: targetOldPriceCents,
    category: isPt ? 'Desenvolvimento & Prática' : 'Development & Mastery',
    level: isPt ? 'Formação Completa / Masterclass' : 'Complete Masterclass',
    estimated_duration: isPt ? '4 a 6 Semanas' : '4 to 6 Weeks',
    target_audience:
      targetAudience ||
      (isPt
        ? 'Pessoas comprometidas com aplicação prática e consistência diária'
        : 'Individuals committed to structured execution and measurable change'),
    transformation_promise: isPt
      ? 'Substituir improviso e ansiedade por decisões claras, limites definidos e constância diária.'
      : 'Replace guesswork and reactive patterns with structured clarity and daily execution.',
    benefits: isPt
      ? [
          '4 módulos progressivos do diagnóstico à consolidação',
          'Simuladores práticos de decisão sob pressão',
          'Rastreador interativo de consistência com marcos',
          'Planos de ação e diagnósticos de prontidão',
          'Acesso vitalício com atualizações inclusas',
        ]
      : [
          '4 progressive modules from baseline diagnostic to mastery',
          'Interactive decision simulators for high-stakes moments',
          'Habit consistency tracker with progression milestones',
          'Immediate action plans and scored readiness evaluators',
          'Lifetime access with all future updates included',
        ],
    cta_text: targetPriceCents === 0 ? (isPt ? 'ACESSAR AGORA GRATUITAMENTE' : 'UNLOCK FREE ACCESS') : (isPt ? 'INICIAR TRANSFORMAÇÃO AGORA' : 'START TRANSFORMATION NOW'),
    premium_badge_text: isPt ? 'PROTOCOLO OFICIAL' : 'OFFICIAL PROTOCOL',
    offer_badge_text: includeOldPrice && targetPriceCents > 0 ? (isPt ? 'CONDIÇÃO ESPECIAL' : 'SPECIAL ENROLLMENT') : '',
    social_proof: isPt ? 'Metodologia estruturada passo a passo' : 'Step-by-step applied curriculum',
    payment_label_text: isPt ? 'Acesso Imediato' : 'Instant Enrollment',
    secure_payment_label: isPt ? 'Ambiente 100% Seguro' : '256-Bit Encrypted & Safe',
    instant_access_label: isPt ? 'Acesso liberado imediatamente' : 'Instant lifetime access',
    preview_enabled: true,
    preview_type: 'html',
    preview_title: title,
    preview_subtitle: subtitle,
    preview_rating: '4.9 ⭐',
    preview_students_label: isPt ? 'Trilha Guiada' : 'Guided Track',
    preview_guarantee_label: isPt ? 'Garantia de 7 Dias' : '7-Day Guarantee',
    preview_support_vip_label: isPt ? 'Suporte Dedicado' : 'Dedicated Support',
    preview_bonus_title: isPt ? 'Ferramentas Interativas Inclusas' : 'Interactive Tools Included',
    preview_modules_label: isPt ? 'Grade Curricular' : 'Structured Curriculum',
    preview_students_tag: isPt ? 'Acesso Vitalício' : 'Lifetime Access',
    preview_risk_zero_label: isPt ? 'Risco Zero' : 'Zero Risk',
    preview_guarantee_title: isPt ? 'Garantia Incondicional de 7 Dias' : '7-Day Money-Back Guarantee',
    preview_guarantee_subtitle: isPt ? 'Teste sem risco.' : 'Risk-free evaluation.',
    preview_guarantee_description: isPt
      ? 'Explore todas as aulas e ferramentas por 7 dias.'
      : 'Explore every module and interactive tool for 7 days.',
    preview_footer_cta: isPt ? 'GARANTIR ACESSO AGORA' : 'UNLOCK ACCESS NOW',
    preview_rich_text: salesPageHtml,
  };

  // All fallback blocks strictly follow BlockLessonViewer.tsx schemas!
  const modules = [
    {
      order_index: 0,
      title: isPt ? 'Módulo 1: Diagnóstico & Mecanismo Central' : 'Module 1: Baseline Diagnostic & Core Mechanism',
      description: isPt ? 'Identifique gargalos reais e interrompa padrões reativos.' : 'Identify real bottlenecks and interrupt reactive cycles.',
      objective: isPt ? 'Estabelecer clareza imediata e base estratégica.' : 'Establish immediate clarity and strategic baseline.',
      chapters: [
        {
          order_index: 0,
          title: isPt ? 'Aula 1: O Mecanismo por Trás dos Resultados' : 'Lesson 1: The Mechanism Behind Consistent Outcomes',
          description: isPt ? 'Compreenda a raiz prática do problema e o primeiro ajuste de postura.' : 'Understand the root behavioral dynamic and make your first structural shift.',
          duration_minutes: 20,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'O Mecanismo por Trás dos Resultados' : 'The Mechanism Behind Consistent Outcomes',
            description: isPt ? 'Framework inicial + contraste prático.' : 'Core framework + practical contrast.',
            language,
            duration_minutes: 20,
            blocks: [
              {
                id: 'blk_1_1',
                type: 'text',
                title: isPt ? 'A Pausa Estratégica Antes da Ação' : 'The Strategic Pause Before Action',
                description: isPt ? 'Como sair do modo reativo e recuperar controle.' : 'Moving from reactive impulse to calibrated control.',
                content: isPt
                  ? `<h3>Por Que o Improviso Falha</h3><p>A maioria das pessoas tenta mudar resultados mudando apenas o que diz na superfície, mas mantém a mesma reatividade emocional na raiz. Quando você insere uma pausa intencional antes de responder, muda completamente o equilíbrio da situação.</p><div class="p-4 bg-emerald-500/10 border-l-4 border-emerald-400 rounded-r-2xl my-4 text-emerald-200"><strong>Regra Prática:</strong> Nunca tome decisões permanentes ou envie respostas longas no pico da ansiedade. Aguarde a estabilização antes de executar.</div>`
                  : `<h3>Why Improvisation Fails</h3><p>Most people try to fix outcomes by changing surface tactics while keeping the same reactive loop underneath. Inserting a deliberate pause between trigger and response immediately restores clarity and leverage.</p><div class="p-4 bg-emerald-500/10 border-l-4 border-emerald-400 rounded-r-2xl my-4 text-emerald-200"><strong>Strategic Rule:</strong> Never send long explanations or make permanent decisions at an emotional peak. Stabilize first, then act.</div>`,
              },
              {
                id: 'blk_1_2',
                type: 'comparison',
                title: isPt ? 'Padrão Reativo vs. Protocolo Calibrado' : 'Reactive Pattern vs. Calibrated Protocol',
                description: isPt ? 'Compare a conduta comum com a abordagem eficaz.' : 'Contrast common traps with calibrated moves.',
                items: [
                  {
                    id: 'cmp_1',
                    title: isPt ? 'Momento de Pressão' : 'High-Pressure Response',
                    before_text: isPt ? 'Explicar demais, tentar convencer na hora ou agir por medo imediato.' : 'Over-explaining, rushing for immediate reassurance, or acting out of urgency.',
                    after_text: isPt ? 'Respirar, avaliar os fatos objetivos e responder de forma breve e firme.' : 'Pausing, assessing objective facts, and responding briefly with composure.',
                  },
                ],
              },
              {
                id: 'blk_1_3',
                type: 'reflection',
                title: isPt ? 'Diagnóstico Pessoal' : 'Personal Baseline Audit',
                description: isPt ? 'Mapeie onde você mais perde consistência.' : 'Identify where your consistency slips.',
                instructions: isPt
                  ? 'Qual foi a última situação em que você agiu por impulso? Qual teria sido a resposta calibrada?'
                  : 'Recall the last time urgency dictated your move. What would the calm, calibrated response have looked like?',
              },
            ],
          },
        },
        {
          order_index: 1,
          title: isPt ? 'Aula 2: Plano de Ação Imediato' : 'Lesson 2: Immediate Execution Plan',
          description: isPt ? 'Passos concretos para aplicar ainda hoje.' : 'Concrete actions to deploy within 24 hours.',
          duration_minutes: 20,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'Plano de Ação Imediato' : 'Immediate Execution Plan',
            description: isPt ? 'Checklist tático passo a passo.' : 'Step-by-step tactical checklist.',
            language,
            duration_minutes: 20,
            blocks: [
              {
                id: 'blk_1_4',
                type: 'action_plan',
                title: isPt ? 'Protocolo das Próximas 24 Horas' : 'Next 24-Hour Protocol',
                description: isPt ? 'Execute cada etapa na ordem indicada.' : 'Execute each step in order.',
                items: [
                  {
                    id: 'act_1',
                    title: isPt ? 'Definir seu gatilho principal de atenção' : 'Identify your primary reactive trigger',
                    description: isPt ? 'Anote em uma frase o momento exato em que você costuma sair do plano.' : 'Write down the exact situation where you usually break consistency.',
                    category: isPt ? 'Passo 1' : 'Step 1',
                    required: true,
                  },
                  {
                    id: 'act_2',
                    title: isPt ? 'Aplicar a regra da pausa de 15 minutos' : 'Apply the 15-minute stabilization rule',
                    description: isPt ? 'Antes de qualquer resposta importante, aguarde 15 minutos longe da tela.' : 'Before any high-stakes move, step away from screens for 15 minutes.',
                    category: isPt ? 'Passo 2' : 'Step 2',
                    required: true,
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      order_index: 1,
      title: isPt ? 'Módulo 2: Consistência Diária & Prática Guiada' : 'Module 2: Daily Consistency & Applied Practice',
      description: isPt ? 'Sustente a nova postura com acompanhamento diário e simulação.' : 'Sustain execution with daily tracking and decision practice.',
      objective: isPt ? 'Construir sequência sólida de execução.' : 'Build a measurable daily streak.',
      chapters: [
        {
          order_index: 0,
          title: isPt ? 'Aula 1: Rastreador de Consistência (21 Dias)' : 'Lesson 1: 21-Day Consistency Tracker',
          description: isPt ? 'Acompanhe seu progresso diário e conquiste marcos.' : 'Log consecutive days and hit structured milestones.',
          duration_minutes: 20,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'Rastreador de Consistência' : '21-Day Consistency Tracker',
            description: isPt ? 'Registre seu início e acompanhe sua evolução.' : 'Set your start date and build momentum.',
            language,
            duration_minutes: 20,
            blocks: [
              {
                id: 'blk_2_1',
                type: 'tracker',
                title: isPt ? 'Rastreador de Execução Diária' : 'Daily Protocol Streak Tracker',
                description: isPt ? 'Cada dia concluído fortalece seu novo padrão.' : 'Each completed day reinforces your new baseline.',
                tracker_label: isPt ? 'Sequência de Consistência' : 'Consistency Streak',
                tracker_target_days: 21,
                tracker_milestones: [
                  { day: 1, title: isPt ? 'Dia 1 Iniciado' : 'Day 1 Initiated', reward_badge: '🛡️' },
                  { day: 7, title: isPt ? '1 Semana Firme' : '7-Day Focus', reward_badge: '🔥' },
                  { day: 14, title: isPt ? '2 Semanas Sólidas' : '14-Day Clarity', reward_badge: '⚡' },
                  { day: 21, title: isPt ? 'Hábito Consolidado' : '21-Day Mastery', reward_badge: '👑' },
                ],
              },
            ],
          },
        },
        {
          order_index: 1,
          title: isPt ? 'Aula 2: Simulador de Decisões Sob Pressão' : 'Lesson 2: High-Stakes Decision Simulator',
          description: isPt ? 'Pratique escolhas reais antes de enfrentar o cenário.' : 'Rehearse realistic choices and observe consequences.',
          duration_minutes: 20,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'Simulador de Decisões' : 'High-Stakes Decision Simulator',
            description: isPt ? 'Teste seu reflexo estratégico.' : 'Test your strategic judgment.',
            language,
            duration_minutes: 20,
            blocks: [
              {
                id: 'blk_2_2',
                type: 'simulator',
                title: isPt ? 'Simulação de Cenário Crítico' : 'Critical Scenario Simulation',
                description: isPt ? 'Escolha a melhor conduta e veja o impacto.' : 'Choose your response to inspect the outcome.',
                items: [
                  {
                    id: 'sim_1',
                    title: isPt
                      ? 'Surge um imprevisto ou silêncio inesperado e você sente urgência de resolver na hora. O que você faz?'
                      : 'An unexpected setback or silence triggers urgency to react immediately. What is your next move?',
                    options: [
                      isPt ? 'Agir imediatamente buscando alívio rápido mesmo sem clareza.' : 'React right away seeking immediate relief without a clear objective.',
                      isPt ? 'Fazer uma pausa de 15 minutos, revisar o objetivo e responder de forma objetiva.' : 'Take a 15-minute pause, clarify your objective, and deliver a concise response.',
                      isPt ? 'Evitar o assunto indefinidamente sem definir próximos passos.' : 'Avoid the situation indefinitely without setting any boundary.',
                    ],
                    consequences: {
                      '0': isPt ? '❌ A urgência reduz sua clareza e reforça o padrão reativo.' : '❌ Urgency erodes composure and reinforces reactive habits.',
                      '1': isPt ? '✅ Excelente postura: preserva serenidade, clareza e autoridade.' : '✅ Optimal response: preserves clarity, boundaries, and leverage.',
                      '2': isPt ? '⚠️ Evitar totalmente deixa o ciclo aberto sem resolução.' : '⚠️ Total avoidance leaves ambiguity unresolved.',
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      order_index: 2,
      title: isPt ? 'Módulo 3: Avaliação de Prontidão & Maestria' : 'Module 3: Readiness Evaluation & Mastery',
      description: isPt ? 'Meça seu nível atual e valide os princípios essenciais.' : 'Audit your readiness score and verify mastery.',
      objective: isPt ? 'Consolidar critérios objetivos de evolução.' : 'Validate acquired skills.',
      chapters: [
        {
          order_index: 0,
          title: isPt ? 'Aula 1: Autoavaliação & Quiz Final' : 'Lesson 1: Readiness Scorecard & Validation Quiz',
          description: isPt ? 'Calcule seu índice de prontidão e teste seu domínio.' : 'Compute your readiness score and check core concepts.',
          duration_minutes: 20,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'Autoavaliação & Quiz Final' : 'Readiness & Mastery Check',
            description: isPt ? 'Diagnóstico pontuado + validação.' : 'Scored readiness evaluator + quiz.',
            language,
            duration_minutes: 20,
            blocks: [
              {
                id: 'blk_3_1',
                type: 'readiness_evaluator',
                title: isPt ? 'Índice de Prontidão Prática' : 'Practical Readiness Scorecard',
                description: isPt ? 'Marque cada afirmação verdadeira hoje.' : 'Check every statement currently true for you.',
                items: [
                  { id: 're_1', title: isPt ? 'Consigo pausar antes de responder em momentos de tensão.' : 'I pause reliably before responding in high-tension moments.', weight: 25 },
                  { id: 're_2', title: isPt ? 'Tenho clareza dos meus limites e critérios inegociáveis.' : 'My boundaries and non-negotiable standards are clearly defined.', weight: 25 },
                  { id: 're_3', title: isPt ? 'Mantenho minha rotina sem depender de validação imediata.' : 'I sustain my daily routine without seeking constant external reassurance.', weight: 25 },
                  { id: 're_4', title: isPt ? 'Aplico os passos práticos com consistência semanal.' : 'I execute the action plan consistently each week.', weight: 25 },
                ],
                result_tiers: [
                  { min_score: 0, max_score: 49, title: isPt ? 'Fase Inicial de Base' : 'Foundation Stage', recommendation: isPt ? 'Concentre-se no Módulo 1 e use o rastreador por 7 dias.' : 'Focus on Module 1 and complete 7 consecutive days on the tracker.' },
                  { min_score: 50, max_score: 79, title: isPt ? 'Consolidação em Progresso' : 'Momentum Building', recommendation: isPt ? 'Ótimo avanço. Reforce o simulador para situações críticas.' : 'Solid progress. Practice the decision simulator for edge cases.' },
                  { min_score: 80, max_score: 100, title: isPt ? 'Domínio Consolidado' : 'Mastery Ready', recommendation: isPt ? 'Postura consistente e pronta para manutenção contínua.' : 'Strong grounded consistency ready for long-term maintenance.' },
                ],
              },
              {
                id: 'blk_3_2',
                type: 'quiz',
                title: isPt ? 'Validação dos Princípios' : 'Core Principle Quiz',
                description: isPt ? 'Confirme a distinção essencial.' : 'Verify the key behavioral distinction.',
                items: [
                  {
                    id: 'qz_1',
                    title: isPt ? 'Qual é a primeira ação ao perceber um gatilho emocional intenso?' : 'What is the immediate first step when a strong emotional trigger hits?',
                    options: [
                      isPt ? 'Responder imediatamente para encerrar a dúvida' : 'Respond immediately to relieve tension',
                      isPt ? 'Inserir uma pausa consciente antes de qualquer atitude' : 'Insert a deliberate pause before taking any action',
                      isPt ? 'Ignorar o próprio objetivo para agradar na hora' : 'Drop your boundary to keep instant peace',
                    ],
                    correct_option_index: 1,
                    explanation: isPt
                      ? 'A pausa consciente interrompe o ciclo automático e devolve clareza estratégica.'
                      : 'A deliberate pause breaks the reactive loop and restores strategic clarity.',
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  ];

  return { course, modules };
}

export async function handleBuildCompleteCourse(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      command,
      referenceImage,
      language = 'en',
      priceTier = 97,
      includeOldPrice = true,
      tone = 'authoritative_empathetic',
      targetAudience,
    } = req.body || {};

    if (!command || typeof command !== 'string' || !command.trim()) {
      return res.status(400).json({ error: 'A course command or instruction is required.' });
    }

    const ai = getAiClient();
    const candidateModels = [
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-flash-latest',
    ];

    const numericPrice = Math.max(0, Number(priceTier) || 0);
    const targetPriceCents = Math.round(numericPrice * 100);
    const isFreeCourse = targetPriceCents === 0;
    const targetOldPriceCents = !isFreeCourse && includeOldPrice ? Math.round(targetPriceCents * 2) : 0;

    const targetLangName = resolveLanguageName(language);
    const toneInstruction = TONE_DIRECTIVES[tone] || TONE_DIRECTIVES.authoritative_empathetic;

    console.log(`[AI Course Factory] Generating complete course for command: "${command.slice(0, 60)}..." in ${targetLangName}`);

    const systemInstruction = `You are a Principal Instructional Designer, Behavioral Product Architect, and Direct-Response EdTech Strategist.
Your mission is to architect a COMPLETE, COHESIVE, IMMEDIATELY PUBLISHABLE COURSE in strict JSON.

${toneInstruction}

CRITICAL ARCHITECTURAL RULES:
1. CURRICULUM DEPTH OVER BOILERPLATE (MOST IMPORTANT):
   - Output 3 to 4 progressive modules forming a genuine transformation arc:
     • Module 1: Diagnosis, Mental Models & Root Mechanisms
     • Module 2: Core Protocols & Behavioral Rewiring
     • Module 3: Real-World Application, Edge Cases & Practice
     • Module 4 (optional/consolidation): Readiness Audit & Long-Term Sustainment
   - MANDATORY ARRAY COUNTS: "modules" MUST have 3 or 4 items, and EACH module's "chapters" array MUST contain 2 or 3 distinct lessons (minimum 6 lessons total, never 1 lesson per module).
   - EVERY single lesson MUST be a rich multi-block interactive experience (2 to 4 cohesive blocks per lesson — NEVER 1-sentence stubs!).
   - Vary interactive blocks intelligently across the course so the student gets:
     • Rich "text" blocks (real mechanisms, concrete scripts/examples, <div class='p-4 bg-emerald-500/10 border-l-4 border-emerald-400 rounded-r-2xl my-4 text-emerald-200'><strong>Strategic Rule:</strong> ...</div> callouts — ALWAYS use single quotes inside HTML attributes so JSON strings remain valid)
     • At least 1 "comparison" block and 1 "timeline" or "chart" block
     • At least 1 "simulator" block (realistic nuanced traps + clear "consequences")
     • At least 1 "readiness_evaluator" block (with weighted "items" and calibrated "result_tiers")
     • At least 1 "tracker" block ONLY IF daily streaks/habits fit the subject (tailor "tracker_label" & "tracker_milestones" strictly to THIS course topic!)
     • At least 1 "ai_analyzer" block ONLY IF analyzing messages/communication fits the subject
     • "action_plan" / "checklist", "quiz", and "reflection" blocks distributed naturally.

2. STRUCTURED SALES COPY (ZERO BLOATED HTML CSS):
   - Do NOT waste tokens writing raw CSS or full <html> documents!
   - Populate "sales_copy_sections" with concise, high-converting, domain-specific copy strings; our template engine will compile it into responsive luxury HTML automatically.
   - ${isFreeCourse ? 'PRICING: This is a FREE ($0) lead-magnet course. Set "price": 0, "old_price": 0, "offer_badge_text": "", and position CTAs around free instant enrollment.' : `PRICING: "price": ${targetPriceCents}, "old_price": ${targetOldPriceCents}. Include authentic value framing without fake hype.`}

3. ANTI-CLICHÉ WRITING STANDARD:
   - Never use hollow buzzwords ("unlock your true potential", "game-changer", "embark on a journey", "deep dive"). Write concrete mechanisms, exact phrasing examples, measurable actions, and grounded coaching prompts.
   - NEVER invent exaggerated fake claims or cartoonish simulator options.

4. STRICT LANGUAGE MANDATE:
   - Write ALL titles, subtitles, benefits, sales_copy_sections, module titles, lesson content, simulator choices, quizzes, and reflections STRICTLY in ${targetLangName}.

${LESSON_BLOCK_SCHEMAS_PROMPT}

REQUIRED JSON OUTPUT FORMAT:
{
  "course": {
    "title": "Sharp, Benefit-Driven Course Title in ${targetLangName}",
    "subtitle": "Clear mechanism + transformation sub-headline in ${targetLangName}",
    "description": "2-sentence overview in ${targetLangName}",
    "price": ${targetPriceCents},
    "old_price": ${targetOldPriceCents},
    "category": "Specific Category in ${targetLangName}",
    "level": "Complete Applied Program",
    "estimated_duration": "4 Weeks",
    "target_audience": "Specific student profile in ${targetLangName}",
    "transformation_promise": "Concrete before-to-after shift",
    "benefits": ["5 tangible, specific deliverables in ${targetLangName}"],
    "cta_text": "ACTION CTA IN ${targetLangName}",
    "premium_badge_text": "SHORT BADGE IN ${targetLangName}",
    "offer_badge_text": "${!isFreeCourse && includeOldPrice ? 'SPECIAL ENROLLMENT' : ''}",
    "social_proof": "Structured step-by-step protocol",
    "payment_label_text": "Instant & Secure Access",
    "secure_payment_label": "256-Bit Encrypted & Safe",
    "instant_access_label": "Immediate Lifetime Access",
    "preview_enabled": true,
    "preview_title": "Sales Headline in ${targetLangName}",
    "preview_subtitle": "Sales Sub-headline in ${targetLangName}",
    "preview_rating": "4.9 ⭐",
    "preview_students_label": "Guided Curriculum",
    "preview_guarantee_label": "7-Day Guarantee",
    "preview_support_vip_label": "Dedicated Support",
    "preview_bonus_title": "Included Interactive Tools",
    "preview_modules_label": "Curriculum Structure",
    "preview_students_tag": "Lifetime Access",
    "preview_risk_zero_label": "Zero Risk",
    "preview_guarantee_title": "7-Day Money-Back Guarantee",
    "preview_guarantee_subtitle": "Evaluate the entire program risk-free",
    "preview_guarantee_description": "Concise guarantee terms in ${targetLangName}",
    "preview_footer_cta": "ENROLL NOW IN ${targetLangName}",
    "sales_copy_sections": {
      "badge": "SHORT TOP BADGE",
      "headline": "Specific Magnetic Headline in ${targetLangName}",
      "subhead": "2-line promise explaining WHO this is for and WHAT shifts",
      "metrics": [
        { "value": "Metric 1", "label": "Label 1" },
        { "value": "Metric 2", "label": "Label 2" },
        { "value": "Metric 3", "label": "Label 3" }
      ],
      "problem_title": "Specific Pain/Myth Headline",
      "problem_body": "Why conventional advice fails in this specific domain",
      "problem_bottleneck": "The Core Bottleneck: crisp 1-sentence root cause",
      "pillars_title": "Method Architecture Title",
      "pillars": [
        { "title": "Pillar 1 • Name", "description": "Concrete capability built" },
        { "title": "Pillar 2 • Name", "description": "Concrete capability built" },
        { "title": "Pillar 3 • Name", "description": "Concrete capability built" },
        { "title": "Pillar 4 • Name", "description": "Concrete capability built" }
      ],
      "deliverables_title": "What You Receive Today",
      "deliverables": ["4 specific curriculum/tool deliverables"],
      "for_you_title": "This Is For You If:",
      "for_you": ["3 specific qualifying points"],
      "not_for_you_title": "This Is NOT For You If:",
      "not_for_you": ["3 disqualifying points"],
      "guarantee_title": "7-Day Risk-Free Guarantee",
      "guarantee_body": "Clear reassuring terms",
      "faqs": [
        { "q": "Domain-specific objection 1?", "a": "Clear reassuring answer." },
        { "q": "Domain-specific objection 2?", "a": "Clear reassuring answer." },
        { "q": "Domain-specific objection 3?", "a": "Clear reassuring answer." }
      ]
    },
    "art_direction": {
      "mood": "Visual mood description",
      "color_palette": ["#0F172A", "#1E293B", "#10B981", "#F8FAFC"],
      "cover_prompt": "Editorial cover prompt"
    }
  },
  "modules": [
    {
      "order_index": 0,
      "title": "Module 1: Title in ${targetLangName}",
      "description": "Module pedagogical focus",
      "objective": "Measurable module outcome",
      "chapters": [
        {
          "order_index": 0,
          "title": "Lesson 1: Title",
          "description": "1-sentence summary",
          "duration_minutes": 20,
          "content_type": "interactive",
          "interactive_content": {
            "title": "Lesson Title",
            "description": "Lesson summary",
            "language": "${language}",
            "duration_minutes": 20,
            "blocks": [ ...2 to 4 schema-compliant blocks... ]
          }
        }
      ]
    }
  ]
}`;

    const userPrompt = `Design a complete, specialist-grade course from this command:
"${command}"

PARAMETERS:
- Output Language: ${targetLangName} (ALL text strictly in ${targetLangName})
- Price Tier: $${numericPrice} ${isFreeCourse ? '(FREE COURSE)' : ''}
- Tone: ${tone}
${targetAudience ? `- Target Audience: ${targetAudience}` : ''}

MANDATORY OUTPUT STRUCTURE:
- Generate 3–4 modules in "modules".
- Inside EACH module, generate 2–3 distinct lessons in "chapters" (minimum 6 lessons total — DO NOT return only 1 lesson per module).
- Inside EACH lesson, generate 2–4 rich interactive blocks following the exact schemas.`;

    const contents: any[] = [];
    if (referenceImage && typeof referenceImage === 'string') {
      if (referenceImage.startsWith('data:image/')) {
        const matches = referenceImage.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          contents.push({
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2],
                },
              },
              { text: userPrompt },
            ],
          });
        } else {
          contents.push({ role: 'user', parts: [{ text: userPrompt }] });
        }
      } else {
        contents.push({ role: 'user', parts: [{ text: `${userPrompt}\nReference Image URL: ${referenceImage}` }] });
      }
    } else {
      contents.push({ role: 'user', parts: [{ text: userPrompt }] });
    }

    let parsedData: any = null;
    let isFallback = false;

    try {
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
        perCallTimeoutMs: 42000,
        totalBudgetMs: 85000,
        logPrefix: '[AI Course Factory]',
        validateResponse: (text) => {
          const parsed = safeParseAiJson(text);
          if (!parsed || typeof parsed !== 'object' || !parsed.course || !Array.isArray(parsed.modules) || parsed.modules.length === 0) {
            throw new Error('Parsed JSON missing required course or modules structure');
          }
          return parsed;
        },
      });

      console.log(`[AI Course Factory] Successfully received generation from model ${result.modelUsed}`);
      parsedData = result.parsed || safeParseAiJson(result.text);
    } catch (genError: any) {
      console.info('[AI Course Factory] Engaging resilient fallback after model attempts:', genError?.message || genError);

      parsedData = buildResilientFallbackCourse({
        command,
        language,
        priceTier: numericPrice,
        includeOldPrice,
        tone,
        targetAudience,
      });
      isFallback = true;
    }

    const coursePayload = parsedData.course || {};
    coursePayload.preview_type = 'html';
    const modulesPayload = Array.isArray(parsedData.modules) ? parsedData.modules : [];

    // Compile clean responsive HTML sales page from structured AI sections (or preserve valid custom HTML in target language)
    const rawPreview = (coursePayload.preview_rich_text || '').trim();
    if (coursePayload.sales_copy_sections || !rawPreview || rawPreview.length < 250 || rawPreview.includes('vsl-box') || rawPreview.includes('play-btn')) {
      coursePayload.preview_rich_text = buildPersuasiveSalesPageHtml({
        title: coursePayload.title || 'Applied Mastery Protocol',
        subtitle: coursePayload.subtitle || 'Complete Curriculum',
        command,
        language,
        priceTier: numericPrice,
        includeOldPrice,
        sections: coursePayload.sales_copy_sections,
      });
    }
    delete coursePayload.sales_copy_sections;

    // Assign coherent visual covers
    const totalChapters = modulesPayload.reduce((acc: number, m: any) => {
      const chs = Array.isArray(m.chapters) ? m.chapters : Array.isArray(m.lessons) ? m.lessons : [];
      return acc + (chs.length || 0);
    }, 0);
    const coverUrls = selectThematicCovers(command + ' ' + (coursePayload.title || ''), Math.max(totalChapters + 1, 8));

    coursePayload.cover_url = coverUrls[0];
    coursePayload.premium_cover_url = coverUrls[0];
    coursePayload.is_active = true;
    coursePayload.is_free = isFreeCourse;
    coursePayload.is_bonus = false;
    coursePayload.price = targetPriceCents;
    coursePayload.old_price = targetOldPriceCents;

    let coverIdx = 1;
    for (let mIdx = 0; mIdx < modulesPayload.length; mIdx++) {
      const mod = modulesPayload[mIdx];
      mod.order_index = mIdx;
      mod.title = mod.title || mod.name || (language.startsWith('pt') ? `Módulo ${mIdx + 1}` : `Module ${mIdx + 1}`);

      let rawChapters: any[] = [];
      if (Array.isArray(mod.chapters) && mod.chapters.length > 0) {
        rawChapters = mod.chapters;
      } else if (Array.isArray(mod.lessons) && mod.lessons.length > 0) {
        rawChapters = mod.lessons;
      }

      if (rawChapters.length === 0) {
        rawChapters = [
          {
            order_index: 0,
            title: language.startsWith('pt') ? `Aula 1: Fundamentos & Diagnóstico` : `Lesson 1: Foundations & Diagnostic`,
            description: language.startsWith('pt') ? `Compreensão do mecanismo e primeiros passos.` : `Understanding the mechanism and immediate first steps.`,
            duration_minutes: 20,
            content_type: 'interactive',
            interactive_content: {
              title: language.startsWith('pt') ? `Fundamentos & Diagnóstico` : `Foundations & Diagnostic`,
              description: language.startsWith('pt') ? `Base prática do módulo.` : `Core module foundation.`,
              language,
              duration_minutes: 20,
              blocks: [
                {
                  id: 'blk_1',
                  type: 'text',
                  title: language.startsWith('pt') ? 'Princípio Estratégico' : 'Strategic Principle',
                  content: language.startsWith('pt')
                    ? `<h3>Fundamentos Práticos</h3><p>Aplique as diretrizes deste módulo para ganhar clareza e consistência imediata.</p>`
                    : `<h3>Core Foundations</h3><p>Apply the guidelines in this module to establish immediate clarity and consistency.</p>`,
                },
              ],
            },
          },
        ];
      }

      mod.chapters = rawChapters;
      mod.lessons = rawChapters;

      for (let cIdx = 0; cIdx < mod.chapters.length; cIdx++) {
        const chap = mod.chapters[cIdx];
        chap.order_index = cIdx;
        chap.cover_url = coverUrls[coverIdx % coverUrls.length];
        coverIdx++;
        chap.is_free = cIdx === 0 && mIdx === 0;
        chap.is_preview = chap.is_free;
        chap.duration_minutes = Number(chap.duration_minutes) || 20;
        chap.content_type = 'interactive';

        let interactiveObj = chap.interactive_content;
        if (!interactiveObj && typeof chap.rich_text === 'string' && chap.rich_text.trim().startsWith('{')) {
          try {
            interactiveObj = JSON.parse(chap.rich_text);
          } catch {}
        }

        if (interactiveObj && typeof interactiveObj === 'object') {
          interactiveObj.blocks = normalizeLessonBlocks(interactiveObj.blocks || [], `blk_${mIdx}_${cIdx}`);
          interactiveObj.language = interactiveObj.language || language;
          interactiveObj.title = interactiveObj.title || chap.title;
          interactiveObj.description = interactiveObj.description || chap.description || '';
          chap.interactive_content = interactiveObj;
          chap.rich_text = JSON.stringify(interactiveObj);
        } else {
          const fallbackInteractive = {
            title: chap.title,
            description: chap.description || '',
            language,
            duration_minutes: chap.duration_minutes,
            blocks: [
              {
                id: `blk_${mIdx}_${cIdx}_0`,
                type: 'text',
                title: chap.title,
                description: chap.description || '',
                content: `<h3>${escapeHtml(chap.title)}</h3><p>${escapeHtml(chap.description || 'Core lesson guide.')}</p>`,
              },
            ],
          };
          chap.interactive_content = fallbackInteractive;
          chap.rich_text = JSON.stringify(fallbackInteractive);
        }
      }
    }

    return res.status(200).json({
      success: true,
      isFallback,
      course: coursePayload,
      modules: modulesPayload,
      stats: {
        totalModules: modulesPayload.length,
        totalChapters,
        estimatedDuration: coursePayload.estimated_duration || '4 Weeks',
        targetAudience: coursePayload.target_audience,
      },
    });
  } catch (error: any) {
    console.error('[AI Course Factory] Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error while building course with AI',
    });
  }
}
