import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, CalendarDays, CheckCircle2, ArrowRight } from 'lucide-react';
import BtnPrimary from '../components/ui/BtnPrimary.jsx';
import { rutasAutenticacion } from '../routes/rutasCliente.js';

const PASOS = [
  {
    bg: '#EDF0E4',
    icon: <UtensilsCrossed size={38} className="text-[#5B6B2A]" />,
    titulo: 'Elegí tus viandas de la semana',
    cuerpo: 'Cuando el menú está publicado, ves cada día y elegís plato especial o fijo, con guarnición si corresponde.',
  },
  {
    bg: '#FEF3E8',
    icon: <CalendarDays size={38} className="text-[#C8782A]" />,
    titulo: 'Confirmá antes del cierre',
    cuerpo: 'La app te muestra el día y horario límite de cada semana según tu empresa. Si el plazo cerró, igual podés consultar el menú.',
  },
  {
    bg: '#E8F5EE',
    icon: <CheckCircle2 size={38} className="text-emerald-600" />,
    titulo: 'Revisá tu pedido cuando quieras',
    cuerpo: 'Después de confirmar, podés verlo desde Inicio o Historial y modificarlo mientras queden días habilitados.',
  },
];

export default function OnboardingPage() {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const paso = PASOS[idx];
  const esUltimo = idx === PASOS.length - 1;

  const irAlLogin = () => navigate(rutasAutenticacion.iniciarSesion);

  return (
    <div className="flex h-screen flex-col bg-[#FAF8F3]">
      <div className="flex flex-1 flex-col items-center justify-center px-7 pb-4 pt-14">
        <div className="flex max-w-[320px] flex-col items-center gap-6 text-center">
          <div
            className="w-28 h-28 rounded-3xl flex items-center justify-center shadow-sm"
            style={{ background: paso.bg }}
          >
            {paso.icon}
          </div>
          <div className="space-y-3">
            <h1 className="font-serif text-[24px] font-bold leading-tight text-[#2A2C1F]">
              {paso.titulo}
            </h1>
            <p className="max-w-[310px] text-[15px] leading-relaxed text-[#7A7868]">
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
