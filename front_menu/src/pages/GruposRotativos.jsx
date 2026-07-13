import { useState } from 'react';
import {
  useCiclosRotativos, useCicloDetalle, useCrearCiclo, useActualizarCiclo,
  useCrearGrupo, useAgregarPlatoAGrupo, useQuitarPlatoDeGrupo, useForzarSeleccionSemana,
} from '../hooks/useGruposRotativos.js';
import { useMenusSemanales } from '../hooks/useMenus.js';
import { usePlatos } from '../hooks/usePlatos.js';
import Spinner from '../components/ui/Spinner.jsx';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import { toast } from '../lib/toast.js';

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500';

const DIA_LABEL = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};
const DIAS = Object.keys(DIA_LABEL);

function FormNuevoGrupo({ cicloId, siguienteOrden }) {
  const [nombre, setNombre] = useState('');
  const crearGrupo = useCrearGrupo(cicloId);

  const onCrear = () => {
    if (!nombre.trim()) return;
    crearGrupo.mutate(
      { ciclo_rotacion_id: cicloId, nombre: nombre.trim(), orden: siguienteOrden },
      {
        onSuccess: () => { toast.success('Grupo creado'); setNombre(''); },
        onError: (e) => toast.error(e?.message || 'No se pudo crear el grupo'),
      }
    );
  };

  return (
    <div className="flex gap-2">
      <input
        className={inputClass}
        placeholder="Nombre del grupo (ej: Grupo A)"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <button type="button" onClick={onCrear} disabled={!nombre.trim() || crearGrupo.isPending} className="btn-secondary whitespace-nowrap disabled:opacity-50">
        Agregar grupo
      </button>
    </div>
  );
}

