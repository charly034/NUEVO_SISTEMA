import { useMemo, useState } from 'react';
import {
  AlertCircle, Bell, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  Info, Leaf, Search, UtensilsCrossed, X,
} from 'lucide-react';
import BtnPrimary from '../ui/BtnPrimary.jsx';
import { SIN_PEDIDO_ID } from '../../constants/estadosPedido.js';
import {
  diaEsEditablePedido,
  obtenerDiasEditablesPedido,
} from '../../utils/permisosPedido.js';
import { DIA_ABREV } from '../../utils/dias.js';

function cn(...a) { return a.filter(Boolean).join(' '); }

const ABBR = Object.fromEntries(
  Object.entries(DIA_ABREV).map(([dia, corto]) => [dia, corto.toUpperCase()]),
);
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function parseFecha(fechaISO) {
  const [, m, d] = String(fechaISO || '').split('T')[0].split('-').map(Number);
  return { num: String(d || ''), mes: MESES[(m || 1) - 1] || '' };
}

function claveDia(dia) {
  return dia.id || dia.clave;
}

function esFeriado(dia) {
  return dia.estado === 'feriado';
}

function ordenInicial(dia) {
  const sel = dia.seleccion;
  if (sel?.plato && sel.plato.id !== SIN_PEDIDO_ID) {
    return {
      platoId: sel.plato.id ?? sel.platoId ?? null,
      plato: sel.plato,
      platoNombre: sel.plato.nombre || '',
      guarnicion: sel.guarnicion?.nombre || sel.nombreGuarnicion || null,
      guarnicionId: sel.guarnicion?.id ?? sel.guarnicionId ?? null,
      salsa: sel.salsa?.nombre || sel.nombreSalsa || null,
      salsaId: sel.salsa?.id ?? sel.salsaId ?? null,
      noVianda: false,
    };
  }
  if (sel?.sinPedido || dia.estado === 'sin_pedido_por_defecto') {
    return { platoId: null, plato: null, platoNombre: '', guarnicion: null, guarnicionId: null, salsa: null, salsaId: null, noVianda: true };
  }
  return { platoId: null, plato: null, platoNombre: '', guarnicion: null, guarnicionId: null, salsa: null, salsaId: null, noVianda: false };
}

function normalizarOrdenParaComparar(orden = {}) {
  return {
    platoId: orden.platoId == null ? null : String(orden.platoId),
    guarnicionId: orden.guarnicionId == null ? null : String(orden.guarnicionId),
    salsaId: orden.salsaId == null ? null : String(orden.salsaId),
    noVianda: Boolean(orden.noVianda),
  };
}

function ordenTieneCambios(ordenActual, ordenOriginal) {
  const actual = normalizarOrdenParaComparar(ordenActual);
  const original = normalizarOrdenParaComparar(ordenOriginal);
  return (
    actual.platoId !== original.platoId ||
    actual.guarnicionId !== original.guarnicionId ||
    actual.salsaId !== original.salsaId ||
    actual.noVianda !== original.noVianda
  );
}

