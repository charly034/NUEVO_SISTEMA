import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  useSemanaOpciones, useMarcarFijoVianda, useQuitarFijoVianda,
  useMarcarSlotVianda, useQuitarSlotVianda, useSetDisponiblePorKilo,
  useSetFijoDisponiblePorKilo, useSetEmpresasFijo,
  useAgregarGuarnicionSemana, useQuitarGuarnicionSemana, useAgregarSalsaSemana, useQuitarSalsaSemana,
} from '../hooks/useSemanaOpciones.js';
import {
  useMarcarSinServicio, useQuitarSinServicio, useMenuSemanal,
  useCambiarEstadoMenu, useDeleteMenu, useDuplicarMenu, useSetEmpresasSlot, useAgregarPlato, useQuitarPlato,
  useSetGuarnicionSlot, useSetSalsaSlot,
} from '../hooks/useMenus.js';
import { usePedidos } from '../hooks/usePedidos.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import { usePlatos, useCreatePlato, useUpdatePlato } from '../hooks/usePlatos.js';
import { useCreateVianda, useUpdateVianda } from '../hooks/useViandas.js';
import { useGuarniciones, useCreateGuarnicion } from '../hooks/useGuarniciones.js';
import { useSalsas, useCreateSalsa } from '../hooks/useSalsas.js';
import {
  useCategorias, useDeleteMenuItem, useReasignarMenuItem, useAgregarItemCategoria,
  useExcepcionesEmpresa, useGuardarExcepcionEmpresa, useBorrarExcepcionEmpresa,
} from '../hooks/useCategorias.js';
import Spinner from '../components/ui/Spinner.jsx';
import Modal from '../components/ui/Modal.jsx';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import GestionCategorias from '../components/categorias/GestionCategorias.jsx';
import { pedirTexto, confirmarAccion, confirmar } from '../lib/confirm.js';
import { toast } from '../lib/toast.js';
import { DIAS_ORDEN, DIA_ABREV, DIA_NOMBRE } from '../lib/dias.js';
import { addDiasISO, fechaISOEnZona, formatFechaCorta, formatFechaLarga } from '../lib/fechas.js';

const SALSA_MODOS = [
  { value: 'sin_salsa', label: 'Sin salsa' },
  { value: 'fija', label: 'Salsa fija' },
  { value: 'libre', label: 'A elección' },
];

const ESTADO_CFG = {
  borrador:  { label: 'Borrador',  chipCls: 'bg-gray-100 text-gray-600 border-gray-200' },
  publicado: { label: 'Publicado', chipCls: 'bg-green-100 text-green-700 border-green-200' },
  cerrado:   { label: 'Cerrado',   chipCls: 'bg-orange-100 text-orange-700 border-orange-200' },
};

function soloFecha(str) { return str ? String(str).slice(0, 10) : ''; }

function esSemanaCursada(fechaInicioISO, estado) {
  if (!['cerrado', 'publicado'].includes(estado)) return false;
  return addDiasISO(fechaInicioISO, 6) < fechaISOEnZona();
}

function nombreSugerido(lunesIso) {
  const fin = addDiasISO(lunesIso, 6);
  const [, lm, ld] = lunesIso.split('-');
  const [, dm, dd] = fin.split('-');
  return `Semana del ${parseInt(ld, 10)}/${parseInt(lm, 10)} al ${parseInt(dd, 10)}/${parseInt(dm, 10)}`;
}

