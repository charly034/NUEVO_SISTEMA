import { useState } from 'react';
import {
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
} from '../hooks/useAdminUsers.js';
import { adminAuth } from '../auth.js';
import { confirmar } from '../lib/confirm.js';
import { toast } from '../lib/toast.js';

const ROLES = {
  admin: 'Admin operativo',
  superadmin: 'Superadmin',
};

function fechaCorta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function Administradores() {
  const adminActual = adminAuth.storedUser();
  const esSuperAdmin = adminActual?.rol === 'superadmin';
  const { data: usuarios = [], isLoading, isError, error } = useAdminUsers(esSuperAdmin);
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();
  const [modalUser, setModalUser] = useState(null);

  if (!esSuperAdmin) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="bg-white border border-amber-100 rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <h1 className="text-xl font-bold text-gray-900">Acceso reservado</h1>
          <p className="text-sm text-gray-500 mt-2">
            La gestión de administradores está disponible solo para usuarios superadmin.
          </p>
        </div>
      </div>
    );
  }

  const cambiarEstado = async (usuario) => {
    if (usuario.id === adminActual?.id && usuario.activo) {
      toast.warning('No podés desactivar tu propio usuario');
      return;
    }
    try {
      await updateUser.mutateAsync({ id: usuario.id, data: { activo: !usuario.activo } });
      toast.success(usuario.activo ? 'Usuario desactivado' : 'Usuario activado');
    } catch (e) {
      toast.error(e?.message || 'No se pudo actualizar');
    }
  };

  const eliminar = async (usuario) => {
    if (usuario.id === adminActual?.id) {
      toast.warning('No podés eliminar tu propio usuario');
      return;
    }
    const ok = await confirmar({
      titulo: `¿Eliminar a ${usuario.nombre} ${usuario.apellido}?`,
      texto: 'Esta acción no se puede deshacer.',
      botonConfirmar: 'Sí, eliminar',
    });
    if (!ok) return;
    try {
      await deleteUser.mutateAsync(usuario.id);
      toast.success('Administrador eliminado');
    } catch (e) {
      toast.error(e?.message || 'No se pudo eliminar');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administradores</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestioná quién puede entrar al panel y qué nivel de permisos tiene.
          </p>
        </div>
        <button
          onClick={() => setModalUser({})}
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-800"
        >
          + Nuevo admin
        </button>
      </div>

      {isLoading && <p className="text-gray-500">Cargando administradores...</p>}
      {isError && <p className="text-red-600">{error?.message || 'No se pudieron cargar los administradores'}</p>}

      {!isLoading && !isError && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.5fr_1.3fr_0.8fr_0.8fr_1fr] gap-3 px-4 py-3 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
            <span>Usuario</span>
            <span>Email</span>
            <span>Rol</span>
            <span>Alta</span>
            <span className="text-right">Acciones</span>
          </div>

          <div className="divide-y divide-gray-100">
            {usuarios.map((usuario) => {
              const esActual = usuario.id === adminActual?.id;
              return (
                <div key={usuario.id} className="grid md:grid-cols-[1.5fr_1.3fr_0.8fr_0.8fr_1fr] gap-3 px-4 py-4 items-center">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {usuario.nombre} {usuario.apellido}
                      {esActual && <span className="ml-2 text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">Vos</span>}
                    </p>
                    <p className={`text-xs mt-1 ${usuario.activo ? 'text-green-700' : 'text-gray-400'}`}>
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 truncate" title={usuario.email}>{usuario.email}</p>
                  <p>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      usuario.rol === 'superadmin'
                        ? 'bg-purple-50 text-purple-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {ROLES[usuario.rol] ?? usuario.rol}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">{fechaCorta(usuario.created_at)}</p>
                  <div className="flex md:justify-end gap-2">
                    <button
                      onClick={() => cambiarEstado(usuario)}
                      disabled={updateUser.isPending || esActual}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      {usuario.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => setModalUser(usuario)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminar(usuario)}
                      disabled={deleteUser.isPending || esActual}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
            {usuarios.length === 0 && (
              <p className="px-4 py-8 text-center text-gray-400 text-sm">No hay administradores cargados.</p>
            )}
          </div>
        </div>
      )}

      {modalUser && (
        <AdminUserModal
          usuario={modalUser.id ? modalUser : null}
          adminActual={adminActual}
          onCerrar={() => setModalUser(null)}
        />
      )}
    </div>
  );
}

function AdminUserModal({ usuario, adminActual, onCerrar }) {
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const esNuevo = !usuario;
  const esActual = usuario?.id === adminActual?.id;
  const [form, setForm] = useState({
    nombre: usuario?.nombre || '',
    apellido: usuario?.apellido || '',
    email: usuario?.email || '',
    password: '',
    rol: usuario?.rol || 'admin',
    activo: usuario?.activo ?? true,
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const guardar = async (event) => {
    event.preventDefault();
    try {
      if (esNuevo) {
        await createUser.mutateAsync(form);
        toast.success('Administrador creado');
      } else {
        const { password, ...rest } = form;
        delete rest.email;
        const data = password ? { ...rest, password } : rest;
        await updateUser.mutateAsync({ id: usuario.id, data });
        toast.success('Administrador actualizado');
      }
      onCerrar();
    } catch (e) {
      toast.error(e?.message || 'No se pudo guardar');
    }
  };

  const loading = createUser.isPending || updateUser.isPending;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="font-bold text-lg">{esNuevo ? 'Nuevo administrador' : 'Editar administrador'}</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>

        <form onSubmit={guardar} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nombre">
              <input className={input} required value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </Campo>
            <Campo label="Apellido">
              <input className={input} required value={form.apellido} onChange={e => set('apellido', e.target.value)} />
            </Campo>
          </div>

          <Campo label="Email">
            <input
              className={`${input} ${!esNuevo ? 'bg-gray-50 text-gray-500' : ''}`}
              type="email"
              required
              disabled={!esNuevo}
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="admin@laquinta.com"
            />
          </Campo>

          <Campo label={esNuevo ? 'Contraseña' : 'Nueva contraseña (opcional)'}>
            <input
              className={input}
              type="password"
              required={esNuevo}
              minLength={8}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </Campo>

          <Campo label="Rol">
            <select
              className={input}
              value={form.rol}
              disabled={esActual}
              onChange={e => set('rol', e.target.value)}
            >
              <option value="admin">Admin operativo</option>
              <option value="superadmin">Superadmin</option>
            </select>
            {esActual && <p className="text-xs text-gray-400 mt-1">No podés cambiar tu propio rol.</p>}
          </Campo>

          {!esNuevo && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.activo}
                disabled={esActual}
                onChange={e => set('activo', e.target.checked)}
              />
              Usuario activo
            </label>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600">
              Cancelar
            </button>
            <button disabled={loading} className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-700 block mb-1">{label}</span>
      {children}
    </label>
  );
}

const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:cursor-not-allowed';
