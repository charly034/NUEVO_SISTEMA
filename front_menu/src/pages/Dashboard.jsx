import { Link } from 'react-router-dom';
import { usePlatos } from '../hooks/usePlatos.js';
import { useMenusSemanales, useNoUsados } from '../hooks/useMenus.js';
import Spinner from '../components/ui/Spinner.jsx';

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABEL = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
};
const DIAS_FULL = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

function getLunes(offset = 0) {
  const hoy = new Date();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) + offset * 7);
  return lunes.toISOString().split('T')[0];
}

function getDomingo(lunesStr) {
  const d = new Date(lunesStr);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

function getDiaActual() {
  const idx = (new Date().getDay() + 6) % 7; // 0=lunes, 6=domingo
  return DIAS_ORDEN[idx];
}

function formatCorto(isoStr) {
  const fecha = (isoStr || '').split('T')[0];
  const [, m, d] = fecha.split('-');
  return d && m ? `${d}/${m}` : '—';
}

function formatFechaLarga(isoStr) {
  const fecha = (isoStr || '').split('T')[0];
  if (!fecha) return '';
  const [, m, d] = fecha.split('-');
  const meses = ['', 'enero', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(d)} de ${meses[parseInt(m)]}`;
}

// ── Sección "Hoy" ────────────────────────────────────────────────
function SeccionHoy({ menu, loading }) {
  const diaHoy = getDiaActual();
  const hoy = new Date();
  const fechaHoy = hoy.toISOString().split('T')[0];

  const diasMap = Object.fromEntries((menu?.dias || []).map((d) => [d.dia, d.platos || []]));
  const sinServicio = (menu?.sin_servicio || []).find((s) => s.dia === diaHoy);
  const platosHoy = diasMap[diaHoy] || [];

  const esFinDeSemana = diaHoy === 'sabado' || diaHoy === 'domingo';

  return (
    <div className={`rounded-2xl p-5 ${
      sinServicio
        ? 'bg-red-50 border border-red-200'
        : platosHoy.length > 0
        ? 'bg-brand-700 text-white'
        : 'bg-gray-900 text-white'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${
            sinServicio ? 'text-red-400' : 'text-brand-200'
          }`}>
            Hoy
          </p>
          <p className={`text-xl font-bold ${sinServicio ? 'text-gray-800' : 'text-white'}`}>
            {DIAS_FULL[diaHoy]} {formatFechaLarga(fechaHoy)}
          </p>
        </div>
        {menu && (
          <Link
            to={`/semanas/${menu.id}`}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              sinServicio
                ? 'bg-white text-gray-700 hover:bg-gray-100'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            Editar
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner /></div>
      ) : !menu ? (
        <div className="text-center py-2">
          <p className="text-white/70 text-sm mb-3">No hay menú para esta semana</p>
          <Link to="/semanas" className="inline-block bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + Crear menú semanal
          </Link>
        </div>
      ) : sinServicio ? (
        <div>
          <p className="font-semibold text-red-600">Sin servicio</p>
          {sinServicio.motivo && <p className="text-sm text-red-400 mt-0.5">{sinServicio.motivo}</p>}
        </div>
      ) : esFinDeSemana && platosHoy.length === 0 ? (
        <p className="text-white/60 text-sm">Fin de semana · sin menú asignado</p>
      ) : platosHoy.length === 0 ? (
        <div className="flex items-center gap-3">
          <p className="text-white/70 text-sm flex-1">Sin platos asignados para hoy</p>
          <Link to={`/semanas/${menu.id}`} className="text-xs text-white/80 hover:text-white underline">
            Asignar →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {platosHoy.map((p) => (
            <div key={p.opcion} className="flex items-center gap-3 bg-white/15 rounded-xl px-4 py-3">
              <span className="w-7 h-7 rounded-full bg-white/30 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                {p.opcion}
              </span>
              <p className="text-white font-medium text-sm leading-tight">{p.plato_nombre}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Resumen de la semana ─────────────────────────────────────────
function ResumenSemana({ menu, loading, esActual }) {
  const diaHoy = getDiaActual();
  const diasMap = Object.fromEntries((menu?.dias || []).map((d) => [d.dia, d.platos || []]));
  const sinServicioSet = new Set((menu?.sin_servicio || []).map((s) => s.dia));
  const totalPlatos = (menu?.dias || []).reduce((acc, d) => acc + (d.platos?.length ?? 0), 0);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">
            {esActual ? 'Esta semana' : 'Próxima semana'}
          </h2>
          {menu && (
            <p className="text-xs text-gray-400 mt-0.5">
              {formatCorto(menu.fecha_inicio)} → {formatCorto(menu.fecha_fin)} · {totalPlatos} platos
            </p>
          )}
        </div>
        {menu ? (
          <Link to={`/semanas/${menu.id}`} className="text-xs text-brand-600 hover:underline font-medium">
            Ver grilla →
          </Link>
        ) : (
          <Link to="/semanas" className="btn-primary text-xs">
            + Crear
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner /></div>
      ) : !menu ? (
        <p className="text-sm text-gray-400 text-center py-4">Sin menú registrado para esta semana</p>
      ) : (
        <div className="space-y-1.5">
          {DIAS_ORDEN.map((dia) => {
            const platos = diasMap[dia] || [];
            const esFeriado = sinServicioSet.has(dia);
            const esHoy = esActual && dia === diaHoy;

            return (
              <div
                key={dia}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
                  esHoy
                    ? 'bg-brand-50 border border-brand-200'
                    : esFeriado
                    ? 'bg-red-50'
                    : platos.length > 0
                    ? 'bg-gray-50'
                    : 'opacity-40'
                }`}
              >
                <span className={`text-xs font-bold w-8 flex-shrink-0 ${esHoy ? 'text-brand-700' : 'text-gray-400'}`}>
                  {DIAS_LABEL[dia]}
                </span>

                {esFeriado ? (
                  <span className="text-xs text-red-400 font-medium">Sin servicio</span>
                ) : platos.length === 0 ? (
                  <span className="text-xs text-gray-300">Sin asignar</span>
                ) : (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 min-w-0">
                    {platos.map((p) => (
                      <span key={p.opcion} className="text-xs text-gray-700 truncate">
                        <span className="font-semibold text-brand-600 mr-1">{p.opcion}</span>
                        {p.plato_nombre}
                      </span>
                    ))}
                  </div>
                )}

                {esHoy && (
                  <span className="ml-auto text-[10px] font-semibold text-brand-600 uppercase tracking-wide flex-shrink-0">
                    Hoy
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Platos para rotar ────────────────────────────────────────────
function SeccionRotacion({ noUsados, loading }) {
  if (loading) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">Disponibles para rotar</h2>
          <p className="text-xs text-gray-400">No usados en los últimos 14 días</p>
        </div>
        <Link to="/historial" className="text-xs text-brand-600 hover:underline font-medium">
          Ver historial →
        </Link>
      </div>

      {noUsados.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Todos los platos se usaron recientemente — buena rotación.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {noUsados.slice(0, 12).map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-full"
            >
              {p.nombre}
              <span className="text-amber-400 font-normal">
                {p.ultima_vez_usado ? `${p.dias_desde_ultimo_uso}d` : 'nuevo'}
              </span>
            </span>
          ))}
          {noUsados.length > 12 && (
            <Link
              to="/historial"
              className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full hover:bg-gray-200 transition-colors"
            >
              +{noUsados.length - 12} más
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stats compactas ──────────────────────────────────────────────
function StatsRow({ totalPlatos, totalMenus, totalRotar, loading }) {
  const stats = [
    { label: 'platos activos', value: totalPlatos, href: '/platos', color: 'text-brand-700' },
    { label: 'semanas creadas', value: totalMenus, href: '/semanas', color: 'text-blue-700' },
    { label: 'listos para rotar', value: totalRotar, href: '/historial', color: 'text-amber-700' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(({ label, value, href, color }) => (
        <Link key={label} to={href} className="card p-3 text-center hover:shadow-md transition-shadow">
          {loading || value === undefined ? (
            <div className="h-7 flex items-center justify-center"><Spinner size="sm" /></div>
          ) : (
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          )}
          <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{label}</p>
        </Link>
      ))}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────
export default function Dashboard() {
  const lunesEsta   = getLunes(0);
  const lunesProx   = getLunes(1);
  const domingoProx = getDomingo(lunesProx);

  const menusQuery    = useMenusSemanales({ desde: lunesEsta, hasta: domingoProx, limit: 10 });
  const platosQuery   = usePlatos({ activo: 'true', limit: 1 });
  const noUsadosQuery = useNoUsados({ dias: 14 });

  const menus    = menusQuery.data?.menus ?? [];
  const menuEsta = menus.find((m) => m.fecha_inicio?.split('T')[0] === lunesEsta) ?? null;
  const menuProx = menus.find((m) => m.fecha_inicio?.split('T')[0] === lunesProx) ?? null;

  const totalPlatos = platosQuery.data?.pagination?.total;
  const noUsados    = noUsadosQuery.data ?? [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {/* Stats */}
      <StatsRow
        totalPlatos={totalPlatos}
        totalMenus={menusQuery.data?.pagination?.total}
        totalRotar={noUsadosQuery.isLoading ? undefined : noUsados.length}
        loading={platosQuery.isLoading || menusQuery.isLoading}
      />

      {/* Hoy */}
      <SeccionHoy menu={menuEsta} loading={menusQuery.isLoading} />

      {/* Semana: desktop = 2 col, mobile = apiladas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResumenSemana menu={menuEsta} loading={menusQuery.isLoading} esActual />
        <ResumenSemana menu={menuProx} loading={menusQuery.isLoading} />
      </div>

      {/* Rotación */}
      <SeccionRotacion noUsados={noUsados} loading={noUsadosQuery.isLoading} />
    </div>
  );
}
