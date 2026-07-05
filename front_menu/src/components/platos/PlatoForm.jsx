import { useState, useRef } from 'react';
import Spinner from '../ui/Spinner.jsx';
import PlatoPhoto from '../ui/PlatoPhoto.jsx';
import { useGuarniciones } from '../../hooks/useGuarniciones.js';

// ── Tipos de plato ────────────────────────────────────────────────
const TIPOS = [
  {
    value: 'especial',
    label: 'Especial',
    desc: 'Solo aparece en menús semanales cuando lo elegís',
    icon: '⭐',
    sel: 'bg-amber-500 border-amber-500 text-white',
    idle: 'bg-white border-gray-200 text-gray-600 hover:border-amber-300',
  },
  {
    value: 'fijo',
    label: 'Fijo',
    desc: 'Siempre disponible, no rota',
    icon: '📌',
    sel: 'bg-blue-600 border-blue-600 text-white',
    idle: 'bg-white border-gray-200 text-gray-600 hover:border-blue-300',
  },
  {
    value: 'ambos',
    label: 'Fijo + Especial',
    desc: 'Siempre disponible y también puede rotar',
    icon: '🔄',
    sel: 'bg-purple-600 border-purple-600 text-white',
    idle: 'bg-white border-gray-200 text-gray-600 hover:border-purple-300',
  },
];

const TAGS_SUGERIDOS = [
  'Pollo', 'Carnes', 'Pescado', 'Vegetariano', 'Pasta',
  'Tartas', 'Milanesas', 'Hamburguesas', 'Sin TACC', 'Vegano',
];

// ── TagInput ──────────────────────────────────────────────────────
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

