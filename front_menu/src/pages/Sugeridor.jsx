import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSugerencias } from '../hooks/useSugerencias.js';
import { usePlatos } from '../hooks/usePlatos.js';
import { useCreateMenu } from '../hooks/useMenus.js';
import { menusService } from '../services/menus.service.js';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { toast } from '../lib/toast.js';

const DIAS_LABEL = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' };
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

function getLunes(offset = 1) {
  const hoy = new Date();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) + offset * 7);
  return lunes.toISOString().split('T')[0];
}
function getDomingo(lunes) {
  const d = new Date(lunes); d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}
function formatCorto(iso) {
  const [, m, d] = (iso || '').split('T')[0].split('-');
  return d && m ? `${d}/${m}` : '—';
}

const TAG_COLORS = {
  Pollo: 'bg-amber-100 text-amber-800', Carnes: 'bg-red-100 text-red-800',
  Cerdo: 'bg-orange-100 text-orange-800', Pescado: 'bg-blue-100 text-blue-800',
  Vegetariano: 'bg-green-100 text-green-800', Pasta: 'bg-yellow-100 text-yellow-800',
  Arroz: 'bg-lime-100 text-lime-800', Guisos: 'bg-stone-100 text-stone-700',
  Ensaladas: 'bg-emerald-100 text-emerald-800',
};

