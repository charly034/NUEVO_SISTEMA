import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';
import { useEmpresas } from '../hooks/useEmpresas.js';
import { useEmpleados } from '../hooks/useEmpleados.js';
import { useUpdateEstadoPedido } from '../hooks/usePedidos.js';
import {
  useAplicarPago,
  useFinanzasPedidosPagos,
  useRegistrarPago,
} from '../hooks/useFinanzas.js';
import CuentaCorrienteFicha from '../components/finanzas/CuentaCorrienteFicha.jsx';
import { toast } from '../lib/toast.js';

const ESTADOS_OPERATIVOS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'listo', label: 'Listo' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const ESTADOS_FINANCIEROS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pagado', label: 'Pagado' },
  { value: 'saldo_a_favor', label: 'Saldo a favor' },
];

const METODOS_PAGO = ['efectivo', 'transferencia', 'mercado_pago', 'tarjeta', 'cheque', 'otro'];

const AGRUPACIONES = [
  { value: 'ninguna', label: 'Sin agrupar' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'persona', label: 'Persona' },
  { value: 'estado_financiero', label: 'Estado financiero' },
];

const DEFAULT_FILTROS = {
  empresa_id: '',
  empleado_id: '',
  desde: '',
  hasta: '',
  estado: '',
  estado_financiero: '',
  menu: '',
  pago: '',
  metodo_pago: '',
  q: '',
};