// ── Modales de acciones (movidos desde Semanas.jsx: ahora que el click en
// una semana navega directo acá, este es el único lugar donde tienen sentido) ──
function ModalPublicarForm({ menu, onConfirm, onCancel, loading }) {
  const [fecha, setFecha] = useState('');
  const [hora, setHora]   = useState('10:00');
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Publicar <strong>{menu?.nombre}</strong> lo hara visible para que los empleados puedan hacer su pedido.</p>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Fecha límite de pedidos <span className="font-normal text-gray-500">(opcional)</span>
        </label>
        <div className="flex gap-2">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          <input type="time" value={hora} onChange={e => setHora(e.target.value)}
            className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <p className="text-xs text-gray-500 mt-1.5">Sin fecha: los pedidos quedan abiertos hasta cerrarlos manualmente.</p>
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
  const lunesBase    = soloFecha(menu?.fecha_inicio);
  const lunesInicial = addDiasISO(lunesBase, 7);
  const [fechaInicio, setFechaInicio] = useState(lunesInicial);
  const [nombre, setNombre]           = useState(nombreSugerido(lunesInicial));
  const fechaFin = addDiasISO(fechaInicio, 6);
  const cambiarFecha = v => { setFechaInicio(v); setNombre(nombreSugerido(v)); };

  return (
    <form onSubmit={e => { e.preventDefault(); onConfirm({ nombre, fecha_inicio: fechaInicio, fecha_fin: fechaFin }); }} className="space-y-4">
      <p className="text-sm text-gray-600">Se copiaran platos, opciones y dias sin servicio de <strong>{menu?.nombre}</strong> a una nueva semana en borrador.</p>
      <label className="block">
        <span className="block text-sm font-semibold text-gray-700 mb-1">Lunes de destino</span>
        <input type="date" value={fechaInicio} onChange={e => cambiarFecha(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" required />
      </label>
      <label className="block">
        <span className="block text-sm font-semibold text-gray-700 mb-1">Nombre</span>
        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" required />
      </label>
      <p className="text-xs text-gray-500">Rango: {formatFechaCorta(fechaInicio)} &mdash; {formatFechaCorta(fechaFin)}</p>
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

// ── Barra de acciones (Publicar/Reabrir/Duplicar/Eliminar + fecha limite) ──
function BarraAcciones({ id, menu, totalPedidos }) {
  const [modalPublicar,  setModalPublicar]  = useState(false);
  const [modalDuplicar,  setModalDuplicar]  = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [confirmReabrir, setConfirmReabrir] = useState(false);
  const [editandoFecha, setEditandoFecha]   = useState(false);
  const [fechaLimite, setFechaLimite]       = useState('');
  const [horaLimite, setHoraLimite]         = useState('10:00');

  const estadoMutHook = useCambiarEstadoMenu();
  const deleteMut     = useDeleteMenu();
  const duplicarMut   = useDuplicarMenu();

  const handleEstado = async ({ estado, extra = {} }) => {
    try {
      await estadoMutHook.mutateAsync({ id, estado, extra });
      const labels = { publicado: menu.estado === 'cerrado' ? 'reabierto' : 'publicado', borrador: 'vuelto a borrador', cerrado: 'cerrado' };
      toast.success(`Menu ${labels[estado]}`);
      setModalPublicar(false);
      return true;
    } catch (e) {
      toast.error(e?.message || 'Error al cambiar el estado');
      return false;
    }
  };

  const handlePublicar = (fechaLim) => handleEstado({ estado: 'publicado', extra: { fecha_limite_pedidos: fechaLim ?? null } });

  const handleReabrir = async () => {
    const ok = await handleEstado({ estado: 'publicado', extra: { fecha_limite_pedidos: null } });
    if (ok) setConfirmReabrir(false);
  };

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync(id);
      toast.success('Menu eliminado');
      setConfirmDelete(false);
    } catch (e) {
      toast.error(e?.message || 'Error al eliminar el menu');
    }
  };

  const handleDuplicar = async (data) => {
    try {
      await duplicarMut.mutateAsync({ id, data });
      toast.success('Semana duplicada');
      setModalDuplicar(false);
    } catch (e) {
      toast.error(e?.message || 'No se pudo duplicar la semana');
    }
  };

  const { estado, fecha_inicio, fecha_fin, fecha_limite_pedidos } = menu;
  const fechaLimiteStr = fecha_limite_pedidos
    ? new Date(fecha_limite_pedidos).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;
  const estadoPending = estadoMutHook.isPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className={`inline-flex text-[10px] font-bold px-1.5 py-px rounded-full border uppercase tracking-wide ${ESTADO_CFG[estado]?.chipCls}`}>
          {ESTADO_CFG[estado]?.label ?? estado}
        </span>
        {fechaLimiteStr && estado === 'publicado' && <span className="text-amber-600 font-medium">Pedidos hasta: {fechaLimiteStr}</span>}
        {totalPedidos > 0 && <span className="text-blue-600 font-semibold">{totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''} registrado{totalPedidos !== 1 ? 's' : ''}</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {estado === 'borrador' && (
          <button onClick={() => setModalPublicar(true)} disabled={estadoPending} className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50">
            Publicar
          </button>
        )}
        {estado === 'cerrado' && (
          <button onClick={() => setConfirmReabrir(true)} disabled={estadoPending} className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50">
            Reabrir pedidos
          </button>
        )}
        <button onClick={() => setModalDuplicar(true)} className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          Duplicar
        </button>
        {esSemanaCursada(soloFecha(fecha_inicio), estado) && (
          <Link to={`/estadisticas?desde=${soloFecha(fecha_inicio)}&hasta=${soloFecha(fecha_fin)}`}
            className="rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100 transition-colors">
            Ver estadisticas
          </Link>
        )}
        {estado === 'publicado' && (
          <button onClick={() => handleEstado({ estado: 'cerrado' })} disabled={estadoPending}
            className="rounded-lg border border-orange-200 bg-orange-50 px-3.5 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50">
            Cerrar pedidos
          </button>
        )}
        {estado === 'publicado' && (
          <button onClick={() => handleEstado({ estado: 'borrador' })} disabled={estadoPending}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">
            Volver a borrador
          </button>
        )}
        {estado === 'borrador' && (
          <button onClick={() => setConfirmDelete(true)} className="rounded-lg border border-red-100 bg-white px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors">
            Eliminar
          </button>
        )}
      </div>

      {estado === 'publicado' && (
        <div className="max-w-md">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-semibold text-gray-600">Fecha límite de pedidos:</span>
            <span className="text-gray-500">
              {fechaLimiteStr ? fechaLimiteStr : 'sin límite (pedidos abiertos)'}
            </span>
            <button type="button" onClick={() => setEditandoFecha(v => !v)}
              className="font-semibold text-brand-600 hover:underline">
              {editandoFecha ? 'Cancelar' : fechaLimiteStr ? 'Editar' : 'Agregar'}
            </button>
          </div>
          {editandoFecha && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input type="time" value={horaLimite} onChange={e => setHoraLimite(e.target.value)}
                  className="w-24 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={estadoPending}
                  onClick={async () => {
                    const fl = fechaLimite ? `${fechaLimite}T${horaLimite}:00` : null;
                    await handleEstado({ estado: 'publicado', extra: { fecha_limite_pedidos: fl } });
                    setEditandoFecha(false);
                  }}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  Guardar
                </button>
                {fechaLimiteStr && (
                  <button type="button" disabled={estadoPending}
                    onClick={async () => {
                      await handleEstado({ estado: 'publicado', extra: { fecha_limite_pedidos: null } });
                      setEditandoFecha(false);
                    }}
                    className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors">
                    Quitar fecha
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={modalPublicar} onClose={() => setModalPublicar(false)} title="Publicar menu">
        <ModalPublicarForm menu={menu} onConfirm={handlePublicar} onCancel={() => setModalPublicar(false)} loading={estadoPending} />
      </Modal>

      <Modal open={modalDuplicar} onClose={() => setModalDuplicar(false)} title="Duplicar semana">
        <ModalDuplicarForm menu={menu} onConfirm={handleDuplicar} onCancel={() => setModalDuplicar(false)} loading={duplicarMut.isPending} />
      </Modal>

      <Modal open={confirmReabrir} onClose={() => setConfirmReabrir(false)} title="Reabrir pedidos">
        <p className="text-sm text-gray-700 mb-2">Reabrir <strong>{menu.nombre}</strong>?</p>
        <p className="text-xs text-gray-500 mb-5">La semana volvera a estar publicada y los empleados podran cargar o modificar pedidos.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmReabrir(false)} className="btn-secondary">Cancelar</button>
          <button onClick={handleReabrir} disabled={estadoPending} className="btn-primary flex items-center gap-1.5">
            {estadoPending && <Spinner size="sm" />}
            Reabrir
          </button>
        </div>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Eliminar menu">
        <p className="text-sm text-gray-700 mb-2">Eliminar <strong>{menu.nombre}</strong>?</p>
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

// ── Toggle sin servicio (compacto, vive en el header de cada columna) ──
function ToggleSinServicio({ dia, marcar, quitar }) {
  const onMarcar = async () => {
    const motivo = await pedirTexto({ titulo: `Marcar ${DIA_NOMBRE[dia.dia]} sin servicio`, placeholder: 'Motivo (opcional, ej: Feriado)' });
    if (motivo === null) return;
    marcar.mutate(
      { dia: dia.dia, motivo: motivo || undefined },
      {
        onSuccess: () => toast.success(`${DIA_NOMBRE[dia.dia]} marcado sin servicio`),
        onError: (e) => toast.error(e?.message || 'No se pudo marcar sin servicio'),
      }
    );
  };

  const onQuitar = async () => {
    const ok = await confirmarAccion({ titulo: `¿Quitar sin servicio de ${DIA_NOMBRE[dia.dia]}?`, botonConfirmar: 'Quitar' });
    if (!ok) return;
    quitar.mutate(dia.dia, {
      onSuccess: () => toast.success('Día habilitado de nuevo'),
      onError: (e) => toast.error(e?.message || 'No se pudo quitar sin servicio'),
    });
  };

  if (dia.sin_servicio) {
    return (
      <button type="button" onClick={onQuitar} title={dia.motivo_sin_servicio || 'Sin servicio'}
        className="text-[9px] font-bold uppercase text-red-500 hover:text-red-700 hover:underline tracking-wide">
        {dia.motivo_sin_servicio || 'Sin servicio'}
      </button>
    );
  }
  return (
    <button type="button" onClick={onMarcar} className="text-[9px] text-gray-300 hover:text-red-500 hover:underline">
      Marcar sin servicio
    </button>
  );
}

// ── Código de color de celda: combina vianda_activa + disponible_por_kilo ──
function colorCeldaCls(item) {
  const v = item.vianda_activa;
  const k = item.disponible_por_kilo;
  if (v && k) return 'bg-purple-50 hover:bg-purple-100';
  if (v) return 'bg-emerald-50 hover:bg-emerald-100';
  if (k) return 'bg-blue-50 hover:bg-blue-100';
  return 'bg-white hover:bg-gray-50';
}

// Mismo código de color pero para chips (borde + texto del mismo tono).
function chipColorCls(item) {
  const v = item.vianda_activa;
  const k = item.disponible_por_kilo;
  if (v && k) return 'bg-purple-50 border-purple-200 text-purple-800';
  if (v) return 'bg-emerald-50 border-emerald-200 text-emerald-800';
  if (k) return 'bg-blue-50 border-blue-200 text-blue-800';
  return 'bg-white border-gray-200 text-gray-700';
}

function Leyenda() {
  const items = [
    { cls: 'bg-emerald-50 border-emerald-200', label: 'Vianda' },
    { cls: 'bg-blue-50 border-blue-200', label: 'Por kilo' },
    { cls: 'bg-purple-50 border-purple-200', label: 'Ambos' },
    { cls: 'bg-white border-gray-200', label: 'Ninguno' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
      <span className="font-semibold text-gray-600">Se ofrece como:</span>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className={`inline-block w-3 h-3 rounded border ${it.cls}`} />
          {it.label}
        </div>
      ))}
    </div>
  );
}

// ── Contenido de una celda: clickeable, color de fondo segun estado --
// ancho fijo (via table-fixed + colgroup en TablaSemana) y alto fijo (h-14
// + line-clamp en el texto) para que toda la grilla quede pareja ──
function CeldaMenu({ item, onAbrir, onAgregar }) {
  if (!item) {
    if (!onAgregar) return <td className="border border-gray-100 p-1.5 h-14" />;
    return (
      <td className="border border-gray-100 p-0 h-14">
        <button
          type="button"
          onClick={onAgregar}
          title="Agregar menú"
          className="w-full h-full flex items-center justify-center text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors text-base"
        >
          +
        </button>
      </td>
    );
  }
  return (
    <td className="border border-gray-100 p-0 align-top h-14">
      <button
        type="button"
        onClick={() => onAbrir(item)}
        className={`w-full h-full text-left p-1.5 transition-colors ${colorCeldaCls(item)}`}
      >
        <p className="text-xs text-gray-800 line-clamp-2 overflow-hidden">
          {item.nombre_vianda || item.plato_nombre}
          {item.grupo_nombre && <span className="block text-[10px] text-gray-400">{item.grupo_nombre}</span>}
        </p>
      </button>
    </td>
  );
}

function EtiquetaGrupo({ children, rowSpan, colorCls, onAgregarFila, onConfigurar }) {
  return (
    <th rowSpan={rowSpan} className={`border border-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-left align-top whitespace-nowrap ${colorCls}`}>
      <div className="flex flex-col gap-1 py-0.5">
        {onConfigurar ? (
          <button type="button" onClick={onConfigurar} title="Configurar categoría" className="text-left uppercase font-bold hover:underline flex items-center gap-1">
            {children}
            <span className="opacity-50 normal-case font-normal">⚙</span>
          </button>
        ) : (
          <span>{children}</span>
        )}
        {onAgregarFila && (
          <button type="button" onClick={onAgregarFila} className="normal-case font-semibold text-emerald-700 hover:underline text-left">
            + fila
          </button>
        )}
      </div>
    </th>
  );
}

function siguienteLetraLibre(letrasUsadas) {
  for (let i = 0; i < 26; i++) {
    const letra = String.fromCharCode(65 + i);
    if (!letrasUsadas.has(letra)) return letra;
  }
  return null;
}

// Selector de "Visible para" con estado local propio -- se remonta limpio (via
// `key` en el llamador) en cada celda. Por defecto está marcado "Todas las
// empresas" (empresa_ids vacío = visible para todas). Para restringir a algunas,
// se destilda "Todas" y recién ahí se habilitan los checkboxes individuales.
function SelectorEmpresas({ empresas, initialIds, onGuardar, guardando, nota }) {
  const inicial = initialIds || [];
  const [todas, setTodas] = useState(inicial.length === 0);
  const [empresaIds, setEmpresaIds] = useState(inicial);

  const toggleTodas = () => {
    setTodas((prev) => {
      const siguiente = !prev;
      if (siguiente) setEmpresaIds([]); // volver a "todas" limpia la selección
      return siguiente;
    });
  };

  const toggleEmpresa = (empresaId) => {
    setEmpresaIds((prev) => (prev.includes(empresaId) ? prev.filter((x) => x !== empresaId) : [...prev, empresaId]));
  };

  const puedeGuardar = todas || empresaIds.length > 0;
  const actualIds = todas ? [] : empresaIds;
  const dirty = !mismosIds(actualIds, inicial);

  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-800 mb-2">Visible para</p>

      <label className="flex items-center gap-2 text-sm text-gray-800 mb-2">
        <input type="checkbox" checked={todas} onChange={toggleTodas} />
        <span className="font-medium">Todas las empresas</span>
      </label>

      <div className={`space-y-1.5 max-h-48 overflow-y-auto pl-1 ${todas ? 'opacity-40' : ''}`}>
        {(empresas || []).map((emp) => (
          <label key={emp.id} className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" disabled={todas} checked={empresaIds.includes(emp.id)} onChange={() => toggleEmpresa(emp.id)} />
            {emp.nombre}
          </label>
        ))}
      </div>

      {!todas && empresaIds.length === 0 && (
        <p className="text-xs text-amber-600 mt-2">Seleccioná al menos una empresa (o volvé a marcar "Todas").</p>
      )}
      {nota && <p className="text-xs text-gray-400 mt-2">{nota}</p>}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onGuardar(todas ? [] : empresaIds)}
          disabled={guardando || !puedeGuardar || !dirty}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {guardando && <Spinner size="sm" />}
          Guardar visibilidad
        </button>
        {dirty && <span className="text-xs font-medium text-amber-600">Cambios sin guardar</span>}
      </div>
    </div>
  );
}

// Especiales/custom: la visibilidad se ancla al slot (dia, opcion).
function EmpresasEditor({ menuId, dia, opcion, empresas, initialIds }) {
  const setEmpresasSlot = useSetEmpresasSlot(menuId);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (empresa_ids) => {
    setGuardando(true);
    try {
      await setEmpresasSlot.mutateAsync({ dia, opcion, empresa_ids });
      toast.success('Visibilidad actualizada');
    } catch (e) {
      toast.error(e?.message || 'No se pudo actualizar la visibilidad');
    } finally {
      setGuardando(false);
    }
  };

  return <SelectorEmpresas empresas={empresas} initialIds={initialIds} onGuardar={guardar} guardando={guardando} />;
}

// Fijos: la visibilidad se ancla a (menuId, platoId) -- un fijo no tiene slot
// propio en menu_semanal_dias. Decisión de esta semana, no del catálogo.
function EmpresasEditorFijo({ menuId, platoId, empresas, initialIds }) {
  const setEmpresasFijo = useSetEmpresasFijo(menuId);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (empresa_ids) => {
    setGuardando(true);
    try {
      await setEmpresasFijo.mutateAsync({ platoId, empresa_ids });
      toast.success('Visibilidad actualizada');
    } catch (e) {
      toast.error(e?.message || 'No se pudo actualizar la visibilidad');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SelectorEmpresas
      empresas={empresas}
      initialIds={initialIds}
      onGuardar={guardar}
      guardando={guardando}
      nota="Decisión de esta semana, no del catálogo."
    />
  );
}

// Colapsa opciones con el mismo nombre normalizado. El catálogo tiene duplicados
// casi idénticos ("Puré de papas" / "Puré de Papas", "Ensalada Rusa" / "Ensalada
// rusa"): mostrar los dos hace que el admin elija mal. Se deja una sola por nombre,
// prefiriendo el id ya seleccionado (para no vaciar el select de un dato existente)
// y, si no, el id más bajo (el canónico/original del sistema). NOTA: es un parche de
// presentación; la limpieza real del catálogo (mergear ids y repuntar referencias)
// es una tarea de datos aparte.
// Switch on/off accesible reutilizable (por-kilo, vianda, etc.). `color` es la clase
// de fondo cuando está activo.
function ToggleSwitch({ checked, onChange, disabled = false, color = 'bg-emerald-500', label }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-label={label}
      className={`shrink-0 relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${checked ? color : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

// Comparación de dos listas de ids como conjuntos (orden-independiente).
const mismosIds = (a, b) => JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify([...b].sort((x, y) => x - y));

function dedupPorNombre(items, mantenerId = null) {
  const idActual = mantenerId != null && mantenerId !== '' ? Number(mantenerId) : null;
  const porNombre = new Map();
  for (const it of items) {
    const clave = (it.nombre || '').trim().toLowerCase();
    const previo = porNombre.get(clave);
    if (!previo || it.id === idActual || (previo.id !== idActual && it.id < previo.id)) {
      porNombre.set(clave, it);
    }
  }
  return [...porNombre.values()].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
}

// Editor de guarnicion/salsa de la vianda ya activa de este item -- se
// remonta (via `key` en el llamador) cada vez que cambia el item o su
// vianda_id, para arrancar siempre con el estado guardado real y no con el
// de la vianda anterior. Solo actualiza (nunca crea): si el item tiene
// vianda_activa=true, vianda_id siempre existe (lo garantiza el toggle de
// arriba, que crea una vianda general antes de anclar si hacia falta).
function ComposicionViandaEditor({ item, embedded = false }) {
  const actualizarVianda = useUpdateVianda();
  const { data: guarniciones = [] } = useGuarniciones();
  const { data: salsas = [] } = useSalsas();

  const salsaModoInicial = item.salsa_id ? 'fija' : (item.salsa_libre ? 'libre' : 'sin_salsa');
  const [guarnicionId, setGuarnicionId] = useState(item.guarnicion_id ?? '');
  const [salsaModo, setSalsaModo] = useState(salsaModoInicial);
  const [salsaId, setSalsaId] = useState(item.salsa_id ?? '');

  const guarnOpts = dedupPorNombre(guarniciones, guarnicionId);
  const salsaOpts = dedupPorNombre(salsas, salsaId);

  // "Sin guardar" visible: cambios locales que todavía no se persistieron. Evita la
  // pérdida silenciosa al cerrar el drawer sin apretar Guardar.
  const dirty = String(guarnicionId) !== String(item.guarnicion_id ?? '')
    || salsaModo !== salsaModoInicial
    || (salsaModo === 'fija' && String(salsaId) !== String(item.salsa_id ?? ''));

  const guardar = async () => {
    try {
      await actualizarVianda.mutateAsync({
        id: item.vianda_id,
        data: {
          guarnicion_id: guarnicionId ? Number(guarnicionId) : null,
          salsa_id: salsaModo === 'fija' ? Number(salsaId) : null,
          salsa_libre: salsaModo === 'libre',
        },
      });
      toast.success('Composición de la vianda actualizada');
    } catch (e) {
      toast.error(e?.message || 'No se pudo actualizar la composición');
    }
  };

  return (
    <div className={embedded ? 'p-4 space-y-3' : 'rounded-lg border border-gray-100 p-4 space-y-3'}>
      <p className="text-sm font-semibold text-gray-800">Configurar vianda</p>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Guarnición</label>
        <select
          value={guarnicionId}
          onChange={(e) => setGuarnicionId(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Sin guarnición fija</option>
          {guarnOpts.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Salsa</label>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 mb-2">
          {SALSA_MODOS.map((modo) => (
            <button
              key={modo.value}
              type="button"
              onClick={() => setSalsaModo(modo.value)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                salsaModo === modo.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {modo.label}
            </button>
          ))}
        </div>
        {salsaModo === 'fija' && (
          <select
            value={salsaId}
            onChange={(e) => setSalsaId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Seleccioná una salsa...</option>
            {salsaOpts.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={actualizarVianda.isPending || !dirty || (salsaModo === 'fija' && !salsaId)}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {actualizarVianda.isPending && <Spinner size="sm" />}
          Guardar composición
        </button>
        {dirty && <span className="text-xs font-medium text-amber-600">Cambios sin guardar</span>}
      </div>
    </div>
  );
}

// Reasignar la categoría de una celda (o mandarla a "Sin categorizar") y
// borrarla puntualmente. Solo aplica a celdas slot (filas de menu_semanal_dias).
function ReasignarYBorrar({ menuId, item, onClose, embedded = false }) {
  const { data: categorias = [] } = useCategorias();
  const reasignar = useReasignarMenuItem(menuId);
  const deleteItem = useDeleteMenuItem(menuId);
  const opciones = (categorias || []).filter((c) => c.tipo_dato === 'platos');

  const onReasignar = (e) => {
    const val = e.target.value;
    const categoria_id = val === '' ? null : Number(val);
    reasignar.mutate({ itemId: item.slot_id, categoria_id }, {
      onSuccess: () => toast.success('Categoría actualizada'),
      onError: (er) => toast.error(er?.message || 'No se pudo reasignar'),
    });
  };

  const onBorrar = async () => {
    const ok = await confirmar({
      titulo: `¿Borrar "${item.plato_nombre}" de esta celda?`,
      texto: 'Se quita solo esta celda del menú de la semana; el plato del catálogo no se toca.',
      botonConfirmar: 'Borrar',
    });
    if (!ok) return;
    deleteItem.mutate(item.slot_id, {
      onSuccess: () => { toast.success('Celda borrada'); onClose(); },
      onError: (er) => toast.error(er?.message || 'No se pudo borrar'),
    });
  };

  return (
    <div className={embedded ? 'space-y-3' : 'rounded-lg border border-gray-100 p-4 space-y-3'}>
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Categoría</label>
        <select
          value={item.categoria_id ?? ''}
          onChange={onReasignar}
          disabled={reasignar.isPending}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Sin categorizar</option>
          {opciones.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <button
        type="button"
        onClick={onBorrar}
        disabled={deleteItem.isPending}
        className="w-full rounded-lg border border-red-100 bg-white px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
      >
        {deleteItem.isPending && <Spinner size="sm" />}
        Borrar esta celda del menú
      </button>
    </div>
  );
}

// ── Drawer de detalle: vianda si/no (con editor de composicion), venta por
// kilo, y (solo especiales) para que empresas es visible ──
// Cascada legible (T7/B1): muestra el valor EFECTIVO de guarnicion/salsa y de que
// capa sale. La procedencia la resuelve el backend en el mismo SQL que el modo
// (semana-opciones): el front no reimplementa la cascada, solo la muestra -- si la
// recalculara, seria otra copia que se desincroniza justo en la capa cuyo unico
// trabajo es no mentir sobre el origen.
const PROCEDENCIA_CHIP = {
  celda: { label: 'Pisado esta semana', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  vianda: { label: 'De la vianda', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  plato: { label: 'Default del plato', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  ninguna: { label: 'Sin definir', cls: 'bg-gray-50 text-gray-400 border-gray-200' },
};

function textoGuarnicion(item) {
  if (item.guarnicion_modo === 'fija') {
    return item.guarnicion_efectiva_nombre
      ? `Con guarnición fija: ${item.guarnicion_efectiva_nombre}`
      : 'Con guarnición fija (sin definir)';
  }
  if (item.guarnicion_modo === 'libre') return 'Guarnición a elección del cliente';
  return 'Sin guarnición';
}

function textoSalsa(item) {
  if (item.salsa_modo === 'fija') {
    return item.salsa_efectiva_nombre
      ? `Con salsa fija: ${item.salsa_efectiva_nombre}`
      : 'Con salsa fija (sin definir)';
  }
  if (item.salsa_modo === 'libre') return 'Salsa a elección del cliente';
  return 'Sin salsa';
}

function FilaProcedencia({ titulo, texto, procedencia }) {
  const chip = PROCEDENCIA_CHIP[procedencia] ?? PROCEDENCIA_CHIP.ninguna;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-gray-400">{titulo}</p>
        <p className="text-sm font-medium text-gray-900 mt-0.5">{texto}</p>
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>
        {chip.label}
      </span>
    </div>
  );
}

function ProcedenciaCard({ item, embedded = false }) {
  // Solo celdas slot (especiales/custom) traen la resolucion del backend; los fijos
  // se computan por otro camino y todavia no la exponen en este payload.
  if (!item?.guarnicion_modo) return null;

  const esCompuesto = item.guarnicion_procedencia === 'vianda' && item.guarnicion_modo === 'fija';
  const excepciones = item.excepciones_empresas ?? 0;
  const stale = item.excepciones_stale ?? 0;

  return (
    <div className={embedded ? 'p-4 space-y-3' : 'rounded-lg border border-gray-100 p-4 space-y-3'}>
      <FilaProcedencia titulo="Guarnición" texto={textoGuarnicion(item)} procedencia={item.guarnicion_procedencia} />
      <FilaProcedencia titulo="Salsa" texto={textoSalsa(item)} procedencia={item.salsa_procedencia} />

      {esCompuesto && (
        <p className="text-xs text-gray-500">
          Menú compuesto: la vianda ya trae la guarnición armada. Se puede pisar solo para esta semana.
        </p>
      )}

      {(excepciones > 0 || stale > 0) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {excepciones > 0 && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              +{excepciones} {excepciones === 1 ? 'empresa distinta' : 'empresas distintas'}
            </span>
          )}
          {stale > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              {stale} {stale === 1 ? 'excepción desactualizada' : 'excepciones desactualizadas'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const nombrePorId = (lista, id) => (id ? (lista.find((x) => x.id === Number(id))?.nombre ?? null) : null);

// Bloque unificado Guarnición + Salsa + Excepciones con UN solo Guardar/Cancelar
// (rediseño del mockup). Diferencia clave frente al editor viejo: acá "pisar solo
// esta semana" setea el OVERRIDE DE CELDA (menu_semanal_dias, por semana), no la
// vianda (que es la base para todas las semanas). El valor efectivo de cada dimensión
// se muestra con su procedencia; las excepciones por empresa van inline, con la fila
// "Las demás → base". Solo para especiales (celdas slot con opción).
function CeldaComposicionUnificada({ celda, menuId, empresas, excepcionesIniciales, onClose }) {
  const item = celda.item;
  const { data: guarniciones = [] } = useGuarniciones();
  const { data: salsas = [] } = useSalsas();
  const setGuarnicionSlot = useSetGuarnicionSlot(menuId);
  const setSalsaSlot = useSetSalsaSlot(menuId);
  const guardarExc = useGuardarExcepcionEmpresa(menuId, item.slot_id);
  const borrarExc = useBorrarExcepcionEmpresa(menuId, item.slot_id);
  const setPorKilo = useSetDisponiblePorKilo(menuId);
  const setEmpresasSlot = useSetEmpresasSlot(menuId);
  const reasignar = useReasignarMenuItem(menuId);
  const deleteItem = useDeleteMenuItem(menuId);
  const { data: categorias = [] } = useCategorias();
  const categoriasPlatos = (categorias || []).filter((c) => c.tipo_dato === 'platos');

  // Estado inicial del override de celda: si la procedencia guardada es 'celda' hay
  // override; si no, no hay (queda '' = "de la vianda").
  const gModoIni = item.guarnicion_procedencia === 'celda' ? item.guarnicion_modo : '';
  const gIdIni = item.guarnicion_procedencia === 'celda' ? (item.guarnicion_efectiva_id ?? '') : '';
  const sModoIni = item.salsa_procedencia === 'celda' ? item.salsa_modo : '';
  const sIdIni = item.salsa_procedencia === 'celda' ? (item.salsa_efectiva_id ?? '') : '';

  const [gModo, setGModo] = useState(gModoIni);
  const [gId, setGId] = useState(gIdIni);
  const [sModo, setSModo] = useState(sModoIni);
  const [sId, setSId] = useState(sIdIni);
  const [pisandoG, setPisandoG] = useState(false);
  const [pisandoS, setPisandoS] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Excepciones como borrador local (se persisten al Guardar, no al instante).
  const excIni = (excepcionesIniciales || []).map((e) => ({
    empresa_id: e.empresa_id, empresa_nombre: e.empresa_nombre, stale: e.stale,
    g_modo: e.guarnicion_modo_override ?? '', g_id: e.guarnicion_fija_override_id ?? '',
    s_modo: e.salsa_modo_override ?? '', s_id: e.salsa_fija_override_id ?? '',
  }));
  const [exc, setExc] = useState(excIni);
  const [nuevaEmpresa, setNuevaEmpresa] = useState('');

  // Otros campos plegados al mismo Guardar: por-kilo, visibilidad, categoría.
  const visIni = item.visible_empresa_ids || [];
  const [porKilo, setPorKiloDraft] = useState(Boolean(item.disponible_por_kilo));
  const [todas, setTodas] = useState(visIni.length === 0);
  const [empresaIds, setEmpresaIds] = useState(visIni);
  const [categoriaId, setCategoriaId] = useState(item.categoria_id ?? '');

  // ── Texto efectivo (según el borrador) ──────────────────────────────────────
  const baseGuarnicionTexto = item.guarnicion_id
    ? (nombrePorId(guarniciones, item.guarnicion_id) ?? 'guarnición de la vianda')
    : 'a elección del cliente';
  const baseSalsaTexto = item.salsa_id
    ? (nombrePorId(salsas, item.salsa_id) ?? 'salsa de la vianda')
    : (item.salsa_libre ? 'a elección del cliente' : 'sin salsa');

  // Texto + chip efectivo de una dimensión según el override de celda del borrador.
  // sinLabel es "Sin guarnición" / "Sin salsa"; baseTexto es lo que trae la vianda.
  const efectivo = (modo, id, lista, sinLabel, baseTexto) => {
    if (modo === 'fija') return { txt: nombrePorId(lista, id) ?? 'Fija (elegí cuál)', chip: 'Pisado esta semana', pisado: true };
    if (modo === 'libre') return { txt: 'A elección del cliente', chip: 'Pisado esta semana', pisado: true };
    if (modo === 'sin_guarnicion' || modo === 'sin_salsa') return { txt: sinLabel, chip: 'Pisado esta semana', pisado: true };
    return { txt: baseTexto, chip: 'De la vianda', pisado: false };
  };
  const guarnicionEfectiva = () => efectivo(gModo, gId, guarniciones, 'Sin guarnición', baseGuarnicionTexto);
  const salsaEfectiva = () => efectivo(sModo, sId, salsas, 'Sin salsa', baseSalsaTexto);

  // ── Dirty + validez ─────────────────────────────────────────────────────────
  const norm = (l) => JSON.stringify(l.map((e) => [e.empresa_id, e.g_modo, String(e.g_id), e.s_modo, String(e.s_id)]).sort());
  const visActuales = todas ? [] : empresaIds;
  const visDirty = !mismosIds(visActuales, visIni);
  const dirty = String(gModo) !== String(gModoIni) || String(gId) !== String(gIdIni)
    || String(sModo) !== String(sModoIni) || String(sId) !== String(sIdIni)
    || norm(exc) !== norm(excIni)
    || porKilo !== Boolean(item.disponible_por_kilo)
    || visDirty
    || String(categoriaId) !== String(item.categoria_id ?? '');
  const gInvalido = gModo === 'fija' && !gId;
  const sInvalido = sModo === 'fija' && !sId;
  const excInvalida = exc.some((e) => (!e.g_modo && !e.s_modo) || (e.g_modo === 'fija' && !e.g_id) || (e.s_modo === 'fija' && !e.s_id));
  const visInvalida = !todas && empresaIds.length === 0;
  const puedeGuardar = dirty && !gInvalido && !sInvalido && !excInvalida && !visInvalida && !guardando;

  const visibles = (item.visible_empresa_ids?.length
    ? empresas.filter((e) => item.visible_empresa_ids.includes(e.id))
    : empresas).filter((e) => e.activo);
  const disponibles = visibles.filter((e) => !exc.some((x) => x.empresa_id === e.id));

  const setExcCampo = (empresaId, campo, valor) => setExc((prev) => prev.map((e) => {
    if (e.empresa_id !== empresaId) return e;
    const n = { ...e, [campo]: valor };
    if (campo === 'g_modo' && valor !== 'fija') n.g_id = '';
    if (campo === 's_modo' && valor !== 'fija') n.s_id = '';
    return n;
  }));

  const agregarExc = () => {
    if (!nuevaEmpresa) return;
    const emp = empresas.find((e) => e.id === Number(nuevaEmpresa));
    setExc((prev) => [...prev, { empresa_id: emp.id, empresa_nombre: emp.nombre, g_modo: 'sin_guarnicion', g_id: '', s_modo: '', s_id: '', _nueva: true }]);
    setNuevaEmpresa('');
  };

  // Cancelar descarta el borrador cerrando el drawer (se remonta limpio en el próximo
  // abrir). Guardar también cierra al terminar: evita el "sin guardar" pegado por no
  // re-inicializar el baseline, y da la semántica clásica de footer Guardar/Cancelar.
  const cancelar = () => onClose?.();

  const guardar = async () => {
    setGuardando(true);
    // Sin transacción del lado servidor (son endpoints independientes), así que se
    // arman todas las operaciones que cambiaron y se corren CONTINUANDO ante error: una
    // falla no debe dejar sin aplicar los demás cambios. Se junta el detalle para
    // avisar cuántos fallaron. Solo se cierra el drawer si TODO se aplicó (si algo
    // falló, queda abierto para reintentar lo que resta).
    const dia = celda.dia; const opcion = item.opcion;
    const ops = [];
    if (String(gModo) !== String(gModoIni) || String(gId) !== String(gIdIni)) {
      ops.push(() => setGuarnicionSlot.mutateAsync({ dia, opcion, guarnicion_modo_override: gModo || null, guarnicion_fija_override_id: gModo === 'fija' ? Number(gId) : null }));
    }
    if (String(sModo) !== String(sModoIni) || String(sId) !== String(sIdIni)) {
      ops.push(() => setSalsaSlot.mutateAsync({ dia, opcion, salsa_modo_override: sModo || null, salsa_fija_override_id: sModo === 'fija' ? Number(sId) : null }));
    }
    // Excepciones: upsert las nuevas/cambiadas, borrar las removidas.
    const iniPorEmpresa = new Map(excIni.map((e) => [e.empresa_id, e]));
    for (const e of exc) {
      const prev = iniPorEmpresa.get(e.empresa_id);
      const cambio = !prev || prev.g_modo !== e.g_modo || String(prev.g_id) !== String(e.g_id) || prev.s_modo !== e.s_modo || String(prev.s_id) !== String(e.s_id);
      if (cambio) {
        ops.push(() => guardarExc.mutateAsync({
          empresaId: e.empresa_id,
          guarnicion_modo_override: e.g_modo || null, guarnicion_fija_override_id: e.g_modo === 'fija' ? Number(e.g_id) : null,
          salsa_modo_override: e.s_modo || null, salsa_fija_override_id: e.s_modo === 'fija' ? Number(e.s_id) : null,
        }));
      }
    }
    const empresasAhora = new Set(exc.map((e) => e.empresa_id));
    for (const e of excIni) if (!empresasAhora.has(e.empresa_id)) ops.push(() => borrarExc.mutateAsync(e.empresa_id));
    if (porKilo !== Boolean(item.disponible_por_kilo)) {
      ops.push(() => setPorKilo.mutateAsync({ slotId: item.slot_id, disponible: porKilo }));
    }
    if (visDirty) {
      ops.push(() => setEmpresasSlot.mutateAsync({ dia, opcion, empresa_ids: todas ? [] : empresaIds }));
    }
    if (String(categoriaId) !== String(item.categoria_id ?? '')) {
      ops.push(() => reasignar.mutateAsync({ itemId: item.slot_id, categoria_id: categoriaId === '' ? null : Number(categoriaId) }));
    }

    // Endpoints independientes -> en paralelo (Postgres serializa a nivel de fila los
    // que tocan la misma celda). allSettled conserva el "continuar ante error".
    const resultados = await Promise.allSettled(ops.map((op) => op()));
    const errores = resultados.filter((r) => r.status === 'rejected').map((r) => r.reason);
    setGuardando(false);
    if (errores.length === 0) {
      toast.success('Cambios guardados');
      onClose?.();
    } else {
      toast.error(errores.length === ops.length
        ? (errores[0]?.message || 'No se pudieron guardar los cambios')
        : `Se guardaron algunos cambios, pero ${errores.length} fallaron: ${errores[0]?.message || 'error'}`);
    }
  };

  const borrar = async () => {
    const ok = await confirmar({
      titulo: `¿Borrar "${item.plato_nombre}" de esta celda?`,
      texto: 'Se quita solo esta celda del menú de la semana; el plato del catálogo no se toca.',
      botonConfirmar: 'Borrar',
    });
    if (!ok) return;
    deleteItem.mutate(item.slot_id, {
      onSuccess: () => { toast.success('Celda borrada'); onClose?.(); },
      onError: (er) => toast.error(er?.message || 'No se pudo borrar'),
    });
  };

  const toggleEmpresaVis = (id) => setEmpresaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleTodasVis = () => {
    const siguiente = !todas;
    setTodas(siguiente);
    if (siguiente) setEmpresaIds([]); // volver a "todas" limpia la selección individual
  };

  const gEf = guarnicionEfectiva();
  const sEf = salsaEfectiva();
  const chipCls = (pisado) => pisado ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const MODOS_G = [{ v: '', l: 'De la vianda' }, { v: 'fija', l: 'Fija' }, { v: 'libre', l: 'A elección' }, { v: 'sin_guarnicion', l: 'Sin guarnición' }];
  const MODOS_S = [{ v: '', l: 'De la vianda' }, { v: 'fija', l: 'Fija' }, { v: 'libre', l: 'A elección' }, { v: 'sin_salsa', l: 'Sin salsa' }];

  return (
    <div className="rounded-lg border border-gray-100 p-4 space-y-4">
      {/* Venta por kilo (plegado al Guardar) */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Venta por kilo en el local</p>
          <p className="text-xs text-gray-500 mt-0.5">{porKilo ? 'Disponible esta semana.' : 'Excluido esta semana.'}</p>
        </div>
        <ToggleSwitch checked={porKilo} onChange={() => setPorKiloDraft((v) => !v)} color="bg-blue-500" label="Alternar venta por kilo" />
      </div>

      <div className="border-t border-gray-100 pt-3" />

      {/* GUARNICIÓN */}
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Guarnición</p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{gEf.txt}</p>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${chipCls(gEf.pisado)}`}>{gEf.chip}</span>
        </div>

        {!pisandoG ? (
          <button type="button" onClick={() => setPisandoG(true)} className="mt-1 text-xs font-medium text-brand-600 hover:underline">
            Pisar solo esta semana ↗
          </button>
        ) : (
          <div className="mt-2 space-y-2 rounded-md bg-gray-50 p-2">
            <div className="flex flex-wrap gap-1">
              {MODOS_G.map((m) => (
                <button key={m.v} type="button" onClick={() => { setGModo(m.v); if (m.v !== 'fija') setGId(''); }}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${gModo === m.v ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                  {m.l}
                </button>
              ))}
            </div>
            {gModo === 'fija' && (
              <select value={gId} onChange={(e) => setGId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Elegí cuál...</option>
                {dedupPorNombre(guarniciones, gId).map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Excepciones por empresa (inline, bajo guarnición como el mockup) */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-500 mb-1.5">Excepciones por empresa</p>
        <div className="space-y-1.5">
          {exc.map((e) => (
            <ExcepcionDraftRow key={e.empresa_id} e={e} guarniciones={guarniciones} salsas={salsas}
              onCampo={(campo, valor) => setExcCampo(e.empresa_id, campo, valor)}
              onQuitar={() => setExc((prev) => prev.filter((x) => x.empresa_id !== e.empresa_id))} />
          ))}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Las demás</span>
            {/* Lo que reciben las empresas SIN excepción = la resolución de la celda
                (override de semana si lo hay, si no la vianda). Mostrar gEf, no la base
                de la vianda: si el admin pisó la guarnición, "las demás" reciben eso. */}
            <span className="text-gray-600">{gEf.txt} <span className="text-gray-400">({gEf.pisado ? 'pisado esta semana' : 'de la vianda'})</span></span>
          </div>
        </div>
        {disponibles.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <select value={nuevaEmpresa} onChange={(e) => setNuevaEmpresa(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">+ agregar excepción por empresa</option>
              {disponibles.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <button type="button" onClick={agregarExc} disabled={!nuevaEmpresa} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40">Agregar</button>
          </div>
        )}
      </div>

      {/* SALSA */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Salsa</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{sEf.txt}</p>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${chipCls(sEf.pisado)}`}>{sEf.chip}</span>
        </div>
        {!pisandoS ? (
          <button type="button" onClick={() => setPisandoS(true)} className="mt-1 text-xs font-medium text-brand-600 hover:underline">
            Pisar solo esta semana ↗
          </button>
        ) : (
          <div className="mt-2 space-y-2 rounded-md bg-gray-50 p-2">
            <div className="flex flex-wrap gap-1">
              {MODOS_S.map((m) => (
                <button key={m.v} type="button" onClick={() => { setSModo(m.v); if (m.v !== 'fija') setSId(''); }}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${sModo === m.v ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                  {m.l}
                </button>
              ))}
            </div>
            {sModo === 'fija' && (
              <select value={sId} onChange={(e) => setSId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Elegí cuál...</option>
                {dedupPorNombre(salsas, sId).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Visible para (plegado al Guardar) */}
      {item.opcion && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Visible para</p>
          <label className="flex items-center gap-2 text-sm text-gray-800 mb-1.5">
            <input type="checkbox" checked={todas} onChange={toggleTodasVis} />
            <span className="font-medium">Todas las empresas</span>
          </label>
          <div className={`space-y-1 max-h-40 overflow-y-auto pl-1 ${todas ? 'opacity-40' : ''}`}>
            {/* Activas + cualquier empresa ya en el allowlist aunque esté inactiva: si
                no, una empresa que se desactivó después de agregarla al slot quedaría
                invisible e imposible de quitar, y se re-enviaría en silencio. */}
            {empresas.filter((e) => e.activo || empresaIds.includes(e.id)).map((emp) => (
              <label key={emp.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" disabled={todas} checked={empresaIds.includes(emp.id)} onChange={() => toggleEmpresaVis(emp.id)} />
                {emp.nombre}{!emp.activo && <span className="text-xs text-gray-400">(inactiva)</span>}
              </label>
            ))}
          </div>
          {visInvalida && <p className="text-xs text-amber-600 mt-1">Elegí al menos una empresa (o marcá "Todas").</p>}
        </div>
      )}

      {/* Categoría (plegado al Guardar) */}
      <div className="border-t border-gray-100 pt-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Categoría</label>
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">Sin categorizar</option>
          {categoriasPlatos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {/* Guardar / Cancelar */}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
        <button type="button" onClick={guardar} disabled={!puedeGuardar}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
          {guardando && <Spinner size="sm" />}
          Guardar
        </button>
        <button type="button" onClick={cancelar} disabled={guardando}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
          Cancelar
        </button>
        {excInvalida && <span className="text-xs text-amber-600">Completá las excepciones</span>}
      </div>

      {/* Borrar celda: inmediato (destructivo), fuera del borrador. */}
      <div className="border-t border-gray-100 pt-3">
        <button type="button" onClick={borrar} disabled={deleteItem.isPending}
          className="w-full rounded-lg border border-red-100 bg-white px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
          {deleteItem.isPending && <Spinner size="sm" />}
          Borrar esta celda del menú
        </button>
      </div>
    </div>
  );
}

// Fila compacta de excepción por empresa en el borrador (no persiste al instante).
function ExcepcionDraftRow({ e, guarniciones, salsas, onCampo, onQuitar }) {
  return (
    <div className={`rounded-md border p-2 ${e.stale ? 'border-amber-200 bg-amber-50' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800">{e.empresa_nombre}</span>
        <button type="button" onClick={onQuitar} className="text-xs text-red-600 hover:underline">Quitar</button>
      </div>
      {e.stale && <p className="text-[11px] text-amber-700 mt-0.5">Desactualizada: la rotación cambió el plato. No se aplica.</p>}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <select value={e.g_modo} onChange={(ev) => onCampo('g_modo', ev.target.value)} className="rounded border border-gray-200 px-1.5 py-1 text-xs">
          <option value="">Guarnición: sin cambio</option>
          <option value="sin_guarnicion">Sin guarnición</option>
          <option value="libre">A elección</option>
          <option value="fija">Fija...</option>
        </select>
        {e.g_modo === 'fija'
          ? <select value={e.g_id} onChange={(ev) => onCampo('g_id', ev.target.value)} className="rounded border border-gray-200 px-1.5 py-1 text-xs"><option value="">Cuál...</option>{dedupPorNombre(guarniciones, e.g_id).map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select>
          : <div />}
        <select value={e.s_modo} onChange={(ev) => onCampo('s_modo', ev.target.value)} className="rounded border border-gray-200 px-1.5 py-1 text-xs">
          <option value="">Salsa: sin cambio</option>
          <option value="sin_salsa">Sin salsa</option>
          <option value="libre">A elección</option>
          <option value="fija">Fija...</option>
        </select>
        {e.s_modo === 'fija'
          ? <select value={e.s_id} onChange={(ev) => onCampo('s_id', ev.target.value)} className="rounded border border-gray-200 px-1.5 py-1 text-xs"><option value="">Cuál...</option>{dedupPorNombre(salsas, e.s_id).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
          : <div />}
      </div>
    </div>
  );
}

function DetalleCeldaDrawer({ celda, menuId, onClose }) {
  const marcarSlotVianda = useMarcarSlotVianda(menuId);
  const quitarSlotVianda = useQuitarSlotVianda(menuId);
  const marcarFijoVianda = useMarcarFijoVianda(menuId);
  const quitarFijoVianda = useQuitarFijoVianda(menuId);
  const setDisponiblePorKilo = useSetDisponiblePorKilo(menuId);
  const setFijoDisponiblePorKilo = useSetFijoDisponiblePorKilo(menuId);
  const createVianda = useCreateVianda();
  const { data: empresas } = useEmpresas();

  const tipo = celda?.tipo;
  const item = celda?.item;
  const viandaPending = createVianda.isPending || (tipo === 'especial'
    ? (marcarSlotVianda.isPending || quitarSlotVianda.isPending)
    : (marcarFijoVianda.isPending || quitarFijoVianda.isPending));
  const porKiloPending = tipo === 'especial' ? setDisponiblePorKilo.isPending : setFijoDisponiblePorKilo.isPending;

  // Especiales con vianda activa usan el bloque unificado (mockup): guarnición/salsa
  // con override de celda + excepciones inline + un solo Guardar/Cancelar. Los fijos y
  // las celdas sin opción siguen con el editor por-secciones.
  //
  // Exige item.opcion: el override de celda y la excepción por empresa se anclan por
  // (menu, categoria, dia, opcion), que SOLO identifica un plato único cuando hay
  // opción (matriz/especiales). En categorías tipo lista (opcion NULL) varios platos
  // comparten (menu, categoria, NULL, NULL): el endpoint de override rutea por
  // dia/opcion (rompería con NULL en la URL) y la excepción colisionaría en el unique.
  // Esas celdas caen al editor legacy (edita la vianda), sin override de semana.
  const esUnificado = tipo === 'especial' && Boolean(item?.slot_id) && Boolean(item?.categoria_id) && Boolean(item?.opcion);
  const excQ = useExcepcionesEmpresa(esUnificado && item?.vianda_activa ? item.slot_id : null);
  // Cuando el bloque unificado está en pantalla, por-kilo/visibilidad/categoría/borrar
  // viven ADENTRO de él (mismo Guardar), así que las secciones sueltas se ocultan.
  const enUnificado = esUnificado && Boolean(item?.vianda_activa);

  // Activar vianda para un plato que todavia no tiene ninguna en el
  // catalogo tiraba 400 ("no tiene una vianda activa...") y mandaba al
  // usuario a crearla a mano en Viandas -- se la creamos general (vacia,
  // se configura con el editor de abajo) y reintentamos el anclaje una
  // sola vez, mismo mecanismo que ya usa "agregar plato" (hallazgo de
  // sesion 2026-07-13).
  // Los toggles guardan al instante; el toast de éxito cierra el bucle de feedback
  // (H1) -- antes solo avisaban en error, así que el usuario no sabía si aplicó.
  const onToggleVianda = () => {
    const target = tipo === 'especial' ? item.slot_id : item.plato_id;
    if (item.vianda_activa) {
      const quitar = tipo === 'especial' ? quitarSlotVianda : quitarFijoVianda;
      quitar.mutate(target, {
        onSuccess: () => toast.success('Ya no se ofrece como vianda'),
        onError: (e) => toast.error(e?.message || 'No se pudo actualizar la vianda'),
      });
      return;
    }
    const marcar = tipo === 'especial' ? marcarSlotVianda : marcarFijoVianda;
    marcar.mutate(target, {
      onSuccess: () => toast.success('Se ofrece como vianda'),
      onError: async (e) => {
        if (!e?.message?.includes('no tiene una vianda activa')) {
          toast.error(e?.message || 'No se pudo actualizar la vianda');
          return;
        }
        try {
          await createVianda.mutateAsync({ plato_id: item.plato_id });
          marcar.mutate(target, {
            onSuccess: () => toast.success('Se ofrece como vianda'),
            onError: (e2) => toast.error(e2?.message || 'No se pudo actualizar la vianda'),
          });
        } catch (e2) {
          toast.error(e2?.message || 'No se pudo crear la vianda del plato');
        }
      },
    });
  };

  const onTogglePorKilo = () => {
    const disponible = !item.disponible_por_kilo;
    const onSuccess = () => toast.success(disponible ? 'Disponible por kilo esta semana' : 'Excluido de la venta por kilo');
    if (tipo === 'especial') {
      setDisponiblePorKilo.mutate(
        { slotId: item.slot_id, disponible },
        { onSuccess, onError: (e) => toast.error(e?.message || 'No se pudo actualizar la venta por kilo') }
      );
    } else {
      setFijoDisponiblePorKilo.mutate(
        { platoId: item.plato_id, disponible },
        { onSuccess, onError: (e) => toast.error(e?.message || 'No se pudo actualizar la venta por kilo') }
      );
    }
  };

  return (
    <SideDrawer open={Boolean(celda)} onClose={onClose} title={item?.plato_nombre ?? ''} width="md">
      {celda && (
        <div className="p-5 space-y-5">
          <p className="text-xs text-gray-500">
            {celda.diaLabel}
            {celda.opcionLabel ? ` · Opción ${celda.opcionLabel}` : ''}
            {item.grupo_nombre ? ` · ${item.grupo_nombre}` : ''}
          </p>

          {!enUnificado && (
            <div className="rounded-lg border border-gray-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Venta por kilo en el local</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.disponible_por_kilo ? 'Disponible esta semana.' : 'Excluido de la venta por kilo esta semana.'}
                  </p>
                </div>
                <ToggleSwitch checked={item.disponible_por_kilo} onChange={onTogglePorKilo} disabled={porKiloPending} color="bg-blue-500" label="Alternar venta por kilo" />
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Se ofrece como vianda</p>
                {item.vianda_activa && item.nombre_vianda && (
                  <p className="text-xs text-gray-500 mt-0.5">Se arma con: {item.nombre_vianda}</p>
                )}
                {!item.vianda_activa && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    No se ofrece esta semana. Si el plato no tiene vianda en el catálogo, se crea una al activar.
                  </p>
                )}
              </div>
              <ToggleSwitch checked={item.vianda_activa} onChange={onToggleVianda} disabled={viandaPending} color="bg-emerald-500" label="Alternar vianda" />
            </div>
          </div>

          {/* Especiales: bloque unificado del mockup (guarnición/salsa con override de
              celda + excepciones inline + un solo Guardar/Cancelar). "Pisar solo esta
              semana" setea el override de celda, no la vianda. */}
          {item.vianda_activa && esUnificado && (
            excQ.isLoading
              ? <div className="flex justify-center py-6"><Spinner /></div>
              : <CeldaComposicionUnificada
                  key={`${item.slot_id}-${item.vianda_id}`}
                  celda={celda}
                  menuId={menuId}
                  empresas={empresas || []}
                  excepcionesIniciales={excQ.data || []}
                  onClose={onClose}
                />
          )}

          {/* Fijos / celdas sin opción: editor por-secciones (edita la vianda, sin
              override de celda ni excepciones por empresa). */}
          {item.vianda_activa && !esUnificado && (
            <div className="rounded-lg border border-gray-100">
              {item.guarnicion_modo && (
                <>
                  <ProcedenciaCard item={item} embedded />
                  <div className="border-t border-gray-100" />
                </>
              )}
              <ComposicionViandaEditor key={`${tipo}-${item.slot_id ?? item.plato_id}-${item.vianda_id}`} item={item} embedded />
            </div>
          )}

          {item.vianda_activa && !enUnificado ? (
            (tipo === 'especial' && item.opcion) ? (
              <EmpresasEditor
                key={item.slot_id}
                menuId={menuId}
                dia={celda.dia}
                opcion={item.opcion}
                empresas={empresas}
                initialIds={item.visible_empresa_ids || []}
              />
            ) : tipo === 'fijo' ? (
              <EmpresasEditorFijo
                key={item.plato_id}
                menuId={menuId}
                platoId={item.plato_id}
                empresas={empresas}
                initialIds={item.visible_empresa_ids || []}
              />
            ) : (
              // Celda slot sin letra de opcion (categoria custom sin opcion): la
              // visibilidad por empresa hoy se ancla a la letra A/B/C, asi que
              // no aplica aca todavia.
              <div className="rounded-lg border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-800">Visible para</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  La visibilidad por empresa se configura en categorías con opción (A/B/C).
                </p>
              </div>
            )
          ) : null}

          {/* Acciones poco frecuentes (reasignar categoría, borrar celda) colapsadas
              en "Más acciones" (UX heuristics H8): bajan la carga visual del drawer y
              alejan lo destructivo del flujo principal. Solo celdas slot
              (especiales/custom, filas de menu_semanal_dias con id); los fijos se
              manejan como propiedad del catálogo. */}
          {tipo === 'especial' && item.slot_id && !enUnificado && (
            <details className="rounded-lg border border-gray-100">
              <summary className="cursor-pointer p-4 text-sm font-semibold text-gray-700 marker:text-gray-400">
                Más acciones
              </summary>
              <div className="border-t border-gray-100 p-4">
                <ReasignarYBorrar menuId={menuId} item={item} onClose={onClose} embedded />
              </div>
            </details>
          )}
        </div>
      )}
    </SideDrawer>
  );
}

// Contenido del drawer de "agregar menu" -- componente propio (con `key` en
// el llamador) para que arranque con estado limpio en cada celda vacia
// nueva, sin resetear el SideDrawer que lo envuelve (que si se remontara
// perderia la animacion de cierre).
function BuscarOCrearPlato({ celdaVacia, menuId, onClose }) {
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');

  const platosQ = usePlatos({ search: busqueda, limit: 20, activo: 'true' });
  const agregarPlato = useAgregarPlato(menuId);
  const createPlato = useCreatePlato();
  const createVianda = useCreateVianda();
  const pending = agregarPlato.isPending || createPlato.isPending || createVianda.isPending;

  // Agregar un especial exige que el plato ya tenga una vianda activa en el
  // catalogo (regla de negocio en menus-semanales.service.js, existente
  // desde la Fase 1 del rediseño de vianda) -- un plato recien creado, o
  // cualquier plato viejo que nunca tuvo una vianda armada, no la tiene
  // todavia. En vez de bloquear al usuario mandandolo a Viandas, se la
  // creamos general (sin guarnicion/salsa) y reintentamos una sola vez.
  const asignar = (platoId) => {
    agregarPlato.mutate(
      { dia: celdaVacia.dia, opcion: celdaVacia.opcion, plato_id: platoId },
      {
        onSuccess: () => { toast.success('Menú agregado'); onClose(); },
        onError: async (e) => {
          if (!e?.message?.includes('no tiene una vianda activa')) {
            toast.error(e?.message || 'No se pudo agregar el menú');
            return;
          }
          try {
            await createVianda.mutateAsync({ plato_id: platoId });
            agregarPlato.mutate(
              { dia: celdaVacia.dia, opcion: celdaVacia.opcion, plato_id: platoId },
              {
                onSuccess: () => { toast.success('Menú agregado (se creó una vianda general para el plato)'); onClose(); },
                onError: (e2) => toast.error(e2?.message || 'No se pudo agregar el menú'),
              }
            );
          } catch (e2) {
            toast.error(e2?.message || 'No se pudo crear la vianda del plato');
          }
        },
      }
    );
  };

  const crearYAsignar = async () => {
    if (!nombreNuevo.trim()) return;
    try {
      const nuevo = await createPlato.mutateAsync({ nombre: nombreNuevo.trim() });
      asignar(nuevo.data.id);
    } catch (e) {
      toast.error(e?.message || 'No se pudo crear el plato');
    }
  };

  const platos = platosQ.data?.platos ?? [];

  return (
    <div className="p-5 space-y-4">
      <p className="text-xs text-gray-500">
        {celdaVacia.diaLabel} · Opción {celdaVacia.opcion}
      </p>

      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar plato..."
        autoFocus
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {platosQ.isLoading && <p className="text-xs text-gray-400">Buscando...</p>}
        {!platosQ.isLoading && platos.length === 0 && (
          <p className="text-xs text-gray-400">Sin resultados.</p>
        )}
        {platos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => asignar(p.id)}
            disabled={pending}
            className="w-full text-left px-3 py-2 text-sm rounded-lg border border-gray-100 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {p.nombre}
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-4">
        {creando ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700">Nombre del plato nuevo</label>
            <input
              type="text"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crearYAsignar()}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setCreando(false); setNombreNuevo(''); }} className="btn-secondary text-xs">
                Cancelar
              </button>
              <button
                type="button"
                onClick={crearYAsignar}
                disabled={pending || !nombreNuevo.trim()}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {pending && <Spinner size="sm" />}
                Crear y agregar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setCreando(true)} className="text-sm text-brand-600 hover:underline">
            + Crear plato nuevo
          </button>
        )}
      </div>
    </div>
  );
}

// ── Drawer para agregar un menú a un casillero vacío: buscar en el catálogo
// o crear un plato nuevo sin salir de Resumen ──
function AgregarMenuDrawer({ celdaVacia, menuId, onClose }) {
  return (
    <SideDrawer open={Boolean(celdaVacia)} onClose={onClose} title="Agregar menú" width="md">
      {celdaVacia && (
        <BuscarOCrearPlato
          key={`${celdaVacia.dia}-${celdaVacia.opcion}`}
          celdaVacia={celdaVacia}
          menuId={menuId}
          onClose={onClose}
        />
      )}
    </SideDrawer>
  );
}

// Contenido del drawer de "agregar fijo" -- a diferencia de un especial, un
// fijo no vive en menu_semanal_dias: es el propio plato el que declara
// disponibilidad='fijo_dia'/'siempre' en el catalogo (mismo campo que ya
// usa la pagina de Platos). Por eso ac asigna/crea platos actualizando esa
// disponibilidad, y despues invalida 'semana-opciones' a mano (useUpdatePlato
// solo invalida el catalogo de platos, no esta pantalla).
function BuscarOCrearFijo({ modo, diaInicial, menuId, onClose }) {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [dia, setDia] = useState(diaInicial ?? DIAS_ORDEN[0]);

  const platosQ = usePlatos({ search: busqueda, limit: 20, activo: 'true' });
  const updatePlato = useUpdatePlato();
  const createPlato = useCreatePlato();
  const pending = updatePlato.isPending || createPlato.isPending;

  const disponibilidadData = () => (
    modo === 'siempre' ? { disponibilidad: 'siempre', dia_fijo: null } : { disponibilidad: 'fijo_dia', dia_fijo: dia }
  );

  const onExito = () => {
    qc.invalidateQueries({ queryKey: ['semana-opciones', menuId] });
    toast.success('Fijo agregado');
    onClose();
  };

  const asignar = async (platoId) => {
    try {
      await updatePlato.mutateAsync({ id: platoId, data: disponibilidadData() });
      onExito();
    } catch (e) {
      toast.error(e?.message || 'No se pudo agregar el fijo');
    }
  };

  const crearYAsignar = async () => {
    if (!nombreNuevo.trim()) return;
    try {
      await createPlato.mutateAsync({ nombre: nombreNuevo.trim(), ...disponibilidadData() });
      onExito();
    } catch (e) {
      toast.error(e?.message || 'No se pudo crear el plato');
    }
  };

  const platos = platosQ.data?.platos ?? [];

  return (
    <div className="p-5 space-y-4">
      {modo === 'fijo_dia' ? (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Día</label>
          <select
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {DIAS_ORDEN.map((d) => <option key={d} value={d}>{DIA_NOMBRE[d]}</option>)}
          </select>
        </div>
      ) : (
        <p className="text-xs text-gray-500">Este plato va a aparecer todos los días de la semana.</p>
      )}

      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar plato..."
        autoFocus
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {platosQ.isLoading && <p className="text-xs text-gray-400">Buscando...</p>}
        {!platosQ.isLoading && platos.length === 0 && (
          <p className="text-xs text-gray-400">Sin resultados.</p>
        )}
        {platos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => asignar(p.id)}
            disabled={pending}
            className="w-full text-left px-3 py-2 text-sm rounded-lg border border-gray-100 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {p.nombre}
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-4">
        {creando ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700">Nombre del plato nuevo</label>
            <input
              type="text"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crearYAsignar()}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setCreando(false); setNombreNuevo(''); }} className="btn-secondary text-xs">
                Cancelar
              </button>
              <button
                type="button"
                onClick={crearYAsignar}
                disabled={pending || !nombreNuevo.trim()}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {pending && <Spinner size="sm" />}
                Crear y agregar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setCreando(true)} className="text-sm text-brand-600 hover:underline">
            + Crear plato nuevo
          </button>
        )}
      </div>
    </div>
  );
}

function AgregarFijoDrawer({ fijoVacio, menuId, onClose }) {
  return (
    <SideDrawer
      open={Boolean(fijoVacio)}
      onClose={onClose}
      title={fijoVacio?.modo === 'siempre' ? 'Agregar fijo de siempre' : 'Agregar fijo x día'}
      width="md"
    >
      {fijoVacio && (
        <BuscarOCrearFijo
          key={`${fijoVacio.modo}-${fijoVacio.dia ?? 'siempre'}`}
          modo={fijoVacio.modo}
          diaInicial={fijoVacio.dia}
          menuId={menuId}
          onClose={onClose}
        />
      )}
    </SideDrawer>
  );
}

// Contenido del drawer de "agregar guarnicion/salsa suelta de la semana" --
// buscar en el catalogo o crear una nueva sin salir de Resumen, mismo
// patron que BuscarOCrearFijo pero mas simple (sin dia, sin vianda).
function BuscarOCrearItemCatalogo({ tipo, menuId, onClose }) {
  const esGuarnicion = tipo === 'guarnicion';
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');

  const { data: guarniciones = [] } = useGuarniciones();
  const { data: salsas = [] } = useSalsas();
  const createGuarnicion = useCreateGuarnicion();
  const createSalsa = useCreateSalsa();
  const agregarGuarnicion = useAgregarGuarnicionSemana(menuId);
  const agregarSalsa = useAgregarSalsaSemana(menuId);

  const pending = createGuarnicion.isPending || createSalsa.isPending || agregarGuarnicion.isPending || agregarSalsa.isPending;
  const items = (esGuarnicion ? guarniciones : salsas).filter((it) =>
    it.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const onExito = () => {
    toast.success(esGuarnicion ? 'Guarnición agregada' : 'Salsa agregada');
    onClose();
  };

  const asignar = (itemId) => {
    const mut = esGuarnicion ? agregarGuarnicion : agregarSalsa;
    mut.mutate(itemId, {
      onSuccess: onExito,
      onError: (e) => toast.error(e?.message || 'No se pudo agregar'),
    });
  };

  const crearYAsignar = async () => {
    if (!nombreNuevo.trim()) return;
    try {
      const nuevo = esGuarnicion
        ? await createGuarnicion.mutateAsync({ nombre: nombreNuevo.trim() })
        : await createSalsa.mutateAsync({ nombre: nombreNuevo.trim() });
      asignar(nuevo.id);
    } catch (e) {
      toast.error(e?.message || 'No se pudo crear');
    }
  };

  return (
    <div className="p-5 space-y-4">
      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder={`Buscar ${esGuarnicion ? 'guarnición' : 'salsa'}...`}
        autoFocus
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {items.length === 0 && <p className="text-xs text-gray-400">Sin resultados.</p>}
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => asignar(it.id)}
            disabled={pending}
            className="w-full text-left px-3 py-2 text-sm rounded-lg border border-gray-100 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {it.nombre}
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-4">
        {creando ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700">
              Nombre de {esGuarnicion ? 'la guarnición' : 'la salsa'} nueva
            </label>
            <input
              type="text"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crearYAsignar()}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setCreando(false); setNombreNuevo(''); }} className="btn-secondary text-xs">
                Cancelar
              </button>
              <button
                type="button"
                onClick={crearYAsignar}
                disabled={pending || !nombreNuevo.trim()}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {pending && <Spinner size="sm" />}
                Crear y agregar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setCreando(true)} className="text-sm text-brand-600 hover:underline">
            + Crear {esGuarnicion ? 'guarnición' : 'salsa'} nueva
          </button>
        )}
      </div>
    </div>
  );
}

function AgregarCatalogoDrawer({ catalogoVacio, menuId, onClose }) {
  return (
    <SideDrawer
      open={Boolean(catalogoVacio)}
      onClose={onClose}
      title={catalogoVacio?.tipo === 'guarnicion' ? 'Agregar guarnición a la semana' : 'Agregar salsa a la semana'}
      width="md"
    >
      {catalogoVacio && (
        <BuscarOCrearItemCatalogo key={catalogoVacio.tipo} tipo={catalogoVacio.tipo} menuId={menuId} onClose={onClose} />
      )}
    </SideDrawer>
  );
}

// Contenido del drawer de "agregar plato a una categoría custom" -- busca en el
// catalogo o crea un plato nuevo y lo agrega a la celda (categoria_id + dia/
// opcion) via POST /menu-items. La vianda/por-kilo iniciales las decide el
// backend segun los defaults de la categoria.
function BuscarOCrearPlatoCategoria({ destino, menuId, onClose }) {
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');

  const platosQ = usePlatos({ search: busqueda, limit: 20, activo: 'true' });
  const agregar = useAgregarItemCategoria(menuId);
  const createPlato = useCreatePlato();
  const pending = agregar.isPending || createPlato.isPending;

  const asignar = (platoId) => {
    agregar.mutate(
      { categoria_id: destino.categoria_id, plato_id: platoId, dia: destino.dia, opcion: destino.opcion },
      {
        onSuccess: () => { toast.success('Plato agregado'); onClose(); },
        onError: (e) => toast.error(e?.message || 'No se pudo agregar el plato'),
      }
    );
  };

  const crearYAsignar = async () => {
    if (!nombreNuevo.trim()) return;
    try {
      const nuevo = await createPlato.mutateAsync({ nombre: nombreNuevo.trim() });
      asignar(nuevo.data.id);
    } catch (e) {
      toast.error(e?.message || 'No se pudo crear el plato');
    }
  };

  const platos = platosQ.data?.platos ?? [];
  const ctx = [destino.dia ? DIA_NOMBRE[destino.dia] : 'Todos los días', destino.opcion ? `Opción ${destino.opcion}` : null].filter(Boolean).join(' · ');

  return (
    <div className="p-5 space-y-4">
      <p className="text-xs text-gray-500">{destino.nombre} · {ctx}</p>

      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar plato..."
        autoFocus
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {platosQ.isLoading && <p className="text-xs text-gray-400">Buscando...</p>}
        {!platosQ.isLoading && platos.length === 0 && <p className="text-xs text-gray-400">Sin resultados.</p>}
        {platos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => asignar(p.id)}
            disabled={pending}
            className="w-full text-left px-3 py-2 text-sm rounded-lg border border-gray-100 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {p.nombre}
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-4">
        {creando ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700">Nombre del plato nuevo</label>
            <input
              type="text"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crearYAsignar()}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setCreando(false); setNombreNuevo(''); }} className="btn-secondary text-xs">Cancelar</button>
              <button
                type="button"
                onClick={crearYAsignar}
                disabled={pending || !nombreNuevo.trim()}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {pending && <Spinner size="sm" />}
                Crear y agregar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setCreando(true)} className="text-sm text-brand-600 hover:underline">
            + Crear plato nuevo
          </button>
        )}
      </div>
    </div>
  );
}