// ── Selector de plato alternativo ────────────────────────────────
function SelectorPlato({ opcion, diaLabel, actual, onSelect, onCancel }) {
  const [search, setSearch] = useState('');
  const { data } = usePlatos({ limit: 100, activo: 'true', search: search || undefined });
  const platos = data?.platos ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Cambiar <strong>opción {opcion}</strong> del <strong>{diaLabel}</strong>
      </p>
      <input
        autoFocus
        type="text"
        placeholder="Buscar plato..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
      />
      <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
        {platos.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={`w-full text-left px-3 py-2.5 hover:bg-brand-50 transition-colors ${p.id === actual?.id ? 'bg-brand-50' : ''}`}
          >
            <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {p.tags?.slice(0, 3).map(t => (
                <span key={t} className={`text-[10px] px-1.5 rounded-full ${TAG_COLORS[t] ?? 'bg-gray-100 text-gray-500'}`}>{t}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
      <div className="flex justify-end pt-1">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
      </div>
    </div>
  );
}

// ── Plato dentro de una variación ─────────────────────────────────
function PlatoFila({ opcion, plato, onCambiar }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-2.5 py-2">
      <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
        {opcion}
      </span>
      <div className="flex-1 min-w-0">
        {plato ? (
          <>
            <p className="text-xs font-medium text-gray-800 leading-tight">{plato.nombre}</p>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {plato.tags?.slice(0, 2).map(t => (
                <span key={t} className={`text-[10px] px-1 rounded-full ${TAG_COLORS[t] ?? 'bg-gray-100 text-gray-500'}`}>{t}</span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400 italic">Sin sugerencia</p>
        )}
      </div>
      <button
        onClick={onCambiar}
        className="text-[10px] text-brand-600 hover:text-brand-800 hover:bg-brand-50 px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
      >
        Cambiar
      </button>
    </div>
  );
}

// ── Card de una variación completa ────────────────────────────────
function VariacionCard({ variacion, label, dias, overrides, onCambiar, onSeleccionar, isSelected }) {
  // Aplica overrides locales sobre dias base
  const diasFinal = DIAS.map(dia => {
    const base = dias.find(d => d.dia === dia) ?? { dia, fecha: null, opcionA: null, opcionC: null };
    const ov = overrides[dia] ?? {};
    return { ...base, opcionA: ov.A ?? base.opcionA, opcionC: ov.C ?? base.opcionC };
  });

  return (
    <div className={`card flex flex-col transition-all ${isSelected ? 'ring-2 ring-brand-500' : ''}`}>
      <div className={`px-4 py-3 border-b flex items-center justify-between ${isSelected ? 'bg-brand-50' : 'bg-gray-50'}`}>
        <div>
          <span className="font-semibold text-sm text-gray-900">{label}</span>
          {isSelected && <span className="ml-2 text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded-full">Seleccionada</span>}
        </div>
        <button
          onClick={onSeleccionar}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            isSelected ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-brand-50 hover:border-brand-300'
          }`}
        >
          {isSelected ? 'Seleccionada' : 'Usar esta'}
        </button>
      </div>

      <div className="flex-1 p-3 space-y-2">
        {diasFinal.map(s => (
          <div key={s.dia}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
              {DIAS_LABEL[s.dia]}
              <span className="font-normal text-gray-400">{formatCorto(s.fecha)}</span>
            </p>
            <div className="space-y-1">
              <PlatoFila opcion="A" plato={s.opcionA} onCambiar={() => onCambiar(variacion, s.dia, 'A', s.opcionA)} />
              <PlatoFila opcion="C" plato={s.opcionC} onCambiar={() => onCambiar(variacion, s.dia, 'C', s.opcionC)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────
export default function Sugeridor() {
  const navigate = useNavigate();
  const lunesProx = getLunes(1);
  const [fechaInicio, setFechaInicio] = useState(lunesProx);
  const [seleccionada, setSeleccionada] = useState(0); // índice de variación seleccionada (0,1,2)
  const [overrides, setOverrides] = useState({}); // { [variacion]: { [dia]: { A: plato, C: plato } } }
  const [editando, setEditando] = useState(null); // { variacion, dia, opcion, actual }
  const [creando, setCreando] = useState(false);

  const query = useSugerencias(fechaInicio);
  const createMut = useCreateMenu();
  const variaciones = query.data ?? []; // array de { variacion, label, dias }

  const handleCambiar = (variacion, dia, opcion, actual) => setEditando({ variacion, dia, opcion, actual });

  const handleSelect = (plato) => {
    const { variacion, dia, opcion } = editando;
    setOverrides(prev => ({
      ...prev,
      [variacion]: {
        ...(prev[variacion] ?? {}),
        [dia]: {
          ...((prev[variacion] ?? {})[dia] ?? {}),
          [opcion]: { id: plato.id, nombre: plato.nombre, tags: plato.tags },
        },
      },
    }));
    setEditando(null);
  };

  const handleConfirmar = async () => {
    const varObj = variaciones[seleccionada];
    if (!varObj) return;
    const ovs = overrides[varObj.variacion] ?? {};

    const diasFinal = DIAS.map(dia => {
      const base = varObj.dias.find(d => d.dia === dia) ?? { dia, opcionA: null, opcionC: null };
      const ov = ovs[dia] ?? {};
      return { ...base, opcionA: ov.A ?? base.opcionA, opcionC: ov.C ?? base.opcionC };
    });

    setCreando(true);
    try {
      const dominio = getDomingo(fechaInicio);
      const d = fechaInicio.slice(8, 10), m = fechaInicio.slice(5, 7);
      const df = dominio.slice(8, 10), mf = dominio.slice(5, 7);

      const res = await createMut.mutateAsync({
        nombre: `Semana del ${d}/${m} al ${df}/${mf}`,
        fecha_inicio: fechaInicio,
        fecha_fin: dominio,
      });
      const menu = res?.data?.menu ?? res?.data ?? res;

      for (const s of diasFinal) {
        if (s.opcionA?.id) await menusService.agregarPlato(menu.id, { dia: s.dia, opcion: 'A', plato_id: s.opcionA.id });
        if (s.opcionC?.id) await menusService.agregarPlato(menu.id, { dia: s.dia, opcion: 'C', plato_id: s.opcionC.id });
      }

      toast.success('Menú creado con las sugerencias');
      navigate(`/semanas/${menu.id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCreando(false);
    }
  };

  const recargar = () => { setOverrides({}); setSeleccionada(0); query.refetch(); };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sugeridor de menú</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          3 opciones basadas en rotación histórica · elegí la que más te guste o mezclá platos
        </p>
      </div>

      {/* Controles */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Semana a generar</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={e => { setFechaInicio(e.target.value); setOverrides({}); setSeleccionada(0); }}
            className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={recargar} className="btn-secondary text-sm">Regenerar</button>
          <button
            onClick={handleConfirmar}
            disabled={creando || variaciones.length === 0}
            className="btn-primary text-sm"
          >
            {creando ? <><Spinner size="sm" /> Creando...</> : 'Crear menú seleccionado'}
          </button>
        </div>
      </div>

      {/* 3 variaciones */}
      {query.isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : query.isError ? (
        <div className="text-center py-12 text-red-500 text-sm">Error al cargar sugerencias</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {variaciones.map((v, idx) => (
              <VariacionCard
                key={v.variacion}
                variacion={v.variacion}
                label={v.label}
                dias={v.dias}
                overrides={overrides[v.variacion] ?? {}}
                onCambiar={handleCambiar}
                onSeleccionar={() => setSeleccionada(idx)}
                isSelected={seleccionada === idx}
                creando={creando}
              />
            ))}
          </div>
          <div className="card p-3 bg-brand-50 border-brand-200">
            <p className="text-xs text-brand-700">
              <strong>Cómo funciona:</strong> Opción A evita repetir platos de las últimas 2 semanas con mayor afinidad por día ·
              Opción B alterna el orden de candidatos · Opción C prioriza los platos menos usados históricamente ·
              Podés cambiar cualquier plato individualmente antes de crear
            </p>
          </div>
        </>
      )}

      {/* Modal cambiar plato */}
      <Modal open={!!editando} onClose={() => setEditando(null)} title="Cambiar plato">
        {editando && (
          <SelectorPlato
            opcion={editando.opcion}
            diaLabel={DIAS_LABEL[editando.dia]}
            actual={editando.actual}
            onSelect={handleSelect}
            onCancel={() => setEditando(null)}
          />
        )}
      </Modal>
    </div>
  );
}
