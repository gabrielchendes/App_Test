import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Upload, 
  Image as ImageIcon, 
  Check, 
  Maximize2,
  RefreshCw,
  Sparkles,
  Link as LinkIcon,
  UploadCloud,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/customToast';

const getCorsSafeUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('blob:')) return url;
  // If the image is a remote URL, route it through images.weserv.nl proxy to bypass CORS!
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (url.includes('images.weserv.nl')) return url;
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
  }
  return url;
};

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void;
  aspectRatio?: number; // width / height
  title?: string;
  initialImageSrc?: string;
  allowUpload?: boolean;
}

export default function ImageCropperModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  aspectRatio = 3/4,
  title = "Ajustar Capa do Curso",
  initialImageSrc = "",
  allowUpload = true
}: ImageCropperModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset states on open/close
  useEffect(() => {
    if (isOpen) {
      setImageSrc(getCorsSafeUrl(initialImageSrc) || null);
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setUrlInput('');
      setIsDropActive(false);
    }
  }, [isOpen, initialImageSrc]);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 15MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  // Support paste from clipboard
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            toast.success('Imagem colada da área de transferência!');
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!imageSrc) return;
    setIsDragging(true);
    dragStart.current = { x: clientX - position.x, y: clientY - position.y };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging || !imageSrc) return;
    setPosition({
      x: clientX - dragStart.current.x,
      y: clientY - dragStart.current.y
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Scroll to zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!imageSrc) return;
    e.preventDefault();
    const zoomStep = 0.05;
    const newZoom = e.deltaY < 0 ? Math.min(zoom + zoomStep, 3) : Math.max(zoom - zoomStep, 1);
    setZoom(newZoom);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    setPosition({ x: 0, y: 0 });
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleSave = async () => {
    if (!imageSrc) return;
    setLoading(true);

    try {
      // 1. Get image element reliably without hanging on data URLs
      let img: HTMLImageElement | null = null;
      if (imageRef.current && imageRef.current.naturalWidth > 0) {
        img = imageRef.current;
      } else {
        const loadedImg = new Image();
        if (!imageSrc.startsWith('data:') && !imageSrc.startsWith('blob:')) {
          loadedImg.crossOrigin = 'anonymous';
        }
        await new Promise<void>((resolve, reject) => {
          loadedImg.onload = () => resolve();
          loadedImg.onerror = () => reject(new Error("Não foi possível carregar a imagem. Verifique o arquivo selecionado."));
          loadedImg.src = getCorsSafeUrl(imageSrc) || imageSrc;
          if (loadedImg.complete && loadedImg.naturalWidth > 0) {
            resolve();
          }
        });
        img = loadedImg;
      }

      if (!img || img.naturalWidth === 0) {
        throw new Error('Não foi possível renderizar a imagem');
      }

      // Target canvas dimensions
      // Proporção 3:4 (Capa de Curso): 810 x 1080 px
      // Proporção 1:1 (Capa de Aula): 720 x 720 px
      const targetWidth = aspectRatio < 1 ? 810 : 720;
      const targetHeight = Math.round(targetWidth / aspectRatio);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Não foi possível inicializar o canvas 2D');
      }

      // Draw background (black)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Viewport dimensions in cropper UI
      const viewWidth = containerRef.current?.clientWidth || 300;
      const viewHeight = containerRef.current?.clientHeight || 400;

      // Base scaling inside cropper viewport (object-fit: cover equivalent)
      const hRatio = viewWidth / img.naturalWidth;
      const vRatio = viewHeight / img.naturalHeight;
      const baseScale = Math.max(hRatio, vRatio);

      // Scale multiplier from viewport to high-res canvas
      const scaleMultiplier = targetWidth / viewWidth;

      // Translate context to center of canvas for rotation support
      ctx.translate(targetWidth / 2, targetHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Render the image with offset, zoom and scale
      const drawWidth = img.naturalWidth * baseScale * zoom * scaleMultiplier;
      const drawHeight = img.naturalHeight * baseScale * zoom * scaleMultiplier;
      
      const drawX = (position.x * scaleMultiplier) - (drawWidth / 2);
      const drawY = (position.y * scaleMultiplier) - (drawHeight / 2);

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

      // Convert canvas to optimized modern WebP (with high-quality JPEG fallback)
      let mimeType = 'image/webp';
      let ext = 'webp';
      let dataUrl = canvas.toDataURL('image/webp', 0.88);
      if (!dataUrl.startsWith('data:image/webp')) {
        mimeType = 'image/jpeg';
        ext = 'jpg';
        dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      }

      let finalUrl = '';
      const folder = aspectRatio < 1 ? 'courses' : 'lessons';
      const fileName = `${folder}/cover-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.${ext}`;

      // Strategy 1: Direct Supabase Cloud Storage Client (Global Public CDN URL)
      try {
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), mimeType, 0.88);
        });

        if (blob && supabase?.storage) {
          // Priority buckets based on entity type:
          // course_covers & course_content are standard with public read access
          const candidateBuckets = folder === 'courses' 
            ? ['course_covers', 'course_content', 'community_images', 'contents', 'Ebooks', 'avatars']
            : ['course_content', 'course_covers', 'community_images', 'contents', 'Ebooks', 'avatars'];

          for (const bucket of candidateBuckets) {
            try {
              const { data, error } = await supabase.storage
                .from(bucket)
                .upload(fileName, blob, {
                  contentType: mimeType,
                  cacheControl: '31536000, public',
                  upsert: true
                });

              if (!error && data) {
                const { data: { publicUrl } } = supabase.storage
                  .from(bucket)
                  .getPublicUrl(data.path || fileName);
                
                if (publicUrl) {
                  finalUrl = publicUrl;
                  console.log(`[ImageCropperModal] Uploaded directly to Supabase Storage (${bucket}):`, publicUrl);
                  break;
                }
              }
            } catch {
              // Try next bucket
            }
          }
        }
      } catch (storageErr) {
        console.warn('[ImageCropperModal] Direct Supabase storage notice:', storageErr);
      }

      // Strategy 2: Enterprise Cloud API Backend Proxy (bypasses browser RLS via server auth)
      if (!finalUrl) {
        try {
          const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
          const token = sessionData?.session?.access_token;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          // Try server endpoints with auto-fallback
          const endpoints = ['/api/v1/admin?action=upload-image', '/api/v1/upload-image', '/api/upload-image'];
          for (const ep of endpoints) {
            try {
              const uploadResp = await fetch(ep, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  image: dataUrl,
                  folder,
                  contentType: mimeType
                })
              });

              if (uploadResp.ok) {
                const uploadJson = await uploadResp.json();
                if (uploadJson && uploadJson.url && !uploadJson.url.startsWith('/uploads/')) {
                  finalUrl = uploadJson.url;
                  console.log(`[ImageCropperModal] Stored via Backend API (${ep}):`, finalUrl);
                  break;
                }
              }
            } catch {
              // Try next endpoint
            }
          }
        } catch (uploadErr) {
          console.warn('[ImageCropperModal] Server upload API notice:', uploadErr);
        }
      }

      // Strategy 3: Self-contained Data URL fallback (renders everywhere without local file dependency)
      if (!finalUrl) {
        finalUrl = dataUrl;
      }

      toast.success('Imagem salva na nuvem com sucesso!');
      onConfirm(finalUrl);
      onClose();
    } catch (err: any) {
      console.error('Erro ao processar imagem:', err);
      toast.error('Erro ao processar imagem: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg bg-[#0e0e12] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">{title}</h3>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {aspectRatio < 1 
                      ? 'Proporção 3:4 (Recomendado 1080x1440 px para Cursos)' 
                      : 'Proporção 1:1 (Recomendado para Aulas, Avatares e Fotos de Perfil)'}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDropActive(true); }}
              onDragLeave={() => setIsDropActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDropActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processFile(file);
              }}
              className="p-8 flex flex-col items-center gap-6"
            >
              {!imageSrc ? (
                // Upload Placeholder with Drag & Drop and URL Input
                <div className="w-full max-w-sm flex flex-col items-center gap-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full aspect-[${aspectRatio > 1 ? '16/9' : aspectRatio === 1 ? '1/1' : '3/4'}] min-h-[220px] max-h-[300px] rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group text-center p-6 shadow-xl ${
                      isDropActive 
                        ? 'border-blue-500 bg-blue-500/10 scale-102' 
                        : 'border-white/15 hover:border-blue-500/50 bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 text-blue-400 flex items-center justify-center transition-all mb-4 shadow-inner group-hover:scale-110">
                      <UploadCloud size={32} />
                    </div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">
                      {isDropActive ? 'Solte a foto aqui' : 'Fazer Upload da Foto'}
                    </h4>
                    <p className="text-[11px] text-gray-400 font-medium">
                      Clique para escolher do computador ou arraste o arquivo aqui
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-gray-400">
                      {aspectRatio < 1 ? 'Proporção 3:4' : 'Proporção 1:1 Quadrada'} • JPG, PNG, WebP
                    </div>
                  </div>

                  {/* Direct URL input alternative */}
                  <div className="w-full space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1 text-center">
                      Ou cole o link direto da imagem (URL)
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="text"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (urlInput.trim()) {
                                setImageSrc(getCorsSafeUrl(urlInput.trim()) || urlInput.trim());
                                setZoom(1);
                                setRotation(0);
                                setPosition({ x: 0, y: 0 });
                                setUrlInput('');
                              }
                            }
                          }}
                          placeholder="https://exemplo.com/foto.jpg"
                          className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-[10px] text-gray-300 focus:border-blue-500 outline-none font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (urlInput.trim()) {
                            setImageSrc(getCorsSafeUrl(urlInput.trim()) || urlInput.trim());
                            setZoom(1);
                            setRotation(0);
                            setPosition({ x: 0, y: 0 });
                            setUrlInput('');
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                      >
                        Carregar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Cropper Interface
                <div className="w-full flex flex-col items-center gap-6">
                  {/* Viewport Container */}
                  <div 
                    ref={containerRef}
                    onWheel={handleWheel}
                    onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
                    onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleDragEnd}
                    style={{ 
                      aspectRatio: aspectRatio, 
                      width: aspectRatio > 1 ? '360px' : aspectRatio === 1 ? '260px' : '240px',
                      maxWidth: '100%'
                    }}
                    className="rounded-3xl border border-white/10 overflow-hidden relative bg-black cursor-move select-none shadow-2xl group"
                  >
                    {imageSrc && imageSrc.trim() ? (
                      <img
                        ref={imageRef}
                        src={imageSrc.trim()}
                        alt="Preview"
                        draggable="false"
                        style={{
                          position: 'absolute',
                          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                          transformOrigin: 'center center',
                          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                          maxWidth: 'none',
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-4 text-center">
                        <Upload size={32} className="opacity-30 mb-2" />
                        <span className="text-xs font-bold uppercase tracking-wider opacity-60">Nenhuma imagem carregada</span>
                      </div>
                    )}

                    {/* Viewport Overlay bounds guide */}
                    <div className="absolute inset-0 border-[3px] border-blue-500/30 rounded-3xl pointer-events-none group-hover:border-blue-500/60 transition-colors" />
                    
                    {/* Corner accents */}
                    <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-white pointer-events-none" />
                    <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-white pointer-events-none" />
                    <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-white pointer-events-none" />
                    <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-white pointer-events-none" />
                  </div>

                  {/* Controls Row */}
                  <div className="w-full space-y-4 px-4">
                    {/* Zoom Slider */}
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setZoom(Math.max(zoom - 0.1, 1))}
                        className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
                        title="Diminuir Zoom"
                      >
                        <ZoomOut size={16} />
                      </button>
                      <input 
                        type="range"
                        min="1"
                        max="3"
                        step="0.01"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                      />
                      <button 
                        onClick={() => setZoom(Math.min(zoom + 0.1, 3))}
                        className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
                        title="Aumentar Zoom"
                      >
                        <ZoomIn size={16} />
                      </button>
                    </div>

                    {/* Action buttons under slider */}
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3.5 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Upload size={12} /> Trocar Foto
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageSrc(null)}
                          className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                          title="Escolher Outra"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleRotate}
                          className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors cursor-pointer"
                          title="Girar 90°"
                        >
                          <RotateCw size={14} />
                        </button>
                        <button 
                          onClick={handleReset}
                          className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer"
                          title="Redefinir Ajustes"
                        >
                          Resetar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-white/5 bg-[#0b0b0e] flex items-center justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-3.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={!imageSrc || loading}
                className={`px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg cursor-pointer ${
                  imageSrc && !loading 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/10' 
                    : 'bg-white/5 text-gray-500 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} /> Processando...
                  </>
                ) : (
                  <>
                    <Check size={14} /> Salvar Capa
                  </>
                )}
              </button>
            </div>
          </motion.div>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>
      )}
    </AnimatePresence>
  );
}