function AgregarACategoriaDrawer({ destino, menuId, onClose }) {
  return (
    <SideDrawer open={Boolean(destino)} onClose={onClose} title={destino ? `Agregar a ${destino.nombre}` : 'Agregar'} width="md">
      {destino && (
        <BuscarOCrearPlatoCategoria
          key={`${destino.categoria_id}-${destino.dia ?? 'x'}-${destino.opcion ?? 'x'}`}
          destino={destino}
          menuId={menuId}
          onClose={onClose}
        />
      )}
    </SideDrawer>
  );
}

// Boton "eliminar fila" compacto -- misma columna angosta al final de cada
// fila de la grilla (Especiales, Fijos x dia). Confirma antes de ejecutar
// por ser destructivo (puede afectar varios dias, o el catalogo entero en
// el caso de fijos).
function BotonEliminarFila({ onEliminar, title }) {
  return (
    <td className="border border-gray-100 p-0 h-14 text-center">
      <button
        type="button"
        onClick={onEliminar}
        title={title || 'Eliminar fila'}
        aria-label={title || 'Eliminar fila'}
        className="w-full h-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </td>
  );
}

// Color de la etiqueta de grupo por categoría (preserva los colores actuales
// de las de sistema; las custom reciben uno propio).
function colorEtiqueta(cat) {
  const map = {
    especiales: 'bg-emerald-50 text-emerald-700',
    'fijos-x-dia': 'bg-amber-50 text-amber-700',
    'fijos-de-siempre': 'bg-gray-100 text-gray-600',
    guarniciones: 'bg-sky-50 text-sky-700',
    salsas: 'bg-violet-50 text-violet-700',
    'sin-categorizar': 'bg-rose-50 text-rose-700',
  };
  return map[cat.slug] || 'bg-indigo-50 text-indigo-700';
}

