import { useState, useMemo, useCallback, useEffect } from 'react';
import { Tabs, Tab } from '../components/ui/Tabs.jsx';
import * as XLSX from 'xlsx';
import { createPortal } from 'react-dom';
import { usePedidos, useUpdateEstadoPedido, useUpdateEstadoPedidoItem } from '../hooks/usePedidos.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import { useEmpleados } from '../hooks/useEmpleados.js';
import { toast } from '../lib/toast.js';
import { DIAS_ORDEN, DIA_ABREV as DIAS_LABEL, DIA_NOMBRE as DIAS_FULL } from '../lib/dias.js';
import { lunesActualISO as getLunes, addDiasISO as addDias } from '../lib/fechas.js';

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADOS_PEDIDO = [
  { key: 'pendiente',  label: 'Pendiente',  icon: '🕐', cls: 'bg-amber-50 text-amber-700 border-amber-200'  },
  { key: 'en_proceso', label: 'En proceso', icon: '🔥', cls: 'bg-blue-50 text-blue-700 border-blue-200'    },
  { key: 'completo',   label: 'Completo',    icon: '✅', cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  { key: 'cancelado',  label: 'Cancelado',   icon: '❌', cls: 'bg-red-50 text-red-600 border-red-200'      },
];
const ESTADOS_ITEM = [
  { key: 'pendiente',  label: 'Pendiente',  icon: '🕐', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'preparado',  label: 'Preparada',  icon: '🍽️', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'entregado',  label: 'Entregada',  icon: '✅', cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  { key: 'cancelado',  label: 'Cancelada',  icon: '❌', cls: 'bg-red-50 text-red-600 border-red-200' },
];
// Estados ya no escritos; solo para mostrar filas históricas en la DB
const ESTADOS_LEGACY = [
  { key: 'listo',      label: 'Listo',      icon: '✅', cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  { key: 'entregado',  label: 'Entregado',  icon: '📦', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
];
const ESTADO_MAP = Object.fromEntries([...ESTADOS_PEDIDO, ...ESTADOS_ITEM, ...ESTADOS_LEGACY].map(e => [e.key, e]));

const AVATAR_COLORS = [
  'bg-brand-600','bg-blue-600','bg-purple-600','bg-orange-500',
  'bg-pink-600','bg-teal-600','bg-indigo-600','bg-rose-600',
];

// ── Utilidades ────────────────────────────────────────────────────────────────
// getLunes y addDias vienen de lib/fechas.js (ver imports).

function fmt(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-'); return `${d}/${m}`;
}

function fmtFull(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`;
}

function fmtEvento(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const EVENTO_LABELS = {
  pedido_creado: 'Creado',
  pedido_actualizado: 'Actualizado',
  pedido_cancelado: 'Cancelado',
  estado_cambiado: 'Cambio de estado',
  estado_item_cambiado: 'Cambio de vianda',
};

function labelEstado(estado) {
  return ESTADO_MAP[estado]?.label?.toLowerCase() || estado || '';
}

function esResumenInterno(resumen = '') {
  return /\b(seed|test data|datos de prueba|simulado)\b/i.test(resumen);
}

function descripcionEvento(evento) {
  if (evento.tipo === 'estado_cambiado' && evento.estado_anterior && evento.estado_nuevo) {
    return `Cambio de estado: ${labelEstado(evento.estado_anterior)} -> ${labelEstado(evento.estado_nuevo)}`;
  }

  if (evento.tipo === 'pedido_creado') return 'Pedido creado';
  if (evento.tipo === 'pedido_actualizado') return 'Pedido actualizado';
  if (evento.tipo === 'pedido_cancelado') return 'Pedido cancelado';
  if (evento.tipo === 'estado_item_cambiado') return evento.resumen || 'Cambio de estado de vianda';

  if (evento.resumen && !esResumenInterno(evento.resumen)) return evento.resumen;
  return EVENTO_LABELS[evento.tipo] ?? 'Evento registrado';
}

function EmptyPedidos({ filtrosActivos, onLimpiarFiltros }) {
  return (
    <div className="text-center py-12 text-gray-500">
      <p className="text-4xl mb-3">📋</p>
      <p className="text-sm">
        {filtrosActivos
          ? 'No hay pedidos que coincidan con los filtros aplicados.'
          : 'No hay pedidos para esta semana.'}
      </p>
      {filtrosActivos && (
        <button
          type="button"
          onClick={onLimpiarFiltros}
          className="mt-3 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

function iniciales(nombre, apellido) {
  return `${(apellido||'')[0]||''}${(nombre||'')[0]||''}`.toUpperCase();
}

function avatarColor(str) {
  let h = 0;
  for (const c of (str||'')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function texto(valor, fallback = '') {
  return valor == null ? fallback : String(valor);
}

function getPlanNombre(pedido) {
  return pedido?.plan_nombre || 'Plan sin snapshot';
}

function getPlanDetalle(pedido) {
  const partes = [];
  if (pedido?.plan_gramaje_min) {
    partes.push(`${pedido.plan_gramaje_min}-${pedido.plan_gramaje_max || pedido.plan_gramaje_min} g`);
  }
  partes.push(pedido?.plan_incluye_postre ? 'con postre' : 'sin postre');
  partes.push(pedido?.plan_incluye_bebida ? 'con bebida' : 'sin bebida');
  return partes.join(' · ');
}

function getTamanoPlan(pedido) {
  if (pedido?.plan_gramaje_min) return `${pedido.plan_gramaje_min} g`;
  return 'Sin tamaño';
}

function getClavePreparacion(item) {
  return [
    item.plato_id || texto(item.plato_nombre).trim().toLowerCase() || 'sin-plato',
    item.opcion || '',
    item.guarnicion_id || texto(item.guarnicion_nombre).trim().toLowerCase() || '',
  ].join('__');
}

function esItemActivoCocina(item) {
  return item && !item.sin_pedido && item.estado !== 'cancelado';
}

function crearGrupoCocina(item) {
  return {
    plato_nombre: item.plato_nombre,
    opcion: item.opcion,
    guarnicion_nombre: item.guarnicion_nombre,
    cantidad: 0,
    preparadas: 0,
    entregadas: 0,
    pendienteIds: [],    // pendiente → preparado
    preparadoIds: [],    // preparado → entregado
    tamanos: {},
    postres: 0,
    bebidas: 0,
    personas: [],
  };
}

function sumarDetallePlan(grupo, pedido) {
  const tamano = getTamanoPlan(pedido);
  grupo.tamanos[tamano] = (grupo.tamanos[tamano] || 0) + 1;
  if (pedido?.plan_incluye_postre) grupo.postres++;
  if (pedido?.plan_incluye_bebida) grupo.bebidas++;
}

function ordenarTamanos([a], [b]) {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return texto(a).localeCompare(texto(b));
}

function resumenTamanos(tamanos = {}) {
  const partes = Object.entries(tamanos)
    .sort(ordenarTamanos)
    .map(([tamano, cantidad]) => `${cantidad} de ${tamano}`);
  return partes.join(' · ');
}

function resumenExtras(grupo) {
  return `Postres: ${grupo.postres || 0} · Bebidas: ${grupo.bebidas || 0}`;
}

function resumenItems(items = []) {
  const activos = items.filter(esItemActivoCocina);
  const resumen = { viandas: activos.length, tamanos: {}, postres: 0, bebidas: 0 };
  for (const item of activos) {
    const tamano = getTamanoPlan(item);
    resumen.tamanos[tamano] = (resumen.tamanos[tamano] || 0) + 1;
    if (item.plan_incluye_postre) resumen.postres++;
    if (item.plan_incluye_bebida) resumen.bebidas++;
  }
  return resumen;
}

// ── Exportar Excel ────────────────────────────────────────────────────────────

function buildRows(pedidos, semana, { soloEmpresa = null, soloDia = null } = {}) {
  const rows = [];
  for (const p of pedidos) {
    if (soloEmpresa && p.empresa_nombre !== soloEmpresa) continue;
    const nombreCompleto = `${p.empleado_nombre || ''} ${p.empleado_apellido || ''}`.trim();
    for (const item of (p.items || [])) {
      if (soloDia && item.dia !== soloDia) continue;
      const diaIdx = DIAS_ORDEN.indexOf(item.dia);
      const fechaISO = diaIdx >= 0 ? addDias(semana, diaIdx) : null;
      const [y, m, d] = (fechaISO || '- - -').split('-');
      const fechaStr = fechaISO ? `${parseInt(d)}/${parseInt(m)}/${y}` : '';
      rows.push({
        _fechaISO: fechaISO || '',
        EMPRESA: p.empresa_nombre || '',
        FECHA: fechaStr,
        'Nombre y Apellido': nombreCompleto,
        PLAN: getPlanNombre(p),
        TAMANO: p.plan_gramaje_min ? `${p.plan_gramaje_min}-${p.plan_gramaje_max || p.plan_gramaje_min} g` : '',
        POSTRE: p.plan_incluye_postre ? 'Si' : 'No',
        BEBIDA: p.plan_incluye_bebida ? 'Si' : 'No',
        Principal: item.plato_nombre || '',
        GUARNICION: item.guarnicion_nombre || '',
        ESTADO_VIANDA: ESTADO_MAP[item.estado]?.label || item.estado || '',
      });
    }
  }
  rows.sort((a, b) => {
    if (a._fechaISO !== b._fechaISO) return a._fechaISO < b._fechaISO ? -1 : 1;
    if (a.EMPRESA !== b.EMPRESA) return texto(a.EMPRESA).localeCompare(texto(b.EMPRESA));
    if (a.Principal !== b.Principal) return texto(a.Principal).localeCompare(texto(b.Principal));
    return texto(a['Nombre y Apellido']).localeCompare(texto(b['Nombre y Apellido']));
  });
  return rows.map(row =>
    Object.fromEntries(Object.entries(row).filter(([key]) => key !== '_fechaISO'))
  );
}

function exportarExcel(pedidos, semana, filtros = {}) {
  const rows = buildRows(pedidos, semana, filtros);
  if (rows.length === 0) return;

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['EMPRESA', 'FECHA', 'Nombre y Apellido', 'PLAN', 'TAMANO', 'POSTRE', 'BEBIDA', 'Principal', 'GUARNICION'],
  });
  ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 42 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 25 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');

  const sufijo = [
    filtros.soloEmpresa ? filtros.soloEmpresa.replace(/\s+/g, '_') : null,
    filtros.soloDia     ? DIAS_FULL[filtros.soloDia]               : null,
  ].filter(Boolean).join('-');

  XLSX.writeFile(wb, `pedidos-${semana}${sufijo ? '-' + sufijo : ''}.xlsx`);
}

// ── Botón exportar con dropdown de filtros ────────────────────────────────────

function BotonExportar({ pedidos, semana, empresas, compact = false, initialEmpresa = '' }) {
  const [open, setOpen] = useState(false);
  const [soloEmpresa, setSoloEmpresa] = useState(initialEmpresa);
  const [soloDia, setSoloDia]         = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setSoloEmpresa(initialEmpresa);
  }, [open, initialEmpresa]);

  const diasConPedidos = DIAS_ORDEN.filter(d =>
    pedidos.some(p => (p.items || []).some(i => i.dia === d))
  );

  function handleExportar() {
    exportarExcel(pedidos, semana, {
      soloEmpresa: soloEmpresa || null,
      soloDia:     soloDia     || null,
    });
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={pedidos.length === 0}
        className={compact
          ? "flex items-center gap-1 px-2 py-1 bg-white/20 text-white rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
          : "flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        }
      >
        {compact ? '📥 XLS' : '📥 Exportar Excel ▾'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtros de exportación</p>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Empresa</label>
              <select
                value={soloEmpresa}
                onChange={e => setSoloEmpresa(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-brand-500"
              >
                <option value="">Todas las empresas</option>
                {empresas.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Día</label>
              <select
                value={soloDia}
                onChange={e => setSoloDia(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-brand-500"
              >
                <option value="">Todos los días</option>
                {diasConPedidos.map(d => <option key={d} value={d}>{DIAS_FULL[d]}</option>)}
              </select>
            </div>

            <button
              onClick={handleExportar}
              className="w-full bg-brand-700 text-white rounded-lg py-1.5 text-sm font-semibold hover:bg-brand-800 transition-colors"
            >
              📥 Descargar Excel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Impresión ─────────────────────────────────────────────────────────────────

function abrirVentanaImpresion(html) {
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

// CSS base compartido para hojas de impresión
const CSS_BASE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { margin: 8mm 10mm; size: A4 portrait; }
  body { font-family: Arial, sans-serif; font-size: 14px; color: #111; }
  .page-break { page-break-before: always; }
`;

// Genera el HTML de una hoja de producción para un día
// Header compartido por las hojas de impresión: título + subtítulo (badge o texto) + timestamp
function htmlHeader(titulo, subtituloHtml) {
  return `
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #1a5c2a;padding-bottom:4px;margin-bottom:8px">
    <div>
      <div style="font-size:20px;font-weight:bold;color:#1a5c2a">${titulo}</div>
      ${subtituloHtml}
    </div>
    <div style="font-size:11px;color:#666;text-align:right">La Quinta · ${new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</div>
  </div>`;
}

function htmlProduccion(dia, gruposCocina, semana) {
  const fechaIdx = DIAS_ORDEN.indexOf(dia);
  const fecha = fechaIdx >= 0 ? fmtFull(addDias(semana, fechaIdx)) : '';
  const total = gruposCocina.reduce((s, g) => s + g.cantidad, 0);
  return `
<div>
  ${htmlHeader(
    `Producción — ${DIAS_FULL[dia]} ${fecha}`,
    `<span style="background:#1a5c2a;color:white;font-size:13px;font-weight:bold;padding:2px 8px;border-radius:3px;display:inline-block;margin-top:3px">${total} vianda${total !== 1 ? 's' : ''}</span>`
  )}
  <table style="width:100%;border-collapse:collapse;border:1px solid #bbb">
    <thead><tr>
      <th style="background:#1a5c2a;color:white;text-align:left;padding:5px 8px;font-size:14px">Plato</th>
      <th style="background:#1a5c2a;color:white;text-align:center;width:55px;padding:5px 8px;font-size:14px">Cant.</th>
    </tr></thead>
    <tbody>
      ${gruposCocina.map((g, i) => `
      <tr style="border-bottom:1px solid #bbb;${i % 2 === 1 ? 'background:#f4f4f4' : ''}">
        <td style="padding:4px 8px">
          <span style="font-weight:500">${g.plato_nombre}</span>
          ${g.opcion || g.guarnicion_nombre ? ` <span style="color:#666;font-size:12px">·  ${[g.opcion ? 'Op.'+g.opcion : '', g.guarnicion_nombre ? '+ '+g.guarnicion_nombre : ''].filter(Boolean).join(' · ')}</span>` : ''}
          <div style="color:#1a5c2a;font-size:12px;margin-top:1px">${resumenTamanos(g.tamanos)}</div>
          <div style="color:#666;font-size:11px;margin-top:1px">${resumenExtras(g)}</div>
        </td>
        <td style="padding:4px 8px;text-align:center;font-size:20px;font-weight:bold;color:#1a5c2a;border-left:2px solid #bbb">${g.cantidad}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>`;
}

// Genera el HTML del detalle por empresa para un día
function htmlDetalle(dia, pedidos, semana) {
  const fechaIdx = DIAS_ORDEN.indexOf(dia);
  const fecha = fechaIdx >= 0 ? fmtFull(addDias(semana, fechaIdx)) : '';
  const porEmpresa = {};
  for (const p of pedidos) {
    const items = (p.items || []).filter(i => i.dia === dia && esItemActivoCocina(i));
    if (!items.length) continue;
    const emp = p.empresa_nombre || 'Sin empresa';
    if (!porEmpresa[emp]) porEmpresa[emp] = [];
    porEmpresa[emp].push({ nombre: `${p.empleado_apellido}, ${p.empleado_nombre}`, items, plan: getPlanNombre(p), planDetalle: getPlanDetalle(p) });
  }
  const empresas = Object.entries(porEmpresa).sort(([a],[b]) => texto(a).localeCompare(texto(b)));
  const total = empresas.reduce((s, [, ps]) => s + ps.length, 0);
  if (!empresas.length) return '';
  return `
<div>
  ${htmlHeader(
    `Detalle por empresa — ${DIAS_FULL[dia]} ${fecha}`,
    `<div style="font-size:12px;color:#555;margin-top:2px">${total} vianda${total!==1?'s':''} · ${empresas.length} empresa${empresas.length!==1?'s':''}</div>`
  )}
  ${empresas.map(([empresa, personas]) => `
  <div style="margin-bottom:8px;break-inside:avoid;border:2px solid #1a5c2a;border-radius:3px;overflow:hidden">
    <div style="background:#1a5c2a;color:white;padding:4px 8px;font-size:14px;font-weight:bold;display:flex;justify-content:space-between">
      <span>${empresa}</span><span>${personas.length} pers.</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#e8f5e9">
        <th style="padding:3px 6px;text-align:left;font-size:12px;color:#1a5c2a;border-bottom:1px solid #999;width:28%">Nombre</th>
        <th style="padding:3px 6px;text-align:left;font-size:12px;color:#1a5c2a;border-bottom:1px solid #999;width:22%">Plan</th>
        <th style="padding:3px 6px;text-align:left;font-size:12px;color:#1a5c2a;border-bottom:1px solid #999;width:32%">Plato</th>
        <th style="padding:3px 6px;text-align:left;font-size:12px;color:#1a5c2a;border-bottom:1px solid #999;width:18%">Guarnición</th>
      </tr></thead>
      <tbody>
        ${personas.sort((a,b) => {
          const pa = a.items[0]?.plato_nombre || '';
          const pb = b.items[0]?.plato_nombre || '';
          return texto(pa).localeCompare(texto(pb)) || texto(a.nombre).localeCompare(texto(b.nombre));
        }).map((p, ri) => p.items.map((item, idx) => `
        <tr style="border-bottom:1px solid #ddd;${ri % 2 === 1 ? 'background:#f7faf8' : ''}">
          <td style="padding:3px 6px;font-weight:${idx===0?'600':'400'};color:${idx===0?'#111':'#888'};white-space:nowrap;font-size:13px">${idx===0 ? p.nombre : ''}</td>
          <td style="padding:3px 6px;font-size:12px;color:#166534">${idx===0 ? `${p.plan}<br><span style="color:#777;font-size:10px">${p.planDetalle}</span>` : ''}</td>
          <td style="padding:3px 6px;font-size:13px">${item.plato_nombre}${item.opcion ? ` <span style="color:#888;font-size:11px">Op.${item.opcion}</span>` : ''}</td>
          <td style="padding:3px 6px;color:#166534;font-size:13px">${item.guarnicion_nombre || ''}</td>
        </tr>`).join('')).join('')}
      </tbody>
    </table>
  </div>`).join('')}
</div>`;
}

function imprimirAmbas(dia, gruposCocina, pedidos, semana) {
  const hDet = htmlDetalle(dia, pedidos, semana);
  abrirVentanaImpresion(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS_BASE}</style></head><body>${htmlProduccion(dia, gruposCocina, semana)}${hDet ? '<div class="page-break"></div>' + hDet : ''}</body></html>`);
}

// ── Componentes UI ────────────────────────────────────────────────────────────

function Avatar({ nombre, apellido, size = 'md' }) {
  const color = avatarColor(apellido);
  const sz = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full ${color} flex items-center justify-center text-white font-bold shrink-0`}>
      {iniciales(nombre, apellido)}
    </div>
  );
}

function EstadoBadge({ pedido, onCambiar, loading }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const e = ESTADO_MAP[pedido.estado] || ESTADO_MAP.pendiente;

  const toggleMenu = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = 178;
    const opensUp = rect.bottom + menuHeight + 8 > window.innerHeight;
    setMenuPos({
      top: opensUp ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
    setOpen(o => !o);
  };

  return (
    <div className="relative" onClick={ev => ev.stopPropagation()}>
      <button
        onClick={toggleMenu}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${e.cls} ${loading ? 'opacity-60' : 'hover:opacity-80'} transition-opacity`}
      >
        {loading ? <span className="animate-spin">⟳</span> : <span>{e.icon}</span>}
        <span>{e.label}</span>
        <span className="opacity-40 text-[10px]">▾</span>
      </button>

      {open && (
        createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[80] bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[160px]"
              style={{
                top: menuPos?.top ?? 0,
                right: menuPos?.right ?? 8,
              }}
              onClick={ev => ev.stopPropagation()}
            >
            {ESTADOS_PEDIDO.filter(s => s.key !== pedido.estado).map(s => (
              <button
                key={s.key}
                onClick={() => { onCambiar(s.key); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <span>{s.icon}</span><span>{s.label}</span>
              </button>
            ))}
            </div>
          </>,
          document.body
        )
      )}
    </div>
  );
}

const SIGUIENTE_ESTADO_ITEM = { pendiente: 'preparado', preparado: 'entregado' };
const ACCION_LABEL = { pendiente: 'Preparar', preparado: 'Entregar', entregado: 'Entregada', cancelado: 'Cancelada' };

function EstadoItemBadge({ item, onCambiar, loading }) {
  const [open, setOpen] = useState(false);
  const estado = item.estado || (item.sin_pedido ? 'cancelado' : 'pendiente');
  const e = ESTADO_MAP[estado] || ESTADO_MAP.pendiente;
  const siguiente = SIGUIENTE_ESTADO_ITEM[estado];
  const textoAccion = ACCION_LABEL[estado] || estado;

  return (
    <div className="relative print:hidden" onClick={ev => ev.stopPropagation()}>
      <button
        type="button"
        disabled={loading || item.sin_pedido || !siguiente}
        onClick={() => {
          if (siguiente) onCambiar(item.id, siguiente);
          else setOpen(o => !o);
        }}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${e.cls} ${loading ? 'opacity-60' : siguiente ? 'hover:opacity-80' : 'opacity-70 cursor-default'}`}
        title={siguiente ? `Marcar como ${ACCION_LABEL[siguiente]?.toLowerCase()}` : textoAccion}
      >
        <span>{loading ? '...' : e.icon}</span>
        <span>{textoAccion}</span>
      </button>
      <button
        type="button"
        disabled={loading || item.sin_pedido}
        onClick={() => setOpen(o => !o)}
        className="ml-1 rounded px-1 text-[11px] text-gray-500 hover:bg-gray-50 hover:text-gray-600 disabled:opacity-40"
        aria-label="Abrir estados de vianda"
      >
        ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-[80] mt-1 min-w-[150px] rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
            {ESTADOS_ITEM.filter(s => s.key !== estado).map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => { onCambiar(item.id, s.key); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
              >
                <span>{s.icon}</span><span>{s.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Barra de acción masiva ────────────────────────────────────────────────────

function BulkActionBar({ count, onClear, onCambiarEstado, loading }) {
  const [estadoSel, setEstadoSel] = useState('en_proceso');
  return (
    <div className="flex items-center gap-3 bg-brand-700 text-white px-4 py-2.5 rounded-xl mb-4 print:hidden">
      <span className="text-sm font-semibold">{count} seleccionado{count !== 1 ? 's' : ''}</span>
      <div className="flex items-center gap-2 ml-auto">
        <select
          value={estadoSel}
          onChange={e => setEstadoSel(e.target.value)}
          className="text-sm bg-white text-gray-800 rounded-lg px-2 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {ESTADOS_PEDIDO.map(e => <option key={e.key} value={e.key}>{e.icon} {e.label}</option>)}
        </select>
        <button
          onClick={() => onCambiarEstado(estadoSel)}
          disabled={loading}
          className="bg-white text-brand-700 font-semibold text-sm px-3 py-1 rounded-lg hover:bg-brand-50 disabled:opacity-60"
        >
          {loading ? 'Aplicando...' : 'Aplicar'}
        </button>
        <button onClick={onClear} className="text-brand-200 hover:text-white text-sm ml-1">✕ Limpiar</button>
      </div>
    </div>
  );
}

// ── Empleados sin pedido ──────────────────────────────────────────────────────

function EmpleadosSinPedido({ pedidos, empresaFiltro }) {
  const [abierto, setAbierto] = useState(false);
  const { data: empleados = [] } = useEmpleados(empresaFiltro || undefined);

  const sinPedido = useMemo(() => {
    if (!empresaFiltro) return [];
    const conPedido = new Set(pedidos.map(p => p.empleado_id));
    return empleados.filter(e => e.rol !== 'admin' && e.activo && !conPedido.has(e.id));
  }, [empleados, pedidos, empresaFiltro]);

  if (!empresaFiltro || sinPedido.length === 0) return null;

  return (
    <div className="mb-4 print:hidden">
      <button
        onClick={() => setAbierto(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
      >
        <span>⚠️ {sinPedido.length} empleado{sinPedido.length !== 1 ? 's' : ''} sin pedido esta semana</span>
        <span>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <div className="mt-1 bg-white border border-red-100 rounded-xl overflow-hidden divide-y divide-red-50">
          {sinPedido.map(e => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar nombre={e.nombre} apellido={e.apellido} />
              <div>
                <p className="text-sm font-medium text-gray-800">{e.apellido}, {e.nombre}</p>
                <p className="text-xs text-gray-500">{e.email}</p>
              </div>
              <span className="ml-auto text-xs text-red-500 font-medium">Sin pedido</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card de pedido ────────────────────────────────────────────────────────────

function PedidoCard({ pedido, diasSemana, onCambiarEstado, onCambiarEstadoItem, loadingId, loadingItemId, selected, onToggleSelect }) {
  const [expandido, setExpandido] = useState(false);
  const itemsPorDia = Object.fromEntries((pedido.items||[]).map(i => [i.dia, i]));
  const diasConItem = diasSemana.filter(d => itemsPorDia[d]);
  const isSelected = selected.has(pedido.id);
  const tieneEventos = (pedido.eventos ?? []).length > 0;

  return (
    <div className={`bg-white rounded-xl border overflow-hidden shadow-sm transition-colors ${isSelected ? 'border-brand-400' : 'border-gray-100'}`}>
      {/* Fila principal — siempre visible */}
      <div className="flex items-center px-4 py-3">
        <div className="mr-3 print:hidden" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(pedido.id)}
            className="w-4 h-4 accent-brand-700 cursor-pointer"
          />
        </div>

        <Avatar nombre={pedido.empleado_nombre} apellido={pedido.empleado_apellido} />

        <div className="ml-3 flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
            {pedido.empleado_apellido}, {pedido.empleado_nombre}
          </p>
          <p className="text-xs text-gray-500">{getPlanDetalle(pedido)}</p>
        </div>

        <div className="flex items-center gap-2 ml-2 shrink-0">
          <EstadoBadge
            pedido={pedido}
            loading={loadingId === pedido.id}
            onCambiar={(estado) => onCambiarEstado(pedido.id, estado)}
          />
          {tieneEventos && (
            <button
              type="button"
              onClick={() => setExpandido(e => !e)}
              className="text-gray-500 hover:text-gray-500 text-xs print:hidden"
              title="Ver historial"
            >
              {expandido ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {/* Items por día — siempre visibles */}
      {diasConItem.length > 0 && (
        <div className="border-t border-gray-50 divide-y divide-gray-50">
          {diasConItem.map(dia => {
            const item = itemsPorDia[dia];
            return (
              <div key={dia} className="flex items-center gap-3 px-4 py-2">
                <span className="text-[11px] font-bold text-brand-700 w-8 shrink-0">{DIAS_LABEL[dia]}</span>
                <p className="text-xs text-gray-800 flex-1 truncate">{item.plato_nombre}</p>
                <div className="flex gap-2 shrink-0">
                  {item.opcion && <span className="text-[11px] text-gray-500">Op.{item.opcion}</span>}
                  {item.guarnicion_nombre && <span className="text-[11px] text-emerald-600 truncate max-w-[80px]">+{item.guarnicion_nombre}</span>}
                  <EstadoItemBadge
                    item={item}
                    loading={loadingItemId === item.id}
                    onCambiar={onCambiarEstadoItem}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Historial — colapsable, solo si hay eventos */}
      {expandido && tieneEventos && (
        <div className="border-t border-gray-100 px-4 py-3 bg-slate-50">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Historial</p>
          <div className="space-y-2">
            {pedido.eventos.slice().reverse().map((evento) => (
              <div key={evento.id} className="flex gap-2 text-xs">
                <span className="mt-1 w-2 h-2 rounded-full bg-brand-600 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700">{descripcionEvento(evento)}</p>
                  <p className="text-slate-500">{[evento.actor_nombre, fmtEvento(evento.created_at)].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vista por día ─────────────────────────────────────────────────────────────

function VistaDia({ pedidos, semana, diaActivo, setDiaActivo, filtrosActivos, onLimpiarFiltros, onCambiarEstadoItem, loadingItemId, onEntregarVarios }) {
  const [subVista, setSubVista] = useState('cocina'); // 'cocina' | 'empresa'
  const [bulkGrupo, setBulkGrupo] = useState(null); // key del grupo procesando
  const [filtroPlatoTxt, setFiltroPlatoTxt] = useState('');
  const [expandGrupo, setExpandGrupo] = useState(null); // grupoKey expandido
  const diaHoy = semana === getLunes() ? DIAS_ORDEN[(new Date().getDay() + 6) % 7] : null;

  const diasVisibles = useMemo(() => DIAS_ORDEN.filter(d =>
    pedidos.some(p => (p.items || []).some(i => i.dia === d && esItemActivoCocina(i)))
  ), [pedidos]);
  const hayPedidosSemana = diasVisibles.length > 0;
  const fechaDia = (dia) => { const idx = DIAS_ORDEN.indexOf(dia); return idx >= 0 ? addDias(semana, idx) : null; };
  const dia = diasVisibles.includes(diaActivo) ? diaActivo : diasVisibles[0];

  const itemsDia = useMemo(() => pedidos.flatMap(p =>
    (p.items||[]).filter(i => i.dia === dia).map(i => ({
      ...i,
      empleado_nombre: p.empleado_nombre,
      empleado_apellido: p.empleado_apellido,
      empresa_nombre: p.empresa_nombre,
      plan_id: p.plan_id,
      plan_nombre: getPlanNombre(p),
      plan_detalle: getPlanDetalle(p),
      plan_gramaje_min: p.plan_gramaje_min,
      plan_gramaje_max: p.plan_gramaje_max,
      plan_incluye_postre: p.plan_incluye_postre,
      plan_incluye_bebida: p.plan_incluye_bebida,
    }))
  ), [pedidos, dia]);
  const itemsDiaActivos = useMemo(() => itemsDia.filter(esItemActivoCocina), [itemsDia]);

  // Grupos para lista de cocina: plato + opcion + guarnicion → cantidad
  const gruposCocina = useMemo(() => {
    const map = {};
    for (const item of itemsDiaActivos) {
      const key = getClavePreparacion(item);
      if (!map[key]) map[key] = crearGrupoCocina(item);
      map[key].cantidad++;
      if (item.estado === 'entregado') map[key].entregadas++;
      else if (item.estado === 'preparado') { map[key].preparadas++; map[key].preparadoIds.push(item.id); }
      else map[key].pendienteIds.push(item.id);
      sumarDetallePlan(map[key], item);
      map[key].personas.push({ nombre: `${texto(item.empleado_apellido)}, ${texto(item.empleado_nombre)}`, empresa: item.empresa_nombre, plan: item.plan_nombre, itemId: item.id, estado: item.estado });
    }
    return Object.values(map).sort((a,b) => b.cantidad - a.cantidad);
  }, [itemsDiaActivos]);

  // Grupos para vista por empresa: empresa → persona → items
  const gruposEmpresa = useMemo(() => {
    const map = {};
    for (const p of pedidos) {
      const items = (p.items||[]).filter(i => i.dia === dia);
      if (!items.length) continue;
      const emp = p.empresa_nombre || 'Sin empresa';
      if (!map[emp]) map[emp] = { personas: [], pendienteIds: [], preparadoIds: [] };
      map[emp].personas.push({ nombre: `${p.empleado_apellido}, ${p.empleado_nombre}`, items });
      for (const item of items) {
        if (!esItemActivoCocina(item)) continue;
        if (item.estado === 'pendiente') map[emp].pendienteIds.push(item.id);
        else if (item.estado === 'preparado') map[emp].preparadoIds.push(item.id);
      }
    }
    return Object.entries(map).sort(([a],[b]) => texto(a).localeCompare(texto(b)));
  }, [pedidos, dia]);

  const gruposCocinaFiltrados = useMemo(() => {
    if (!filtroPlatoTxt.trim()) return gruposCocina;
    const q = filtroPlatoTxt.toLowerCase();
    return gruposCocina.filter(g => texto(g.plato_nombre).toLowerCase().includes(q));
  }, [gruposCocina, filtroPlatoTxt]);

  const resumenDia = useMemo(() => resumenItems(itemsDia), [itemsDia]);

  if (!hayPedidosSemana) {
    return (
      <EmptyPedidos filtrosActivos={filtrosActivos} onLimpiarFiltros={onLimpiarFiltros} />
    );
  }

  return (
    <div>
      {/* Tabs de días */}
      <div className="flex flex-wrap gap-1.5 mb-3 pb-1">
        {diasVisibles.map(d => {
          const itemsDiaD = pedidos.flatMap(p => (p.items||[]).filter(i => i.dia === d && esItemActivoCocina(i)));
          const count = itemsDiaD.length;
          const porPreparar = itemsDiaD.filter(i => i.estado === 'pendiente').length;
          const preparadas  = itemsDiaD.filter(i => i.estado === 'preparado').length;
          const activo = d === dia;
          return (
            <button
              key={d}
              onClick={() => { setDiaActivo(d); setFiltroPlatoTxt(''); }}
              className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${activo ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}
            >
              <span className="font-bold flex items-center gap-1">
                {DIAS_FULL[d]}
                {d === diaHoy && <span className={`text-[9px] font-bold px-1 py-px rounded ${activo ? 'bg-white text-brand-700' : 'bg-brand-600 text-white'}`}>Hoy</span>}
              </span>
              <span className={`text-[10px] ${activo ? 'text-brand-200' : 'text-gray-500'}`}>{fmt(fechaDia(d))}</span>
              <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activo ? 'bg-white text-brand-700' : 'bg-brand-100 text-brand-700'}`}>{count}</span>
              {porPreparar > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activo ? 'bg-amber-300 text-amber-900' : 'bg-amber-100 text-amber-700'}`}>{porPreparar} por hacer</span>
              )}
              {preparadas > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activo ? 'bg-blue-200 text-blue-900' : 'bg-blue-100 text-blue-700'}`}>{preparadas} listas</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Leyenda de estados — solo cuando hay al menos dos estados distintos en la semana */}
      {(() => {
        const estados = new Set(pedidos.flatMap(p => (p.items||[]).filter(esItemActivoCocina).map(i => i.estado)));
        if (estados.size < 2) return null;
        return (
          <div className="flex items-center gap-3 mb-3 text-[11px] text-gray-500">
            {estados.has('pendiente')  && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Por preparar</span>}
            {estados.has('preparado') && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Preparada</span>}
            {estados.has('entregado') && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-600 inline-block" />Entregada</span>}
          </div>
        );
      })()}

      {/* Sub-tabs + búsqueda + acciones secundarias */}
      {dia && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1 shrink-0">
              {[['cocina','🍳 Cocina'],['empresa','🏢 Empresa']].map(([v,l]) => (
                <button
                  key={v}
                  onClick={() => setSubVista(v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${subVista === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {subVista === 'cocina' && (
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
                <input
                  type="text"
                  placeholder="Buscar plato..."
                  value={filtroPlatoTxt}
                  onChange={e => setFiltroPlatoTxt(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-400"
                />
              </div>
            )}
            <button
              onClick={() => imprimirAmbas(dia, gruposCocina, pedidos, semana)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors shrink-0"
              title="Imprimir producción + detalle por empresa"
            >
              🖨️ Imprimir
            </button>
            <button
              onClick={() => exportarExcel(pedidos, semana, { soloDia: dia })}
              disabled={pedidos.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors shrink-0"
              title="Descargar etiquetas del día en Excel"
            >
              📥 Etiquetas
            </button>
          </div>

          {/* Acciones masivas — barra propia, solo aparece cuando hay pendientes */}
          {(() => {
            const idsPorPreparar = gruposCocina.flatMap(g => g.pendienteIds);
            const idsPreparadas  = gruposCocina.flatMap(g => g.preparadoIds);
            if (!idsPorPreparar.length && !idsPreparadas.length) return null;
            return (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-500 mr-1 shrink-0">{DIAS_FULL[dia]}:</span>
                {idsPorPreparar.length > 0 && (
                  <button
                    onClick={() => onEntregarVarios(idsPorPreparar, 'preparado')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors shrink-0"
                  >
                    🍽️ Preparar {idsPorPreparar.length} viandas
                  </button>
                )}
                {idsPreparadas.length > 0 && (
                  <button
                    onClick={() => onEntregarVarios(idsPreparadas, 'entregado')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                  >
                    ✓ Entregar {idsPreparadas.length} viandas
                  </button>
                )}
              </div>
            );
          })()}
        </>
      )}

      {dia && (() => {
        const porPreparar = itemsDiaActivos.filter(i => i.estado === 'pendiente').length;
        const preparadas  = itemsDiaActivos.filter(i => i.estado === 'preparado').length;
        const entregadas  = itemsDiaActivos.filter(i => i.estado === 'entregado').length;
        return (
          <div className="mb-3 grid grid-cols-4 gap-0 overflow-hidden rounded-xl border border-gray-100 shadow-sm divide-x divide-gray-100">
            <div className="bg-white p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{itemsDiaActivos.length}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Total</p>
              {resumenTamanos(resumenDia.tamanos) && (
                <p className="text-[10px] text-gray-500 leading-tight mt-0.5 truncate">{resumenTamanos(resumenDia.tamanos)}</p>
              )}
            </div>
            <div className="bg-amber-50 p-3 text-center">
              <p className="text-xl font-bold text-amber-700">{porPreparar}</p>
              <p className="text-[11px] text-amber-600 mt-0.5">Por preparar</p>
            </div>
            <div className="bg-blue-50 p-3 text-center">
              <p className="text-xl font-bold text-blue-700">{preparadas}</p>
              <p className="text-[11px] text-blue-600 mt-0.5">Preparadas</p>
            </div>
            <div className="bg-brand-50 p-3 text-center">
              <p className="text-xl font-bold text-brand-700">{entregadas}</p>
              <p className="text-[11px] text-brand-600 mt-0.5">Entregadas</p>
            </div>
          </div>
        );
      })()}

      {/* ── Lista de cocina ── */}
      {subVista === 'cocina' && (
        <div className="space-y-2">
          {gruposCocinaFiltrados.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">
              {itemsDiaActivos.length === 0 ? 'Sin pedidos activos para este dia.' : 'Sin resultados.'}
            </p>
          )}
          {gruposCocinaFiltrados.map((grupo, i) => {
            const todoEntregado = grupo.entregadas === grupo.cantidad;
            const grupoKey = `${grupo.plato_nombre}__${grupo.opcion||''}__${grupo.guarnicion_nombre||''}`;
            const cargandoGrupo = bulkGrupo === grupoKey;
            const estaExpandido = expandGrupo === grupoKey;
            return (
              <div key={i} className={`bg-white rounded-xl border shadow-sm ${todoEntregado ? 'border-brand-200' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{grupo.plato_nombre}</p>
                      {todoEntregado
                        ? <span className="text-[11px] font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">✓ Entregadas</span>
                        : grupo.preparadas > 0 && grupo.pendienteIds.length === 0
                          ? <span className="text-[11px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🍽️ {grupo.preparadas} listo{grupo.preparadas !== 1 ? 's' : ''}</span>
                          : <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{grupo.pendienteIds.length} por preparar</span>
                      }
                      {!todoEntregado && grupo.preparadas > 0 && grupo.pendienteIds.length > 0 && (
                        <span className="text-[11px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🍽️ {grupo.preparadas} listo{grupo.preparadas !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-0.5">
                      {grupo.opcion && <span className="text-xs text-gray-500">Opción {grupo.opcion}</span>}
                      {grupo.guarnicion_nombre && <span className="text-xs text-emerald-600">+ {grupo.guarnicion_nombre}</span>}
                    </div>
                    <p className="mt-1 text-xs font-medium text-brand-700">
                      {grupo.cantidad} vianda{grupo.cantidad !== 1 ? 's' : ''} · {resumenTamanos(grupo.tamanos)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">{resumenExtras(grupo)}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className={`text-xl font-bold w-11 h-11 rounded-xl flex items-center justify-center ${todoEntregado ? 'bg-brand-100 text-brand-700' : 'bg-brand-700 text-white'}`}>
                      {grupo.cantidad}
                    </div>
                    {grupo.pendienteIds.length > 0 && (
                      <button
                        onClick={async () => {
                          setBulkGrupo(grupoKey);
                          await onEntregarVarios(grupo.pendienteIds, 'preparado');
                          setBulkGrupo(null);
                        }}
                        disabled={cargandoGrupo}
                        className="text-[11px] font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 px-2 py-0.5 rounded-full transition-colors whitespace-nowrap"
                      >
                        {cargandoGrupo ? '...' : `🍽️ Preparar ${grupo.pendienteIds.length}`}
                      </button>
                    )}
                    {grupo.preparadoIds.length > 0 && (
                      <button
                        onClick={async () => {
                          setBulkGrupo(grupoKey);
                          await onEntregarVarios(grupo.preparadoIds, 'entregado');
                          setBulkGrupo(null);
                        }}
                        disabled={cargandoGrupo}
                        className="text-[11px] font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 px-2 py-0.5 rounded-full transition-colors whitespace-nowrap"
                      >
                        {cargandoGrupo ? '...' : `✓ Entregar ${grupo.preparadoIds.length}`}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandGrupo(estaExpandido ? null : grupoKey)}
                      className="text-[11px] text-gray-500 hover:text-gray-600 transition-colors"
                    >
                      {estaExpandido ? '▲ ocultar' : '▼ personas'}
                    </button>
                  </div>
                </div>
                {estaExpandido && (
                  <div className="border-t border-gray-100 px-4 py-2 space-y-1">
                    {grupo.personas.map((p, pi) => {
                      const siguienteEstado = p.estado === 'pendiente' ? 'preparado' : p.estado === 'preparado' ? 'entregado' : null;
                      const accionLabel = p.estado === 'pendiente' ? '🍽️ Preparar' : p.estado === 'preparado' ? '✓ Entregar' : null;
                      const estadoCls = p.estado === 'entregado' ? 'text-brand-600' : p.estado === 'preparado' ? 'text-blue-600' : 'text-amber-600';
                      const cargandoItem = loadingItemId === p.itemId;
                      return (
                        <div key={pi} className="flex items-center justify-between gap-2 py-1">
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-gray-800">{p.nombre}</span>
                            {p.empresa && <span className="ml-1.5 text-[11px] text-gray-500">{p.empresa}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[11px] font-semibold ${estadoCls}`}>{p.estado}</span>
                            {siguienteEstado && (
                              <button
                                onClick={() => onCambiarEstadoItem(p.itemId, siguienteEstado)}
                                disabled={cargandoItem}
                                className="text-[11px] font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 px-2 py-0.5 rounded-full transition-colors whitespace-nowrap"
                              >
                                {cargandoItem ? '...' : accionLabel}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {gruposCocinaFiltrados.length > 0 && (
            <p className="text-xs text-gray-500 text-right pt-1">
              Total: {gruposCocinaFiltrados.reduce((s,g) => s + g.cantidad, 0)} viandas
            </p>
          )}
        </div>
      )}

      {/* ── Por empresa ── */}
      {subVista === 'empresa' && (
        <div className="space-y-3">
          {gruposEmpresa.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">Sin pedidos para este día.</p>
          )}
          {gruposEmpresa.map(([empresa, { personas, pendienteIds, preparadoIds }]) => (
            <div key={empresa} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              {/* Header empresa */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 min-h-[48px]">
                <p className="font-semibold text-gray-800 text-sm">{empresa}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-brand-100 text-brand-700 font-semibold px-2 py-0.5 rounded-full">{personas.length}</span>
                  {pendienteIds.length > 0 && (
                    <button
                      onClick={() => onEntregarVarios(pendienteIds, 'preparado')}
                      className="text-[11px] font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 px-2 py-0.5 rounded-full transition-colors whitespace-nowrap"
                    >
                      🍽️ Preparar {pendienteIds.length}
                    </button>
                  )}
                  {preparadoIds.length > 0 && (
                    <button
                      onClick={() => onEntregarVarios(preparadoIds, 'entregado')}
                      className="text-[11px] font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-0.5 rounded-full transition-colors whitespace-nowrap"
                    >
                      ✓ Entregar {preparadoIds.length}
                    </button>
                  )}
                </div>
              </div>
              {/* Filas */}
              <div className="divide-y divide-gray-50">
                {personas.sort((a,b) => texto(a.nombre).localeCompare(texto(b.nombre))).map((p, j) => (
                  <div key={j} className="flex items-start gap-3 px-4 py-2">
                    <Avatar nombre={p.nombre.split(',')[1]?.trim()||''} apellido={p.nombre.split(',')[0]?.trim()||''} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                      {p.items.map((item, k) => (
                        <div key={k} className="text-xs text-gray-500 leading-relaxed">
                          <span className="font-medium text-gray-700">{item.plato_nombre}</span>
                          {item.opcion && <span className="text-gray-500"> · Op. {item.opcion}</span>}
                          {item.guarnicion_nombre && <span className="text-emerald-600"> + {item.guarnicion_nombre}</span>}
                          <span className="text-brand-700"> · {item.plan_nombre}</span>
                          <span className="ml-2 inline-flex">
                            <EstadoItemBadge
                              item={item}
                              loading={loadingItemId === item.id}
                              onCambiar={onCambiarEstadoItem}
                            />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Grupo empresa colapsable (vista Personas) ─────────────────────────────────

function GrupoEmpresa({ empresa, grupo, diasSemana, onCambiarEstado, onCambiarEstadoItem, loadingId, loadingItemId, selected, onToggleSelect }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <button
        onClick={() => setAbierto(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors border-b border-gray-100 min-h-[52px]"
      >
        <p className="font-semibold text-gray-800 text-sm">{empresa}</p>
        <div className="flex items-center gap-2.5">
          <span className="text-xs bg-brand-100 text-brand-700 font-semibold px-2 py-0.5 rounded-full">{grupo.length}</span>
          <span className="text-gray-500 text-sm">{abierto ? '▲' : '▼'}</span>
        </div>
      </button>
      {abierto && (
        <div className="divide-y divide-gray-50">
          {grupo.map(pedido => (
            <PedidoCard
              key={pedido.id}
              pedido={pedido}
              diasSemana={diasSemana}
              onCambiarEstado={onCambiarEstado}
              onCambiarEstadoItem={onCambiarEstadoItem}
              loadingId={loadingId}
              loadingItemId={loadingItemId}
              selected={selected}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PedidosAdmin({ vistaFija = null, titulo = 'Seguimiento de pedidos' } = {}) {
  const [semana, setSemana]               = useState(getLunes());
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro]   = useState('');
  const [busqueda, setBusqueda]           = useState('');
  const [vistaInterna, setVistaInterna]   = useState('empresa');
  const [diaActivo, setDiaActivo]         = useState(() => DIAS_ORDEN[(new Date().getDay() + 6) % 7]);
  const [selected, setSelected]           = useState(new Set());
  const [bulkLoading, setBulkLoading]     = useState(false);
  const [loadingId, setLoadingId]         = useState(null);
  const [loadingItemId, setLoadingItemId] = useState(null);

  const { data: pedidosRaw = [], isLoading } = usePedidos({ semana_inicio: semana, empresa_id: empresaFiltro || undefined, limit: 500 });
  const { data: empresas = [] } = useEmpresas();
  const updateEstado = useUpdateEstadoPedido();
  const updateEstadoItem = useUpdateEstadoPedidoItem();
  const vista = vistaFija || vistaInterna;
  const setVista = vistaFija ? () => {} : setVistaInterna;
  const esSeguimiento = vista === 'empresa';

  const cambiarSemana = (delta) => {
    const d = new Date(semana); d.setDate(d.getDate() + delta * 7);
    setSemana(d.toISOString().split('T')[0]);
    setDiaActivo(null); setSelected(new Set());
  };

  const pedidos = useMemo(() => {
    let list = pedidosRaw;
    if (estadoFiltro) list = list.filter(p => p.estado === estadoFiltro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p =>
        `${p.empleado_nombre} ${p.empleado_apellido}`.toLowerCase().includes(q) ||
        p.empresa_nombre?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [pedidosRaw, estadoFiltro, busqueda]);

  const stats = useMemo(() => {
    const porEstado = {};
    for (const p of pedidosRaw) porEstado[p.estado] = (porEstado[p.estado]||0) + 1;
    const items = pedidosRaw.flatMap(p => (p.items || []).filter(item => !item.sin_pedido));
    const itemsActivos = items.filter(esItemActivoCocina);
    const entregadas  = itemsActivos.filter(item => item.estado === 'entregado').length;
    const preparadas  = itemsActivos.filter(item => item.estado === 'preparado').length;
    const porPreparar = itemsActivos.filter(item => item.estado === 'pendiente').length;
    return {
      total: pedidosRaw.length,
      viandas: itemsActivos.length,
      entregadas,
      preparadas,
      porPreparar,
      porEstado,
    };
  }, [pedidosRaw]);

  const diasSemana = useMemo(() => {
    const usados = new Set(pedidos.flatMap(p => (p.items||[]).map(i => i.dia)));
    return DIAS_ORDEN.filter(d => usados.has(d));
  }, [pedidos]);

  const filtrosActivos = Boolean(empresaFiltro || estadoFiltro || busqueda.trim());

  const limpiarFiltros = () => {
    setEmpresaFiltro('');
    setEstadoFiltro('');
    setBusqueda('');
    setSelected(new Set());
  };

  const volverSemanaActual = () => {
    setSemana(getLunes());
    setDiaActivo(null);
    setSelected(new Set());
  };

  const handleCambiarEstado = useCallback(async (id, estado) => {
    setLoadingId(id);
    try {
      await updateEstado.mutateAsync({ id, estado });
      toast.success(`${ESTADO_MAP[estado]?.icon} ${ESTADO_MAP[estado]?.label}`);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Error al actualizar');
    } finally { setLoadingId(null); }
  }, [updateEstado]);

  const handleCambiarEstadoItem = useCallback(async (itemId, estado) => {
    setLoadingItemId(itemId);
    try {
      await updateEstadoItem.mutateAsync({ itemId, estado });
      toast.success(`Vianda ${ESTADO_MAP[estado]?.label?.toLowerCase() || estado}`);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Error al actualizar vianda');
    } finally {
      setLoadingItemId(null);
    }
  }, [updateEstadoItem]);

  const handleEntregarVarios = useCallback(async (ids, estado = 'entregado') => {
    const resultados = await Promise.allSettled(
      ids.map((itemId) => updateEstadoItem.mutateAsync({ itemId, estado })),
    );
    const ok = resultados.filter((r) => r.status === 'fulfilled').length;
    const fallidas = resultados.length - ok;
    const label = estado === 'preparado' ? 'preparada' : 'entregada';
    if (fallidas === 0 && ok > 0) {
      toast.success(`${ok} vianda${ok !== 1 ? 's' : ''} ${label}${ok !== 1 ? 's' : ''}`);
    } else if (ok > 0 && fallidas > 0) {
      toast.warning(`${ok} ${label}${ok !== 1 ? 's' : ''} · ${fallidas} no se pudo${fallidas !== 1 ? 'eron' : ''} actualizar — reintentá manualmente`);
    } else if (fallidas > 0) {
      toast.error(`No se pudieron actualizar las ${fallidas} vianda${fallidas !== 1 ? 's' : ''} — verificá la conexión`);
    }
  }, [updateEstadoItem]);

  const handleBulkEstado = async (estado) => {
    setBulkLoading(true);
    const ids = [...selected];
    try {
      const resultados = await Promise.allSettled(
        ids.map((id) => updateEstado.mutateAsync({ id, estado })),
      );
      const fallidos = resultados
        .map((r, i) => ({ r, id: ids[i] }))
        .filter(({ r }) => r.status === 'rejected')
        .map(({ r, id }) => ({
          id,
          mensaje: r.reason?.response?.data?.message || r.reason?.message || 'No se pudo actualizar',
        }));

      const actualizados = ids.length - fallidos.length;
      if (actualizados > 0) {
        toast.success(`${actualizados} pedido${actualizados !== 1 ? 's' : ''} actualizado${actualizados !== 1 ? 's' : ''} a "${ESTADO_MAP[estado]?.label}"`);
      }

      if (fallidos.length > 0) {
        const primerError = fallidos[0]?.mensaje;
        toast.error(`${fallidos.length} pedido${fallidos.length !== 1 ? 's' : ''} no se pudieron actualizar${primerError ? `: ${primerError}` : ''}`);
        setSelected(new Set(fallidos.map(f => f.id)));
        return;
      }

      setSelected(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    if (selected.size === pedidos.length) setSelected(new Set());
    else setSelected(new Set(pedidos.map(p => p.id)));
  };

  const esEstaSemana = semana === getLunes();
  const domingoSemana = addDias(semana, 6);
  const empresaFiltroNombre = useMemo(
    () => empresas.find(e => String(e.id) === String(empresaFiltro))?.nombre || '',
    [empresas, empresaFiltro],
  );

  return (
    <div className="px-4 pt-0 pb-4 md:p-6 max-w-7xl mx-auto">

      {/* ── Header mobile (sticky) ── */}
      <div className="md:hidden sticky top-0 z-20 bg-brand-700 text-white px-4 py-3 -mx-4 -mt-0 mb-4 print:hidden flex flex-wrap items-center gap-2">
        <h1 className="text-base font-bold flex-1">{titulo}</h1>
        <button onClick={() => cambiarSemana(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 text-white text-lg leading-none">‹</button>
        <div className="text-center">
          <p className="text-xs font-semibold leading-tight">{fmt(semana)} — {fmt(domingoSemana)}</p>
          <p className="text-[10px] text-brand-200">{fmtFull(semana).split('/')[2]}</p>
        </div>
        <button onClick={() => cambiarSemana(1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 text-white text-lg leading-none">›</button>
        {esSeguimiento && (
          <div className="ml-1">
            <BotonExportar pedidos={pedidos} semana={semana} empresas={[...new Set(pedidos.map(p => p.empresa_nombre).filter(Boolean))].sort()} compact initialEmpresa={empresaFiltroNombre} />
          </div>
        )}
        <div className="basis-full flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={volverSemanaActual}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${esEstaSemana ? 'bg-white/15 text-brand-100' : 'bg-white text-brand-800'}`}
          >
            Semana actual
          </button>
        </div>
      </div>

      {/* ── Header desktop ── */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-3 mb-5 print:mb-2">
        <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
        <div className="flex items-center gap-1 print:hidden">
          <button onClick={() => cambiarSemana(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-lg">‹</button>
          <div className="text-center px-3">
            <p className="text-sm font-semibold text-gray-800">{fmt(semana)} — {fmt(domingoSemana)}</p>
            <p className="text-[11px] text-gray-500">{fmtFull(semana).split('/')[2]}</p>
          </div>
          <button onClick={() => cambiarSemana(1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-lg">›</button>
          <button
            type="button"
            onClick={volverSemanaActual}
            className={`ml-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${esEstaSemana ? 'border-brand-100 bg-brand-50 text-brand-700' : 'border-brand-200 text-brand-700 hover:bg-brand-50'}`}
          >
            Semana actual
          </button>
        </div>
        {esSeguimiento && (
          <div className="flex gap-2 print:hidden">
            <BotonExportar pedidos={pedidos} semana={semana} empresas={[...new Set(pedidos.map(p => p.empresa_nombre).filter(Boolean))].sort()} initialEmpresa={empresaFiltroNombre} />
          </div>
        )}
      </div>

      {/* ── KPI cards — solo en vista seguimiento ── */}
      {esSeguimiento && (
        <div className="grid grid-cols-4 gap-0 mb-4 print:hidden overflow-hidden rounded-xl border border-gray-100 shadow-sm divide-x divide-gray-100">
          <div className="bg-white p-3 text-center">
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">Pedidos</p>
          </div>
          <div className="bg-white p-3 text-center">
            <p className="text-xl font-bold text-brand-700">{stats.viandas}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">Viandas</p>
          </div>
          <div className="bg-white p-3 text-center">
            <p className="text-xl font-bold text-gray-700">{stats.entregadas}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">Entregadas</p>
          </div>
          <button
            className={`p-3 text-center transition-colors ${
              (stats.porEstado.pendiente || 0) === 0
                ? 'bg-white hover:bg-gray-50'
                : estadoFiltro === 'pendiente' ? 'bg-amber-100' : 'bg-amber-50 hover:bg-amber-100'
            }`}
            onClick={() => setEstadoFiltro(estadoFiltro === 'pendiente' ? '' : 'pendiente')}
          >
            <p className={`text-xl font-bold ${(stats.porEstado.pendiente || 0) === 0 ? 'text-gray-500' : 'text-amber-700'}`}>{stats.porEstado.pendiente || 0}</p>
            <p className={`text-[11px] mt-0.5 leading-tight ${(stats.porEstado.pendiente || 0) === 0 ? 'text-gray-500' : 'text-amber-600'}`}>Pendientes</p>
          </button>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="space-y-2 mb-4 print:hidden">
        {/* Buscador full-width */}
        {esSeguimiento && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Buscar empleado o empresa..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-400"
            />
          </div>
        )}
        {/* Empresa + Estado en 2 columnas — solo en vista seguimiento */}
        {esSeguimiento && (
        <div className="grid gap-2 grid-cols-2">
          <select
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 bg-white"
            value={empresaFiltro}
            onChange={e => { setEmpresaFiltro(e.target.value); setSelected(new Set()); }}
          >
            <option value="">Empresa</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <select
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 bg-white"
            value={estadoFiltro}
            onChange={e => setEstadoFiltro(e.target.value)}
          >
            <option value="">Estado</option>
            {ESTADOS_PEDIDO.map(e => <option key={e.key} value={e.key}>{e.icon} {e.label}</option>)}
          </select>
        </div>
        )}
      </div>
      {!vistaFija && (
        <Tabs value={vista} onChange={setVista}>
          <Tab value="empresa" label="Seguimiento" />
          <Tab value="dia" label="Produccion diaria" />
        </Tabs>
      )}

      {/* Filtros activos */}
      {filtrosActivos && (
        <p className="text-xs text-gray-500 mb-3 print:hidden">
          Mostrando {pedidos.length} de {pedidosRaw.length} pedidos
          <button onClick={limpiarFiltros} className="ml-2 text-brand-700 underline">Limpiar filtros</button>
        </p>
      )}

      {/* ── Bulk action bar ── */}
      {esSeguimiento && selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onCambiarEstado={handleBulkEstado}
          loading={bulkLoading}
        />
      )}

      {/* ── Empleados sin pedido ── */}
      {esSeguimiento && <EmpleadosSinPedido pedidos={pedidosRaw} empresaFiltro={empresaFiltro} />}

      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-gray-500">
          <div className="animate-spin w-8 h-8 border-2 border-brand-700 border-t-transparent rounded-full" />
          <p>Cargando pedidos...</p>
        </div>
      )}

      {/* ── Vista por persona (agrupada por empresa) ── */}
      {vista === 'empresa' && !isLoading && (() => {
        if (pedidos.length === 0) return (
          <EmptyPedidos filtrosActivos={filtrosActivos} onLimpiarFiltros={limpiarFiltros} />
        );
        const porEmpresa = {};
        for (const p of pedidos) {
          const k = p.empresa_nombre || 'Sin empresa';
          if (!porEmpresa[k]) porEmpresa[k] = [];
          porEmpresa[k].push(p);
        }
        const grupos = Object.entries(porEmpresa).sort(([a],[b]) => texto(a).localeCompare(texto(b)));
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 pb-1 print:hidden">
              <input type="checkbox" checked={selected.size === pedidos.length && pedidos.length > 0} onChange={toggleSelectAll} className="w-4 h-4 accent-brand-700 cursor-pointer" />
              <span>{selected.size === pedidos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}</span>
            </div>
            {grupos.map(([empresa, grupo]) => (
              <GrupoEmpresa
                key={empresa}
                empresa={empresa}
                grupo={grupo}
                diasSemana={diasSemana}
                onCambiarEstado={handleCambiarEstado}
                onCambiarEstadoItem={handleCambiarEstadoItem}
                loadingId={loadingId}
                loadingItemId={loadingItemId}
                selected={selected}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        );
      })()}

      {/* ── Vista por día ── */}
      {vista === 'dia' && !isLoading && (
        <VistaDia
          pedidos={pedidos}
          semana={semana}
          diaActivo={diaActivo}
          setDiaActivo={setDiaActivo}
          filtrosActivos={filtrosActivos}
          onLimpiarFiltros={limpiarFiltros}
          onCambiarEstadoItem={handleCambiarEstadoItem}
          loadingItemId={loadingItemId}
          onEntregarVarios={handleEntregarVarios}
        />
      )}
    </div>
  );
}
