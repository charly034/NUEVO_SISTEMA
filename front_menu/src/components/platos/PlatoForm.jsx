import { useState, useRef } from 'react';
import Spinner from '../ui/Spinner.jsx';

const TAGS_SUGERIDOS = [
  'Carnes', 'Pollo', 'Pescado', 'Vegetariano', 'Vegano',
  'Pastas', 'Ensaladas', 'Sopas', 'Postres', 'Sandwiches',
  'Sin TACC', 'Proteínas', 'Guisos', 'Pizzas',
];

function TagInput({ value = [], onChange }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  const addTag = (tag) => {
    const t = tag.trim();
    if (!t || value.includes(t) || value.length >= 10) return;
    onChange([...value, t]);
    setInput('');
  };

  const removeTag = (tag) => onChange(value.filter((t) => t !== tag));

  const handleKey = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const sugeridos = TAGS_SUGERIDOS.filter((t) => !value.includes(t));

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-1.5 min-h-[40px] w-full px-2 py-1.5 border border-gray-300 rounded-lg cursor-text focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-colors"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-800 text-xs font-medium rounded-full">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="text-brand-500 hover:text-brand-800 leading-none">×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => input.trim() && addTag(input)}
          placeholder={value.length === 0 ? 'Escribí un tag y presioná Enter...' : ''}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
        />
      </div>
      {sugeridos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sugeridos.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addTag(t)}
              className="px-2 py-0.5 text-xs border border-dashed border-gray-300 text-gray-500 rounded-full hover:border-brand-400 hover:text-brand-600 transition-colors"
            >
              + {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlatoForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(() => ({
    nombre: initial?.nombre || '',
    descripcion: initial?.descripcion ?? '',
    tags: initial?.tags ?? [],
  }));
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: '' }));
  };

  const validate = () => {
    const err = {};
    if (!form.nombre.trim()) err.nombre = 'El nombre es obligatorio';
    else if (form.nombre.trim().length < 2) err.nombre = 'Mínimo 2 caracteres';
    return err;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    if (Object.keys(err).length > 0) { setErrors(err); return; }
    onSubmit({
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || undefined,
      tags: form.tags,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.nombre}
          onChange={set('nombre')}
          placeholder="Ej: Milanesa napolitana"
          className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors
            focus:ring-2 focus:ring-brand-500 focus:border-brand-500
            ${errors.nombre ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
        />
        {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          value={form.descripcion}
          onChange={set('descripcion')}
          placeholder="Ingredientes, preparación, notas..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none resize-none
            focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Categorías / Tags <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <TagInput value={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <Spinner size="sm" /> : null}
          {initial ? 'Guardar cambios' : 'Crear plato'}
        </button>
      </div>
    </form>
  );
}
