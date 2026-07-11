import { useRef, useState } from 'react';
import { useCreateSalsa } from '../../hooks/useSalsas.js';
import { toast } from '../../lib/toast.js';
import Modal from '../ui/Modal.jsx';
import Spinner from '../ui/Spinner.jsx';

export default function SalsasPanel({ modalOpen, onModalClose }) {
  const crear = useCreateSalsa();
  const [nueva, setNueva]   = useState('');
  const [errors, setErrors] = useState({});
  const nombreRef            = useRef(null);

  const handleCerrar = () => {
    onModalClose();
    setNueva('');
    setErrors({});
  };

  const handleAgregar = async (e) => {
    e.preventDefault();
    if (!nueva.trim()) {
      setErrors({ nombre: 'El nombre es obligatorio' });
      requestAnimationFrame(() => {
        nombreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nombreRef.current?.focus({ preventScroll: true });
      });
      return;
    }
    try {
      await crear.mutateAsync({ nombre: nueva.trim() });
      handleCerrar();
      toast.success('Salsa agregada');
    } catch (err) { toast.error(err?.message || 'Error'); }
  };

  return (
    <Modal open={modalOpen} onClose={handleCerrar} title="Nueva salsa">
      <form onSubmit={handleAgregar} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            ref={nombreRef}
            autoFocus
            value={nueva}
            onChange={e => {
              setNueva(e.target.value);
              setErrors(er => ({ ...er, nombre: '' }));
            }}
            placeholder="Ej: Salsa bolognesa"
            aria-invalid={Boolean(errors.nombre)}
            className={`w-full px-3 py-2 text-sm border rounded-lg outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors
              ${errors.nombre ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
          {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
          <button type="button" onClick={handleCerrar} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={crear.isPending} className="btn-primary disabled:opacity-50">
            {crear.isPending && <Spinner size="sm" />}
            Agregar
          </button>
        </div>
      </form>
    </Modal>
  );
}
