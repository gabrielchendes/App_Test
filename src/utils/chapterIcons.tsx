import React, { useState } from 'react';
import {
  Play,
  PlayCircle,
  Headphones,
  Video,
  Sparkles,
  Star,
  Flame,
  Zap,
  Trophy,
  Target,
  CheckSquare,
  BookOpen,
  Bookmark,
  Heart,
  Gift,
  Lightbulb,
  Compass,
  Clock,
  Shield,
  Rocket,
  MessageCircle,
  FileCode,
  FileText,
  Music,
  Award,
  Crown,
  Smile,
  Sun,
  Moon,
  Radio,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import { Chapter } from '../types/lms';
import { isHtmlAppChapter } from './htmlAppHelper';

export interface ChapterIconDef {
  id: string;
  label: string;
  category: 'padrao' | 'midia' | 'aprendizado' | 'destaque' | 'rotina';
  icon: React.ComponentType<{ className?: string; size?: number; fill?: string }>;
}

export const CHAPTER_ICONS: ChapterIconDef[] = [
  { id: 'play', label: 'Play (Vídeo)', category: 'midia', icon: Play },
  { id: 'play-circle', label: 'Play Círculo', category: 'midia', icon: PlayCircle },
  { id: 'headphones', label: 'Fone (Áudio / Podcast)', category: 'midia', icon: Headphones },
  { id: 'video', label: 'Câmera / Gravação', category: 'midia', icon: Video },
  { id: 'music', label: 'Música / Relaxamento', category: 'midia', icon: Music },
  { id: 'radio', label: 'Rádio / Transmissão', category: 'midia', icon: Radio },

  { id: 'book-open', label: 'Livro / Estudo', category: 'aprendizado', icon: BookOpen },
  { id: 'bookmark', label: 'Marcador / Guia', category: 'aprendizado', icon: Bookmark },
  { id: 'file-text', label: 'Texto / Leitura', category: 'aprendizado', icon: FileText },
  { id: 'file-code', label: 'Mini App / HTML', category: 'aprendizado', icon: FileCode },
  { id: 'check-square', label: 'Checklist / Prática', category: 'aprendizado', icon: CheckSquare },
  { id: 'help-circle', label: 'Quiz / Dúvidas', category: 'aprendizado', icon: HelpCircle },

  { id: 'sparkles', label: 'Brilho / Especial', category: 'destaque', icon: Sparkles },
  { id: 'star', label: 'Estrela / Favorito', category: 'destaque', icon: Star },
  { id: 'flame', label: 'Fogo / Intensivo', category: 'destaque', icon: Flame },
  { id: 'zap', label: 'Raio / Energia', category: 'destaque', icon: Zap },
  { id: 'trophy', label: 'Troféu / Conquista', category: 'destaque', icon: Trophy },
  { id: 'crown', label: 'Coroa / Master', category: 'destaque', icon: Crown },
  { id: 'award', label: 'Medalha / Mérito', category: 'destaque', icon: Award },
  { id: 'gift', label: 'Presente / Bônus', category: 'destaque', icon: Gift },
  { id: 'rocket', label: 'Foguete / Aceleração', category: 'destaque', icon: Rocket },

  { id: 'heart', label: 'Coração / Acolhimento', category: 'rotina', icon: Heart },
  { id: 'sun', label: 'Sol / Manhã / Despertar', category: 'rotina', icon: Sun },
  { id: 'moon', label: 'Lua / Noite / Sono', category: 'rotina', icon: Moon },
  { id: 'smile', label: 'Sorriso / Bem-Estar', category: 'rotina', icon: Smile },
  { id: 'lightbulb', label: 'Lâmpada / Insight', category: 'rotina', icon: Lightbulb },
  { id: 'target', label: 'Alvo / Meta', category: 'rotina', icon: Target },
  { id: 'compass', label: 'Bússola / Direção', category: 'rotina', icon: Compass },
  { id: 'clock', label: 'Relógio / Rápido', category: 'rotina', icon: Clock },
  { id: 'shield', label: 'Escudo / Proteção', category: 'rotina', icon: Shield },
  { id: 'message-circle', label: 'Chat / Interativo', category: 'rotina', icon: MessageCircle }
];

export const POPULAR_ICON_IDS = [
  'default',
  'play',
  'headphones',
  'star',
  'flame',
  'zap',
  'trophy',
  'heart',
  'book-open',
  'check-square',
  'moon',
  'gift'
];

/**
 * Renders the play/lesson symbol according to custom_icon or default fallback by content_type
 */
export function renderChapterIcon(
  iconId?: string | null,
  contentType?: string,
  className: string = 'w-5 h-5 sm:w-6 sm:h-6 text-white',
  fill?: boolean
): React.ReactElement {
  const normalizedIcon = (iconId || '').trim().toLowerCase();

  // If a specific custom icon was chosen
  if (normalizedIcon && normalizedIcon !== 'default') {
    const found = CHAPTER_ICONS.find(i => i.id === normalizedIcon);
    if (found) {
      const IconComponent = found.icon;
      const shouldFill = fill && (normalizedIcon === 'play' || normalizedIcon === 'star' || normalizedIcon === 'heart' || normalizedIcon === 'zap');
      return <IconComponent className={className} fill={shouldFill ? 'currentColor' : undefined} />;
    }
  }

  // Fallback to default by content_type
  if (contentType === 'html' || contentType === 'html_app') {
    return <FileCode className={className} />;
  }
  if (contentType === 'audio') {
    return <Headphones className={className} />;
  }
  if (contentType === 'checklist') {
    return <CheckSquare className={className} />;
  }
  if (contentType === 'pdf' || contentType === 'text' || contentType === 'interactive') {
    return <FileText className={className} />;
  }

  // Default video / lesson play icon
  return <Play className={`${className} ${fill ? 'fill-white ml-0.5 sm:ml-1' : ''}`} />;
}

/**
 * Helper to get the icon component directly from a Chapter object
 */
export function getChapterIconComponent(
  chapter?: Partial<Chapter> | null,
  className: string = 'w-5 h-5 sm:w-6 sm:h-6 text-white',
  fill: boolean = true
): React.ReactElement {
  if (!chapter) {
    return <Play className={className} />;
  }
  const isHtml = chapter.content_type === 'html' || chapter.content_type === 'html_app' || isHtmlAppChapter(chapter);
  const effectiveContentType = isHtml ? 'html' : chapter.content_type;
  return renderChapterIcon(chapter.custom_icon, effectiveContentType, className, fill);
}

interface ChapterIconPickerProps {
  value?: string;
  contentType?: string;
  onChange: (iconId: string) => void;
  themeColor?: 'emerald' | 'blue';
}

export const ChapterIconPicker: React.FC<ChapterIconPickerProps> = ({
  value = '',
  contentType = 'video',
  onChange,
  themeColor = 'emerald'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const activeIconId = value || 'default';
  const activeIconDef = CHAPTER_ICONS.find(i => i.id === activeIconId);

  const activeBg = themeColor === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white';
  const activeBorder = themeColor === 'emerald' ? 'border-emerald-500/50' : 'border-blue-500/50';
  const ringColor = themeColor === 'emerald' ? 'ring-emerald-500/30' : 'ring-blue-500/30';

  const filteredIcons = CHAPTER_ICONS.filter(i => 
    i.label.toLowerCase().includes(searchFilter.toLowerCase()) || 
    i.id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-3 p-4 bg-zinc-950/80 rounded-2xl border border-white/10 shadow-inner">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              Símbolo do Play na Aula
            </label>
            <span className="text-[9px] font-semibold text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full">
              Personalizável
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Escolha o ícone que será exibido no botão central de play desta aula
          </p>
        </div>

        {/* Current Active Badge Preview */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-black/60 border border-white/10 px-3 py-1.5 rounded-xl shadow-sm">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Ativo:</span>
          <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-white/15 flex items-center justify-center text-white">
            {renderChapterIcon(activeIconId, contentType, "w-3.5 h-3.5 text-white")}
          </div>
          <span className="text-xs font-bold text-white">
            {activeIconId === 'default' ? 'Padrão do Tipo' : (activeIconDef?.label.split('(')[0].trim() || activeIconId)}
          </span>
        </div>
      </div>

      {/* Popular Fast-Select Row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Default / Automatic Option */}
        <button
          type="button"
          onClick={() => onChange('default')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
            activeIconId === 'default'
              ? `${activeBg} ${activeBorder} shadow-lg ring-2 ${ringColor}`
              : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
          }`}
        >
          <div className="w-3.5 h-3.5 flex items-center justify-center">
            {renderChapterIcon('default', contentType, "w-3.5 h-3.5")}
          </div>
          <span>Padrão do Tipo</span>
          {activeIconId === 'default' && <Check size={12} className="ml-0.5" />}
        </button>

        {/* Popular icons */}
        {POPULAR_ICON_IDS.filter(id => id !== 'default').map(id => {
          const item = CHAPTER_ICONS.find(i => i.id === id);
          if (!item) return null;
          const IconComp = item.icon;
          const isSelected = activeIconId === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              title={item.label}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                isSelected
                  ? `${activeBg} ${activeBorder} shadow-lg ring-2 ${ringColor}`
                  : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              <IconComp className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline text-[9px]">{item.label.split(' ')[0]}</span>
              {isSelected && <Check size={11} className="ml-0.5" />}
            </button>
          );
        })}

        {/* Expand / Collapse All Gallery */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all uppercase tracking-wider ml-auto"
        >
          <span>{isExpanded ? 'Menos' : `Mais Símbolos (${CHAPTER_ICONS.length})`}</span>
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Expanded Full Gallery */}
      {isExpanded && (
        <div className="pt-3 border-t border-white/10 space-y-3 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Buscar símbolo (ex: estrela, livro, fogo, sono)..."
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-white/30"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="text-[10px] text-zinc-500 hover:text-white shrink-0"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
            {filteredIcons.map(item => {
              const IconComp = item.icon;
              const isSelected = activeIconId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChange(item.id)}
                  className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all border text-xs ${
                    isSelected
                      ? `${activeBg} ${activeBorder} shadow-md`
                      : 'bg-black/40 border-white/5 text-gray-300 hover:bg-white/5 hover:border-white/15'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-zinc-900 border border-white/10 text-zinc-300'
                  }`}>
                    <IconComp size={14} />
                  </div>
                  <span className="truncate text-[11px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
