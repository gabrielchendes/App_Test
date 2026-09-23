import React, { useState, useEffect } from 'react';
import { Tag, Sparkles, X } from 'lucide-react';

interface ChapterBadgeCustomizerProps {
  value?: string;
  chapterTitle?: string;
  onChange: (badgeText: string) => void;
  themeColor?: 'emerald' | 'blue';
}

const QUICK_SUGGESTIONS = ['HTML', 'APP', 'PODCAST', 'PDF', 'PLANILHA', 'PRÁTICA', 'RESUMO', 'BÔNUS'];

export const ChapterBadgeCustomizer: React.FC<ChapterBadgeCustomizerProps> = ({
  value = '',
  chapterTitle = '',
  onChange,
  themeColor = 'emerald'
}) => {
  const isEnabled = Boolean(value && value.trim().length > 0);
  const [internalText, setInternalText] = useState(value || '');

  useEffect(() => {
    setInternalText(value || '');
  }, [value]);

  const toggleEnabled = () => {
    if (isEnabled) {
      onChange('');
      setInternalText('');
    } else {
      const defaultText = internalText.trim() || 'HTML';
      setInternalText(defaultText);
      onChange(defaultText);
    }
  };

  const handleTextChange = (text: string) => {
    setInternalText(text);
    onChange(text);
  };

  const isEmerald = themeColor === 'emerald';
  const activeBg = isEmerald ? 'bg-emerald-600' : 'bg-blue-600';
  const badgeTextColor = isEmerald ? 'text-emerald-400' : 'text-blue-400';
  const badgeBorderColor = isEmerald ? 'border-emerald-500/30' : 'border-blue-500/30';
  const ringFocus = isEmerald ? 'focus:border-emerald-500' : 'focus:border-blue-500';

  return (
    <div className="p-4 sm:p-5 bg-black/40 border border-white/10 rounded-2xl space-y-4 transition-all">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tag size={15} className={badgeTextColor} />
            <label className="text-xs font-black text-white uppercase tracking-wider">
              Etiqueta / Badge Acima do Título da Aula
            </label>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Personalize o texto que aparece acima do nome da aula. Por padrão vem sem nada escrito.
          </p>
        </div>

        {/* Switch Toggle */}
        <button
          type="button"
          onClick={toggleEnabled}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isEnabled ? activeBg : 'bg-zinc-800'
          }`}
          title={isEnabled ? 'Desativar etiqueta personalizada' : 'Ativar etiqueta personalizada'}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {isEnabled && (
        <div className="pt-2 space-y-3.5 border-t border-white/5 animate-in fade-in duration-200">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
              <span>Texto Personalizado</span>
              <span className="text-gray-500">{internalText.length}/25 caracteres</span>
            </div>

            <div className="relative flex items-center">
              <input
                type="text"
                maxLength={25}
                value={internalText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Ex: HTML, APLICATIVO, PLANILHA, PRÁTICA..."
                className={`w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 pr-9 text-xs font-bold text-white placeholder:text-gray-600 ${ringFocus} outline-none transition-all`}
              />
              {internalText && (
                <button
                  type="button"
                  onClick={() => handleTextChange('')}
                  className="absolute right-2.5 p-1 text-gray-400 hover:text-white rounded-md transition-colors"
                  title="Limpar texto"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Quick Suggestions */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Sugestões Rápidas:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTextChange(tag)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                    internalText.toUpperCase() === tag
                      ? `${badgeBorderColor} ${badgeTextColor} bg-white/5 shadow-sm`
                      : 'border-white/5 bg-black/30 text-gray-400 hover:text-white hover:border-white/15'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="p-3 bg-zinc-950/70 border border-white/5 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <Sparkles size={12} className={badgeTextColor} />
              <span>Prévia na seleção de aulas:</span>
            </div>
            <div className="text-right min-w-0">
              <span className={`block text-[10px] font-black uppercase tracking-[0.2em] italic leading-tight truncate ${badgeTextColor}`}>
                {internalText.trim() || 'SEU TEXTO'}
              </span>
              <p className="text-xs font-bold text-white opacity-85 truncate max-w-[200px]">
                {chapterTitle?.trim() || 'Nome da Aula'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
