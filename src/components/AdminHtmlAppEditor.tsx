import React, { useState } from 'react';
import { 
  FileCode, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Copy, 
  Check, 
  ShieldCheck,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import HtmlAppViewer, { SAMPLE_HTML_APP } from './HtmlAppViewer';

interface AdminHtmlAppEditorProps {
  htmlContent: string;
  onChange: (value: string) => void;
  chapterTitle?: string;
  themeColor?: 'emerald' | 'blue' | 'amber';
  title?: string;
  subtitle?: string;
  badgeLabel?: string;
  sampleButtonLabel?: string;
  sampleHtml?: string;
  placeholder?: string;
}

export const AdminHtmlAppEditor: React.FC<AdminHtmlAppEditorProps> = ({
  htmlContent,
  onChange,
  chapterTitle = '',
  themeColor = 'emerald',
  title,
  subtitle,
  badgeLabel,
  sampleButtonLabel,
  sampleHtml,
  placeholder
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleLoadSample = () => {
    onChange(sampleHtml || SAMPLE_HTML_APP);
    setIsPreviewOpen(true);
    toast.success('Exemplo de código HTML carregado com sucesso!');
  };

  const handleCopyCode = () => {
    if (!htmlContent) return;
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    toast.success('Código copiado para a área de transferência');
    setTimeout(() => setCopied(false), 2000);
  };

  const isEmerald = themeColor === 'emerald';
  const isAmber = themeColor === 'amber';
  const focusBorderClass = isAmber 
    ? 'focus:border-amber-500' 
    : isEmerald 
      ? 'focus:border-emerald-500' 
      : 'focus:border-blue-500';
  const activeBtnClass = isAmber
    ? 'bg-amber-500 text-black font-black shadow-amber-900/40 hover:bg-amber-400'
    : isEmerald 
      ? 'bg-emerald-600 text-white shadow-emerald-900/40 hover:bg-emerald-500' 
      : 'bg-blue-600 text-white shadow-blue-900/40 hover:bg-blue-500';

  const isUrl = /^https?:\/\//i.test((htmlContent || '').trim());

  return (
    <div className="space-y-4 col-span-2 pt-2">
      {/* Informative Header Box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/30 via-zinc-900 to-indigo-950/30 border border-amber-500/25 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 sm:mt-0">
            <FileCode size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h5 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                {title || 'Página HTML / Conteúdo Externo Nativo'}
              </h5>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <ShieldCheck size={10} />
                {badgeLabel || 'Integração Nativa'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed max-w-xl">
              {subtitle || 'Cole aqui o código HTML completo da sua página externa (ou uma URL com https://). A página ocupará a tela completa dando aparência 100% nativa, mantendo no topo o cabeçalho com número de lições, progresso e botão de voltar, e na parte de baixo o botão de aula concluída e opções de navegação.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center flex-wrap">
          <button
            type="button"
            onClick={handleLoadSample}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
            title="Carregar exemplo completo de código HTML para testes"
          >
            <Sparkles size={13} className="text-amber-300" />
            <span>{sampleButtonLabel || '📋 Exemplo de Página HTML'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPreviewOpen(prev => !prev)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-lg whitespace-nowrap active:scale-95 ${
              isPreviewOpen 
                ? activeBtnClass 
                : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 hover:text-white'
            }`}
            title="Alternar pré-visualização da página nativa"
          >
            {isPreviewOpen ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{isPreviewOpen ? 'Ocultar Prévia' : '👁️ Pré-visualizar'}</span>
          </button>
        </div>
      </div>

      {/* HTML Code Editor Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
            {isUrl ? <Globe size={12} className="text-blue-400" /> : <FileCode size={12} className="text-amber-400" />}
            {isUrl ? 'URL Externa Detectada' : 'Código HTML da Página Completa'}
          </label>
          <div className="flex items-center gap-3">
            {htmlContent ? (
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                <span>{copied ? 'Copiado' : 'Copiar Código'}</span>
              </button>
            ) : null}
            <span className="text-[10px] text-gray-500 font-mono">
              {htmlContent?.length || 0} caracteres
            </span>
          </div>
        </div>

        <textarea
          value={htmlContent || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          placeholder={placeholder || `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    /* Estilos personalizados da sua página aqui */
  </style>
</head>
<body>
  <!-- Conteúdo completo da sua página aqui -->
  <script>
    // Scripts e interações da sua página
  </script>
</body>
</html>`}
          className={`w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-gray-200 font-mono ${focusBorderClass} outline-none transition-all placeholder:text-gray-700 resize-y leading-relaxed`}
          spellCheck={false}
        />
        <p className="text-[11px] text-zinc-500 ml-1">
          Dica: Você pode colar código HTML completo (com CSS e JS embutidos) ou uma URL pública começando com <span className="text-zinc-400 font-mono">https://</span>.
        </p>
      </div>

      {/* Pré-visualização da Página */}
      {isPreviewOpen && (
        <div className="space-y-3 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h6 className="text-[11px] font-black text-amber-400 uppercase tracking-widest">
                PRÉ-VISUALIZAÇÃO DA PÁGINA NATIVA
              </h6>
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">
              Renderizada com auto-ajuste de altura
            </span>
          </div>

          <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-2 sm:p-4 overflow-hidden">
            <HtmlAppViewer
              htmlContent={htmlContent}
              title={chapterTitle || 'Pré-visualização da Aula em HTML'}
            />
          </div>
        </div>
      )}
    </div>
  );
};
