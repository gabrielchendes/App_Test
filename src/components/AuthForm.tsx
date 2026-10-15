import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Key, ShieldAlert, MessageSquare, Smartphone, Download, ArrowDownToLine, ArrowDown, ChevronRight, Eye, EyeOff, Check } from 'lucide-react';
import { GlowingSpinner } from './GlowingSpinner';
import WhatsAppIcon from './WhatsAppIcon';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/customToast';
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
        className="w-full max-w-md p-6 sm:p-8 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl relative"
      >
        <div className="text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('auth.restricted_access')}</h2>
          <p className="text-gray-400 text-sm">
            {t('auth.admin_identified')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="relative group/pass">
            <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within/pass:text-red-400 transition-colors pointer-events-none" size={18} />
            <input
              type={showMasterPassword ? 'text' : 'password'}
              placeholder={t('auth.master_password')}
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-red-500 rounded-xl py-3.5 pl-11 pr-11 text-white placeholder:text-gray-500 focus:outline-none transition-colors text-base"
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer p-1"
              tabIndex={-1}
              aria-label="Toggle password visibility"
            >
              {showMasterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <GlowingSpinner size="sm" color="white" /> : <span>{t('auth.verify_access')}</span>}
          </button>

          <button
            type="button"
            onClick={() => setStep('initial')}
            className="w-full text-gray-500 text-sm hover:text-white transition-colors py-1 cursor-pointer"
          >
            {t('global.back')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md">
      {/* PWA Install Button */}
      {showInstallButton && !isInstalled && (
        <div className={`w-full max-w-[280px] sm:max-w-[300px] mx-auto ${isPulsing ? 'animate-float-smooth' : ''}`}>
          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full py-2 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md flex items-center justify-center gap-3 transition-all active:scale-95 text-white shadow-lg cursor-pointer select-none"
          >
            <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden">
              {dynamicAppIcon ? (
                <img src={dynamicAppIcon} alt="App Icon" onError={() => setAppIconError(true)} className="w-full h-full object-cover" />
              ) : (
                <Smartphone size={14} className="text-primary" />
              )}
            </div>
            <div className="flex flex-col text-left min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white truncate">
                {cleanInstallText || 'Install App'}
              </span>
              <span className="text-[9px] text-zinc-300 truncate">
                {settings.custom_texts?.['pwa.tap_to_add'] || t('pwa.tap_to_add') || 'Tap to install the app'}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Main Login Card */}
      <div className="w-full bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl relative">
        <div className="text-center mb-6 relative z-10">
          {(settings.login_display_type === 'logo' || settings.login_display_type === 'both') && settings.logo_url && (
            <img 
              src={settings.logo_url} 
              alt={settings.login_platform_name || settings.custom_texts?.['auth.platform_name'] || settings.app_name} 
              style={{ height: `${settings.logo_height || 64}px` }}
              className="mx-auto mb-4 object-contain"
              referrerPolicy="no-referrer"
            />
          )}
          {(settings.login_display_type === 'title' || settings.login_display_type === 'both') && (
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              {settings.login_platform_name || settings.custom_texts?.['auth.platform_name'] || settings.app_name || 'Missing Trigger'}
            </h1>
          )}
          <p className="text-gray-400 text-xs sm:text-sm mt-1 uppercase tracking-wider">
            {t('auth.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="relative group/input">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-primary transition-colors pointer-events-none" size={18} />
            <input
              type="email"
              placeholder={t('auth.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-primary rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-base"
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
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/pass:text-primary transition-colors pointer-events-none mt-1" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-primary rounded-xl py-3.5 pl-11 pr-11 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-base"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer p-1 mt-1"
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
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer text-sm tracking-wider uppercase mt-2"
            style={{ backgroundColor: settings.primary_color }}
          >
            {loading ? (
              <GlowingSpinner size="sm" color="white" />
            ) : (
              <>
                <span>{t('auth.login')}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3 relative z-10">
          <p className="text-xs text-gray-500 font-medium leading-relaxed">
            {settings.custom_texts?.['auth.restricted_access_msg'] || 'Restricted access to registered users.'}
          </p>

          {settings.show_support_login && (
            (settings.support_whatsapp_login_enabled && settings.support_whatsapp) || 
            (settings.support_email_login_enabled && settings.support_email)
          ) && (
            <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                  {t('auth.support_box')}
                </p>
                <div className="flex flex-col gap-2">
                  {settings.support_whatsapp_login_enabled && settings.support_whatsapp && (
                    <a 
                      href={`https://wa.me/${settings.support_whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2 px-3 bg-green-500/10 hover:bg-green-500/20 active:bg-green-500/30 text-green-400 border border-green-500/20 rounded-lg text-xs font-bold transition-all active:scale-95"
                    >
                      <WhatsAppIcon size={14} /> {t('auth.whatsapp_label')}
                    </a>
                  )}
                  {settings.support_email_login_enabled && settings.support_email && (
                    <a 
                      href={`mailto:${settings.support_email}`}
                      className="flex items-center justify-center gap-2 py-2 px-3 bg-primary/10 hover:bg-primary/20 active:bg-primary/30 text-primary border border-primary/20 rounded-lg text-xs font-bold transition-all active:scale-95"
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
