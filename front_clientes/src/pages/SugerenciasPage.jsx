import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft, Lightbulb, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiPost } from '../services/apiCliente.js';
import BtnPrimary from '../components/ui/BtnPrimary.jsx';

const SUGERENCIAS_PREDEFINIDAS = [
  'Milanesa', 'Pollo grillado', 'Pasta', 'Ensaladas', 'Sushi', 'Burger',
  'Wok', 'Salmon', 'Pizza', 'Tacos', 'Curry', 'Risotto',
];

function rangoSemana(semanaId) {
  if (!semanaId) return 'esta semana';
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const [y, m, d] = String(semanaId).split('T')[0].split('-').map(Number);
  const lunes = new Date(y, m - 1, d);
  const viernes = new Date(y, m - 1, d + 4);
  const ml = meses[lunes.getMonth()];
  const mv = meses[viernes.getMonth()];
  const ini = ml === mv ? lunes.getDate() : `${lunes.getDate()} ${ml}`;
  return `${ini} – ${viernes.getDate()} ${mv}`;
}

export default function SugerenciasPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const semanaId = params.get('semana') || '';

  const [seleccionadas, setSeleccionadas] = useState([]);
  const [comentario, setComentario] = useState('');
  const [enviado, setEnviado] = useState(false);

  const toggle = (s) =>
    setSeleccionadas(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );

  const mutation = useMutation({
    mutationFn: () => apiPost('/pedidos/sugerencias', {
      semana_inicio: semanaId,
      ideas: seleccionadas,
      comentario,
    }, { requiereAuth: true }),
    onSuccess: () => setEnviado(true),
  });

  if (enviado) {
    return (
      <div className="flex flex-col h-full bg-[#FAF8F3]">
        <div className="px-4 pt-12">
          <button onClick={() => navigate(-1)} className="text-[#5B6B2A] mb-6">
            <ChevronLeft size={24} />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-5 px-8 text-center">
          <div className="w-16 h-16 bg-[#EDF0E4] rounded-full flex items-center justify-center">
            <CheckCircle2 size={32} className="text-[#5B6B2A]" />
          </div>
          <div>
            <p className="text-xl font-bold text-[#2A2C1F] font-serif mb-2">¡Gracias!</p>
            <p className="text-sm text-[#7A7868]">Tu sugerencia fue enviada. La tendremos en cuenta para preparar el menú.</p>
          </div>
          <BtnPrimary onClick={() => navigate(-1)} variant="secondary" className="mt-4">
            Volver
          </BtnPrimary>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FAF8F3]">
      {/* Header */}
      <div className="bg-white border-b border-[#F0EDE6] px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-[#5B6B2A]">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#2A2C1F] font-serif">Sugerir platos</h1>
            <p className="text-xs text-[#9A9885]">{rangoSemana(semanaId)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {/* Chips de sugerencias */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={16} className="text-[#C8782A]" />
            <p className="text-sm font-bold text-[#2A2C1F]">¿Qué te gustaría comer?</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGERENCIAS_PREDEFINIDAS.map(s => (
              <button
                key={s}
                onClick={() => toggle(s)}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  seleccionadas.includes(s)
                    ? 'bg-[#5B6B2A] text-white border-[#5B6B2A]'
                    : 'bg-white text-[#5B6B2A] border-[#D8D5C8]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Comentario adicional */}
        <div>
          <p className="text-sm font-bold text-[#2A2C1F] mb-2">Comentario adicional</p>
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            placeholder="Ej: algo más liviano, sin carne roja, con opciones veganas…"
            rows={4}
            className="w-full rounded-xl border border-[#D8D5C8] bg-white px-4 py-3 text-sm text-[#2A2C1F] focus:outline-none focus:border-[#5B6B2A] focus:ring-2 focus:ring-[#5B6B2A]/12 resize-none"
          />
        </div>

        {mutation.isError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{mutation.error?.message || 'Error al enviar.'}</p>
          </div>
        )}

        <BtnPrimary
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={seleccionadas.length === 0 && !comentario.trim()}
          className="w-full"
        >
          Enviar sugerencia
        </BtnPrimary>
      </div>
    </div>
  );
}
