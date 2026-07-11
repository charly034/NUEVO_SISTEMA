import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useResumen, usePlatosmasUsados, useDistribucionTags, useUsoPorDia, useTendencia, useTopPorDia } from '../hooks/useEstadisticas.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import Spinner from '../components/ui/Spinner.jsx';
import { DIA_ABREV as DIAS_LABEL, DIA_NOMBRE as DIAS_FULL } from '../lib/dias.js';

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const TAG_COLORS = {
  Pollo: 'bg-amber-100 text-amber-800', Carnes: 'bg-red-100 text-red-800',
  Cerdo: 'bg-orange-100 text-orange-800', Pescado: 'bg-blue-100 text-blue-800',
  Vegetariano: 'bg-green-100 text-green-800', Pasta: 'bg-yellow-100 text-yellow-800',
  Arroz: 'bg-lime-100 text-lime-800', Guisos: 'bg-stone-100 text-stone-700',
  Ensaladas: 'bg-emerald-100 text-emerald-800', Wok: 'bg-cyan-100 text-cyan-800',
  Tartas: 'bg-violet-100 text-violet-800', Milanesas: 'bg-rose-100 text-rose-800',
  Hamburguesas: 'bg-pink-100 text-pink-800', Legumbres: 'bg-teal-100 text-teal-800',
  Gratinados: 'bg-indigo-100 text-indigo-800',
};

function Barra({ value, max, color = 'bg-brand-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
    </div>
  );
}

function LoadingBlock({ label = 'Cargando datos...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ title, detail }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
    </div>
  );
}

function UpdatingBadge({ show }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600">
      <Spinner size="sm" /> Actualizando...
    </span>
  );
}

function esFechaIso(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '');
}

// ── Resumen cards ────────────────────────────────────────────────
function SeccionResumen() {
  const { data, isLoading } = useResumen();
  const stats = data ? [
    { label: 'Platos activos',          value: data.total_platos,    color: 'text-brand-700' },
    { label: 'Veces servidos',          value: data.total_usos,      color: 'text-blue-700' },
    { label: 'Platos distintos usados', value: data.platos_usados,   color: 'text-violet-700' },
    { label: 'Semanas registradas',     value: data.total_semanas,   color: 'text-amber-700' },
    { label: 'Nunca usados',            value: data.nunca_usados,    color: 'text-gray-500' },
  ] : [];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {isLoading
        ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 flex justify-center items-center h-20"><Spinner /></div>
          ))
        : stats.map(({ label, value, color }) => (
            <div key={label} className="card p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{label}</p>
            </div>
          ))
      }
    </div>
  );
}

