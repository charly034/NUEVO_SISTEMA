import { useState, useRef } from 'react';
import SideDrawer from '../ui/SideDrawer.jsx';
import Spinner from '../ui/Spinner.jsx';
import { toast } from '../../lib/toast.js';
import { confirmar } from '../../lib/confirm.js';
import {
  useCategorias, useCategoria, useCrearCategoria, useActualizarCategoria,
  useEliminarCategoria, useDuplicarCategoria, useCrearGrupo, useActualizarGrupo,
  useEliminarGrupo, useAgregarPlatoGrupo, useQuitarPlatoGrupo,
  useResembrarRotacion, useForzarGrupoSemana, useQuitarForzadoSemana,
} from '../../hooks/useCategorias.js';
import { usePlatos } from '../../hooks/usePlatos.js';

const CRITERIOS = [
  { value: 'siempre', label: 'Siempre activo' },
  { value: 'pares', label: 'Semanas pares del año' },
  { value: 'impares', label: 'Semanas impares del año' },
  { value: 'cada_n', label: 'Cada N semanas (cada 15 días…)' },
  { value: 'rango_fechas', label: 'Solo entre dos fechas' },
  { value: 'semana_mes', label: 'La Nª semana del mes' },
  { value: 'ciclo', label: 'Ciclo (se turnan los grupos)' },
];

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500';

