import { useState } from 'react';
import { useGuarniciones, useCreateGuarnicion, useUpdateGuarnicion, useDeleteGuarnicion } from '../hooks/useGuarniciones.js';
import { confirmar } from '../lib/confirm.js';
import { toast } from '../lib/toast.js';

export default function Guarniciones() {
  const { data: guarniciones = [], isLoading } = useGuarniciones();
  const crear = useCreateGuarnicion();
  const actualizar = useUpdateGuarnicion();
  const eliminar = useDeleteGuarnicion();

  const [nueva, setNueva] = useState('');
  const [editando, setEditando] = useState(null); // { id, nombre }

  const handleAgregar = async (e) => {
    e.preventDefault();
    if (!nueva.trim()) return;
    try {
      await crear.mutateAsync(nueva.trim());
      setNueva('');
      toast.success('Guarnición agregada');
    } catch (err) { toast.error(err?.message || 'Error'); }
  };

  const handleGuardarEdit = async (e) => {
    e.preventDefault();
    try {
      await actualizar.mutateAsync({ id: editando.id, data: { nombre: editando.nombre } });
      setEditando(null);
      toast.success('Guarnición actualizada');
    } catch (err) { toast.error(err?.message || 'Error'); }
  };

  if (isLoading) return <p className="p-6 text-gray-500">Cargando...</p>;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Guarniciones</h1>

      {/* Agregar */}
      <form onSubmit={handleAgregar} className="flex gap-3 mb-6">
        <input
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          value={nueva}
          onChange={e => setNueva(e.target.value)}
          placeholder="Nombre de la guarnición"
        />
        <button type="submit" disabled={crear.isPending} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + Agregar
        </button>
      </form>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {guarniciones.map(g => (
          <div key={g.id} className="flex items-center justify-between px-4 py-3">
            {editando?.id === g.id ? (
              <form onSubmit={handleGuardarEdit} className="flex gap-2 flex-1">
                <input
                  autoFocus
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                  value={editando.nombre}
                  onChange={e => setEditando(ed => ({ ...ed, nombre: e.target.value }))}
                />
                <button type="submit" className="text-green-700 text-sm font-semibold">Guardar</button>
                <button type="button" onClick={() => setEditando(null)} className="text-gray-400 text-sm">Cancelar</button>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${g.activo ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium text-gray-800">{g.nombre}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => actualizar.mutate({ id: g.id, data: { activo: !g.activo } })}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${g.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {g.activo ? 'Activa' : 'Inactiva'}
                  </button>
                  <button onClick={() => setEditando({ id: g.id, nombre: g.nombre })} className="text-gray-400 hover:text-gray-700 text-sm">✏️</button>
                  <button
                    onClick={async () => {
                      if (!await confirmar({ titulo: `¿Eliminar "${g.nombre}"?`, texto: 'Esta acción no se puede deshacer.', botonConfirmar: 'Sí, eliminar' })) return;
                      try {
                        await eliminar.mutateAsync(g.id);
                        toast.success('Guarnición eliminada');
                      } catch (err) { toast.error(err?.message || 'Error'); }
                    }}
                    className="text-gray-400 hover:text-red-600 text-sm"
                  >🗑️</button>
                </div>
              </>
            )}
          </div>
        ))}
        {guarniciones.length === 0 && (
          <p className="text-gray-400 text-sm p-4">No hay guarniciones cargadas.</p>
        )}
      </div>
    </div>
  );
}
