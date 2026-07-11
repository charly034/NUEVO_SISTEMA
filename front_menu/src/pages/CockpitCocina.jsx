import { useState } from 'react';
import { useMenusSemanales } from '../hooks/useMenus.js';
import { useCocinaHoy, useEtiquetas } from '../hooks/useCocina.js';
import Spinner from '../components/ui/Spinner.jsx';
import { DIAS_LABORALES as DIAS, DIA_ABREV as DIA_CORTO, DIA_NOMBRE as DIA_LARGO } from '../lib/dias.js';
import { fechaISOEnZona, addDiasISO, lunesDeSemanaISO } from '../lib/fechas.js';

const COLORES_PLATO = [
  'bg-brand-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
];

function formatFechaISO(offsetDias = 0) {
  return addDiasISO(fechaISOEnZona(), offsetDias);
}

function lunesDe(fechaISO) {
  return lunesDeSemanaISO(fechaISO);
}

function fechaDeDia(lunes, dia) {
  const offset = DIAS.indexOf(dia);
  return offset < 0 ? lunes : addDiasISO(lunes, offset);
}

function KpiCard({ label, value, sublabel, children }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sublabel && <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>}
      {children}
    </div>
  );
}

function BarraProgreso({ listas, total }) {
  const pct = total > 0 ? Math.round((listas / total) * 100) : 0;
  return (
    <div className="mt-2">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-500">{listas} listas</span>
        <span className="text-xs font-semibold text-brand-600">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SelectorMenu({ value, onChange }) {
  const { data: menus, isLoading } = useMenusSemanales({ estado: 'publicado,cerrado', limit: 20 });
  if (isLoading) return <Spinner size="sm" />;
  const lista = menus?.menus ?? menus?.items ?? (Array.isArray(menus) ? menus : []);
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 outline-none"
    >
      <option value="">-- Menu --</option>
      {lista.map((m) => (
        <option key={m.id} value={m.id}>{m.nombre}</option>
      ))}
    </select>
  );
}

function VistaEtiquetas({ menuId, dia }) {
  const { data, isLoading, error } = useEtiquetas(menuId, dia);
  if (!menuId) return <p className="text-gray-500 text-center py-6">Selecciona un menu semanal para ver etiquetas.</p>;
  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (error) return <p className="text-red-500 py-4 text-center">Error al cargar etiquetas.</p>;
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => window.print()} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors">
          Imprimir etiquetas del dia
        </button>
      </div>
      {data && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {data.etiquetas.length === 0 && (
            <p className="col-span-full text-gray-500 text-center py-6">Sin pedidos para este dia.</p>
          )}
          {data.etiquetas.map((et, i) => (
            <div key={i} className="rounded-lg border-2 border-gray-300 p-3 text-center print:border print:shadow-none">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{et.empresa_nombre}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{DIA_CORTO[et.dia] ?? et.dia}</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{et.empleado_apellido}, {et.empleado_nombre}</p>
              <div className="mt-2 rounded bg-gray-100 px-2 py-1.5">
                <p className="text-xs font-semibold text-gray-800">{et.nombre_vianda || et.plato_nombre}</p>
                {et.guarnicion_nombre && (
                  <p className="text-[10px] text-emerald-700 font-medium mt-0.5">+ {et.guarnicion_nombre}</p>
                )}
                {et.salsa_nombre && (
                  <p className="text-[10px] text-red-700 font-medium mt-0.5">+ {et.salsa_nombre}</p>
                )}
              </div>
              {et.plan_nombre && (
                <p className="text-[10px] text-gray-500 mt-1.5">{et.plan_nombre}{et.plan_gramaje_min ? ` · ${et.plan_gramaje_min}g` : ''}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CockpitCocina() {
  const hoyISO = formatFechaISO(0);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [vistaEtiquetas, setVistaEtiquetas] = useState(false);
  const [menuId, setMenuId] = useState(null);

  const lunes = lunesDe(formatFechaISO(semanaOffset * 7));
  const fechaDia = diaSeleccionado ? fechaDeDia(lunes, diaSeleccionado) : hoyISO;

  const { data, isLoading, error } = useCocinaHoy(fechaDia);

  const totalesPorDia = data?.totales_por_dia ?? {};
  const kpis = data?.kpis ?? { viandas_total: 0, viandas_listas: 0, viandas_pendientes: 0, empresas_count: 0 };
  const conteosVianda = data?.conteos_vianda ?? [];
  const checklistLocal = data?.checklist_local ?? [];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cockpit de cocina</h1>
          <p className="text-sm text-gray-500">Produccion y control del dia</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setVistaEtiquetas(false); setSemanaOffset((o) => o - 1); }}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ←
          </button>
          <span className="text-xs font-semibold text-gray-700 min-w-[80px] text-center">
            {lunes ? `Sem. ${lunes.slice(5, 10)}` : ''}
          </span>
          <button
            type="button"
            onClick={() => { setVistaEtiquetas(false); setSemanaOffset((o) => o + 1); }}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            →
          </button>
        </div>
      </div>

      {/* Chips de días */}
      <div className="flex flex-wrap gap-2">
        {DIAS.map((dia) => {
          const fechaEste = fechaDeDia(lunes, dia);
          const total = totalesPorDia[dia] ?? 0;
          const esDiaActual = diaSeleccionado ? diaSeleccionado === dia : fechaEste === hoyISO;
          return (
            <button
              key={dia}
              type="button"
              onClick={() => { setDiaSeleccionado(dia); setVistaEtiquetas(false); }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${esDiaActual ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}
            >
              {DIA_CORTO[dia]} {total > 0 && <span className="ml-1 opacity-75">{total}</span>}
            </button>
          );
        })}
      </div>

      {isLoading && <div className="flex justify-center py-20"><Spinner /></div>}
      {error && <p className="text-red-500 py-8 text-center">Error al cargar datos.</p>}

      {!isLoading && !error && !vistaEtiquetas && data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Columna izquierda: platos */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                {DIA_LARGO[data.dia] ?? data.dia}
                {data.sin_servicio && <span className="ml-2 text-xs font-normal text-red-500">Sin servicio</span>}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVistaEtiquetas(true);
                    if (!menuId && data?.menu?.id) setMenuId(String(data.menu.id));
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Imprimir etiquetas del dia
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Lista de compras
                </button>
              </div>
            </div>

            {!data.menu && (
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-500">No hay menu activo para este dia</p>
              </div>
            )}

            {data.menu && (
              <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
                {conteosVianda.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500">Sin pedidos de vianda para hoy</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {conteosVianda.map((plato, idx) => (
                      <div key={plato.plato_id} className="px-4 py-3">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`h-3 w-3 rounded-full flex-shrink-0 ${COLORES_PLATO[idx % COLORES_PLATO.length]}`} />
                          <p className="font-semibold text-gray-900 text-sm">{plato.plato_nombre}</p>
                          <span className="ml-auto text-sm font-bold text-gray-900">{plato.total}</span>
                        </div>
                        <div className="pl-6 space-y-0.5">
                          {plato.empresas.map((e) => (
                            <div key={e.empresa_id} className="flex items-center justify-between text-xs text-gray-500">
                              <span>{e.empresa_nombre}</span>
                              <span className="font-medium text-gray-700">{e.total}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(data.fijos?.length > 0 || data.siempre?.length > 0) && (
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                {data.fijos?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Fijos de hoy</p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.fijos.map((p) => (
                        <span key={p.id} className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                          {p.nombre_vianda || p.nombre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {data.siempre?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Siempre disponibles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.siempre.map((p) => (
                        <span key={p.id} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          {p.nombre_vianda || p.nombre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {checklistLocal.length > 0 && (
              <div className="rounded-xl border border-teal-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 mb-2">Local hoy</p>
                <p className="text-[11px] text-gray-500 mb-2">Checklist informativo, sin cantidades — el local no gestiona pedidos en este sistema.</p>
                <div className="flex flex-wrap gap-1.5">
                  {checklistLocal.map((p) => (
                    <span key={p.id} className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                      {p.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha: KPIs */}
          <div className="space-y-3">
            <KpiCard label="Viandas confirmadas" value={kpis.viandas_total} sublabel={`${kpis.viandas_pendientes} pendientes`}>
              <BarraProgreso listas={kpis.viandas_listas} total={kpis.viandas_total} />
            </KpiCard>

            <KpiCard
              label="Empresas con entrega hoy"
              value={kpis.empresas_count}
            />

            {data.menu && (
              <div className="rounded-xl border border-gray-100 bg-white p-4 text-xs text-gray-500">
                <p className="font-semibold text-gray-700 mb-1">{data.menu.nombre}</p>
                <p>Menu {data.menu.estado}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vista etiquetas */}
      {vistaEtiquetas && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setVistaEtiquetas(false)}
              className="text-xs text-gray-500 hover:text-brand-600 transition-colors"
            >
              ← Volver al cockpit
            </button>
            <h2 className="text-base font-bold text-gray-900">Etiquetas — {DIA_LARGO[diaSeleccionado ?? data?.dia ?? 'lunes']}</h2>
            <div className="ml-auto">
              <SelectorMenu value={menuId} onChange={setMenuId} />
            </div>
          </div>
          <VistaEtiquetas menuId={menuId} dia={diaSeleccionado ?? data?.dia ?? 'lunes'} />
        </div>
      )}
    </div>
  );
}