function icono(nombre, className = 'h-4 w-4') {
  const props = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', className };
  const paths = {
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    check: <path d="M5 13l4 4L19 7" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M7 10v4M17 10v4" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.14 1.14" /><path d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.14-1.14" /></>,
    print: <><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" /></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 9h8M8 13h5" /></>,
    download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  };
  return <svg {...props}>{paths[nombre]}</svg>;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDate(value) {
  if (!value) return '-';
  const [date] = String(value).split('T');
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function normalizePedido(row) {
  const vendido = toNumber(row.importe_calculado ?? row.importe_total ?? row.total);
  const cobrado = toNumber(row.importe_aplicado ?? row.importe_pagado ?? row.pagado);
  const saldo = toNumber(row.saldo ?? (vendido - cobrado));
  const persona = `${row.empleado_nombre || ''} ${row.empleado_apellido || ''}`.trim() || row.empleado_email || '-';
  return {
    ...row,
    vendido,
    cobrado,
    saldo,
    persona,
    cantidad_viandas: toNumber(row.cantidad_viandas ?? row.cantidad ?? row.items?.length ?? 1) || 1,
    menu_nombre: row.menu_nombre || row.plan_nombre || row.vianda_nombre || row.plato_nombre || '',
    precio_unitario: toNumber(row.precio_unitario ?? (vendido || 0)),
  };
}

function labelEstadoFinanciero(value) {
  return ESTADOS_FINANCIEROS.find(e => e.value === value)?.label || value || 'Pendiente';
}

function estadoFinancieroClass(value) {
  if (value === 'pagado') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (value === 'parcial') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (value === 'saldo_a_favor') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-gray-200 bg-gray-50 text-gray-700';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function exportRows(rows) {
  return rows.map(row => ({
    Fecha: formatDate(row.semana_inicio),
    Empresa: row.empresa_nombre || '',
    Persona: row.persona,
    'Menu/vianda': row.menu_nombre || '',
    Cantidad: row.cantidad_viandas,
    'Precio unitario': row.precio_unitario,
    Total: row.vendido,
    'Estado pedido': row.estado || '',
    'Estado pago': labelEstadoFinanciero(row.estado_financiero),
    Pagado: row.cobrado,
    Saldo: row.saldo,
    'Metodo de pago': row.metodo_pago || '',
    'Fecha de pago': row.fecha_pago ? formatDate(row.fecha_pago) : '',
    Comprobante: row.comprobante_url || '',
  }));
}

function descargarArchivo(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function buildCsv(rows) {
  const data = exportRows(rows);
  if (!data.length) return '';
  const headers = Object.keys(data[0]);
  const lines = [headers.join(',')];
  for (const row of data) {
    lines.push(headers.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n');
}

function textoWhatsApp(rows, metrics) {
  const top = [
    'Pedidos y pagos',
    `Pedidos: ${metrics.pedidos}`,
    `Viandas: ${metrics.viandas}`,
    `Vendido: ${formatMoney(metrics.vendido)}`,
    `Cobrado: ${formatMoney(metrics.cobrado)}`,
    `Pendiente: ${formatMoney(metrics.pendiente)}`,
  ];
  const detalle = rows.slice(0, 30).map(row =>
    `- ${formatDate(row.semana_inicio)} | ${row.empresa_nombre || '-'} | ${row.persona} | ${formatMoney(row.vendido)} | ${labelEstadoFinanciero(row.estado_financiero)}`
  );
  const extra = rows.length > 30 ? [`... y ${rows.length - 30} pedidos más`] : [];
  return [...top, '', ...detalle, ...extra].join('\n');
}

function imprimirResumen(rows, metrics) {
  const htmlRows = rows.map(row => `
    <tr>
      <td>${escapeHtml(formatDate(row.semana_inicio))}</td>
      <td>${escapeHtml(row.empresa_nombre || '-')}</td>
      <td>${escapeHtml(row.persona)}</td>
      <td>${escapeHtml(row.menu_nombre || '-')}</td>
      <td>${escapeHtml(row.cantidad_viandas)}</td>
      <td>${escapeHtml(formatMoney(row.vendido))}</td>
      <td>${escapeHtml(formatMoney(row.cobrado))}</td>
      <td>${escapeHtml(formatMoney(row.saldo))}</td>
      <td>${escapeHtml(labelEstadoFinanciero(row.estado_financiero))}</td>
    </tr>
  `).join('');
  const w = window.open('', '_blank');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Pedidos y pagos</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111;margin:24px;font-size:12px}
      h1{font-size:22px;margin:0 0 8px}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}
      .kpi{border:1px solid #ddd;padding:8px}
      .kpi b{display:block;font-size:16px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ddd;padding:5px;text-align:left}
      th{background:#f3f4f6}
    </style></head><body>
    <h1>Pedidos y pagos</h1>
    <div>Generado ${escapeHtml(new Date().toLocaleString('es-AR'))}</div>
    <div class="kpis">
      <div class="kpi"><span>Total vendido</span><b>${escapeHtml(formatMoney(metrics.vendido))}</b></div>
      <div class="kpi"><span>Total cobrado</span><b>${escapeHtml(formatMoney(metrics.cobrado))}</b></div>
      <div class="kpi"><span>Total pendiente</span><b>${escapeHtml(formatMoney(metrics.pendiente))}</b></div>
      <div class="kpi"><span>Viandas</span><b>${escapeHtml(metrics.viandas)}</b></div>
    </div>
    <table><thead><tr><th>Fecha</th><th>Empresa</th><th>Persona</th><th>Menu</th><th>Cant.</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado pago</th></tr></thead>
    <tbody>${htmlRows}</tbody></table></body></html>`);
  w.document.close();
  w.onload = () => {
    w.focus();
    w.print();
  };
}

function agrupar(rows, tipo) {
  if (tipo === 'ninguna') return [{ key: 'todos', label: 'Todos los pedidos', rows }];
  const map = new Map();
  for (const row of rows) {
    let key = 'Sin dato';
    if (tipo === 'fecha') key = row.semana_inicio || 'Sin fecha';
    if (tipo === 'empresa') key = row.empresa_nombre || 'Sin empresa';
    if (tipo === 'persona') key = row.persona || 'Sin persona';
    if (tipo === 'estado_financiero') key = labelEstadoFinanciero(row.estado_financiero);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()].map(([key, groupRows]) => ({
    key,
    label: tipo === 'fecha' ? formatDate(key) : key,
    rows: groupRows,
  }));
}

function calcularMetricas(rows) {
  const empresasDeuda = new Set();
  const personasDeuda = new Set();
  const metrics = rows.reduce((acc, row) => {
    acc.vendido += row.vendido;
    acc.cobrado += row.cobrado;
    acc.pendiente += Math.max(row.saldo, 0);
    acc.viandas += row.cantidad_viandas;
    acc.pedidos += 1;
    if (row.saldo > 0) {
      if (row.empresa_id) empresasDeuda.add(row.empresa_id);
      if (row.empleado_id) personasDeuda.add(row.empleado_id);
    }
    return acc;
  }, { vendido: 0, cobrado: 0, pendiente: 0, viandas: 0, pedidos: 0 });
  return { ...metrics, empresasDeuda: empresasDeuda.size, personasDeuda: personasDeuda.size };
}

function Kpi({ label, value, tone = 'gray' }) {
  const colors = {
    gray: 'text-gray-900',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    blue: 'text-blue-700',
  };
  return (
    <div className="border border-gray-200 bg-white px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${colors[tone] || colors.gray}`}>{value}</p>
    </div>
  );
}

function PagoModal({ pedido, onClose, onRegistrar, loading }) {
  const [form, setForm] = useState({
    pagador_tipo: pedido?.empresa_id ? 'empresa' : 'empleado',
    monto: pedido?.saldo > 0 ? String(pedido.saldo) : String(pedido?.vendido || ''),
    fecha_pago: new Date().toISOString().slice(0, 10),
    metodo_pago: 'transferencia',
    observacion: '',
    comprobante_url: '',
    aplicar: true,
  });

  if (!pedido) return null;

  const pagadorEmpresa = form.pagador_tipo === 'empresa';
  const submit = (event) => {
    event.preventDefault();
    onRegistrar({
      ...form,
      monto: toNumber(form.monto),
      empresa_id: pagadorEmpresa ? pedido.empresa_id : undefined,
      empleado_id: pagadorEmpresa ? undefined : pedido.empleado_id,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <form onSubmit={submit} className="flex h-full w-full flex-col overflow-y-auto bg-white p-4 shadow-xl md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Registrar pago</h2>
            <p className="text-sm text-gray-500">{pedido.persona} · {pedido.empresa_nombre || 'Sin empresa'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-600">Cerrar</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">Pagador</span>
            <select value={form.pagador_tipo} onChange={e => setForm(f => ({ ...f, pagador_tipo: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2">
              <option value="empresa">Empresa</option>
              <option value="empleado">Persona</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">Monto</span>
            <input type="number" min="0" step="0.01" required value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">Fecha de pago</span>
            <input type="date" required value={form.fecha_pago} onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">Metodo</span>
            <select value={form.metodo_pago} onChange={e => setForm(f => ({ ...f, metodo_pago: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2">
              {METODOS_PAGO.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs font-medium text-gray-500">Comprobante URL</span>
            <input value={form.comprobante_url} onChange={e => setForm(f => ({ ...f, comprobante_url: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Opcional" />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs font-medium text-gray-500">Observacion</span>
            <textarea value={form.observacion} onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))} className="h-20 w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
            <input type="checkbox" checked={form.aplicar} onChange={e => setForm(f => ({ ...f, aplicar: e.target.checked }))} className="h-4 w-4 accent-brand-700" />
            Aplicar este pago al pedido seleccionado
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700">Cancelar</button>
          <button type="submit" disabled={loading} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AsociarPagoModal({ pedido, onClose, onAplicar, loading }) {
  const [pagoId, setPagoId] = useState('');
  const [monto, setMonto] = useState(pedido?.saldo > 0 ? String(pedido.saldo) : '');
  if (!pedido) return null;

  const submit = (event) => {
    event.preventDefault();
    onAplicar({ pagoId, monto: toNumber(monto) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <form onSubmit={submit} className="flex h-full w-full flex-col overflow-y-auto bg-white p-4 shadow-xl md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Asociar a pago grupal</h2>
            <p className="text-sm text-gray-500">Pedido #{pedido.id} · saldo {formatMoney(pedido.saldo)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-600">Cerrar</button>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">ID del pago existente</span>
            <input required value={pagoId} onChange={e => setPagoId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">Monto a aplicar</span>
            <input type="number" min="0" step="0.01" required value={monto} onChange={e => setMonto(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <p className="text-xs text-gray-500">La primera etapa backend aun no expone listado de pagos; por eso la asociacion manual pide el ID del pago.</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700">Cancelar</button>
          <button type="submit" disabled={loading} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? 'Aplicando...' : 'Aplicar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function DetalleModal({
  pedido,
  onClose,
  onCuenta,
  onRegistrarPago,
  onAsociarPago,
  onCambiarEstado,
  estadoLoading,
  onImprimir,
  onCopiarWhatsApp,
}) {
  if (!pedido) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <div className="h-full w-full overflow-y-auto bg-white p-4 shadow-xl md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Pedido #{pedido.id}</h2>
            <p className="text-sm text-gray-500">{pedido.persona} · {pedido.empresa_nombre || 'Sin empresa'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-600">Cerrar</button>
        </div>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <div><dt className="text-xs text-gray-500">Fecha</dt><dd className="font-medium">{formatDate(pedido.semana_inicio)}</dd></div>
          <div><dt className="text-xs text-gray-500">Estado pedido</dt><dd className="font-medium">{pedido.estado || '-'}</dd></div>
          <div><dt className="text-xs text-gray-500">Estado pago</dt><dd className="font-medium">{labelEstadoFinanciero(pedido.estado_financiero)}</dd></div>
          <div><dt className="text-xs text-gray-500">Total</dt><dd className="font-medium">{formatMoney(pedido.vendido)}</dd></div>
          <div><dt className="text-xs text-gray-500">Pagado</dt><dd className="font-medium">{formatMoney(pedido.cobrado)}</dd></div>
          <div><dt className="text-xs text-gray-500">Saldo</dt><dd className="font-medium">{formatMoney(pedido.saldo)}</dd></div>
          <div><dt className="text-xs text-gray-500">Menu/vianda</dt><dd className="font-medium">{pedido.menu_nombre || '-'}</dd></div>
          <div><dt className="text-xs text-gray-500">Precio unitario</dt><dd className="font-medium">{formatMoney(pedido.precio_unitario)}</dd></div>
          <div><dt className="text-xs text-gray-500">Cantidad</dt><dd className="font-medium">{pedido.cantidad_viandas}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => onCuenta('empresa', pedido)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">Cuenta empresa</button>
          <button type="button" onClick={() => onCuenta('empleado', pedido)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">Cuenta persona</button>
          <Link to="/pedidos" className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">Ir a pedidos</Link>
          <button type="button" onClick={() => onRegistrarPago(pedido)} className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-medium text-brand-700">Registrar pago</button>
          <button type="button" onClick={() => onAsociarPago(pedido)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">Asociar pago</button>
          <button type="button" onClick={() => onImprimir(pedido)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">Imprimir</button>
          <button type="button" onClick={() => onCopiarWhatsApp(pedido)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">Copiar WhatsApp</button>
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Acciones de estado</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onCambiarEstado(pedido, 'entregado')} disabled={estadoLoading} className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50">Marcar entregado</button>
            <button type="button" onClick={() => onCambiarEstado(pedido, 'cancelado')} disabled={estadoLoading} className="rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50">Cancelar pedido</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ title, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function PedidosPagos() {
  const [filtros, setFiltros] = useState(DEFAULT_FILTROS);
  const [agrupacion, setAgrupacion] = useState('fecha');
  const [detalle, setDetalle] = useState(null);
  const [pagoPedido, setPagoPedido] = useState(null);
  const [asociarPedido, setAsociarPedido] = useState(null);
  const [cuenta, setCuenta] = useState(null);
  const [filtrosAvanzadosAbiertos, setFiltrosAvanzadosAbiertos] = useState(false);

  const queryParams = useMemo(() => ({
    empresa_id: filtros.empresa_id || undefined,
    empleado_id: filtros.empleado_id || undefined,
    desde: filtros.desde || undefined,
    hasta: filtros.hasta || undefined,
    estado: filtros.estado || undefined,
    estado_financiero: filtros.estado_financiero || undefined,
    limit: 500,
  }), [filtros]);

  const { data: pedidosRaw = [], isLoading, refetch } = useFinanzasPedidosPagos(queryParams);
  const { data: empresas = [] } = useEmpresas();
  const { data: empleados = [] } = useEmpleados(filtros.empresa_id || undefined);
  const updateEstado = useUpdateEstadoPedido();
  const registrarPago = useRegistrarPago();
  const aplicarPago = useAplicarPago();

  const pedidos = useMemo(() => pedidosRaw.map(normalizePedido), [pedidosRaw]);
  const empleadosOpciones = useMemo(() => {
    const fromRows = pedidos.map(p => ({ id: p.empleado_id, nombre: p.empleado_nombre, apellido: p.empleado_apellido }))
      .filter(e => e.id);
    const map = new Map();
    [...empleados, ...fromRows].forEach(e => {
      if (e?.id) map.set(String(e.id), e);
    });
    return [...map.values()].sort((a, b) => `${a.apellido || ''} ${a.nombre || ''}`.localeCompare(`${b.apellido || ''} ${b.nombre || ''}`));
  }, [empleados, pedidos]);

  const pedidosFiltrados = useMemo(() => {
    let list = pedidos;
    if (filtros.menu.trim()) {
      const q = filtros.menu.trim().toLowerCase();
      list = list.filter(p => (p.menu_nombre || '').toLowerCase().includes(q));
    }
    if (filtros.pago === 'pagado') list = list.filter(p => p.estado_financiero === 'pagado');
    if (filtros.pago === 'no_pagado') list = list.filter(p => p.estado_financiero === 'pendiente');
    if (filtros.pago === 'parcial') list = list.filter(p => p.estado_financiero === 'parcial');
    if (filtros.metodo_pago) list = list.filter(p => p.metodo_pago === filtros.metodo_pago);
    if (filtros.q.trim()) {
      const q = filtros.q.trim().toLowerCase();
      list = list.filter(p => [
        p.id,
        p.empresa_nombre,
        p.persona,
        p.empleado_email,
        p.menu_nombre,
        p.estado,
        p.estado_financiero,
        p.metodo_pago,
      ].filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    return list;
  }, [pedidos, filtros]);

  const metrics = useMemo(() => calcularMetricas(pedidosFiltrados), [pedidosFiltrados]);
  const grupos = useMemo(() => agrupar(pedidosFiltrados, agrupacion), [pedidosFiltrados, agrupacion]);

  const setFiltro = (key, value) => {
    setFiltros(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'empresa_id') next.empleado_id = '';
      return next;
    });
  };

  const limpiarFiltros = () => setFiltros(DEFAULT_FILTROS);

  const cambiarEstado = async (pedido, estado) => {
    try {
      await updateEstado.mutateAsync({ id: pedido.id, estado });
      await refetch();
      toast.success(`Pedido ${estado}`);
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el pedido');
    }
  };

  const registrarPagoPedido = async (payload) => {
    try {
      const aplicar = payload.aplicar;
      const pago = await registrarPago.mutateAsync({
        pagador_tipo: payload.pagador_tipo,
        empresa_id: payload.empresa_id,
        empleado_id: payload.empleado_id,
        monto: payload.monto,
        fecha_pago: payload.fecha_pago,
        metodo_pago: payload.metodo_pago,
        observacion: payload.observacion || undefined,
        comprobante_url: payload.comprobante_url || undefined,
      });
      if (aplicar) {
        await aplicarPago.mutateAsync({
          id: pago.id,
          aplicaciones: [{ pedido_id: pagoPedido.id, monto_aplicado: payload.monto }],
        });
      }
      setPagoPedido(null);
      await refetch();
      toast.success('Pago registrado');
    } catch (error) {
      toast.error(error.message || 'No se pudo registrar el pago');
    }
  };

  const aplicarPagoExistente = async ({ pagoId, monto }) => {
    try {
      await aplicarPago.mutateAsync({
        id: pagoId,
        aplicaciones: [{ pedido_id: asociarPedido.id, monto_aplicado: monto }],
      });
      setAsociarPedido(null);
      await refetch();
      toast.success('Pago asociado');
    } catch (error) {
      toast.error(error.message || 'No se pudo asociar el pago');
    }
  };

  const abrirCuenta = (tipo, pedido) => {
    if (tipo === 'empresa') {
      setCuenta({ tipo, id: pedido.empresa_id, nombre: pedido.empresa_nombre || `Empresa ${pedido.empresa_id}` });
      return;
    }
    setCuenta({ tipo, id: pedido.empleado_id, nombre: pedido.persona || `Persona ${pedido.empleado_id}` });
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows(pedidosFiltrados));
    ws['!cols'] = [
      { wch: 12 }, { wch: 24 }, { wch: 28 }, { wch: 24 }, { wch: 10 }, { wch: 14 },
      { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos y pagos');
    XLSX.writeFile(wb, 'pedidos-y-pagos.xlsx');
  };

  const exportarCsv = () => descargarArchivo('pedidos-y-pagos.csv', buildCsv(pedidosFiltrados), 'text/csv;charset=utf-8');
  const copiarWhatsApp = async () => {
    await navigator.clipboard.writeText(textoWhatsApp(pedidosFiltrados, metrics));
    toast.success('Texto copiado para WhatsApp');
  };

  return (
    <div className="mx-auto max-w-[1600px] min-w-0 overflow-x-hidden px-4 py-4 md:px-6 md:py-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos y pagos</h1>
          <p className="text-sm text-gray-500">Historial operativo y financiero de pedidos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportarExcel} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{icono('download')} Excel</button>
          <button type="button" onClick={exportarCsv} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{icono('download')} CSV</button>
          <button type="button" onClick={() => imprimirResumen(pedidosFiltrados, metrics)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{icono('file')} PDF</button>
          <button type="button" onClick={copiarWhatsApp} className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100">{icono('message')} WhatsApp</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 overflow-hidden border border-gray-200 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Total vendido" value={formatMoney(metrics.vendido)} />
        <Kpi label="Total cobrado" value={formatMoney(metrics.cobrado)} tone="green" />
        <Kpi label="Pendiente" value={formatMoney(metrics.pendiente)} tone="amber" />
        <Kpi label="Viandas" value={metrics.viandas} tone="blue" />
        <Kpi label="Pedidos" value={metrics.pedidos} />
        <Kpi label="Empresas con deuda" value={metrics.empresasDeuda} tone="amber" />
        <Kpi label="Personas con deuda" value={metrics.personasDeuda} tone="amber" />
      </div>

      <section className="mb-4 border border-gray-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">Empresa</span>
            <select value={filtros.empresa_id} onChange={e => setFiltro('empresa_id', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">Todas las empresas</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">Estado financiero</span>
            <select value={filtros.estado_financiero} onChange={e => setFiltro('estado_financiero', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">Todos</option>
              {ESTADOS_FINANCIEROS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">Buscar</span>
            <input value={filtros.q} onChange={e => setFiltro('q', e.target.value)} placeholder="Empresa, persona, pedido..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="mt-3 rounded-lg border border-gray-100">
          <button
            type="button"
            onClick={() => setFiltrosAvanzadosAbiertos((open) => !open)}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-gray-700"
          >
            <span>Filtros avanzados</span>
            <span className="text-xs text-gray-500">{filtrosAvanzadosAbiertos ? 'Ocultar' : 'Mostrar'}</span>
          </button>
          {filtrosAvanzadosAbiertos ? (
            <div className="grid gap-2 border-t border-gray-100 p-3 md:grid-cols-3 xl:grid-cols-4">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500">Persona</span>
                <select value={filtros.empleado_id} onChange={e => setFiltro('empleado_id', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="">Todas las personas</option>
                  {empleadosOpciones.map(e => <option key={e.id} value={e.id}>{`${e.apellido || ''} ${e.nombre || ''}`.trim() || e.email}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500">Desde</span>
                <input type="date" value={filtros.desde} onChange={e => setFiltro('desde', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500">Hasta</span>
                <input type="date" value={filtros.hasta} onChange={e => setFiltro('hasta', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500">Estado pedido</span>
                <select value={filtros.estado} onChange={e => setFiltro('estado', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  {ESTADOS_OPERATIVOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500">Menu / vianda</span>
                <input value={filtros.menu} onChange={e => setFiltro('menu', e.target.value)} placeholder="Menu, vianda o plato" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500">Pago rapido</span>
                <select value={filtros.pago} onChange={e => setFiltro('pago', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  <option value="pagado">Pagado</option>
                  <option value="no_pagado">No pagado</option>
                  <option value="parcial">Parcial</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500">Metodo de pago</span>
                <select value={filtros.metodo_pago} onChange={e => setFiltro('metodo_pago', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500">Agrupar por</span>
                <select value={agrupacion} onChange={e => setAgrupacion(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  {AGRUPACIONES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </label>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={limpiarFiltros} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Limpiar filtros</button>
        </div>
      </section>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-sm text-gray-500">Cargando pedidos y pagos...</div>
      ) : (
        <div className="space-y-3">
          {grupos.map(grupo => {
            const gm = calcularMetricas(grupo.rows);
            return (
              <section key={grupo.key} className="border border-gray-200 bg-white">
                <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-sm font-bold text-gray-900">{grupo.label}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                    <span>{gm.viandas} viandas</span>
                    <span>Vendido {formatMoney(gm.vendido)}</span>
                    <span>Cobrado {formatMoney(gm.cobrado)}</span>
                    <span>Pendiente {formatMoney(gm.pendiente)}</span>
                  </div>
                </div>
                <div className="overflow-hidden">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-white text-xs uppercase tracking-wide text-gray-500">
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Empresa</th>
                        <th className="px-3 py-2">Persona</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2">Estado pago</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                        <th className="px-3 py-2 text-right">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.rows.map(row => (
                        <tr key={row.id} onClick={() => setDetalle(row)} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50">
                          <td className="whitespace-nowrap px-3 py-2">{formatDate(row.semana_inicio)}</td>
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => abrirCuenta('empresa', row)} className="font-medium text-gray-900 hover:text-brand-700">{row.empresa_nombre || '-'}</button>
                          </td>
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => abrirCuenta('empleado', row)} className="font-medium text-gray-900 hover:text-brand-700">{row.persona}</button>
                            {row.empleado_email && <p className="text-xs text-gray-500">{row.empleado_email}</p>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{formatMoney(row.vendido)}</td>
                          <td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${estadoFinancieroClass(row.estado_financiero)}`}>{labelEstadoFinanciero(row.estado_financiero)}</span></td>
                          <td className={`px-3 py-2 text-right font-semibold ${row.saldo > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatMoney(row.saldo)}</td>
                          <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <ActionButton title="Ver detalle" onClick={() => setDetalle(row)}>{icono('eye')}</ActionButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!grupo.rows.length && <p className="px-4 py-10 text-center text-sm text-gray-500">Sin pedidos para los filtros actuales.</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <DetalleModal
        pedido={detalle}
        onClose={() => setDetalle(null)}
        onCuenta={abrirCuenta}
        onRegistrarPago={(pedido) => { setDetalle(null); setPagoPedido(pedido); }}
        onAsociarPago={(pedido) => { setDetalle(null); setAsociarPedido(pedido); }}
        onCambiarEstado={cambiarEstado}
        estadoLoading={updateEstado.isPending}
        onImprimir={(pedido) => imprimirResumen([pedido], calcularMetricas([pedido]))}
        onCopiarWhatsApp={(pedido) => navigator.clipboard.writeText(textoWhatsApp([pedido], calcularMetricas([pedido]))).then(() => toast.success('Texto copiado'))}
      />
      <PagoModal pedido={pagoPedido} onClose={() => setPagoPedido(null)} onRegistrar={registrarPagoPedido} loading={registrarPago.isPending || aplicarPago.isPending} />
      <AsociarPagoModal pedido={asociarPedido} onClose={() => setAsociarPedido(null)} onAplicar={aplicarPagoExistente} loading={aplicarPago.isPending} />
      {cuenta && (
        <CuentaCorrienteFicha
          tipo={cuenta.tipo}
          id={cuenta.id}
          nombre={cuenta.nombre}
          onClose={() => setCuenta(null)}
        />
      )}
    </div>
  );
}
