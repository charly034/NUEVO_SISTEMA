import { useMemo, useState } from 'react';
import { usePedidoSugerencias } from '../hooks/usePedidoSugerencias.js';
import { useEmpresas } from '../hooks/useEmpresas.js';

function getLunes() {
  const hoy = new Date();
  const diff = hoy.getDay() === 0 ? -6 : 1 - hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return lunes.toISOString().split('T')[0];
}

function fmtFecha(iso) {
  if (!iso) return '';
  const [anio, mes, dia] = String(iso).split('T')[0].split('-');
  return `${dia}/${mes}/${anio}`;
}

function fmtFechaHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nombreCompleto(sugerencia) {
  return `${sugerencia.empleado_nombre || ''} ${sugerencia.empleado_apellido || ''}`.trim() || sugerencia.email || 'Cliente';
}

export default function RecomendacionesMenu() {
  const [semana, setSemana] = useState(getLunes());
  const [empresaId, setEmpresaId] = useState('');
  const params = useMemo(() => ({
    semana_inicio: semana || undefined,
    empresa_id: empresaId || undefined,
    limit: 200,
  }), [semana, empresaId]);

  const { data: recomendaciones = [], isLoading, isError, refetch } = usePedidoSugerencias(params);
  const { data: empresas = [] } = useEmpresas();

  const totalIdeas = recomendaciones.reduce((total, sugerencia) => total + (sugerencia.ideas?.length || 0), 0);
  const conComentario = recomendaciones.filter(sugerencia => Boolean(sugerencia.comentario)).length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recomendaciones de menu</h1>
          <p className="text-sm text-gray-500 mt-1">Sugerencias enviadas por clientes para semanas sin menu publicado.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="self-start px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Actualizar
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Semana</span>
            <input
              type="date"
              value={semana}
              onChange={event => setSemana(event.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Empresa</span>
            <select
              value={empresaId}
              onChange={event => setEmpresaId(event.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600"
            >
              <option value="">Todas las empresas</option>
              {empresas.map(empresa => (
                <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500">Envios</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{recomendaciones.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500">Ideas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalIdeas}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500">Con comentario</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{conComentario}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">Cargando recomendaciones...</div>
      ) : isError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-sm text-red-700">No se pudieron cargar las recomendaciones.</div>
      ) : recomendaciones.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="font-semibold text-gray-900">Sin recomendaciones para esta busqueda</p>
          <p className="text-sm text-gray-500 mt-1">Cambia la semana o la empresa para revisar otros envios.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recomendaciones.map(sugerencia => (
            <article key={sugerencia.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="font-bold text-gray-900">{nombreCompleto(sugerencia)}</h2>
                  <p className="text-xs text-gray-500">
                    {sugerencia.empresa_nombre || 'Sin empresa'} - Semana {fmtFecha(sugerencia.semana_inicio)}
                  </p>
                </div>
                <p className="text-xs text-gray-400">Actualizado {fmtFechaHora(sugerencia.updated_at || sugerencia.created_at)}</p>
              </div>

              {sugerencia.ideas?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {sugerencia.ideas.map((idea, index) => (
                    <span key={`${sugerencia.id}-${index}`} className="px-2.5 py-1 bg-green-50 text-green-800 border border-green-100 rounded-lg text-sm">
                      {idea}
                    </span>
                  ))}
                </div>
              )}

              {sugerencia.comentario && (
                <p className="mt-3 text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  {sugerencia.comentario}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
