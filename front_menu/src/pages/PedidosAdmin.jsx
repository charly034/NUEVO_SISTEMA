import { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { usePedidos, useUpdateEstadoPedido } from '../hooks/usePedidos.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import { useEmpleados } from '../hooks/useEmpleados.js';
import { toast } from '../lib/toast.js';

// ── Constantes ────────────────────────────────────────────────────────────────

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABEL = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' };
const DIAS_FULL  = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

const ESTADOS = [
  { key: 'pendiente',  label: 'Pendiente',  icon: '🕐', cls: 'bg-amber-50 text-amber-700 border-amber-200'  },
  { key: 'en_proceso', label: 'En proceso', icon: '🔥', cls: 'bg-blue-50 text-blue-700 border-blue-200'    },
  { key: 'listo',      label: 'Listo',       icon: '✅', cls: 'bg-green-50 text-green-700 border-green-200' },
  { key: 'entregado',  label: 'Entregado',   icon: '📦', cls: 'bg-gray-50 text-gray-500 border-gray-200'   },
  { key: 'cancelado',  label: 'Cancelado',   icon: '❌', cls: 'bg-red-50 text-red-600 border-red-200'      },
];
const ESTADO_MAP = Object.fromEntries(ESTADOS.map(e => [e.key, e]));

const AVATAR_COLORS = [
  'bg-green-600','bg-blue-600','bg-purple-600','bg-orange-500',
  'bg-pink-600','bg-teal-600','bg-indigo-600','bg-rose-600',
];

// ── Utilidades ────────────────────────────────────────────────────────────────

function getLunes() {
  const hoy = new Date();
  const diff = hoy.getDay() === 0 ? -6 : 1 - hoy.getDay();
  const l = new Date(hoy); l.setDate(hoy.getDate() + diff);
  return l.toISOString().split('T')[0];
}

function addDias(iso, n) {
  const d = new Date(iso); d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

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
};

function iniciales(nombre, apellido) {
  return `${(apellido||'')[0]||''}${(nombre||'')[0]||''}`.toUpperCase();
}

function avatarColor(str) {
  let h = 0;
  for (const c of (str||'')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
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
        Principal: item.plato_nombre || '',
        GUARNICION: item.guarnicion_nombre || '',
      });
    }
  }
  rows.sort((a, b) => {
    if (a._fechaISO !== b._fechaISO) return a._fechaISO < b._fechaISO ? -1 : 1;
    if (a.EMPRESA !== b.EMPRESA) return a.EMPRESA.localeCompare(b.EMPRESA);
    if (a.Principal !== b.Principal) return a.Principal.localeCompare(b.Principal);
    return a['Nombre y Apellido'].localeCompare(b['Nombre y Apellido']);
  });
  return rows.map(row =>
    Object.fromEntries(Object.entries(row).filter(([key]) => key !== '_fechaISO'))
  );
}

function exportarExcel(pedidos, semana, filtros = {}) {
  const rows = buildRows(pedidos, semana, filtros);
  if (rows.length === 0) return;

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['EMPRESA', 'FECHA', 'Nombre y Apellido', 'Principal', 'GUARNICION'],
  });
  ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 42 }, { wch: 25 }, { wch: 25 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');

  const sufijo = [
    filtros.soloEmpresa ? filtros.soloEmpresa.replace(/\s+/g, '_') : null,
    filtros.soloDia     ? DIAS_FULL[filtros.soloDia]               : null,
  ].filter(Boolean).join('-');

  XLSX.writeFile(wb, `pedidos-${semana}${sufijo ? '-' + sufijo : ''}.xlsx`);
}

// ── Botón exportar con dropdown de filtros ────────────────────────────────────

