import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMenusSemanales, useCreateMenu, useCambiarEstadoMenu } from '../hooks/useMenus.js';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { toast } from '../lib/toast.js';
import { DIAS_ORDEN as DIAS_SEMANA } from '../lib/dias.js';
import { lunesActualISO } from '../lib/fechas.js';

// ── helpers de fecha ──────────────────────────────────────────────────
const MESES_LARGO  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS_HEADER  = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function soloFecha(str) { return str ? str.split('T')[0] : ''; }
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return localISO(new Date(y, m - 1, d + n));
}
function getLunesActual() {
  return lunesActualISO();
}
function formatCorto(iso) {
  if (!iso) return '—';
  const [, m, d] = soloFecha(iso).split('-');
  return `${parseInt(d)} ${MESES_CORTO[parseInt(m) - 1]}`;
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
  vacio:     { label: 'Sin menu',  accentCls: 'bg-gray-200',   chipCls: 'bg-gray-50 text-gray-500 border-gray-100',      rowTint: '' },
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
            : esFDS ? 'text-gray-500' : 'text-gray-500'
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
            <span className="text-[8px] text-gray-500 leading-none">+{platos.length - 2} más</span>
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
      className={`grid cursor-pointer select-none group transition-colors duration-150
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
          <div className="text-[9px] text-gray-500 leading-tight">
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

// ── Contenido del SideDrawer: solo crear menu para una semana vacia.
// Publicar/Reabrir/Duplicar/Eliminar/fecha limite viven ahora en la vista
// Excel (MenuResumen.jsx) -- el click en una semana CON menu navega directo
// ahi, este drawer ya no se abre para esas semanas (ver onClick en FilaSemana).
function DrawerContenido({ lunesIso, onCreado, onClose }) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre]   = useState('');
  const createMut = useCreateMenu();
  const domingo   = addDias(lunesIso, 6);

  const handleCreate = async () => {
    try {
      const n = nombre.trim() || nombreSugerido(lunesIso);
      const creado = await createMut.mutateAsync({ nombre: n, fecha_inicio: lunesIso, fecha_fin: domingo });
      toast.success('Menu creado');
      setCreando(false);
      setNombre('');
      onCreado(creado?.data?.id ?? creado?.id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-5 flex flex-col items-center justify-center text-center py-12">
      <p className="text-sm font-semibold text-gray-700 mb-1">{formatCorto(lunesIso)} — {formatCorto(domingo)}</p>
      <p className="text-sm text-gray-500 mb-6">No hay menu registrado para esta semana.</p>
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

// ── Componente principal ──────────────────────────────────────────────
export default function Semanas() {
  const navigate     = useNavigate();
  const hoyIso      = localISO(new Date());
  const lunesActual = getLunesActual();
  const hoyDate     = new Date();

  const [navYear,  setNavYear]  = useState(hoyDate.getFullYear());
  const [navMonth, setNavMonth] = useState(hoyDate.getMonth());
  const [semanaActiva, setSemanaActiva] = useState(null);

  const query         = useMenusSemanales({ limit: 200 });
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
  }, [menus, estadoMutHook]);

  const semanasVisibles = useMemo(() => semanasDelMes(navYear, navMonth), [navYear, navMonth]);

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

  const irASemana = (lunes) => {
    const menu = menuByLunes.get(lunes);
    if (menu) {
      navigate(`/semanas/${menu.id}/resumen`);
    } else {
      setSemanaActiva(semanaActiva === lunes ? null : lunes);
    }
  };

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden bg-gray-50">
      {/* Header sticky */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
        <div className="mx-auto max-w-[920px] flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500">Gestión de menús</p>
            <h1 className="text-2xl font-bold text-gray-900">Menús semanales</h1>
          </div>
          <button onClick={irAHoy} className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Semana actual
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
              <div className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Semana</div>
              {DIAS_HEADER.map((d, i) => (
                <div key={i} className={`py-2.5 text-[10px] font-semibold uppercase tracking-wide text-center border-l border-gray-200 ${i >= 5 ? 'text-gray-500' : 'text-gray-500'}`}>
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
                  onClick={() => irASemana(lunes)}
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
              <div className="flex items-center gap-1 text-[9px] text-gray-500">
                <div className="w-2 h-2 rounded-full bg-red-300" /> Sin servicio
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SideDrawer: solo para crear un menu en una semana vacia. Las
          semanas que ya tienen menu navegan directo a la vista Excel
          (irASemana), asi que este drawer nunca las muestra. */}
      <SideDrawer
        open={Boolean(semanaActiva)}
        onClose={cerrarDrawer}
        title={semanaActiva ? nombreSugerido(semanaActiva) : ''}
        width="lg"
      >
        {semanaActiva && (
          <DrawerContenido
            lunesIso={semanaActiva}
            onCreado={(menuId) => { cerrarDrawer(); if (menuId) navigate(`/semanas/${menuId}/resumen`); }}
            onClose={cerrarDrawer}
          />
        )}
      </SideDrawer>
    </div>
  );
}
