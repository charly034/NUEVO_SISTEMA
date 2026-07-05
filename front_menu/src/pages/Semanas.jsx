import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMenusSemanales, useCreateMenu, useDeleteMenu, useCambiarEstadoMenu, useDuplicarMenu } from '../hooks/useMenus.js';
import { usePedidos } from '../hooks/usePedidos.js';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { toast } from '../lib/toast.js';

// ── helpers de fecha ──────────────────────────────────────────────────
const MESES_LARGO  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS_SEMANA  = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const DIAS_HEADER  = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const DIA_LABEL    = { lunes:'Lun', martes:'Mar', miercoles:'Mié', jueves:'Jue', viernes:'Vie', sabado:'Sáb', domingo:'Dom' };

function soloFecha(str) { return str ? str.split('T')[0] : ''; }
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return localISO(new Date(y, m - 1, d + n));
}
function addSemanas(iso, n) { return addDias(iso, n * 7); }
function getLunesActual() {
  const hoy = new Date();
  const offset = (hoy.getDay() + 6) % 7;
  return localISO(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - offset));
}
function formatCorto(iso) {
  if (!iso) return '—';
  const [, m, d] = soloFecha(iso).split('-');
  return `${parseInt(d)} ${MESES_CORTO[parseInt(m) - 1]}`;
}
function formatLargo(iso) {
  if (!iso) return '—';
  const [y, m, d] = soloFecha(iso).split('-');
  return `${parseInt(d)} ${MESES_LARGO[parseInt(m) - 1]} ${y}`;
}
function esSemanaCursada(lunesIso, estado) {
  if (!['cerrado', 'publicado'].includes(estado)) return false;
  return addDias(lunesIso, 6) < localISO(new Date());
}
function nombreSugerido(lunesIso) {
  const [, lm, ld] = soloFecha(lunesIso).split('-');
  const domingoIso = addDias(lunesIso, 6);
  const [, dm, dd] = soloFecha(domingoIso).split('-');
  return `Semana del ${parseInt(ld)}/${parseInt(lm)} al ${parseInt(dd)}/${parseInt(dm)}`;
}

