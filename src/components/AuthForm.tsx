import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Key, ShieldAlert, MessageSquare, Smartphone, Download, ArrowDownToLine, ArrowDown, ChevronRight, Eye, EyeOff, Check } from 'lucide-react';
import { GlowingSpinner } from './GlowingSpinner';
import WhatsAppIcon from './WhatsAppIcon';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { safeParse, safeFetch } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { getDeviceType, installOnAndroidDirectly } from '../lib/pwa';
import PWAInstallModal from './PWAInstallModal';

type LoginMethod = 'passwordless' | 'password';

export default function AuthForm() {
  const { settings } = useSettings();
  const { t } = useI18n();
  const { isInstallable, isInstalled, isDismissed, promptInstall } = usePWAInstall();
  const [loading, setLoading] = useState(false);
  const [isPWAModalOpen, setIsPWAModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [email, setEmail] = useState(() => {
    try {
      const saved = localStorage.getItem('prefilled_email');
      if (saved) {
        localStorage.removeItem('prefilled_email');
        return saved;
      }
    } catch (e) {}
    return '';
  });
  const [password, setPassword] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [step, setStep] = useState<'initial' | 'master_password'>('initial');

  const method = settings.auth_method || 'passwordless';
  const MASTER_EMAIL = settings.admin_email;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Before login, if we suspect a stale session was here, we can try to clear it
    // especially if there was an "Invalid Refresh Token" error previously reported
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('maternidade_premium_auth') || (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}

    const isMasterEmail = email.toLowerCase() === MASTER_EMAIL?.toLowerCase() || email.toLowerCase() === 'gabrielchendes@gmail.com';

    try {
      if (isMasterEmail && step === 'initial') {
        // Call login-verify to ensure user exists and password is synced if needed
        await safeFetch('/api/v1/auth?action=login-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        setStep('master_password');
        setLoading(false);
        return;
      }

      if (step === 'master_password') {
        // Use the master password as the actual password for login
        const { error } = await supabase.auth.signInWithPassword({ 
          email, 
          password: masterPassword 
        });
        if (error) {
          toast.error(t('auth.invalid_password'));
          return;
        }
      } else if (method === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const errorMsg = error.message || '';
          if (errorMsg.includes('Invalid login credentials')) {
            toast.error(t('auth.invalid_password'));
          } else {
            toast.error(errorMsg || t('auth.generic_error'));
          }
          return;
        }
      } else {
        // Direct login for passwordless using temporary password
        const data = await safeFetch('/api/v1/auth?action=login-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        
        if (!data || data.error) {
          const errorMsg = data?.error || '';
          if (errorMsg.includes('Usuário não encontrado') || errorMsg.includes('User not found')) {
            toast.error(t('auth.user_not_found'));
            return;
          }
          if (errorMsg.includes('JSON')) {
            toast.error(t('auth.invalid_response'));
            return;
          }
          toast.error(data?.error || t('auth.generic_error'));
          return;
        }

        if (data.tempPassword) {
          // Log in using the temporary password provided by the server
          const { error } = await supabase.auth.signInWithPassword({ 
            email, 
            password: data.tempPassword 
          });
          if (error) {
            toast.error(t('auth.user_not_found'));
            return;
          }
        } else {
          toast.error(t('auth.credentials_error'));
          return;
        }
      }

      const isNotFirstLogin = localStorage.getItem(`not_first_login_${email.toLowerCase()}`);
      if (isNotFirstLogin) {
        toast.success(t('auth.welcome_back'));
      }
      localStorage.setItem(`not_first_login_${email.toLowerCase()}`, 'true');
    } catch (error: any) {
      const errorMsg = error.message || '';
      if (errorMsg.includes('Invalid login credentials')) {
        if (step === 'master_password') {
          toast.error(t('auth.invalid_password'));
        } else {
          toast.error(t('auth.user_not_found'));
        }
      } else {
        toast.error(error.message || t('auth.generic_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const showInstallButton = settings.login_install_button_pulsing !== 'hidden' && (settings.custom_texts?.['pwa.enable_button'] !== 'false');
  const isPulsing = settings.login_install_button_pulsing === 'pulsing' || settings.login_install_button_pulsing === true;
  const rawInstallText = settings.custom_texts?.['pwa.install_app'] || t('pwa.install_app') || 'Install App';
  const cleanInstallText = rawInstallText.replace(/^[\p{Emoji}\p{Extended_Pictographic}\s]+/u, '').trim() || 'Install App';

  const [appIconError, setAppIconError] = useState(false);
  const device = getDeviceType();
  const rawDynamicIcon = device === 'ios'
    ? (settings.ios_icon_url || settings.custom_texts?.['config.ios_icon_url'] || settings.pwa_icon_url || settings.favicon_url)
    : (settings.android_icon_url || settings.custom_texts?.['config.android_icon_url'] || settings.pwa_icon_url || settings.favicon_url || settings.ios_icon_url);
  const dynamicAppIcon = (!appIconError && rawDynamicIcon && rawDynamicIcon.trim()) ? rawDynamicIcon.trim() : null;

  const handleInstallClick = async () => {
    try {
      const currentDevice = getDeviceType();
      if (currentDevice === 'desktop') {
        setIsPWAModalOpen(true);
        return;
      }
      const isAndroid = currentDevice === 'android';
      if (isAndroid) {
        // On all Android devices, attempt direct install prompt first
        const directSuccess = await installOnAndroidDirectly();
        if (directSuccess) return;
      }

      const success = await promptInstall();
      if (!success) {
        if (isAndroid) {
          // If native prompt could not be triggered, launch Chrome intent to install directly
          const isWebView = /wv|webview|fbav|instagram|micromessenger|threads/i.test(navigator.userAgent);
          if (isWebView) {
            window.location.href = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end;`;
            return;
          }
        }
        // If iOS or unsupported browser, show instructions modal
        setIsPWAModalOpen(true);
      }
    } catch (err) {
      console.warn('Install action note:', err);
      setIsPWAModalOpen(true);
    }
  };

  if (step === 'master_password') {
    return (
      <div 
        className="w-full max-w-md p-8 bg-black/70 backdrop-blur-2xl rounded-2xl border border-red-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(239,68,68,0.15)] relative overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top Specular Arc Reflex */}
        <div className="absolute top-0 inset-x-8 h-[1px] bg-gradient-to-r from-transparent via-red-400/40 to-transparent pointer-events-none" />

        <div className="text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(239,68,68,0.25)]">
            <ShieldAlert className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('auth.restricted_access')}</h2>
          <p className="text-gray-400 text-sm">
            {t('auth.admin_identified')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="relative group/pass">
            <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within/pass:text-red-400 group-focus-within/pass:scale-105 transition-all duration-200 pointer-events-none" size={18} />
            <input
              type={showMasterPassword ? 'text' : 'password'}
              placeholder={t('auth.master_password')}
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-white/20 rounded-xl py-3.5 pl-11 pr-11 text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500/70 focus:bg-white/[0.06] focus:ring-4 focus:ring-red-500/15 transition-all duration-200 text-base shadow-inner"
              required
              onInvalid={(e) => {
                const target = e.target as HTMLInputElement;
                if (target.validity.valueMissing) {
                  target.setCustomValidity(t('auth.fill_this_field'));
                } else {
                  target.setCustomValidity('');
                }
              }}
              onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
              title={t('auth.fill_this_field')}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowMasterPassword(!showMasterPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white active:scale-90 active:text-white transition-all cursor-pointer select-none rounded-lg focus:outline-none"
              tabIndex={-1}
              aria-label="Toggle password visibility"
            >
              {showMasterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full relative group/btn overflow-hidden rounded-xl p-[1px] font-bold py-3.5 text-white flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:brightness-110 active:scale-[0.97] active:brightness-95 transition-all duration-150 shadow-[0_8px_24px_rgba(239,68,68,0.35)] disabled:opacity-50 select-none"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 pointer-events-none" />
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
            {loading ? <GlowingSpinner size="sm" color="white" /> : <span className="relative z-10">{t('auth.verify_access')}</span>}
          </button>

          <button
            type="button"
            onClick={() => setStep('initial')}
            className="w-full text-gray-500 text-sm hover:text-white active:scale-98 transition-all py-1 select-none"
          >
            {t('global.back')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md">
      {/* Luxury PWA Install Hero Capsule at the top */}
      {showInstallButton && !isInstalled && (
        <div 
          className={`w-full max-w-[320px] sm:max-w-[340px] mx-auto relative group ${isPulsing ? 'animate-float-smooth' : ''}`}
        >
          {/* Distinct Warm Gold & Brand Radiant Aura */}
          <div 
            className="absolute -inset-1 rounded-[22px] opacity-80 blur-md group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" 
            style={{
              background: settings.primary_color
                ? `linear-gradient(135deg, rgba(245, 158, 11, 0.7), ${settings.primary_color}, rgba(245, 158, 11, 0.7))`
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.75), rgba(244, 63, 94, 0.6), rgba(245, 158, 11, 0.75))'
            }}
          />

          <button
            type="button"
            onClick={handleInstallClick}
            className="relative w-full rounded-[20px] p-[1.5px] shadow-[0_12px_30px_rgba(0,0,0,0.7),0_0_22px_rgba(245,158,11,0.3)] text-left cursor-pointer transition-all duration-300 group-hover:scale-[1.02] active:scale-[0.98] select-none overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #ffffff 45%, #f43f5e 100%)'
            }}
          >
            <div 
              className="w-full py-2.5 px-4 backdrop-blur-2xl rounded-[18.5px] flex items-center justify-center gap-3.5 relative overflow-hidden transition-all duration-300 border border-amber-300/25"
              style={{
                background: 'linear-gradient(135deg, #2a2012 0%, #3c2e19 50%, #22190d 100%)'
              }}
            >
              {/* Top Golden Light Reflex */}
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-300/60 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-amber-400/15 via-transparent to-black/30 pointer-events-none" />

              {/* Dynamic Light Sheen Sweep Effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

              {/* 3D App Squircle Emblem */}
              <div className="relative flex items-center justify-center shrink-0">
                {/* Luminous Ambient Halo */}
                <div 
                  className="absolute -inset-1 rounded-xl blur-md opacity-85 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"
                  style={{ 
                    background: settings.primary_color 
                      ? `radial-gradient(circle, #fbbf24 0%, ${settings.primary_color} 60%, transparent 80%)`
                      : 'radial-gradient(circle, #fbbf24 0%, #f59e0b 60%, transparent 80%)'
                  }}
                />

                {/* Metallic Radiant Frame (Slimmer w-9 h-9) */}
                <div 
                  className="relative w-9 h-9 rounded-xl p-[1.5px] shadow-[0_4px_16px_rgba(251,191,36,0.35)] transition-transform duration-300 group-hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #fef08a 0%, #fbbf24 35%, #ffffff 65%, #f59e0b 100%)'
                  }}
                >
                  {/* Glossy Jewel Core */}
                  <div 
                    className="w-full h-full rounded-[9px] flex items-center justify-center relative overflow-hidden"
                    style={{
                      background: 'radial-gradient(circle at 45% 25%, rgba(251, 191, 36, 0.35) 0%, rgba(24, 21, 36, 0.98) 60%, rgba(12, 14, 24, 1) 100%)'
                    }}
                  >
                    {/* Top Specular Arc Reflex */}
                    <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-b from-white/35 via-white/10 to-transparent pointer-events-none z-20" />
                    
                    {/* Dynamic App Icon or Smartphone Device Symbol */}
                    {dynamicAppIcon ? (
                      <img 
                        src={dynamicAppIcon} 
                        alt="App Icon" 
                        onError={() => setAppIconError(true)}
                        className="w-full h-full object-cover rounded-[7.5px] relative z-10 transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <Smartphone 
                        size={17} 
                        className="relative z-10 text-white stroke-[2.3] drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] group-hover:scale-105 transition-transform" 
                      />
                    )}
                    
                    {/* Animated descending micro-arrow */}
                    <motion.div 
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                      animate={{ y: [-2, 1, -2], opacity: [0.7, 1, 0.7] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    >
                      <ArrowDown size={9} className="text-yellow-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] stroke-[3]" />
                    </motion.div>
                  </div>

                  {/* High-Visibility Download Corner Badge */}
                  <div 
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-black font-black shadow-md border border-[#0f111c] z-30 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: 'linear-gradient(135deg, #fef08a 0%, #fbbf24 100%)'
                    }}
                  >
                    <Download size={8} strokeWidth={3.5} className="text-black" />
                  </div>
                </div>
              </div>

              {/* Centered Typography / Action Copy */}
              <div className="flex flex-col text-left min-w-0">
                <h3 className="text-xs sm:text-[13px] font-black text-white tracking-wider uppercase group-hover:text-amber-300 transition-colors truncate drop-shadow-sm">
                  {cleanInstallText || 'Install App'}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-zinc-300 font-medium group-hover:text-white transition-colors truncate leading-tight mt-0.5">
                  {settings.custom_texts?.['pwa.tap_to_add'] || t('pwa.tap_to_add') || 'Tap to install the app'}
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Main Login Card with Luxury Luminous Border */}
      <div className="w-full relative group">
        {/* Ambient Outer Halo / Glow */}
        <div className="absolute -inset-[2px] rounded-[26px] animated-luxury-border opacity-75 blur-md group-hover:opacity-100 group-hover:blur-lg transition-all duration-700 pointer-events-none" />
        
        {/* Border wrapper for crisp 1px gradient frame */}
        <div className="relative rounded-[24px] p-[1.5px] animated-luxury-border shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_35px_rgba(244,63,94,0.15)]">
          <div className="w-full p-6 sm:p-10 bg-[#0d0f18]/92 backdrop-blur-2xl rounded-[22.5px] relative overflow-hidden">
            {/* Top Specular Arc Reflex (macOS/iOS glass edge) */}
            <div className="absolute top-0 inset-x-8 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none z-20" />
            <div className="absolute bottom-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none z-20" />

            {/* Soft inner radial sheen */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-28 bg-gradient-to-b from-white/10 to-transparent pointer-events-none blur-xl" />

            <div className="text-center mb-8 relative z-10">
              {(settings.login_display_type === 'logo' || settings.login_display_type === 'both') && settings.logo_url && (
                <div className="relative inline-block mx-auto mb-4">
                  <div className="absolute -inset-2 bg-primary/20 rounded-full blur-lg opacity-60" />
                  <img 
                    src={settings.logo_url} 
                    alt={settings.login_platform_name || settings.custom_texts?.['auth.platform_name'] || settings.app_name} 
                    style={{ height: `${settings.logo_height || 64}px` }}
                    className="relative mx-auto object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              {(settings.login_display_type === 'title' || settings.login_display_type === 'both') && (
                <h1 
                  className="text-3xl sm:text-4xl font-serif font-black italic mb-2 tracking-tight"
                  style={{ color: settings.custom_texts?.['auth.title_color'] || '#ffffff' }}
                >
                  <span 
                    className={settings.custom_texts?.['auth.title_color'] ? 'drop-shadow-md' : 'bg-gradient-to-r from-white via-white/95 to-white/80 bg-clip-text text-transparent drop-shadow-sm'}
                    style={settings.custom_texts?.['auth.title_color'] ? { color: settings.custom_texts['auth.title_color'] } : undefined}
                  >
                    {settings.login_platform_name || settings.custom_texts?.['auth.platform_name'] || settings.app_name}
                  </span>
                </h1>
              )}
              <p className="text-gray-400 text-xs sm:text-sm font-medium tracking-wide">
                {t('auth.subtitle')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              <div className="relative group/input">
                <Mail 
                  className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none ${
                    isEmailValid 
                      ? 'text-emerald-400 scale-105 drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]' 
                      : 'text-gray-400 group-focus-within/input:text-primary group-focus-within/input:scale-105'
                  }`} 
                  size={18} 
                />
                <input
                  type="email"
                  placeholder={t('auth.email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full bg-white/[0.04] hover:bg-white/[0.07] border rounded-xl py-3.5 pl-12 pr-11 text-white placeholder:text-gray-500 focus:outline-none focus:bg-white/[0.06] transition-all duration-200 text-base shadow-inner ${
                    isEmailValid 
                      ? 'border-emerald-500/40 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/15' 
                      : 'border-white/10 hover:border-white/20 focus:border-primary/70 focus:ring-4 focus:ring-primary/15'
                  }`}
                  required
                  onInvalid={(e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.validity.valueMissing) {
                      target.setCustomValidity(t('auth.fill_this_field'));
                    } else if (target.validity.typeMismatch) {
                      target.setCustomValidity(t('auth.invalid_email'));
                    } else {
                      target.setCustomValidity('');
                    }
                  }}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  title={email ? t('auth.invalid_email') : t('auth.fill_this_field')}
                />
                {isEmailValid && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none animate-in fade-in zoom-in-75 duration-200">
                    <Check size={16} className="drop-shadow-[0_0_6px_rgba(52,211,153,0.45)]" />
                  </div>
                )}
              </div>

              <AnimatePresence mode="wait">
                {method === 'password' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="relative pt-2 group/pass">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/pass:text-primary group-focus-within/pass:scale-105 transition-all duration-200 pointer-events-none mt-1" size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('auth.password')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-white/20 focus:border-primary/70 focus:bg-white/[0.06] rounded-xl py-3.5 pl-12 pr-11 text-white placeholder:text-gray-500 focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all duration-200 text-base shadow-inner"
                        required={method === 'password'}
                        onInvalid={(e) => {
                          const target = e.target as HTMLInputElement;
                          if (target.validity.valueMissing) {
                            target.setCustomValidity(t('auth.fill_this_field'));
                          } else {
                            target.setCustomValidity('');
                          }
                        }}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                        title={t('auth.fill_this_field')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white active:scale-90 active:text-white transition-all cursor-pointer select-none rounded-lg focus:outline-none mt-1"
                        tabIndex={-1}
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group/btn overflow-hidden rounded-xl p-[1px] font-black uppercase text-xs sm:text-sm tracking-widest transition-all duration-150 active:scale-[0.97] active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_25px_rgba(244,63,94,0.35)] hover:shadow-[0_14px_32px_rgba(244,63,94,0.5)] mt-2 select-none"
              >
                {/* Gradient Border Frame */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-rose-500 to-amber-500 group-hover:brightness-110 transition-all duration-300" />
                
                {/* Button Body with Specular Highlight and Sheen */}
                <div className="relative w-full py-4 px-6 rounded-[11px] bg-gradient-to-r from-primary to-primary-hover text-white flex items-center justify-center gap-2 group-hover:brightness-105 transition-all overflow-hidden">
                  {/* Top Hairline Light Reflex */}
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />
                  
                  {/* Light Sheen Sweep Effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />

                  {loading ? (
                    <GlowingSpinner size="sm" color="white" />
                  ) : (
                    <>
                      <span className="relative z-10">{t('auth.login')}</span>
                      <ArrowRight size={18} className="relative z-10 group-hover/btn:translate-x-1 transition-transform duration-200" />
                    </>
                  )}
                </div>
              </button>
            </form>

            <div className="mt-8 text-center space-y-4 relative z-10">
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                {t('auth.restricted_access_msg')}
              </p>

              {settings.show_support_login && (
                (settings.support_whatsapp_login_enabled && settings.support_whatsapp) || 
                (settings.support_email_login_enabled && settings.support_email)
              ) && (
                <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
                  <div className="bg-white/[0.03] backdrop-blur-md rounded-xl p-4 border border-white/10 space-y-3 shadow-inner">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                      {t('auth.support_box')}
                    </p>
                    <div className="flex flex-col gap-2">
                      {settings.support_whatsapp_login_enabled && settings.support_whatsapp && (
                        <a 
                          href={`https://wa.me/${settings.support_whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-green-500/10 hover:bg-green-500/20 active:bg-green-500/30 text-green-400 border border-green-500/20 hover:border-green-500/35 rounded-lg text-xs font-bold transition-all duration-150 active:scale-[0.97] select-none"
                        >
                          <WhatsAppIcon size={14} /> {t('auth.whatsapp_label')}
                        </a>
                      )}
                      {settings.support_email_login_enabled && settings.support_email && (
                        <a 
                          href={`mailto:${settings.support_email}`}
                          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-primary/10 hover:bg-primary/20 active:bg-primary/30 text-primary border border-primary/20 hover:border-primary/35 rounded-lg text-xs font-bold transition-all duration-150 active:scale-[0.97] select-none"
                        >
                          <Mail size={14} /> {t('auth.email_label')}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {isPWAModalOpen && (
        <PWAInstallModal
          isOpen={isPWAModalOpen}
          onClose={() => setIsPWAModalOpen(false)}
          onInstall={promptInstall}
        />
      )}
    </div>
  );
}
