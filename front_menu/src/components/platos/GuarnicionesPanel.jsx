import { useState } from 'react';
import { useCreateGuarnicion } from '../../hooks/useGuarniciones.js';
import { toast } from '../../lib/toast.js';
import Modal from '../ui/Modal.jsx';
import Spinner from '../ui/Spinner.jsx';

export default function GuarnicionesPanel({ modalOpen, onModalClose }) {
  const crear = useCreateGuarnicion();
  const [nueva, setNueva]         = useState('');
  const [nuevaTipo, setNuevaTipo] = useState(null);

  const handleCerrar = () => {
    onModalClose();
    setNueva('');
    setNuevaTipo(null);
  };

  const handleAgregar = async (e) => {
    e.preventDefault();
    if (!nueva.trim()) return;
    try {
      await crear.mutateAsync({ nombre: nueva.trim(), tipo: nuevaTipo });
      handleCerrar();
      toast.success('Guarnición agregada');
    } catch (err) { toast.error(err?.message || 'Error'); }
  };

  return (
    <Modal open={modalOpen} onClose={handleCerrar} title="Nueva guarnición">
      <form onSubmit={handleAgregar} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            value={nueva}
            onChange={e => setNueva(e.target.value)}
            placeholder="Ej: Arroz primavera"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
          <div className="flex gap-2">
            {[
              { value: null,       label: 'Sin especificar' },
              { value: 'caliente', label: '🔥 Caliente'     },
              { value: 'fria',     label: '❄️ Fría'          },
            ].map(t => (
              <button
                key={String(t.value)}
                type="button"
                onClick={() => setNuevaTipo(t.value)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border-2 transition-colors ${
                  nuevaTipo === t.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
          <button type="button" onClick={handleCerrar} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={crear.isPending || !nueva.trim()} className="btn-primary disabled:opacity-50">
            {crear.isPending && <Spinner size="sm" />}
            Agregar
          </button>
        </div>
      </form>
    </Modal>
  );
}