// ── Top platos ───────────────────────────────────────────────────
function SeccionTopPlatos({ filtros }) {
  const { data = [], isLoading, isFetching } = usePlatosmasUsados({ limit: 15, ...filtros });
  const max = data[0]?.usos ?? 1;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">Platos más repetidos</h2>
        <UpdatingBadge show={isFetching && !isLoading} />
      </div>
      {isLoading ? <LoadingBlock label="Cargando platos más repetidos..." /> : data.length === 0 ? (
        <EmptyState title="Sin platos repetidos para este filtro" detail="Probá ampliar el período o quitar filtros de empresa." />
      ) : (
        <div className="space-y-3">
          {data.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-500 w-5 text-right flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                  {p.tags?.slice(0, 2).map(t => (
                    <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${TAG_COLORS[t] ?? 'bg-gray-100 text-gray-600'}`}>{t}</span>
                  ))}
                </div>
                <Barra value={p.usos} max={max} color={i === 0 ? 'bg-brand-500' : i < 3 ? 'bg-brand-400' : 'bg-gray-300'} />
              </div>
              <span className="text-sm font-bold text-gray-700 w-8 text-right flex-shrink-0">{p.usos}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Distribución por categoría ───────────────────────────────────
function SeccionTags({ filtros }) {
  const { data = [], isLoading, isFetching } = useDistribucionTags(filtros);
  const max = data[0]?.usos ?? 1;
  const total = data.reduce((s, d) => s + d.usos, 0);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">Distribución por categoría</h2>
        <UpdatingBadge show={isFetching && !isLoading} />
      </div>
      {isLoading ? <LoadingBlock label="Cargando distribucion por categoria..." /> : data.length === 0 ? (
        <EmptyState title="Sin categorias para este filtro" detail="No hay usos registrados con el periodo y empresa seleccionados." />
      ) : (
        <div className="space-y-2.5">
          {data.map(({ tag, usos }) => (
            <div key={tag} className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-28 text-center flex-shrink-0 ${TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-600'}`}>
                {tag}
              </span>
              <Barra value={usos} max={max} color="bg-brand-400" />
              <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">
                {usos}× · {Math.round((usos / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Uso por día + top platos por día ─────────────────────────────
function SeccionPorDia({ filtros }) {
  const { data: resumenDia = [], isLoading: loadingRes, isFetching: fetchingRes } = useUsoPorDia(filtros);
  const { data: topPorDia = {}, isLoading: loadingTop, isFetching: fetchingTop }  = useTopPorDia();
  const [diaActivo, setDiaActivo] = useState(null);

  const max = Math.max(...resumenDia.map(d => d.usos), 1);
  const topDia = diaActivo ? (topPorDia[diaActivo] ?? []) : [];

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">Usos por día de la semana</h2>
        <UpdatingBadge show={(fetchingRes || fetchingTop) && !loadingRes && !loadingTop} />
      </div>
      <p className="text-xs text-gray-500 mb-4">Hacé click en un día para ver los platos más servidos ese día</p>

      {/* Gráfico de barras */}
      {loadingRes ? <LoadingBlock label="Cargando usos por dia..." /> : resumenDia.length === 0 ? (
        <EmptyState title="Sin usos por dia para este filtro" detail="No hay datos suficientes para graficar el periodo seleccionado." />
      ) : (
        <div className="flex items-end gap-2 h-28 mb-3">
          {resumenDia.map(({ dia, usos }) => {
            const pct = Math.round((usos / max) * 100);
            const activo = diaActivo === dia;
            return (
              <button
                key={dia}
                type="button"
                onClick={() => setDiaActivo(activo ? null : dia)}
                aria-label={`${activo ? 'Ocultar' : 'Ver'} top de platos de ${DIAS_FULL[dia]}: ${usos} usos`}
                title={`${DIAS_FULL[dia]}: ${usos} usos`}
                className="flex-1 flex flex-col items-center gap-1 group rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              >
                <span className={`text-xs font-bold transition-colors ${activo ? 'text-brand-700' : 'text-gray-700'}`}>{usos}</span>
                <div
                  className={`w-full rounded-t-lg transition-[height,background-color] ${activo ? 'bg-brand-600' : 'bg-brand-400 group-hover:bg-brand-500'}`}
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
                <span className={`text-[10px] transition-colors ${activo ? 'text-brand-700 font-semibold' : 'text-gray-500'}`}>
                  {DIAS_LABEL[dia]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Panel de top platos por día */}
      {diaActivo && (
        <div className="border-t pt-4 mt-2">
          <p className="text-sm font-semibold text-gray-800 mb-3">
            Top platos los <span className="text-brand-700">{DIAS_FULL[diaActivo]}</span>
          </p>
          {loadingTop ? <LoadingBlock label="Cargando top del dia..." /> : (
            <div className="space-y-2">
              {topDia.length === 0 ? (
                <EmptyState title={`Sin platos para ${DIAS_FULL[diaActivo]}`} detail="El filtro actual no tiene usos para este dia." />
              ) : topDia.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 w-4 text-right flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm text-gray-800 truncate">{p.nombre}</p>
                      {p.tags?.slice(0, 2).map(t => (
                        <span key={t} className={`text-[10px] px-1.5 rounded-full flex-shrink-0 ${TAG_COLORS[t] ?? 'bg-gray-100 text-gray-600'}`}>{t}</span>
                      ))}
                    </div>
                    <Barra value={p.usos} max={topDia[0]?.usos ?? 1} color="bg-brand-500" />
                  </div>
                  <span className="text-sm font-bold text-gray-600 w-7 text-right flex-shrink-0">{p.usos}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tendencia mensual ────────────────────────────────────────────
function SeccionTendencia({ filtros }) {
  const { data = [], isLoading, isFetching } = useTendencia(filtros);
  const max = Math.max(...data.map(d => d.usos), 1);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">Tendencia mensual</h2>
        <UpdatingBadge show={isFetching && !isLoading} />
      </div>
      {isLoading ? <LoadingBlock label="Cargando tendencia mensual..." /> : data.length === 0 ? (
        <EmptyState title="Sin tendencia mensual para este filtro" detail="No hay meses con usos registrados en la seleccion actual." />
      ) : (
        <div className="space-y-2">
          {data.map(({ mes, usos, platos_distintos }) => {
            const [, m] = mes.split('-');
            return (
              <div key={mes} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-500 w-8 flex-shrink-0">{MESES[parseInt(m)]}</span>
                <Barra value={usos} max={max} color="bg-brand-500" />
                <div className="text-right flex-shrink-0 w-20">
                  <p className="text-xs font-bold text-gray-700">{usos} usos</p>
                  <p className="text-[10px] text-gray-500">{platos_distintos} platos</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────
export default function Estadisticas() {
  const [searchParams] = useSearchParams();
  const desdeUrl = searchParams.get('desde');
  const hastaUrl = searchParams.get('hasta');
  const tienePeriodoUrl = esFechaIso(desdeUrl) || esFechaIso(hastaUrl);
  const { data: empresas = [] } = useEmpresas();
  const [periodo, setPeriodo] = useState(tienePeriodoUrl ? 'custom' : '90');
  const [empresaId, setEmpresaId] = useState('');
  const [custom, setCustom] = useState({
    desde: esFechaIso(desdeUrl) ? desdeUrl : '',
    hasta: esFechaIso(hastaUrl) ? hastaUrl : '',
  });

  const hoy = new Date();
  const filtros = {};
  if (empresaId) filtros.empresa_id = empresaId;
  if (periodo === 'custom') {
    if (custom.desde) filtros.desde = custom.desde;
    if (custom.hasta) filtros.hasta = custom.hasta;
  } else if (periodo !== 'todo') {
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - Number(periodo));
    filtros.desde = desde.toISOString().split('T')[0];
    filtros.hasta = hoy.toISOString().split('T')[0];
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header con filtros inline */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Analizá el uso y rotación del menú</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={periodo}
            onChange={(event) => setPeriodo(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          >
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="180">Últimos 180 días</option>
            <option value="todo">Todo el período</option>
            <option value="custom">Rango personalizado</option>
          </select>
          <select
            value={empresaId}
            onChange={(event) => setEmpresaId(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* Rango personalizado — solo visible cuando se elige */}
      {periodo === 'custom' && (
        <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Desde</span>
            <input
              type="date"
              value={custom.desde}
              onChange={(event) => setCustom((prev) => ({ ...prev, desde: event.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Hasta</span>
            <input
              type="date"
              value={custom.hasta}
              onChange={(event) => setCustom((prev) => ({ ...prev, hasta: event.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
            />
          </label>
        </div>
      )}

      <SeccionResumen />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SeccionPorDia filtros={filtros} />
        <SeccionTags filtros={filtros} />
      </div>

      <SeccionTopPlatos filtros={filtros} />

      <SeccionTendencia filtros={filtros} />
    </div>
  );
}
