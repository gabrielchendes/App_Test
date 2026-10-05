import React, { useState, useRef, useEffect } from 'react';
import { User, Lock, Mail, Save, Loader2, Camera, Bell, LogOut, Download, Smartphone, Calendar, MapPin } from 'lucide-react';
import { GlowingSpinner } from './GlowingSpinner';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { requestNotificationPermission } from '../lib/pushNotifications';
import { cn } from '../lib/utils';

interface ProfileProps {
  user: SupabaseUser;
  canInstall?: boolean;
  onInstall?: () => void;
}

// US Phone format mask: (XXX) XXX-XXXX
const formatUSPhone = (val: string): string => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 3) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // Allow additional numbers while preserving standard mask prefix
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)} ${digits.slice(10)}`;
};

// US Date format mask: MM/DD/YYYY
const formatDateOfBirth = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

// Validation: Month 01-12, Day 01-31 according to month, Year 1900 to current
const validateDateOfBirth = (val: string): string | null => {
  if (!val || val.trim() === '') return null;
  const parts = val.split('/');
  if (parts.length !== 3 || val.length !== 10) {
    return 'Please enter a valid date in MM/DD/YYYY format';
  }
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(month) || isNaN(day) || isNaN(year)) {
    return 'Please enter a valid date in MM/DD/YYYY format';
  }

  if (month < 1 || month > 12) {
    return 'Please enter a valid month (01–12)';
  }

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month - 1];

  if (day < 1 || day > maxDay) {
    return `Please enter a valid day (01–${maxDay}) for month ${String(month).padStart(2, '0')}`;
  }

  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) {
    return `Please enter a valid year between 1900 and ${currentYear}`;
  }

  return null;
};

export default function Profile({ user, canInstall, onInstall }: ProfileProps) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [fullName, setFullName] = useState(() => {
    return (user?.id ? localStorage.getItem(`cached_full_name_${user.id}`) : null) || user.user_metadata?.full_name || '';
  });
  const [profileAppIconError, setProfileAppIconError] = useState(false);
  const rawProfileAppIcon = settings.pwa_icon_url || settings.android_icon_url || settings.ios_icon_url || settings.favicon_url;
  const profileAppIcon = (!profileAppIconError && rawProfileAppIcon && rawProfileAppIcon.trim()) ? rawProfileAppIcon.trim() : null;
  
  // Parse initial phone and country code (default to '1' for US standard +1)
  const initialPhone = user.user_metadata?.phone || '';
  const parseInitialPhone = () => {
    if (initialPhone.startsWith('+')) {
      const match = initialPhone.match(/^\+(\d{1,4})\s*(.*)$/);
      if (match) {
        return {
          code: match[1] || '1',
          body: match[2] ? match[2].trim() : ''
        };
      }
    }
    return {
      code: user.user_metadata?.country_code || '1',
      body: initialPhone
    };
  };

  const parsedPhone = parseInitialPhone();
  // Pre-fill country code with '1' for US +1 default
  const [countryCode, setCountryCode] = useState(parsedPhone.code || '1');
  const [phoneBody, setPhoneBody] = useState(formatUSPhone(parsedPhone.body));
  
  // Date of Birth and City fields
  const [dateOfBirth, setDateOfBirth] = useState(() => {
    const rawDob = user.user_metadata?.date_of_birth || user.user_metadata?.birthdate || '';
    return formatDateOfBirth(rawDob);
  });
  const [dobError, setDobError] = useState<string | null>(null);
  const [city, setCity] = useState(user.user_metadata?.city || '');

  const [avatarUrl, setAvatarUrl] = useState(() => {
    return (user?.id ? localStorage.getItem(`cached_avatar_url_${user.id}`) : null) || user.user_metadata?.avatar_url || '';
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pushStatus, setPushStatus] = useState<{ supported: boolean, permission: string, tokenGenerated: boolean }>({
    supported: 'Notification' in window,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'not-supported',
    tokenGenerated: false
  });

  // Sync profile data from profiles table if columns exist
  useEffect(() => {
    let isMounted = true;
    const loadProfileData = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, phone, date_of_birth, city')
          .eq('id', user.id)
          .maybeSingle();

        if (!error && data && isMounted) {
          if (data.full_name) {
            setFullName(data.full_name);
            try {
              localStorage.setItem(`cached_full_name_${user.id}`, data.full_name);
            } catch (e) {}
            window.dispatchEvent(new CustomEvent('user-profile-updated', {
              detail: { full_name: data.full_name }
            }));
          }
          if (data.avatar_url) {
            setAvatarUrl(data.avatar_url);
            try {
              localStorage.setItem(`cached_avatar_url_${user.id}`, data.avatar_url);
            } catch (e) {}
            window.dispatchEvent(new CustomEvent('user-profile-updated', {
              detail: { avatar_url: data.avatar_url }
            }));
          }
          if (data.city) setCity(data.city);
          if (data.date_of_birth) setDateOfBirth(formatDateOfBirth(data.date_of_birth));
          if (data.phone) {
            const p = data.phone.trim();
            if (p.startsWith('+')) {
              const match = p.match(/^\+(\d{1,4})\s*(.*)$/);
              if (match) {
                setCountryCode(match[1] || '1');
                setPhoneBody(formatUSPhone(match[2] || ''));
              }
            } else {
              setPhoneBody(formatUSPhone(p));
            }
          }
        }
      } catch (err) {
        // Silently ignore if profiles query fails
      }
    };

    if (user?.id) {
      loadProfileData();
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    if (phoneBody.endsWith(') ') && inputVal === phoneBody.slice(0, -2)) {
      setPhoneBody(formatUSPhone(phoneBody.slice(0, -3)));
      return;
    }
    if (phoneBody.endsWith('-') && inputVal === phoneBody.slice(0, -1)) {
      setPhoneBody(formatUSPhone(phoneBody.slice(0, -2)));
      return;
    }
    setPhoneBody(formatUSPhone(inputVal));
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    if (dateOfBirth.endsWith('/') && inputVal === dateOfBirth.slice(0, -1)) {
      setDateOfBirth(formatDateOfBirth(dateOfBirth.slice(0, -2)));
      setDobError(null);
      return;
    }
    const formatted = formatDateOfBirth(inputVal);
    setDateOfBirth(formatted);
    if (formatted.length === 10) {
      setDobError(validateDateOfBirth(formatted));
    } else if (formatted.length === 0) {
      setDobError(null);
    }
  };

  const handleDobBlur = () => {
    if (dateOfBirth && dateOfBirth.length > 0) {
      setDobError(validateDateOfBirth(dateOfBirth));
    } else {
      setDobError(null);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // Small delay to show feedback
      await new Promise(resolve => setTimeout(resolve, 800));
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      toast.error(t('global.logout_error') || 'Erro ao sair da conta');
      setLoggingOut(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate Date of Birth if entered
    if (dateOfBirth && dateOfBirth.trim() !== '') {
      const errorMsg = validateDateOfBirth(dateOfBirth);
      if (errorMsg) {
        setDobError(errorMsg);
        toast.error(errorMsg);
        return;
      }
    }

    const cleanDigits = phoneBody.replace(/\D/g, '');
    const fullPhone = cleanDigits ? `+${countryCode || '1'} ${phoneBody}` : '';
    const trimmedName = fullName.trim();
    const targetUserId = user?.id;

    // 1. INSTANT OPTIMISTIC PROPAGATION (0ms - Immediate visual feedback in top banner & components)
    if (targetUserId) {
      try {
        localStorage.setItem(`cached_full_name_${targetUserId}`, trimmedName);
        if (avatarUrl) {
          localStorage.setItem(`cached_avatar_url_${targetUserId}`, avatarUrl);
        }
      } catch (err) {
        console.warn('LocalStorage error:', err);
      }
    }

    // Synchronously broadcast reactive event to Navbar chip and root App state
    window.dispatchEvent(new CustomEvent('user-profile-updated', {
      detail: { 
        full_name: trimmedName,
        avatar_url: avatarUrl,
        phone: fullPhone,
        country_code: countryCode || '1',
        date_of_birth: dateOfBirth,
        city: city
      }
    }));

    setLoading(true);

    try {
      const updateData = { 
        full_name: trimmedName,
        phone: fullPhone,
        country_code: countryCode || '1',
        avatar_url: avatarUrl,
        date_of_birth: dateOfBirth,
        city: city
      };

      // 2. Parallel cloud persistence (Auth metadata + Supabase profiles table)
      const authPromise = supabase.auth.updateUser({ data: updateData });
      const profilePromise = targetUserId 
        ? supabase.from('profiles').update({
            full_name: trimmedName,
            avatar_url: avatarUrl,
            phone: fullPhone,
            date_of_birth: dateOfBirth,
            city: city,
            updated_at: new Date().toISOString()
          }).eq('id', targetUserId)
        : Promise.resolve();

      const [authRes, profileRes] = await Promise.allSettled([authPromise, profilePromise]);

      if (authRes.status === 'rejected') {
        console.warn('Auth updateUser warning:', authRes.reason);
      }
      if (profileRes.status === 'rejected') {
        console.warn('Profiles update warning:', profileRes.reason);
      }

      toast.success(t('profile.update_success') || 'Perfil atualizado com sucesso!');
    } catch (error: any) {
      console.error('Profile update error:', error);
      if (error.message?.includes('Auth session missing')) {
        toast.error(t('global.session_lost') || 'Sessão perdida. Reiniciando...');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(error.message || t('profile.update_error') || 'Erro ao atualizar perfil');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // High compression for profile photo (target ~80KB)
      const options = {
        maxSizeMB: 0.08,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      setAvatarUrl(publicUrl);
      
      // INSTANT OPTIMISTIC PROPAGATION (0ms)
      if (user?.id) {
        try {
          localStorage.setItem(`cached_avatar_url_${user.id}`, publicUrl);
        } catch (e) {}
      }
      window.dispatchEvent(new CustomEvent('user-profile-updated', {
        detail: {
          avatar_url: publicUrl,
          full_name: fullName.trim()
        }
      }));

      // Background cloud updates in parallel
      await Promise.allSettled([
        supabase.auth.updateUser({ data: { avatar_url: publicUrl } }),
        user?.id ? supabase.from('profiles').update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', user.id) : Promise.resolve()
      ]);
      
      toast.success(t('profile.avatar_success') || 'Foto de perfil atualizada!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      if (error.message?.includes('Auth session missing')) {
        toast.error(t('global.session_lost') || 'Sessão perdida. Reiniciando...');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(t('profile.avatar_error') || 'Erro ao enviar foto de perfil');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t('profile.password_mismatch') || 'As senhas não coincidem');
      return;
    }
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      toast.success(t('profile.password_success') || 'Senha atualizada com sucesso!');
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || t('profile.password_error') || 'Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-10 pb-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t('profile.title') || 'Meu Perfil'}</h1>
        <p className="text-gray-400">{t('profile.subtitle') || 'Gerencie suas informações e segurança da conta.'}</p>
      </div>

      {/* Avatar Section */}
      <div className="flex flex-col items-center">
        <div 
          className="relative cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-40 h-40 rounded-full bg-zinc-800 border-4 border-white/25 overflow-hidden flex items-center justify-center shadow-2xl transition-transform group-hover:scale-[1.02]">
            {avatarUrl && avatarUrl.trim() ? (
              <img src={avatarUrl.trim()} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User size={64} className="text-gray-600" />
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <GlowingSpinner size="md" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera size={32} className="text-white" />
            </div>
          </div>
        </div>
        
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-1.5 bg-primary text-white rounded-full shadow-xl border-2 border-zinc-900 transition-all active:scale-95 mt-0 relative z-10"
        >
          <Camera size={14} />
          <span className="text-[10px] font-black uppercase">{t('profile.change_photo') || 'Trocar foto'}</span>
        </button>
      </div>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleAvatarUpload} 
          accept="image/*" 
          className="hidden" 
        />
        
        <div className="text-center mt-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">{fullName || 'Seu Nome'}</h2>
        </div>

      {/* Informações do Usuário */}
      <section className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 space-y-6">
        <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase">
          <User size={18} />
          {t('profile.info_title') || 'Informações do Usuário'}
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('auth.email') || 'E-mail'} ({t('profile.access') || 'Acesso'})</label>
            <div className="px-4 py-3 bg-white/5 rounded-xl border border-white/5 text-gray-400 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail size={18} className="opacity-50" />
                <span className="text-sm font-medium">{user.email}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 italic">{t('profile.email_restricted') || 'O e-mail não pode ser alterado.'}</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('profile.name_label') || 'Nome'}</label>
            <div className="flex items-center gap-3 px-4 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors">
              <User size={18} className="text-gray-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('profile.name_placeholder') || "Seu nome"}
                className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-base"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('profile.phone_label') || 'Phone'}</label>
            <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 w-full">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 px-3 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors w-full overflow-hidden">
                  <span className="text-gray-400 font-bold text-sm flex-shrink-0">+</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.replace(/\D/g, '').substring(0, 4))}
                    placeholder="1"
                    maxLength={4}
                    className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-base min-w-0"
                  />
                </div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter block px-1 truncate">
                  {t('profile.phone_country_code') || 'Country Code'}
                </span>
              </div>
              <div className="space-y-1 text-left min-w-0">
                <div className="flex items-center gap-3 px-3 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors w-full overflow-hidden">
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phoneBody}
                    onChange={handlePhoneChange}
                    placeholder="(555) 000-0000"
                    className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-base min-w-0 font-mono sm:font-sans"
                  />
                </div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter block px-1 truncate">
                  {t('profile.phone_number_label') || 'Phone with area code'}
                </span>
              </div>
            </div>
          </div>

          {/* Date of Birth Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                Date of Birth
              </label>
            </div>
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 bg-black/40 rounded-xl border transition-colors",
              dobError ? "border-red-500/80 focus-within:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus-within:border-primary/50"
            )}>
              <Calendar size={18} className={dobError ? "text-red-400" : "text-gray-400"} />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="bday"
                value={dateOfBirth}
                onChange={handleDobChange}
                onBlur={handleDobBlur}
                placeholder="MM/DD/YYYY"
                maxLength={10}
                className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-base font-mono sm:font-sans"
              />
            </div>
            {dobError && (
              <p className="text-[11px] text-red-400 font-medium px-1 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <span>⚠️</span> {dobError}
              </p>
            )}
          </div>

          {/* City Field */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
              City
            </label>
            <div className="flex items-center gap-3 px-4 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors">
              <MapPin size={18} className="text-gray-400" />
              <input
                type="text"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Dallas, Orlando, Atlanta"
                className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-base"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-xs"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {t('profile.save_changes') || 'SALVAR ALTERAÇÕES'}
          </button>
        </form>
      </section>

      {/* Notificações Section */}
      <section className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 space-y-6">
        <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase">
          <Bell size={18} />
          {t('profile.push_title') || 'Notificações Push'}
        </div>
        <p className="text-xs text-gray-500 font-medium">
          {t('profile.push_description') || 'Receba avisos importantes, novas aulas e atualizações da comunidade diretamente via notificações push.'}
        </p>

        {!pushStatus.supported ? (
          <div className="bg-blue-600/10 border border-blue-600/20 rounded-2xl p-6 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-500 overflow-hidden border border-blue-500/20 shrink-0">
              {profileAppIcon ? (
                <img
                  src={profileAppIcon}
                  alt="App Icon"
                  onError={() => setProfileAppIconError(true)}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <Smartphone size={24} />
              )}
            </div>
            <div className="space-y-1">
              <h5 className="font-bold text-white text-sm">
                {t('profile.install_pwa_title') || 'Notificações não suportadas'}
              </h5>
              <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                {t('profile.install_pwa_description') || 'Para receber notificações no seu dispositivo, você precisa instalar o aplicativo.'}
              </p>
            </div>
            {canInstall && onInstall && (
              <button
                onClick={onInstall}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] uppercase tracking-widest text-xs shadow-lg shadow-blue-600/20"
              >
                <Download size={18} />
                {t('profile.install_pwa_button') || 'INSTALAR APP'}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="bg-black/40 rounded-xl p-3 border border-white/5 w-full max-w-[200px] text-center">
                <div className="text-[10px] text-gray-500 uppercase font-black mb-1">{t('profile.status_permission') || 'Permissão'}</div>
                <div className={`text-xs font-bold ${pushStatus.permission === 'granted' ? 'text-green-500' : pushStatus.permission === 'denied' ? 'text-red-500' : 'text-yellow-500'}`}>
                  {pushStatus.permission === 'granted' ? (t('profile.permission_granted') || 'CONCEDIDA') : 
                   pushStatus.permission === 'denied' ? (t('profile.permission_denied') || 'NEGADA') : 
                   (t('profile.permission_default') || 'PENDENTE')}
                </div>
              </div>
            </div>
            
            <button
              onClick={async () => {
                const granted = await requestNotificationPermission(user.id);
                setPushStatus(prev => ({ 
                  ...prev, 
                  permission: Notification.permission,
                  tokenGenerated: granted 
                }));
                
                if (granted) {
                  toast.success(t('push.success') || 'Notificações ativadas com sucesso!');
                } else if (Notification.permission === 'denied') {
                  toast.error(t('push.blocked') || 'Notificações bloqueadas no navegador. Redefina as permissões nas configurações do site.');
                } else {
                  toast.error(t('push.error') || 'Não foi possível ativar. Verifique se você está em uma aba segura (HTTPS).');
                }
              }}
              className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-[0.98] uppercase tracking-widest text-xs"
            >
              <Bell size={18} />
              {pushStatus.permission === 'granted' ? (t('profile.push_resync') || 'RE-SINCRONIZAR NOTIFICAÇÕES') : (t('push.allow') || 'ATIVAR NOTIFICAÇÕES')}
            </button>
          </>
        )}
      </section>

      {/* Segurança - Only show if auth method is password */}
      {settings.auth_method === 'password' && (
        <section className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 space-y-6">
          <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase">
            <Lock size={18} />
            {t('profile.security_title') || 'Segurança'}
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('profile.new_password_label') || 'Nova Senha'}</label>
              <div className="flex items-center gap-3 px-4 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors">
                <Lock size={18} className="text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('profile.confirm_password_label') || 'Confirmar Nova Senha'}</label>
              <div className="flex items-center gap-3 px-4 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors">
                <Lock size={18} className="text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-base"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-xs border border-white/10"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={20} />}
              {t('profile.update_password') || 'ATUALIZAR SENHA'}
            </button>
          </form>
        </section>
      )}

      {/* Sair da Conta */}
      <section className="pt-6 border-t border-white/5">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-all font-black uppercase tracking-widest text-xs active:scale-95 disabled:opacity-50"
        >
          {loggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
          {loggingOut ? (t('global.logging_out') || 'Saindo...') : (settings?.custom_texts?.['global.logout'] || t('global.logout') || "Sair da Conta")}
        </button>
      </section>

    </div>
  );
}


