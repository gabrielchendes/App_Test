import React, { useState } from 'react';
import { Lock, Sparkles, RefreshCw, LogOut, ExternalLink, ShieldAlert, Mail, MessageSquare, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { toast } from 'sonner';

interface AccessDeniedModalProps {
  userEmail: string;
}

export default function AccessDeniedModal({ userEmail }: AccessDeniedModalProps) {
  const { settings } = useSettings();
  const [showSupportNotice, setShowSupportNotice] = useState(false);

  // Renewal link configured by admin (blank if not provided, no fallback to main product)
  const renewalUrl = (settings?.custom_texts?.['access_denied_checkout_url'] || '').trim();

  const badge = settings?.custom_texts?.['access_denied_badge'] || 'Access Temporarily Paused';
  const title = settings?.custom_texts?.['access_denied_title'] || 'Main Access Inactive';
  const message = settings?.custom_texts?.['access_denied_message'] || 'Your subscription or main membership has been canceled, refunded, or expired on Hotmart.';
  const benefitsTitle = settings?.custom_texts?.['access_denied_benefits_title'] || 'Your account and progress are safe!';
  const benefitsText = settings?.custom_texts?.['access_denied_benefits_text'] || 'Once you renew your subscription with your registered email, all your access, lesson progress, and certificates will be instantly reactivated.';
  const ctaText = settings?.custom_texts?.['access_denied_cta'] || 'Renew Subscription';
  const logoutText = settings?.custom_texts?.['access_denied_logout'] || 'Log Out';

  const supportEmail = settings?.support_email || 'atendimento@suporte.com';
  const supportWhatsapp = settings?.support_whatsapp;

  const handleRenewClick = (e: React.MouseEvent) => {
    if (!renewalUrl) {
      e.preventDefault();
      setShowSupportNotice(true);
      toast.info('Please contact our support team to renew your subscription.', {
        description: `Support contact: ${supportEmail}`,
        duration: 6000
      });
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut().catch(() => {});
      window.location.reload();
    } catch (e) {
      toast.error('Error signing out');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-lg bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border border-rose-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-rose-500/20 blur-[90px] rounded-full pointer-events-none" />

        <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/30 rounded-3xl flex items-center justify-center mx-auto text-rose-400 shadow-inner">
          <ShieldAlert size={40} />
        </div>

        <div className="space-y-2">
          <span className="px-3.5 py-1 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
            {badge}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{title}</h2>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-md mx-auto">
            {message}
          </p>
        </div>

        {/* Benefits preservation note */}
        <div className="bg-black/60 border border-white/10 rounded-2xl p-4 text-left space-y-2 text-xs text-gray-300">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <Sparkles size={16} />
            <span>{benefitsTitle}</span>
          </div>
          <p className="text-gray-400 text-[11px] leading-relaxed">
            {benefitsText.includes('{email}')
              ? benefitsText.replace('{email}', userEmail)
              : benefitsText}
          </p>
        </div>

        {/* English support notice when renewal link is blank */}
        {showSupportNotice && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left space-y-2.5 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wide">
              <AlertCircle size={15} />
              <span>Please Contact Support</span>
            </div>
            <p className="text-xs text-gray-200 leading-relaxed">
              Please contact our support team to renew your subscription and reactivate your access.
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-2.5">
              {supportEmail && (
                <a
                  href={`mailto:${supportEmail}?subject=${encodeURIComponent('Subscription Renewal - ' + userEmail)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-xl text-xs font-bold transition-all"
                >
                  <Mail size={13} />
                  <span>{supportEmail}</span>
                </a>
              )}
              {supportWhatsapp && (
                <a
                  href={`https://wa.me/${supportWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hello, I would like to renew my subscription for ' + userEmail)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 rounded-xl text-xs font-bold transition-all"
                >
                  <MessageSquare size={13} />
                  <span>WhatsApp Support</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3 pt-2">
          {renewalUrl ? (
            <a
              href={renewalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-rose-500/20 flex items-center justify-center gap-2 active:scale-98"
            >
              <span>{ctaText}</span>
              <ExternalLink size={16} />
            </a>
          ) : (
            <button
              type="button"
              onClick={handleRenewClick}
              className="w-full py-4 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-rose-500/20 flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
            >
              <span>{ctaText}</span>
              <ExternalLink size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut size={14} />
            <span>{logoutText} ({userEmail})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
