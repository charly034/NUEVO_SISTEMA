import { useState } from 'react';
import { useAdminAuditoria } from '../hooks/useAdminAuditoria.js';
import Spinner from '../components/ui/Spinner.jsx';

const ENTIDADES = [
  ['', 'Todas las entidades'],
  ['menu_semanal', 'Menús semanales'],
  ['pedido', 'Pedidos'],
  ['empleado', 'Empleados'],
];

const ACCIONES = [
  ['', 'Todas las acciones'],
  ['crear', 'Crear'],
  ['actualizar', 'Actualizar'],
  ['eliminar', 'Eliminar'],
  ['duplicar', 'Duplicar'],
  ['cambiar_estado', 'Cambiar estado'],
  ['agregar_plato', 'Agregar plato'],
  ['quitar_plato', 'Quitar plato'],
  ['marcar_sin_servicio', 'Marcar sin servicio'],
  ['quitar_sin_servicio', 'Quitar sin servicio'],
  ['importar_csv', 'Importar CSV'],
];

function fecha(fechaIso) {
  return new Date(fechaIso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function JsonPreview({ label, value }) {
  if (value === null || value === undefined) return null;
  return (
    <details className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-gray-500">{label}</summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-gray-600">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export default function Auditoria() {
  const [entidad, setEntidad] = useState('');
  const [accion, setAccion] = useState('');
  const params = {
    limit: 100,
    entidad_tipo: entidad || undefined,
    accion: accion || undefined,
  };
  const { data, isLoading, isError, error, refetch } = useAdminAuditoria(params);
  const eventos = data?.eventos ?? [];

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>
          <p className="text-sm text-gray-500">Registro nivel 2 de acciones administrativas con antes/después cuando aplica.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={entidad} onChange={(event) => setEntidad(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            {ENTIDADES.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}
          </select>
          <select value={accion} onChange={(event) => setAccion(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            {ACCIONES.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      {isLoading && <div className="grid min-h-[260px] place-items-center"><Spinner /></div>}
      {isError && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          {error?.message || 'No se pudo cargar la auditoría'}
          <button type="button" onClick={refetch} className="ml-3 font-bold underline">Reintentar</button>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white">
          {eventos.map((evento) => (
            <article key={evento.id} className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{evento.accion}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{evento.entidad_tipo} #{evento.entidad_id || '-'}</span>
                  </div>
                  <h2 className="mt-2 font-semibold text-gray-900">{evento.resumen || 'Acción administrativa'}</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {evento.admin_nombre || evento.admin_email || 'Admin'}{evento.admin_email ? ` · ${evento.admin_email}` : ''}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-gray-500">{fecha(evento.created_at)}</time>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <JsonPreview label="Antes" value={evento.antes} />
                <JsonPreview label="Después" value={evento.despues} />
              </div>
            </article>
          ))}
          {eventos.length === 0 && <p className="p-8 text-center text-sm text-gray-500">No hay eventos para esos filtros.</p>}
        </div>
      )}
    </div>
  );
}
