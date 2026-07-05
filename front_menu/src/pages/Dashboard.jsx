import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePlatos } from '../hooks/usePlatos.js';
import { useMenusSemanales, useNoUsados } from '../hooks/useMenus.js';
import { usePedidos } from '../hooks/usePedidos.js';
import { useEnviosWhatsapp } from '../hooks/useNotificaciones.js';
import {
  addDiasISO,
  fechaISOEnZona,
  indiceDiaSemanaISO,
  lunesDeSemanaISO,
  useFechaOperativa,
} from '../hooks/useFechaOperativa.js';
import Spinner from '../components/ui/Spinner.jsx';

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const WHATSAPP_ALERT_STORAGE_KEY = 'laquinta.dashboard.whatsappAlertasVistas';
const DIAS_LABEL = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
};
const DIAS_FULL = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

function getDomingo(lunesStr) {
  return addDiasISO(lunesStr, 6);
}

function getDiaActual(fechaOperativa) {
  const idx = indiceDiaSemanaISO(fechaOperativa || fechaISOEnZona()); // 0=lunes, 6=domingo
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

function leerAlertasVistas() {
  try {
    const raw = window.localStorage.getItem(WHATSAPP_ALERT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function guardarAlertasVistas(keys) {
  try {
    window.localStorage.setItem(WHATSAPP_ALERT_STORAGE_KEY, JSON.stringify(keys.slice(-20)));
  } catch {
    // Si localStorage no esta disponible, el cierre queda solo en memoria.
  }
}

function keyAlertasWhatsapp(fallidos) {
  if (fallidos.length === 0) return null;
  const ultimo = fallidos[0];
  return `fallidos:${fallidos.length}:${ultimo?.id ?? ultimo?.created_at ?? 'sin-id'}`;
}

// ── Sección "Hoy" ────────────────────────────────────────────────
function SeccionHoy({ menu, loading, fechaOperativa }) {
  const fechaHoy = fechaOperativa || fechaISOEnZona();
  const diaHoy = getDiaActual(fechaHoy);

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
  const navigate = useNavigate();
  const diaHoy = getDiaActual();
  const diasMap = Object.fromEntries((menu?.dias || []).map((d) => [d.dia, d.platos || []]));
  const sinServicioSet = new Set((menu?.sin_servicio || []).map((s) => s.dia));
  const totalPlatos = (menu?.dias || []).reduce((acc, d) => acc + (d.platos?.length ?? 0), 0);
  const hrefSemana = menu ? `/semanas/${menu.id}` : null;
  const abrirSemana = () => {
    if (hrefSemana) navigate(hrefSemana);
  };
  const abrirConTeclado = (event) => {
    if (!hrefSemana) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(hrefSemana);
    }
  };

  return (
    <div
      className={`card p-5 transition ${hrefSemana ? 'cursor-pointer hover:border-brand-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-200' : ''}`}
      role={hrefSemana ? 'link' : undefined}
      tabIndex={hrefSemana ? 0 : undefined}
      onClick={abrirSemana}
      onKeyDown={abrirConTeclado}
    >
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
          <Link
            to={hrefSemana}
            onClick={(event) => event.stopPropagation()}
            className="text-xs text-brand-600 hover:underline font-medium"
          >
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
              <button
                type="button"
                key={dia}
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/semanas/${menu.id}?dia=${dia}`);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-200 ${
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
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Platos para rotar ────────────────────────────────────────────
function SeccionRotacion({ noUsados, loading }) {
  const [expandido, setExpandido] = useState(false);
  if (loading) return null;
  const platosVisibles = expandido ? noUsados : noUsados.slice(0, 12);

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
        <div className={`flex flex-wrap gap-2 ${expandido ? 'max-h-64 overflow-y-auto pr-1' : ''}`}>
          {platosVisibles.map((p) => {
            const esNuevo = !p.ultima_vez_usado;
            return (
            <span
              key={p.id}
              title={esNuevo ? 'Plato nunca servido' : `Último uso hace ${p.dias_desde_ultimo_uso} días`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border ${
                esNuevo
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {p.nombre}
              <span className={esNuevo ? 'text-green-500 font-normal' : 'text-amber-500 font-normal'}>
                {esNuevo ? 'nuevo' : `${p.dias_desde_ultimo_uso}d`}
              </span>
            </span>
            );
          })}
          {noUsados.length > 12 && !expandido && (
            <button
              type="button"
              onClick={() => setExpandido(true)}
              className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full hover:bg-gray-200 transition-colors"
            >
              +{noUsados.length - 12} más
            </button>
          )}
          {noUsados.length > 12 && expandido && (
            <button
              type="button"
              onClick={() => setExpandido(false)}
              className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full hover:bg-gray-200 transition-colors"
            >
              Mostrar menos
            </button>
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

// ── Prioridad operativa ──────────────────────────────────────────
function PanelOperacion({ pedidos, loading }) {
  const totalPedidos = pedidos.length;
  const totalViandas = pedidos.reduce((sum, pedido) => sum + (pedido.items?.length ?? 0), 0);
  const pendientes = pedidos.filter(p => p.estado === 'pendiente').length;
  const enProceso = pedidos.filter(p => p.estado === 'en_proceso').length;
  const listos = pedidos.filter(p => p.estado === 'listo' || p.estado === 'entregado').length;

  const items = [
    { label: 'Pedidos', value: totalPedidos, hint: 'personas', tone: 'text-gray-900' },
    { label: 'Viandas', value: totalViandas, hint: 'a producir', tone: 'text-brand-700' },
    { label: 'Pendientes', value: pendientes + enProceso, hint: `${pendientes} nuevos · ${enProceso} en proceso`, tone: pendientes ? 'text-amber-700' : 'text-green-700' },
    { label: 'Listos', value: listos, hint: 'preparados/entregados', tone: 'text-blue-700' },
  ];

  return (
    <div className="card p-4 md:p-5 border-l-4 border-l-brand-600">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700 mb-1">Prioridad operativa</p>
          <h2 className="text-lg font-bold text-gray-900">Pedidos de esta semana</h2>
          <p className="text-xs text-gray-500 mt-0.5">Lo primero que necesita revisar cocina/operación.</p>
        </div>
        <Link to="/pedidos" className="btn-primary text-xs whitespace-nowrap">Ver pedidos</Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-5"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {items.map(item => (
            <Link key={item.label} to="/pedidos" className="rounded-xl bg-gray-50 border border-gray-100 p-3 hover:bg-white hover:shadow-sm transition">
              <p className={`text-2xl font-extrabold ${item.tone}`}>{item.value}</p>
              <p className="text-xs font-semibold text-gray-700 mt-0.5">{item.label}</p>
              <p className="text-[11px] text-gray-400 mt-1 leading-tight">{item.hint}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertasOperativas({ menuEsta, menuProx, enviosWhatsapp, loading }) {
  const fallidos = enviosWhatsapp.filter(e => e.estado === 'fallido');
  const [alertasVistas, setAlertasVistas] = useState(leerAlertasVistas);
  const whatsappKey = keyAlertasWhatsapp(fallidos);
  const whatsappOculta = whatsappKey ? alertasVistas.includes(whatsappKey) : false;
  const alertas = [];

  if (!menuEsta) {
    alertas.push({
      tono: 'red',
      titulo: 'Esta semana no tiene menú',
      texto: 'Creá o publicá el menú para que los empleados puedan pedir.',
      href: '/semanas',
      accion: 'Ir a semanas',
    });
  } else if (menuEsta.estado !== 'publicado') {
    alertas.push({
      tono: 'amber',
      titulo: 'Esta semana no está publicada',
      texto: `Estado actual: ${menuEsta.estado}. Los empleados no verán el menú como disponible.`,
      href: `/semanas/${menuEsta.id}`,
      accion: 'Revisar grilla',
    });
  }

  if (!menuProx) {
    alertas.push({
      tono: 'amber',
      titulo: 'Próxima semana sin menú',
      texto: 'Conviene duplicar o crear la próxima semana antes del cierre operativo.',
      href: '/semanas',
      accion: 'Crear semana',
    });
  } else if (menuProx.estado !== 'publicado') {
    alertas.push({
      tono: 'amber',
      titulo: 'Próxima semana pendiente de publicar',
      texto: `Tiene ${menuProx.dias?.length || 0} días cargados y estado ${menuProx.estado}.`,
      href: `/semanas/${menuProx.id}`,
      accion: 'Publicar',
    });
  }

  if (fallidos.length > 0 && !whatsappOculta) {
    alertas.push({
      id: whatsappKey,
      tono: 'red',
      titulo: `${fallidos.length} envío${fallidos.length !== 1 ? 's' : ''} WhatsApp fallido${fallidos.length !== 1 ? 's' : ''}`,
      texto: 'Revisá n8n o el webhook antes del próximo aviso automático.',
      href: '/notificaciones',
      accion: 'Ver notificaciones',
      detalle: 'Detalle técnico: revisá n8n o el webhook antes del próximo aviso automático.',
      dismissible: true,
    });
  }

  if (loading) {
    return <div className="card p-4"><Spinner /></div>;
  }

  if (alertas.length === 0) {
    return (
      <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
        <p className="text-sm font-bold text-green-800">Sin alertas operativas</p>
        <p className="mt-1 text-xs text-green-700">Menús, pedidos y notificaciones no muestran bloqueos inmediatos.</p>
      </div>
    );
  }

  const tonos = {
    red: 'border-red-200 bg-red-50 text-red-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {alertas.map((alerta) => (
        <div key={`${alerta.titulo}-${alerta.href}`} className={`relative rounded-2xl border transition hover:shadow-sm ${tonos[alerta.tono]}`}>
          <Link to={alerta.href} className="block p-4 pr-11" title={alerta.detalle}>
            <p className="text-sm font-bold">{alerta.titulo}</p>
            <p className="mt-1 text-xs opacity-80">
              {alerta.detalle
                ? 'Hubo un problema técnico enviando estos mensajes. Contactá al equipo de soporte técnico si persiste.'
                : alerta.texto}
            </p>
            <p className="mt-3 text-xs font-bold underline">{alerta.accion}</p>
          </Link>
          {alerta.dismissible && (
            <button
              type="button"
              aria-label="Cerrar alerta de WhatsApp"
              title="Ocultar esta alerta"
              onClick={() => {
                const nuevas = [...alertasVistas, alerta.id].filter(Boolean);
                setAlertasVistas(nuevas);
                guardarAlertasVistas(nuevas);
              }}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-sm font-bold opacity-80 transition hover:bg-white hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              x
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────
export default function Dashboard() {
  const fechaOperativaQuery = useFechaOperativa();
  const fechaOperativa = fechaOperativaQuery.data?.fecha ?? (fechaOperativaQuery.isError ? fechaISOEnZona() : null);
  const fechaLista = Boolean(fechaOperativa);
  const lunesEsta = fechaLista ? lunesDeSemanaISO(fechaOperativa, 0) : null;
  const lunesProx = fechaLista ? lunesDeSemanaISO(fechaOperativa, 1) : null;
  const domingoProx = lunesProx ? getDomingo(lunesProx) : null;

  const menusQuery    = useMenusSemanales({ desde: lunesEsta, hasta: domingoProx, limit: 10 }, { enabled: fechaLista });
  const totalMenusQuery = useMenusSemanales({ limit: 1 });
  const platosQuery   = usePlatos({ activo: 'true', limit: 1 });
  const noUsadosQuery = useNoUsados({ dias: 14 });
  const pedidosQuery  = usePedidos({ semana_inicio: lunesEsta, limit: 500 }, { enabled: fechaLista });
  const enviosQuery = useEnviosWhatsapp({ limit: 20 });

  const menus    = menusQuery.data?.menus ?? [];
  const menuEsta = menus.find((m) => m.fecha_inicio?.split('T')[0] === lunesEsta) ?? null;
  const menuProx = menus.find((m) => m.fecha_inicio?.split('T')[0] === lunesProx) ?? null;

  const totalPlatos = platosQuery.data?.pagination?.total;
  const noUsados    = noUsadosQuery.data ?? [];
  const pedidos      = pedidosQuery.data ?? [];
  const enviosWhatsapp = enviosQuery.data ?? [];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Resumen operativo para arrancar el día.</p>
      </div>

      <AlertasOperativas
        menuEsta={menuEsta}
        menuProx={menuProx}
        enviosWhatsapp={enviosWhatsapp}
        loading={fechaOperativaQuery.isLoading || menusQuery.isLoading || enviosQuery.isLoading}
      />

      {/* Operación */}
      <PanelOperacion pedidos={pedidos} loading={fechaOperativaQuery.isLoading || pedidosQuery.isLoading} />

      {/* Hoy */}
      <SeccionHoy menu={menuEsta} loading={fechaOperativaQuery.isLoading || menusQuery.isLoading} fechaOperativa={fechaOperativa} />

      {/* Stats */}
      <StatsRow
        totalPlatos={totalPlatos}
        totalMenus={totalMenusQuery.data?.pagination?.total}
        totalRotar={noUsadosQuery.isLoading ? undefined : noUsados.length}
        loading={platosQuery.isLoading || totalMenusQuery.isLoading}
      />

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
