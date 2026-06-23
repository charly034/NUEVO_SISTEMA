import { useState, useMemo } from 'react';
import { usePedidos, useUpdateEstadoPedido } from '../hooks/usePedidos.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import { toast } from '../lib/toast.js';

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABEL = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' };
const DIAS_FULL  = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

const ESTADOS = [
  { key: 'pendiente',  label: 'Pendiente',   icon: '🕐', cls: 'bg-amber-50 text-amber-700 border-amber-200'  },
  { key: 'en_proceso', label: 'En proceso',  icon: '🔥', cls: 'bg-blue-50 text-blue-700 border-blue-200'    },
  { key: 'listo',      label: 'Listo',        icon: '✅', cls: 'bg-green-50 text-green-700 border-green-200' },
  { key: 'entregado',  label: 'Entregado',    icon: '📦', cls: 'bg-gray-50 text-gray-500 border-gray-200'   },
  { key: 'cancelado',  label: 'Cancelado',    icon: '❌', cls: 'bg-red-50 text-red-600 border-red-200'      },
];
const ESTADO_MAP = Object.fromEntries(ESTADOS.map(e => [e.key, e]));

function getLunesEstaSemana() {
  const hoy = new Date();
  const diff = hoy.getDay() === 0 ? -6 : 1 - hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return lunes.toISOString().split('T')[0];
}

