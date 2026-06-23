import { useState } from 'react';
import { useResumen, usePlatosmasUsados, useDistribucionTags, useUsoPorDia, useTendencia, useTopPorDia } from '../hooks/useEstadisticas.js';
import Spinner from '../components/ui/Spinner.jsx';

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS_LABEL = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' };
const DIAS_FULL  = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

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
              <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{label}</p>
            </div>
          ))
      }
    </div>
  );
}

// ── Top platos ───────────────────────────────────────────────────
function SeccionTopPlatos({ filtros }) {
  const { data = [], isLoading } = usePlatosmasUsados({ limit: 15, ...filtros });
  const max = data[0]?.usos ?? 1;

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Platos más repetidos</h2>
      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="space-y-3">
          {data.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-300 w-5 text-right flex-shrink-0">{i + 1}</span>
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
  const { data = [], isLoading } = useDistribucionTags(filtros);
  const max = data[0]?.usos ?? 1;
  const total = data.reduce((s, d) => s + d.usos, 0);

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Distribución por categoría</h2>
      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
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
function SeccionPorDia() {
  const { data: resumenDia = [], isLoading: loadingRes } = useUsoPorDia();
  const { data: topPorDia = {}, isLoading: loadingTop }  = useTopPorDia();
  const [diaActivo, setDiaActivo] = useState(null);

  const max = Math.max(...resumenDia.map(d => d.usos), 1);
  const topDia = diaActivo ? (topPorDia[diaActivo] ?? []) : [];

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Usos por día de la semana</h2>
      <p className="text-xs text-gray-400 mb-4">Hacé click en un día para ver los platos más servidos ese día</p>

      {/* Gráfico de barras */}
      {loadingRes ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <div className="flex items-end gap-2 h-28 mb-3">
          {resumenDia.map(({ dia, usos }) => {
            const pct = Math.round((usos / max) * 100);
            const activo = diaActivo === dia;
            return (
              <button
                key={dia}
                onClick={() => setDiaActivo(activo ? null : dia)}
                className="flex-1 flex flex-col items-center gap-1 group"
              >
                <span className={`text-xs font-bold transition-colors ${activo ? 'text-brand-700' : 'text-gray-700'}`}>{usos}</span>
                <div
                  className={`w-full rounded-t-lg transition-all ${activo ? 'bg-brand-600' : 'bg-brand-400 group-hover:bg-brand-500'}`}
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
                <span className={`text-[10px] transition-colors ${activo ? 'text-brand-700 font-semibold' : 'text-gray-400'}`}>
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
          {loadingTop ? <div className="flex justify-center py-4"><Spinner /></div> : (
            <div className="space-y-2">
              {topDia.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Sin datos</p>
              ) : topDia.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4 text-right flex-shrink-0">{i + 1}</span>
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
function SeccionTendencia() {
  const { data = [], isLoading } = useTendencia();
  const max = Math.max(...data.map(d => d.usos), 1);

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Tendencia mensual</h2>
      {isLoading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <div className="space-y-2">
          {data.map(({ mes, usos, platos_distintos }) => {
            const [, m] = mes.split('-');
            return (
              <div key={mes} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-500 w-8 flex-shrink-0">{MESES[parseInt(m)]}</span>
                <Barra value={usos} max={max} color="bg-brand-500" />
                <div className="text-right flex-shrink-0 w-20">
                  <p className="text-xs font-bold text-gray-700">{usos} usos</p>
                  <p className="text-[10px] text-gray-400">{platos_distintos} platos</p>
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
  const [filtros] = useState({});

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
        <p className="text-sm text-gray-400 mt-0.5">Analizá el uso y rotación del menú</p>
      </div>

      <SeccionResumen />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SeccionPorDia />
        <SeccionTags filtros={filtros} />
      </div>

      <SeccionTopPlatos filtros={filtros} />

      <SeccionTendencia />
    </div>
  );
}
