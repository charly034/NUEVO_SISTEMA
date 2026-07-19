import { useState } from 'react';
import { useEmpleados, useUpdateEmpleado, useDeleteEmpleado, useCreateEmpleado, useGenerarResetCode } from '../hooks/useEmpleados.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import { toast } from '../lib/toast.js';
import { confirmar } from '../lib/confirm.js';
import { adminAuth } from '../auth.js';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import Modal from '../components/ui/Modal.jsx';

function normalizarFechaInput(fecha) {
  return fecha ? String(fecha).split('T')[0] : '';
}

const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function DrawerClienteFinal({ empleado, empresas, onCerrar }) {
  const esNuevo = !empleado?.id;
  const createEmpleado = useCreateEmpleado();
  const updateEmpleado = useUpdateEmpleado();

  const [form, setForm] = useState({
    empresa_id: empleado?.empresa_id || empresas[0]?.id || '',
    nombre: empleado?.nombre || '',
    apellido: empleado?.apellido || '',
    email: empleado?.email || '',
    telefono: empleado?.telefono || '',
    fecha_nacimiento: normalizarFechaInput(empleado?.fecha_nacimiento),
    password: '',
    rol: empleado?.rol || 'cliente',
  });
  const [errores, setErrores] = useState({});

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrores(prev => ({ ...prev, [k]: '' }));
  };

  const validar = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'Requerido';
    if (!form.apellido.trim()) e.apellido = 'Requerido';
    if (!form.email.trim()) {
      e.email = 'Requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = 'Email invalido';
    }
    if (esNuevo && !form.password) e.password = 'Requerido para cuenta nueva';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validar()) return;
    const payload = {
      ...form,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      email: form.email.trim(),
      empresa_id: Number(form.empresa_id),
      fecha_nacimiento: form.fecha_nacimiento || null,
      telefono: form.telefono || null,
    };
    try {
      if (esNuevo) {
        await createEmpleado.mutateAsync(payload);
        toast.success('Cliente creado');
      } else {
        const { password, ...rest } = payload;
        await updateEmpleado.mutateAsync({ id: empleado.id, data: password ? { ...rest, password } : rest });
        toast.success('Cliente actualizado');
      }
      onCerrar();
    } catch (err) {
      toast.error(err?.message || 'Error al guardar');
    }
  };

  const isPending = createEmpleado.isPending || updateEmpleado.isPending;

  return (
    <SideDrawer open title={esNuevo ? 'Nuevo cliente final' : 'Editar cliente final'} onClose={onCerrar} width="md">
      <form onSubmit={handleSubmit} className="flex flex-col h-full" noValidate>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Campo label="Empresa">
            <select className={inputClass} value={form.empresa_id} onChange={e => set('empresa_id', e.target.value)}>
              {empresas.map(em => <option key={em.id} value={em.id}>{em.nombre}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nombre">
              <input className={inputClass} value={form.nombre} onChange={e => set('nombre', e.target.value)} autoComplete="off" />
              {errores.nombre && <p className="mt-1 text-xs text-red-600">{errores.nombre}</p>}
            </Campo>
            <Campo label="Apellido">
              <input className={inputClass} value={form.apellido} onChange={e => set('apellido', e.target.value)} autoComplete="off" />
              {errores.apellido && <p className="mt-1 text-xs text-red-600">{errores.apellido}</p>}
            </Campo>
          </div>
          <Campo label="Email">
            <input className={inputClass} type="email" value={form.email} onChange={e => set('email', e.target.value)} autoComplete="off" />
            {errores.email && <p className="mt-1 text-xs text-red-600">{errores.email}</p>}
          </Campo>
          <Campo label="Telefono">
            <input className={inputClass} value={form.telefono} onChange={e => set('telefono', e.target.value)} />
          </Campo>
          <Campo label="Fecha de nacimiento">
            <input className={inputClass} type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} />
          </Campo>
          <Campo label="Rol">
            <select className={inputClass} value={form.rol} onChange={e => set('rol', e.target.value)}>
              <option value="cliente">Cliente</option>
              <option value="admin">Administrador de empresa</option>
            </select>
          </Campo>
          <Campo label={esNuevo ? 'Contrasena' : 'Nueva contrasena (dejar vacio para no cambiar)'}>
            <input className={inputClass} type="password" value={form.password} onChange={e => set('password', e.target.value)} autoComplete="new-password" />
            {errores.password && <p className="mt-1 text-xs text-red-600">{errores.password}</p>}
          </Campo>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-5 py-4 flex-shrink-0">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
            {isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </SideDrawer>
  );
}

function ModalResetCode({ data, onCerrar }) {
  return (
    <Modal open={Boolean(data)} onClose={onCerrar} title="Codigo de recuperacion">
      <p className="text-sm text-gray-500 mb-4">
        Compartilo con el cliente para que pueda cambiar su contrasena en la app.
      </p>
      <div className="rounded-lg bg-brand-50 px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest text-brand-800 mb-4">
        {data?.codigo}
      </div>
      {data?.expira && (
        <p className="text-xs text-gray-500 text-center mb-4">
          Expira: {new Date(data.expira).toLocaleString('es-AR')}
        </p>
      )}
      <button onClick={onCerrar} className="w-full rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">
        Cerrar
      </button>
    </Modal>
  );
}

export default function ClientesFinales() {
  const esSuperAdmin = adminAuth.storedUser()?.rol === 'superadmin';
  const { data: todosEmpleados = [], isLoading } = useEmpleados();
  const { data: empresas = [] } = useEmpresas();
  const updateEmpleado = useUpdateEmpleado();
  const deleteEmpleado = useDeleteEmpleado();
  const generarReset = useGenerarResetCode();

  const [busqueda, setBusqueda] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [drawerEmpleado, setDrawerEmpleado] = useState(null);
  const [resetModal, setResetModal] = useState(null);

  const clientes = todosEmpleados.filter(e => e.rol !== 'admin');

  const filtrados = clientes.filter(e => {
    if (filtroEmpresa && String(e.empresa_id) !== String(filtroEmpresa)) return false;
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      e.nombre?.toLowerCase().includes(q) ||
      e.apellido?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-56"
          placeholder="Buscar nombre o email..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filtroEmpresa}
          onChange={e => setFiltroEmpresa(e.target.value)}
        >
          <option value="">Todas las empresas</option>
          {empresas.map(em => <option key={em.id} value={em.id}>{em.nombre}</option>)}
        </select>
        <button
          onClick={() => setDrawerEmpleado({})}
          className="ml-auto rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          + Nuevo cliente
        </button>
      </div>

      <p className="mb-3 text-xs text-gray-500">{filtrados.length} clientes finales</p>

      {isLoading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
          {filtrados.map(emp => (
            <div key={emp.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {emp.nombre} {emp.apellido}
                </p>
                <p className="text-xs text-gray-500">{emp.email}</p>
                <p className="mt-0.5 text-xs text-gray-500">{emp.empresa_nombre}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  onClick={() => updateEmpleado.mutate({ id: emp.id, data: { activo: !emp.activo } })}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${emp.activo ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {emp.activo ? 'Activo' : 'Inactivo'}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const data = await generarReset.mutateAsync(emp.id);
                      setResetModal(data);
                    } catch (err) {
                      toast.error(err?.message || 'Error generando codigo');
                    }
                  }}
                  className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:border-gray-300 hover:text-gray-800"
                >
                  Recuperar clave
                </button>
                <button
                  onClick={() => setDrawerEmpleado(emp)}
                  className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:border-gray-300 hover:text-gray-800"
                >
                  Editar
                </button>
                {esSuperAdmin && (
                  <button
                    onClick={async () => {
                      const ok = await confirmar({
                        titulo: 'Eliminar cliente',
                        texto: `Eliminar a ${emp.nombre} ${emp.apellido}? Esta accion no se puede deshacer.`,
                        botonConfirmar: 'Eliminar',
                      });
                      if (!ok) return;
                      try {
                        await deleteEmpleado.mutateAsync(emp.id);
                        toast.success('Cliente eliminado');
                      } catch (err) {
                        toast.error(err?.message || 'Error');
                      }
                    }}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:border-red-300 hover:text-red-800"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-500">
              Sin clientes finales registrados.
            </p>
          )}
        </div>
      )}

      {drawerEmpleado !== null && (
        <DrawerClienteFinal
          empleado={drawerEmpleado}
          empresas={empresas}
          onCerrar={() => setDrawerEmpleado(null)}
        />
      )}

      {resetModal && (
        <ModalResetCode data={resetModal} onCerrar={() => setResetModal(null)} />
      )}
    </div>
  );
}