// ─── Day progress bubbles ───────────────────────────────────────────────────────
function DayProgress({ dias, orders, showV }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 bg-white border-b border-[#E8E5DC] shrink-0">
      {dias.map((day) => {
        const k = claveDia(day);
        const feriado = esFeriado(day);
        const o = orders[k];
        const done = o.platoId !== null || o.noVianda;
        const err = showV && !done && !feriado;
        const { num } = parseFecha(day.fecha);
        return (
          <div key={k} className="flex-1 flex flex-col items-center gap-1">
            <div className={cn('w-9 h-9 rounded-full flex items-center justify-center transition-[background-color,box-shadow] duration-300 ease-out',
              feriado ? 'bg-[#F5F3EE]'
                : done && !o.noVianda ? 'bg-[#5B6B2A] shadow-[0_2px_8px_rgba(91,107,42,0.28)]'
                : done && o.noVianda ? 'bg-[#E8E5DC]'
                : err ? 'bg-red-50 ring-2 ring-red-300' : 'bg-[#F0EDE6]',
            )}>
              {feriado ? <span className="text-[11px]">🏛</span>
                : done && !o.noVianda ? <span className="text-[13px] font-bold text-white font-serif">{num}</span>
                : done && o.noVianda ? <X size={13} className="text-[#6E6B64]" />
                : <span className={cn('text-[13px] font-bold', err ? 'text-red-300' : 'text-[#C8C5BC]')}>{num}</span>}
            </div>
            <span className={cn('text-[9px] font-bold tracking-wide',
              feriado ? 'text-[#C8C5BC]' : done && !o.noVianda ? 'text-[#5B6B2A]' : err ? 'text-red-400' : 'text-[#C8C5BC]',
            )}>{ABBR[k] || String(k).slice(0, 3).toUpperCase()}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Plate detail sheet ─────────────────────────────────────────────────────────
function PlateDetailSheet({ plate, onClose, onSelect }) {
  const alergenos = plate.alergenos || plate.allergens || [];
  const calorias = plate.calorias || plate.calories || null;
  const foto = plate.foto_url || plate.fotoUrl || plate.photo || null;
  const guarniciones = (plate.guarniciones || []).map(g => g.nombre || g);
  const salsas = (plate.salsas || []).map(s => s.nombre || s);
  const vegetariano = Boolean(plate.vegetariano || plate.vegetarian || (plate.etiquetas || []).includes('vegetariano'));

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[80]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[81] bg-white rounded-t-3xl overflow-hidden flex flex-col animate-[sheetup_.25s_ease-out]" style={{ maxHeight: '82%' }}>
        <div className="relative h-52 bg-[#EDF0E4] shrink-0">
          {foto ? (
            <img src={foto} alt={plate.nombre} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <UtensilsCrossed size={44} className="text-[#5B6B2A]/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center">
            <X size={17} className="text-white" />
          </button>
          {vegetariano && (
            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-emerald-600/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <Leaf size={12} className="text-white" /><span className="text-[11px] font-bold text-white">Vegetariano</span>
            </div>
          )}
          <div className="absolute bottom-4 left-5 right-5">
            <h3 className="text-[20px] font-bold text-white font-serif">{plate.nombre}</h3>
            <p className="text-white/75 text-[13px]">{plate.categoria || ''}</p>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          <div className="px-5 pt-5 pb-6 space-y-5">
            <p className="text-[14px] text-[#2A2C1F] leading-relaxed">
              {plate.descripcion_larga || plate.descripcionLarga || plate.descripcion || 'Plato del menú semanal.'}
            </p>
            <div className="flex items-center gap-3">
              {calorias && (
                <div className="flex-1 bg-[#F5F3EE] rounded-2xl px-4 py-3 text-center">
                  <p className="text-[22px] font-bold text-[#2A2C1F] font-serif">{calorias}</p>
                  <p className="text-[11px] text-[#6E6B64] font-semibold">kcal aprox.</p>
                </div>
              )}
              <div className="flex-1 bg-[#F5F3EE] rounded-2xl px-4 py-3 text-center">
                <p className="text-[22px] font-bold text-[#2A2C1F] font-serif">{alergenos.length === 0 ? '✓' : alergenos.length}</p>
                <p className="text-[11px] text-[#6E6B64] font-semibold">{alergenos.length === 0 ? 'Sin alérgenos' : 'Alérgenos'}</p>
              </div>
            </div>
            {alergenos.length > 0 && (
              <div>
                <p className="text-[12px] font-bold text-[#6E6B64] mb-2.5 uppercase tracking-wider">Contiene</p>
                <div className="flex flex-wrap gap-2">
                  {alergenos.map((a) => (
                    <span key={a} className="text-[12px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {guarniciones.length > 0 && (
              <div>
                <p className="text-[12px] font-bold text-[#6E6B64] mb-2.5 uppercase tracking-wider">Incluye elección de guarnición</p>
                <div className="flex flex-wrap gap-2">
                  {guarniciones.map((g) => (
                    <span key={g} className="text-[12px] text-[#3A4A1A] bg-[#EDF0E4] px-2.5 py-1 rounded-full">{g}</span>
                  ))}
                </div>
              </div>
            )}
            {salsas.length > 0 && (
              <div>
                <p className="text-[12px] font-bold text-[#6E6B64] mb-2.5 uppercase tracking-wider">Incluye elección de salsa</p>
                <div className="flex flex-wrap gap-2">
                  {salsas.map((s) => (
                    <span key={s} className="text-[12px] text-[#7A1A1A] bg-[#F5E5E0] px-2.5 py-1 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <BtnPrimary onClick={onSelect} className="w-full">Elegir este plato</BtnPrimary>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Plate selector sheet ───────────────────────────────────────────────────────
function PlateSelectorSheet({ dia, currentOrder, onConfirm, onClose }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todos');
  const [selId, setSelId] = useState(currentOrder.platoId);
  const [garnish, setGarnish] = useState(currentOrder.guarnicionId != null
    ? { id: currentOrder.guarnicionId, nombre: currentOrder.guarnicion }
    : null);
  const [sauce, setSauce] = useState(currentOrder.salsaId != null
    ? { id: currentOrder.salsaId, nombre: currentOrder.salsa }
    : null);
  const [noV, setNoV] = useState(currentOrder.noVianda);
  const [detail, setDetail] = useState(null);

  const platos = useMemo(() => dia.opciones || [], [dia.opciones]);
  const categorias = useMemo(() => {
    const cats = [...new Set(platos.map(p => p.categoria).filter(c => c && c !== 'menu'))];
    return ['Todos', ...cats];
  }, [platos]);

  const filtered = platos.filter(p =>
    (cat === 'Todos' || p.categoria === cat) &&
    (!q || (p.nombre || '').toLowerCase().includes(q.toLowerCase()))
  );

  const selPlate = platos.find(p => p.id === selId) || null;
  const needsG = (selPlate?.guarniciones?.length ?? 0) > 0;
  const needsS = (selPlate?.salsas?.length ?? 0) > 0;
  const canConfirm = noV || (selId != null && (!needsG || garnish) && (!needsS || sauce));
  const { num, mes } = parseFecha(dia.fecha);

  return (
    <>
      <div className="fixed inset-0 bg-black/45 z-[70]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[71] bg-[#FAF8F3] rounded-t-3xl flex flex-col animate-[sheetup_.25s_ease-out]" style={{ maxHeight: '88dvh' }}>
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 bg-[#D8D5C8] rounded-full" /></div>
        <div className="flex items-center justify-between px-5 pb-3 shrink-0">
          <div>
            <p className="text-[11px] text-[#6E6B64] font-semibold mb-0.5">Elegir plato para</p>
            <h3 className="text-[18px] font-bold text-[#2A2C1F] font-serif">
              {dia.dia} <span className="text-[#6E6B64] font-normal text-base">{num} {mes}</span>
            </h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-[#F0EDE6] rounded-full flex items-center justify-center">
            <X size={17} className="text-[#7A7868]" />
          </button>
        </div>

        <div className="mx-5 bg-[#EDF0E4] rounded-xl px-3 py-2 mb-3 flex items-start gap-2 shrink-0">
          <Bell size={12} className="text-[#5B6B2A] mt-0.5 shrink-0" />
          <p className="text-[11px] text-[#3A4A1A] leading-relaxed">Esto <strong>no confirma el pedido</strong>. Confirmá todo junto al terminar.</p>
        </div>

        <button
          onClick={() => { setNoV(v => !v); setSelId(null); setGarnish(null); setSauce(null); }}
          className={cn('mx-5 flex items-center gap-3 px-4 py-3 rounded-xl border mb-3 transition-colors shrink-0',
            noV ? 'bg-[#F0EDE6] border-[#9A9885]/30' : 'bg-white border-[#E8E5DC]')}
        >
          <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
            noV ? 'border-[#5B6B2A] bg-[#5B6B2A]' : 'border-[#D8D5C8]')}>
            {noV && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
          <span className="text-[14px] font-semibold text-[#2A2C1F]">Sin vianda este día</span>
        </button>

        <div className="mx-5 relative mb-3 shrink-0">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6E6B64]" />
          <input
            type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar platos..."
            className="w-full py-2.5 pl-9 pr-4 rounded-xl border border-[#E8E5DC] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#5B6B2A]/15 focus:border-[#5B6B2A]"
          />
        </div>

        {categorias.length > 1 && (
          <div className="flex gap-2 px-5 overflow-x-auto pb-1 mb-2 shrink-0 no-scrollbar">
            {categorias.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={cn('shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors',
                  cat === c ? 'bg-[#5B6B2A] text-white' : 'bg-white border border-[#E8E5DC] text-[#7A7868]')}>
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-1.5">
          {filtered.map((plate) => {
            const isSel = selId === plate.id;
            const vegetariano = Boolean(plate.vegetariano || (plate.etiquetas || []).includes('vegetariano'));
            const tieneGuarnicion = (plate.guarniciones?.length ?? 0) > 0;
            const tieneSalsa = (plate.salsas?.length ?? 0) > 0;
            const seleccionar = () => { setNoV(false); setSelId(isSel ? null : plate.id); setGarnish(null); setSauce(null); };
            return (
              <div key={plate.id}>
                <div className={cn('flex items-center gap-2 px-4 py-3.5 rounded-xl border transition-colors',
                  isSel ? 'bg-white border-[#5B6B2A]/25 border-l-[3px] border-l-[#5B6B2A] shadow-sm' : 'bg-white border-[#E8E5DC]')}>
                  <button onClick={seleccionar} className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <p className="text-[14px] font-bold text-[#2A2C1F]">{plate.nombre}</p>
                      {vegetariano && <Leaf size={12} className="text-emerald-600 shrink-0" />}
                      {tieneGuarnicion && <span className="text-[10px] font-bold text-[#C8782A] bg-orange-50 px-1.5 py-0.5 rounded-full">+ guarnición</span>}
                      {tieneSalsa && <span className="text-[10px] font-bold text-[#A61A1A] bg-red-50 px-1.5 py-0.5 rounded-full">+ salsa</span>}
                      {plate.destacado && <span className="text-[10px] font-bold text-[#5B6B2A] bg-[#EDF0E4] px-1.5 py-0.5 rounded-full">Especial</span>}
                    </div>
                    <p className="text-[12px] text-[#6E6B64]">{plate.descripcion}</p>
                  </button>
                  <button onClick={() => setDetail(plate)} className="w-7 h-7 flex items-center justify-center text-[#C8C5BC] hover:text-[#5B6B2A] shrink-0 transition-colors">
                    <Info size={16} />
                  </button>
                  <button onClick={seleccionar}
                    className={cn('w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                      isSel ? 'border-[#5B6B2A] bg-[#5B6B2A]' : 'border-[#D8D5C8]')}>
                    {isSel && <div className="w-2 h-2 bg-white rounded-full" />}
                  </button>
                </div>
                {isSel && tieneGuarnicion && (
                  <div className="ml-3 mt-1 bg-white border border-[#E8E5DC] rounded-xl px-4 py-3 overflow-hidden">
                    <p className="text-[11px] font-bold text-[#6E6B64] mb-2.5 uppercase tracking-wider">Guarnición</p>
                    <div className="space-y-1">
                      {plate.guarniciones.map((g) => {
                        const activa = garnish?.id === g.id;
                        return (
                          <button key={g.id} onClick={() => setGarnish(activa ? null : g)}
                            className={cn('w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors flex items-center gap-2',
                              activa ? 'bg-[#EDF0E4] font-semibold text-[#3A4A1A]' : 'text-[#2A2C1F] hover:bg-[#F5F3EE]')}>
                            <div className={cn('w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                              activa ? 'border-[#5B6B2A] bg-[#5B6B2A]' : 'border-[#D8D5C8]')}>
                              {activa && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                            {g.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isSel && tieneSalsa && (
                  <div className="ml-3 mt-1 bg-white border border-[#E8E5DC] rounded-xl px-4 py-3 overflow-hidden">
                    <p className="text-[11px] font-bold text-[#6E6B64] mb-2.5 uppercase tracking-wider">Salsa</p>
                    <div className="space-y-1">
                      {plate.salsas.map((s) => {
                        const activa = sauce?.id === s.id;
                        return (
                          <button key={s.id} onClick={() => setSauce(activa ? null : s)}
                            className={cn('w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors flex items-center gap-2',
                              activa ? 'bg-[#F5E5E0] font-semibold text-[#7A1A1A]' : 'text-[#2A2C1F] hover:bg-[#F5F3EE]')}>
                            <div className={cn('w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                              activa ? 'border-[#A61A1A] bg-[#A61A1A]' : 'border-[#D8D5C8]')}>
                              {activa && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                            {s.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <UtensilsCrossed size={26} className="text-[#D8D5C8] mx-auto mb-2" />
              <p className="text-[#6E6B64] text-sm">No se encontraron platos</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 bg-white border-t border-[#E8E5DC] shrink-0">
          <BtnPrimary
            onClick={() => {
              if (noV) onConfirm({ platoId: null, plato: null, platoNombre: '', guarnicion: null, guarnicionId: null, salsa: null, salsaId: null, noVianda: true });
              else if (selPlate) onConfirm({
                platoId: selPlate.platoId ?? selPlate.id,
                plato: selPlate,
                platoNombre: selPlate.nombre,
                guarnicion: garnish?.nombre || null,
                guarnicionId: garnish?.id ?? null,
                salsa: sauce?.nombre || null,
                salsaId: sauce?.id ?? null,
                noVianda: false,
              });
            }}
            disabled={!canConfirm}
            className="w-full py-4 text-[16px]"
          >
            Listo para el {dia.dia}
          </BtnPrimary>
        </div>
      </div>

      {detail && (
        <PlateDetailSheet
          plate={detail}
          onClose={() => setDetail(null)}
          onSelect={() => { setNoV(false); setSelId(detail.id); setGarnish(null); setSauce(null); setDetail(null); }}
        />
      )}
    </>
  );
}

// ─── Weekly order screen ────────────────────────────────────────────────────────
export default function WeeklyOrderView({ readOnly = false, semana, onBack, onGuardar }) {
  const dias = useMemo(() => semana.dias || [], [semana.dias]);
  const ordenesIniciales = useMemo(() =>
    Object.fromEntries(dias.map(d => [claveDia(d), ordenInicial(d)]))
  , [dias]);
  const [orders, setOrders] = useState(ordenesIniciales);
  const [selDay, setSelDay] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showV, setShowV] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState('');

  const habiles = obtenerDiasEditablesPedido(semana);
  const hasChanges = !readOnly && habiles.some(d => {
    const k = claveDia(d);
    return ordenTieneCambios(orders[k], ordenesIniciales[k]);
  });
  const incomplete = habiles.filter(d => { const o = orders[claveDia(d)]; return !o.platoId && !o.noVianda; });

  const rango = semana.rango || '';
  const esActual = semana.tipo === 'actual';
  const deadline = semana.limiteModificacion
    ? `Cierre: ${semana.limiteModificacion.dia} ${semana.limiteModificacion.hora} hs`
    : null;

  const confirmDay = (k, orden) => {
    if (readOnly) return;
    setOrders(p => ({ ...p, [k]: orden }));
    setShowV(false);
    setSelDay(null);
  };

  const doSave = async () => {
    if (readOnly) return;
    if (!hasChanges) return;
    if (incomplete.length > 0) { setShowV(true); return; }
    setSaving(true);
    setErrorGuardar('');
    try {
      const semanaActualizada = {
        ...semana,
        dias: dias.map(d => {
          const o = orders[claveDia(d)];
          if (o.noVianda) {
            return { ...d, seleccion: { plato: { id: SIN_PEDIDO_ID }, platoId: SIN_PEDIDO_ID, sinPedido: true } };
          }
          if (o.platoId != null) {
            return {
              ...d,
              seleccion: {
                plato: o.plato,
                platoId: o.plato?.platoId ?? o.platoId,
                guarnicionId: o.guarnicionId,
                guarnicion: o.guarnicion ? { id: o.guarnicionId, nombre: o.guarnicion } : null,
                salsaId: o.salsaId,
                salsa: o.salsa ? { id: o.salsaId, nombre: o.salsa } : null,
                sinPedido: false,
              },
            };
          }
          return { ...d, seleccion: null };
        }),
      };
      await onGuardar(semanaActualizada);
      setSaved(true);
    } catch (err) {
      setErrorGuardar(err?.message || 'No pudimos guardar el pedido.');
    } finally {
      setSaving(false);
    }
  };

  const diaSeleccionado = selDay ? dias.find(d => claveDia(d) === selDay) : null;

  return (
    <div className="flex flex-col h-full bg-[#FAF8F3] relative">
      {/* Header verde */}
      <div className="bg-[#5B6B2A] px-5 pt-14 pb-5 shrink-0" style={{ borderRadius: '0 0 32px 32px' }}>
        <button
          onClick={() => (hasChanges && !saved ? setShowLeave(true) : onBack())}
          className="flex items-center gap-1 text-white/70 mb-3 -ml-1 hover:text-white"
        >
          <ChevronLeft size={20} /><span className="text-[13px] font-bold">Inicio</span>
        </button>
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[22px] font-bold text-white font-serif">{esActual ? 'Semana actual' : 'Próxima semana'}</h2>
            <p className="text-white/55 text-[13px] mt-0.5">{rango}</p>
          </div>
          {deadline && (
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock size={11} className="text-white/40" />
              <p className="text-[11px] text-white/40">{deadline}</p>
            </div>
          )}
        </div>
      </div>

      <DayProgress dias={dias} orders={orders} showV={showV} />

      {showV && incomplete.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 flex items-center gap-2.5 shrink-0">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700">Falta completar: <span className="font-bold">{incomplete.map(d => d.dia).join(', ')}</span></p>
        </div>
      )}

      {errorGuardar && (
        <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 flex items-center gap-2.5 shrink-0">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700">{errorGuardar}</p>
        </div>
      )}

      <div className="px-5 pt-3 pb-1 shrink-0">
        <p className="text-[12px] text-[#6E6B64]">
          {readOnly ? "Semana cerrada: este pedido se muestra en solo lectura." : "Elegí un plato por día y confirmá todo junto."}
        </p>
      </div>

      {/* Lista de días */}
      <div className="flex-1 overflow-y-auto pb-[calc(11rem+env(safe-area-inset-bottom))]">
        <div className="px-5 space-y-1.5 pt-1">
          {dias.map((day) => {
            const k = claveDia(day);
            const feriado = esFeriado(day);
            const editableDia = diaEsEditablePedido(day, semana);
            const o = orders[k];
            const done = o.platoId !== null || o.noVianda;
            const err = showV && !done && editableDia;
            const { num } = parseFecha(day.fecha);

            if (feriado) {
              return (
                <div key={k} className="w-full rounded-2xl py-3 px-4 bg-[#F5F3EE] border border-[#E8E5DC]">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center w-10 shrink-0">
                      <span className="text-[22px] font-bold leading-none text-[#D8D5C8] font-serif">{num}</span>
                      <span className="text-[9px] font-bold tracking-wider mt-0.5 text-[#D8D5C8]">{ABBR[k] || ''}</span>
                    </div>
                    <div className="w-px h-8 shrink-0 bg-[#E8E5DC]" />
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-[#C8C5BC]">{day.dia}</p>
                      <p className="text-[12px] text-[#C8C5BC]">Sin servicio</p>
                    </div>
                    <span className="text-[11px] font-bold text-[#C8C5BC] bg-[#EDE9E2] px-2.5 py-1 rounded-full">Sin servicio</span>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={k}
                onClick={() => !saved && !readOnly && editableDia && setSelDay(k)}
                className={cn('w-full text-left rounded-2xl transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.99]',
                  done ? 'bg-white border-l-[3px] border-l-[#5B6B2A] border border-[#5B6B2A]/12 shadow-sm py-3.5 px-4'
                    : err ? 'bg-red-50/60 border border-red-200 border-l-[3px] border-l-red-400 py-3 px-4'
                    : 'bg-transparent py-3 px-4 hover:bg-white/60',
                  (saved || readOnly || !editableDia) && 'cursor-default')}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center w-10 shrink-0">
                    <span className={cn('text-[22px] font-bold leading-none font-serif',
                      done && !o.noVianda ? 'text-[#5B6B2A]' : err ? 'text-red-300' : 'text-[#D8D5C8]')}>{num}</span>
                    <span className={cn('text-[9px] font-bold tracking-wider mt-0.5',
                      done ? 'text-[#6E6B64]' : err ? 'text-red-300' : 'text-[#D8D5C8]')}>{ABBR[k] || ''}</span>
                  </div>
                  <div className={cn('w-px h-8 shrink-0', done ? 'bg-[#5B6B2A]/20' : err ? 'bg-red-200' : 'bg-[#E8E5DC]')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[#2A2C1F]">{day.dia}</p>
                    {done && !o.noVianda ? (
                      <p className="text-[13px] text-[#5B6B2A] font-semibold truncate mt-0.5">
                        {o.platoNombre}
                        {o.guarnicion && <span className="text-[#6E6B64] font-normal"> · {o.guarnicion}</span>}
                        {o.salsa && <span className="text-[#6E6B64] font-normal"> · {o.salsa}</span>}
                      </p>
                    ) : done && o.noVianda ? (
                      <p className="text-[13px] text-[#6E6B64] italic">
                        {day.motivo ? "Sin servicio" : "Sin vianda este día"}
                      </p>
                    ) : !editableDia ? (
                      <p className="text-[13px] text-[#6E6B64]">{day.limiteTexto || 'Fuera de plazo'}</p>
                    ) : (
                      <>
                        <p className={cn('text-[13px]', err ? 'text-red-400' : 'text-[#6E6B64]')}>
                          {err ? 'Requerido — tocá para completar' : 'Tocá para elegir'}
                        </p>
                        {day.limiteTexto && (
                          <p className="text-[11px] text-[#6E6B64] mt-0.5">{day.limiteTexto}</p>
                        )}
                      </>
                    )}
                  </div>
                  {editableDia && !saved && !readOnly ? (
                    <ChevronRight size={15} className={cn('shrink-0', done ? 'text-[#6E6B64]' : 'text-[#D8D5C8]')} />
                  ) : (
                    <span className="w-[15px] shrink-0" aria-hidden="true" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer fijo */}
      <div className="fixed inset-x-0 bottom-[calc(4.65rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[480px] bg-white/95 backdrop-blur border-t border-[#E8E5DC] px-5 py-3 space-y-2">
        {readOnly ? (
          <BtnPrimary variant="secondary" onClick={onBack} className="w-full">
            Volver al inicio
          </BtnPrimary>
        ) : saved ? (
          <div className="flex items-center justify-center gap-2 py-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
            <CheckCircle2 size={17} className="text-emerald-600" />
            <span className="text-[15px] font-bold text-emerald-800">¡Pedido confirmado!</span>
          </div>
        ) : (
          <BtnPrimary onClick={doSave} loading={saving} disabled={!hasChanges || saving} className="w-full">
            Confirmar pedido semanal
          </BtnPrimary>
        )}
        {saved ? (
          <BtnPrimary variant="secondary" onClick={onBack} className="w-full" size="sm">Volver al inicio</BtnPrimary>
        ) : (
          hasChanges && (
            <BtnPrimary variant="ghost" onClick={() => setShowLeave(true)} className="w-full" size="sm">Volver sin guardar</BtnPrimary>
          )
        )}
      </div>

      {/* Sheet selector de plato */}
      {diaSeleccionado && (
        <PlateSelectorSheet
          dia={diaSeleccionado}
          currentOrder={orders[selDay]}
          onConfirm={(orden) => confirmDay(selDay, orden)}
          onClose={() => setSelDay(null)}
        />
      )}

      {/* Modal salir sin guardar */}
      {showLeave && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-end">
          <div className="w-full bg-[#FAF8F3] rounded-t-3xl px-6 pt-6 pb-8 animate-[sheetup_.25s_ease-out]">
            <h3 className="text-[18px] font-bold text-[#2A2C1F] mb-2 font-serif">¿Salir sin guardar?</h3>
            <p className="text-sm text-[#7A7868] mb-6 leading-relaxed">Tenés selecciones sin confirmar que se perderán.</p>
            <div className="space-y-2">
              <BtnPrimary variant="danger" onClick={onBack} className="w-full">Salir sin guardar</BtnPrimary>
              <BtnPrimary variant="secondary" onClick={() => setShowLeave(false)} className="w-full">Continuar editando</BtnPrimary>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
