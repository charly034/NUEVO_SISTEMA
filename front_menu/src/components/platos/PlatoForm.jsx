import { useState, useRef } from 'react';
import Spinner from '../ui/Spinner.jsx';
import PlatoPhoto from '../ui/PlatoPhoto.jsx';
import { useGuarniciones } from '../../hooks/useGuarniciones.js';
import { useSalsas } from '../../hooks/useSalsas.js';

const TIPOS = [
  { value: 'especial', label: 'Especial', desc: 'Solo aparece cuando lo elegis en el menu', sel: 'bg-amber-500 border-amber-500 text-white', idle: 'bg-white border-gray-200 text-gray-600 hover:border-amber-300' },
  { value: 'fijo',     label: 'Fijo',     desc: 'Siempre disponible, no rota',              sel: 'bg-blue-600 border-blue-600 text-white',   idle: 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'   },
  { value: 'ambos',    label: 'Fijo + Especial', desc: 'Siempre disponible y tambien puede rotar', sel: 'bg-purple-600 border-purple-600 text-white', idle: 'bg-white border-gray-200 text-gray-600 hover:border-purple-300' },
];

const DISPONIBILIDAD = [
  { value: 'especial',  label: 'Especial',     desc: 'Se programa semana a semana',                   sel: 'bg-amber-500 border-amber-500 text-white',   idle: 'bg-white border-gray-200 text-gray-500 hover:border-amber-300'   },
  { value: 'fijo_dia',  label: 'Fijo por dia', desc: 'Aparece siempre el mismo dia de la semana',     sel: 'bg-sky-500 border-sky-500 text-white',       idle: 'bg-white border-gray-200 text-gray-500 hover:border-sky-300'     },
  { value: 'siempre',   label: 'Siempre',      desc: 'Disponible todos los dias, sin programar',      sel: 'bg-emerald-500 border-emerald-500 text-white', idle: 'bg-white border-gray-200 text-gray-500 hover:border-emerald-300' },
];

const DIAS = [
  { value: 'lunes',     label: 'Lun' },
  { value: 'martes',    label: 'Mar' },
  { value: 'miercoles', label: 'Mie' },
  { value: 'jueves',    label: 'Jue' },
  { value: 'viernes',   label: 'Vie' },
  { value: 'sabado',    label: 'Sab' },
  { value: 'domingo',   label: 'Dom' },
];

const GUARNICION_MODO = [
  { value: 'sin_guarnicion', label: 'Sin guarnicion', desc: 'Se sirve solo'                                    },
  { value: 'libre',          label: 'A eleccion',     desc: 'El cliente elige entre las guarniciones activas'  },
  { value: 'fija',           label: 'Fija',           desc: 'Sale siempre con la misma guarnicion'             },
];

const SALSA_MODO = [
  { value: 'sin_salsa', label: 'Sin salsa', desc: 'Se sirve sin salsa'                          },
  { value: 'libre',     label: 'A eleccion', desc: 'El cliente elige entre las salsas activas'  },
  { value: 'fija',      label: 'Fija',       desc: 'Sale siempre con la misma salsa'            },
];

const TAGS_SUGERIDOS = ['Pollo','Carnes','Pescado','Vegetariano','Pasta','Tartas','Milanesas','Hamburguesas','Sin TACC','Vegano'];

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
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); addTag(input); }
    else if (e.key === 'Backspace' && !input && value.length > 0) removeTag(value[value.length - 1]);
  };
  const sugeridos = TAGS_SUGERIDOS.filter((t) => !value.includes(t));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[40px] w-full px-2 py-1.5 border border-gray-300 rounded-lg cursor-text focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-colors"
        onClick={() => inputRef.current?.focus()}>
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-800 text-xs font-medium rounded-full">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="text-brand-500 hover:text-brand-800 leading-none">&times;</button>
          </span>
        ))}
        <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
          onBlur={() => input.trim() && addTag(input)} placeholder={value.length === 0 ? 'Escribi un tag y presiona Enter...' : ''}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent" />
      </div>
      {sugeridos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sugeridos.map((t) => (
            <button key={t} type="button" onClick={() => addTag(t)}
              className="px-2 py-0.5 text-xs border border-dashed border-gray-300 text-gray-500 rounded-full hover:border-brand-400 hover:text-brand-600 transition-colors">
              + {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleCard({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={'flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors text-left ' +
        (active ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300')}>
      <span className={'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ' +
        (active ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white')}>
        {active && <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </span>
      {children}
    </button>
  );
}

export default function PlatoForm({ initial, onSubmit, onCancel, loading }) {
  const { data: guarniciones = [] } = useGuarniciones();
  const guarnicionesActivas = guarniciones.filter((g) => g.activo);
  const { data: salsas = [] } = useSalsas();
  const salsasActivas = salsas.filter((s) => s.activo);
  const nombreRef = useRef(null);

  const [form, setForm] = useState(() => ({
    nombre:             initial?.nombre             ?? '',
    descripcion:        initial?.descripcion        ?? '',
    descripcion_larga:  initial?.descripcion_larga  ?? '',
    nombre_vianda:      initial?.nombre_vianda      ?? '',
    calorias:           initial?.calorias           ?? '',
    alergenos:          initial?.alergenos          ?? [],
    vegetariano:        initial?.vegetariano        ?? false,
    foto:               null,
    tipo:               initial?.tipo               ?? 'especial',
    disponible_vianda:  initial?.disponible_vianda  ?? true,
    disponibilidad:     initial?.disponibilidad     ?? 'especial',
    dia_fijo:           initial?.dia_fijo           ?? '',
    guarnicion_modo:    initial?.guarnicion_modo    ?? 'sin_guarnicion',
    guarnicion_fija_id: initial?.guarnicion_fija_id ?? '',
    salsa_modo:         initial?.salsa_modo         ?? 'sin_salsa',
    salsa_fija_id:      initial?.salsa_fija_id      ?? '',
    tags:               initial?.tags               ?? [],
  }));
  const [fotoPreview, setFotoPreview] = useState(initial?.foto_url ?? '');
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setErrors((er) => ({ ...er, [field]: '' })); };
  const setVal = (field, val) => { setForm((f) => ({ ...f, [field]: val })); setErrors((er) => ({ ...er, [field]: '' })); };

  const handleFoto = (e) => {
    const file = e.target.files?.[0] || null;
    setErrors((er) => ({ ...er, foto: '' }));
    if (!file) { setForm((f) => ({ ...f, foto: null })); setFotoPreview(initial?.foto_url ?? ''); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setErrors((er) => ({ ...er, foto: 'La imagen debe ser JPG, PNG o WebP' })); e.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { setErrors((er) => ({ ...er, foto: 'La imagen no puede superar 5 MB' })); e.target.value = ''; return; }
    setForm((f) => ({ ...f, foto: file }));
    setFotoPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const err = {};
    if (!form.nombre.trim()) err.nombre = 'El nombre es obligatorio';
    else if (form.nombre.trim().length < 2) err.nombre = 'Minimo 2 caracteres';
    if (form.disponibilidad === 'fijo_dia' && !form.dia_fijo) err.dia_fijo = 'Selecciona el dia fijo';
    if (form.guarnicion_modo === 'fija' && !form.guarnicion_fija_id) err.guarnicion_fija_id = 'Selecciona la guarnicion fija';
    if (form.salsa_modo === 'fija' && !form.salsa_fija_id) err.salsa_fija_id = 'Selecciona la salsa fija';
    return err;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    if (Object.keys(err).length > 0) {
      setErrors(err);
      if (err.nombre) requestAnimationFrame(() => { nombreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); nombreRef.current?.focus({ preventScroll: true }); });
      return;
    }
    onSubmit({
      nombre:             form.nombre.trim(),
      descripcion:        form.descripcion.trim() || undefined,
      descripcion_larga:  form.descripcion_larga.trim() || undefined,
      nombre_vianda:      form.nombre_vianda.trim() || undefined,
      calorias:           form.calorias === '' ? null : Number(form.calorias),
      alergenos:          form.alergenos,
      vegetariano:        form.vegetariano,
      foto:               form.foto,
      tipo:               form.tipo,
      disponible_vianda:  form.disponible_vianda,
      disponibilidad:     form.disponibilidad,
      dia_fijo:           form.disponibilidad === 'fijo_dia' ? form.dia_fijo : undefined,
      guarnicion_modo:    form.guarnicion_modo,
      guarnicion_fija_id: form.guarnicion_modo === 'fija' ? (Number(form.guarnicion_fija_id) || null) : undefined,
      tiene_guarnicion:   form.guarnicion_modo !== 'sin_guarnicion',
      salsa_modo:         form.salsa_modo,
      salsa_fija_id:      form.salsa_modo === 'fija' ? (Number(form.salsa_fija_id) || null) : undefined,
      tags:               form.tags,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del plato <span className="text-red-500">*</span></label>
        <input ref={nombreRef} type="text" value={form.nombre} onChange={set('nombre')} placeholder="Ej: Milanesa de pollo" autoFocus
          className={'w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ' + (errors.nombre ? 'border-red-400 bg-red-50' : 'border-gray-300')} />
        {errors.nombre ? <p className="text-xs text-red-500 mt-1">{errors.nombre}</p> : null}
      </div>

      {/* Nombre en vianda */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre en vianda <span className="text-gray-500 font-normal">(opcional)</span>
        </label>
        <input type="text" value={form.nombre_vianda} onChange={set('nombre_vianda')} placeholder="Ej: Milanesa de pollo con pure"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors" />
        <p className="text-xs text-gray-500 mt-1">Completar solo si el nombre en vianda es distinto al nombre del local.</p>
      </div>

      {/* Foto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Foto <span className="text-gray-500 font-normal">(JPG, PNG o WebP)</span></label>
        <div className="flex items-center gap-3">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
            <PlatoPhoto src={fotoPreview} alt={form.nombre || 'Nuevo plato'} plato={form} imgClassName="w-full h-full object-cover" size="lg" />
          </div>
          <div className="min-w-0 flex-1">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFoto}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100" />
            <p className="mt-1 text-xs text-gray-500">Se comprime y guarda automaticamente como WebP.</p>
            {errors.foto ? <p className="text-xs text-red-500 mt-1">{errors.foto}</p> : null}
          </div>
        </div>
      </div>

      {/* Descripcion */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion <span className="text-gray-500 font-normal">(opcional)</span></label>
        <textarea value={form.descripcion} onChange={set('descripcion')} placeholder="Ingredientes, preparacion, notas..." rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none resize-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion ampliada / receta <span className="text-gray-500 font-normal">(opcional)</span></label>
        <textarea value={form.descripcion_larga} onChange={set('descripcion_larga')} placeholder="Preparacion, ingredientes principales, porcion sugerida..." rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none resize-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors" />
      </div>

      {/* Calorias y alergenos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Calorias aproximadas</label>
          <input type="number" min="0" max="3000" value={form.calorias} onChange={set('calorias')} placeholder="Ej: 420"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alergenos</label>
          <input type="text" value={form.alergenos.join(', ')} onChange={(e) => setVal('alergenos', e.target.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20))}
            placeholder="Gluten, lactosa, huevo"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors" />
        </div>
      </div>

      {/* Vegetariano */}
      <ToggleCard active={form.vegetariano} onClick={() => setVal('vegetariano', !form.vegetariano)}>
        <span>{form.vegetariano ? 'Marcado como vegetariano' : 'No marcado como vegetariano'}</span>
      </ToggleCard>

      {/* Disponible para vianda */}
      <ToggleCard active={form.disponible_vianda} onClick={() => setVal('disponible_vianda', !form.disponible_vianda)}>
        <span>{form.disponible_vianda ? 'Disponible para vianda (empresas)' : 'No disponible para vianda'}</span>
      </ToggleCard>

      {/* Disponibilidad */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Disponibilidad en el menu</p>
        <div className="grid grid-cols-3 gap-2">
          {DISPONIBILIDAD.map((d) => (
            <button key={d.value} type="button" onClick={() => setVal('disponibilidad', d.value)}
              className={'flex flex-col gap-1 px-3 py-3 rounded-xl border-2 text-center transition-colors ' + (form.disponibilidad === d.value ? d.sel : d.idle)}>
              <span className="text-xs font-bold">{d.label}</span>
              <span className={'text-xs leading-tight ' + (form.disponibilidad === d.value ? 'opacity-80' : 'text-gray-500')}>{d.desc}</span>
            </button>
          ))}
        </div>
        {form.disponibilidad === 'fijo_dia' ? (
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-700 mb-1">Dia fijo <span className="text-red-500">*</span></p>
            <div className="flex gap-1.5 flex-wrap">
              {DIAS.map((d) => (
                <button key={d.value} type="button" onClick={() => setVal('dia_fijo', d.value)}
                  className={'px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-colors ' + (form.dia_fijo === d.value ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-sky-300')}>
                  {d.label}
                </button>
              ))}
            </div>
            {errors.dia_fijo ? <p className="text-xs text-red-500 mt-1">{errors.dia_fijo}</p> : null}
          </div>
        ) : null}
      </div>

      {/* Guarnicion */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Guarnicion</p>
        <div className="grid grid-cols-3 gap-2">
          {GUARNICION_MODO.map((g) => (
            <button key={g.value} type="button" onClick={() => setVal('guarnicion_modo', g.value)}
              className={'flex flex-col gap-1 px-3 py-3 rounded-xl border-2 text-center transition-colors ' + (form.guarnicion_modo === g.value ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-brand-300')}>
              <span className="text-xs font-bold">{g.label}</span>
              <span className={'text-xs leading-tight ' + (form.guarnicion_modo === g.value ? 'opacity-80' : 'text-gray-500')}>{g.desc}</span>
            </button>
          ))}
        </div>
        {form.guarnicion_modo === 'libre' ? (
          <p className="mt-2 text-xs text-gray-500">
            El cliente va a poder elegir entre {guarnicionesActivas.length} guarnicion{guarnicionesActivas.length !== 1 ? 'es' : ''} disponible{guarnicionesActivas.length !== 1 ? 's' : ''}.
          </p>
        ) : null}
        {form.guarnicion_modo === 'fija' ? (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Guarnicion fija <span className="text-red-500">*</span></label>
            <select value={form.guarnicion_fija_id} onChange={set('guarnicion_fija_id')}
              className={'w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors ' + (errors.guarnicion_fija_id ? 'border-red-400 bg-red-50' : 'border-gray-300')}>
              <option value="">-- Elegir guarnicion --</option>
              {guarnicionesActivas.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
            {errors.guarnicion_fija_id ? <p className="text-xs text-red-500 mt-1">{errors.guarnicion_fija_id}</p> : null}
          </div>
        ) : null}
      </div>

      {/* Salsa */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Salsa</p>
        <div className="grid grid-cols-3 gap-2">
          {SALSA_MODO.map((s) => (
            <button key={s.value} type="button" onClick={() => setVal('salsa_modo', s.value)}
              className={'flex flex-col gap-1 px-3 py-3 rounded-xl border-2 text-center transition-colors ' + (form.salsa_modo === s.value ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-red-300')}>
              <span className="text-xs font-bold">{s.label}</span>
              <span className={'text-xs leading-tight ' + (form.salsa_modo === s.value ? 'opacity-80' : 'text-gray-500')}>{s.desc}</span>
            </button>
          ))}
        </div>
        {form.salsa_modo === 'libre' ? (
          <p className="mt-2 text-xs text-gray-500">
            El cliente va a poder elegir entre {salsasActivas.length} salsa{salsasActivas.length !== 1 ? 's' : ''} disponible{salsasActivas.length !== 1 ? 's' : ''}.
          </p>
        ) : null}
        {form.salsa_modo === 'fija' ? (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Salsa fija <span className="text-red-500">*</span></label>
            <select value={form.salsa_fija_id} onChange={set('salsa_fija_id')}
              className={'w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors ' + (errors.salsa_fija_id ? 'border-red-400 bg-red-50' : 'border-gray-300')}>
              <option value="">-- Elegir salsa --</option>
              {salsasActivas.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            {errors.salsa_fija_id ? <p className="text-xs text-red-500 mt-1">{errors.salsa_fija_id}</p> : null}
          </div>
        ) : null}
      </div>

      {/* Tipo (uso) */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Como se usa este plato?</p>
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => (
            <button key={t.value} type="button" onClick={() => setVal('tipo', t.value)}
              className={'flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-center transition-colors ' + (form.tipo === t.value ? t.sel : t.idle)}>
              <span className="text-xs font-bold">{t.label}</span>
              <span className={'text-xs leading-tight ' + (form.tipo === t.value ? 'opacity-80' : 'text-gray-500')}>{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas <span className="text-gray-500 font-normal">(opcional, max. 10)</span></label>
        <TagInput value={form.tags} onChange={(tags) => setVal('tags', tags)} />
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary inline-flex items-center gap-2">
          {loading ? <Spinner size="sm" /> : null}
          {initial ? 'Guardar cambios' : 'Crear plato'}
        </button>
      </div>
    </form>
  );
}