const tipoDrawer = (cat) => (cat.tipo_item === 'fijo' ? 'fijo' : 'especial');

// ── Bloque MATRIZ (Especiales y custom con opción): filas por letra A/B/C,
// columnas por día. Idéntico al bloque de Especiales de siempre. ──
function MatrizBloque({ cat, dias, menuId, onAbrirDetalle, onAbrirAgregar, onAbrirAgregarCategoria, onConfigurar }) {
  const [letrasExtra, setLetrasExtra] = useState([]);
  const quitarPlato = useQuitarPlato(menuId);
  const deleteItem = useDeleteMenuItem(menuId);
  const esEspeciales = cat.slug === 'especiales';

  const porOpcionDia = new Map();
  cat.items.forEach((it) => { if (it.opcion) porOpcionDia.set(`${it.opcion}|${it.dia}`, it); });

  const letrasUsadas = new Set(cat.items.filter((i) => i.opcion).map((i) => i.opcion));
  const letrasSet = new Set([...letrasUsadas, ...letrasExtra]);
  // Especiales conserva el mínimo 2 filas; las custom muestran al menos 1 para
  // que la etiqueta del grupo sea visible aunque estén vacías.
  const minFilas = esEspeciales ? 2 : 1;
  while (letrasSet.size < minFilas) {
    const libre = siguienteLetraLibre(letrasSet);
    if (!libre) break;
    letrasSet.add(libre);
  }
  const letras = [...letrasSet].sort();

  const agregarFila = () => {
    const libre = siguienteLetraLibre(letrasSet);
    if (!libre) { toast.error('No hay más letras disponibles'); return; }
    setLetrasExtra((prev) => [...prev, libre]);
  };

  const eliminarFila = async (letra) => {
    const itemsFila = cat.items.filter((it) => it.opcion === letra);
    const ok = await confirmar({
      titulo: `¿Eliminar la fila "${letra}" de ${cat.nombre}?`,
      texto: itemsFila.length > 0
        ? `Se van a quitar los platos de esa opción en ${itemsFila.length} día${itemsFila.length !== 1 ? 's' : ''} de esta semana.`
        : 'Esta fila está vacía.',
      botonConfirmar: 'Eliminar fila',
    });
    if (!ok) return;
    try {
      if (esEspeciales) {
        // Endpoint por (día, opción) -- el que ya usaba Especiales.
        const diasConItem = dias.filter((d) => porOpcionDia.has(`${letra}|${d.dia}`));
        await Promise.all(diasConItem.map((d) => quitarPlato.mutateAsync({ dia: d.dia, opcion: letra })));
      } else {
        // Custom: cada celda es una fila de menu_semanal_dias con id propio.
        await Promise.all(itemsFila.map((it) => deleteItem.mutateAsync(it.slot_id)));
      }
      setLetrasExtra((prev) => prev.filter((l) => l !== letra));
      toast.success('Fila eliminada');
    } catch (e) {
      toast.error(e?.message || 'No se pudo eliminar la fila');
    }
  };

  return (
    <>
      {letras.map((letra, i) => (
        <tr key={`${cat.slug}-op-${letra}`}>
          {i === 0 && (
            <EtiquetaGrupo rowSpan={letras.length} colorCls={colorEtiqueta(cat)} onAgregarFila={agregarFila} onConfigurar={() => onConfigurar(cat)}>
              {cat.nombre}
            </EtiquetaGrupo>
          )}
          {dias.map((dia) => {
            const item = dia.sin_servicio ? null : (porOpcionDia.get(`${letra}|${dia.dia}`) ?? null);
            const agregar = esEspeciales
              ? () => onAbrirAgregar({ dia: dia.dia, diaLabel: DIA_NOMBRE[dia.dia], opcion: letra })
              : () => onAbrirAgregarCategoria({ categoria_id: cat.id, nombre: cat.nombre, dia: dia.dia, opcion: letra });
            return (
              <CeldaMenu
                key={dia.dia}
                item={item}
                onAbrir={(it) => onAbrirDetalle({ item: it, tipo: tipoDrawer(cat), cat, dia: dia.dia, diaLabel: DIA_NOMBRE[dia.dia], opcionLabel: it.opcion })}
                onAgregar={!item && !dia.sin_servicio ? agregar : null}
              />
            );
          })}
          <BotonEliminarFila onEliminar={() => eliminarFila(letra)} title={`Eliminar fila ${letra}`} />
        </tr>
      ))}
    </>
  );
}

