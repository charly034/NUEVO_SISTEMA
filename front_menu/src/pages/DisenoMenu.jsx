import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useDisenoMenu,
  useAgregarPlato,
  useActualizarGuarnicionSlot,
  useActualizarSalsaSlot,
  useSetEmpresasSlot,
  useQuitarPlato,
  useMarcarSinServicio,
  useQuitarSinServicio,
} from '../hooks/useMenus.js';
import { useSugerenciasResumen } from '../hooks/usePedidos.js';
import { usePlatos } from '../hooks/usePlatos.js';
import { useGuarniciones } from '../hooks/useGuarniciones.js';
import { useSalsas } from '../hooks/useSalsas.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import { toast } from '../lib/toast.js';
import { confirmarAccion } from '../lib/confirm.js';
import { DIAS_ORDEN as DIAS, DIA_NOMBRE as DIA_LABEL } from '../lib/dias.js';

// ── Constantes ────────────────────────────────────────────────────

const ESTADO_CFG = {
  borrador:  { label: 'Borrador',  cls: 'bg-gray-100 text-gray-600'   },
  publicado: { label: 'Publicado', cls: 'bg-green-100 text-green-700' },
  cerrado:   { label: 'Cerrado',   cls: 'bg-red-100 text-red-600'     },
};

// ── Buscador de platos ────────────────────────────────────────────

