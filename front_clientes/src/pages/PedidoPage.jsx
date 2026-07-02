import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Lightbulb, RefreshCw } from 'lucide-react';
import { usePedidoSemanal } from '../hooks/usePedidoSemanal.js';
import WeeklyOrderView from '../components/pedido/WeeklyOrderView.jsx';
import { rutasCliente } from '../routes/rutasCliente.js';

const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function rangoSemana(semanaId) {
  if (!semanaId) return '';
  const [y, m, d] = String(semanaId).split('T')[0].split('-').map(Number);
  const lunes = new Date(y, m - 1, d);
  const viernes = new Date(y, m - 1, d + 4);
  const ml = meses[lunes.getMonth()];
  const mv = meses[viernes.getMonth()];
  const ini = ml === mv ? lunes.getDate() : `${lunes.getDate()} ${ml}`;
  return `${ini} – ${viernes.getDate()} ${mv}`;
}

function estadoConfig(semana) {
  const estado = semana?.estado;
  const pedidoId = semana?.metadata?.pedidoId;
  const tieneMenu = semana?.metadata?.tieneMenuPublicado;
  if (pedidoId || estado === 'confirmado') return { label: 'Confirmado', color: '#1B7B5E', bg: '#E6F6F0' };
  if (estado === 'cerrado') return { label: 'Fuera de plazo', color: '#9A9885', bg: '#F0EDE6' };
  if (tieneMenu) return { label: 'Menú publicado', color: '#5B6B2A', bg: '#EDF0E4' };
  return { label: 'Sin menú', color: '#C8782A', bg: '#FEF3E8' };
}

function ctaLabel(semana) {
  if (semana?.metadata?.pedidoId) return 'Ver pedido';
  if (semana?.metadata?.tieneMenuPublicado) {
    return semana?.estado === 'cerrado' ? 'Ver menú' : 'Elegir platos';
  }
  if (semana?.metadata?.esSemanaSugerencias) return 'Sugerir platos';
  return null;
}

