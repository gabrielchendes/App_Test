import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  MessageSquareQuote, 
  Users, 
  Send, 
  Check, 
  Copy, 
  RefreshCw, 
  Trash2, 
  Plus, 
  Star, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  ExternalLink, 
  ChevronRight, 
  Wand2, 
  Lightbulb, 
  BookOpen, 
  MessageCircle, 
  ShieldCheck, 
  CornerDownRight, 
  X,
  History,
  UploadCloud,
  Camera,
  Upload,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from '../lib/customToast';
import { GlowingSpinner } from './GlowingSpinner';
import { supabase } from '../lib/supabase';
import { dataCache } from '../lib/cache';
import { cn } from '../lib/utils';

// Helper to generate realistic female portraits from randomuser.me (IDs 1-95)
export const getRandomWomanAvatar = (num?: number): string => {
  const id = num !== undefined ? num : (Math.floor(Math.random() * 95) + 1);
  return `https://randomuser.me/api/portraits/women/${id}.jpg`;
};

// Curated initial pool of 24 realistic women portraits from randomuser.me
export const REALISTIC_AVATARS: string[] = [
  1, 2, 3, 5, 9, 12, 17, 21, 24, 28, 32, 36, 44, 47, 50, 54, 60, 65, 68, 72, 76, 79, 82, 86
].map(id => `https://randomuser.me/api/portraits/women/${id}.jpg`);

interface GeneratedTestimonial {
  id: string;
  user_name: string;
  user_avatar: string;
  user_email?: string;
  course_title: string;
  rating: number;
  headline: string;
  content: string;
  status: 'approved' | 'pending';
  consent: boolean;
  is_read: boolean;
  created_at: string;
}

interface GeneratedComment {
  id: string;
  user_name: string;
  user_avatar_url: string;
  content: string;
}

interface GeneratedCommunityThread {
  id: string;
  post: {
    user_name: string;
    user_avatar_url: string;
    content: string;
  };
  comments: GeneratedComment[];
}

interface PublishedHistoryItem {
  id: string;
  type: 'testimonial' | 'community';
  title: string;
  author: string;
  preview: string;
  publishedAt: string;
  commentsCount?: number;
}

interface AdminAiContentCreatorProps {
  courses?: any[];
  user?: any;
  onNavigateToTab?: (tab: string) => void;
}