function BuscadorPlatos({ onSelect, platoIdsEnDia = [] }) {
  const [search, setSearch] = useState('');
  const query = usePlatos({ activo: 'true', disponible_vianda: 'true', limit: 50, search: search || undefined });
  const platos = query.data?.platos ?? [];

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar plato de vianda..."
        autoFocus
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
      />
      <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50 rounded-lg border border-gray-200">
        {query.isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : platos.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Sin resultados</p>
        ) : platos.map((p) => {
          const yaEnDia = platoIdsEnDia.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className={`w-full px-4 py-3 text-left text-sm transition-colors ${yaEnDia ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-brand-50'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-900">{p.nombre}</p>
                {yaEnDia && (
                  <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Ya en el dia</span>
                )}
              </div>
              {p.nombre_vianda ? (
                <p className="text-xs text-gray-500">Vianda: {p.nombre_vianda}</p>
              ) : null}
              {p.descripcion ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{p.descripcion}</p>
              ) : null}
              {yaEnDia && (
                <p className="mt-1 text-[10px] text-amber-600">Solo permitido para empresas especificas sin solapamiento</p>
              )}
              <div className="mt-1 flex gap-2">
                {p.guarnicion_modo !== 'sin_guarnicion' ? (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                    {p.guarnicion_modo === 'libre' ? 'Guarnicion a eleccion' : 'Guarnicion fija'}
                  </span>
                ) : null}
                {p.salsa_modo !== 'sin_salsa' ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                    {p.salsa_modo === 'libre' ? 'Salsa a eleccion' : 'Salsa fija'}
                  </span>
                ) : null}
                {p.vegetariano ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Vegetariano</span>
                ) : null}
                {p.calorias ? (
                  <span className="text-xs text-orange-500">{p.calorias} kcal</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Selector de guarnicion (paso 2) ──────────────────────────────

function SelectorAcompanamientos({ plato, onConfirmar, onVolver, loading }) {
  const [modo, setModo] = useState('default');
  const [guarnicionId, setGuarnicionId] = useState(null);
  const [modoSalsa, setModoSalsa] = useState('default');
  const [salsaId, setSalsaId] = useState(null);
  const gQuery = useGuarniciones();
  const guarniciones = gQuery.data?.data ?? gQuery.data ?? [];
  const sQuery = useSalsas();
  const salsas = sQuery.data?.data ?? sQuery.data ?? [];

  const OPCIONES = [
    {
      value: 'default',
      label: 'Como el plato',
      desc: plato
        ? `Usa el catalogo: ${plato.guarnicion_modo === 'libre' ? 'a eleccion' : plato.guarnicion_modo === 'fija' ? 'guarnicion fija' : 'sin guarnicion'}`
        : 'Usa la configuracion del catalogo',
    },
    { value: 'libre', label: 'A eleccion', desc: 'El empleado elige la guarnicion al pedir' },
    { value: 'fija', label: 'Guarnicion fija especifica', desc: 'Una guarnicion concreta para este slot' },
    { value: 'sin_guarnicion', label: 'Sin guarnicion', desc: 'Se publica sin guarnicion en este slot' },
  ];

  const OPCIONES_SALSA = [
    {
      value: 'default',
      label: 'Como el plato',
      desc: plato
        ? `Usa el catalogo: ${plato.salsa_modo === 'libre' ? 'a eleccion' : plato.salsa_modo === 'fija' ? 'salsa fija' : 'sin salsa'}`
        : 'Usa la configuracion del catalogo',
    },
    { value: 'libre', label: 'A eleccion', desc: 'El empleado elige la salsa al pedir' },
    { value: 'fija', label: 'Salsa fija especifica', desc: 'Una salsa concreta para este slot' },
    { value: 'sin_salsa', label: 'Sin salsa', desc: 'Se publica sin salsa en este slot' },
  ];

  const handleConfirmar = () => {
    onConfirmar({
      guarnicion_modo_override: modo === 'default' ? null : modo,
      guarnicion_fija_override_id: modo === 'fija' ? guarnicionId : null,
      salsa_modo_override: modoSalsa === 'default' ? null : modoSalsa,
      salsa_fija_override_id: modoSalsa === 'fija' ? salsaId : null,
    });
  };

  return (
    <div className="space-y-4">
      {plato && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Plato seleccionado</p>
          <p className="font-semibold text-sm text-gray-900">{plato.nombre_vianda || plato.nombre}</p>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Guarnicion para este slot</p>
        <div className="space-y-2">
          {OPCIONES.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setModo(value)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                modo === value ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <p className={`text-sm font-semibold ${modo === value ? 'text-brand-700' : 'text-gray-800'}`}>{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {modo === 'fija' && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Seleccionar guarnicion fija</p>
          {gQuery.isLoading ? (
            <Spinner />
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
              {guarniciones.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGuarnicionId(g.id)}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                    guarnicionId === g.id ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {g.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Salsa para este slot</p>
        <div className="space-y-2">
          {OPCIONES_SALSA.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setModoSalsa(value)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                modoSalsa === value ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <p className={`text-sm font-semibold ${modoSalsa === value ? 'text-red-700' : 'text-gray-800'}`}>{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {modoSalsa === 'fija' && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Seleccionar salsa fija</p>
          {sQuery.isLoading ? (
            <Spinner />
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
              {salsas.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSalsaId(s.id)}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                    salsaId === s.id ? 'bg-red-50 text-red-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {s.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Volver
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={loading || (modo === 'fija' && !guarnicionId) || (modoSalsa === 'fija' && !salsaId)}
          className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

// ── Selector de empresas (paso 3) ────────────────────────────────

function SelectorEmpresas({ plato, guarnicionLabel, onConfirmar, onVolver, loading }) {
  const empQuery = useEmpresas({ activo: true, limit: 200 });
  const empresas = empQuery.data?.data ?? [];
  const [seleccionadas, setSeleccionadas] = useState([]);

  const toggle = (id) =>
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <div className="space-y-4">
      {plato && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Slot a agregar</p>
          <p className="font-semibold text-sm text-gray-900">{plato.nombre_vianda || plato.nombre}</p>
          {guarnicionLabel && <p className="text-xs text-gray-500 mt-0.5">{guarnicionLabel}</p>}
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-1">Visible para</p>
        <button
          type="button"
          onClick={() => setSeleccionadas([])}
          className={`mb-2 w-full rounded-xl border px-4 py-2.5 text-left transition-colors ${
            seleccionadas.length === 0 ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <p className={`text-sm font-semibold ${seleccionadas.length === 0 ? 'text-brand-700' : 'text-gray-700'}`}>
            Todas las empresas
          </p>
          <p className="text-xs text-gray-500">Cualquier empleado puede pedirlo</p>
        </button>

        {empQuery.isLoading ? (
          <Spinner />
        ) : (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
            {empresas.map((e) => {
              const activa = seleccionadas.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(e.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    activa ? 'bg-brand-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                    activa ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                  }`}>
                    {activa && (
                      <svg viewBox="0 0 10 10" fill="none" className="h-2.5 w-2.5">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm ${activa ? 'font-semibold text-brand-700' : 'text-gray-700'}`}>{e.nombre}</span>
                </button>
              );
            })}
          </div>
        )}
        {seleccionadas.length > 0 && (
          <p className="mt-1.5 text-xs text-gray-500">{seleccionadas.length} empresa(s) seleccionada(s)</p>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onVolver}
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Volver
        </button>
        <button
          type="button"
          onClick={() => onConfirmar(seleccionadas)}
          disabled={loading}
          className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

// ── Panel central: platos del dia seleccionado ────────────────────

// Tarjeta de un slot (vianda o local) dentro de PanelDia. Declarada a nivel de
// módulo (no dentro de PanelDia) para que React la reconcilie por props en vez
// de remontarla entera en cada render de PanelDia.
function SlotCard({ item, dia, guarnicionesMap, salsasMap, agregarPending, onEditarGuarnicion, onQuitar, onEditarEmpresas }) {
    const nombre = item.plato?.nombre_vianda || item.plato?.nombre || item.nombre;
    const override = item.guarnicion_modo_override;
    const overrideSalsa = item.salsa_modo_override;
    const empresas = item.empresa_ids ?? [];

    return (
      <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 leading-tight">{nombre}</p>
            {item.opcion && <p className="text-[10px] text-gray-500 mt-0.5">Opcion {item.opcion}</p>}
          </div>
          <button
            type="button"
            disabled={agregarPending}
            onClick={() => onEditarGuarnicion(dia, item)}
            className="flex-shrink-0 rounded-lg p-1 text-gray-500 hover:bg-brand-50 hover:text-brand-500 disabled:opacity-40 transition-colors"
            title="Editar guarnicion"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
              <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            type="button"
            disabled={agregarPending}
            onClick={() => onQuitar(dia)(item)}
            className="flex-shrink-0 rounded-lg p-1 text-gray-500 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition-colors"
            title="Quitar plato"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Guarnicion */}
        {override === 'sin_guarnicion' && <p className="mt-1 text-[10px] text-gray-500">Sin guarnicion</p>}
        {override === 'libre' && <p className="mt-1 text-[10px] font-semibold text-green-600">Guarnicion a eleccion</p>}
        {override === 'fija' && (
          <p className="mt-1 text-[10px] font-semibold text-blue-600">
            {item.guarnicion_fija_override_nombre ?? guarnicionesMap?.[item.guarnicion_fija_override_id] ?? 'Guarnicion fija'}
          </p>
        )}
        {!override && item.plato?.guarnicion_modo === 'libre' && <p className="mt-1 text-[10px] text-gray-500">A eleccion (catalogo)</p>}
        {!override && item.plato?.guarnicion_modo === 'fija' && <p className="mt-1 text-[10px] text-gray-500">Guar. fija (catalogo)</p>}

        {/* Salsa */}
        {overrideSalsa === 'sin_salsa' && <p className="mt-0.5 text-[10px] text-gray-500">Sin salsa</p>}
        {overrideSalsa === 'libre' && <p className="mt-0.5 text-[10px] font-semibold text-red-600">Salsa a eleccion</p>}
        {overrideSalsa === 'fija' && (
          <p className="mt-0.5 text-[10px] font-semibold text-red-600">
            {item.salsa_fija_override_nombre ?? salsasMap?.[item.salsa_fija_override_id] ?? 'Salsa fija'}
          </p>
        )}
        {!overrideSalsa && item.plato?.salsa_modo === 'libre' && <p className="mt-0.5 text-[10px] text-gray-500">Salsa a eleccion (catalogo)</p>}
        {!overrideSalsa && item.plato?.salsa_modo === 'fija' && <p className="mt-0.5 text-[10px] text-gray-500">Salsa fija (catalogo)</p>}

        {/* Chips empresa — click abre editor */}
        <button
          type="button"
          disabled={agregarPending}
          onClick={() => onEditarEmpresas(dia, item)}
          className="mt-1.5 text-left disabled:opacity-40 group"
        >
          {empresas.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {(item.empresa_nombres ?? []).map((n, i) => (
                <span key={i} className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 group-hover:bg-brand-200 transition-colors">{n}</span>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-500 group-hover:text-gray-500 transition-colors">Todas las empresas · editar</p>
          )}
        </button>
      </div>
    );
}

function PanelDia({ dia, datos, siempre, guarnicionesMap, salsasMap, onAbrirPicker, onQuitar, onEditarGuarnicion, onEditarEmpresas, onToggleSinServicio, agregarPending, sinServicioPending }) {
  const sinServicio = datos?.sinServicio ?? false;
  const slots = datos?.slots ?? [];
  const fijos = datos?.fijos ?? [];
  const motivoSinServicio = datos?.motivo;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">{DIA_LABEL[dia]}</h2>
        <button
          type="button"
          disabled={sinServicioPending}
          onClick={() => onToggleSinServicio(dia, !sinServicio, motivoSinServicio)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
            sinServicio
              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          {sinServicio ? 'Sin servicio' : 'Marcar sin servicio'}
        </button>
      </div>

      {sinServicio ? (
        <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-500">Sin servicio</p>
          {motivoSinServicio && <p className="text-xs text-red-400 mt-1">{motivoSinServicio}</p>}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600">Viandas del dia</p>
            <button
              type="button"
              onClick={() => onAbrirPicker(dia, { opcion: String.fromCharCode(65 + slots.length) })}
              className="text-[10px] font-semibold text-brand-500 hover:text-brand-700 transition-colors"
            >
              + Agregar
            </button>
          </div>
          <div className="space-y-2">
            {slots.map((s) => (
              <SlotCard
                key={s.slot_id} item={s} dia={dia} guarnicionesMap={guarnicionesMap} salsasMap={salsasMap}
                agregarPending={agregarPending} onEditarGuarnicion={onEditarGuarnicion}
                onQuitar={onQuitar} onEditarEmpresas={onEditarEmpresas}
              />
            ))}
            {fijos.map((f) => (
              <div key={f.id} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
                <p className="text-sm font-medium text-sky-800">{f.nombre_vianda || f.nombre}</p>
                <p className="text-[10px] text-sky-500 mt-0.5">Fijo del dia</p>
              </div>
            ))}
            {siempre.map((s) => (
              <div key={s.id} className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                <p className="text-sm font-medium text-emerald-800">{s.nombre_vianda || s.nombre}</p>
                <p className="text-[10px] text-emerald-500 mt-0.5">Siempre disponible</p>
              </div>
            ))}
            {slots.length === 0 && fijos.length === 0 && siempre.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-brand-100 p-4 text-center">
                <p className="text-xs text-gray-500">Sin viandas</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panel derecho: resumen por empresa ────────────────────────────

function PanelEmpresas({ datos, siempre }) {
  const slots = datos?.slots ?? [];
  const fijos = datos?.fijos ?? [];

  // Agrupar por empresa los slots que tienen empresa_ids definido
  const slotsConEmpresas = slots.filter((s) => (s.empresa_ids ?? []).length > 0);
  const slotsParaTodos = slots.filter((s) => (s.empresa_ids ?? []).length === 0);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Aparece en menu de empresas</h3>

      {slotsParaTodos.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-3">
          <p className="text-xs font-semibold text-gray-600 mb-2">Todas las empresas</p>
          {slotsParaTodos.map((s) => (
            <p key={s.slot_id} className="text-xs text-gray-500 leading-relaxed">
              {s.plato?.nombre_vianda || s.plato?.nombre || s.plato_nombre}
            </p>
          ))}
        </div>
      )}

      {slotsConEmpresas.map((s) => (
        <div key={s.slot_id} className="rounded-xl border border-gray-100 bg-white p-3">
          <p className="text-xs font-semibold text-gray-700">{s.plato?.nombre || s.plato_nombre}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(s.empresa_nombres ?? []).map((nombre, i) => (
              <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{nombre}</span>
            ))}
          </div>
        </div>
      ))}

      {fijos.length > 0 && (
        <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
          <p className="text-xs font-semibold text-sky-700 mb-1">Fijos del dia</p>
          {fijos.map((f) => (
            <p key={f.id} className="text-xs text-sky-600">{f.nombre_vianda || f.nombre}</p>
          ))}
        </div>
      )}

      {siempre.length > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700 mb-1">Siempre disponibles</p>
          {siempre.map((s) => (
            <p key={s.id} className="text-xs text-emerald-600">{s.nombre_vianda || s.nombre}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Panel de feedback de clientes ───────────────────────────────

function PanelSugerencias({ semanaInicio }) {
  const { data, isLoading } = useSugerenciasResumen(semanaInicio);
  const items = Array.isArray(data) ? data : [];

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Clientes sugieren</h3>
      {isLoading && (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-full animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      )}
      {!isLoading && items.length === 0 && (
        <p className="text-xs text-gray-500">Sin sugerencias esta semana</p>
      )}
      {!isLoading && items.length > 0 && (
        <div className="space-y-1">
          {items.map(({ nombre, votos }) => (
            <div key={nombre} className="flex items-center justify-between gap-2">
              <p className="truncate text-xs text-gray-600" title={nombre}>{nombre}</p>
              <span className="flex-shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                {votos}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pagina principal ──────────────────────────────────────────────

export default function DisenoMenu() {
  const { id } = useParams();

  const { data, isLoading, isError, error } = useDisenoMenu(id);

  // Usar `id` (string) en todos los hooks para que la queryKey coincida con useDisenoMenu
  const agregarMutation        = useAgregarPlato(id);
  const actualizarGuarnicionM  = useActualizarGuarnicionSlot(id);
  const actualizarSalsaM       = useActualizarSalsaSlot(id);
  const setEmpresasMutation    = useSetEmpresasSlot(id);
  const quitarMutation         = useQuitarPlato(id);
  const sinServicioAdd         = useMarcarSinServicio(id);
  const sinServicioDel         = useQuitarSinServicio(id);
  const guarnicionesQuery      = useGuarniciones();
  const guarnicionesMap        = useMemo(
    () => Object.fromEntries((guarnicionesQuery.data?.data ?? guarnicionesQuery.data ?? []).map((g) => [g.id, g.nombre])),
    [guarnicionesQuery.data],
  );
  const salsasQuery            = useSalsas();
  const salsasMap              = useMemo(
    () => Object.fromEntries((salsasQuery.data?.data ?? salsasQuery.data ?? []).map((s) => [s.id, s.nombre])),
    [salsasQuery.data],
  );

  // picker: null | { dia, opcion, step: 'plato'|'guarnicion'|'empresas', plato, guarnicion, editOnly }
  const [picker, setPicker] = useState(null);
  const [diaActivo, setDiaActivo] = useState('lunes');
  const [tabDerecha, setTabDerecha] = useState('empresas');

  if (isLoading) {
    return <div className="flex min-h-[320px] items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (isError) {
    return <ErrorMessage message={error?.message} />;
  }

  const { menu, slots: slotsMap, fijos_por_dia, siempre, sin_servicio } = data;
  const estadoCfg = ESTADO_CFG[menu.estado] ?? { label: menu.estado, cls: 'bg-gray-100 text-gray-600' };

  const datosPorDia = {};
  for (const dia of DIAS) {
    const fijosDelDia = fijos_por_dia.filter((f) => f.dia_fijo === dia);
    datosPorDia[dia] = {
      slots:       slotsMap[dia] ?? [],
      fijos:       fijosDelDia,
      sinServicio: dia in sin_servicio,
      motivo:      sin_servicio[dia],
    };
  }

  const handleAbrirPicker = (dia, { opcion }) => {
    setPicker({ dia, opcion, step: 'plato', plato: null, editOnly: false });
  };

  const handleEditarGuarnicion = (dia, slot) => {
    setPicker({ dia, opcion: slot.opcion, step: 'guarnicion', plato: slot.plato, editOnly: true });
  };

  const handleEditarEmpresas = (dia, slot) => {
    setPicker({ dia, opcion: slot.opcion, step: 'empresas', plato: slot.plato, guarnicion: null, editOnly: true });
  };

  const handleSeleccionarPlato = (plato) => {
    setPicker((prev) => ({ ...prev, plato, step: 'guarnicion' }));
  };

  const handleConfirmarGuarnicion = async (acompanamientos) => {
    if (!picker) return;
    if (picker.editOnly) {
      // Para edicion: guardar guarnicion y salsa en paralelo (sin paso de empresas)
      const {
        guarnicion_modo_override, guarnicion_fija_override_id,
        salsa_modo_override, salsa_fija_override_id,
      } = acompanamientos;
      try {
        await Promise.all([
          actualizarGuarnicionM.mutateAsync({ dia: picker.dia, opcion: picker.opcion, guarnicion_modo_override, guarnicion_fija_override_id }),
          actualizarSalsaM.mutateAsync({ dia: picker.dia, opcion: picker.opcion, salsa_modo_override, salsa_fija_override_id }),
        ]);
        toast.success('Guarnicion y salsa actualizadas');
        setPicker(null);
      } catch (e) {
        toast.error(e?.response?.data?.message ?? e.message);
      }
    } else {
      // Vianda nueva: ir al paso 3 (empresas)
      setPicker((prev) => ({ ...prev, guarnicion: acompanamientos, step: 'empresas' }));
    }
  };

  const handleConfirmarEmpresas = async (empresa_ids, allowDuplicate = false, acompanamientosOverride = null) => {
    if (!picker) return;
    const acompanamientos = acompanamientosOverride ?? picker.guarnicion;
    try {
      await agregarMutation.mutateAsync({
        dia:             picker.dia,
        opcion:          picker.opcion,
        plato_id:        picker.plato.id,
        allow_duplicate: allowDuplicate,
        ...acompanamientos,
      });
      if (empresa_ids.length > 0) {
        await setEmpresasMutation.mutateAsync({ dia: picker.dia, opcion: picker.opcion, empresa_ids });
      }
      toast.success(`${picker.plato.nombre} agregado al ${DIA_LABEL[picker.dia]}`);
      setPicker(null);
    } catch (e) {
      const code = e?.response?.data?.code;
      if (code === 'PLATO_DUPLICADO') {
        const ok = await confirmarAccion(
          `"${picker.plato.nombre}" ya está en el menú del ${DIA_LABEL[picker.dia]}.\n\n` +
          `Solo podés duplicarlo si lo restringís a empresas específicas que no se solapen con los slots existentes.\n\n` +
          `¿Confirmar de todas formas?`
        );
        if (ok) {
          handleConfirmarEmpresas(empresa_ids, true);
        }
        return;
      }
      toast.error(e?.response?.data?.message ?? e.message);
    }
  };

  const handleQuitarConDia = (dia) => async (slot) => {
    const ok = await confirmarAccion(`Quitar "${slot.plato.nombre}" del ${DIA_LABEL[dia]}?`);
    if (!ok) return;
    try {
      await quitarMutation.mutateAsync({ dia, opcion: slot.opcion });
      toast.success('Plato quitado');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleToggleSinServicio = async (dia, marcar) => {
    try {
      if (marcar) {
        await sinServicioAdd.mutateAsync({ dia });
        toast.success(`${DIA_LABEL[dia]} marcado como sin servicio`);
      } else {
        await sinServicioDel.mutateAsync(dia);
        toast.success(`Servicio restaurado para el ${DIA_LABEL[dia]}`);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const sinServicioPending = sinServicioAdd.isPending || sinServicioDel.isPending;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header con tabs */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 pt-3 pb-0">
        <div className="flex items-center justify-between mb-1">
          <Link to="/semanas" className="text-xs text-gray-500 hover:text-brand-600 transition-colors">
            ← Semanas
          </Link>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estadoCfg.cls}`}>
            {estadoCfg.label}
          </span>
        </div>
        <p className="text-sm font-bold text-gray-900 truncate">{menu.nombre}</p>
        <div className="mt-2 flex gap-0">
          <Link
            to={`/semanas/${id}`}
            className="px-4 pb-2 text-sm font-medium text-gray-500 hover:text-gray-800 border-b-2 border-transparent -mb-px transition-colors"
          >
            Oferta
          </Link>
          <span className="px-4 pb-2 text-sm font-semibold text-brand-700 border-b-2 border-brand-600 -mb-px">
            Disenar menu
          </span>
        </div>
      </div>

      {/* Columnas */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Columna izquierda: lista de dias */}
      <div className="w-52 flex-shrink-0 border-r border-gray-100 bg-white overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs text-gray-500 truncate">{menu.nombre}</p>
        </div>

        {/* Lista de dias */}
        <div className="py-2">
          {DIAS.map((dia) => {
            const dDatos = datosPorDia[dia];
            const cuenta = (dDatos?.slots ?? []).length + (dDatos?.fijos ?? []).length;
            const esSinServicio = dDatos?.sinServicio;
            return (
              <button
                key={dia}
                type="button"
                onClick={() => setDiaActivo(dia)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  diaActivo === dia ? 'bg-brand-50 text-brand-800' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-sm font-medium">{DIA_LABEL[dia]}</span>
                {esSinServicio ? (
                  <span className="text-[10px] text-red-400">sin serv.</span>
                ) : cuenta > 0 ? (
                  <span className={`text-xs font-semibold ${diaActivo === dia ? 'text-brand-600' : 'text-gray-500'}`}>{cuenta}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Columna central: platos del dia */}
      <div className="flex-1 overflow-y-auto p-5">
        <PanelDia
          dia={diaActivo}
          datos={datosPorDia[diaActivo]}
          siempre={siempre}
          guarnicionesMap={guarnicionesMap}
          salsasMap={salsasMap}
          onAbrirPicker={handleAbrirPicker}
          onQuitar={handleQuitarConDia}
          onEditarGuarnicion={handleEditarGuarnicion}
          onEditarEmpresas={handleEditarEmpresas}
          onToggleSinServicio={handleToggleSinServicio}
          agregarPending={agregarMutation.isPending || quitarMutation.isPending || actualizarGuarnicionM.isPending || actualizarSalsaM.isPending || setEmpresasMutation.isPending}
          sinServicioPending={sinServicioPending}
        />
      </div>

      {/* Columna derecha: tabs empresas / sugerencias */}
      <div className="w-56 flex-shrink-0 border-l border-gray-100 bg-gray-50 flex flex-col overflow-hidden">
        <div className="flex border-b border-gray-100 bg-white">
          {[['empresas', 'Empresas'], ['sugerencias', 'Sugerencias']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTabDerecha(key)}
              className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors border-b-2 ${
                tabDerecha === key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tabDerecha === 'empresas' ? (
            <PanelEmpresas datos={datosPorDia[diaActivo]} siempre={siempre} />
          ) : (
            <PanelSugerencias semanaInicio={menu.fecha_inicio?.slice(0, 10)} />
          )}
        </div>
      </div>
      </div>{/* fin columnas */}

      {/* Drawer picker (2 pasos) */}
      <SideDrawer
        open={!!picker}
        onClose={() => setPicker(null)}
        title={
          !picker ? '' :
          picker.step === 'plato' ? `Agregar vianda a ${DIA_LABEL[picker.dia]}` :
          picker.step === 'guarnicion' ? `Guarnicion y salsa — ${DIA_LABEL[picker.dia]}` :
          picker.step === 'empresas' ? (picker.editOnly ? `Visibilidad — ${DIA_LABEL[picker.dia]} op. ${picker.opcion}` : `Visibilidad — ${DIA_LABEL[picker.dia]}`) :
          ''
        }
        width="md"
      >
        <div className="p-5">
          {picker?.step === 'plato' && (
            <BuscadorPlatos
              onSelect={handleSeleccionarPlato}
              platoIdsEnDia={(datosPorDia[picker.dia]?.slots ?? [])
                .map((s) => s.plato?.id).filter(Boolean)}
            />
          )}
          {picker?.step === 'guarnicion' && (
            <SelectorAcompanamientos
              plato={picker.plato}
              loading={actualizarGuarnicionM.isPending || actualizarSalsaM.isPending || agregarMutation.isPending}
              onConfirmar={handleConfirmarGuarnicion}
              onVolver={picker.editOnly ? null : () => setPicker((prev) => ({ ...prev, step: 'plato', plato: null }))}
            />
          )}
          {picker?.step === 'empresas' && (
            <SelectorEmpresas
              plato={picker.plato}
              guarnicionLabel={
                picker.guarnicion?.guarnicion_modo_override === 'libre' ? 'Guarnicion a eleccion' :
                picker.guarnicion?.guarnicion_modo_override === 'sin_guarnicion' ? 'Sin guarnicion' :
                picker.guarnicion?.guarnicion_modo_override === 'fija' ? 'Guarnicion fija' :
                'Como el plato'
              }
              loading={agregarMutation.isPending || setEmpresasMutation.isPending}
              onConfirmar={picker.editOnly
                ? (ids) => setEmpresasMutation.mutate(
                    { dia: picker.dia, opcion: picker.opcion, empresa_ids: ids },
                    {
                      onSuccess: () => { toast.success('Visibilidad actualizada'); setPicker(null); },
                      onError: (e) => toast.error(e?.response?.data?.message ?? e.message),
                    }
                  )
                : handleConfirmarEmpresas
              }
              onVolver={picker.editOnly ? null : () => setPicker((prev) => ({ ...prev, step: 'guarnicion' }))}
            />
          )}
        </div>
      </SideDrawer>
    </div>
  );
}