function BotonExportar({ pedidos, semana, empresas, compact = false }) {
  const [open, setOpen] = useState(false);
  const [soloEmpresa, setSoloEmpresa] = useState('');
  const [soloDia, setSoloDia]         = useState('');

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
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-500"
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
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-500"
              >
                <option value="">Todos los días</option>
                {diasConPedidos.map(d => <option key={d} value={d}>{DIAS_FULL[d]}</option>)}
              </select>
            </div>

            <button
              onClick={handleExportar}
              className="w-full bg-green-700 text-white rounded-lg py-1.5 text-sm font-semibold hover:bg-green-800 transition-colors"
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

// Construye los grupos de cocina para un día dado
function buildGruposCocina(pedidos, dia) {
  const map = {};
  for (const p of pedidos) {
    for (const item of (p.items || []).filter(i => i.dia === dia)) {
      const key = `${item.plato_id}__${item.opcion||''}__${item.guarnicion_id||''}`;
      if (!map[key]) map[key] = { plato_nombre: item.plato_nombre, opcion: item.opcion, guarnicion_nombre: item.guarnicion_nombre, cantidad: 0, personas: [] };
      map[key].cantidad++;
      map[key].personas.push({ nombre: `${p.empleado_apellido}, ${p.empleado_nombre}`, empresa: p.empresa_nombre, notas: item.notas });
    }
  }
  return Object.values(map).sort((a, b) => b.cantidad - a.cantidad);
}

// CSS base compartido para hojas de impresión
const CSS_BASE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { margin: 8mm 10mm; size: A4 portrait; }
  body { font-family: Arial, sans-serif; font-size: 14px; color: #111; }
  .page-break { page-break-before: always; }
`;

// Genera el HTML de una hoja de producción para un día
function htmlProduccion(dia, gruposCocina, semana) {
  const fechaIdx = DIAS_ORDEN.indexOf(dia);
  const fecha = fechaIdx >= 0 ? fmtFull(addDias(semana, fechaIdx)) : '';
  const total = gruposCocina.reduce((s, g) => s + g.cantidad, 0);
  const notas = gruposCocina.flatMap(g => g.personas.filter(p => p.notas).map(p => ({ ...p, plato: g.plato_nombre })));
  return `
<div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #1a5c2a;padding-bottom:4px;margin-bottom:8px">
    <div>
      <div style="font-size:20px;font-weight:bold;color:#1a5c2a">Producción — ${DIAS_FULL[dia]} ${fecha}</div>
      <span style="background:#1a5c2a;color:white;font-size:13px;font-weight:bold;padding:2px 8px;border-radius:3px;display:inline-block;margin-top:3px">${total} vianda${total !== 1 ? 's' : ''}</span>
    </div>
    <div style="font-size:11px;color:#666;text-align:right">La Quinta · ${new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</div>
  </div>
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
        </td>
        <td style="padding:4px 8px;text-align:center;font-size:20px;font-weight:bold;color:#1a5c2a;border-left:2px solid #bbb">${g.cantidad}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${notas.length ? `
  <div style="margin-top:8px;border:1px solid #f59e0b;border-radius:3px;padding:5px 8px;background:#fffbeb">
    <div style="font-size:12px;font-weight:bold;color:#b45309;margin-bottom:2px">⚠ Observaciones (${notas.length})</div>
    ${notas.map(n => `<div style="font-size:12px;color:#92400e"><strong>${n.nombre}</strong> (${n.empresa}) — ${n.notas} <span style="color:#aaa">· ${n.plato}</span></div>`).join('')}
  </div>` : ''}
</div>`;
}

// Genera el HTML del detalle por empresa para un día
function htmlDetalle(dia, pedidos, semana) {
  const fechaIdx = DIAS_ORDEN.indexOf(dia);
  const fecha = fechaIdx >= 0 ? fmtFull(addDias(semana, fechaIdx)) : '';
  const porEmpresa = {};
  for (const p of pedidos) {
    const items = (p.items || []).filter(i => i.dia === dia);
    if (!items.length) continue;
    const emp = p.empresa_nombre || 'Sin empresa';
    if (!porEmpresa[emp]) porEmpresa[emp] = [];
    porEmpresa[emp].push({ nombre: `${p.empleado_apellido}, ${p.empleado_nombre}`, items });
  }
  const empresas = Object.entries(porEmpresa).sort(([a],[b]) => a.localeCompare(b));
  const total = empresas.reduce((s, [, ps]) => s + ps.length, 0);
  if (!empresas.length) return '';
  return `
<div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #1a5c2a;padding-bottom:4px;margin-bottom:8px">
    <div>
      <div style="font-size:20px;font-weight:bold;color:#1a5c2a">Detalle por empresa — ${DIAS_FULL[dia]} ${fecha}</div>
      <div style="font-size:12px;color:#555;margin-top:2px">${total} vianda${total!==1?'s':''} · ${empresas.length} empresa${empresas.length!==1?'s':''}</div>
    </div>
    <div style="font-size:11px;color:#666;text-align:right">La Quinta · ${new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</div>
  </div>
  ${empresas.map(([empresa, personas]) => `
  <div style="margin-bottom:8px;break-inside:avoid;border:2px solid #1a5c2a;border-radius:3px;overflow:hidden">
    <div style="background:#1a5c2a;color:white;padding:4px 8px;font-size:14px;font-weight:bold;display:flex;justify-content:space-between">
      <span>${empresa}</span><span>${personas.length} pers.</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#e8f5e9">
        <th style="padding:3px 6px;text-align:left;font-size:12px;color:#1a5c2a;border-bottom:1px solid #999;width:26%">Nombre</th>
        <th style="padding:3px 6px;text-align:left;font-size:12px;color:#1a5c2a;border-bottom:1px solid #999;width:38%">Plato</th>
        <th style="padding:3px 6px;text-align:left;font-size:12px;color:#1a5c2a;border-bottom:1px solid #999;width:22%">Guarnición</th>
        <th style="padding:3px 6px;text-align:left;font-size:12px;color:#1a5c2a;border-bottom:1px solid #999;width:14%">Nota</th>
      </tr></thead>
      <tbody>
        ${personas.sort((a,b) => {
          const pa = a.items[0]?.plato_nombre || '';
          const pb = b.items[0]?.plato_nombre || '';
          return pa.localeCompare(pb) || a.nombre.localeCompare(b.nombre);
        }).map((p, ri) => p.items.map((item, idx) => `
        <tr style="border-bottom:1px solid #ddd;${ri % 2 === 1 ? 'background:#f7faf8' : ''}">
          <td style="padding:3px 6px;font-weight:${idx===0?'600':'400'};color:${idx===0?'#111':'#888'};white-space:nowrap;font-size:13px">${idx===0 ? p.nombre : ''}</td>
          <td style="padding:3px 6px;font-size:13px">${item.plato_nombre}${item.opcion ? ` <span style="color:#888;font-size:11px">Op.${item.opcion}</span>` : ''}</td>
          <td style="padding:3px 6px;color:#166534;font-size:13px">${item.guarnicion_nombre || ''}</td>
          <td style="padding:3px 6px;color:#b45309;font-style:italic;font-size:11px">${item.notas ? '⚠ '+item.notas : ''}</td>
        </tr>`).join('')).join('')}
      </tbody>
    </table>
  </div>`).join('')}
</div>`;
}

// Wrappers de impresión para un día
function imprimirProduccion(dia, gruposCocina, semana) {
  abrirVentanaImpresion(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS_BASE}</style></head><body>${htmlProduccion(dia, gruposCocina, semana)}</body></html>`);
}

function imprimirDetalle(dia, pedidos, semana) {
  const h = htmlDetalle(dia, pedidos, semana);
  if (!h) return;
  abrirVentanaImpresion(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS_BASE}</style></head><body>${h}</body></html>`);
}

function imprimirAmbas(dia, gruposCocina, pedidos, semana) {
  const hDet = htmlDetalle(dia, pedidos, semana);
  abrirVentanaImpresion(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS_BASE}</style></head><body>${htmlProduccion(dia, gruposCocina, semana)}${hDet ? '<div class="page-break"></div>' + hDet : ''}</body></html>`);
}

function imprimirSemana(tipo, pedidos, semana) {
  const diasConItems = DIAS_ORDEN.filter(d => pedidos.some(p => (p.items||[]).some(i => i.dia === d)));
  if (!diasConItems.length) return;
  const bloques = diasConItems.map((dia, idx) => {
    const grupos = buildGruposCocina(pedidos, dia);
    const sep = idx > 0 ? '<div class="page-break"></div>' : '';
    if (tipo === 'produccion') return sep + htmlProduccion(dia, grupos, semana);
    if (tipo === 'detalle')    { const h = htmlDetalle(dia, pedidos, semana); return h ? sep + h : ''; }
    const hDet = htmlDetalle(dia, pedidos, semana);
    return sep + htmlProduccion(dia, grupos, semana) + (hDet ? '<div class="page-break"></div>' + hDet : '');
  }).filter(Boolean);
  abrirVentanaImpresion(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS_BASE}</style></head><body>${bloques.join('')}</body></html>`);
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
  const e = ESTADO_MAP[pedido.estado] || ESTADO_MAP.pendiente;

  return (
    <div className="relative" onClick={ev => ev.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${e.cls} ${loading ? 'opacity-60' : 'hover:opacity-80'} transition-opacity`}
      >
        {loading ? <span className="animate-spin">⟳</span> : <span>{e.icon}</span>}
        <span>{e.label}</span>
        <span className="opacity-40 text-[10px]">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
            {ESTADOS.filter(s => s.key !== pedido.estado).map(s => (
              <button
                key={s.key}
                onClick={() => { onCambiar(s.key); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
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
  const [estadoSel, setEstadoSel] = useState('listo');
  return (
    <div className="flex items-center gap-3 bg-green-700 text-white px-4 py-2.5 rounded-xl mb-4 print:hidden">
      <span className="text-sm font-semibold">{count} seleccionado{count !== 1 ? 's' : ''}</span>
      <div className="flex items-center gap-2 ml-auto">
        <select
          value={estadoSel}
          onChange={e => setEstadoSel(e.target.value)}
          className="text-sm bg-white text-gray-800 rounded-lg px-2 py-1 border-0 focus:outline-none"
        >
          {ESTADOS.map(e => <option key={e.key} value={e.key}>{e.icon} {e.label}</option>)}
        </select>
        <button
          onClick={() => onCambiarEstado(estadoSel)}
          disabled={loading}
          className="bg-white text-green-700 font-semibold text-sm px-3 py-1 rounded-lg hover:bg-green-50 disabled:opacity-60"
        >
          {loading ? 'Aplicando...' : 'Aplicar'}
        </button>
        <button onClick={onClear} className="text-green-200 hover:text-white text-sm ml-1">✕ Limpiar</button>
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
                <p className="text-xs text-gray-400">{e.email}</p>
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

function PedidoCard({ pedido, diasSemana, onCambiarEstado, loadingId, selected, onToggleSelect }) {
  const [expandido, setExpandido] = useState(false);
  const itemsPorDia = Object.fromEntries((pedido.items||[]).map(i => [i.dia, i]));
  const totalDias = diasSemana.filter(d => itemsPorDia[d]).length;
  const tieneNotas = (pedido.items||[]).some(i => i.notas);
  const isSelected = selected.has(pedido.id);

  return (
    <div className={`bg-white rounded-xl border overflow-hidden shadow-sm transition-colors ${isSelected ? 'border-green-400' : 'border-gray-100'}`}>
      <div className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandido(e => !e)}>

        {/* Checkbox */}
        <div className="mr-3 print:hidden" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(pedido.id)}
            className="w-4 h-4 accent-green-700 cursor-pointer"
          />
        </div>

        <Avatar nombre={pedido.empleado_nombre} apellido={pedido.empleado_apellido} />

        <div className="ml-3 flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
            {pedido.empleado_apellido}, {pedido.empleado_nombre}
            {tieneNotas && <span className="ml-2 text-amber-500 text-xs">⚠ notas</span>}
          </p>
          <p className="text-xs text-gray-400">{pedido.empresa_nombre} · {totalDias} día{totalDias !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex items-center gap-2 ml-2 shrink-0">
          <EstadoBadge
            pedido={pedido}
            loading={loadingId === pedido.id}
            onCambiar={(estado) => onCambiarEstado(pedido.id, estado)}
          />
          <span className="text-gray-300 text-xs print:hidden">{expandido ? '▲' : '▼'}</span>
        </div>
      </div>

      {expandido && (
        <div className="border-t border-gray-50 divide-y divide-gray-50">
          {tieneNotas && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
              <span className="text-amber-500 text-sm mt-0.5">⚠</span>
              <div>
                {(pedido.items||[]).filter(i => i.notas).map(i => (
                  <p key={i.dia} className="text-xs text-amber-700">
                    <strong>{DIAS_FULL[i.dia]}:</strong> {i.notas}
                  </p>
                ))}
              </div>
            </div>
          )}
          {diasSemana.map(dia => {
            const item = itemsPorDia[dia];
            if (!item) return null;
            return (
              <div key={dia} className="flex items-start gap-3 px-4 py-2.5">
                <span className="text-xs font-bold text-green-700 w-8 pt-0.5 shrink-0">{DIAS_LABEL[dia]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{item.plato_nombre}</p>
                  <div className="flex flex-wrap gap-x-3 mt-0.5">
                    {item.opcion && <span className="text-[11px] text-gray-400">Opción {item.opcion}</span>}
                    {item.guarnicion_nombre && <span className="text-[11px] text-emerald-600">+ {item.guarnicion_nombre}</span>}
                    {item.notas && <span className="text-[11px] text-amber-600 font-medium">⚠ {item.notas}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {(pedido.eventos ?? []).length > 0 && (
            <div className="px-4 py-3 bg-slate-50">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Historial del pedido</p>
              <div className="space-y-2">
                {pedido.eventos.slice().reverse().map((evento) => (
                  <div key={evento.id} className="flex gap-2 text-xs">
                    <span className="mt-1 w-2 h-2 rounded-full bg-green-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-700">
                        {EVENTO_LABELS[evento.tipo] ?? evento.tipo}
                        {evento.estado_anterior && evento.estado_nuevo && (
                          <span className="font-normal text-slate-500"> · {evento.estado_anterior} → {evento.estado_nuevo}</span>
                        )}
                      </p>
                      <p className="text-slate-500">
                        {evento.resumen || 'Evento registrado'}
                        {evento.actor_nombre && <span> · {evento.actor_nombre}</span>}
                        <span> · {fmtEvento(evento.created_at)}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Botón imprimir con panel de filtros ───────────────────────────────────────

function BotonImprimir({ dia, gruposCocina, pedidos, semana, diasDisponibles }) {
  const [open, setOpen]       = useState(false);
  const [alcance, setAlcance] = useState('dia');    // 'dia' | 'semana'
  const [tipo, setTipo]       = useState('ambas');  // 'produccion' | 'detalle' | 'ambas'
  const [diasSel, setDiasSel] = useState([]);

  const toggleDia = (d) => setDiasSel(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleImprimir = () => {
    if (alcance === 'dia') {
      if (tipo === 'produccion') imprimirProduccion(dia, gruposCocina, semana);
      else if (tipo === 'detalle') imprimirDetalle(dia, pedidos, semana);
      else imprimirAmbas(dia, gruposCocina, pedidos, semana);
    } else {
      const ped = diasSel.length
        ? pedidos.map(p => ({ ...p, items: (p.items||[]).filter(i => diasSel.includes(i.dia)) })).filter(p => p.items.length)
        : pedidos;
      imprimirSemana(tipo, ped, semana);
    }
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
      >
        🖨️ Imprimir ▾
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Opciones de impresión</p>

            <div>
              <p className="text-xs text-gray-500 mb-1">Alcance</p>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {[['dia','Este día'],['semana','Semana completa']].map(([v,l]) => (
                  <button key={v} onClick={() => setAlcance(v)}
                    className={`flex-1 py-1.5 font-medium transition-colors ${alcance===v ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'} ${v==='semana' ? 'border-l border-gray-200' : ''}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {alcance === 'semana' && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Días <span className="text-gray-400">(vacío = todos)</span></p>
                <div className="flex flex-wrap gap-1">
                  {diasDisponibles.map(d => (
                    <button key={d} onClick={() => toggleDia(d)}
                      className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${diasSel.includes(d) ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                      {DIAS_LABEL[d]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 mb-1">Contenido</p>
              <div className="space-y-1.5">
                {[
                  ['ambas',      '📄 Producción + Detalle', 'Las dos hojas juntas'],
                  ['produccion', '🍳 Solo producción',       'Platos y cantidades'],
                  ['detalle',    '🏢 Solo detalle',          'Por empresa y persona'],
                ].map(([v,l,sub]) => (
                  <label key={v} className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="tipo-imp" value={v} checked={tipo===v} onChange={() => setTipo(v)} className="mt-0.5 accent-gray-800" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 leading-tight">{l}</p>
                      <p className="text-xs text-gray-400">{sub}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={handleImprimir}
              className="w-full bg-gray-800 text-white rounded-lg py-1.5 text-sm font-semibold hover:bg-gray-700 transition-colors">
              🖨️ Imprimir
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Vista por día ─────────────────────────────────────────────────────────────

function VistaDia({ pedidos, semana, diaActivo, setDiaActivo }) {
  const [subVista, setSubVista] = useState('cocina'); // 'cocina' | 'empresa'
  const [filtroPlatoTxt, setFiltroPlatoTxt] = useState('');

  const diasConItems = DIAS_ORDEN.filter(dia =>
    pedidos.some(p => (p.items||[]).some(i => i.dia === dia))
  );
  const fechaDia = (dia) => { const idx = DIAS_ORDEN.indexOf(dia); return idx >= 0 ? addDias(semana, idx) : null; };
  const dia = diaActivo || diasConItems[0];

  const itemsDia = pedidos.flatMap(p =>
    (p.items||[]).filter(i => i.dia === dia).map(i => ({
      ...i,
      empleado_nombre: p.empleado_nombre,
      empleado_apellido: p.empleado_apellido,
      empresa_nombre: p.empresa_nombre,
    }))
  );

  // Grupos para lista de cocina: plato + opcion + guarnicion → cantidad
  const gruposCocina = (() => {
    const map = {};
    for (const item of itemsDia) {
      const key = `${item.plato_id}__${item.opcion||''}__${item.guarnicion_id||''}`;
      if (!map[key]) map[key] = { plato_nombre: item.plato_nombre, opcion: item.opcion, guarnicion_nombre: item.guarnicion_nombre, cantidad: 0, personas: [] };
      map[key].cantidad++;
      map[key].personas.push({ nombre: `${item.empleado_apellido}, ${item.empleado_nombre}`, empresa: item.empresa_nombre, notas: item.notas });
    }
    return Object.values(map).sort((a,b) => b.cantidad - a.cantidad);
  })();

  // Grupos para vista por empresa: empresa → persona → items
  const gruposEmpresa = (() => {
    const map = {};
    for (const p of pedidos) {
      const items = (p.items||[]).filter(i => i.dia === dia);
      if (!items.length) continue;
      const emp = p.empresa_nombre || 'Sin empresa';
      if (!map[emp]) map[emp] = [];
      map[emp].push({ nombre: `${p.empleado_apellido}, ${p.empleado_nombre}`, items, notas: items.filter(i => i.notas) });
    }
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b));
  })();

  const gruposCocinaFiltrados = (() => {
    if (!filtroPlatoTxt.trim()) return gruposCocina;
    const q = filtroPlatoTxt.toLowerCase();
    return gruposCocina.filter(g => g.plato_nombre.toLowerCase().includes(q));
  })();

  const notasDia = itemsDia.filter(i => i.notas);

  if (diasConItems.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-sm">No hay pedidos para esta semana.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs de días — compactos */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {diasConItems.map(d => {
          const count = pedidos.reduce((n,p) => n + (p.items||[]).filter(i => i.dia === d).length, 0);
          const activo = d === dia;
          return (
            <button
              key={d}
              onClick={() => { setDiaActivo(d); setFiltroPlatoTxt(''); }}
              className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${activo ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}
            >
              <span className="font-bold">{DIAS_FULL[d]}</span>
              <span className={`text-[10px] ${activo ? 'text-green-200' : 'text-gray-400'}`}>{fmt(fechaDia(d))}</span>
              <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activo ? 'bg-white text-green-700' : 'bg-green-100 text-green-700'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-tabs: Lista de cocina / Por empresa */}
      {dia && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {[['cocina','🍳 Lista de cocina'],['empresa','🏢 Por empresa']].map(([v,l]) => (
              <button
                key={v}
                onClick={() => setSubVista(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${subVista === v ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'} ${v === 'empresa' ? 'border-l border-gray-200' : ''}`}
              >
                {l}
              </button>
            ))}
          </div>
          {subVista === 'cocina' && (
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Buscar plato..."
                value={filtroPlatoTxt}
                onChange={e => setFiltroPlatoTxt(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400"
              />
            </div>
          )}
          <BotonImprimir dia={dia} gruposCocina={gruposCocina} pedidos={pedidos} semana={semana} diasDisponibles={diasConItems} />
        </div>
      )}

      {/* Alerta de notas */}
      {notasDia.length > 0 && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <p className="text-xs font-bold text-amber-800 mb-1">⚠️ Observaciones — {DIAS_FULL[dia]}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {notasDia.map((item, i) => (
              <span key={i} className="text-xs text-amber-700">
                <strong>{item.empleado_apellido}, {item.empleado_nombre}:</strong> {item.notas}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Lista de cocina ── */}
      {subVista === 'cocina' && (
        <div className="space-y-2">
          {gruposCocinaFiltrados.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">Sin resultados.</p>
          )}
          {gruposCocinaFiltrados.map((grupo, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{grupo.plato_nombre}</p>
                <div className="flex gap-3 mt-0.5">
                  {grupo.opcion && <span className="text-xs text-gray-400">Opción {grupo.opcion}</span>}
                  {grupo.guarnicion_nombre && <span className="text-xs text-emerald-600">+ {grupo.guarnicion_nombre}</span>}
                </div>
              </div>
              <div className="bg-green-700 text-white text-xl font-bold w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
                {grupo.cantidad}
              </div>
            </div>
          ))}
          {gruposCocinaFiltrados.length > 0 && (
            <p className="text-xs text-gray-400 text-right pt-1">
              Total: {gruposCocinaFiltrados.reduce((s,g) => s + g.cantidad, 0)} viandas
            </p>
          )}
        </div>
      )}

      {/* ── Por empresa ── */}
      {subVista === 'empresa' && (
        <div className="space-y-3">
          {gruposEmpresa.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">Sin pedidos para este día.</p>
          )}
          {gruposEmpresa.map(([empresa, personas]) => (
            <div key={empresa} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              {/* Header empresa */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 min-h-[48px]">
                <p className="font-semibold text-gray-800 text-sm">{empresa}</p>
                <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">{personas.length}</span>
              </div>
              {/* Filas */}
              <div className="divide-y divide-gray-50">
                {personas.sort((a,b) => a.nombre.localeCompare(b.nombre)).map((p, j) => (
                  <div key={j} className="flex items-start gap-3 px-4 py-2">
                    <Avatar nombre={p.nombre.split(',')[1]?.trim()||''} apellido={p.nombre.split(',')[0]?.trim()||''} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                      {p.items.map((item, k) => (
                        <div key={k} className="text-xs text-gray-500 leading-relaxed">
                          <span className="font-medium text-gray-700">{item.plato_nombre}</span>
                          {item.opcion && <span className="text-gray-400"> · Op. {item.opcion}</span>}
                          {item.guarnicion_nombre && <span className="text-emerald-600"> + {item.guarnicion_nombre}</span>}
                          {item.notas && <span className="text-amber-600 font-medium"> ⚠ {item.notas}</span>}
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

function GrupoEmpresa({ empresa, grupo, diasSemana, onCambiarEstado, loadingId, selected, onToggleSelect }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <button
        onClick={() => setAbierto(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors border-b border-gray-100 min-h-[52px]"
      >
        <p className="font-semibold text-gray-800 text-sm">{empresa}</p>
        <div className="flex items-center gap-2.5">
          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">{grupo.length}</span>
          <span className="text-gray-400 text-sm">{abierto ? '▲' : '▼'}</span>
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
              loadingId={loadingId}
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

export default function PedidosAdmin() {
  const [semana, setSemana]               = useState(getLunes());
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro]   = useState('');
  const [busqueda, setBusqueda]           = useState('');
  const [vista, setVista]                 = useState('dia');
  const [diaActivo, setDiaActivo]         = useState(null);
  const [selected, setSelected]           = useState(new Set());
  const [bulkLoading, setBulkLoading]     = useState(false);
  const [loadingId, setLoadingId]         = useState(null);

  const { data: pedidosRaw = [], isLoading } = usePedidos({ semana_inicio: semana, empresa_id: empresaFiltro || undefined });
  const { data: empresas = [] } = useEmpresas();
  const updateEstado = useUpdateEstadoPedido();

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
    return {
      total: pedidosRaw.length,
      viandas: pedidosRaw.reduce((s,p) => s + (p.items?.length||0), 0),
      porEstado,
    };
  }, [pedidosRaw]);

  const diasSemana = useMemo(() => {
    const usados = new Set(pedidos.flatMap(p => (p.items||[]).map(i => i.dia)));
    return DIAS_ORDEN.filter(d => usados.has(d));
  }, [pedidos]);

  const handleCambiarEstado = useCallback(async (id, estado) => {
    setLoadingId(id);
    try {
      await updateEstado.mutateAsync({ id, estado });
      toast.success(`${ESTADO_MAP[estado]?.icon} ${ESTADO_MAP[estado]?.label}`);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Error al actualizar');
    } finally { setLoadingId(null); }
  }, [updateEstado]);

  const handleBulkEstado = async (estado) => {
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map(id => updateEstado.mutateAsync({ id, estado })));
      toast.success(`${selected.size} pedidos actualizados a "${ESTADO_MAP[estado]?.label}"`);
      setSelected(new Set());
    } catch {
      toast.error('Error en actualización masiva');
    } finally { setBulkLoading(false); }
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

  return (
    <div className="px-4 pt-0 pb-4 md:p-6 max-w-7xl mx-auto">

      {/* ── Header mobile (sticky) ── */}
      <div className="md:hidden sticky top-0 z-20 bg-green-700 text-white px-4 py-3 -mx-4 -mt-0 mb-4 print:hidden flex items-center gap-2">
        <h1 className="text-base font-bold flex-1">Pedidos</h1>
        <button onClick={() => cambiarSemana(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 text-white text-lg leading-none">‹</button>
        <div className="text-center">
          <p className="text-xs font-semibold leading-tight">{fmt(semana)} — {fmt(domingoSemana)}</p>
          {!esEstaSemana && <button onClick={() => { setSemana(getLunes()); setDiaActivo(null); }} className="text-[10px] text-green-200 underline">Hoy</button>}
        </div>
        <button onClick={() => cambiarSemana(1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 text-white text-lg leading-none">›</button>
        <div className="ml-1">
          <BotonExportar pedidos={pedidos} semana={semana} empresas={[...new Set(pedidos.map(p => p.empresa_nombre).filter(Boolean))].sort()} compact />
        </div>
      </div>

      {/* ── Header desktop ── */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-3 mb-5 print:mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <div className="flex items-center gap-1 print:hidden">
          <button onClick={() => cambiarSemana(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-lg">‹</button>
          <div className="text-center px-3">
            <p className="text-sm font-semibold text-gray-800">{fmt(semana)} — {fmt(domingoSemana)}</p>
            <p className="text-[11px] text-gray-400">{fmtFull(semana).split('/')[2]}</p>
          </div>
          <button onClick={() => cambiarSemana(1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-lg">›</button>
          {!esEstaSemana && (
            <button onClick={() => { setSemana(getLunes()); setDiaActivo(null); }} className="ml-1 text-xs text-green-700 underline">Hoy</button>
          )}
        </div>
        <div className="flex gap-2 print:hidden">
          <BotonExportar pedidos={pedidos} semana={semana} empresas={[...new Set(pedidos.map(p => p.empresa_nombre).filter(Boolean))].sort()} />
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-4 gap-0 mb-4 print:hidden overflow-hidden rounded-xl border border-gray-100 shadow-sm divide-x divide-gray-100">
        <div className="bg-white p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">Pedidos</p>
        </div>
        <div className="bg-white p-3 text-center">
          <p className="text-xl font-bold text-green-700">{stats.viandas}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">Viandas</p>
        </div>
        <button
          className={`p-3 text-center transition-colors ${estadoFiltro === 'pendiente' ? 'bg-amber-100' : 'bg-amber-50 hover:bg-amber-100'}`}
          onClick={() => setEstadoFiltro(estadoFiltro === 'pendiente' ? '' : 'pendiente')}
        >
          <p className="text-xl font-bold text-amber-700">{stats.porEstado.pendiente||0}</p>
          <p className="text-[11px] text-amber-600 mt-0.5 leading-tight">Pend.</p>
        </button>
        <button
          className={`p-3 text-center transition-colors ${estadoFiltro === 'listo' ? 'bg-green-100' : 'bg-green-50 hover:bg-green-100'}`}
          onClick={() => setEstadoFiltro(estadoFiltro === 'listo' ? '' : 'listo')}
        >
          <p className="text-xl font-bold text-green-700">{(stats.porEstado.listo||0) + (stats.porEstado.entregado||0)}</p>
          <p className="text-[11px] text-green-600 mt-0.5 leading-tight">Listos</p>
        </button>
      </div>

      {/* ── Filtros ── */}
      <div className="space-y-2 mb-4 print:hidden">
        {/* Buscador full-width */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Buscar empleado o empresa..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-400"
          />
        </div>
        {/* Empresa + Estado en 2 columnas */}
        <div className="grid grid-cols-2 gap-2">
          <select
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 bg-white"
            value={empresaFiltro}
            onChange={e => { setEmpresaFiltro(e.target.value); setSelected(new Set()); }}
          >
            <option value="">Empresa</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <select
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 bg-white"
            value={estadoFiltro}
            onChange={e => setEstadoFiltro(e.target.value)}
          >
            <option value="">Estado</option>
            {ESTADOS.map(e => <option key={e.key} value={e.key}>{e.icon} {e.label}</option>)}
          </select>
        </div>
        {/* Vista tabs */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {[['empresa','👤 Personas'],['dia','📅 Por día']].map(([v,l]) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${vista === v ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'} ${v === 'dia' ? 'border-l border-gray-200' : ''}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros activos */}
      {(busqueda || estadoFiltro) && (
        <p className="text-xs text-gray-400 mb-3 print:hidden">
          Mostrando {pedidos.length} de {pedidosRaw.length} pedidos
          <button onClick={() => { setBusqueda(''); setEstadoFiltro(''); }} className="ml-2 text-green-700 underline">Limpiar filtros</button>
        </p>
      )}

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onCambiarEstado={handleBulkEstado}
          loading={bulkLoading}
        />
      )}

      {/* ── Empleados sin pedido ── */}
      <EmpleadosSinPedido pedidos={pedidosRaw} empresaFiltro={empresaFiltro} />

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full" />
        </div>
      )}

      {/* ── Vista por persona (agrupada por empresa) ── */}
      {vista === 'empresa' && !isLoading && (() => {
        if (pedidos.length === 0) return (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">No hay pedidos para esta semana.</p>
          </div>
        );
        const porEmpresa = {};
        for (const p of pedidos) {
          const k = p.empresa_nombre || 'Sin empresa';
          if (!porEmpresa[k]) porEmpresa[k] = [];
          porEmpresa[k].push(p);
        }
        const grupos = Object.entries(porEmpresa).sort(([a],[b]) => a.localeCompare(b));
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 pb-1 print:hidden">
              <input type="checkbox" checked={selected.size === pedidos.length && pedidos.length > 0} onChange={toggleSelectAll} className="w-4 h-4 accent-green-700 cursor-pointer" />
              <span>{selected.size === pedidos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}</span>
            </div>
            {grupos.map(([empresa, grupo]) => (
              <GrupoEmpresa
                key={empresa}
                empresa={empresa}
                grupo={grupo}
                diasSemana={diasSemana}
                onCambiarEstado={handleCambiarEstado}
                loadingId={loadingId}
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
        />
      )}
    </div>
  );
}