// ── Buscar y agregar un plato a un grupo ────────────────────────────────
function AgregarPlatoAGrupo({ categoriaId, grupoId }) {
  const [busqueda, setBusqueda] = useState('');
  const platosQ = usePlatos({ search: busqueda, limit: 8, activo: 'true' });
  const agregar = useAgregarPlatoGrupo();
  const platos = platosQ.data?.platos ?? [];

  const onAgregar = (platoId) => {
    agregar.mutate({ categoriaId, grupoId, plato_id: platoId }, {
      onSuccess: () => { toast.success('Plato agregado'); setBusqueda(''); },
      onError: (e) => toast.error(e?.message || 'No se pudo agregar'),
    });
  };

  return (
    <div className="mt-2">
      <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar plato para el grupo..." className={inputCls} />
      {busqueda && (
        <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
          {platos.length === 0 && <p className="text-xs text-gray-400">Sin resultados.</p>}
          {platos.map((p) => (
            <button key={p.id} type="button" onClick={() => onAgregar(p.id)} disabled={agregar.isPending}
              className="w-full text-left px-3 py-1.5 text-sm rounded-lg border border-gray-100 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              {p.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Una fila de grupo: criterio + params por esquema, platos, borrar ────
function GrupoRow({ categoriaId, grupo }) {
  const actualizar = useActualizarGrupo();
  const eliminar = useEliminarGrupo();
  const quitarPlato = useQuitarPlatoGrupo();

  const [criterio, setCriterio] = useState(grupo.criterio);
  const [cicloOffset, setCicloOffset] = useState(grupo.ciclo_offset ?? 0);
  const [periodo, setPeriodo] = useState(grupo.periodo ?? 2);
  const [fechaDesde, setFechaDesde] = useState(grupo.fecha_desde ?? '');
  const [fechaHasta, setFechaHasta] = useState(grupo.fecha_hasta ?? '');
  const [semanaMes, setSemanaMes] = useState(grupo.semana_del_mes ?? 1);
  const [meses, setMeses] = useState(grupo.meses ?? []);

  const toggleMes = (m) => setMeses((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)));

  const invalido = criterio === 'rango_fechas' && (!fechaDesde || !fechaHasta);

  const guardar = () => {
    const data = { criterio };
    if (criterio === 'ciclo') data.ciclo_offset = Number(cicloOffset);
    if (criterio === 'cada_n') { data.periodo = Number(periodo); data.ciclo_offset = Number(cicloOffset); }
    if (criterio === 'rango_fechas') { data.fecha_desde = fechaDesde; data.fecha_hasta = fechaHasta; }
    if (criterio === 'semana_mes') { data.semana_del_mes = Number(semanaMes); data.meses = meses.length ? meses : null; }
    actualizar.mutate({ categoriaId, grupoId: grupo.id, data }, {
      onSuccess: () => toast.success('Rotación del grupo actualizada'),
      onError: (e) => toast.error(e?.message || 'No se pudo actualizar'),
    });
  };

  const onEliminar = async () => {
    const ok = await confirmar({ titulo: `¿Eliminar el grupo "${grupo.nombre}"?`, texto: 'Se quita el grupo y sus platos; el catálogo no se toca.', botonConfirmar: 'Eliminar' });
    if (!ok) return;
    eliminar.mutate({ categoriaId, grupoId: grupo.id }, {
      onSuccess: () => toast.success('Grupo eliminado'),
      onError: (e) => toast.error(e?.message || 'No se pudo eliminar'),
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800">{grupo.nombre}</p>
        <button type="button" onClick={onEliminar} className="text-xs text-red-500 hover:underline shrink-0">Eliminar grupo</button>
      </div>

      <select value={criterio} onChange={(e) => setCriterio(e.target.value)} className={inputCls}>
        {CRITERIOS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      {(criterio === 'ciclo' || criterio === 'cada_n') && (
        <div className="flex gap-2">
          {criterio === 'cada_n' && (
            <label className="flex-1 text-xs text-gray-600">
              Cada N semanas
              <input type="number" min="1" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={inputCls} />
            </label>
          )}
          <label className="flex-1 text-xs text-gray-600">
            {criterio === 'cada_n' ? 'Empezar en (0..N-1)' : 'Posición en el ciclo'}
            <input type="number" min="0" value={cicloOffset} onChange={(e) => setCicloOffset(e.target.value)} className={inputCls} />
          </label>
        </div>
      )}

      {criterio === 'rango_fechas' && (
        <div className="flex gap-2">
          <label className="flex-1 text-xs text-gray-600">Desde
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className={inputCls} />
          </label>
          <label className="flex-1 text-xs text-gray-600">Hasta
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className={inputCls} />
          </label>
        </div>
      )}

      {criterio === 'semana_mes' && (
        <div className="space-y-2">
          <label className="block text-xs text-gray-600">Nª semana del mes
            <select value={semanaMes} onChange={(e) => setSemanaMes(e.target.value)} className={inputCls}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}ª semana</option>)}
            </select>
          </label>
          <div>
            <p className="text-xs text-gray-600 mb-1">Solo estos meses (ninguno = todos)</p>
            <div className="flex flex-wrap gap-1">
              {MESES.map((m, i) => (
                <button key={m} type="button" onClick={() => toggleMes(i + 1)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${meses.includes(i + 1) ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-gray-200 text-gray-500'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {criterio !== grupo.criterio || criterio === 'cada_n' || criterio === 'rango_fechas' || criterio === 'semana_mes' || criterio === 'ciclo' ? (
        <button type="button" onClick={guardar} disabled={actualizar.isPending || invalido}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
          Guardar rotación
        </button>
      ) : null}

      {(grupo.platos || []).length > 0 && (
        <div className="space-y-1">
          {grupo.platos.map((p) => (
            <div key={p.plato_id} className="flex items-center justify-between gap-2 text-sm text-gray-700 bg-gray-50 rounded px-2 py-1">
              <span className="truncate">{p.plato_nombre}</span>
              <button type="button" onClick={() => quitarPlato.mutate({ categoriaId, grupoId: grupo.id, platoId: p.plato_id }, { onError: (e) => toast.error(e?.message || 'No se pudo quitar') })}
                className="text-xs text-gray-400 hover:text-red-500 shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
      <AgregarPlatoAGrupo categoriaId={categoriaId} grupoId={grupo.id} />
    </div>
  );
}

// ── Editor de grupos de rotación de una categoría ───────────────────────
function GruposEditor({ categoriaId, menuId }) {
  const { data: categoria, isLoading } = useCategoria(categoriaId);
  const crearGrupo = useCrearGrupo();
  const resembrar = useResembrarRotacion();
  const forzar = useForzarGrupoSemana();
  const quitarForzado = useQuitarForzadoSemana();
  const [nombreNuevo, setNombreNuevo] = useState('');

  const onCrear = () => {
    if (!nombreNuevo.trim()) return;
    crearGrupo.mutate({ categoriaId, data: { nombre: nombreNuevo.trim(), criterio: 'siempre' } }, {
      onSuccess: () => { toast.success('Grupo creado'); setNombreNuevo(''); },
      onError: (e) => toast.error(e?.message || 'No se pudo crear el grupo'),
    });
  };

  const onResembrar = () => {
    resembrar.mutate({ categoriaId, menu_semanal_id: Number(menuId) }, {
      onSuccess: () => toast.success('Rotación aplicada a esta semana'),
      onError: (e) => toast.error(e?.message || 'No se pudo re-sembrar'),
    });
  };

  const onForzar = (e) => {
    const val = e.target.value;
    if (val === '') {
      quitarForzado.mutate({ categoriaId, menu_semanal_id: Number(menuId) }, {
        onSuccess: () => toast.success('Volvió al cálculo automático'),
        onError: (er) => toast.error(er?.message || 'No se pudo actualizar'),
      });
    } else {
      forzar.mutate({ categoriaId, menu_semanal_id: Number(menuId), grupo_id: Number(val) }, {
        onSuccess: () => toast.success('Grupo forzado para esta semana'),
        onError: (er) => toast.error(er?.message || 'No se pudo forzar'),
      });
    }
  };

  if (isLoading) return <div className="py-4 flex justify-center"><Spinner size="sm" /></div>;
  const grupos = categoria?.grupos ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-800">Rotación por grupos</p>
      <p className="text-xs text-gray-500 -mt-2">
        Cada grupo se activa según su esquema. Al crear el primer grupo, la categoría pasa a mostrarse como lista semanal (los platos del grupo activo cambian cada semana).
      </p>
      {grupos.map((g) => <GrupoRow key={g.id} categoriaId={categoriaId} grupo={g} />)}
      <div className="flex gap-2">
        <input type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onCrear()} placeholder="Nombre del grupo nuevo" className={inputCls} />
        <button type="button" onClick={onCrear} disabled={crearGrupo.isPending || !nombreNuevo.trim()}
          className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors shrink-0">
          + Grupo
        </button>
      </div>

      {grupos.length > 0 && menuId && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Esta semana</p>
          <label className="block text-xs text-gray-600">
            Forzar un grupo (excepción manual)
            <select onChange={onForzar} defaultValue="" className={inputCls}>
              <option value="">Automático (según esquema)</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </label>
          <button type="button" onClick={onResembrar} disabled={resembrar.isPending}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors">
            Re-sembrar rotación en esta semana
          </button>
        </div>
      )}
    </div>
  );
}

// ── Formulario de crear/editar categoría ────────────────────────────────
function CategoriaForm({ categoria, menuId, onGuardado, onVolver }) {
  const editando = Boolean(categoria);
  const esSistema = Boolean(categoria?.es_sistema);
  const esPlatos = !categoria || categoria.tipo_dato === 'platos';
  const crear = useCrearCategoria();
  const actualizar = useActualizarCategoria();

  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [alcance, setAlcance] = useState(categoria?.alcance ?? 'recurrente');
  const [modo, setModo] = useState(categoria?.modo ?? 'plato_distinto_por_dia');
  const [usaOpcion, setUsaOpcion] = useState(categoria?.usa_opcion ?? false);
  const [viandaActiva, setViandaActiva] = useState(categoria?.default_vianda_activa ?? true);
  const [porKilo, setPorKilo] = useState(categoria?.default_disponible_por_kilo ?? true);

  const pending = crear.isPending || actualizar.isPending;

  const guardar = () => {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    const defaults = { default_vianda_activa: viandaActiva, default_disponible_por_kilo: porKilo };
    if (editando) {
      // Para las de sistema no se mandan modo/usa_opcion (definen el render fijo).
      const data = esSistema ? { nombre: nombre.trim(), defaults } : { nombre: nombre.trim(), modo, usa_opcion: usaOpcion, defaults };
      actualizar.mutate({ id: categoria.id, data }, {
        onSuccess: () => toast.success('Categoría actualizada'),
        onError: (e) => toast.error(e?.message || 'No se pudo actualizar'),
      });
    } else {
      const data = { nombre: nombre.trim(), alcance, modo, usa_opcion: usaOpcion, defaults };
      if (alcance === 'semana') data.menu_semanal_id = Number(menuId);
      crear.mutate(data, {
        onSuccess: (nueva) => { toast.success('Categoría creada'); onGuardado(nueva); },
        onError: (e) => toast.error(e?.message || 'No se pudo crear'),
      });
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onVolver} className="text-xs text-gray-500 hover:text-brand-600">← Volver a la lista</button>

      {esSistema && (
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          Categoría del sistema: podés renombrarla, cambiar sus valores por defecto y su rotación, pero no su tipo ni eliminarla.
        </p>
      )}

      <label className="block">
        <span className="block text-sm font-semibold text-gray-700 mb-1">Nombre</span>
        <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Especiales Semana Santa" className={inputCls} autoFocus />
      </label>

      {!editando && (
        <label className="block">
          <span className="block text-sm font-semibold text-gray-700 mb-1">Alcance</span>
          <select value={alcance} onChange={(e) => setAlcance(e.target.value)} className={inputCls}>
            <option value="recurrente">Recurrente (se siembra en cada menú)</option>
            <option value="semana">Solo esta semana</option>
          </select>
        </label>
      )}

      {esPlatos && (
        <>
          <label className="block">
            <span className="block text-sm font-semibold text-gray-700 mb-1">Modo</span>
            <select value={modo} onChange={(e) => setModo(e.target.value)} disabled={esSistema} className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-400`}>
              <option value="plato_distinto_por_dia">Plato distinto por día</option>
              <option value="plato_unico_todos_los_dias">Mismo plato todos los días</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={usaOpcion} onChange={(e) => setUsaOpcion(e.target.checked)} disabled={esSistema} />
            Usa opciones con letra (A/B/C)
          </label>

          <div className="rounded-lg border border-gray-100 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Valores por defecto de las filas</p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={viandaActiva} onChange={(e) => setViandaActiva(e.target.checked)} />
              Se ofrece como vianda
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={porKilo} onChange={(e) => setPorKilo(e.target.checked)} />
              Disponible por kilo en el local
            </label>
          </div>
        </>
      )}

      <button type="button" onClick={guardar} disabled={pending}
        className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
        {pending && <Spinner size="sm" />}
        {editando ? 'Guardar cambios' : 'Crear categoría'}
      </button>

      {editando && esPlatos && (
        <div className="border-t border-gray-100 pt-4">
          <GruposEditor categoriaId={categoria.id} menuId={menuId} />
        </div>
      )}
    </div>
  );
}

// ── Drawer principal: lista (con drag para ordenar) + config ────────────
export default function GestionCategorias({ open, onClose, menuId, categoriaInicialId = null }) {
  const [vista, setVista] = useState({ modo: 'lista' });
  const { data: categorias = [], isLoading } = useCategorias();
  const { data: categoriaEdit } = useCategoria(vista.modo === 'form' ? vista.id : undefined);
  const duplicar = useDuplicarCategoria();
  const eliminar = useEliminarCategoria();
  const actualizar = useActualizarCategoria();
  const dragIndex = useRef(null);

  // Al abrir el drawer, arrancar en la config de la categoría pedida (click en
  // el encabezado) o en la lista. Patrón de ajuste-de-estado-en-render (sin
  // efecto): se dispara solo cuando `open` cambia de false a true.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setVista(categoriaInicialId ? { modo: 'form', id: categoriaInicialId } : { modo: 'lista' });
  }

  const cerrar = () => { setVista({ modo: 'lista' }); onClose(); };

  const persistirOrden = async (lista) => {
    try {
      await Promise.all(lista.map((c, idx) => {
        const nuevoOrden = idx + 1;
        return c.orden === nuevoOrden ? null : actualizar.mutateAsync({ id: c.id, data: { orden: nuevoOrden } });
      }));
      toast.success('Orden actualizado');
    } catch (e) {
      toast.error(e?.message || 'No se pudo guardar el orden');
    }
  };

  const onDrop = (i) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from == null || from === i) return;
    const nuevo = [...categorias];
    const [moved] = nuevo.splice(from, 1);
    nuevo.splice(i, 0, moved);
    persistirOrden(nuevo);
  };

  const onDuplicar = (cat) => {
    duplicar.mutate({ id: cat.id }, {
      onSuccess: (nueva) => { toast.success('Categoría duplicada'); if (nueva?.id) setVista({ modo: 'form', id: nueva.id }); },
      onError: (e) => toast.error(e?.message || 'No se pudo duplicar'),
    });
  };

  const onEliminar = async (cat) => {
    const ok = await confirmar({
      titulo: `¿Eliminar la categoría "${cat.nombre}"?`,
      texto: 'Los platos que tenía quedan en "Sin categorizar" (no se borran). Esta acción no se puede deshacer.',
      botonConfirmar: 'Eliminar',
    });
    if (!ok) return;
    eliminar.mutate(cat.id, {
      onSuccess: () => toast.success('Categoría eliminada'),
      onError: (e) => toast.error(e?.message || 'No se pudo eliminar'),
    });
  };

  const titulo = vista.modo === 'form'
    ? (vista.id ? 'Configurar categoría' : 'Nueva categoría')
    : 'Categorías';

  return (
    <SideDrawer open={open} onClose={cerrar} title={titulo} width="lg">
      <div className="p-5">
        {vista.modo === 'form' ? (
          <CategoriaForm
            key={vista.id ? (categoriaEdit?.id ?? `cargando-${vista.id}`) : 'nuevo'}
            categoria={vista.id ? categoriaEdit : null}
            menuId={menuId}
            onGuardado={(nueva) => setVista({ modo: 'form', id: nueva.id })}
            onVolver={() => setVista({ modo: 'lista' })}
          />
        ) : (
          <div className="space-y-3">
            <button type="button" onClick={() => setVista({ modo: 'form' })}
              className="w-full rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors">
              + Nueva categoría
            </button>
            <p className="text-xs text-gray-400">Arrastrá para reordenar. Tocá una categoría para configurarla.</p>

            {isLoading && <div className="py-6 flex justify-center"><Spinner /></div>}
            {categorias.map((cat, i) => (
              <div
                key={cat.id}
                draggable
                onDragStart={() => { dragIndex.current = i; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                className="rounded-lg border border-gray-200 p-3 bg-white cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1.5">
                      <span className="text-gray-300">⠿</span>
                      {cat.nombre}
                      {cat.es_sistema && <span className="text-[10px] font-bold uppercase text-gray-400 border border-gray-200 rounded px-1">sistema</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {cat.tipo_dato !== 'platos'
                        ? (cat.tipo_dato === 'guarniciones' ? 'Guarniciones' : 'Salsas')
                        : `${cat.alcance === 'semana' ? 'Solo esta semana' : 'Recurrente'} · ${cat.modo === 'plato_unico_todos_los_dias' ? 'Mismo plato' : 'Distinto por día'}${cat.usa_opcion ? ' · A/B/C' : ''}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setVista({ modo: 'form', id: cat.id })} className="text-xs font-semibold text-brand-600 hover:underline">Configurar</button>
                  <button type="button" onClick={() => onDuplicar(cat)} disabled={duplicar.isPending} className="text-xs font-semibold text-gray-500 hover:underline disabled:opacity-50">Duplicar</button>
                  {!cat.es_sistema && (
                    <button type="button" onClick={() => onEliminar(cat)} disabled={eliminar.isPending} className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50">Eliminar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SideDrawer>
  );
}