function GrupoDetalle({ cicloId, grupo, platosDisponibles }) {
  const [platoSeleccionado, setPlatoSeleccionado] = useState('');
  const agregarPlato = useAgregarPlatoAGrupo(cicloId);
  const quitarPlato = useQuitarPlatoDeGrupo(cicloId);

  const onAgregar = () => {
    if (!platoSeleccionado) return;
    agregarPlato.mutate(
      { grupoId: grupo.id, plato_id: Number(platoSeleccionado), orden: grupo.platos.length === 0 ? 0 : grupo.platos.length },
      {
        onSuccess: () => { toast.success('Plato agregado al grupo'); setPlatoSeleccionado(''); },
        onError: (e) => toast.error(e?.message || 'No se pudo agregar el plato'),
      }
    );
  };

  const onQuitar = (platoId) => {
    quitarPlato.mutate(
      { grupoId: grupo.id, platoId },
      { onError: (e) => toast.error(e?.message || 'No se pudo quitar el plato') }
    );
  };

  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2">
      <p className="font-medium text-gray-900 text-sm">{grupo.nombre}</p>
      {grupo.platos.length === 0 ? (
        <p className="text-xs text-gray-400">Sin platos todavía.</p>
      ) : (
        <ul className="space-y-1">
          {grupo.platos.map((p) => (
            <li key={p.plato_id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">
                {p.orden === 0 && <span title="Plato por defecto del grupo">⭐ </span>}
                {p.plato_nombre}
              </span>
              <button type="button" onClick={() => onQuitar(p.plato_id)} className="text-xs text-gray-400 hover:text-red-600 hover:underline">
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 pt-1">
        <select className={inputClass} value={platoSeleccionado} onChange={(e) => setPlatoSeleccionado(e.target.value)}>
          <option value="">Agregar plato…</option>
          {(platosDisponibles || []).map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <button type="button" onClick={onAgregar} disabled={!platoSeleccionado || agregarPlato.isPending} className="btn-secondary whitespace-nowrap disabled:opacity-50">
          Agregar
        </button>
      </div>
    </div>
  );
}

function ForzarExcepcion({ cicloId, grupos }) {
  const { data: menus } = useMenusSemanales({ limit: 20 });
  const [form, setForm] = useState({ menu_semanal_id: '', grupo_rotativo_id: '', plato_id: '' });
  const forzar = useForzarSeleccionSemana(cicloId);

  const grupoElegido = grupos.find((g) => String(g.id) === form.grupo_rotativo_id);

  const onAplicar = () => {
    if (!form.menu_semanal_id || !form.grupo_rotativo_id) return;
    forzar.mutate(
      {
        menu_semanal_id: Number(form.menu_semanal_id),
        ciclo_rotacion_id: cicloId,
        grupo_rotativo_id: Number(form.grupo_rotativo_id),
        plato_id: form.plato_id ? Number(form.plato_id) : undefined,
      },
      {
        onSuccess: () => toast.success('Excepción aplicada para esa semana'),
        onError: (e) => toast.error(e?.message || 'No se pudo aplicar la excepción'),
      }
    );
  };

  return (
    <div className="space-y-2">
      <select className={inputClass} value={form.menu_semanal_id} onChange={(e) => setForm((s) => ({ ...s, menu_semanal_id: e.target.value }))}>
        <option value="">Elegir semana…</option>
        {(menus?.menus || []).map((m) => (
          <option key={m.id} value={m.id}>{m.nombre}</option>
        ))}
      </select>
      <select className={inputClass} value={form.grupo_rotativo_id} onChange={(e) => setForm((s) => ({ ...s, grupo_rotativo_id: e.target.value, plato_id: '' }))}>
        <option value="">Forzar este grupo…</option>
        {grupos.map((g) => (
          <option key={g.id} value={g.id}>{g.nombre}</option>
        ))}
      </select>
      {grupoElegido && (
        <select className={inputClass} value={form.plato_id} onChange={(e) => setForm((s) => ({ ...s, plato_id: e.target.value }))}>
          <option value="">Plato por defecto del grupo</option>
          {grupoElegido.platos.map((p) => (
            <option key={p.plato_id} value={p.plato_id}>{p.plato_nombre}</option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={onAplicar}
        disabled={!form.menu_semanal_id || !form.grupo_rotativo_id || forzar.isPending}
        className="btn-primary w-full disabled:opacity-50"
      >
        Forzar solo esa semana
      </button>
      <p className="text-xs text-gray-400">No afecta la rotación automática de las demás semanas.</p>
    </div>
  );
}

function DrawerCiclo({ cicloId }) {
  const { data: ciclo, isLoading } = useCicloDetalle(cicloId);
  const { data: platos } = usePlatos({ page: 1, limit: 500, activo: 'true' });
  const actualizarCiclo = useActualizarCiclo();

  if (isLoading || !ciclo) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  const onToggleActivo = () => {
    actualizarCiclo.mutate(
      { id: ciclo.id, data: { activo: !ciclo.activo } },
      { onError: (e) => toast.error(e?.message || 'No se pudo actualizar') }
    );
  };

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{DIA_LABEL[ciclo.dia_semana]}</p>
          <p className="font-semibold text-gray-900">{ciclo.nombre}</p>
        </div>
        <button type="button" onClick={onToggleActivo} className={`badge ${ciclo.activo ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
          {ciclo.activo ? 'Activo' : 'Inactivo'}
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grupos ({ciclo.grupos.length})</p>
        {ciclo.grupos.map((grupo) => (
          <GrupoDetalle key={grupo.id} cicloId={ciclo.id} grupo={grupo} platosDisponibles={platos?.platos || []} />
        ))}
        <FormNuevoGrupo cicloId={ciclo.id} siguienteOrden={ciclo.grupos.length} />
      </div>

      {ciclo.grupos.length > 0 && (
        <div className="pt-4 border-t border-gray-100 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Forzar excepción una semana puntual</p>
          <ForzarExcepcion cicloId={ciclo.id} grupos={ciclo.grupos} />
        </div>
      )}
    </div>
  );
}

function FormNuevoCiclo({ onCreado }) {
  const [form, setForm] = useState({ dia_semana: '', nombre: '' });
  const crearCiclo = useCrearCiclo();

  const onCrear = () => {
    if (!form.dia_semana || !form.nombre.trim()) return;
    crearCiclo.mutate(
      { dia_semana: form.dia_semana, nombre: form.nombre.trim() },
      {
        onSuccess: (ciclo) => {
          toast.success('Ciclo de rotación creado');
          setForm({ dia_semana: '', nombre: '' });
          onCreado(ciclo.id);
        },
        onError: (e) => toast.error(e?.message || 'No se pudo crear el ciclo'),
      }
    );
  };

  return (
    <div className="card p-4 space-y-2">
      <p className="text-sm font-semibold text-gray-900">Nuevo ciclo de rotación</p>
      <div className="flex flex-col md:flex-row gap-2">
        <select className={inputClass} value={form.dia_semana} onChange={(e) => setForm((s) => ({ ...s, dia_semana: e.target.value }))}>
          <option value="">Día…</option>
          {DIAS.map((d) => <option key={d} value={d}>{DIA_LABEL[d]}</option>)}
        </select>
        <input
          className={inputClass}
          placeholder="Nombre (ej: Principal sábado)"
          value={form.nombre}
          onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
        />
        <button type="button" onClick={onCrear} disabled={!form.dia_semana || !form.nombre.trim() || crearCiclo.isPending} className="btn-primary whitespace-nowrap disabled:opacity-50">
          Crear ciclo
        </button>
      </div>
    </div>
  );
}

export default function GruposRotativos() {
  const { data: ciclos, isLoading, isError, error } = useCiclosRotativos();
  const [cicloAbierto, setCicloAbierto] = useState(null);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Ciclos rotativos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Platos fijos que rotan solos semana a semana en el canal vianda.
        </p>
      </div>

      <FormNuevoCiclo onCreado={setCicloAbierto} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : isError ? (
        <p className="text-sm text-red-600">{error?.message || 'No se pudieron cargar los ciclos'}</p>
      ) : ciclos.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">
          Todavía no creaste ningún ciclo de rotación.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Día</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ciclos.map((ciclo) => (
                <tr key={ciclo.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setCicloAbierto(ciclo.id)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{ciclo.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{DIA_LABEL[ciclo.dia_semana]}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${ciclo.activo ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                      {ciclo.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SideDrawer open={!!cicloAbierto} onClose={() => setCicloAbierto(null)} title="Ciclo de rotación" width="lg">
        {cicloAbierto && <DrawerCiclo cicloId={cicloAbierto} />}
      </SideDrawer>
    </div>
  );
}
