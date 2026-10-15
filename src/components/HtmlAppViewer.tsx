import React, { useState, useRef, useEffect, useId } from 'react';
import { AlertCircle, RotateCcw, ExternalLink } from 'lucide-react';

export interface HtmlAppViewerProps {
  htmlContent?: string | null;
  title?: string;
  className?: string;
  minHeight?: number | string;
  onComplete?: () => void;
}

export const SAMPLE_SALES_MODAL_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Oferta Especial</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: #090d16; color: #f8fafc; padding: 24px 16px; line-height: 1.5; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; padding: 5px 12px; border-radius: 9999px; border: 1px solid rgba(245, 158, 11, 0.3); margin-bottom: 12px; }
    h2 { font-size: 24px; font-weight: 900; color: #ffffff; margin-bottom: 8px; line-height: 1.25; letter-spacing: -0.02em; }
    .lead { font-size: 14px; color: #94a3b8; margin-bottom: 20px; }
    .card { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 18px; margin-bottom: 16px; }
    .benefit { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; font-size: 13px; color: #e2e8f0; }
    .benefit:last-child { margin-bottom: 0; }
    .check { color: #10b981; font-weight: bold; font-size: 14px; shrink-0; }
    .cta-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 16px 20px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; border: none; border-radius: 14px; cursor: pointer; box-shadow: 0 10px 25px -5px rgba(245, 158, 11, 0.4); transition: transform 0.15s ease; }
    .cta-btn:active { transform: scale(0.98); }
    .guarantee { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 11px; color: #64748b; margin-top: 12px; text-align: center; }
  </style>
</head>
<body>
  <div style="max-width: 520px; margin: 0 auto; text-align: center;">
    <span class="badge">🔥 Oferta por Tempo Limitado</span>
    <h2>Acesso Completo e Imediato</h2>
    <p class="lead">Desbloqueie todo o conteúdo exclusivo, materiais em PDF e suporte prioritário.</p>
    
    <div class="card" style="text-align: left;">
      <div class="benefit"><span class="check">✓</span><span>Acesso vitalício a todos os módulos e futuras atualizações</span></div>
      <div class="benefit"><span class="check">✓</span><span>Download de materiais de apoio, checklists e resumos</span></div>
      <div class="benefit"><span class="check">✓</span><span>Certificado de conclusão reconhecido</span></div>
      <div class="benefit"><span class="check">✓</span><span>Suporte individual para tirar todas as dúvidas</span></div>
    </div>

    <button type="button" class="cta-btn" onclick="window.parent.postMessage({ type: 'purchase' }, '*')">
      ⚡ Desbloquear Acesso Agora
    </button>
    <div class="guarantee">
      🔒 Pagamento 100% Seguro &nbsp;•&nbsp; 7 Dias de Garantia
    </div>
  </div>
</body>
</html>`;

export const SAMPLE_SALES_PREVIEW_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Página de Apresentação</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: #080c14; color: #f1f5f9; padding: 32px 16px 48px; line-height: 1.6; }
    .container { max-width: 780px; margin: 0 auto; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; padding: 6px 14px; border-radius: 9999px; border: 1px solid rgba(59, 130, 246, 0.3); margin-bottom: 16px; }
    h1 { font-size: 28px; font-weight: 900; color: #ffffff; margin-bottom: 12px; line-height: 1.25; letter-spacing: -0.02em; }
    .subhead { font-size: 15px; color: #94a3b8; margin-bottom: 28px; }
    .vsl-box { position: relative; width: 100%; aspect-ratio: 16/9; background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 28px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6); }
    .play-btn { width: 64px; height: 64px; border-radius: 50%; background: #f59e0b; color: #000; display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; box-shadow: 0 0 30px rgba(245, 158, 11, 0.6); transition: transform 0.2s; }
    .play-btn:hover { transform: scale(1.08); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 16px; padding: 20px; }
    .card h3 { font-size: 15px; color: #fff; margin-bottom: 8px; font-weight: 800; }
    .card p { font-size: 13px; color: #94a3b8; }
    .cta-banner { background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.05)); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 20px; padding: 28px; text-align: center; }
    .cta-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 16px 32px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; border: none; border-radius: 14px; cursor: pointer; box-shadow: 0 12px 30px -5px rgba(245, 158, 11, 0.5); }
    .cta-btn:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center;">
      <span class="badge">Apresentação Oficial</span>
      <h1>Domine Cada Detalhe na Prática</h1>
      <p class="subhead">Veja uma demonstração do que você terá acesso imediato após a inscrição.</p>
    </div>

    <div class="vsl-box">
      <div class="play-btn" onclick="alert('Substitua este elemento pelo iframe do seu vídeo ou player externo!')">▶</div>
      <span style="font-size: 11px; color: #94a3b8; margin-top: 12px; font-weight: 600;">Clique para assistir a apresentação</span>
    </div>

    <div class="grid">
      <div class="card">
        <h3>🚀 Metodologia Testada</h3>
        <p>Aprenda com passo a passo estruturado e sem enrolação, direto ao ponto.</p>
      </div>
      <div class="card">
        <h3>💡 Exemplos Reais</h3>
        <p>Aplicações práticas para você implementar no seu dia a dia.</p>
      </div>
      <div class="card">
        <h3>🏆 Suporte Exclusivo</h3>
        <p>Tire suas dúvidas diretamente com nossa equipe de especialistas.</p>
      </div>
    </div>

    <div class="cta-banner">
      <h2 style="font-size: 20px; margin-bottom: 8px; color: #fff;">Pronto para transformar seus resultados?</h2>
      <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 20px;">Comece agora mesmo com garantia incondicional de 7 dias.</p>
      <button type="button" class="cta-btn" onclick="window.parent.postMessage({ type: 'purchase' }, '*')">
        QUERO GARANTIR MINHA VAGA
      </button>
    </div>
  </div>
</body>
</html>`;

export const SAMPLE_HTML_APP = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Aula Interativa</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    body {
      background: #090d16;
      color: #f8fafc;
      padding: 32px 20px 48px 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 18px;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    h1 {
      font-size: 32px;
      font-weight: 900;
      color: #ffffff;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .lead {
      font-size: 16px;
      color: #94a3b8;
      margin-bottom: 32px;
      line-height: 1.6;
    }
    .hero-card {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9));
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 28px;
      margin-bottom: 32px;
      box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    .feature-card {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 20px;
      padding: 24px;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .feature-card:hover {
      transform: translateY(-2px);
      border-color: rgba(16, 185, 129, 0.3);
    }
    .feature-icon {
      width: 44px;
      height: 44px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      margin-bottom: 16px;
    }
    h3 {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
    }
    p {
      font-size: 14px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .interactive-section {
      background: #0d1322;
      border: 1px solid #1e293b;
      border-radius: 24px;
      padding: 28px;
      margin-top: 24px;
    }
    .checklist-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      margin-bottom: 10px;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
    }
    .checklist-item:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .checklist-item.checked {
      border-color: rgba(16, 185, 129, 0.4);
      background: rgba(16, 185, 129, 0.08);
    }
    .checkbox {
      width: 22px;
      height: 22px;
      border-radius: 7px;
      border: 2px solid #475569;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 12px;
      color: transparent;
    }
    .checklist-item.checked .checkbox {
      background: #10b981;
      border-color: #10b981;
      color: #022c22;
      font-weight: 900;
    }
    @media (max-width: 640px) {
      body {
        padding: 20px 16px 36px 16px;
      }
      h1 {
        font-size: 26px;
      }
      .hero-card {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">Página HTML Completa</span>
    <h1>Bem-vindo à Sua Aula em HTML</h1>
    <p class="lead">
      Esta é uma página de exemplo criada externamente com HTML, CSS e JavaScript. Ela ocupa a página de forma nativa e integrada ao aplicativo.
    </p>

    <div class="hero-card">
      <h3>🚀 100% Responsivo e Nativo</h3>
      <p>
        Qualquer layout de página externa adicionado aqui se adapta perfeitamente a celulares, tablets e computadores, mantendo a barra de progresso no topo e o botão de conclusão na parte inferior.
      </p>
    </div>

    <div class="grid">
      <div class="feature-card">
        <div class="feature-icon">✨</div>
        <h3>Design Livre</h3>
        <p>Use seus próprios frameworks, Tailwind via CDN, animações CSS, imagens e formulários sem restrições.</p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">⚡</div>
        <h3>Scripts e Interações</h3>
        <p>Execute lógicas em JavaScript, calculadoras, vídeos incorporados, simulações ou questionários.</p>
      </div>
    </div>

    <div class="interactive-section">
      <h3 style="margin-bottom: 16px;">📋 Checklist Prático da Aula</h3>
      <div class="checklist-item" onclick="toggleItem(this)">
        <div class="checkbox">✓</div>
        <span>Compreender a estrutura de tópicos da aula</span>
      </div>
      <div class="checklist-item" onclick="toggleItem(this)">
        <div class="checkbox">✓</div>
        <span>Analisar os exemplos práticos destacados</span>
      </div>
      <div class="checklist-item" onclick="toggleItem(this)">
        <div class="checkbox">✓</div>
        <span>Aplicar o conhecimento no exercício diário</span>
      </div>
    </div>
  </div>

  <script>
    function toggleItem(el) {
      el.classList.toggle('checked');
    }
  </script>
</body>
</html>`;

/**
 * Injeta runtime de comunicação de altura segura e integração fluida no HTML
 */
function prepareNativeHtml(rawHtml: string, frameId: string): string {
  const injection = `
<style id="pwa-mini-app-runtime-style">
  html {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  *, *:before, *:after {
    box-sizing: border-box;
  }
  #pwa-mini-app-root {
    width: 100% !important;
    min-height: 0 !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }
  img, video, canvas {
    max-width: 100%;
  }
</style>
<script id="pwa-mini-app-height-bridge">
(function() {
  var FRAME_ID = "${frameId}";
  var lastSentHeight = 0;
  var lastWidth = window.innerWidth;
  var timer = null;

  function measureHeight() {
    var root = document.getElementById('pwa-mini-app-root') || document.body;
    var doc = document.documentElement;
    var b = document.body;
    if (!root) return 0;

    var rootRect = root.getBoundingClientRect();
    var offsetH = root.offsetHeight || 0;
    var rectH = rootRect.height || 0;
    var docScrollH = doc ? (doc.scrollHeight || 0) : 0;
    var bodyScrollH = b ? (b.scrollHeight || 0) : 0;
    var rootScrollH = root.scrollHeight || 0;

    var maxBottom = 0;
    var children = root.children;
    if (children) {
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.id === 'pwa-mini-app-runtime-style' || child.id === 'pwa-mini-app-height-bridge') continue;
        if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'LINK') continue;

        var style = window.getComputedStyle(child);
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        var r = child.getBoundingClientRect();
        var mb = parseFloat(style.marginBottom) || 0;
        var bottom = (r.bottom - rootRect.top) + mb;
        if (bottom > maxBottom) {
          maxBottom = bottom;
        }
      }
    }

    var calculated = Math.max(offsetH, rectH, maxBottom, docScrollH, bodyScrollH, rootScrollH);
    return Math.ceil(calculated);
  }

  function notifyParent(force) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function() {
      var h = measureHeight();
      if (h > 0 && (force || Math.abs(h - lastSentHeight) >= 2)) {
        lastSentHeight = h;
        window.parent.postMessage({
          type: 'mini-app-height',
          frameId: FRAME_ID,
          height: h
        }, '*');
      }
    }, 25);
  }

  // Notificação inicial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { notifyParent(true); });
  } else {
    notifyParent(true);
  }
  window.addEventListener('load', function() { 
    notifyParent(true);
    setTimeout(function() { notifyParent(true); }, 250);
  });

  // Abertura de links externos com segurança
  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }
    if (target && target.tagName === 'A' && target.href) {
      if (/^https?:\\/\\//i.test(target.href) && !target.target) {
        target.target = '_blank';
        target.rel = 'noopener noreferrer';
      }
    }
  }, true);

  // Monitora redimensionamento de janela
  window.addEventListener('resize', function() {
    var currentWidth = window.innerWidth;
    if (Math.abs(currentWidth - lastWidth) > 4) {
      lastWidth = currentWidth;
      notifyParent(true);
    }
  });

  // ResizeObserver no root
  if (window.ResizeObserver) {
    try {
      var rootEl = document.getElementById('pwa-mini-app-root') || document.body;
      if (rootEl) {
        var ro = new ResizeObserver(function() {
          notifyParent(false);
        });
        ro.observe(rootEl);
      }
    } catch (e) {}
  }

  // MutationObserver para nós dinâmicos
  if (window.MutationObserver) {
    try {
      var targetEl = document.getElementById('pwa-mini-app-root') || document.body;
      if (targetEl) {
        var mo = new MutationObserver(function() {
          notifyParent(false);
        });
        mo.observe(targetEl, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });
      }
    } catch (e) {}
  }

  // Ações do usuário
  var events = ['click', 'touchend', 'input', 'change'];
  for (var k = 0; k < events.length; k++) {
    document.addEventListener(events[k], function() {
      notifyParent(false);
      setTimeout(function() { notifyParent(false); }, 150);
    }, { passive: true });
  }
})();
</script>
`;

  let processed = rawHtml;

  // Garante meta viewport se for documento HTML mas não tiver viewport
  if (/<head>/i.test(processed) && !/viewport/i.test(processed)) {
    processed = processed.replace(
      /<head>/i,
      '<head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">'
    );
  }

  // Envolve o conteúdo do <body> em um wrapper isolado
  if (/<body[^>]*>/i.test(processed) && /<\/body>/i.test(processed)) {
    processed = processed.replace(/<body([^>]*)>([\s\S]*?)<\/body>/i, (_match, bodyAttrs, bodyContent) => {
      return `<body${bodyAttrs}><div id="pwa-mini-app-root">${bodyContent}</div>${injection}</body>`;
    });
  } else if (/<\/html>/i.test(processed)) {
    processed = processed.replace(/([\s\S]*?)<\/html>/i, (_match, beforeHtml) => {
      return `<div id="pwa-mini-app-root">${beforeHtml}</div>${injection}</html>`;
    });
  } else {
    processed = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
</head>
<body>
  <div id="pwa-mini-app-root">
    ${processed}
  </div>
  ${injection}
</body>
</html>`;
  }

  return processed;
}