function fmt(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function fmtFull(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function addDias(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function iniciales(nombre, apellido) {
  return `${(apellido || '')[0] || ''}${(nombre || '')[0] || ''}`.toUpperCase();
}

const AVATAR_COLORS = [
  'bg-green-600', 'bg-blue-600', 'bg-purple-600', 'bg-orange-500',
  'bg-pink-600', 'bg-teal-600', 'bg-indigo-600', 'bg-rose-600',
];
function avatarColor(str) {
  let h = 0;
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Estado badge + selector rápido ───────────────────────────────────────────

function EstadoBadge({ pedido, onCambiar, loading }) {
  const [open, setOpen] = useState(false);
  const e = ESTADO_MAP[pedido.estado] || ESTADO_MAP.pendiente;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${e.cls} ${loading ? 'opacity-60' : 'hover:opacity-80'} transition-opacity`}
      >
        <span>{e.icon}</span>
        <span>{e.label}</span>
        <span className="opacity-50 text-[10px]">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[150px]">
          {ESTADOS.filter(s => s.key !== pedido.estado).map(s => (
            <button
              key={s.key}
              onClick={() => { onCambiar(s.key); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card de pedido (vista empresa) ───────────────────────────────────────────

function PedidoCard({ pedido, diasSemana, onCambiarEstado, loadingId }) {
  const [expandido, setExpandido] = useState(true);
  const color = avatarColor(pedido.empleado_apellido);
  const itemsPorDia = Object.fromEntries((pedido.items || []).map(i => [i.dia, i]));
  const totalDias = diasSemana.filter(d => itemsPorDia[d]).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Header del empleado */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpandido(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
            {iniciales(pedido.empleado_nombre, pedido.empleado_apellido)}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">
              {pedido.empleado_apellido}, {pedido.empleado_nombre}
            </p>
            <p className="text-xs text-gray-400">{pedido.empresa_nombre}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:block">
            {totalDias} día{totalDias !== 1 ? 's' : ''}
          </span>
          <EstadoBadge
            pedido={pedido}
            loading={loadingId === pedido.id}
            onCambiar={(estado) => onCambiarEstado(pedido.id, estado)}
          />
          <span className="text-gray-300 text-sm">{expandido ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Items por día en grilla */}
      {expandido && (
        <div className="border-t border-gray-50">
          <div className="grid grid-cols-1 divide-y divide-gray-50">
            {diasSemana.map(dia => {
              const item = itemsPorDia[dia];
              if (!item) return null;
              return (
                <div key={dia} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-xs font-bold text-green-700 w-8 pt-0.5 shrink-0">{DIAS_LABEL[dia]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{item.plato_nombre}</p>
                    <div className="flex flex-wrap gap-x-2 mt-0.5">
                      {item.opcion && (
                        <span className="text-[11px] text-gray-400">Opción {item.opcion}</span>
                      )}
                      {item.guarnicion_nombre && (
                        <span className="text-[11px] text-emerald-600">+ {item.guarnicion_nombre}</span>
                      )}
                      {item.notas && (
                        <span className="text-[11px] text-amber-600 italic">⚠ {item.notas}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vista por día ─────────────────────────────────────────────────────────────

function VistaDia({ pedidos, semana, diaActivo, setDiaActivo }) {
  // Construir lista de días que tienen al menos 1 item
  const diasConItems = DIAS_ORDEN.filter(dia =>
    pedidos.some(p => (p.items || []).some(i => i.dia === dia))
  );

  const fechaDia = (dia) => {
    const idx = DIAS_ORDEN.indexOf(dia);
    return idx >= 0 ? addDias(semana, idx) : null;
  };

  const dia = diaActivo || diasConItems[0];

  const itemsDia = pedidos.flatMap(p =>
    (p.items || [])
      .filter(i => i.dia === dia)
      .map(i => ({
        ...i,
        empleado_nombre: p.empleado_nombre,
        empleado_apellido: p.empleado_apellido,
        empresa_nombre: p.empresa_nombre,
      }))
  );

  // Agrupar por plato+guarnicion
  const grupos = {};
  for (const item of itemsDia) {
    const key = `${item.plato_id}__${item.opcion || ''}__${item.guarnicion_id || ''}`;
    if (!grupos[key]) {
      grupos[key] = {
        plato_nombre: item.plato_nombre,
        opcion: item.opcion,
        guarnicion_nombre: item.guarnicion_nombre,
        personas: [],
      };
    }
    grupos[key].personas.push({
      nombre: `${item.empleado_apellido}, ${item.empleado_nombre}`,
      empresa: item.empresa_nombre,
      notas: item.notas,
    });
  }

  const gruposList = Object.values(grupos).sort((a, b) => b.personas.length - a.personas.length);

  if (diasConItems.length === 0) {
    return <p className="text-gray-400 text-sm">No hay pedidos para esta semana.</p>;
  }

  return (
    <div>
      {/* Tabs de días */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {diasConItems.map(d => {
          const fecha = fechaDia(d);
          const count = pedidos.reduce((n, p) => n + (p.items || []).filter(i => i.dia === d).length, 0);
          const activo = d === dia;
          return (
            <button
              key={d}
              onClick={() => setDiaActivo(d)}
              className={`flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                activo ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
              }`}
            >
              <span className="font-bold">{DIAS_FULL[d]}</span>
              {fecha && <span className={`text-[10px] mt-0.5 ${activo ? 'text-green-200' : 'text-gray-400'}`}>{fmt(fecha)}</span>}
              <span className={`mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activo ? 'bg-white text-green-700' : 'bg-green-100 text-green-700'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Producción del día */}
      <div className="space-y-3">
        {gruposList.map((grupo, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-100">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{grupo.plato_nombre}</p>
                <div className="flex gap-3 mt-0.5">
                  {grupo.opcion && <span className="text-xs text-gray-500">Opción {grupo.opcion}</span>}
                  {grupo.guarnicion_nombre && <span className="text-xs text-emerald-600">+ {grupo.guarnicion_nombre}</span>}
                </div>
              </div>
              <div className="bg-green-700 text-white text-xl font-bold w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
                {grupo.personas.length}
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {grupo.personas.map((p, j) => (
                <div key={j} className="flex items-center gap-2 px-4 py-2">
                  <div className={`w-6 h-6 rounded-full ${avatarColor(p.nombre.split(',')[0])} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                    {p.nombre.split(',').map(s => s.trim()[0] || '').join('').toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700 flex-1">{p.nombre}</span>
                  {p.empresa && <span className="text-xs text-gray-400 hidden sm:block">{p.empresa}</span>}
                  {p.notas && <span className="text-xs text-amber-600 italic">⚠ {p.notas}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PedidosAdmin() {
  const [semana, setSemana]           = useState(getLunesEstaSemana());
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro]   = useState('');
  const [busqueda, setBusqueda]           = useState('');
  const [vista, setVista]                 = useState('empresa');
  const [diaActivo, setDiaActivo]         = useState(null);
  const [loadingId, setLoadingId]         = useState(null);

  const { data: pedidosRaw = [], isLoading } = usePedidos({ semana_inicio: semana, empresa_id: empresaFiltro || undefined });
  const { data: empresas = [] } = useEmpresas();
  const updateEstado = useUpdateEstadoPedido();

  const cambiarSemana = (delta) => {
    const d = new Date(semana);
    d.setDate(d.getDate() + delta * 7);
    setSemana(d.toISOString().split('T')[0]);
    setDiaActivo(null);
  };

  // Filtrar pedidos según búsqueda y estado
  const pedidos = useMemo(() => {
    let list = pedidosRaw;
    if (estadoFiltro) list = list.filter(p => p.estado === estadoFiltro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p =>
        `${p.empleado_nombre} ${p.empleado_apellido}`.toLowerCase().includes(q) ||
        p.empresa_nombre?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [pedidosRaw, estadoFiltro, busqueda]);

  // Stats
  const stats = useMemo(() => {
    const total = pedidosRaw.length;
    const viandas = pedidosRaw.reduce((s, p) => s + (p.items?.length || 0), 0);
    const porEstado = {};
    for (const p of pedidosRaw) porEstado[p.estado] = (porEstado[p.estado] || 0) + 1;
    return { total, viandas, porEstado };
  }, [pedidosRaw]);

  // Días de la semana activos (los que tienen al menos 1 item)
  const diasSemana = useMemo(() => {
    const usados = new Set(pedidos.flatMap(p => (p.items || []).map(i => i.dia)));
    return DIAS_ORDEN.filter(d => usados.has(d));
  }, [pedidos]);

  const handleCambiarEstado = async (id, estado) => {
    setLoadingId(id);
    try {
      await updateEstado.mutateAsync({ id, estado });
      toast.success(`Estado actualizado: ${ESTADO_MAP[estado]?.label}`);
    } catch (e) {
      toast.error(e?.message || 'Error al actualizar');
    } finally {
      setLoadingId(null);
    }
  };

  const domingoSemana = addDias(semana, 6);
  const esEstaSemana = semana === getLunesEstaSemana();

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>

        <div className="flex items-center gap-1">
          <button onClick={() => cambiarSemana(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            ‹
          </button>
          <div className="text-center px-3">
            <p className="text-sm font-semibold text-gray-800">{fmt(semana)} — {fmt(domingoSemana)}</p>
            <p className="text-[11px] text-gray-400">{fmtFull(semana).split('/')[2]}</p>
          </div>
          <button onClick={() => cambiarSemana(1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            ›
          </button>
          {!esEstaSemana && (
            <button onClick={() => { setSemana(getLunesEstaSemana()); setDiaActivo(null); }} className="ml-1 text-xs text-green-700 underline">
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-0.5">Pedidos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-green-700">{stats.viandas}</p>
          <p className="text-xs text-gray-400 mt-0.5">Viandas</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-amber-700">{stats.porEstado.pendiente || 0}</p>
          <p className="text-xs text-amber-600 mt-0.5">🕐 Pendientes</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-green-700">{(stats.porEstado.listo || 0) + (stats.porEstado.entregado || 0)}</p>
          <p className="text-xs text-green-600 mt-0.5">✅ Listos/Entregados</p>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Buscar empleado o empresa..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400"
          />
        </div>

        {/* Empresa */}
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
          value={empresaFiltro}
          onChange={e => setEmpresaFiltro(e.target.value)}
        >
          <option value="">Todas las empresas</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>

        {/* Estado */}
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
          value={estadoFiltro}
          onChange={e => setEstadoFiltro(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e.key} value={e.key}>{e.icon} {e.label}</option>)}
        </select>

        {/* Vista toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden ml-auto">
          <button
            onClick={() => setVista('empresa')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${vista === 'empresa' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            👤 Por persona
          </button>
          <button
            onClick={() => setVista('dia')}
            className={`px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${vista === 'dia' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            📅 Por día
          </button>
        </div>
      </div>

      {/* Resultado count si hay filtros */}
      {(busqueda || estadoFiltro) && (
        <p className="text-xs text-gray-400 mb-3">
          Mostrando {pedidos.length} de {pedidosRaw.length} pedidos
          {(busqueda || estadoFiltro) && (
            <button onClick={() => { setBusqueda(''); setEstadoFiltro(''); }} className="ml-2 text-green-700 underline">
              Limpiar filtros
            </button>
          )}
        </p>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full" />
        </div>
      )}

      {/* ── Vista por persona ── */}
      {vista === 'empresa' && !isLoading && (
        <div className="space-y-3">
          {pedidos.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm">No hay pedidos para esta semana.</p>
            </div>
          )}
          {pedidos.map(pedido => (
            <PedidoCard
              key={pedido.id}
              pedido={pedido}
              diasSemana={diasSemana}
              onCambiarEstado={handleCambiarEstado}
              loadingId={loadingId}
            />
          ))}
        </div>
      )}

      {/* ── Vista por día ── */}
      {vista === 'dia' && !isLoading && (
        <VistaDia
          pedidos={pedidos}
          semana={semana}
          diaActivo={diaActivo}
          setDiaActivo={setDiaActivo}
        />
      )}
    </div>
  );
}
