import { useState } from 'react';
import { useEmpresas, useCreateEmpresa, useUpdateEmpresa, useDeleteEmpresa, useReopenPlazo, useClearOverride, useRegenerarCodigo } from '../hooks/useEmpresas.js';
import { useEmpleados, useCreateEmpleado, useUpdateEmpleado, useDeleteEmpleado, useGenerarResetCode } from '../hooks/useEmpleados.js';
import { confirmar } from '../lib/confirm.js';
import { toast } from '../lib/toast.js';
import { adminAuth } from '../auth.js';

const PLANES = { basico: 'Básico', con_postre: 'Con postre', con_postre_bebida: 'Con postre y bebida' };
const MODOS = { semanal: 'Semanal', diario: 'Diario', ambos: 'Ambos' };
const DIAS_LAB = { lunes_viernes: 'Lunes a viernes', lunes_sabado: 'Lunes a sábado', lunes_domingo: 'Lunes a domingo' };

export default function Empresas() {
  const adminUser = adminAuth.storedUser();
  const esSuperAdmin = adminUser?.rol === 'superadmin';
  const { data: empresas = [], isLoading } = useEmpresas();
  const createEmpresa = useCreateEmpresa();
  const updateEmpresa = useUpdateEmpresa();
  const deleteEmpresa = useDeleteEmpresa();
  const reopenPlazo = useReopenPlazo();
  const clearOverride = useClearOverride();
  const regenerarCodigo = useRegenerarCodigo();

  const [empresaActiva, setEmpresaActiva] = useState(null);
  const [modalEmpresa, setModalEmpresa] = useState(null); // null | 'nueva' | empresa
  const [modalPlazo, setModalPlazo] = useState(null); // empresa | null

  const handleGuardarEmpresa = async (form) => {
    try {
      if (form.id) {
        await updateEmpresa.mutateAsync({ id: form.id, data: form });
        toast.success('Empresa actualizada');
      } else {
        await createEmpresa.mutateAsync(form);
        toast.success('Empresa creada');
      }
      setModalEmpresa(null);
    } catch (e) {
      toast.error(e?.message || 'Error al guardar');
    }
  };

  const handleEliminarEmpresa = async (e) => {
    if (!await confirmar({ titulo: `¿Eliminar "${e.nombre}"?`, texto: 'Se eliminarán todos sus empleados. Esta acción no se puede deshacer.', botonConfirmar: 'Sí, eliminar empresa' })) return;
    try {
      await deleteEmpresa.mutateAsync(e.id);
      if (empresaActiva?.id === e.id) setEmpresaActiva(null);
      toast.success('Empresa eliminada');
    } catch (err) {
      toast.error(err?.message || 'Error al eliminar');
    }
  };

  if (isLoading) return <p className="p-6 text-gray-500">Cargando...</p>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
        <button onClick={() => setModalEmpresa('nueva')} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-800">
          + Nueva empresa
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Lista de empresas */}
        <div className="space-y-3">
          {empresas.map(e => (
            <div
              key={e.id}
              onClick={() => setEmpresaActiva(e)}
              className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-colors ${empresaActiva?.id === e.id ? 'border-green-600' : 'border-gray-100 hover:border-gray-300'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-900">{e.nombre}</p>
                  <p className="text-xs text-gray-500 mt-0.5">@{e.slug} · {PLANES[e.plan]} · {MODOS[e.modo_pedido]}</p>
                  {e.limite_hora && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      ⏰ {e.modo_pedido === 'semanal'
                        ? `Límite: ${e.limite_dia_semana || 'lunes'} ${e.limite_hora}hs`
                        : e.limite_anticipacion_dias > 0
                          ? `Límite: día anterior ${e.limite_hora}hs`
                          : `Límite: mismo día ${e.limite_hora}hs`}
                    </p>
                  )}
                  {e.plazo_override_hasta && new Date() <= new Date(e.plazo_override_hasta) && (
                    <p className="text-xs text-green-700 mt-0.5 font-medium">
                      🔓 Plazo reabierto hasta {new Date(e.plazo_override_hasta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}hs
                    </p>
                  )}
                  {/* Código de registro */}
                  {e.codigo_registro ? (
                    <div className="mt-2 flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 w-fit" onClick={ev => ev.stopPropagation()}>
                      <span className="text-xs text-indigo-500 font-medium">Código</span>
                      <span className="font-mono font-bold text-indigo-800 tracking-widest text-sm">{e.codigo_registro}</span>
                      <button
                        type="button"
                        title="Copiar"
                        onClick={() => { navigator.clipboard.writeText(e.codigo_registro); toast.success('Código copiado'); }}
                        className="text-indigo-400 hover:text-indigo-700 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                      {esSuperAdmin && (
                      <button
                        type="button"
                        title="Regenerar código"
                        onClick={async () => { if (await confirmar('¿Regenerar código? El código anterior dejará de funcionar y los empleados deberán usar el nuevo.')) { regenerarCodigo.mutate(e.id, { onSuccess: () => toast.success('Código regenerado') }); } }}
                        className="text-indigo-300 hover:text-red-500 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                      </button>
                      )}
                    </div>
                  ) : (
                    esSuperAdmin && (
                    <button
                      type="button"
                      onClick={async (ev) => { ev.stopPropagation(); regenerarCodigo.mutate(e.id, { onSuccess: () => toast.success('Código generado') }); }}
                      className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg font-medium transition-colors"
                    >
                      🔑 Generar código de registro
                    </button>
                    )
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  {(e.limite_hora || e.modo_pedido === 'semanal' || e.modo_pedido === 'ambos') && (
                    <button
                      onClick={(ev) => { ev.stopPropagation(); setModalPlazo(e); }}
                      className="text-xs text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg font-medium"
                      title="Reabrir plazo de pedido"
                    >
                      🔓
                    </button>
                  )}
                  <button onClick={(ev) => { ev.stopPropagation(); setModalEmpresa(e); }} className="text-gray-400 hover:text-gray-700 text-sm">✏️</button>
                  {esSuperAdmin && (
                  <button onClick={(ev) => { ev.stopPropagation(); handleEliminarEmpresa(e); }} className="text-gray-400 hover:text-red-600 text-sm">🗑️</button>
                  )}
                </div>
              </div>
              <div className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${e.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {e.activo ? 'Activa' : 'Inactiva'}
              </div>
            </div>
          ))}
          {empresas.length === 0 && <p className="text-gray-400 text-sm">No hay empresas cargadas.</p>}
        </div>

        {/* Panel de empleados */}
        {empresaActiva && (
          <EmpleadosPanel empresa={empresaActiva} esSuperAdmin={esSuperAdmin} />
        )}
      </div>

      {/* Modal empresa */}
      {modalEmpresa && (
        <ModalEmpresa
          empresa={modalEmpresa === 'nueva' ? null : modalEmpresa}
          onGuardar={handleGuardarEmpresa}
          onCerrar={() => setModalEmpresa(null)}
          loading={createEmpresa.isPending || updateEmpresa.isPending}
        />
      )}

      {/* Modal reabrir plazo */}
      {modalPlazo && (
        <ModalReopenPlazo
          empresa={modalPlazo}
          onReabrir={async (horas) => {
            try {
              await reopenPlazo.mutateAsync({ id: modalPlazo.id, horas });
              toast.success(`Plazo reabierto por ${horas}h`);
              setModalPlazo(null);
            } catch (e) { toast.error(e?.message || 'Error'); }
          }}
          onCerrarOverride={async () => {
            try {
              await clearOverride.mutateAsync(modalPlazo.id);
              toast.success('Override de plazo eliminado');
              setModalPlazo(null);
            } catch (e) { toast.error(e?.message || 'Error'); }
          }}
          onCerrar={() => setModalPlazo(null)}
          loading={reopenPlazo.isPending || clearOverride.isPending}
        />
      )}

    </div>
  );
}

