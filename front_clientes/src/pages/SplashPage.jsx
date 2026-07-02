import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/ui/Logo.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { rutasCliente } from '../routes/rutasCliente.js';

export default function SplashPage() {
  const { empleado, checking } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (checking) return;
    const timer = setTimeout(() => {
      if (empleado) {
        navigate(rutasCliente.pedidoSemanal, { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }, 1600);
    return () => clearTimeout(timer);
  }, [checking, empleado, navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#5B6B2A] relative overflow-hidden">
      <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 390 844" fill="white">
        <circle cx="320" cy="120" r="180" />
        <circle cx="60"  cy="700" r="220" />
      </svg>

      <div className="flex flex-col items-center gap-4 relative z-10">
        <div className="w-20 h-20 bg-white/15 rounded-3xl flex items-center justify-center">
          <Logo size={44} className="text-white" />
        </div>
        <span className="text-[30px] font-bold text-white tracking-tight font-serif">La Quinta</span>
        <p className="text-white/55 text-[14px]">Viandas para el trabajo</p>
      </div>

      <div className="absolute bottom-20">
        <div className="w-5 h-5 border-2 border-white/25 border-t-white/80 rounded-full animate-spin" />
      </div>
    </div>
  );
}
