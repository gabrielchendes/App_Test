import AuthForm from '../components/AuthForm';
import { useSettings } from '../contexts/SettingsContext';
import FloatingWhatsApp from '../components/FloatingWhatsApp';

export default function LoginPage() {
  const { settings } = useSettings();

  return (
    <div className="min-h-[100dvh] min-h-screen flex items-center justify-center p-4 sm:p-6 py-6 pb-10 sm:py-8 safe-area-pb relative overflow-hidden bg-[#07080c]">
      {/* Refined Background Atmospheric Glows */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Soft radial grid overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.025]" />
        
        {/* Luminous aura spots with cinematic velvet transitions and organic slow breathing */}
        <div className="absolute top-[-10%] left-[25%] w-[550px] h-[550px] bg-primary/12 rounded-full blur-[150px] animate-aurora-glow" />
        <div className="absolute bottom-[-10%] right-[20%] w-[550px] h-[550px] bg-amber-500/10 rounded-full blur-[160px] animate-amber-glow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-rose-950/15 rounded-full blur-[170px]" />
        
        {/* Vignette edge mask */}
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#07080c]/40 to-[#07080c]" />
      </div>

      <div className="z-10 w-full flex flex-col items-center max-w-lg">
        <AuthForm />
        
        <div className="mt-8 flex flex-col items-center gap-6">
          <p className="text-zinc-500/80 hover:text-zinc-400 text-xs max-w-sm text-center leading-relaxed transition-colors">
            {settings.custom_texts?.['auth.disclaimer'] || `Ao entrar, você concorda com nossos Termos de Uso e Política de Privacidade. ${settings.login_platform_name || settings.custom_texts?.['auth.platform_name'] || settings.app_name} © ${new Date().getFullYear()}`}
          </p>
        </div>
      </div>

      <FloatingWhatsApp page="login" />
    </div>
  );
}
