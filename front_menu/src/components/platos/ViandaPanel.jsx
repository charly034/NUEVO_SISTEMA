import { useRef, useState } from 'react';
import { useCreateVianda, useUpdateVianda } from '../../hooks/useViandas.js';
import { usePlatos } from '../../hooks/usePlatos.js';
import { useGuarniciones } from '../../hooks/useGuarniciones.js';
import { useSalsas } from '../../hooks/useSalsas.js';
import { useEmpresas } from '../../hooks/useEmpresas.js';
import { toast } from '../../lib/toast.js';
import Modal from '../ui/Modal.jsx';
import Spinner from '../ui/Spinner.jsx';

const SALSA_MODOS = [
  { value: 'sin_salsa', label: 'Sin salsa' },
  { value: 'fija', label: 'Salsa fija' },
  { value: 'libre', label: 'A elección del empleado' },
];

function salsaModoDeVianda(vianda) {
  if (!vianda) return 'sin_salsa';
  if (vianda.salsa_id) return 'fija';
  if (vianda.salsa_libre) return 'libre';
  return 'sin_salsa';
}

export default function ViandaPanel({ vianda = null, onClose }) {
  const esNuevo = !vianda;
  const crear = useCreateVianda();
  const actualizar = useUpdateVianda();

  const { data: platosData } = usePlatos({ limit: 500, activo: 'true', sort_by: 'nombre' });
  const { data: guarniciones = [] } = useGuarniciones();
  const { data: salsas = [] } = useSalsas();
  const { data: empresas = [] } = useEmpresas();
  const platos = platosData?.platos ?? [];

  const [form, setForm] = useState({
    plato_id: vianda?.plato_id ?? '',
    empresa_id: vianda?.empresa_id ?? '',
    guarnicion_id: vianda?.guarnicion_id ?? '',
    salsa_modo: salsaModoDeVianda(vianda),
    salsa_id: vianda?.salsa_id ?? '',
    nombre_vianda: vianda?.nombre_generado ? '' : (vianda?.nombre_vianda ?? ''),
  });
  const [errors, setErrors] = useState({});
  const platoRef = useRef(null);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.plato_id) {
      setErrors({ plato_id: 'El plato es obligatorio' });
      requestAnimationFrame(() => platoRef.current?.focus({ preventScroll: true }));
      return;
    }
    if (form.salsa_modo === 'fija' && !form.salsa_id) {
      setErrors({ salsa_id: 'Elegí una salsa fija o cambiá el modo' });
      return;
    }

    const data = {
      plato_id: Number(form.plato_id),
      empresa_id: form.empresa_id ? Number(form.empresa_id) : null,
      guarnicion_id: form.guarnicion_id ? Number(form.guarnicion_id) : null,
      salsa_id: form.salsa_modo === 'fija' ? Number(form.salsa_id) : null,
      salsa_libre: form.salsa_modo === 'libre',
      nombre_vianda: form.nombre_vianda.trim() || null,
    };

    try {
      if (esNuevo) {
        await crear.mutateAsync(data);
        toast.success('Vianda creada');
      } else {
        await actualizar.mutateAsync({ id: vianda.id, data });
        toast.success('Vianda actualizada');
      }
      onClose();
    } catch (err) {
      toast.error(err?.message || 'No se pudo guardar la vianda');
    }
  };

  const loading = crear.isPending || actualizar.isPending;

  return (
    <Modal open onClose={onClose} title={esNuevo ? 'Nueva vianda' : 'Editar vianda'}>
      <form onSubmit={guardar} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Plato <span className="text-red-500">*</span>
          </label>
          <select
            ref={platoRef}
            value={form.plato_id}
            onChange={(e) => { set('plato_id', e.target.value); setErrors((er) => ({ ...er, plato_id: '' })); }}
            aria-invalid={Boolean(errors.plato_id)}
            className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors ${errors.plato_id ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          >
            <option value="">Seleccioná un plato...</option>
            {platos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          {errors.plato_id && <p className="text-xs text-red-500 mt-1">{errors.plato_id}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Guarnición</label>
          <select
            value={form.guarnicion_id}
            onChange={(e) => set('guarnicion_id', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            <option value="">Sin guarnición fija</option>
            {guarniciones.map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Salsa</label>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 mb-2">
            {SALSA_MODOS.map((modo) => (
              <button
                key={modo.value}
                type="button"
                onClick={() => { set('salsa_modo', modo.value); setErrors((er) => ({ ...er, salsa_id: '' })); }}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  form.salsa_modo === modo.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {modo.label}
              </button>
            ))}
          </div>
          {form.salsa_modo === 'fija' && (
            <>
              <select
                value={form.salsa_id}
                onChange={(e) => { set('salsa_id', e.target.value); setErrors((er) => ({ ...er, salsa_id: '' })); }}
                aria-invalid={Boolean(errors.salsa_id)}
                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${errors.salsa_id ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              >
                <option value="">Seleccioná una salsa...</option>
                {salsas.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              {errors.salsa_id && <p className="text-xs text-red-500 mt-1">{errors.salsa_id}</p>}
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
          <select
            value={form.empresa_id}
            onChange={(e) => set('empresa_id', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            <option value="">Global (todas las empresas)</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nombre}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Dejalo en "Global" salvo que esta vianda sea exclusiva de una empresa.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la vianda</label>
          <input
            value={form.nombre_vianda}
            onChange={(e) => set('nombre_vianda', e.target.value)}
            placeholder="Se genera automáticamente si lo dejás vacío"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
            {loading && <Spinner size="sm" />}
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
