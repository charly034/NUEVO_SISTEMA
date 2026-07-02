import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle, Trash2, RefreshCw } from 'lucide-react';
import { apiGet, apiDelete } from '../services/apiCliente.js';
import { confirmar, toast } from '../lib/swal.js';

const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS_LABEL = { lunes:'Lun', martes:'Mar', miercoles:'Mié', jueves:'Jue', viernes:'Vie' };

function rangoSemana(fechaISO) {
  if (!fechaISO) return '';
  const [y, m, d] = String(fechaISO).split('T')[0].split('-').map(Number);
  const lunes = new Date(y, m - 1, d);
  const viernes = new Date(y, m - 1, d + 4);
  const ml = meses[lunes.getMonth()];
  const mv = meses[viernes.getMonth()];
  const ini = ml === mv ? lunes.getDate() : `${lunes.getDate()} ${ml}`;
  return `${ini} – ${viernes.getDate()} ${mv}`;
}

const ESTADO_CFG = {
  confirmado:   { label: 'Confirmado',   Icon: CheckCircle2, color: '#1B7B5E', bg: '#E6F6F0' },
  pendiente:    { label: 'Pendiente',    Icon: Clock,        color: '#C8782A', bg: '#FEF3E8' },
  en_proceso:   { label: 'Pendiente',    Icon: Clock,        color: '#C8782A', bg: '#FEF3E8' },
  fuera_de_plazo:{ label: 'Fuera de plazo', Icon: XCircle,  color: '#9A9885', bg: '#F0EDE6' },
  cancelado:    { label: 'Cancelado',    Icon: XCircle,      color: '#C83030', bg: '#FEF0EE' },
  borrador:     { label: 'Borrador',     Icon: Clock,        color: '#C8782A', bg: '#FEF3E8' },
};

function estadoCfg(estado) {
  return ESTADO_CFG[estado] || { label: estado || 'Confirmado', Icon: CheckCircle2, color: '#1B7B5E', bg: '#E6F6F0' };
}

const ESTADOS_CANCELABLES = new Set(['pendiente', 'en_proceso']);