function EmpleadosPanel({ empresa, esSuperAdmin }) {
  const { data: todosEmpleados = [] } = useEmpleados(empresa.id);
  const empleados = todosEmpleados.filter(e => e.rol !== 'admin');
  const updateEmpleado = useUpdateEmpleado();
  const deleteEmpleado = useDeleteEmpleado();
  const generarReset = useGenerarResetCode();
  const [modalEmpleado, setModalEmpleado] = useState(null);
  const [modalReset, setModalReset] = useState(null); // { codigo, expira, empleado }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-gray-800">Empleados — {empresa.nombre}</h2>
        <button onClick={() => setModalEmpleado({ empresa_id: empresa.id })} className="text-green-700 text-sm font-semibold hover:underline">
          + Agregar
        </button>
      </div>

      <div className="space-y-2">
        {empleados.map(emp => (
          <div key={emp.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
            <div>
              <p className="font-medium text-sm">{emp.nombre} {emp.apellido}</p>
              <p className="text-xs text-gray-400">{emp.email} · {emp.rol === 'admin' ? 'Administrador' : 'Cliente'}</p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => updateEmpleado.mutate({ id: emp.id, data: { activo: !emp.activo } })}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {emp.activo ? 'Activo' : 'Inactivo'}
              </button>
              <button
                onClick={async () => {
                  try {
                    const data = await generarReset.mutateAsync(emp.id);
                    setModalReset(data);
                  } catch (e) { toast.error(e?.message || 'Error generando código'); }
                }}
                title="Generar código de recuperación de contraseña"
                className="text-gray-400 hover:text-amber-600 text-sm"
              >🔑</button>
              <button onClick={() => setModalEmpleado(emp)} className="text-gray-400 hover:text-gray-700 text-sm">✏️</button>
              {esSuperAdmin && (
              <button
                onClick={async () => {
                  if (!await confirmar({ titulo: `¿Eliminar a ${emp.nombre} ${emp.apellido}?`, texto: 'Esta acción no se puede deshacer.', botonConfirmar: 'Sí, eliminar' })) return;
                  try {
                    await deleteEmpleado.mutateAsync(emp.id);
                    toast.success('Empleado eliminado');
                  } catch (e) { toast.error(e?.message || 'Error'); }
                }}
                className="text-gray-400 hover:text-red-600 text-sm"
              >🗑️</button>
              )}
            </div>
          </div>
        ))}
        {empleados.length === 0 && <p className="text-gray-400 text-sm">Sin empleados aún.</p>}
      </div>

      {modalEmpleado && (
        <ModalEmpleado
          empresas={[empresa]}
          empleado={modalEmpleado}
          onCerrar={() => setModalEmpleado(null)}
        />
      )}

      {/* Modal código de recuperación */}
      {modalReset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🔑</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Código de recuperación</h3>
            <p className="text-sm text-gray-500 mb-4">
              Para <strong>{modalReset.empleado}</strong>. Compartíselo por WhatsApp o mensaje. Expira el <strong>{modalReset.expira}</strong>.
            </p>
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
              <span className="font-mono font-bold text-2xl tracking-widest text-amber-800 flex-1 text-center">
                {modalReset.codigo}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(modalReset.codigo); toast.success('Código copiado'); }}
                className="text-amber-500 hover:text-amber-700 flex-shrink-0"
                title="Copiar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              El empleado debe ir a "¿Olvidaste tu contraseña?" en la app e ingresar este código.
            </p>
            <button
              onClick={() => setModalReset(null)}
              className="w-full bg-gray-900 text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const DIAS_LABEL = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' };