export default function HtmlAppViewer({
  htmlContent,
  title,
  className = '',
  minHeight = 0,
  onComplete
}: HtmlAppViewerProps) {
  const reactId = useId();
  const frameIdRef = useRef<string>(`html-lesson-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`);
  const numericMinHeight = typeof minHeight === 'number' ? minHeight : parseInt(String(minHeight), 10) || 0;

  const [height, setHeight] = useState<number>(numericMinHeight > 0 ? numericMinHeight : 450);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasLoadError, setHasLoadError] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const hasMeasuredRef = useRef<boolean>(false);

  const loopGuardRef = useRef<{ count: number; lastTime: number }>({ count: 0, lastTime: 0 });

  const trimmedHtml = (htmlContent || '').trim();
  const isDirectUrl = /^https?:\/\//i.test(trimmedHtml);

  // Reset de estado quando o conteúdo HTML mudar
  useEffect(() => {
    setHasLoadError(false);
    setIsLoaded(false);
    hasMeasuredRef.current = false;
    loopGuardRef.current = { count: 0, lastTime: 0 };
  }, [trimmedHtml, reloadKey]);

  // Escuta postMessage para ajuste dinâmico da altura e gatilho de conclusão
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      // Evento de conclusão ou compra disparado pelo HTML (aulas ou funil de vendas)
      if (
        event.data.type === 'lesson-complete' || 
        event.data.type === 'complete-lesson' || 
        event.data.type === 'mini-app-complete' ||
        event.data.type === 'purchase' ||
        event.data.type === 'buy' ||
        event.data.type === 'checkout' ||
        event.data.type === 'open-checkout'
      ) {
        onComplete?.();
        return;
      }

      // Validação do formato da mensagem e do frameId correspondente
      if (
        event.data.type === 'mini-app-height' &&
        event.data.frameId === frameIdRef.current
      ) {
        const reportedHeight = typeof event.data.height === 'number'
          ? event.data.height
          : parseInt(event.data.height, 10);
        
        if (!isNaN(reportedHeight) && reportedHeight > 0) {
          const now = Date.now();
          if (now - loopGuardRef.current.lastTime < 1500) {
            loopGuardRef.current.count += 1;
            if (loopGuardRef.current.count > 15) {
              return;
            }
          } else {
            loopGuardRef.current.count = 1;
            loopGuardRef.current.lastTime = now;
          }

          // Limite seguro amplo (até 35.000px) para acomodar páginas completas longas
          const safeHeight = Math.max(100, Math.min(reportedHeight, 35000));
          hasMeasuredRef.current = true;
          setHeight(prev => (Math.abs(prev - safeHeight) >= 2 ? safeHeight : prev));
          setIsLoaded(true);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onComplete]);

  // Se não houver código HTML configurado
  if (!trimmedHtml) {
    return (
      <div className={`w-full py-16 px-6 flex flex-col items-center justify-center text-center ${className}`}>
        <p className="text-sm text-gray-400 font-medium">
          Esta aula em HTML ainda não possui conteúdo configurado.
        </p>
      </div>
    );
  }

  // Se houver erro de carregamento
  if (hasLoadError) {
    return (
      <div className={`w-full py-16 px-6 flex flex-col items-center justify-center text-center ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400 mb-3">
          <AlertCircle size={22} className="text-amber-400/80" />
        </div>
        <p className="text-sm font-medium text-gray-300 mb-1">
          Não foi possível carregar a página da aula.
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Tente novamente para reiniciar o carregamento.
        </p>
        <button
          type="button"
          onClick={() => {
            setHasLoadError(false);
            setReloadKey(prev => prev + 1);
          }}
          className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <RotateCcw size={13} />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  const preparedHtml = !isDirectUrl ? prepareNativeHtml(trimmedHtml, frameIdRef.current) : undefined;

  return (
    <div className={`w-full flex flex-col items-center justify-start relative ${className}`}>
      {/* Indicador discreto durante o carregamento inicial */}
      {!isLoaded && (
        <div className="w-full py-20 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60 animate-ping" />
        </div>
      )}

      {/* 
        Iframe nativo de largura completa:
        - Ocupa 100% da largura da área de conteúdo
        - Auto-dimensiona a altura dinamicamente sem scrollbars internas
        - Suporta URL externa direta ou HTML puro compilado via srcDoc
      */}
      <iframe
        key={reloadKey}
        src={isDirectUrl ? trimmedHtml : undefined}
        srcDoc={preparedHtml}
        title={title || "Página da Aula"}
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals allow-downloads"
        scrolling="no"
        className={`w-full border-0 block bg-transparent transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
        }`}
        style={{
          height: isLoaded ? `${height}px` : (isDirectUrl ? '85vh' : '1px'),
          minHeight: isDirectUrl ? '70vh' : undefined,
          width: '100%',
          overflow: 'hidden',
          display: 'block'
        }}
        onLoad={() => {
          setTimeout(() => {
            if (!hasMeasuredRef.current) {
              setIsLoaded(true);
            }
          }, isDirectUrl ? 400 : 750);
        }}
        onError={() => setHasLoadError(true)}
      />
    </div>
  );
}
