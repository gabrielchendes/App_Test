import { useEffect } from 'react';
import AuthForm from '../components/AuthForm';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import FloatingWhatsApp from '../components/FloatingWhatsApp';
import { preloadCoursesCatalog } from '../lib/coursePreload';

export default function LoginPage() {
  const { settings } = useSettings();
  const { t } = useI18n();

  useEffect(() => {
    // Warm up course catalog in the background so dashboard loads instantaneously upon sign-in
    preloadCoursesCatalog().catch(() => {});
  }, []);

  const disclaimerText = 
    settings.custom_texts?.['auth.disclaimer'] || 
    `By signing in, you agree to our Terms of Use and Privacy Policy. ${settings.login_platform_name || settings.custom_texts?.['auth.platform_name'] || settings.app_name || ''} © ${new Date().getFullYear()}`;

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none"
      style={{ backgroundColor: settings.background_color || '#0f0f0f' }}
    >
      {/* Soft ambient primary blur glow matching original design */}
      <div 
        className="absolute inset-0 blur-3xl rounded-full opacity-20 pointer-events-none" 
        style={{ backgroundColor: settings.primary_color || '#f43f5e' }} 
      />

      <div className="z-10 w-full flex flex-col items-center max-w-lg">
        <AuthForm />
        
        <div className="mt-8 flex flex-col items-center gap-6">
          <p className="text-gray-500 text-xs max-w-sm text-center leading-relaxed transition-colors">
            {disclaimerText}
          </p>
        </div>
      </div>

      <FloatingWhatsApp page="login" />
    </div>
  );
}