// Dado un year/month (0-indexed) retorna array de ISO lunes que cubren ese mes
function semanasDelMes(year, month) {
  const primerDia    = new Date(year, month, 1);
  const offsetLunes  = (primerDia.getDay() + 6) % 7;
  const primerLunes  = new Date(year, month, 1 - offsetLunes);
  const ultimoDia    = new Date(year, month + 1, 0);
  const semanas = [];
  let cur = primerLunes;
  while (cur <= ultimoDia) {
    semanas.push(localISO(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
  }
  return semanas;
}

// ── config de estado ──────────────────────────────────────────────────
const ESTADO_CFG = {
  borrador:  { label: 'Borrador',  accentCls: 'bg-gray-400',   chipCls: 'bg-gray-100 text-gray-600 border-gray-200',   rowTint: '' },
  publicado: { label: 'Publicado', accentCls: 'bg-green-500',  chipCls: 'bg-green-100 text-green-700 border-green-200',  rowTint: 'bg-green-50/60' },
  cerrado:   { label: 'Cerrado',   accentCls: 'bg-orange-400', chipCls: 'bg-orange-100 text-orange-700 border-orange-200',rowTint: 'bg-orange-50/40' },
  vacio:     { label: 'Sin menu',  accentCls: 'bg-gray-200',   chipCls: 'bg-gray-50 text-gray-300 border-gray-100',      rowTint: '' },
};

// ── Celda de un dia en el calendario ─────────────────────────────────
function CeldaDia({ lunesIso, diaIdx, menu, esHoy }) {
  const fechaDia  = addDias(lunesIso, diaIdx);
  const diaNum    = parseInt(fechaDia.split('-')[2]);
  const diaNombre = DIAS_SEMANA[diaIdx];
  const esFDS     = diaIdx >= 5;

  let platos = [];
  let esSinServicio = false;
  if (menu) {
    const diaData = (menu.dias ?? []).find(x => x.dia === diaNombre);
    platos = diaData?.platos ?? [];
    esSinServicio = (menu.sin_servicio ?? []).some(x => x.dia === diaNombre);
  }

  // Fondo de celda
  let bgCls = esSinServicio
    ? 'bg-red-50'
    : esFDS
      ? 'bg-gray-50'
      : 'bg-white';

  return (
    <div className={`relative flex flex-col px-2 pt-1.5 pb-2 h-[80px] border-l border-gray-200 ${bgCls}`}>
      {/* Número del día */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-flex items-center justify-center shrink-0 text-[11px] font-bold leading-none
          ${esHoy
            ? 'w-5 h-5 rounded-full bg-green-600 text-white'
            : esFDS ? 'text-gray-300' : 'text-gray-500'
          }`}>
          {diaNum}
        </span>
        {esSinServicio && (
          <span className="text-[7px] font-bold uppercase text-red-400 tracking-wide bg-red-100 px-1 py-px rounded">Feriado</span>
        )}
      </div>

      {/* Contenido */}
      {!esSinServicio && platos.length > 0 ? (
        <div className="flex flex-col gap-0.5 overflow-hidden">
          {platos.slice(0, 2).map((p, i) => (
            <div key={i} className="flex items-start gap-0.5 min-w-0">
              {p.opcion && (
                <span className="shrink-0 text-[8px] font-black text-green-600 leading-tight mt-px">{p.opcion[0]}</span>
              )}
              <span className="text-[9px] leading-tight text-gray-600 truncate">{p.plato_nombre}</span>
            </div>
          ))}
          {platos.length > 2 && (
            <span className="text-[8px] text-gray-300 leading-none">+{platos.length - 2} más</span>
          )}
        </div>
      ) : null}

      {/* Dot indicador abajo si tiene platos */}
      {!esSinServicio && platos.length > 0 && (
        <div className="absolute bottom-1.5 right-1.5 w-1 h-1 rounded-full bg-green-400 opacity-70" />
      )}
    </div>
  );
}

// ── Fila de semana en el calendario ──────────────────────────────────
function FilaSemana({ lunesIso, menu, isActiva, onClick, hoyIso, lunesActual }) {
  const estado = menu?.estado ?? 'vacio';
  const cfg    = ESTADO_CFG[estado];
  const esSemanaActual = lunesIso === lunesActual;

  return (
    <div
      className={`grid cursor-pointer select-none group transition-all duration-150
        ${isActiva ? 'ring-2 ring-inset ring-green-400' : 'hover:brightness-[0.97]'}
        ${cfg.rowTint}`}
      style={{ gridTemplateColumns: '80px repeat(7, minmax(0,1fr))' }}
      onClick={onClick}
    >
      {/* Columna semana */}
      <div className={`relative flex flex-col justify-between px-3 py-2 h-[80px] border-r border-gray-200 bg-white`}>
        {/* Acento de estado */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r ${cfg.accentCls}`} />

        <div className="pl-1">
          <div className="text-[10px] font-bold text-gray-700 leading-tight">
            {formatCorto(lunesIso)}
          </div>
          <div className="text-[9px] text-gray-400 leading-tight">
            {formatCorto(addDias(lunesIso, 6))}
          </div>
        </div>

        <div className="pl-1 flex flex-col gap-0.5">
          {esSemanaActual && (
            <span className="text-[7px] font-black uppercase text-amber-700 bg-amber-100 px-1 py-px rounded-sm leading-tight w-fit">
              Hoy
            </span>
          )}
          <span className={`inline-flex text-[7px] font-bold px-1 py-px rounded border uppercase tracking-wide w-fit ${cfg.chipCls}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* 7 dias */}
      {DIAS_SEMANA.map((_, i) => (
        <CeldaDia
          key={i}
          lunesIso={lunesIso}
          diaIdx={i}
          menu={menu}
          esHoy={addDias(lunesIso, i) === hoyIso}
        />
      ))}
    </div>
  );
}

// ── Grilla detallada en SideDrawer ────────────────────────────────────
function GrillaDias({ menu }) {
  const { dias = [], sin_servicio = [] } = menu;
  const diasMap = Object.fromEntries(dias.map(d => [d.dia, d]));
  const sinSet  = new Set(sin_servicio.map(s => s.dia));

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="grid grid-cols-7 gap-1.5 min-w-[420px]">
        {DIAS_SEMANA.map((dia, i) => {
          const fechaDia = addDias(soloFecha(menu.fecha_inicio), i);
          const platos   = diasMap[dia]?.platos ?? [];
          const esSin    = sinSet.has(dia);
          const esFS     = i >= 5;
          const borderCls = esSin
            ? 'border-red-200 bg-red-50'
            : platos.length > 0
              ? 'border-green-200 bg-green-50'
              : esFS ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white';

          return (
            <div key={dia} className={`rounded-xl border ${borderCls} p-2 min-h-[76px]`}>
              <div className="text-[11px] font-bold text-gray-700">{DIA_LABEL[dia]}</div>
              <div className="text-[10px] text-gray-400 mb-1.5">{formatCorto(fechaDia)}</div>
              {esSin ? (
                <div className="text-[10px] font-semibold text-red-500">Sin servicio</div>
              ) : platos.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {platos.slice(0, 3).map((p, pi) => (
                    <div key={pi} className="text-[10px] text-green-700 leading-snug">
                      {p.opcion && <span className="font-bold">{p.opcion}: </span>}
                      {p.plato_nombre}
                    </div>
                  ))}
                  {platos.length > 3 && (
                    <div className="text-[10px] text-gray-400">+{platos.length - 3} más</div>
                  )}
                </div>
              ) : (
                <div className="text-[10px] text-gray-300">Sin platos</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Contenido del SideDrawer ──────────────────────────────────────────
function DrawerContenido({ lunesIso, menu, onPublicar, onReabrir, onDuplicar, onDelete, estadoMut, estadoPending, totalPedidos, onClose }) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre]   = useState('');
  const createMut = useCreateMenu();
  const domingo   = addDias(lunesIso, 6);

  const handleCreate = async () => {
    try {
      const n = nombre.trim() || nombreSugerido(lunesIso);
      await createMut.mutateAsync({ nombre: n, fecha_inicio: lunesIso, fecha_fin: domingo });
      toast.success('Menu creado');
      setCreando(false);
      setNombre('');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!menu) {
    return (
      <div className="p-5 flex flex-col items-center justify-center text-center py-12">
        <p className="text-sm font-semibold text-gray-700 mb-1">{formatCorto(lunesIso)} — {formatCorto(domingo)}</p>
        <p className="text-sm text-gray-400 mb-6">No hay menu registrado para esta semana.</p>
        {creando ? (
          <div className="w-full max-w-xs text-left">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del menu</label>
            <input
              type="text" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder={nombreSugerido(lunesIso)} autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
            />
            <div className="flex gap-2 justify-center">
              <button onClick={() => { setCreando(false); setNombre(''); }} className="btn-secondary">Cancelar</button>
              <button onClick={handleCreate} disabled={createMut.isPending} className="btn-primary flex items-center gap-1.5">
                {createMut.isPending && <Spinner size="sm" />}
                Crear menu
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => setCreando(true)} className="btn-primary">+ Crear menu para esta semana</button>
            <Link to={`/sugeridor?semana=${lunesIso}`} className="btn-secondary" onClick={onClose}>Generar menu</Link>
          </div>
        )}
      </div>
    );
  }

  const { estado = 'borrador', dias = [], sin_servicio = [] } = menu;
  const totalPlatos = dias.reduce((acc, d) => acc + (d.platos?.length ?? 0), 0);
  const fechaLimiteStr = menu.fecha_limite_pedidos
    ? new Date(menu.fecha_limite_pedidos).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="p-5 space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
          <span>{formatLargo(menu.fecha_inicio)} &mdash; {formatLargo(addDias(soloFecha(menu.fecha_inicio), 6))}</span>
          <span>&middot;</span>
          <span>{totalPlatos} plato{totalPlatos !== 1 ? 's' : ''}</span>
          {sin_servicio.length > 0 && (<><span>&middot;</span><span>{sin_servicio.length} feriado{sin_servicio.length !== 1 ? 's' : ''}</span></>)}
        </div>
        <div className="flex flex-wrap gap-2">
          {fechaLimiteStr && estado === 'publicado' && (
            <p className="text-xs text-amber-600 font-medium">Pedidos hasta: {fechaLimiteStr}</p>
          )}
          {totalPedidos > 0 && (
            <p className="text-xs text-blue-600 font-semibold">{totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''} registrado{totalPedidos !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to={`/semanas/${menu.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          onClick={onClose}>
          Editar grilla &rarr;
        </Link>
        {estado === 'borrador' && (
          <button onClick={onPublicar} className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors">
            Publicar
          </button>
        )}
        {estado === 'cerrado' && (
          <button onClick={onReabrir} disabled={estadoPending} className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50">
            Reabrir pedidos
          </button>
        )}
        <button onClick={onDuplicar} className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          Duplicar
        </button>
        {esSemanaCursada(lunesIso, estado) && (
          <Link to={`/estadisticas?desde=${lunesIso}&hasta=${addDias(lunesIso, 6)}`}
            className="rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
            onClick={onClose}>
            Ver estadisticas
          </Link>
        )}
        {(estado === 'publicado' || estado === 'borrador') && (<div className="w-full border-t border-gray-100 my-1" />)}
        {estado === 'publicado' && (
          <>
            <button onClick={() => estadoMut({ estado: 'cerrado' })} disabled={estadoPending}
              className="rounded-lg border border-orange-200 bg-orange-50 px-3.5 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50">
              Cerrar pedidos
            </button>
            <button onClick={() => estadoMut({ estado: 'borrador' })} disabled={estadoPending}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">
              Volver a borrador
            </button>
          </>
        )}
        {estado === 'borrador' && (
          <button onClick={onDelete} className="rounded-lg border border-red-100 bg-white px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors">
            Eliminar
          </button>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Detalle diario</p>
        <GrillaDias menu={menu} />
      </div>
    </div>
  );
}

// ── Modales ───────────────────────────────────────────────────────────
function ModalPublicarForm({ menu, onConfirm, onCancel, loading }) {
  const [fecha, setFecha] = useState('');
  const [hora, setHora]   = useState('10:00');
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Publicar <strong>{menu?.nombre}</strong> lo hara visible para que los empleados puedan hacer su pedido.</p>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Fecha limite de pedidos <span className="font-normal text-gray-400">(opcional)</span>
        </label>
        <div className="flex gap-2">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          <input type="time" value={hora} onChange={e => setHora(e.target.value)}
            className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Sin fecha: los pedidos quedan abiertos hasta cerrarlos manualmente.</p>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button onClick={() => onConfirm(fecha ? `${fecha}T${hora}:00` : null)} disabled={loading} className="btn-primary flex items-center gap-1.5">
          {loading && <Spinner size="sm" />}
          Publicar menu
        </button>
      </div>
    </div>
  );
}

function ModalDuplicarForm({ menu, onConfirm, onCancel, loading }) {
  const lunesBase    = soloFecha(menu?.fecha_inicio || getLunesActual());
  const lunesInicial = addSemanas(lunesBase, 1);
  const [fechaInicio, setFechaInicio] = useState(lunesInicial);
  const [nombre, setNombre]           = useState(nombreSugerido(lunesInicial));
  const fechaFin = addDias(fechaInicio, 6);
  const cambiarFecha = v => { setFechaInicio(v); setNombre(nombreSugerido(v)); };

  return (
    <form onSubmit={e => { e.preventDefault(); onConfirm({ nombre, fecha_inicio: fechaInicio, fecha_fin: fechaFin }); }} className="space-y-4">
      <p className="text-sm text-gray-600">Se copiaran platos, opciones y dias sin servicio de <strong>{menu?.nombre}</strong> a una nueva semana en borrador.</p>
      <label className="block">
        <span className="block text-sm font-semibold text-gray-700 mb-1">Lunes de destino</span>
        <input type="date" value={fechaInicio} onChange={e => cambiarFecha(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-none" required />
      </label>
      <label className="block">
        <span className="block text-sm font-semibold text-gray-700 mb-1">Nombre</span>
        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-none" required />
      </label>
      <p className="text-xs text-gray-400">Rango: {formatCorto(fechaInicio)} &mdash; {formatCorto(fechaFin)}</p>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-1.5">
          {loading && <Spinner size="sm" />}
          Duplicar semana
        </button>
      </div>
    </form>
  );
}

// ── Componente principal ──────────────────────────────────────────────
export default function Semanas() {
  const hoyIso      = localISO(new Date());
  const lunesActual = getLunesActual();
  const hoyDate     = new Date();

  const [navYear,  setNavYear]  = useState(hoyDate.getFullYear());
  const [navMonth, setNavMonth] = useState(hoyDate.getMonth());
  const [semanaActiva, setSemanaActiva] = useState(null);
  const [modalPublicar,  setModalPublicar]  = useState(false);
  const [modalDuplicar,  setModalDuplicar]  = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [confirmReabrir, setConfirmReabrir] = useState(false);

  const query         = useMenusSemanales({ limit: 200 });
  const pedidosQ      = usePedidos({ semana_inicio: semanaActiva, limit: 500 }, { enabled: Boolean(semanaActiva) });
  const deleteMut     = useDeleteMenu();
  const duplicarMut   = useDuplicarMenu();
  const estadoMutHook = useCambiarEstadoMenu();

  const menus = query.data?.menus ?? [];
  const menuByLunes = useMemo(
    () => new Map(menus.map(m => [soloFecha(m.fecha_inicio), m])),
    [menus]
  );

  // Auto-cierre: semanas publicadas cuya fecha ya pasó se cierran solas
  const autoCerradoRef = useRef(new Set());
  useEffect(() => {
    if (!menus.length) return;
    const vencidas = menus.filter(m =>
      m.estado === 'publicado' &&
      soloFecha(m.fecha_inicio) &&
      addDias(soloFecha(m.fecha_inicio), 6) < hoyIso &&
      !autoCerradoRef.current.has(m.id)
    );
    if (!vencidas.length) return;
    vencidas.forEach(m => autoCerradoRef.current.add(m.id));
    Promise.all(
      vencidas.map(m => estadoMutHook.mutateAsync({ id: m.id, estado: 'cerrado', extra: {} }))
    ).then(() => {
      if (vencidas.length === 1) {
        toast.success(`Semana del ${formatCorto(soloFecha(vencidas[0].fecha_inicio))} cerrada automáticamente`);
      } else {
        toast.success(`${vencidas.length} semanas cerradas automáticamente`);
      }
    }).catch(() => {});
  }, [menus]);

  const semanasVisibles = useMemo(() => semanasDelMes(navYear, navMonth), [navYear, navMonth]);
  const menuActivo   = semanaActiva ? (menuByLunes.get(semanaActiva) ?? null) : null;
  const totalPedidos = pedidosQ.data?.length ?? 0;

  const cerrarDrawer = () => setSemanaActiva(null);

  const irAHoy = () => {
    setNavYear(hoyDate.getFullYear());
    setNavMonth(hoyDate.getMonth());
    setSemanaActiva(lunesActual);
  };

  const prevMes = () => {
    if (navMonth === 0) { setNavYear(y => y - 1); setNavMonth(11); }
    else setNavMonth(m => m - 1);
  };
  const nextMes = () => {
    if (navMonth === 11) { setNavYear(y => y + 1); setNavMonth(0); }
    else setNavMonth(m => m + 1);
  };

  const handleEstado = async ({ estado, extra = {} }) => {
    if (!menuActivo) return false;
    try {
      await estadoMutHook.mutateAsync({ id: menuActivo.id, estado, extra });
      const labels = { publicado: menuActivo.estado === 'cerrado' ? 'reabierto' : 'publicado', borrador: 'vuelto a borrador', cerrado: 'cerrado' };
      toast.success(`Menu ${labels[estado]}`);
      setModalPublicar(false);
      return true;
    } catch (e) {
      toast.error(e?.message || 'Error al cambiar el estado');
      return false;
    }
  };

  const handleReabrir = async () => {
    const ok = await handleEstado({ estado: 'publicado', extra: { fecha_limite_pedidos: null } });
    if (ok) setConfirmReabrir(false);
  };

  const handleDelete = async () => {
    if (!menuActivo) return;
    try {
      await deleteMut.mutateAsync(menuActivo.id);
      toast.success('Menu eliminado');
      setConfirmDelete(false);
      cerrarDrawer();
    } catch (e) {
      toast.error(e?.message || 'Error al eliminar el menu');
    }
  };

  const handleDuplicar = async (data) => {
    if (!menuActivo) return;
    try {
      await duplicarMut.mutateAsync({ id: menuActivo.id, data });
      toast.success('Semana duplicada');
      setModalDuplicar(false);
    } catch (e) {
      toast.error(e?.message || 'No se pudo duplicar la semana');
    }
  };

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden bg-gray-50">
      {/* Header sticky */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
        <div className="mx-auto max-w-[920px] flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Gestion de menus</p>
            <h1 className="text-2xl font-bold text-gray-900">Menus semanales</h1>
          </div>
          <button onClick={irAHoy} className="shrink-0 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors">
            Hoy
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[920px] px-2 py-4 pb-24 md:px-4">
        {/* Navegacion de mes */}
        <div className="flex items-center justify-between mb-3 px-1">
          <button onClick={prevMes} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors font-bold text-lg">
            &lsaquo;
          </button>
          <h2 className="text-base font-bold text-gray-800">
            {MESES_LARGO[navMonth]} {navYear}
          </h2>
          <button onClick={nextMes} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors font-bold text-lg">
            &rsaquo;
          </button>
        </div>

        {query.isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            {/* Cabecera columnas */}
            <div className="bg-gray-50 border-b border-gray-200"
              style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, minmax(0,1fr))' }}>
              <div className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Semana</div>
              {DIAS_HEADER.map((d, i) => (
                <div key={i} className={`py-2.5 text-[10px] font-semibold uppercase tracking-wide text-center border-l border-gray-200 ${i >= 5 ? 'text-gray-300' : 'text-gray-500'}`}>
                  {d}
                </div>
              ))}
            </div>

            {/* Filas */}
            <div className="divide-y divide-gray-200">
              {semanasVisibles.map(lunes => (
                <FilaSemana
                  key={lunes}
                  lunesIso={lunes}
                  menu={menuByLunes.get(lunes) ?? null}
                  isActiva={semanaActiva === lunes}
                  hoyIso={hoyIso}
                  lunesActual={lunesActual}
                  onClick={() => setSemanaActiva(semanaActiva === lunes ? null : lunes)}
                />
              ))}
            </div>

            {/* Leyenda */}
            <div className="flex flex-wrap gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50">
              {Object.entries(ESTADO_CFG).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1">
                  <span className={`inline-flex text-[8px] font-bold px-1.5 py-px rounded-full border uppercase tracking-wide ${v.chipCls}`}>{v.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1 text-[9px] text-gray-400">
                <div className="w-2 h-2 rounded-full bg-red-300" /> Sin servicio
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SideDrawer */}
      <SideDrawer
        open={Boolean(semanaActiva)}
        onClose={cerrarDrawer}
        title={semanaActiva ? (menuActivo?.nombre ?? nombreSugerido(semanaActiva)) : ''}
        width="lg"
      >
        {semanaActiva && (
          <DrawerContenido
            lunesIso={semanaActiva}
            menu={menuActivo}
            estadoMut={handleEstado}
            estadoPending={estadoMutHook.isPending}
            onPublicar={() => setModalPublicar(true)}
            onReabrir={() => setConfirmReabrir(true)}
            onDuplicar={() => setModalDuplicar(true)}
            onDelete={() => setConfirmDelete(true)}
            totalPedidos={totalPedidos}
            onClose={cerrarDrawer}
          />
        )}
      </SideDrawer>

      <Modal open={modalPublicar} onClose={() => setModalPublicar(false)} title="Publicar menu">
        {menuActivo && (
          <ModalPublicarForm
            menu={menuActivo}
            onConfirm={fl => handleEstado({ estado: 'publicado', extra: { fecha_limite_pedidos: fl } })}
            onCancel={() => setModalPublicar(false)}
            loading={estadoMutHook.isPending}
          />
        )}
      </Modal>

      <Modal open={modalDuplicar} onClose={() => setModalDuplicar(false)} title="Duplicar semana">
        {menuActivo && (
          <ModalDuplicarForm
            menu={menuActivo}
            onConfirm={handleDuplicar}
            onCancel={() => setModalDuplicar(false)}
            loading={duplicarMut.isPending}
          />
        )}
      </Modal>

      <Modal open={confirmReabrir} onClose={() => setConfirmReabrir(false)} title="Reabrir pedidos">
        <p className="text-sm text-gray-700 mb-2">Reabrir <strong>{menuActivo?.nombre}</strong>?</p>
        <p className="text-xs text-gray-500 mb-5">La semana volvera a estar publicada y los empleados podran cargar o modificar pedidos.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmReabrir(false)} className="btn-secondary">Cancelar</button>
          <button onClick={handleReabrir} disabled={estadoMutHook.isPending} className="btn-primary flex items-center gap-1.5">
            {estadoMutHook.isPending && <Spinner size="sm" />}
            Reabrir
          </button>
        </div>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Eliminar menu">
        <p className="text-sm text-gray-700 mb-2">Eliminar <strong>{menuActivo?.nombre}</strong>?</p>
        <p className="text-xs text-gray-500 mb-5">Se eliminaran todos los platos y dias sin servicio asignados a esta semana.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmDelete(false)} className="btn-secondary">Cancelar</button>
          <button onClick={handleDelete} disabled={deleteMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50">
            {deleteMut.isPending && <Spinner size="sm" />}
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
}
