import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Check, 
  Trash2, 
  Eye, 
  Copy, 
  RefreshCw, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  MessageSquareQuote,
  ExternalLink,
  ShieldCheck,
  User,
  Search,
  Plus,
  Upload,
  X,
  Image as ImageIcon,
  Pencil,
  ChevronUp,
  ChevronDown,
  Lock,
  Globe,
  ShieldAlert
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Testimonial } from '../types/lms';
import { toast } from 'sonner';
import { applyTestimonialOrder } from '../lib/utils';

interface AdminTestimonialsProps {
  onTestimonialCountChange?: (unreadCount: number) => void;
}

export const AdminTestimonials: React.FC<AdminTestimonialsProps> = ({
  onTestimonialCountChange
}) => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'approved' | 'pending'>('all');
  const [search, setSearch] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Manual testimonial creation modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAuthorName, setNewAuthorName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserAvatar, setNewUserAvatar] = useState('');
  const [newHeadline, setNewHeadline] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newRating, setNewRating] = useState<number>(5);
  const [newCourseTitle, setNewCourseTitle] = useState('Geral');
  const [newStatus, setNewStatus] = useState<'approved' | 'pending'>('approved');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);

  // Edit testimonial modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [editAuthorName, setEditAuthorName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserAvatar, setEditUserAvatar] = useState('');
  const [editHeadline, setEditHeadline] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editRating, setEditRating] = useState<number>(5);
  const [editCourseTitle, setEditCourseTitle] = useState('Geral');
  const [editStatus, setEditStatus] = useState<'approved' | 'pending' | 'rejected'>('approved');
  const [editConsent, setEditConsent] = useState<boolean>(true);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchTestimonials = async () => {
    setLoading(true);
    try {
      let list: Testimonial[] = [];
      let orderedIds: string[] = [];

      // 1. Tenta recuperar ordem persistida no cache local
      try {
        const storedOrder = localStorage.getItem('app_testimonials_order');
        if (storedOrder) {
          const parsed = JSON.parse(storedOrder);
          if (Array.isArray(parsed)) orderedIds = parsed;
        }
      } catch {}

      // 2. Limpeza preventiva: garante que a tabela app_settings não retenha nada sobre depoimentos
      try {
        const { data: stData } = await supabase
          .from('app_settings')
          .select('custom_texts')
          .eq('id', 1)
          .maybeSingle();

        if (stData?.custom_texts?.['testimonials_order']) {
          const nextTexts = { ...stData.custom_texts };
          delete nextTexts['testimonials_order'];
          const { error: updErr } = await supabase
            .from('app_settings')
            .update({ custom_texts: nextTexts })
            .eq('id', 1);

          if (updErr) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              await fetch('/api/v1/admin?action=update-settings', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ settings: { custom_texts: nextTexts } })
              });
            }
          }
        }
      } catch {}

      // 3. Tenta carregar da rota de API (já carregada diretamente da tabela testimonials)
      try {
        const res = await fetch('/api/v1/testimonials?all=true');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            list = data as Testimonial[];
          }
        }
      } catch (apiErr) {
        console.warn('[AdminTestimonials] API fetch notice:', apiErr);
      }

      // 4. Se a API estiver vazia ou offline, busca diretamente da tabela dedicada 'testimonials'
      if (list.length === 0) {
        try {
          const { data, error } = await supabase
            .from('testimonials')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data) && data.length > 0) {
            list = data as Testimonial[];
          }
        } catch (err) {
          console.warn('[AdminTestimonials] Supabase query notice:', err);
        }
      }

      // 5. Fallback para cache local se ainda vazio
      if (list.length === 0) {
        try {
          const local = localStorage.getItem('app_testimonials_cache');
          if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
              list = parsed;
            }
          }
        } catch (e) {}
      }

      // Deduplicação final por ID e conteúdo para garantir zero duplicatas na interface
      const seenIds = new Set<string>();
      const seenSignatures = new Set<string>();
      const deduplicatedList: Testimonial[] = [];

      for (const item of list) {
        if (!item || !item.id || seenIds.has(item.id)) continue;
        const sig = `${(item.user_email || item.user_name || '').trim().toLowerCase()}::${(item.content || '').trim()}`;
        if (seenSignatures.has(sig)) continue;
        seenIds.add(item.id);
        seenSignatures.add(sig);
        deduplicatedList.push(item);
      }

      // Aplica ordenação personalizada salva
      const orderedList = applyTestimonialOrder(deduplicatedList, orderedIds);

      // Salva no cache local limpo com a ordem correta
      if (orderedList.length > 0) {
        try {
          localStorage.setItem('app_testimonials_cache', JSON.stringify(orderedList));
        } catch (e) {}
      }

      setTestimonials(orderedList);

      // Report unread count
      const unreadCount = orderedList.filter(t => !t.is_read).length;
      if (onTestimonialCountChange) {
        onTestimonialCountChange(unreadCount);
      }
    } catch (err: any) {
      console.error('[AdminTestimonials] Error fetching:', err);
      toast.error('Erro ao carregar depoimentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestimonials();
    // Fetch available course names for manual selection
    supabase.from('courses').select('title').then(({ data }) => {
      if (data && data.length > 0) {
        const titles = data.map((c: any) => c.title).filter(Boolean);
        setAvailableCourses(titles);
      }
    }).catch(() => {});
  }, []);

  const handleMarkAsRead = async (id: string, currentRead: boolean) => {
    try {
      const nextRead = !currentRead;
      setTestimonials(prev => prev.map(t => t.id === id ? { ...t, is_read: nextRead } : t));

      // 1. Update via server API
      try {
        await fetch('/api/v1/testimonials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark-read', id, is_read: nextRead })
        });
      } catch (e) {}

      // 2. Direct Supabase update if table exists
      try {
        await supabase
          .from('testimonials')
          .update({ is_read: nextRead })
          .eq('id', id);
      } catch (e) {}

      // 3. Update local cache
      try {
        const local = localStorage.getItem('app_testimonials_cache');
        if (local) {
          const parsed = JSON.parse(local);
          const updated = parsed.map((t: any) => t.id === id ? { ...t, is_read: nextRead } : t);
          localStorage.setItem('app_testimonials_cache', JSON.stringify(updated));
        }
      } catch (e) {}

      const newUnread = testimonials.filter(t => t.id === id ? !nextRead : !t.is_read).length;
      if (onTestimonialCountChange) onTestimonialCountChange(newUnread);

      toast.success(nextRead ? 'Marcado como lido!' : 'Marcado como não lido.');
    } catch (err: any) {
      console.error('Error updating read status:', err);
    }
  };

  const handleToggleConsent = async (id: string, currentConsent: boolean) => {
    try {
      const nextConsent = !currentConsent;
      const target = testimonials.find(t => t.id === id);
      const updatedList = testimonials.map(t => t.id === id ? { ...t, consent: nextConsent } : t);
      setTestimonials(updatedList);

      // Direct Supabase update
      try {
        await supabase
          .from('testimonials')
          .update({ consent: nextConsent })
          .eq('id', id);

        if (id.startsWith('local_') && target) {
          await supabase
            .from('testimonials')
            .update({ consent: nextConsent })
            .eq('user_name', target.user_name)
            .eq('content', target.content);
        }
      } catch (e) {}

      // Server API update
      try {
        await fetch('/api/v1/testimonials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', testimonial: { id, consent: nextConsent } })
        });
      } catch (apiErr) {}

      try {
        localStorage.setItem('app_testimonials_cache', JSON.stringify(updatedList));
      } catch (e) {}

      toast.success(
        nextConsent 
          ? 'Depoimento autorizado para exibição pública na página de histórias!' 
          : 'Depoimento ocultado da página pública (visível apenas para admin).'
      );
    } catch (err) {
      toast.error('Erro ao alterar visibilidade do depoimento.');
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      const target = testimonials.find(t => t.id === id);
      const isApproved = status === 'approved';
      const nextConsent = isApproved ? true : (target?.consent ?? true);
      const approvedAt = isApproved ? new Date().toISOString() : (status === 'pending' ? null : target?.approved_at);
      // Quando aprovado pelo admin, automaticamente marca como lido!
      const nextIsRead = isApproved ? true : (target?.is_read ?? false);

      const updatedList = testimonials.map(t => 
        t.id === id ? { 
          ...t, 
          status, 
          consent: nextConsent, 
          is_read: nextIsRead, 
          approved_at: approvedAt 
        } : t
      );
      setTestimonials(updatedList);

      // Atualiza o contador de não lidos imediatamente
      const unreadCount = updatedList.filter(t => !t.is_read).length;
      if (onTestimonialCountChange) {
        onTestimonialCountChange(unreadCount);
      }

      // 1. Direct Supabase update in dedicated testimonials table
      try {
        const updatePayload: any = { 
          status, 
          consent: nextConsent,
          ...(isApproved ? { is_read: true, approved_at: approvedAt } : {})
        };

        const { error: updateErr } = await supabase
          .from('testimonials')
          .update(updatePayload)
          .eq('id', id);

        // Se era um item local ou o ID não bateu, tenta atualizar pelo autor e conteúdo
        if ((updateErr || id.startsWith('local_')) && target) {
          await supabase
            .from('testimonials')
            .update(updatePayload)
            .eq('user_name', target.user_name)
            .eq('content', target.content);
        }
      } catch (e) {
        console.warn('[AdminTestimonials] Supabase update warning:', e);
      }

      // 2. Update via server API
      try {
        await fetch('/api/v1/testimonials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'update-status', 
            id, 
            status,
            consent: nextConsent,
            is_read: isApproved ? true : undefined
          })
        });
      } catch (apiErr) {
        console.warn('[AdminTestimonials] API update warning:', apiErr);
      }

      // 3. Atualiza cache local
      try {
        localStorage.setItem('app_testimonials_cache', JSON.stringify(updatedList));
      } catch (e) {}

      toast.success(
        isApproved 
          ? 'Depoimento aprovado e marcado como lido! Já está visível na página de histórias.' 
          : status === 'rejected'
          ? 'Depoimento rejeitado.'
          : 'Status alterado para pendente.'
      );
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast.error('Erro ao atualizar status.');
    }
  };

  // Reorder testimonials (move up / down) - gravando 100% na tabela própria 'testimonials'
  const handleMove = async (id: string, direction: 'up' | 'down') => {
    // 1. Localiza a posição dentro dos itens visíveis (respeitando filtros atuais)
    const visibleIndex = filteredTestimonials.findIndex(t => t.id === id);
    const targetVisibleIndex = direction === 'up' ? visibleIndex - 1 : visibleIndex + 1;

    if (visibleIndex === -1 || targetVisibleIndex < 0 || targetVisibleIndex >= filteredTestimonials.length) {
      return;
    }

    const currentItem = filteredTestimonials[visibleIndex];
    const targetItem = filteredTestimonials[targetVisibleIndex];

    const currentIndex = testimonials.findIndex(t => t.id === currentItem.id);
    const targetIndex = testimonials.findIndex(t => t.id === targetItem.id);

    if (currentIndex === -1 || targetIndex === -1) return;

    const newTestimonials = [...testimonials];
    const [movedItem] = newTestimonials.splice(currentIndex, 1);
    newTestimonials.splice(targetIndex, 0, movedItem);

    // Atribui timestamps decrescentes diretamente aos itens para que a ordem fique gravada na tabela 'testimonials'
    const baseTime = Date.now();
    for (let i = 0; i < newTestimonials.length; i++) {
      newTestimonials[i] = {
        ...newTestimonials[i],
        created_at: new Date(baseTime - i * 1000).toISOString()
      };
    }

    setTestimonials(newTestimonials);

    const orderedIds = newTestimonials.map(t => t.id);

    // 1. Salva a ordem no cache local
    try {
      localStorage.setItem('app_testimonials_order', JSON.stringify(orderedIds));
      localStorage.setItem('app_testimonials_cache', JSON.stringify(newTestimonials));
    } catch (e) {}

    // 2. Atualiza os registros diretamente na tabela 'testimonials' do Supabase (sem tocar em app_settings)
    try {
      for (let i = 0; i < newTestimonials.length; i++) {
        const item = newTestimonials[i];
        await supabase
          .from('testimonials')
          .update({ created_at: item.created_at })
          .eq('id', item.id);
      }
    } catch (dbErr) {
      console.warn('[AdminTestimonials] Direct DB order update notice:', dbErr);
    }

    // 3. Persiste a ordem no servidor backend (atualiza testimonials.json na tabela própria)
    try {
      await fetch('/api/v1/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', orderedIds })
      });
    } catch (apiErr) {
      console.warn('[AdminTestimonials] Reorder API notice:', apiErr);
    }

    toast.success('Ordem de exibição dos depoimentos atualizada na tabela própria!');
  };

  // Open Edit Modal
  const openEditModal = (item: Testimonial) => {
    setEditingTestimonial(item);
    setEditAuthorName(item.user_name || '');
    setEditUserEmail(item.user_email || '');
    setEditUserAvatar(item.user_avatar || '');
    setEditHeadline(item.headline || '');
    setEditContent(item.content || '');
    setEditRating(item.rating || 5);
    setEditCourseTitle(item.course_title || 'Geral');
    setEditStatus(item.status || 'pending');
    setEditConsent(item.consent !== undefined ? item.consent : true);
    setEditImageUrl(item.image_url || '');
    setIsEditModalOpen(true);
  };

  // Save Edited Testimonial
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTestimonial) return;

    if (!editAuthorName.trim()) {
      toast.error('O nome da aluna é obrigatório.');
      return;
    }
    if (!editContent.trim()) {
      toast.error('O texto do depoimento é obrigatório.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const isApproved = editStatus === 'approved';
      const updatedItem: Testimonial = {
        ...editingTestimonial,
        user_name: editAuthorName.trim(),
        user_email: editUserEmail.trim() || undefined,
        user_avatar: editUserAvatar.trim() || undefined,
        course_title: 'Geral',
        rating: editRating,
        headline: editHeadline.trim() || undefined,
        content: editContent.trim(),
        image_url: editImageUrl.trim() || undefined,
        status: editStatus,
        consent: editConsent,
        is_read: isApproved ? true : (editingTestimonial?.is_read ?? false),
        approved_at: isApproved ? (editingTestimonial?.approved_at || new Date().toISOString()) : editingTestimonial?.approved_at
      };

      // 1. Save to server API
      try {
        await fetch('/api/v1/testimonials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', testimonial: updatedItem })
        });
      } catch (apiErr) {
        console.warn('[AdminTestimonials] API update exception:', apiErr);
      }

      // 2. Direct Supabase update if table exists
      try {
        await supabase
          .from('testimonials')
          .update(updatedItem)
          .eq('id', updatedItem.id);
      } catch (e) {}

      // 3. Update component state
      const updatedList = testimonials.map(t => t.id === updatedItem.id ? updatedItem : t);
      setTestimonials(updatedList);

      // Report updated unread count
      const unreadCount = updatedList.filter(t => !t.is_read).length;
      if (onTestimonialCountChange) {
        onTestimonialCountChange(unreadCount);
      }

      // 4. Update local cache
      try {
        const local = localStorage.getItem('app_testimonials_cache');
        if (local) {
          const parsed = JSON.parse(local);
          const updated = parsed.map((t: any) => t.id === updatedItem.id ? updatedItem : t);
          localStorage.setItem('app_testimonials_cache', JSON.stringify(updated));
        }
      } catch (e) {}

      setIsEditModalOpen(false);
      setEditingTestimonial(null);
      toast.success('Depoimento editado e salvo com sucesso!');
    } catch (err: any) {
      console.error('Error saving edited testimonial:', err);
      toast.error('Erro ao salvar alterações no depoimento.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleAddManualTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthorName.trim()) {
      toast.error('Por favor, informe o nome da aluna.');
      return;
    }
    if (!newContent.trim()) {
      toast.error('Por favor, informe o texto do depoimento.');
      return;
    }

    setIsSubmittingNew(true);
    try {
      const manualTestimonial: Testimonial = {
        id: 'manual_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        user_name: newAuthorName.trim(),
        user_email: newUserEmail.trim() || undefined,
        user_avatar: newUserAvatar.trim() || undefined,
        course_title: 'Geral',
        rating: newRating,
        headline: newHeadline.trim() || undefined,
        content: newContent.trim(),
        status: newStatus,
        is_read: true,
        consent: true,
        created_at: new Date().toISOString()
      };

      // 1. Save via server API
      try {
        await fetch('/api/v1/testimonials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', testimonial: manualTestimonial })
        });
      } catch (apiErr) {
        console.warn('[AdminTestimonials] API create exception:', apiErr);
      }

      // 2. Direct Supabase upsert
      try {
        await supabase
          .from('testimonials')
          .upsert(manualTestimonial, { onConflict: 'id' });
      } catch (dbErr) {}

      // 3. Save in local cache so it appears immediately on inspiring stories page
      try {
        const local = localStorage.getItem('app_testimonials_cache');
        const parsed = local ? JSON.parse(local) : [];
        parsed.unshift(manualTestimonial);
        localStorage.setItem('app_testimonials_cache', JSON.stringify(parsed));
      } catch (cacheErr) {}

      // 4. Update component state
      const updatedList = [manualTestimonial, ...testimonials];
      setTestimonials(updatedList);

      toast.success(
        newStatus === 'approved'
          ? 'Depoimento adicionado e aprovado com sucesso! Já está visível na página de depoimentos.'
          : 'Depoimento salvo como pendente.'
      );

      // Reset form and close modal
      setIsAddModalOpen(false);
      setNewAuthorName('');
      setNewUserEmail('');
      setNewUserAvatar('');
      setNewHeadline('');
      setNewContent('');
      setNewRating(5);
      setNewCourseTitle('Geral');
      setNewStatus('approved');
    } catch (err: any) {
      console.error('Error adding manual testimonial:', err);
      toast.error('Erro ao adicionar depoimento.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este depoimento? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const updatedList = testimonials.filter(t => t.id !== id);
      setTestimonials(updatedList);

      // 1. Direct Supabase delete from dedicated table
      try {
        await supabase
          .from('testimonials')
          .delete()
          .eq('id', id);
      } catch (e) {}

      // 2. Delete via server API
      try {
        await fetch('/api/v1/testimonials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id })
        });
      } catch (apiErr) {}

      // 3. Update local cache
      try {
        const local = localStorage.getItem('app_testimonials_cache');
        if (local) {
          const parsed = JSON.parse(local).filter((t: any) => t.id !== id);
          localStorage.setItem('app_testimonials_cache', JSON.stringify(parsed));
        }
      } catch (e) {}

      toast.success('Depoimento excluído.');
    } catch (err: any) {
      console.error('Error deleting testimonial:', err);
      toast.error('Erro ao excluir depoimento.');
    }
  };

  const handleCopy = (item: Testimonial) => {
    const textToCopy = `"${item.content}"\n\n— ${item.user_name} (${item.rating} ⭐)${item.course_title && item.course_title !== 'General' ? `\nCurso: ${item.course_title}` : ''}`;
    navigator.clipboard.writeText(textToCopy);
    toast.success('Depoimento copiado para a área de transferência!');
  };

  const filteredTestimonials = testimonials.filter(item => {
    if (filter === 'unread' && item.is_read) return false;
    if (filter === 'approved' && item.status !== 'approved') return false;
    if (filter === 'pending' && item.status !== 'pending') return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = item.user_name?.toLowerCase().includes(q);
      const matchEmail = item.user_email?.toLowerCase().includes(q);
      const matchContent = item.content?.toLowerCase().includes(q);
      const matchCourse = item.course_title?.toLowerCase().includes(q);
      const matchHeadline = item.headline?.toLowerCase().includes(q);
      return matchName || matchEmail || matchContent || matchCourse || matchHeadline;
    }

    return true;
  });

  const totalCount = testimonials.length;
  const unreadCount = testimonials.filter(t => !t.is_read).length;
  const approvedCount = testimonials.filter(t => t.status === 'approved').length;
  const averageRating = totalCount > 0 
    ? (testimonials.reduce((acc, cur) => acc + (cur.rating || 5), 0) / totalCount).toFixed(1)
    : '5.0';

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Sparkles className="text-amber-400" size={26} />
            <span>Depoimentos & Histórias de Sucesso</span>
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Acompanhe as transformações e resultados compartilhados pelas alunas após aplicarem o conteúdo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={15} />
            <span>Adicionar Depoimento</span>
          </button>

          <button
            onClick={fetchTestimonials}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold uppercase tracking-wider border border-white/10 transition-colors w-fit"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-amber-400' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-1">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Recebidos</span>
          <div className="text-2xl font-black text-white">{totalCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={12} />
            Não Lidos
          </span>
          <div className="text-2xl font-black text-amber-400">{unreadCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
            <CheckCircle2 size={12} />
            Aprovados
          </span>
          <div className="text-2xl font-black text-emerald-400">{approvedCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-1">
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
            <Star size={12} className="fill-amber-400" />
            Média de Avaliação
          </span>
          <div className="text-2xl font-black text-white">{averageRating} ⭐</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 bg-black rounded-xl border border-white/10 w-full sm:w-fit overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              filter === 'all' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Todos ({totalCount})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              filter === 'unread' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Não Lidos ({unreadCount})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              filter === 'approved' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Aprovados ({approvedCount})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              filter === 'pending' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Pendentes
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou texto..."
            className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-amber-500 outline-none"
          />
        </div>
      </div>

      {/* List of Testimonials */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-500 uppercase tracking-widest">Carregando depoimentos...</p>
        </div>
      ) : filteredTestimonials.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-zinc-900/30 rounded-3xl border border-white/5 p-8">
          <MessageSquareQuote size={40} className="mx-auto text-gray-600" />
          <h4 className="text-base font-bold text-gray-300">Nenhum depoimento encontrado</h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Assim que as alunas enviarem seus relatos de conquistas no final da Home, eles aparecerão aqui com notificações automáticas para você.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTestimonials.map((item) => {
            const isUnread = !item.is_read;
            return (
              <div
                key={item.id}
                className={`relative rounded-3xl border transition-all p-6 space-y-4 ${
                  isUnread 
                    ? 'bg-gradient-to-r from-amber-500/10 via-zinc-900/90 to-zinc-900 border-amber-500/30 shadow-lg shadow-amber-500/5'
                    : 'bg-zinc-900/50 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Header: Student Info + Date + Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {item.user_avatar ? (
                      <img
                        src={item.user_avatar}
                        alt={item.user_name}
                        className="w-10 h-10 rounded-full object-cover border border-amber-500/40 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-sm border border-amber-500/30 shrink-0">
                        {item.user_name?.charAt(0).toUpperCase() || 'A'}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {item.user_name}
                        </span>
                        {isUnread && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-black">
                            Novo
                          </span>
                        )}
                        {item.status === 'approved' && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Aprovado
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 block truncate">
                        {item.user_email || 'E-mail não informado'}
                      </span>
                    </div>
                  </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      {/* Order position and move up/down controls */}
                      <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-xl px-2.5 py-1">
                        <span className="text-[10px] font-mono font-bold text-amber-400/90" title="Posição na ordem de exibição">
                          #{testimonials.findIndex(t => t.id === item.id) + 1}
                        </span>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => handleMove(item.id, 'up')}
                            disabled={filteredTestimonials.findIndex(t => t.id === item.id) <= 0}
                            className="p-1 text-gray-400 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-gray-400 cursor-pointer disabled:cursor-not-allowed transition-colors"
                            title="Subir (exibir antes na página de histórias)"
                          >
                            <ChevronUp size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(item.id, 'down')}
                            disabled={filteredTestimonials.findIndex(t => t.id === item.id) >= filteredTestimonials.length - 1}
                            className="p-1 text-gray-400 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-gray-400 cursor-pointer disabled:cursor-not-allowed transition-colors"
                            title="Descer (exibir depois na página de histórias)"
                          >
                            <ChevronDown size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            className={i < (item.rating || 5) ? 'fill-amber-400' : 'text-zinc-700'}
                          />
                        ))}
                      </div>

                      <span className="text-[11px] text-gray-500 font-mono whitespace-nowrap">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>

                  {/* Confidentiality Alert if Not Authorized for Public Sharing */}
                  {item.consent === false && (
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                          <Lock size={16} />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-rose-400 uppercase tracking-wider">
                              Depoimento Marcado como Restrito
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              Apenas Administrador
                            </span>
                          </div>
                          <p className="text-xs text-rose-200/80 leading-relaxed">
                            Inicialmente marcado como restrito. Clique no botão ao lado para autorizar e exibir publicamente na página de depoimentos.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleConsent(item.id, false)}
                        className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
                        title="Tornar este depoimento público na página de histórias"
                      >
                        <Globe size={14} />
                        <span>Tornar Público</span>
                      </button>
                    </div>
                  )}

                {/* Course Tag */}
                {item.course_title && item.course_title !== 'General' && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-semibold">
                    <span className="text-gray-500 text-[10px] uppercase tracking-wider font-bold">Curso:</span>
                    <span>{item.course_title}</span>
                  </div>
                )}

                {/* Headline / Summary */}
                {item.headline && (
                  <div className="text-sm font-bold text-amber-300 italic">
                    "{item.headline}"
                  </div>
                )}

                {/* Full Content */}
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {item.content}
                </div>

                {/* Attached Image / Screenshot */}
                {item.image_url && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                      Comprovante / Print Anexado:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedImage(item.image_url || null)}
                      className="group relative rounded-2xl overflow-hidden border border-white/10 max-w-xs block hover:border-amber-500 transition-colors"
                    >
                      <img
                        src={item.image_url}
                        alt="Comprovante"
                        className="max-h-48 object-cover w-full group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold gap-1.5 transition-opacity">
                        <Eye size={14} />
                        <span>Ver Imagem Completa</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMarkAsRead(item.id, item.is_read)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 border ${
                        item.is_read
                          ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                      }`}
                    >
                      <Check size={13} />
                      <span>{item.is_read ? 'Marcar como Não Lido' : 'Marcar como Lido'}</span>
                    </button>

                    {item.status !== 'approved' ? (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'approved')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={13} />
                        <span>Aprovar</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'pending')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-gray-300 border border-white/10 transition-colors flex items-center gap-1.5"
                      >
                        <XCircle size={13} />
                        <span>Revogar Aprovação</span>
                      </button>
                    )}

                    {/* Toggle Visibilidade Pública */}
                    <button
                      onClick={() => handleToggleConsent(item.id, item.consent !== false)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 border ${
                        item.consent !== false
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                      }`}
                      title={item.consent !== false ? 'Depoimento público: clique para tornar restrito' : 'Depoimento restrito: clique para autorizar exibição pública'}
                    >
                      {item.consent !== false ? <Globe size={13} /> : <Lock size={13} />}
                      <span>{item.consent !== false ? 'Público' : 'Restrito'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-amber-500/20 text-gray-300 hover:text-amber-400 transition-colors border border-white/10 hover:border-amber-500/30 cursor-pointer"
                      title="Editar Depoimento (Conteúdo, notas, status, consentimento)"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      onClick={() => handleCopy(item)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors border border-white/10 cursor-pointer"
                      title="Copiar Depoimento"
                    >
                      <Copy size={15} />
                    </button>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-colors border border-red-500/20 cursor-pointer"
                      title="Excluir Depoimento"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-zinc-950 border border-white/20 p-2">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/80 text-white hover:bg-red-500 transition-colors z-10"
            >
              <XCircle size={22} />
            </button>
            <img
              src={selectedImage}
              alt="Ampliada"
              className="max-h-[85vh] w-auto mx-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Manual Testimonial Creation Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-zinc-950 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2.5">
                  <Sparkles size={20} className="text-amber-400" />
                  <span>Cadastrar Depoimento Manual</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Adicione depoimentos recebidos pelo WhatsApp, Instagram, e-mail ou outras fontes para exibir na página de histórias inspiradoras.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddManualTestimonial} className="space-y-4">
              {/* Author Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Nome da Aluna / Autora <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={newAuthorName}
                  onChange={(e) => setNewAuthorName(e.target.value)}
                  placeholder="Ex: Mariana Silva"
                  className="w-full bg-black/60 border border-white/10 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
                  required
                />
              </div>

              {/* Email or Social Handle */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Identificador / E-mail / Rede Social <span className="text-gray-500 text-[10px]">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Ex: @mariana.maternidade ou WhatsApp"
                  className="w-full bg-black/60 border border-white/10 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
                />
              </div>

              {/* Rating */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Avaliação em Estrelas
                </label>
                <div className="flex items-center gap-1.5 h-10 px-3 bg-black/60 border border-white/10 rounded-xl w-fit">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="p-1 hover:scale-125 transition-transform cursor-pointer"
                    >
                      <Star
                        size={18}
                        className={
                          star <= newRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-zinc-700'
                        }
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-amber-400 ml-2">{newRating}.0</span>
                </div>
              </div>

              {/* Headline */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Frase de Destaque / Título <span className="text-gray-500 text-[10px]">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={newHeadline}
                  onChange={(e) => setNewHeadline(e.target.value)}
                  placeholder="Ex: Esse conteúdo transformou a rotina da minha casa"
                  className="w-full bg-black/60 border border-white/10 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
                />
              </div>

              {/* Content */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Texto do Depoimento <span className="text-amber-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Cole aqui o relato completo da aluna..."
                  className="w-full bg-black/60 border border-white/10 focus:border-amber-500 rounded-xl p-3.5 text-sm text-white placeholder:text-gray-600 outline-none transition-colors leading-relaxed custom-scrollbar"
                  required
                />
              </div>

              {/* Avatar / Photo */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Foto ou Avatar da Autora <span className="text-gray-500 text-[10px]">(Opcional)</span>
                </label>

                <div className="flex items-center gap-3">
                  {newUserAvatar ? (
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-amber-500/50 shrink-0">
                      <img src={newUserAvatar} alt="Avatar" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setNewUserAvatar('')}
                        className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 shrink-0">
                      <User size={20} />
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <input
                      type="url"
                      value={newUserAvatar}
                      onChange={(e) => setNewUserAvatar(e.target.value)}
                      placeholder="Cole a URL da foto (https://...)"
                      className="w-full bg-black/60 border border-white/10 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 outline-none"
                    />

                    <label className="inline-flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer">
                      <Upload size={13} />
                      <span>Ou carregar imagem do seu dispositivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (ev.target?.result) {
                                setNewUserAvatar(ev.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Status Select */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Status Inicial
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewStatus('approved')}
                    className={`p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                      newStatus === 'approved'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle2 size={14} />
                      <span>Aprovado</span>
                    </div>
                    <span className="text-[10px] opacity-80 block">Visível imediatamente na página de histórias</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewStatus('pending')}
                    className={`p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                      newStatus === 'pending'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock size={14} />
                      <span>Pendente</span>
                    </div>
                    <span className="text-[10px] opacity-80 block">Apenas salvo no painel administrativo</span>
                  </button>
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingNew ? 'Salvando...' : 'Salvar Depoimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Testimonial Modal */}
      {isEditModalOpen && editingTestimonial && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-zinc-950 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2.5">
                  <Pencil size={20} className="text-amber-400" />
                  <span>Editar Depoimento</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Edite o texto, dados da autora, avaliação em estrelas, autorização de compartilhamento e visibilidade.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingTestimonial(null);
                }}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Author Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Nome da Aluna / Autora <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={editAuthorName}
                  onChange={(e) => setEditAuthorName(e.target.value)}
                  placeholder="Nome completo ou de exibição"
                  className="w-full bg-black/60 border border-white/10 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
                  required
                />
              </div>

              {/* Email / Social */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  E-mail ou Identificador <span className="text-gray-500 text-[10px]">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  placeholder="Ex: aluna@email.com ou @instagram"
                  className="w-full bg-black/60 border border-white/10 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
                />
              </div>

              {/* Rating */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Avaliação em Estrelas
                </label>
                <div className="flex items-center gap-1.5 h-10 px-3 bg-black/60 border border-white/10 rounded-xl w-fit">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditRating(star)}
                      className="p-1 hover:scale-125 transition-transform cursor-pointer"
                    >
                      <Star
                        size={18}
                        className={
                          star <= editRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-zinc-700'
                        }
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-amber-400 ml-2">{editRating}.0</span>
                </div>
              </div>

              {/* Headline */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Frase de Destaque / Título <span className="text-gray-500 text-[10px]">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={editHeadline}
                  onChange={(e) => setEditHeadline(e.target.value)}
                  placeholder="Ex: Uma virada de chave incrível na minha rotina"
                  className="w-full bg-black/60 border border-white/10 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
                />
              </div>

              {/* Content */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Texto do Depoimento <span className="text-amber-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Texto do relato..."
                  className="w-full bg-black/60 border border-white/10 focus:border-amber-500 rounded-xl p-3.5 text-sm text-white placeholder:text-gray-600 outline-none transition-colors leading-relaxed custom-scrollbar"
                  required
                />
              </div>

              {/* Avatar / Photo */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Foto ou Avatar da Autora <span className="text-gray-500 text-[10px]">(Opcional)</span>
                </label>

                <div className="flex items-center gap-3">
                  {editUserAvatar ? (
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-amber-500/50 shrink-0">
                      <img src={editUserAvatar} alt="Avatar" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setEditUserAvatar('')}
                        className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                        title="Remover foto"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 shrink-0">
                      <User size={20} />
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <input
                      type="url"
                      value={editUserAvatar}
                      onChange={(e) => setEditUserAvatar(e.target.value)}
                      placeholder="URL da foto (https://...)"
                      className="w-full bg-black/60 border border-white/10 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 outline-none"
                    />

                    <label className="inline-flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer">
                      <Upload size={13} />
                      <span>Substituir imagem do dispositivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (ev.target?.result) {
                                setEditUserAvatar(ev.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Attached Screenshot or Result Image */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Foto / Comprovante Anexado <span className="text-gray-500 text-[10px]">(Opcional)</span>
                </label>

                <div className="flex items-center gap-3">
                  {editImageUrl ? (
                    <div className="relative w-16 h-12 rounded-xl overflow-hidden border border-amber-500/50 shrink-0">
                      <img src={editImageUrl} alt="Anexo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setEditImageUrl('')}
                        className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                        title="Remover anexo"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 shrink-0">
                      <ImageIcon size={20} />
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <input
                      type="url"
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      placeholder="URL do anexo/print (https://...)"
                      className="w-full bg-black/60 border border-white/10 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 outline-none"
                    />

                    <label className="inline-flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer">
                      <Upload size={13} />
                      <span>Carregar print do dispositivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (ev.target?.result) {
                                setEditImageUrl(ev.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Consent Management Toggle */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {editConsent ? (
                      <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Lock size={18} className="text-rose-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-white">
                      Autorização de Compartilhamento Público
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditConsent(!editConsent)}
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      editConsent
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {editConsent ? 'Autorizado' : 'Não Autorizado'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  {editConsent 
                    ? 'A aluna concedeu autorização para o depoimento ser publicado na página de histórias inspiradoras.'
                    : 'A aluna optou por não compartilhar publicamente. O depoimento permanece confidencial e exclusivo para a administração.'
                  }
                </p>
              </div>

              {/* Status Select */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Status de Moderação
                </label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setEditStatus('approved')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      editStatus === 'approved'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 size={15} className="mx-auto mb-1" />
                    <span>Aprovado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditStatus('pending')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      editStatus === 'pending'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Clock size={15} className="mx-auto mb-1" />
                    <span>Pendente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditStatus('rejected')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      editStatus === 'rejected'
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <XCircle size={15} className="mx-auto mb-1" />
                    <span>Rejeitado</span>
                  </button>
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingTestimonial(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSavingEdit ? 'Salvando Alterações...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