// ── Bloque LISTA POR DÍA (Fijos x día y custom sin opción por día): filas =
// slots, columnas por día. Idéntico al bloque de Fijos x día de siempre. ──
function ListaDiaBloque({ cat, dias, menuId, onAbrirDetalle, onAbrirAgregarFijo, onAbrirAgregarCategoria, onConfigurar }) {
  const [filasExtra, setFilasExtra] = useState(0);
  const updatePlato = useUpdatePlato();
  const deleteItem = useDeleteMenuItem(menuId);
  const esFijo = cat.tipo_item === 'fijo';

  const porDia = dias.map((d) =>
    cat.items
      .filter((it) => it.dia === d.dia && it.plato_nombre)
      .sort((a, b) => a.plato_nombre.localeCompare(b.plato_nombre))
  );
  const maxSlots = Math.max(1, ...porDia.map((f) => f.length)) + filasExtra;

  const eliminarFila = async (slot) => {
    const platosEnFila = new Map();
    dias.forEach((d, di) => { const it = porDia[di][slot]; if (it) platosEnFila.set(it.plato_id, it); });
    if (platosEnFila.size === 0) { setFilasExtra((n) => Math.max(0, n - 1)); return; }
    const nombres = [...platosEnFila.values()].map((it) => it.plato_nombre).join(', ');
    const ok = await confirmar({
      titulo: `¿Eliminar esta fila de ${cat.nombre}?`,
      texto: esFijo
        ? `Es una propiedad del catálogo: se va a sacar de fijos en TODAS las semanas (no solo esta): ${nombres}.`
        : `Se van a quitar de esta semana: ${nombres}.`,
      botonConfirmar: 'Eliminar fila',
    });
    if (!ok) return;
    try {
      if (esFijo) {
        await Promise.all([...platosEnFila.keys()].map((platoId) =>
          updatePlato.mutateAsync({ id: platoId, data: { disponibilidad: 'especial', dia_fijo: null } })));
      } else {
        await Promise.all([...platosEnFila.values()].map((it) => deleteItem.mutateAsync(it.slot_id)));
      }
      toast.success('Fila eliminada');
    } catch (e) {
      toast.error(e?.message || 'No se pudo eliminar la fila');
    }
  };

  return (
    <>
      {Array.from({ length: maxSlots }, (_, slot) => (
        <tr key={`${cat.slug}-fd-${slot}`}>
          {slot === 0 && (
            <EtiquetaGrupo rowSpan={maxSlots} colorCls={colorEtiqueta(cat)} onAgregarFila={() => setFilasExtra((n) => n + 1)} onConfigurar={() => onConfigurar(cat)}>
              {cat.nombre}
            </EtiquetaGrupo>
          )}
          {dias.map((dia, di) => {
            const item = dia.sin_servicio ? null : (porDia[di][slot] ?? null);
            const agregar = esFijo
              ? () => onAbrirAgregarFijo({ modo: 'fijo_dia', dia: dia.dia })
              : () => onAbrirAgregarCategoria({ categoria_id: cat.id, nombre: cat.nombre, dia: dia.dia, opcion: null });
            return (
              <CeldaMenu
                key={dia.dia}
                item={item}
                onAbrir={(it) => onAbrirDetalle({ item: it, tipo: tipoDrawer(cat), cat, dia: dia.dia, diaLabel: DIA_NOMBRE[dia.dia], opcionLabel: it.opcion })}
                onAgregar={!item && !dia.sin_servicio ? agregar : null}
              />
            );
          })}
          <BotonEliminarFila onEliminar={() => eliminarFila(slot)} title="Eliminar fila" />
        </tr>
      ))}
    </>
  );
}

