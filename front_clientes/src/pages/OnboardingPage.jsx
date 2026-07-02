import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, CalendarDays, CheckCircle2, ArrowRight } from 'lucide-react';
import BtnPrimary from '../components/ui/BtnPrimary.jsx';
import { rutasAutenticacion } from '../routes/rutasCliente.js';

const PASOS = [
  {
    bg: '#EDF0E4',
    icon: <UtensilsCrossed size={38} className="text-[#5B6B2A]" />,
    titulo: 'Pedí tu almuerzo de la semana',
    cuerpo: 'Cada semana elegís un plato para cada día hábil. Sin colas, sin preocupaciones.',
  },
  {
    bg: '#FEF3E8',
    icon: <CalendarDays size={38} className="text-[#C8782A]" />,
    titulo: 'El menú se publica cada viernes',
    cuerpo: 'Revisá el menú y confirmá tu pedido antes del domingo a las 20:00 hs.',
  },
  {
    bg: '#E8F5EE',
    icon: <CheckCircle2 size={38} className="text-emerald-600" />,
    titulo: 'Tu vianda te espera en el trabajo',
    cuerpo: 'Almuerzo fresco y preparado, listo a tiempo. Todos los días.',
  },
];

export default function OnboardingPage() {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const paso = PASOS[idx];
  const esUltimo = idx === PASOS.length - 1;

  const irAlLogin = () => navigate(rutasAutenticacion.iniciarSesion);

  return (
    <div className="flex flex-col h-screen bg-[#FAF8F3]">
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-4">
        <div className="flex flex-col items-center text-center gap-6">
          <div
            className="w-28 h-28 rounded-3xl flex items-center justify-center shadow-sm"
            style={{ background: paso.bg }}
          >
            {paso.icon}
          </div>
          <div className="space-y-3">
            <h1 className="text-[24px] font-bold text-[#2A2C1F] leading-tight font-serif">
              {paso.titulo}
            </h1>
            <p className="text-[15px] text-[#7A7868] leading-relaxed max-w-[280px]">
              {paso.cuerpo}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-12 space-y-5">
        <div className="flex justify-center gap-2">
          {PASOS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === idx ? 24 : 6, background: i === idx ? '#5B6B2A' : '#D8D5C8' }}
            />
          ))}
        </div>

        <BtnPrimary
          onClick={() => esUltimo ? irAlLogin() : setIdx(v => v + 1)}
          className="w-full"
        >
          {esUltimo ? 'Comenzar' : 'Siguiente'} <ArrowRight size={15} />
        </BtnPrimary>

        {!esUltimo && (
          <button
            onClick={irAlLogin}
            className="w-full text-center text-sm text-[#9A9885] font-semibold py-1"
          >
            Omitir
          </button>
        )}
      </div>
    </div>
  );
}
