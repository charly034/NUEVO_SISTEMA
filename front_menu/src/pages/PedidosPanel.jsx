import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, Tab } from '../components/ui/Tabs.jsx';
import { usePedidos } from '../hooks/usePedidos.js';
import PedidosAdmin from './PedidosAdmin.jsx';
import { DIAS_ORDEN, DIA_NOMBRE as DIAS_LABEL } from '../lib/dias.js';
import { lunesActualISO } from '../lib/fechas.js';

const VISTAS = new Set(['seguimiento', 'produccion-semanal', 'produccion-diaria']);
const VISTA_ALIASES = {
  semana: 'seguimiento',
  hoy: 'seguimiento',
  dashboard: 'produccion-semanal',
  'produccion-dia': 'produccion-diaria',
  'despacho-hoy': 'seguimiento',
};
function getLunesOffset(offset) {
  return lunesActualISO(offset);
}

function formatRangoSemana(lunes) {
  const [, lm, ld] = lunes.split('-');
  const [, domm, domd] = (() => {
    const [y, m, d] = lunes.split('-').map(Number);
    const dom = new Date(y, m - 1, d + 6);
    return [dom.getFullYear(), dom.getMonth() + 1, dom.getDate()];
  })();
  return `${parseInt(ld)}/${parseInt(lm)} — ${domd}/${domm}`;
}

function getDiaHoy() {
  return DIAS_ORDEN[(new Date().getDay() + 6) % 7];
}

function texto(value, fallback = '') {
  return value == null ? fallback : String(value);
}

function getTamanoPlan(pedido) {
  if (pedido?.plan_gramaje_min) return `${pedido.plan_gramaje_min} g`;
  return 'Sin tamaño';
}

function ordenarTamanos([a], [b]) {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return texto(a).localeCompare(texto(b));
}

function resumenTamanos(tamanos = {}) {
  return Object.entries(tamanos)
    .sort(ordenarTamanos)
    .map(([tamano, cantidad]) => `${cantidad} de ${tamano}`)
    .join(' · ');
}

function getClaveVianda(item) {
  return [
    item.plato_id || texto(item.plato_nombre).trim().toLowerCase() || 'sin-plato',
    item.opcion || '',
    item.guarnicion_id || texto(item.guarnicion_nombre).trim().toLowerCase() || '',
  ].join('__');
}

function esViandaActiva(item) {
  return item && !item.sin_pedido && item.estado !== 'cancelado';
}

function Kpi({ label, value, tone = 'gray' }) {
  const tones = {
    gray: 'border-gray-100 bg-white text-gray-900',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    blue: 'border-blue-100 bg-blue-50 text-blue-800',
  };
  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone] || tones.gray}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium text-gray-500">{label}</p>
    </div>
  );
}

function NavSemana({ offset, onChange }) {
  const lunes = getLunesOffset(offset);
  const esActual = offset === 0;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(offset - 1)}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        ←
      </button>
      <span className="min-w-[110px] text-center text-sm font-semibold text-gray-700">
        {formatRangoSemana(lunes)}
      </span>
      <button
        type="button"
        onClick={() => onChange(offset + 1)}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        →
      </button>
      {!esActual && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="ml-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Hoy
        </button>
      )}
    </div>
  );
}