// ── Bloque LISTA "de siempre" (Fijos de siempre y custom modo único):
// colapsable, una fila por plato (todos los días). ──
function ListaSiempreBloque({ cat, dias, menuId, onAbrirDetalle, onAbrirAgregarFijo, onAbrirAgregarCategoria, onConfigurar }) {
  const [abierto, setAbierto] = useState(false);
  const updatePlato = useUpdatePlato();
  const deleteItem = useDeleteMenuItem(menuId);
  const esFijo = cat.tipo_item === 'fijo';
  const lista = [...cat.items].sort((a, b) => (a.plato_nombre || '').localeCompare(b.plato_nombre || ''));
  const filas = abierto ? 1 + lista.length : 1;

  const eliminar = async (item) => {
    const ok = await confirmar({
      titulo: `¿Sacar "${item.plato_nombre}" de ${cat.nombre}?`,
      texto: esFijo ? 'Es una propiedad del catálogo: se va a sacar de fijos en TODAS las semanas, no solo esta.' : 'Se quita de esta semana.',
      botonConfirmar: 'Eliminar',
    });
    if (!ok) return;
    try {
      if (esFijo) await updatePlato.mutateAsync({ id: item.plato_id, data: { disponibilidad: 'especial' } });
      else await deleteItem.mutateAsync(item.slot_id);
      toast.success('Quitado');
    } catch (e) {
      toast.error(e?.message || 'No se pudo quitar');
    }
  };

  return (
    <>
      <tr>
        <EtiquetaGrupo rowSpan={filas} colorCls={colorEtiqueta(cat)} onConfigurar={() => onConfigurar(cat)}>{cat.nombre}</EtiquetaGrupo>
        <td colSpan={dias.length + 1} className="border border-gray-100 p-1.5">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setAbierto((v) => !v)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
              <span className="text-[10px]">{abierto ? '▾' : '▸'}</span>
              {lista.length > 0 ? `${lista.length} plato${lista.length !== 1 ? 's' : ''}` : 'Sin platos'}
            </button>
            <button
              type="button"
              onClick={() => (esFijo ? onAbrirAgregarFijo({ modo: 'siempre' }) : onAbrirAgregarCategoria({ categoria_id: cat.id, nombre: cat.nombre, dia: null, opcion: null }))}
              className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
            >
              + agregar
            </button>
          </div>
        </td>
      </tr>
      {abierto && lista.map((item) => (
        <tr key={`${cat.slug}-s-${item.slot_id ?? item.plato_id}`}>
          <td colSpan={dias.length + 1} className="border border-gray-100 p-0">
            <div className={`flex items-center justify-between gap-2 transition-colors ${colorCeldaCls(item)}`}>
              <button type="button" onClick={() => onAbrirDetalle({ item, tipo: tipoDrawer(cat), cat, dia: null, diaLabel: 'Todos los días' })} className="flex-1 text-left p-1.5 min-w-0">
                <p className="text-xs text-gray-800 truncate">{item.plato_nombre}</p>
              </button>
              <button type="button" onClick={() => eliminar(item)} title="Eliminar de la semana" aria-label="Eliminar de la semana" className="shrink-0 flex items-center px-2.5 h-full text-gray-300 hover:text-red-500 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                  <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// ── Bloque LISTA de catálogo (Guarniciones / Salsas sueltas de la semana):
// colapsable, una fila por item. ──
function ListaCatalogoBloque({ cat, dias, menuId, onAbrirAgregarCatalogo, onConfigurar }) {
  const [abierto, setAbierto] = useState(false);
  const esGuarnicion = cat.tipo_dato === 'guarniciones';
  const quitarGuarnicion = useQuitarGuarnicionSemana(menuId);
  const quitarSalsa = useQuitarSalsaSemana(menuId);
  const lista = cat.items;
  const filas = abierto ? 1 + lista.length : 1;

  const eliminar = async (item) => {
    const ok = await confirmar({ titulo: `¿Quitar "${item.nombre}" de esta semana?`, botonConfirmar: 'Quitar' });
    if (!ok) return;
    const mut = esGuarnicion ? quitarGuarnicion : quitarSalsa;
    mut.mutate(item.id, { onError: (e) => toast.error(e?.message || 'No se pudo quitar') });
  };

  return (
    <>
      <tr>
        <EtiquetaGrupo rowSpan={filas} colorCls={colorEtiqueta(cat)} onConfigurar={() => onConfigurar(cat)}>{cat.nombre}</EtiquetaGrupo>
        <td colSpan={dias.length + 1} className="border border-gray-100 p-1.5">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setAbierto((v) => !v)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
              <span className="text-[10px]">{abierto ? '▾' : '▸'}</span>
              {lista.length > 0 ? `${lista.length} esta semana` : 'Sin ítems sueltos esta semana'}
            </button>
            <button type="button" onClick={() => onAbrirAgregarCatalogo({ tipo: esGuarnicion ? 'guarnicion' : 'salsa' })} className="text-xs font-semibold text-emerald-700 hover:underline shrink-0">
              + agregar
            </button>
          </div>
        </td>
      </tr>
      {abierto && lista.map((item) => (
        <tr key={`${cat.slug}-c-${item.id}`}>
          <td colSpan={dias.length + 1} className="border border-gray-100 p-0">
            <div className="flex items-center justify-between gap-2">
              <p className="flex-1 text-xs text-gray-800 truncate p-1.5">{item.nombre}</p>
              <button type="button" onClick={() => eliminar(item)} title="Quitar de esta semana" className="shrink-0 px-2.5 h-full text-xs text-gray-300 hover:text-red-500 transition-colors">✕</button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// ── Bucket "Sin categorizar": celdas cuyas categorías se borraron. Colapsable,
// una fila por celda huérfana; se abre el drawer para reasignar o borrar. ──
function SinCategorizarBloque({ cat, dias, onAbrirDetalle }) {
  const [abierto, setAbierto] = useState(true);
  const lista = cat.items;
  if (lista.length === 0) return null;
  const filas = abierto ? 1 + lista.length : 1;
  const ctx = (it) => [it.dia ? DIA_NOMBRE[it.dia] : 'Todos los días', it.opcion ? `Opción ${it.opcion}` : null].filter(Boolean).join(' · ');

  return (
    <>
      <tr>
        <EtiquetaGrupo rowSpan={filas} colorCls={colorEtiqueta(cat)}>{cat.nombre}</EtiquetaGrupo>
        <td colSpan={dias.length + 1} className="border border-gray-100 p-1.5">
          <button type="button" onClick={() => setAbierto((v) => !v)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
            <span className="text-[10px]">{abierto ? '▾' : '▸'}</span>
            {lista.length} plato{lista.length !== 1 ? 's' : ''} sin categoría — reasignalos o borralos
          </button>
        </td>
      </tr>
      {abierto && lista.map((item) => (
        <tr key={`sin-${item.slot_id}`}>
          <td colSpan={dias.length + 1} className="border border-gray-100 p-0">
            <button type="button" onClick={() => onAbrirDetalle({ item, tipo: 'especial', cat, dia: item.dia, diaLabel: ctx(item), opcionLabel: item.opcion })} className={`w-full text-left p-1.5 transition-colors ${colorCeldaCls(item)}`}>
              <p className="text-xs text-gray-800 truncate">
                {item.nombre_vianda || item.plato_nombre}
                <span className="text-[10px] text-gray-400"> — {ctx(item)}</span>
              </p>
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}

// ── "Sueltos de la semana": categorías-lista (fijos de siempre, guarniciones,
// salsas, custom modo-único y rotaciones) que NO son por-día. Se dibujan como
// tarjetas con chips fuera de la grilla, para no romperla ni forzar el ancho de
// 7 columnas. Cada tarjeta conserva ⚙ (config), + agregar, click-en-chip
// (detalle) y borrar-chip. ──
const CHIP_CAP = 6;

function TarjetaSueltos({ cat, menuId, onAbrirDetalle, onAbrirAgregarFijo, onAbrirAgregarCatalogo, onAbrirAgregarCategoria, onConfigurar }) {
  const [verTodos, setVerTodos] = useState(false);
  const esCatalogo = cat.render === 'lista_catalogo';
  const esFijo = cat.tipo_item === 'fijo';
  const esGuarnicion = cat.tipo_dato === 'guarniciones';
  const updatePlato = useUpdatePlato();
  const deleteItem = useDeleteMenuItem(menuId);
  const quitarGuarnicion = useQuitarGuarnicionSemana(menuId);
  const quitarSalsa = useQuitarSalsaSemana(menuId);

  const lista = esCatalogo
    ? cat.items
    : [...cat.items].sort((a, b) => (a.plato_nombre || '').localeCompare(b.plato_nombre || ''));
  const visibles = verTodos ? lista : lista.slice(0, CHIP_CAP);

  const agregar = () => {
    if (esCatalogo) onAbrirAgregarCatalogo({ tipo: esGuarnicion ? 'guarnicion' : 'salsa' });
    else if (esFijo) onAbrirAgregarFijo({ modo: 'siempre' });
    else onAbrirAgregarCategoria({ categoria_id: cat.id, nombre: cat.nombre, dia: null, opcion: null });
  };

  const eliminarCatalogo = async (item) => {
    const ok = await confirmar({ titulo: `¿Quitar "${item.nombre}" de esta semana?`, botonConfirmar: 'Quitar' });
    if (!ok) return;
    const mut = esGuarnicion ? quitarGuarnicion : quitarSalsa;
    mut.mutate(item.id, { onError: (e) => toast.error(e?.message || 'No se pudo quitar') });
  };
  const eliminarPlato = async (item) => {
    const ok = await confirmar({
      titulo: `¿Sacar "${item.plato_nombre}" de ${cat.nombre}?`,
      texto: esFijo ? 'Es propiedad del catálogo: se saca de fijos en TODAS las semanas.' : 'Se quita de esta semana.',
      botonConfirmar: 'Eliminar',
    });
    if (!ok) return;
    try {
      if (esFijo) await updatePlato.mutateAsync({ id: item.plato_id, data: { disponibilidad: 'especial' } });
      else await deleteItem.mutateAsync(item.slot_id);
      toast.success('Quitado');
    } catch (e) {
      toast.error(e?.message || 'No se pudo quitar');
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <button type="button" onClick={() => onConfigurar(cat)} title="Configurar categoría"
          className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-gray-700 hover:underline">
          {cat.nombre}<span className="opacity-40 font-normal normal-case">⚙</span>
        </button>
        <button type="button" onClick={agregar} className="shrink-0 text-xs font-semibold text-emerald-700 hover:underline">+ agregar</button>
      </div>
      {lista.length === 0 ? (
        <p className="text-xs text-gray-400">Sin ítems esta semana.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visibles.map((item) => (esCatalogo ? (
            <span key={`c-${item.id}`} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 pl-2.5 pr-1 py-0.5 text-xs text-blue-800">
              {item.nombre}
              <button type="button" onClick={() => eliminarCatalogo(item)} title="Quitar" aria-label="Quitar" className="text-blue-300 hover:text-red-500 px-0.5">×</button>
            </span>
          ) : (
            <span key={`s-${item.slot_id ?? item.plato_id}`} className={`inline-flex items-center rounded-full border py-0.5 text-xs ${chipColorCls(item)}`}>
              <button type="button" onClick={() => onAbrirDetalle({ item, tipo: tipoDrawer(cat), cat, dia: null, diaLabel: 'Todos los días' })} className="pl-2.5 pr-1 hover:underline">{item.plato_nombre}</button>
              <button type="button" onClick={() => eliminarPlato(item)} title="Eliminar" aria-label="Eliminar" className="opacity-40 hover:opacity-100 hover:text-red-500 pr-1.5">×</button>
            </span>
          )))}
          {lista.length > CHIP_CAP && !verTodos && (
            <button type="button" onClick={() => setVerTodos(true)} className="rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-xs text-gray-500 hover:text-gray-700">
              ver todos ({lista.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SueltosDeLaSemana({ categorias, ...handlers }) {
  if (!categorias || categorias.length === 0) return null;
  return (
    <div className="card p-4 md:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Sueltos de la semana</p>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        {categorias.map((cat) => <TarjetaSueltos key={cat.slug} cat={cat} {...handlers} />)}
      </div>
    </div>
  );
}

// Bloque "Sin categorizar" al final: platos huérfanos (perdieron su categoría).
// Chips con etiqueta de día; click abre el drawer para reasignar o borrar.
function SinCategorizarSuelto({ cat, onAbrirDetalle }) {
  const lista = cat?.items ?? [];
  if (lista.length === 0) return null;
  const ctx = (it) => [it.dia ? DIA_NOMBRE[it.dia] : 'Todos los días', it.opcion ? `Opción ${it.opcion}` : null].filter(Boolean).join(' · ');
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <p className="text-xs font-semibold text-amber-800 mb-2">
        Sin categorizar — {lista.length} plato{lista.length !== 1 ? 's' : ''} que perdieron su categoría. Reasignalos o borralos.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {lista.map((item) => (
          <button key={`sin-${item.slot_id}`} type="button"
            onClick={() => onAbrirDetalle({ item, tipo: 'especial', cat, dia: item.dia, diaLabel: ctx(item), opcionLabel: item.opcion })}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${chipColorCls(item)}`}>
            {item.nombre_vianda || item.plato_nombre}
            <span className="text-[10px] text-gray-400">· {item.dia ? DIA_ABREV[item.dia] : 'todos'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Despacha cada categoría a su renderer según `render`.
function CategoriaBloque({ cat, dias, menuId, onAbrirDetalle, onAbrirAgregar, onAbrirAgregarFijo, onAbrirAgregarCatalogo, onAbrirAgregarCategoria, onConfigurar }) {
  switch (cat.render) {
    case 'matriz':
      return <MatrizBloque cat={cat} dias={dias} menuId={menuId} onAbrirDetalle={onAbrirDetalle} onAbrirAgregar={onAbrirAgregar} onAbrirAgregarCategoria={onAbrirAgregarCategoria} onConfigurar={onConfigurar} />;
    case 'lista_dia':
      return <ListaDiaBloque cat={cat} dias={dias} menuId={menuId} onAbrirDetalle={onAbrirDetalle} onAbrirAgregarFijo={onAbrirAgregarFijo} onAbrirAgregarCategoria={onAbrirAgregarCategoria} onConfigurar={onConfigurar} />;
    case 'lista_siempre':
      return <ListaSiempreBloque cat={cat} dias={dias} menuId={menuId} onAbrirDetalle={onAbrirDetalle} onAbrirAgregarFijo={onAbrirAgregarFijo} onAbrirAgregarCategoria={onAbrirAgregarCategoria} onConfigurar={onConfigurar} />;
    case 'lista_catalogo':
      return <ListaCatalogoBloque cat={cat} dias={dias} menuId={menuId} onAbrirAgregarCatalogo={onAbrirAgregarCatalogo} onConfigurar={onConfigurar} />;
    case 'sin_categorizar':
      return <SinCategorizarBloque cat={cat} dias={dias} onAbrirDetalle={onAbrirDetalle} />;
    default:
      return null;
  }
}

// ── Matriz Excel dinámica: itera categorias[] del backend, un bloque por
// categoría. Columnas = días. ──
function TablaSemana({
  categorias, dias, menuId, marcarSinServicio, quitarSinServicio,
  onAbrirDetalle, onAbrirAgregar, onAbrirAgregarFijo, onAbrirAgregarCatalogo, onAbrirAgregarCategoria, onConfigurar,
}) {
  return (
    <table className="border-collapse w-full min-w-[680px] table-fixed">
      <colgroup>
        <col className="w-28" />
        {dias.map((dia) => {
          const finde = dia.dia === 'sabado' || dia.dia === 'domingo';
          return <col key={dia.dia} className={finde ? 'w-20' : ''} />;
        })}
        <col className="w-9" />
      </colgroup>
      <thead>
        <tr>
          <th className="border border-gray-100 bg-gray-50 w-28" />
          {dias.map((dia) => {
            const finde = dia.dia === 'sabado' || dia.dia === 'domingo';
            return (
              <th key={dia.dia} className={`border border-gray-100 p-1.5 text-center ${dia.sin_servicio ? 'bg-red-50' : finde ? 'bg-gray-100' : 'bg-gray-50'}`}>
                <div className={`text-xs font-bold uppercase tracking-wide ${finde ? 'text-gray-400' : 'text-gray-900'}`}>{DIA_ABREV[dia.dia]}</div>
                <div className="text-[10px] text-gray-500 mb-1">{formatFechaCorta(dia.fecha)}</div>
                <ToggleSinServicio dia={dia} marcar={marcarSinServicio} quitar={quitarSinServicio} />
              </th>
            );
          })}
          <th className="border border-gray-100 bg-gray-50" />
        </tr>
      </thead>
      <tbody>
        {categorias.map((cat) => (
          <CategoriaBloque
            key={cat.slug}
            cat={cat}
            dias={dias}
            menuId={menuId}
            onAbrirDetalle={onAbrirDetalle}
            onAbrirAgregar={onAbrirAgregar}
            onAbrirAgregarFijo={onAbrirAgregarFijo}
            onAbrirAgregarCatalogo={onAbrirAgregarCatalogo}
            onAbrirAgregarCategoria={onAbrirAgregarCategoria}
            onConfigurar={onConfigurar}
          />
        ))}
      </tbody>
    </table>
  );
}

export default function MenuResumen() {
  const { id } = useParams();
  const { data, isLoading, isError, error } = useSemanaOpciones(id);
  const menuQ = useMenuSemanal(id);
  const marcarSinServicio = useMarcarSinServicio(id);
  const quitarSinServicio = useQuitarSinServicio(id);
  const [celdaSeleccionada, setCeldaSeleccionada] = useState(null);
  const [celdaVacia, setCeldaVacia] = useState(null);
  const [fijoVacio, setFijoVacio] = useState(null);
  const [catalogoVacio, setCatalogoVacio] = useState(null);
  const [categoriaVacia, setCategoriaVacia] = useState(null);
  const [gestionAbierta, setGestionAbierta] = useState(false);
  const [configCategoriaId, setConfigCategoriaId] = useState(null);

  const abrirConfigCategoria = (cat) => {
    setConfigCategoriaId(cat.id ?? null);
    setGestionAbierta(true);
  };
  const cerrarGestion = () => { setGestionAbierta(false); setConfigCategoriaId(null); };

  const fechaInicio = menuQ.data ? soloFecha(menuQ.data.fecha_inicio) : null;
  const pedidosQ = usePedidos({ semana_inicio: fechaInicio, limit: 500 }, { enabled: Boolean(fechaInicio) });

  if (isLoading || menuQ.isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  if (isError) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error?.message || 'No se pudo cargar el resumen semanal'}</p>
      </div>
    );
  }

  const diasOrdenados = DIAS_ORDEN
    .map((dia) => data.dias.find((d) => d.dia === dia))
    .filter(Boolean);

  // Split de categorías en dos zonas (rediseño): la grilla por-día solo lleva
  // lo que es realmente por-día (matriz + lista por día); las categorías-lista
  // (fijos de siempre, guarniciones, salsas, custom modo-único y rotaciones)
  // salen a la sección "Sueltos"; "Sin categorizar" va a un bloque al final.
  const categorias = data.categorias ?? [];
  const gridCats = categorias.filter((c) => c.render === 'matriz' || c.render === 'lista_dia');
  const sueltosCats = categorias.filter((c) => c.render === 'lista_siempre' || c.render === 'lista_catalogo');
  const sinCategorizar = categorias.find((c) => c.render === 'sin_categorizar');

  // Mantiene el drawer sincronizado con la data fresca tras cada mutacion
  // (el item que tenia guardado el drawer puede quedar desactualizado). Busca
  // el item actualizado en cualquier categoria del payload nuevo: por slot_id
  // para celdas slot (especiales/custom), por plato_id para fijos.
  const celdaSincronizada = celdaSeleccionada && (() => {
    const clave = celdaSeleccionada.tipo === 'especial' ? 'slot_id' : 'plato_id';
    const buscado = celdaSeleccionada.item[clave];
    for (const cat of data.categorias ?? []) {
      const found = cat.items.find((it) => it[clave] != null && it[clave] === buscado);
      if (found) return { ...celdaSeleccionada, item: found };
    }
    return celdaSeleccionada;
  })();

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1">
          <Link to="/semanas" className="text-xs text-gray-500 hover:text-brand-600 transition-colors">
            ← Semanas
          </Link>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{data?.semana?.nombre}</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {formatFechaLarga(data?.semana?.fecha_inicio)} — {formatFechaLarga(data?.semana?.fecha_fin)}
        </p>
      </div>

      {menuQ.data && <BarraAcciones id={id} menu={menuQ.data} totalPedidos={pedidosQ.data?.length ?? 0} />}

      <div className="card p-4 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Leyenda />
          <button
            type="button"
            onClick={() => setGestionAbierta(true)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
              <path d="M3 5h18M3 12h18M3 19h18" />
              <circle cx="7" cy="5" r="1.6" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
              <circle cx="17" cy="19" r="1.6" fill="currentColor" stroke="none" />
            </svg>
            Gestionar categorías
          </button>
        </div>
        <div className="overflow-x-auto -mx-1 px-1">
          <TablaSemana
            categorias={gridCats}
            dias={diasOrdenados}
            menuId={id}
            marcarSinServicio={marcarSinServicio}
            quitarSinServicio={quitarSinServicio}
            onAbrirDetalle={setCeldaSeleccionada}
            onAbrirAgregar={setCeldaVacia}
            onAbrirAgregarFijo={setFijoVacio}
            onAbrirAgregarCatalogo={setCatalogoVacio}
            onAbrirAgregarCategoria={setCategoriaVacia}
            onConfigurar={abrirConfigCategoria}
          />
        </div>
      </div>

      <SueltosDeLaSemana
        categorias={sueltosCats}
        menuId={id}
        onAbrirDetalle={setCeldaSeleccionada}
        onAbrirAgregarFijo={setFijoVacio}
        onAbrirAgregarCatalogo={setCatalogoVacio}
        onAbrirAgregarCategoria={setCategoriaVacia}
        onConfigurar={abrirConfigCategoria}
      />

      {sinCategorizar && <SinCategorizarSuelto cat={sinCategorizar} onAbrirDetalle={setCeldaSeleccionada} />}

      <DetalleCeldaDrawer celda={celdaSincronizada} menuId={id} onClose={() => setCeldaSeleccionada(null)} />
      <AgregarMenuDrawer celdaVacia={celdaVacia} menuId={id} onClose={() => setCeldaVacia(null)} />
      <AgregarFijoDrawer fijoVacio={fijoVacio} menuId={id} onClose={() => setFijoVacio(null)} />
      <AgregarCatalogoDrawer catalogoVacio={catalogoVacio} menuId={id} onClose={() => setCatalogoVacio(null)} />
      <AgregarACategoriaDrawer destino={categoriaVacia} menuId={id} onClose={() => setCategoriaVacia(null)} />
      <GestionCategorias open={gestionAbierta} onClose={cerrarGestion} menuId={id} categoriaInicialId={configCategoriaId} />
    </div>
  );
}