export const AdminAiContentCreator: React.FC<AdminAiContentCreatorProps> = ({
  courses = [],
  user,
  onNavigateToTab
}) => {
  const [mode, setMode] = useState<'testimonial' | 'community'>('testimonial');
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState<'pt' | 'en' | 'es'>('en');
  const [tone, setTone] = useState<string>('emotional');
  const [selectedCourse, setSelectedCourse] = useState<string>('General');
  const [numComments, setNumComments] = useState<number>(2);
  const [variationsCount, setVariationsCount] = useState<number>(1);

  // Loading & Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTestimonials, setGeneratedTestimonials] = useState<GeneratedTestimonial[]>([]);
  const [generatedThreads, setGeneratedThreads] = useState<GeneratedCommunityThread[]>([]);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState(0);

  // Publishing State
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccessMessage, setPublishSuccessMessage] = useState<string | null>(null);

  // Avatar Picker & Upload State
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [avatarPickerTarget, setAvatarPickerTarget] = useState<{
    type: 'testimonial' | 'post' | 'comment';
    commentIndex?: number;
  } | null>(null);
  const [avatarPool, setAvatarPool] = useState<string[]>(REALISTIC_AVATARS);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [customAvatarUrlInput, setCustomAvatarUrlInput] = useState('');
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // History State
  const [history, setHistory] = useState<PublishedHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('ai_creator_published_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ai_creator_published_history', JSON.stringify(history));
    } catch {}
  }, [history]);

  // Quick Prompt Inspiration Templates (Language-aware)
  const testimonialQuickPrompts = language === 'en' ? [
    {
      title: '💍 Marriage Restored',
      text: 'A 32-year-old student married for 4 years. Her husband was distant, had barely touched her in months, and was talking about separation. After applying the emotional triggers from the program, he radically shifted, apologized, invited her to a romantic dinner, and they are completely in love again.'
    },
    {
      title: '💌 Breakthrough After Block',
      text: 'A 26-year-old student whose ex broke up coldly and blocked her everywhere 3 weeks ago. She applied the magnetic detachment technique and curiosity trigger. Yesterday he unblocked her and sent a long message saying he cannot get her out of his head.'
    },
    {
      title: '🌟 Self-Worth & Official Commitment',
      text: 'A 29-year-old student had been stuck in a situationship for a year. She learned to set boundaries with confidence. Within 10 days he realized her worth and surprised her with an official relationship proposal.'
    }
  ] : (language === 'es' ? [
    {
      title: '💍 Matrimonio Restaurado',
      text: 'Alumna de 32 años casada hace 4 años. Su esposo estaba distante y hablaba de separación. Tras aplicar los disparadores emocionales, él cambió radicalmente, pidió disculpas y la invitó a cenar románticamente.'
    },
    {
      title: '💌 Reconquista tras Bloqueo',
      text: 'Alumna de 26 años cuyo ex la bloqueó hace 3 semanas. Aplicó el distanciamiento magnético. Ayer la desbloqueó y le envió un mensaje diciendo que no deja de pensar en ella.'
    },
    {
      title: '🌟 Amor Propio y Compromiso',
      text: 'Alumna de 29 años en una relación indefinida. Aprendió a valorarse y poner límites. En 10 días él le pidió noviazgo formal.'
    }
  ] : [
    {
      title: '💍 Casamento Restaurado',
      text: 'Aluna de 32 anos casada há 4 anos. O marido estava distante, não a tocava há meses e falava em separação. Após aplicar o método da reconquista emocional, ele mudou radicalmente, pediu desculpas, a convidou para jantar e hoje estão apaixonados novamente.'
    },
    {
      title: '💌 Reconquista após Bloqueio',
      text: 'Aluna de 26 anos cujo ex havia terminado de forma fria e a bloqueado no WhatsApp e Instagram há 3 semanas. Ela aplicou o afastamento magnético e gatilho de curiosidade. Ontem ele desbloqueou, mandou mensagem dizendo que não para de pensar nela.'
    },
    {
      title: '🌟 Amor Próprio & Pedido de Namoro',
      text: 'Aluna de 29 anos vivia em relacionamento sem futuro há 1 ano (ficando sério sem pedido oficial). Aprendeu a se valorizar e impor limites sem drama. Em 10 dias ele percebeu o valor dela e fez uma surpresa pedindo em namoro oficial com aliança.'
    }
  ]);

  const communityQuickPrompts = language === 'en' ? [
    {
      title: '❓ Question: Left on read for 4 hours',
      text: 'Student posts an anxious question in the community: she sent the curiosity trigger message, he saw it 4 hours ago but hasn\'t replied yet, and she fears she made a mistake. Comments from other students reassuring her to stay calm, not send another message, and trust the process.'
    },
    {
      title: '🎉 Celebrating a Big Win',
      text: 'Student sharing an exciting breakthrough: he used to give one-word answers, but today sent a 4-minute sweet voice note asking about her day. Other students celebrating in the comments and sharing their own similar transformations.'
    },
    {
      title: '💪 Dealing with Early Anxiety',
      text: 'Student opening up about feeling anxious during the first days of no-contact and how the community and lessons are giving her strength. Warm, supportive sisterhood comments cheering her on.'
    }
  ] : (language === 'es' ? [
    {
      title: '❓ Duda: Me dejó en visto',
      text: 'Alumna pregunta en la comunidad: envió el mensaje de curiosidad, él lo vio hace 4 horas pero aún no responde y siente ansiedad. Respuestas de otras alumnas tranquilizándola y aconsejando no escribir nada más.'
    },
    {
      title: '🎉 Celebrando una Victoria',
      text: 'Alumna celebrando: él solo respondía con una palabra y hoy le mandó un audio de 4 minutos preguntándole por su día. Respuestas celebrando juntas.'
    },
    {
      title: '💪 Superando la Ansiedad Inicial',
      text: 'Alumna desahogándose sobre la ansiedad del contacto cero y cómo la comunidad le da paz. Comentarios de acogida y fuerza.'
    }
  ] : [
    {
      title: '❓ Dúvida: Ele visualizou e não respondeu',
      text: 'Aluna insegura posta dúvida na comunidade: aplicou a mensagem de curiosidade, ele visualizou há 3 horas mas ainda não respondeu, está com medo de ter errado. Respostas de outras alunas acalmando e recomendando não mandar nada e confiar no processo.'
    },
    {
      title: '🎉 Comemoração de Vitória',
      text: 'Aluna comemorando uma vitória linda: ele que antes respondia com uma palavra só, agora mandou um áudio de 4 minutos perguntando como foi o dia dela. Meninas comentando vibrando juntas e compartilhando que com elas aconteceu o mesmo.'
    },
    {
      title: '💪 Desabafo sobre Ansiedade',
      text: 'Aluna desabafando sobre a ansiedade dos primeiros dias de contato zero e como a comunidade e as aulas da Victoria estão sendo seu porto seguro. Comentários de apoio fraterno e acolhimento de alunas experientes.'
    }
  ]);

  // Call Gemini AI Backend
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Digite um rascunho ou clique em um dos exemplos rápidos.');
      return;
    }

    setIsGenerating(true);
    setPublishSuccessMessage(null);

    try {
      const response = await fetch('/api/v1/ai?action=generate-social-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: prompt.trim(),
          language,
          tone,
          course_title: selectedCourse,
          num_comments: numComments,
          variations: variationsCount
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao gerar conteúdo com IA.');
      }

      if (mode === 'testimonial') {
        setGeneratedTestimonials(data.items || []);
        setSelectedVariationIndex(0);
        toast.success(`✨ ${data.items.length} depoimento(s) gerado(s) com sucesso! Revise e aprove abaixo.`);
      } else {
        setGeneratedThreads(data.items || []);
        setSelectedVariationIndex(0);
        toast.success(`✨ Tópico da comunidade com ${numComments} comentário(s) gerado! Revise e aprove abaixo.`);
      }
    } catch (err: any) {
      console.error('[AI Creator Error]', err);
      toast.error(err.message || 'Erro ao conectar à Inteligência Artificial. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Publish to Database
  const handlePublishToDatabase = async () => {
    setIsPublishing(true);
    setPublishSuccessMessage(null);

    try {
      if (mode === 'testimonial') {
        const currentItem = generatedTestimonials[selectedVariationIndex];
        if (!currentItem) {
          throw new Error('Nenhum depoimento selecionado.');
        }

        const { data: { session } } = await supabase.auth.getSession();

        const payload = {
          testimonial: {
            ...currentItem,
            status: 'approved',
            consent: true,
            is_read: true,
            approved_at: new Date().toISOString()
          }
        };

        const res = await fetch('/api/v1/testimonials', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
          },
          body: JSON.stringify(payload)
        });

        const resData = await res.json();
        if (!res.ok || (!resData.success && !resData.item)) {
          throw new Error(resData.error || 'Erro ao gravar depoimento no banco de dados.');
        }

        const newHistoryItem: PublishedHistoryItem = {
          id: currentItem.id,
          type: 'testimonial',
          title: currentItem.headline,
          author: currentItem.user_name,
          preview: currentItem.content.substring(0, 100) + '...',
          publishedAt: new Date().toISOString()
        };
        setHistory(prev => [newHistoryItem, ...prev.slice(0, 29)]);

        setPublishSuccessMessage('Depoimento aprovado e publicado com sucesso no banco de dados!');
        toast.success('🎉 Depoimento publicado na plataforma e aprovado automaticamente!');
      } else {
        const currentThread = generatedThreads[selectedVariationIndex];
        if (!currentThread) {
          throw new Error('Nenhum tópico da comunidade selecionado.');
        }

        const { data: { session } } = await supabase.auth.getSession();
        const activeUserId = user?.id || session?.user?.id || 'admin_persona';
        const activeUserEmail = user?.email || session?.user?.email || '';
        const nowTimestamp = new Date().toISOString();
        const validComments = currentThread.comments.filter(c => c.content.trim());

        // 1. Direct Supabase insert (satisfies RLS auth.uid() = user_id using current session)
        let createdPostId: string | null = null;
        let postInsertError: any = null;

        try {
          const { data: postRow, error: postErr } = await supabase
            .from('community_posts')
            .insert({
              user_id: activeUserId,
              user_email: activeUserEmail,
              user_name: currentThread.post.user_name,
              user_avatar_url: currentThread.post.user_avatar_url,
              content: currentThread.post.content,
              comments_count: validComments.length,
              likes_count: 0,
              created_at: nowTimestamp
            })
            .select()
            .single();

          if (!postErr && postRow?.id) {
            createdPostId = postRow.id;
            console.log('[AI Content Creator] Direct insert community_posts succeeded:', createdPostId);
          } else if (postErr) {
            postInsertError = postErr;
            console.warn('[AI Content Creator] Direct insert community_posts warning:', postErr);
          }
        } catch (dirErr) {
          postInsertError = dirErr;
        }

        // 2. Always persist through backend API to ensure fallback and cross-session delivery
        try {
          const postRes = await fetch('/api/v1/community?action=create-post', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
            },
            body: JSON.stringify({
              id: createdPostId || undefined,
              user_id: activeUserId,
              user_email: activeUserEmail,
              user_name: currentThread.post.user_name,
              user_avatar_url: currentThread.post.user_avatar_url,
              content: currentThread.post.content,
              comments_count: validComments.length,
              likes_count: 0,
              created_at: nowTimestamp
            })
          });

          const postData = await postRes.json();
          if (!createdPostId && postData.success && postData.post?.id) {
            createdPostId = postData.post.id;
          }
        } catch (apiErr) {
          console.warn('[AI Content Creator] API create-post error:', apiErr);
        }

        if (!createdPostId) {
          throw new Error(postInsertError?.message || 'Falha ao gerar registro do post no banco de dados.');
        }

        // 3. Insert comments directly and sync to backend API
        let commentsPublished = 0;

        for (let i = 0; i < validComments.length; i++) {
          const comment = validComments[i];
          const commentTimestamp = new Date(Date.now() + (i + 1) * 2000).toISOString();
          let commentId: string | null = null;

          try {
            const { data: cRow, error: cErr } = await supabase
              .from('post_comments')
              .insert({
                post_id: createdPostId,
                user_id: activeUserId,
                user_name: comment.user_name,
                user_avatar_url: comment.user_avatar_url,
                content: comment.content,
                created_at: commentTimestamp
              })
              .select()
              .single();

            if (!cErr && cRow) {
              commentId = cRow.id;
              commentsPublished++;
            }
          } catch (commDirErr) {
            console.warn('[AI Content Creator] Direct comment insert note:', commDirErr);
          }

          try {
            await fetch('/api/v1/community?action=create-comment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
              },
              body: JSON.stringify({
                id: commentId || undefined,
                postId: createdPostId,
                user_id: activeUserId,
                user_name: comment.user_name,
                user_avatar_url: comment.user_avatar_url,
                content: comment.content,
                created_at: commentTimestamp
              })
            });
            if (!commentId) {
              commentsPublished++;
            }
          } catch (commErr) {
            console.warn('[AI Content Creator] API comment insert error:', commErr);
          }
        }

        // 4. Update comments count on the post
        try {
          await supabase
            .from('community_posts')
            .update({ comments_count: commentsPublished })
            .eq('id', createdPostId);
        } catch (_) {}

        // 4. Invalidate cache and trigger UI sync
        try {
          dataCache.invalidate('community_cached_posts');
          window.dispatchEvent(new CustomEvent('community-post-created', { detail: { postId: createdPostId } }));
        } catch (_) {}

        const newHistoryItem: PublishedHistoryItem = {
          id: createdPostId,
          type: 'community',
          title: `Post de ${currentThread.post.user_name}`,
          author: currentThread.post.user_name,
          preview: currentThread.post.content.substring(0, 100) + '...',
          publishedAt: new Date().toISOString(),
          commentsCount: commentsPublished
        };
        setHistory(prev => [newHistoryItem, ...prev.slice(0, 29)]);

        setPublishSuccessMessage(`Post e ${commentsPublished} comentário(s) publicados com sucesso na Comunidade!`);
        toast.success(`🎉 Tópico publicado na Comunidade com ${commentsPublished} comentário(s)!`);
      }
    } catch (err: any) {
      console.error('[Publish Error]', err);
      toast.error(err.message || 'Erro ao salvar no banco de dados.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Shuffle random portraits from RandomUser.me (IDs 1-95)
  const handleShuffleAvatarPool = () => {
    const nums = new Set<number>();
    while (nums.size < 24) {
      nums.add(Math.floor(Math.random() * 95) + 1);
    }
    setAvatarPool(Array.from(nums).map(n => `https://randomuser.me/api/portraits/women/${n}.jpg`));
    toast.success('Novas 24 fotos aleatórias geradas do RandomUser!');
  };

  /**
   * Specialist Image Processing:
   * 1. Reads image file
   * 2. Performs centered square 1:1 crop on Canvas (400x400)
   * 3. Compresses to high-efficiency JPEG (88% quality, ~25-40KB)
   * 4. Uploads to Supabase Storage community_images bucket
   * 5. Falls back to base64 Data URL if storage bucket is inaccessible
   */
  const processAndUploadAvatar = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Por favor, selecione um arquivo de imagem válido (JPG, PNG ou WEBP).'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Não foi possível decodificar a imagem.'));
        img.onload = async () => {
          try {
            const size = 400; // Perfect retina avatar resolution (200x200 @2x)
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Falha ao inicializar o processador gráfico da imagem.'));
              return;
            }

            // Calculate center-cropped 1:1 square (prevents any distortion/stretching)
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);

            // Attempt upload to Supabase storage
            try {
              canvas.toBlob(async (blob) => {
                if (!blob) {
                  resolve(compressedDataUrl);
                  return;
                }
                const fileName = `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.jpg`;
                const filePath = `avatars/${fileName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('community_images')
                  .upload(filePath, blob, {
                    contentType: 'image/jpeg',
                    upsert: true
                  });

                if (!uploadError && uploadData) {
                  const { data: pubData } = supabase.storage
                    .from('community_images')
                    .getPublicUrl(filePath);

                  if (pubData?.publicUrl) {
                    resolve(pubData.publicUrl);
                    return;
                  }
                }
                resolve(compressedDataUrl);
              }, 'image/jpeg', 0.88);
            } catch {
              resolve(compressedDataUrl);
            }
          } catch (err) {
            reject(err);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleProcessFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error('O tamanho máximo do arquivo é 20MB.');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      toast.info('Recortando em 1:1 e otimizando imagem...');
      const optimizedUrl = await processAndUploadAvatar(file);
      handleSelectAvatar(optimizedUrl);
      toast.success('Foto de perfil atualizada com sucesso!');
    } catch (err: any) {
      console.error('[Avatar Upload Error]', err);
      toast.error(err.message || 'Erro ao carregar foto.');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = '';
      }
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleApplyCustomUrl = () => {
    const url = customAvatarUrlInput.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:image')) {
      toast.error('Por favor, insira uma URL válida iniciando com https://');
      return;
    }
    handleSelectAvatar(url);
    setCustomAvatarUrlInput('');
    toast.success('Foto atualizada com sucesso!');
  };

  const triggerDirectUpload = (target: { type: 'testimonial' | 'post' | 'comment'; commentIndex?: number }) => {
    setAvatarPickerTarget(target);
    avatarFileInputRef.current?.click();
  };

  // Avatar selector helper
  const openAvatarPicker = (target: { type: 'testimonial' | 'post' | 'comment'; commentIndex?: number }) => {
    setAvatarPickerTarget(target);
    setIsAvatarPickerOpen(true);
  };

  const handleSelectAvatar = (url: string) => {
    if (!avatarPickerTarget) return;

    if (avatarPickerTarget.type === 'testimonial') {
      setGeneratedTestimonials(prev => {
        const copy = [...prev];
        if (copy[selectedVariationIndex]) {
          copy[selectedVariationIndex] = {
            ...copy[selectedVariationIndex],
            user_avatar: url
          };
        }
        return copy;
      });
    } else if (avatarPickerTarget.type === 'post') {
      setGeneratedThreads(prev => {
        const copy = [...prev];
        if (copy[selectedVariationIndex]) {
          copy[selectedVariationIndex] = {
            ...copy[selectedVariationIndex],
            post: {
              ...copy[selectedVariationIndex].post,
              user_avatar_url: url
            }
          };
        }
        return copy;
      });
    } else if (avatarPickerTarget.type === 'comment' && avatarPickerTarget.commentIndex !== undefined) {
      setGeneratedThreads(prev => {
        const copy = [...prev];
        if (copy[selectedVariationIndex]?.comments[avatarPickerTarget.commentIndex!]) {
          const newComments = [...copy[selectedVariationIndex].comments];
          newComments[avatarPickerTarget.commentIndex!] = {
            ...newComments[avatarPickerTarget.commentIndex!],
            user_avatar_url: url
          };
          copy[selectedVariationIndex] = {
            ...copy[selectedVariationIndex],
            comments: newComments
          };
        }
        return copy;
      });
    }

    setIsAvatarPickerOpen(false);
    setAvatarPickerTarget(null);
  };

  // Comment management helpers
  const handleUpdateCommentText = (idx: number, newText: string) => {
    setGeneratedThreads(prev => {
      const copy = [...prev];
      if (copy[selectedVariationIndex]?.comments[idx]) {
        const newComments = [...copy[selectedVariationIndex].comments];
        newComments[idx] = { ...newComments[idx], content: newText };
        copy[selectedVariationIndex] = { ...copy[selectedVariationIndex], comments: newComments };
      }
      return copy;
    });
  };

  const handleUpdateCommentAuthor = (idx: number, newName: string) => {
    setGeneratedThreads(prev => {
      const copy = [...prev];
      if (copy[selectedVariationIndex]?.comments[idx]) {
        const newComments = [...copy[selectedVariationIndex].comments];
        newComments[idx] = { ...newComments[idx], user_name: newName };
        copy[selectedVariationIndex] = { ...copy[selectedVariationIndex], comments: newComments };
      }
      return copy;
    });
  };

  const handleDeleteComment = (idx: number) => {
    setGeneratedThreads(prev => {
      const copy = [...prev];
      if (copy[selectedVariationIndex]?.comments) {
        const newComments = copy[selectedVariationIndex].comments.filter((_, i) => i !== idx);
        copy[selectedVariationIndex] = { ...copy[selectedVariationIndex], comments: newComments };
      }
      return copy;
    });
    toast.success('Comentário removido da pré-visualização.');
  };

  const handleAddCustomComment = () => {
    setGeneratedThreads(prev => {
      const copy = [...prev];
      if (copy[selectedVariationIndex]) {
        const randomAvatar = getRandomWomanAvatar();
        const newComment: GeneratedComment = {
          id: `ai-comm-custom-${Date.now()}`,
          user_name: 'Aluna ' + ['Beatriz', 'Larissa', 'Mariana', 'Carolina'][Math.floor(Math.random() * 4)],
          user_avatar_url: randomAvatar,
          content: 'Parabéns amiga! Continue firme, o resultado sempre vem com a constância! ❤️'
        };
        copy[selectedVariationIndex] = {
          ...copy[selectedVariationIndex],
          comments: [...copy[selectedVariationIndex].comments, newComment]
        };
      }
      return copy;
    });
  };

  const currentTestimonial = generatedTestimonials[selectedVariationIndex];
  const currentThread = generatedThreads[selectedVariationIndex];

  return (
    <div className="max-w-6xl space-y-8 pb-24 text-white">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-purple-950/40 border border-purple-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles size={14} className="text-purple-400 animate-pulse" />
              <span>Inteligência Artificial de Produção</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Criador IA de Conteúdo</span>
            </h2>
            <p className="text-sm sm:text-base text-gray-400 max-w-2xl leading-relaxed">
              Escreva um rascunho com o que você deseja e nossa IA transformará seu texto em <strong>depoimentos emocionantes</strong> ou <strong>tópicos completos da comunidade com comentários</strong> prontos para aprovação e publicação direta no banco de dados.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            {onNavigateToTab && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateToTab('testimonials')}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <MessageSquareQuote size={14} className="text-amber-400" />
                  <span>Ver Depoimentos</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToTab('community')}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <Users size={14} className="text-blue-400" />
                  <span>Ver Comunidade</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 1: Content Type Selector */}
      <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center border border-purple-500/30">1</span>
              <span>Escolha o destino do conteúdo</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Selecione onde este conteúdo será publicado após sua aprovação.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              setMode('testimonial');
              setPublishSuccessMessage(null);
            }}
            className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
              mode === 'testimonial'
                ? 'bg-gradient-to-br from-amber-500/15 via-zinc-900 to-zinc-900 border-amber-500/50 shadow-lg shadow-amber-500/10'
                : 'bg-zinc-900/40 border-white/10 hover:border-white/20 hover:bg-zinc-800/40'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-xl ${mode === 'testimonial' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-gray-400'}`}>
                <MessageSquareQuote size={24} />
              </div>
              {mode === 'testimonial' && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1">
                  <Check size={12} /> Selecionado
                </span>
              )}
            </div>
            <div className="mt-4">
              <h4 className="font-bold text-white text-base">Depoimento de Aluna (História Real)</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Gera uma história de transformação tocante e crível com foto realista, nota 5★, headline de impacto e texto humanizado para a aba de <strong>Depoimentos</strong>.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('community');
              setPublishSuccessMessage(null);
            }}
            className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
              mode === 'community'
                ? 'bg-gradient-to-br from-blue-500/15 via-zinc-900 to-zinc-900 border-blue-500/50 shadow-lg shadow-blue-500/10'
                : 'bg-zinc-900/40 border-white/10 hover:border-white/20 hover:bg-zinc-800/40'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-xl ${mode === 'community' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-400'}`}>
                <Users size={24} />
              </div>
              {mode === 'community' && (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[11px] font-bold flex items-center gap-1">
                  <Check size={12} /> Selecionado
                </span>
              )}
            </div>
            <div className="mt-4">
              <h4 className="font-bold text-white text-base">Post e Comentários (Comunidade)</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Cria uma conversa viva na <strong>Comunidade</strong>: publicação principal de uma aluna + 1 a 4 respostas realistas de apoio mútuo, dicas e incentivo entre colegas.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Step 2: Input Draft & AI Settings */}
      <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 sm:p-7 space-y-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center border border-purple-500/30">2</span>
              <span>Escreva o que você quer adicionar</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Não precisa se preocupar com concordância ou formato final — a IA irá lapidar e profissionalizar tudo.
            </p>
          </div>
        </div>

        {/* Quick prompt inspiration chips */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
            <Lightbulb size={14} className="text-amber-400" />
            <span>Exemplos prontos para testar com 1 clique:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(mode === 'testimonial' ? testimonialQuickPrompts : communityQuickPrompts).map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPrompt(item.text)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-purple-500/15 border border-white/10 hover:border-purple-500/40 text-xs text-gray-300 hover:text-white transition-all text-left flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Textarea */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={
              language === 'en'
                ? (mode === 'testimonial'
                    ? 'Example: 34-year-old student named Sarah who was in a marriage crisis for 2 years with a distant husband. She applied the emotional triggers and in 10 days he started hugging her, being affectionate, and planned a romantic weekend trip...'
                    : 'Example: Student asks in the community what to do when her partner leaves her on read for 4 hours and she feels anxious. I want supportive replies from fellow students telling her to breathe, not text again, and trust the process...')
                : (language === 'es'
                    ? (mode === 'testimonial'
                        ? 'Ejemplo: Alumna de 34 años llamada Sofía que vivía una crisis en su matrimonio desde hace 2 años con su esposo distante. Aplicó los disparadores emocionales y en 10 días él volvió a ser cariñoso y planearon un viaje juntos...'
                        : 'Ejemplo: Alumna pregunta en la comunidad qué hacer cuando su pareja la deja en visto durante 4 horas y siente ansiedad. Quiero respuestas de otras alumnas tranquilizándola y apoyándola...')
                    : (mode === 'testimonial'
                        ? 'Exemplo: Aluna de 34 anos chamada Mariana que estava em crise no casamento há 2 anos, marido distante, quase pedindo divórcio. Ela aplicou o gatilho emocional e em 10 dias ele voltou a ser carinhoso e marcaram viagem juntos...'
                        : 'Exemplo: Aluna posta na comunidade perguntando o que fazer quando o parceiro visualiza e não responde há 4 horas. Ela está ansiosa. Quero respostas de outras alunas acalmando e compartilhando experiências reais...'))
            }
            className="w-full bg-zinc-950/70 border border-white/15 focus:border-purple-500/60 rounded-2xl p-4 text-sm text-white placeholder-gray-500 focus:outline-none transition-all resize-y min-h-[110px]"
          />
          <div className="flex justify-between items-center text-[11px] text-gray-500 px-1 mt-1">
            <span>
              {language === 'en'
                ? 'Be free: mention names, ages, key details or just the pain and the breakthrough.'
                : (language === 'es'
                    ? 'Escribe libremente: agrega nombres, detalles o simplemente el conflicto y la victoria.'
                    : 'Seja livre: adicione nomes, idades, detalhes ou apenas a dor e vitória.')}
            </span>
            <span>{prompt.length} caracteres</span>
          </div>
        </div>

        {/* Configurations Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-white/5">
          {/* Tone */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <span>Tom do Conteúdo</span>
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/60 cursor-pointer"
            >
              <option value="emotional">Emocionante & Gratidão</option>
              <option value="spontaneous">Espontâneo & Realista</option>
              <option value="overcoming">Superação & Impacto</option>
              <option value="victory">Vitória & Celebração</option>
              <option value="supportive">Aconselhamento & Apoio</option>
            </select>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Idioma</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/60 cursor-pointer"
            >
              <option value="en">🇺🇸 English (US) — Padrão</option>
              <option value="pt">🇧🇷 Português (Brasil)</option>
              <option value="es">🇪🇸 Español</option>
            </select>
          </div>

          {/* Course (if testimonial) or Num comments (if community) */}
          {mode === 'testimonial' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Curso Vinculado</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/60 cursor-pointer truncate"
              >
                <option value="Geral">Geral (Todos os Cursos)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.title}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Qtd. de Comentários</label>
              <select
                value={numComments}
                onChange={(e) => setNumComments(Number(e.target.value))}
                className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/60 cursor-pointer"
              >
                <option value={1}>1 Resposta / Comentário</option>
                <option value={2}>2 Respostas (Recomendado)</option>
                <option value={3}>3 Respostas Variadas</option>
                <option value={4}>4 Respostas (Discussão Ativa)</option>
              </select>
            </div>
          )}

          {/* Variations Count */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Variações Geradas</label>
            <select
              value={variationsCount}
              onChange={(e) => setVariationsCount(Number(e.target.value))}
              className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/60 cursor-pointer"
            >
              <option value={1}>1 Opção Pronta</option>
              <option value={2}>2 Opções para Escolher</option>
              <option value={3}>3 Opções Diferentes</option>
            </select>
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:via-pink-500 hover:to-rose-500 text-white font-bold text-sm shadow-xl shadow-purple-600/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <GlowingSpinner size="xs" color="white" />
                <span>Lapidando com Inteligência Artificial...</span>
              </>
            ) : (
              <>
                <Wand2 size={18} />
                <span>Gerar com Inteligência Artificial</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step 3: Review, Edit & Approve */}
      {((mode === 'testimonial' && generatedTestimonials.length > 0) ||
        (mode === 'community' && generatedThreads.length > 0)) && (
        <div className="bg-zinc-900/70 border border-purple-500/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold flex items-center justify-center border border-emerald-500/40">3</span>
                <span>Revise, Ajuste e Aprove</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Você tem controle total. Edite qualquer campo diretamente ou troque a foto antes de aprovar.
              </p>
            </div>

            {/* Multiple Variations Tabs if variations > 1 */}
            {((mode === 'testimonial' && generatedTestimonials.length > 1) ||
              (mode === 'community' && generatedThreads.length > 1)) && (
              <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10">
                <span className="text-xs text-gray-400 px-2 font-semibold">Opção:</span>
                {(mode === 'testimonial' ? generatedTestimonials : generatedThreads).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedVariationIndex(idx)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedVariationIndex === idx
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    #{idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Testimonial Review Card */}
          {mode === 'testimonial' && currentTestimonial && (
            <div className="space-y-6">
              <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Author avatar & Name */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative group shrink-0">
                      <img
                        src={currentTestimonial.user_avatar}
                        alt={currentTestimonial.user_name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-amber-500/40 shadow-md aspect-square bg-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={() => openAvatarPicker({ type: 'testimonial' })}
                        title="Trocar Foto ou Fazer Upload"
                        className="absolute inset-0 bg-black/65 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-white cursor-pointer gap-0.5"
                      >
                        <Camera size={13} />
                        <span>Trocar</span>
                      </button>
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={currentTestimonial.user_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGeneratedTestimonials(prev => {
                              const copy = [...prev];
                              copy[selectedVariationIndex] = { ...copy[selectedVariationIndex], user_name: val };
                              return copy;
                            });
                          }}
                          placeholder="Nome da Aluna"
                          className="bg-transparent border-b border-white/20 focus:border-amber-400 font-bold text-white text-base focus:outline-none px-1 py-0.5"
                        />
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                          Aluna Verificada
                        </span>
                        <button
                          type="button"
                          onClick={() => triggerDirectUpload({ type: 'testimonial' })}
                          title="Fazer upload de foto personalizada"
                          className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold hover:underline cursor-pointer ml-1"
                        >
                          <Upload size={12} />
                          <span>Upload Foto</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-1 text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} size={15} className="fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Course tag badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Curso:</span>
                    <input
                      type="text"
                      value={currentTestimonial.course_title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGeneratedTestimonials(prev => {
                          const copy = [...prev];
                          copy[selectedVariationIndex] = { ...copy[selectedVariationIndex], course_title: val };
                          return copy;
                        });
                      }}
                      className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Headline */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Headline de Impacto
                  </label>
                  <input
                    type="text"
                    value={currentTestimonial.headline}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGeneratedTestimonials(prev => {
                        const copy = [...prev];
                        copy[selectedVariationIndex] = { ...copy[selectedVariationIndex], headline: val };
                        return copy;
                      });
                    }}
                    placeholder="Título impactante..."
                    className="w-full bg-zinc-900/60 border border-white/10 focus:border-amber-400 rounded-xl px-3.5 py-2 text-sm font-semibold text-amber-200 focus:outline-none"
                  />
                </div>

                {/* Content */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    História / Conteúdo do Depoimento
                  </label>
                  <textarea
                    value={currentTestimonial.content}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGeneratedTestimonials(prev => {
                        const copy = [...prev];
                        copy[selectedVariationIndex] = { ...copy[selectedVariationIndex], content: val };
                        return copy;
                      });
                    }}
                    rows={5}
                    placeholder="Texto completo do depoimento..."
                    className="w-full bg-zinc-900/60 border border-white/10 focus:border-amber-400 rounded-xl p-3.5 text-sm text-gray-200 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Community Review Card */}
          {mode === 'community' && currentThread && (
            <div className="space-y-6">
              {/* Main Post */}
              <div className="bg-zinc-950/80 border border-blue-500/30 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={14} /> Publicação Principal da Comunidade
                  </span>
                  <span className="text-xs text-gray-400">Publicado como: Aluna</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative group shrink-0">
                    <img
                      src={currentThread.post.user_avatar_url}
                      alt={currentThread.post.user_name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-blue-500/40 shadow-md aspect-square bg-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => openAvatarPicker({ type: 'post' })}
                      title="Trocar Foto ou Fazer Upload"
                      className="absolute inset-0 bg-black/65 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-white cursor-pointer gap-0.5"
                    >
                      <Camera size={12} />
                      <span>Trocar</span>
                    </button>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={currentThread.post.user_name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGeneratedThreads(prev => {
                            const copy = [...prev];
                            copy[selectedVariationIndex] = {
                              ...copy[selectedVariationIndex],
                              post: { ...copy[selectedVariationIndex].post, user_name: val }
                            };
                            return copy;
                          });
                        }}
                        placeholder="Nome da autora"
                        className="bg-transparent border-b border-white/20 focus:border-blue-400 font-bold text-white text-base focus:outline-none px-1 py-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => triggerDirectUpload({ type: 'post' })}
                        title="Fazer upload direto de foto para a autora"
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold hover:underline cursor-pointer"
                      >
                        <Upload size={11} />
                        <span>Upload Foto</span>
                      </button>
                    </div>
                    <span className="text-[11px] text-gray-500 block">Agora mesmo • Comunidade de Alunas</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Texto da Publicação
                  </label>
                  <textarea
                    value={currentThread.post.content}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGeneratedThreads(prev => {
                        const copy = [...prev];
                        copy[selectedVariationIndex] = {
                          ...copy[selectedVariationIndex],
                          post: { ...copy[selectedVariationIndex].post, content: val }
                        };
                        return copy;
                      });
                    }}
                    rows={4}
                    placeholder="Conteúdo do post..."
                    className="w-full bg-zinc-900/60 border border-white/10 focus:border-blue-400 rounded-xl p-3.5 text-sm text-gray-200 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Comments Thread */}
              <div className="space-y-3 pl-4 sm:pl-8 border-l-2 border-purple-500/30">
                <div className="flex items-center justify-between pb-1">
                  <h4 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                    <CornerDownRight size={16} />
                    <span>Respostas / Comentários da Comunidade ({currentThread.comments.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddCustomComment}
                    className="px-3 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Adicionar Comentário</span>
                  </button>
                </div>

                {currentThread.comments.map((comment, commIdx) => (
                  <div
                    key={comment.id || commIdx}
                    className="bg-zinc-950/60 border border-white/10 rounded-2xl p-4 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative group/avatar shrink-0">
                          <img
                            src={comment.user_avatar_url}
                            alt={comment.user_name}
                            className="w-10 h-10 rounded-full object-cover border border-purple-500/40 aspect-square bg-zinc-900"
                          />
                          <button
                            type="button"
                            onClick={() => openAvatarPicker({ type: 'comment', commentIndex: commIdx })}
                            title="Trocar Foto ou Fazer Upload"
                            className="absolute inset-0 bg-black/65 rounded-full flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity text-[9px] font-bold text-white cursor-pointer gap-0.5"
                          >
                            <Camera size={11} />
                            <span>Trocar</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={comment.user_name}
                            onChange={(e) => handleUpdateCommentAuthor(commIdx, e.target.value)}
                            placeholder="Nome da aluna"
                            className="bg-transparent border-b border-white/10 focus:border-purple-400 text-xs font-bold text-white focus:outline-none px-1"
                          />
                          <button
                            type="button"
                            onClick={() => triggerDirectUpload({ type: 'comment', commentIndex: commIdx })}
                            title="Upload direto de foto para esta aluna"
                            className="text-gray-400 hover:text-purple-300 p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <Upload size={12} />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteComment(commIdx)}
                        title="Remover este comentário"
                        className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <textarea
                      value={comment.content}
                      onChange={(e) => handleUpdateCommentText(commIdx, e.target.value)}
                      rows={2}
                      placeholder="Texto do comentário..."
                      className="w-full bg-zinc-900/60 border border-white/10 focus:border-purple-400 rounded-xl p-3 text-xs text-gray-200 focus:outline-none leading-relaxed"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Banner */}
          {publishSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4 text-emerald-300 text-sm font-semibold">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                <span>{publishSuccessMessage}</span>
              </div>
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab(mode === 'testimonial' ? 'testimonials' : 'community')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>Abrir na Aba {mode === 'testimonial' ? 'Depoimentos' : 'Comunidade'}</span>
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          )}

          {/* Action Buttons: Approve & Upload to Database */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
              <span>Regerar outra versão com IA</span>
            </button>

            <button
              type="button"
              onClick={handlePublishToDatabase}
              disabled={isPublishing}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base shadow-xl shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer"
            >
              {isPublishing ? (
                <>
                  <GlowingSpinner size="xs" color="white" />
                  <span>Enviando para o Banco de Dados...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={20} />
                  <span>Aprovar e Subir no Banco de Dados</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* History of AI Publications */}
      {history.length > 0 && (
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <History size={16} className="text-purple-400" />
              <span>Histórico de Publicações Feitas via IA</span>
            </h4>
            <span className="text-xs text-gray-500">{history.length} item(ns)</span>
          </div>

          <div className="divide-y divide-white/5">
            {history.slice(0, 5).map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.type === 'testimonial'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {item.type === 'testimonial' ? 'Depoimento' : 'Comunidade'}
                    </span>
                    <span className="font-semibold text-white text-xs truncate">{item.title}</span>
                    <span className="text-[11px] text-gray-500 hidden sm:inline">por {item.author}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{item.preview}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                    No Banco de Dados
                  </span>
                  {onNavigateToTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab(item.type === 'testimonial' ? 'testimonials' : 'community')}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                      title="Abrir aba correspondente"
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden File Input for Avatar Uploads */}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/avif"
        onChange={handleAvatarFileChange}
        className="hidden"
      />

      {/* Avatar Picker & Upload Modal */}
      {isAvatarPickerOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/15 rounded-3xl p-6 sm:p-7 max-w-xl w-full space-y-5 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="space-y-0.5">
                <h4 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Camera size={20} className="text-purple-400" />
                  <span>Foto de Perfil da Aluna</span>
                </h4>
                <p className="text-xs text-gray-400">
                  Substitua por uma foto personalizada ou escolha um retrato realista aleatório do RandomUser.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarPickerOpen(false)}
                className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto pr-1 scrollbar-thin">
              {/* Option A: Specialist Upload Area */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <UploadCloud size={14} className="text-purple-400" />
                  <span>1. Fazer Upload de Imagem (Seu Dispositivo)</span>
                </label>

                <div
                  onClick={() => !isUploadingAvatar && avatarFileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleProcessFile(file);
                  }}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5",
                    isDragging
                      ? "border-purple-400 bg-purple-500/20 scale-[0.99]"
                      : "border-purple-500/30 bg-purple-950/15 hover:border-purple-400/70 hover:bg-purple-950/25",
                    isUploadingAvatar && "opacity-75 pointer-events-none"
                  )}
                >
                  {isUploadingAvatar ? (
                    <div className="flex flex-col items-center gap-2 py-3">
                      <GlowingSpinner size="sm" />
                      <span className="text-xs text-purple-300 font-semibold animate-pulse">
                        Recortando em proporção 1:1 e otimizando imagem...
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-lg">
                        <UploadCloud size={24} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-bold text-white">
                          Clique aqui para selecionar ou arraste sua foto
                        </p>
                        <p className="text-[11px] text-gray-400">
                          Formatos aceitos: <strong className="text-purple-300 font-semibold">JPG, PNG, WEBP</strong>.
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-300">
                        <span>✨ Enquadramento central <strong>1:1 quadrado</strong> e compressão leve aplicada automaticamente</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Custom URL Option */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Ou cole o link direto da imagem (https://...)"
                      value={customAvatarUrlInput}
                      onChange={(e) => setCustomAvatarUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCustomUrl()}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomUrl}
                    className="px-3.5 py-2 rounded-xl bg-purple-600/90 hover:bg-purple-600 text-xs font-semibold text-white transition-all cursor-pointer whitespace-nowrap shadow"
                  >
                    Usar Link
                  </button>
                </div>
              </div>

              {/* Option B: RandomUser.me Gallery */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Users size={14} className="text-blue-400" />
                    <span>2. Retratos Aleatórios Femininos (RandomUser.me)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleShuffleAvatarPool}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold hover:underline cursor-pointer transition-colors"
                    title="Sortear novos 24 retratos do RandomUser"
                  >
                    <RefreshCw size={12} />
                    <span>Sortear novos 24</span>
                  </button>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto p-1 scrollbar-thin">
                  {avatarPool.map((url, i) => {
                    const portraitNum = url.match(/\/(\d+)\.jpg/)?.[1] || (i + 1);
                    return (
                      <button
                        key={`${url}-${i}`}
                        type="button"
                        onClick={() => handleSelectAvatar(url)}
                        title={`Aluna #${portraitNum} (RandomUser)`}
                        className="relative group rounded-xl overflow-hidden aspect-square border-2 border-transparent hover:border-purple-500 focus:border-purple-500 transition-all cursor-pointer shadow-md bg-zinc-950"
                      >
                        <img 
                          src={url} 
                          alt={`Aluna #${portraitNum}`} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                          loading="lazy" 
                        />
                        <div className="absolute inset-0 bg-purple-600/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Check size={18} className="text-white drop-shadow" />
                        </div>
                        <span className="absolute bottom-1 right-1 text-[8px] bg-black/75 px-1 py-0.2 rounded text-gray-300 font-mono font-bold">
                          #{portraitNum}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsAvatarPickerOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAiContentCreator;