// ── Formulario principal ──────────────────────────────────────────
export default function PlatoForm({ initial, onSubmit, onCancel, loading }) {
  const { data: guarniciones = [] } = useGuarniciones();
  const guarnicionesActivas = guarniciones.filter(g => g.activo).length;
  const nombreRef = useRef(null);

  const [form, setForm] = useState(() => ({
    nombre:           initial?.nombre           ?? '',
    descripcion:      initial?.descripcion      ?? '',
    descripcion_larga: initial?.descripcion_larga ?? '',
    calorias:         initial?.calorias         ?? '',
    alergenos:        initial?.alergenos        ?? [],
    vegetariano:      initial?.vegetariano      ?? false,
    foto:             null,
    tipo:             initial?.tipo             ?? 'especial',
    tiene_guarnicion: initial?.tiene_guarnicion ?? false,
    tags:             initial?.tags             ?? [],
  }));
  const [fotoPreview, setFotoPreview] = useState(initial?.foto_url ?? '');
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: '' }));
  };

  const handleFoto = (e) => {
    const file = e.target.files?.[0] || null;
    setErrors((er) => ({ ...er, foto: '' }));
    if (!file) {
      setForm((f) => ({ ...f, foto: null }));
      setFotoPreview(initial?.foto_url ?? '');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors((er) => ({ ...er, foto: 'La imagen debe ser JPG, PNG o WebP' }));
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((er) => ({ ...er, foto: 'La imagen no puede superar 5 MB' }));
      e.target.value = '';
      return;
    }

    setForm((f) => ({ ...f, foto: file }));
    setFotoPreview(URL.createObjectURL(file));
  };

  const setAlergenos = (value) => {
    setForm((f) => ({
      ...f,
      alergenos: value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20),
    }));
  };

  const validate = () => {
    const err = {};
    if (!form.nombre.trim()) err.nombre = 'El nombre es obligatorio';
    else if (form.nombre.trim().length < 2) err.nombre = 'Mínimo 2 caracteres';
    return err;
  };

  const focusFirstError = (err) => {
    const first = Object.keys(err)[0];
    const target = first === 'nombre' ? nombreRef.current : null;
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    if (Object.keys(err).length > 0) {
      setErrors(err);
      focusFirstError(err);
      return;
    }
    onSubmit({
      nombre:           form.nombre.trim(),
      descripcion:      form.descripcion.trim() || undefined,
      descripcion_larga: form.descripcion_larga.trim() || undefined,
      calorias:         form.calorias === '' ? null : Number(form.calorias),
      alergenos:        form.alergenos,
      vegetariano:      form.vegetariano,
      foto:             form.foto,
      tipo:             form.tipo,
      tiene_guarnicion: form.tiene_guarnicion,
      tags:             form.tags,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre <span className="text-red-500">*</span>
        </label>
        <input
          ref={nombreRef}
          type="text"
          value={form.nombre}
          onChange={set('nombre')}
          placeholder="Ej: Milanesa de pollo"
          autoFocus
          className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors
            focus:ring-2 focus:ring-brand-500 focus:border-brand-500
            ${errors.nombre ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
        />
        {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
      </div>

      {/* Imagen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Foto <span className="text-gray-400 font-normal">(JPG, PNG o WebP)</span>
        </label>
        <div className="flex items-center gap-3">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
            <PlatoPhoto
              src={fotoPreview}
              alt={form.nombre || 'Nuevo plato'}
              plato={form}
              imgClassName="w-full h-full object-cover"
              size="lg"
            />
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFoto}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
            />
            <p className="mt-1 text-xs text-gray-400">Se comprime y guarda automaticamente como WebP.</p>
            {errors.foto && <p className="text-xs text-red-500 mt-1">{errors.foto}</p>}
          </div>
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          value={form.descripcion}
          onChange={set('descripcion')}
          placeholder="Ingredientes, preparación, notas..."
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none resize-none
            focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción ampliada / receta <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          value={form.descripcion_larga}
          onChange={set('descripcion_larga')}
          placeholder="Preparación, ingredientes principales, porción sugerida..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none resize-none
            focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Calorías aproximadas
          </label>
          <input
            type="number"
            min="0"
            max="3000"
            value={form.calorias}
            onChange={set('calorias')}
            placeholder="Ej: 420"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alergenos
          </label>
          <input
            type="text"
            value={form.alergenos.join(', ')}
            onChange={(e) => setAlergenos(e.target.value)}
            placeholder="Gluten, lactosa, huevo"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setForm((f) => ({ ...f, vegetariano: !f.vegetariano }))}
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left
          ${form.vegetariano
            ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
      >
        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
          ${form.vegetariano ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white'}`}>
          {form.vegetariano && (
            <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        <span>{form.vegetariano ? 'Marcado como vegetariano' : 'No marcado como vegetariano'}</span>
      </button>

      {/* Guarnición */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">¿Incluye guarnición?</label>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, tiene_guarnicion: !f.tiene_guarnicion }))}
          className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left
            ${form.tiene_guarnicion
              ? 'bg-green-50 border-green-400 text-green-800'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
        >
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
            ${form.tiene_guarnicion ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'}`}>
            {form.tiene_guarnicion && (
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <div>
            <p>{form.tiene_guarnicion ? 'Sí, el cliente elige guarnición' : 'No, se sirve solo'}</p>
            <p className={`text-xs font-normal mt-0.5 ${form.tiene_guarnicion ? 'text-green-600' : 'text-gray-400'}`}>
              {form.tiene_guarnicion
                ? `El cliente elige entre ${guarnicionesActivas} guarnición${guarnicionesActivas !== 1 ? 'es' : ''} disponible${guarnicionesActivas !== 1 ? 's' : ''}`
                : 'Se sirve sin opción de guarnición adicional'}
            </p>
          </div>
        </button>
      </div>

      {/* Tipo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">¿Cómo se usa este plato?</label>
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => {
            const sel = form.tipo === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo: t.value }))}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-center transition-all
                  ${sel ? t.sel : t.idle}`}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                <span className="text-xs font-bold">{t.label}</span>
                <span className={`text-xs leading-tight ${sel ? 'opacity-80' : 'text-gray-400'}`}>
                  {t.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Etiquetas <span className="text-gray-400 font-normal">(opcional, máx. 10)</span>
        </label>
        <TagInput value={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="btn-primary inline-flex items-center gap-2">
          {loading && <Spinner size="sm" />}
          {initial ? 'Guardar cambios' : 'Crear plato'}
        </button>
      </div>
    </form>
  );
}