function ModalEmpresa({ empresa, onGuardar, onCerrar, loading }) {
  const [form, setForm] = useState({
    nombre: empresa?.nombre || '',
    slug: empresa?.slug || '',
    plan: empresa?.plan || 'basico',
    modo_pedido: empresa?.modo_pedido || 'semanal',
    dias_laborales: empresa?.dias_laborales || 'lunes_viernes',
    activo: empresa?.activo ?? true,
    limite_hora: empresa?.limite_hora ? empresa.limite_hora.slice(0, 5) : '',
    limite_dia_semana: empresa?.limite_dia_semana || 'lunes',
    limite_anticipacion_dias: empresa?.limite_anticipacion_dias ?? 0,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    // Si no pusieron hora, limpiar los límites
    if (!data.limite_hora) {
      data.limite_hora = null;
      data.limite_dia_semana = null;
      data.limite_anticipacion_dias = 0;
    }
    onGuardar(empresa ? { ...data, id: empresa.id } : data);
  };

  const modo = form.modo_pedido;
  const tieneHora = !!form.limite_hora;

  return (
    <Modal onCerrar={onCerrar} titulo={empresa ? 'Editar empresa' : 'Nueva empresa'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Campo label="Nombre">
          <input className={input} required value={form.nombre} onChange={e => set('nombre', e.target.value)} />
        </Campo>
        <Campo label="Slug (identificador único, sin espacios)">
          <input className={input} required value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="ej: universidad-mendoza" />
        </Campo>
        <Campo label="Plan">
          <select className={input} value={form.plan} onChange={e => set('plan', e.target.value)}>
            {Object.entries(PLANES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Campo>
        <Campo label="Modo de pedido">
          <select className={input} value={form.modo_pedido} onChange={e => set('modo_pedido', e.target.value)}>
            {Object.entries(MODOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Campo>
        <Campo label="Días laborales">
          <select className={input} value={form.dias_laborales} onChange={e => set('dias_laborales', e.target.value)}>
            {Object.entries(DIAS_LAB).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Campo>

        {/* ── Configuración de límite ─────────────────────────── */}
        <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Límite de pedidos</p>

          <Campo label="Hora de corte (dejar vacío = sin límite)">
            <input
              className={input}
              type="time"
              value={form.limite_hora}
              onChange={e => set('limite_hora', e.target.value)}
              placeholder="10:00"
            />
          </Campo>

          {tieneHora && (modo === 'semanal' || modo === 'ambos') && (
            <Campo label="Día límite (para pedido semanal)">
              <select className={input} value={form.limite_dia_semana} onChange={e => set('limite_dia_semana', e.target.value)}>
                {DIAS_SEMANA.map(d => <option key={d} value={d}>{DIAS_LABEL[d]}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Los empleados deben pedir antes del {DIAS_LABEL[form.limite_dia_semana] || '—'} a las {form.limite_hora}hs.
              </p>
            </Campo>
          )}

          {tieneHora && (modo === 'diario' || modo === 'ambos') && (
            <Campo label="Anticipación requerida (para pedido diario)">
              <select className={input} value={form.limite_anticipacion_dias} onChange={e => set('limite_anticipacion_dias', parseInt(e.target.value))}>
                <option value={0}>Mismo día hasta las {form.limite_hora}hs</option>
                <option value={1}>Día anterior hasta las {form.limite_hora}hs</option>
              </select>
            </Campo>
          )}

          {!tieneHora && (
            <p className="text-xs text-gray-400">Sin límite: los empleados pueden pedir hasta que cerrés el menú manualmente.</p>
          )}
        </div>

        {empresa && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)} />
            Activa
          </label>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button type="submit" disabled={loading} className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalEmpleado({ empresas, empleado, onCerrar }) {
  const createEmpleado = useCreateEmpleado();
  const updateEmpleado = useUpdateEmpleado();
  const esNuevo = !empleado?.email;

  const [form, setForm] = useState({
    empresa_id: empleado?.empresa_id || empresas[0]?.id || '',
    nombre: empleado?.nombre || '',
    apellido: empleado?.apellido || '',
    email: empleado?.email || '',
    password: '',
    rol: empleado?.rol || 'cliente',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (esNuevo) {
      await createEmpleado.mutateAsync(form);
    } else {
      const { password, ...rest } = form;
      const data = password ? { ...rest, password } : rest;
      await updateEmpleado.mutateAsync({ id: empleado.id, data });
    }
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar} titulo={esNuevo ? 'Nuevo empleado' : 'Editar empleado'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Campo label="Empresa">
          <select className={input} value={form.empresa_id} onChange={e => set('empresa_id', parseInt(e.target.value))}>
            {empresas.map(em => <option key={em.id} value={em.id}>{em.nombre}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Nombre">
            <input className={input} required value={form.nombre} onChange={e => set('nombre', e.target.value)} />
          </Campo>
          <Campo label="Apellido">
            <input className={input} required value={form.apellido} onChange={e => set('apellido', e.target.value)} />
          </Campo>
        </div>
        <Campo label="Email">
          <input className={input} type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="martin@empresa.com" />
        </Campo>
        <Campo label={esNuevo ? 'Contraseña' : 'Nueva contraseña (dejar vacío para no cambiar)'}>
          <input className={input} type="password" required={esNuevo} value={form.password} onChange={e => set('password', e.target.value)} placeholder={esNuevo ? '' : '••••••••'} />
        </Campo>
        <Campo label="Rol">
          <select className={input} value={form.rol} onChange={e => set('rol', e.target.value)}>
            <option value="cliente">Cliente</option>
            <option value="admin">Administrador</option>
          </select>
        </Campo>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
          <button type="submit" disabled={createEmpleado.isPending || updateEmpleado.isPending} className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
            {createEmpleado.isPending || updateEmpleado.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b flex-shrink-0">
          <h3 className="font-bold text-lg">{titulo}</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return <label className="block"><span className="text-sm font-semibold text-gray-700 block mb-1">{label}</span>{children}</label>;
}

function ModalReopenPlazo({ empresa, onReabrir, onCerrarOverride, onCerrar, loading }) {
  const [horas, setHoras] = useState(2);
  const tieneOverrideActivo = empresa.plazo_override_hasta && new Date() <= new Date(empresa.plazo_override_hasta);

  return (
    <Modal onCerrar={onCerrar} titulo={`Reabrir plazo — ${empresa.nombre}`}>
      <div className="space-y-4">
        {tieneOverrideActivo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800 font-medium">
              🔓 Plazo actualmente abierto hasta las{' '}
              {new Date(empresa.plazo_override_hasta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}hs
            </p>
            <button
              onClick={onCerrarOverride}
              disabled={loading}
              className="mt-2 text-xs text-red-600 hover:text-red-800 font-medium hover:underline"
            >
              Cerrar ventana ahora
            </button>
          </div>
        )}

        <p className="text-sm text-gray-600">
          Esto permite que los empleados de <strong>{empresa.nombre}</strong> hagan o modifiquen su pedido aunque haya pasado el límite habitual.
        </p>

        <Campo label="Abrir por cuántas horas">
          <select
            className={input}
            value={horas}
            onChange={e => setHoras(parseInt(e.target.value))}
          >
            <option value={1}>1 hora</option>
            <option value={2}>2 horas</option>
            <option value={4}>4 horas</option>
            <option value={8}>8 horas (hasta mañana)</option>
            <option value={24}>24 horas</option>
          </select>
        </Campo>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button
            onClick={() => onReabrir(horas)}
            disabled={loading}
            className="bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? 'Abriendo...' : `Reabrir por ${horas}h`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500';
