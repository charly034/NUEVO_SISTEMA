import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSugerencias } from '../hooks/useSugerencias.js';
import { usePlatos } from '../hooks/usePlatos.js';
import { useCreateMenu } from '../hooks/useMenus.js';
import { menusService } from '../services/menus.service.js';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { toast } from '../lib/toast.js';

const DIAS_LABEL = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' };
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const AHORA_TS = Date.now();

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

function esFechaIso(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '');
}

function SkeletonSugeridor() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Cargando sugerencias">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="card flex min-h-[520px] flex-col overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="space-y-4 p-3">
            {Array.from({ length: 5 }).map((__, diaIndex) => (
              <div key={diaIndex} className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
                <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const TAG_COLORS = {
  Pollo: 'bg-amber-100 text-amber-800', Carnes: 'bg-red-100 text-red-800',
  Cerdo: 'bg-orange-100 text-orange-800', Pescado: 'bg-blue-100 text-blue-800',
  Vegetariano: 'bg-green-100 text-green-800', Pasta: 'bg-yellow-100 text-yellow-800',
  Arroz: 'bg-lime-100 text-lime-800', Guisos: 'bg-stone-100 text-stone-700',
  Ensaladas: 'bg-emerald-100 text-emerald-800',
};

const CRITERIOS_VARIACION = {
  1: { titulo: 'Rotacion segura', detalle: 'Evita repetir platos usados en las ultimas 2 semanas.' },
  2: { titulo: 'Orden alternado', detalle: 'Alterna el orden de candidatos para abrir una segunda combinacion.' },
  3: { titulo: 'Menos usados', detalle: 'Prioriza platos con menor uso historico.' },
};

const OPCIONES_MENU = ['A', 'C'];

function criterioVariacion(variacion, index) {
  return CRITERIOS_VARIACION[variacion] ?? CRITERIOS_VARIACION[index + 1] ?? {
    titulo: 'Criterio alternativo',
    detalle: 'Combinacion generada desde la rotacion historica.',
  };
}

function platoKey(plato) {
  if (!plato) return 'sin-plato';
  return String(plato.id ?? plato.nombre ?? 'sin-id');
}

function getDiasFinales(dias, overrides = {}) {
  return DIAS.map(dia => {
    const base = dias.find(d => d.dia === dia) ?? { dia, fecha: null, opcionA: null, opcionC: null };
    const ov = overrides[dia] ?? {};
    return { ...base, opcionA: ov.A ?? base.opcionA, opcionC: ov.C ?? base.opcionC };
  });
}

function firmaVariacion(diasFinal) {
  return DIAS.map(dia => {
    const item = diasFinal.find(d => d.dia === dia);
    return `${dia}:${platoKey(item?.opcionA)}:${platoKey(item?.opcionC)}`;
  }).join('|');
}

function compararVariaciones(variaciones, overrides) {
  const filas = variaciones.map((v, index) => ({
    ...v,
    criterio: criterioVariacion(v.variacion, index),
    diasFinal: getDiasFinales(v.dias, overrides[v.variacion] ?? {}),
  }));

  const firmasVistas = new Map();
  const conteoPorSlot = new Map();

  filas.forEach(fila => {
    const firma = firmaVariacion(fila.diasFinal);
    fila.duplicadoDe = firmasVistas.get(firma) ?? null;
    if (!fila.duplicadoDe) firmasVistas.set(firma, fila.label);

    fila.diasFinal.forEach(dia => {
      OPCIONES_MENU.forEach(opcion => {
        const plato = opcion === 'A' ? dia.opcionA : dia.opcionC;
        const key = `${dia.dia}:${opcion}`;
        if (!conteoPorSlot.has(key)) conteoPorSlot.set(key, new Set());
        conteoPorSlot.get(key).add(platoKey(plato));
      });
    });
  });

  const slotsDiferentes = new Set(
    [...conteoPorSlot.entries()]
      .filter(([, valores]) => valores.size > 1)
      .map(([key]) => key)
  );

  return filas.map(fila => ({
    ...fila,
    slotsDiferentes,
    totalDiferencias: fila.diasFinal.reduce((total, dia) => (
      total + OPCIONES_MENU.filter(opcion => slotsDiferentes.has(`${dia.dia}:${opcion}`)).length
    ), 0),
  }));
}

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
            type="button"
            onClick={() => onSelect(p)}
            aria-label={`Seleccionar ${p.nombre} para opcion ${opcion} del ${diaLabel}`}
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
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
      </div>
    </div>
  );
}

// ── Plato dentro de una variación ─────────────────────────────────
function PlatoFila({ opcion, plato, onCambiar, destacado }) {
  const criterio = plato
    ? `${plato.ultimo_uso
      ? `Último uso: hace ${Math.max(0, Math.floor((AHORA_TS - new Date(plato.ultimo_uso).getTime()) / 86400000))} días`
      : 'Nunca usado'} · ${plato.total_usos ?? 0} usos`
    : '';

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
      destacado ? 'border-amber-200 bg-amber-50' : 'border-transparent bg-gray-50'
    }`}>
      <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${
        destacado ? 'bg-amber-200 text-amber-900' : 'bg-brand-100 text-brand-700'
      }`}>
        {opcion}
      </span>
      <div className="flex-1 min-w-0">
        {plato ? (
          <>
            <div className="flex flex-wrap items-center gap-1">
              <p className="text-xs font-medium text-gray-800 leading-tight">{plato.nombre}</p>
              {destacado && (
                <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900">
                  Diferente
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] text-gray-400">{criterio}</p>
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
        type="button"
        onClick={onCambiar}
        aria-label={`Cambiar opcion ${opcion}${plato?.nombre ? `, plato actual ${plato.nombre}` : ''}`}
        title="Cambiar plato"
        className="text-[10px] text-brand-600 hover:text-brand-800 hover:bg-brand-50 px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
      >
        Cambiar
      </button>
    </div>
  );
}

// ── Card de una variación completa ────────────────────────────────
function VariacionCard({ variacion, label, criterio, diasFinal, slotsDiferentes, totalDiferencias, duplicadoDe, onCambiar, onSeleccionar, isSelected, creando }) {
  return (
    <div className={`card flex flex-col transition-all ${isSelected ? 'ring-2 ring-brand-500' : ''} ${duplicadoDe ? 'border-dashed' : ''}`}>
      <div className={`px-4 py-3 border-b ${isSelected ? 'bg-brand-50' : 'bg-gray-50'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-sm text-gray-900">{label}</span>
              {isSelected && <span className="text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded-full">Seleccionada</span>}
              {duplicadoDe && (
                <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
                  Igual a {duplicadoDe}
                </span>
              )}
              {!duplicadoDe && totalDiferencias > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                  {totalDiferencias} diferencias
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] font-semibold text-gray-700">{criterio.titulo}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{criterio.detalle}</p>
          </div>
          <button
            type="button"
            onClick={onSeleccionar}
            disabled={creando}
            aria-label={`Usar ${label}`}
            title={`Usar ${label}`}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 ${
              isSelected ? 'bg-brand-600 text-white disabled:opacity-60' : 'bg-white border border-gray-300 text-gray-700 hover:bg-brand-50 hover:border-brand-300 disabled:opacity-60'
            }`}
          >
            {creando && isSelected ? 'Creando...' : 'Usar esta'}
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 space-y-2">
        {diasFinal.map(s => (
          <div key={s.dia}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
              {DIAS_LABEL[s.dia]}
              <span className="font-normal text-gray-400">{formatCorto(s.fecha)}</span>
            </p>
            <div className="space-y-1">
              <PlatoFila opcion="A" plato={s.opcionA} destacado={slotsDiferentes.has(`${s.dia}:A`)} onCambiar={() => onCambiar(variacion, s.dia, 'A', s.opcionA)} />
              <PlatoFila opcion="C" plato={s.opcionC} destacado={slotsDiferentes.has(`${s.dia}:C`)} onCambiar={() => onCambiar(variacion, s.dia, 'C', s.opcionC)} />
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
  const [searchParams] = useSearchParams();
  const lunesProx = getLunes(1);
  const semanaPrecargada = searchParams.get('semana') || searchParams.get('semana_inicio');
  const [fechaInicio, setFechaInicio] = useState(() => esFechaIso(semanaPrecargada) ? semanaPrecargada : lunesProx);
  const [seleccionada, setSeleccionada] = useState(0); // índice de variación seleccionada (0,1,2)
  const [overrides, setOverrides] = useState({}); // { [variacion]: { [dia]: { A: plato, C: plato } } }
  const [editando, setEditando] = useState(null); // { variacion, dia, opcion, actual }
  const [creando, setCreando] = useState(false);

  const query = useSugerencias(fechaInicio);
  const createMut = useCreateMenu();
  const variaciones = useMemo(() => query.data ?? [], [query.data]); // array de { variacion, label, dias }
  const variacionesComparadas = useMemo(
    () => compararVariaciones(variaciones, overrides),
    [variaciones, overrides]
  );
  const mostrandoRefetch = query.isFetching && !query.isLoading;

  const handleCambiar = (variacion, dia, opcion, actual) => setEditando({ variacion, dia, opcion, actual });

  const handleSelect = (plato) => {
    const { variacion, dia, opcion } = editando;
    setOverrides(prev => ({
      ...prev,
      [variacion]: {
        ...(prev[variacion] ?? {}),
        [dia]: {
          ...((prev[variacion] ?? {})[dia] ?? {}),
          [opcion]: {
            id: plato.id,
            nombre: plato.nombre,
            tags: plato.tags,
            ultimo_uso: plato.ultimo_uso,
            total_usos: plato.total_usos,
          },
        },
      },
    }));
    setEditando(null);
  };

  const handleConfirmar = async (indice = seleccionada) => {
    const varObj = variaciones[indice];
    if (!varObj) return;
    setSeleccionada(indice);
    const ovs = overrides[varObj.variacion] ?? {};

    const diasFinal = getDiasFinales(varObj.dias, ovs);

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
        <h1 className="text-2xl font-bold text-gray-900">Generar menú</h1>
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
          <button
            type="button"
            onClick={recargar}
            disabled={query.isFetching}
            className="btn-secondary text-sm"
            aria-label="Regenerar sugerencias de menú"
            title="Regenerar sugerencias"
          >
            {query.isFetching ? <><Spinner size="sm" /> Regenerando...</> : 'Regenerar'}
          </button>
          <button
            type="button"
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
        <SkeletonSugeridor />
      ) : query.isError ? (
        <div className="text-center py-12 text-red-500 text-sm">Error al cargar sugerencias</div>
      ) : (
        <>
          {mostrandoRefetch && (
            <div className="flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
              <Spinner size="sm" />
              Actualizando sugerencias para la semana seleccionada...
            </div>
          )}
          {variacionesComparadas.length === 0 ? (
            <div className="card border-dashed p-10 text-center">
              <p className="text-sm font-semibold text-gray-700">No hay sugerencias para esta semana.</p>
              <p className="mt-1 text-xs text-gray-400">Proba regenerar o elegir otra fecha de inicio.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {variacionesComparadas.map((v, idx) => (
                <VariacionCard
                  key={v.variacion}
                  variacion={v.variacion}
                  label={v.label}
                  criterio={v.criterio}
                  diasFinal={v.diasFinal}
                  slotsDiferentes={v.slotsDiferentes}
                  totalDiferencias={v.totalDiferencias}
                  duplicadoDe={v.duplicadoDe}
                  onCambiar={handleCambiar}
                  onSeleccionar={() => handleConfirmar(idx)}
                  isSelected={seleccionada === idx}
                  creando={creando}
                />
              ))}
            </div>
          )}
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