// ── Semana actual card ─────────────────────────────────────────────────────────
function SemanaActualCard({ semana, onVerDetalle }) {
  if (!semana) return null;
  const cfg = estadoConfig(semana);
  const cta = ctaLabel(semana);
  const pedidoId = semana?.metadata?.pedidoId;
  const diasSeleccionados = semana?.diasSeleccionados || 0;
  const cantidadDias = semana?.metadata?.cantidadDias || 5;

  return (
    <div
      className="relative overflow-hidden rounded-3xl mx-4 mt-4"
      style={{ background: 'linear-gradient(135deg, #5B6B2A 0%, #3A4A18 100%)' }}
    >
      {/* Decoración de fondo */}
      <svg className="absolute right-0 top-0 opacity-[0.08]" width="180" height="160" viewBox="0 0 180 160" fill="white">
        <circle cx="140" cy="20" r="100" />
        <circle cx="170" cy="130" r="60" />
      </svg>

      <div className="relative z-10 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Semana actual</span>
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>

        <p className="text-white text-[22px] font-bold font-serif leading-snug mb-1">
          {rangoSemana(semana.id)}
        </p>

        {pedidoId && (
          <div className="mt-2 mb-3">
            <div className="flex gap-1.5 items-center mb-1">
              {Array.from({ length: cantidadDias }).map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 flex-1 rounded-full"
                  style={{ background: i < diasSeleccionados ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)' }}
                />
              ))}
            </div>
            <p className="text-white/55 text-xs">{diasSeleccionados} de {cantidadDias} días elegidos</p>
          </div>
        )}

        {cta && (
          <button
            onClick={() => {
              if (semana?.metadata?.esSemanaSugerencias && !semana?.metadata?.pedidoId) {
                onVerDetalle('sugerencias', semana);
              } else {
                onVerDetalle('pedido', semana);
              }
            }}
            className="mt-3 flex items-center gap-1.5 bg-white text-[#5B6B2A] text-sm font-bold px-4 py-2 rounded-xl"
          >
            {cta} <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Fila semana próxima ────────────────────────────────────────────────────────
function FilaSemanaProxima({ semana, onVerDetalle }) {
  const cfg = estadoConfig(semana);
  const cta = ctaLabel(semana);

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F0EDE6] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#2A2C1F] truncate">{rangoSemana(semana.id)}</p>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>
      {cta && (
        <button
          onClick={() => {
            if (semana?.metadata?.esSemanaSugerencias && !semana?.metadata?.pedidoId) {
              onVerDetalle('sugerencias', semana);
            } else {
              onVerDetalle('pedido', semana);
            }
          }}
          className="shrink-0 flex items-center gap-1 text-[#5B6B2A] text-sm font-bold bg-[#EDF0E4] px-3 py-1.5 rounded-xl"
        >
          {cta === 'Sugerir platos' ? <Lightbulb size={14} /> : null}
          {cta}
        </button>
      )}
    </div>
  );
}

// ── Home ───────────────────────────────────────────────────────────────────────
export default function PedidoPage({ empleado }) {
  const navigate = useNavigate();
  const [detalle, setDetalle] = useState(null); // null | { tipo: 'pedido'|'sugerencias', semana }

  const {
    semanas,
    cargando,
    error,
    recargarPedido,
    guardarCambios,
  } = usePedidoSemanal({ empleado });

  const nombre = empleado?.nombre || empleado?.name || '';
  const semanaActual = semanas.find(s => s.tipo === 'actual') || semanas[0] || null;
  const proximas = semanas.filter(s => s.tipo !== 'actual' && s.tipo !== 'anterior');

  const handleVerDetalle = (tipo, semana) => {
    if (tipo === 'sugerencias') {
      navigate(`${rutasCliente.sugerencias}?semana=${semana.id}`);
      return;
    }
    setDetalle({ tipo, semana });
  };

  if (detalle) {
    const semanaActualizada = semanas.find(s => s.id === detalle.semana.id) || detalle.semana;
    return (
      <WeeklyOrderView
        semana={semanaActualizada}
        onBack={() => setDetalle(null)}
        onGuardar={guardarCambios}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FAF8F3]">
      {/* Header */}
      <div className="bg-[#5B6B2A] px-4 pt-12 pb-5 flex items-center justify-between">
        <div>
          <p className="text-white/55 text-xs font-semibold">Hola,</p>
          <p className="text-white text-xl font-bold font-serif">{nombre || 'bienvenido'}</p>
        </div>
        <button
          onClick={() => navigate(rutasCliente.notificaciones)}
          className="relative w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center"
        >
          <Bell size={20} className="text-white" />
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto pb-24">
        {cargando && !semanas.length && (
          <div className="mx-4 mt-4 h-36 rounded-3xl bg-[#EDF0E4] animate-pulse" />
        )}

        {error && (
          <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <p className="flex-1 text-sm text-red-700">{error}</p>
            <button onClick={recargarPedido} className="text-red-500">
              <RefreshCw size={16} />
            </button>
          </div>
        )}

        {!cargando && !error && semanas.length === 0 && (
          <div className="mx-4 mt-4 bg-white border border-[#E8E5DC] rounded-2xl px-4 py-5 text-center">
            <p className="text-sm text-[#9A9885]">No hay semanas disponibles.</p>
          </div>
        )}

        {semanaActual && (
          <SemanaActualCard semana={semanaActual} onVerDetalle={handleVerDetalle} />
        )}

        {proximas.length > 0 && (
          <div className="mt-5">
            <p className="px-4 text-xs font-bold text-[#9A9885] uppercase tracking-wider mb-2">
              Próximas semanas
            </p>
            <div className="mx-4 bg-white rounded-2xl border border-[#E8E5DC] overflow-hidden">
              {proximas.map(s => (
                <FilaSemanaProxima key={s.id} semana={s} onVerDetalle={handleVerDetalle} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