function FilaPedido({ cancelando, pedido, onEliminar }) {
  const [abierto, setAbierto] = useState(false);
  const cfg = estadoCfg(pedido.estado);
  const Icon = cfg.Icon;
  const items = pedido.items || pedido.dias || [];
  const semanaInicio = String(pedido.semana_inicio || pedido.semanaId || '').split('T')[0];
  const puedeCancelar = Boolean(pedido.id && semanaInicio && ESTADOS_CANCELABLES.has(pedido.estado));

  return (
    <div className="bg-white rounded-2xl border border-[#E8E5DC] overflow-hidden">
      {/* Cabecera */}
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-4"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: cfg.bg }}
        >
          <Icon size={18} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold text-[#2A2C1F]">{rangoSemana(pedido.semana_inicio || pedido.semanaId)}</p>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#9A9885] font-semibold">{items.length} días</span>
          {abierto ? <ChevronUp size={16} className="text-[#9A9885]" /> : <ChevronDown size={16} className="text-[#9A9885]" />}
        </div>
      </button>

      {/* Detalle expandido */}
      {abierto && (
        <div className="border-t border-[#F0EDE6] px-4 pt-3 pb-4 space-y-1">
          {items.length === 0 && (
            <p className="text-sm text-[#9A9885] py-2">Sin días registrados.</p>
          )}
          {items.map((item, i) => {
            const dia = item.dia || item.diaId || item.clave;
            const platoNombre = item.plato_nombre || item.plato?.nombre || item.nombre || '—';
            const sinVianda = item.sin_pedido;
            return (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-[#F5F3EE] last:border-0">
                <span className="text-xs font-bold text-[#9A9885] w-8">{DIAS_LABEL[dia] || dia}</span>
                <p className={`text-sm flex-1 ${sinVianda ? 'text-[#C4C2B4] italic' : 'text-[#2A2C1F]'}`}>
                  {sinVianda ? 'Sin vianda' : platoNombre}
                </p>
              </div>
            );
          })}

          {puedeCancelar && (
            <button
              type="button"
              onClick={() => onEliminar(semanaInicio)}
              disabled={cancelando}
              className="mt-3 flex items-center gap-1.5 text-red-500 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={13} /> {cancelando ? 'Cancelando...' : 'Cancelar pedido'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function HistorialPage({ empleado }) {
  const queryClient = useQueryClient();
  const userId = empleado?.id || empleado?.usuarioId;
  const empresaId = empleado?.empresa?.id || empleado?.empresaId || empleado?.empresa_id;

  const { data: pedidos = [], isLoading, error, refetch } = useQuery({
    queryKey: ['mi-historial', userId],
    queryFn: () => apiGet('/pedidos/mi-historial'),
    staleTime: 5 * 60 * 1000,
  });

  const eliminar = useMutation({
    mutationFn: (semanaInicio) => apiDelete(
      `/pedidos/mi-pedido?semana_inicio=${encodeURIComponent(semanaInicio)}`,
      { requiereAuth: true },
    ),
    onSuccess: async (_pedidoCancelado, semanaInicio) => {
      toast.success('Pedido cancelado');
      queryClient.setQueryData(['mi-historial', userId], (actual = []) =>
        actual.map((pedido) => {
          const pedidoSemana = String(pedido.semana_inicio || pedido.semanaId || '').split('T')[0];
          return pedidoSemana === semanaInicio
            ? { ...pedido, estado: 'cancelado', items: [], dias: [] }
            : pedido;
        }),
      );
      queryClient.setQueriesData({ queryKey: ['pedido-semanal'] }, (actual = []) => {
        if (!Array.isArray(actual)) return actual;
        return actual.map((semana) => {
          if (semana.id !== semanaInicio) return semana;
          return {
            ...semana,
            estado: semana.metadata?.tieneMenuPublicado ? 'sin_pedido' : 'sin_menu',
            diasSeleccionados: 0,
            metadata: {
              ...(semana.metadata || {}),
              pedidoId: null,
              pedido: null,
            },
          };
        });
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mi-historial', userId] }),
        queryClient.invalidateQueries({ queryKey: ['pedido-semanal', userId] }),
        empresaId
          ? queryClient.invalidateQueries({ queryKey: ['pedido-semanal', userId, empresaId] })
          : Promise.resolve(),
      ]);
    },
    onError: (err) => toast.error(err?.message || 'No se pudo cancelar'),
  });

  const handleEliminar = async (semanaInicio) => {
    const ok = await confirmar({
      titulo: '¿Cancelar pedido?',
      texto: 'Esta acción no se puede deshacer.',
      botonConfirmar: 'Sí, cancelar',
      color: '#C83030',
    });
    if (ok) eliminar.mutate(semanaInicio);
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF8F3]">
      {/* Header */}
      <div className="bg-[#5B6B2A] px-4 pt-12 pb-5">
        <h1 className="text-white text-xl font-bold font-serif">Mis pedidos</h1>
        <p className="text-white/55 text-xs mt-0.5">Historial de viandas</p>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        {isLoading && (
          <>
            {[1,2,3].map(i => (
              <div key={i} className="h-16 bg-white rounded-2xl border border-[#E8E5DC] animate-pulse" />
            ))}
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <p className="flex-1 text-sm text-red-700">No pudimos cargar el historial.</p>
            <button onClick={refetch} className="text-red-500"><RefreshCw size={16} /></button>
          </div>
        )}

        {!isLoading && !error && pedidos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 bg-[#EDF0E4] rounded-full flex items-center justify-center">
              <CheckCircle2 size={24} className="text-[#9A9885]" />
            </div>
            <p className="text-sm text-[#9A9885] font-semibold">Todavía no tenés pedidos</p>
          </div>
        )}

        {pedidos.map(p => (
          <FilaPedido
            key={p.id}
            cancelando={eliminar.isPending}
            pedido={p}
            onEliminar={handleEliminar}
          />
        ))}
      </div>
    </div>
  );
}