function ProduccionSemanal() {
  const [offset, setOffset] = useState(0);
  const lunes = getLunesOffset(offset);
  const esActual = offset === 0;
  const diaHoy = getDiaHoy();
  const pedidosQuery = usePedidos({ semana_inicio: lunes, limit: 500 });
  const pedidosRaw = useMemo(() => {
    const d = pedidosQuery.data;
    return d?.pedidos ?? d ?? [];
  }, [pedidosQuery.data]);
  const { isLoading } = pedidosQuery;

  const stats = useMemo(() => {
    const items = pedidosRaw
      .filter((pedido) => pedido.estado !== 'cancelado')
      .flatMap((pedido) => (pedido.items || [])
        .filter(esViandaActiva)
        .map((item) => ({ ...item, pedido })));
    const itemsHoy = items.filter((item) => item.dia === diaHoy);
    const porEmpresa = new Map();
    const porDia = new Map();
    const porVianda = new Map();

    for (const item of items) {
      const empresa = texto(item.pedido.empresa_nombre, 'Sin empresa');
      porEmpresa.set(empresa, (porEmpresa.get(empresa) || 0) + 1);
      porDia.set(item.dia, (porDia.get(item.dia) || 0) + 1);

      const clave = getClaveVianda(item);
      const grupo = porVianda.get(clave) || {
        plato_nombre: item.plato_nombre || 'Sin plato asignado',
        opcion: item.opcion || null,
        guarnicion_nombre: item.guarnicion_nombre || null,
        total: 0,
        dias: Object.fromEntries(DIAS_ORDEN.map((dia) => [dia, 0])),
        tamanos: {},
      };
      grupo.total += 1;
      grupo.dias[item.dia] = (grupo.dias[item.dia] || 0) + 1;
      const tamano = getTamanoPlan(item.pedido);
      grupo.tamanos[tamano] = (grupo.tamanos[tamano] || 0) + 1;
      porVianda.set(clave, grupo);
    }

    return {
      pedidos: pedidosRaw.length,
      viandasSemana: items.length,
      viandasHoy: itemsHoy.length,
      entregadasHoy: itemsHoy.filter((item) => item.estado === 'entregado').length,
      pendientesHoy: itemsHoy.filter((item) => item.estado !== 'entregado').length,
      empresas: [...porEmpresa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      dias: DIAS_ORDEN.map((dia) => [dia, porDia.get(dia) || 0]),
      viandas: [...porVianda.values()].sort((a, b) => b.total - a.total || texto(a.plato_nombre).localeCompare(texto(b.plato_nombre))),
    };
  }, [pedidosRaw, diaHoy]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
        Cargando produccion semanal...
      </div>
    );
  }

  const headerSection = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Produccion semanal</h1>
        <p className="mt-1 text-sm text-gray-500">
          Semana {formatRangoSemana(lunes)}{esActual ? ` · Hoy: ${DIAS_LABEL[diaHoy]}` : ''}
        </p>
      </div>
      <NavSemana offset={offset} onChange={setOffset} />
    </div>
  );

  if (stats.pedidos === 0) {
    return (
      <section className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        {headerSection}
        <div className="rounded-lg border border-gray-100 bg-white p-12 text-center">
          <p className="text-base font-semibold text-gray-500">Sin pedidos para esta semana</p>
          <p className="mt-1 text-sm text-gray-500">Los pedidos aparecen aqui una vez que los empleados los confirmen.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      {headerSection}

      <div className={`grid gap-3 ${esActual ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-2'}`}>
        <Kpi label="Pedidos semana" value={stats.pedidos} />
        <Kpi label="Viandas semana" value={stats.viandasSemana} tone="green" />
        {esActual && <Kpi label="Viandas hoy" value={stats.viandasHoy} tone="blue" />}
        {esActual && <Kpi label="Entregadas hoy" value={stats.entregadasHoy} tone="green" />}
        {esActual && <Kpi label="Pendientes hoy" value={stats.pendientesHoy} tone="amber" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-100 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-900">Viandas por dia</h2>
          <div className="mt-3 space-y-2">
            {stats.dias.map(([dia, total]) => (
              <div key={dia} className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-gray-600">{DIAS_LABEL[dia]}</span>
                <div className="h-2 flex-1 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-emerald-600"
                    style={{ width: `${stats.viandasSemana ? Math.max(4, (total / stats.viandasSemana) * 100) : 0}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-bold text-gray-800">{total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-900">Empresas con mas viandas</h2>
          <div className="mt-3 divide-y divide-gray-50">
            {stats.empresas.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Sin datos para esta semana.</p>
            ) : stats.empresas.map(([empresa, total]) => (
              <div key={empresa} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-gray-700">{empresa}</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white">
        <div className="flex flex-col gap-1 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Resumen semanal de cocina</h2>
            <p className="text-xs text-gray-500">Totales de la semana agrupados por plato, opcion y guarnicion.</p>
          </div>
          <span className="text-xs font-semibold text-gray-500">{stats.viandas.length} tipo{stats.viandas.length !== 1 ? 's' : ''} de vianda</span>
        </div>

        {stats.viandas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">Sin viandas para resumir esta semana.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="min-w-[260px] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Vianda</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total</th>
                  {DIAS_ORDEN.map((dia) => (
                    <th key={dia} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">{DIAS_LABEL[dia].slice(0, 3)}</th>
                  ))}
                  <th className="min-w-[170px] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Tamaños</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.viandas.map((grupo) => (
                  <tr key={`${grupo.plato_nombre}-${grupo.opcion || ''}-${grupo.guarnicion_nombre || ''}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{grupo.plato_nombre}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-gray-500">
                        {grupo.opcion ? <span>Op. {grupo.opcion}</span> : <span>Fijo</span>}
                        {grupo.guarnicion_nombre ? <span className="text-emerald-700">+ {grupo.guarnicion_nombre}</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-base font-bold text-emerald-700">{grupo.total}</td>
                    {DIAS_ORDEN.map((dia) => (
                      <td key={dia} className={`px-3 py-3 text-right font-semibold ${grupo.dias[dia] ? 'text-gray-800' : 'text-gray-500'}`}>
                        {grupo.dias[dia] || '-'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-xs font-medium text-gray-500">{resumenTamanos(grupo.tamanos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default function PedidosPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawVista = searchParams.get('vista');
  const vistaNormalizada = VISTA_ALIASES[rawVista] || rawVista;
  const vista = VISTAS.has(vistaNormalizada) ? vistaNormalizada : 'seguimiento';

  const setVista = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'seguimiento') params.delete('vista');
    else params.set('vista', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
        <Tabs value={vista} onChange={setVista}>
          <Tab value="seguimiento" label="Pedidos por persona" />
          <Tab value="produccion-semanal" label="Resumen de la semana" />
          <Tab value="produccion-diaria" label="Lista de cocina por dia" />
        </Tabs>
      </div>
      {vista === 'seguimiento' ? <PedidosAdmin vistaFija="empresa" titulo="Pedidos por persona" /> : null}
      {vista === 'produccion-semanal' ? <ProduccionSemanal /> : null}
      {vista === 'produccion-diaria' ? <PedidosAdmin vistaFija="dia" titulo="Lista de cocina por dia" /> : null}
    </div>
  );
}
