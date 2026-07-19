import { Fragment, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  useActualizarPago,
  useAplicarPago,
  useCuentaCorrienteEmpleado,
  useCuentaCorrienteEmpresa,
  useDesasociarAplicacionPago,
  useRegistrarPago,
} from '../../hooks/useFinanzas.js';
import { toast } from '../../lib/toast.js';

const METODOS_PAGO = ['efectivo', 'transferencia', 'mercado_pago', 'tarjeta', 'cheque', 'otro'];
const TABS_EMPRESA = ['Resumen', 'Pedidos', 'Empleados', 'Pagos', 'Deuda', 'Comprobantes', 'Configuracion de cobro'];
const TABS_PERSONA = ['Resumen', 'Pedidos', 'Pagos', 'Deuda', 'Comprobantes', 'Configuracion de cobro'];
const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_NOMBRE = {
  lunes: 'LUNES',
  martes: 'MARTES',
  miercoles: 'MIERCOLES',
  jueves: 'JUEVES',
  viernes: 'VIERNES',
  sabado: 'SABADO',
  domingo: 'DOMINGO',
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function localDateFromISO(value) {
  const [date] = String(value || '').split('T');
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function addDaysISO(value, days) {
  const date = localDateFromISO(value);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function defaultPeriod(tipo) {
  const hoy = new Date();
  if (tipo === 'diario') return { desde: isoDate(hoy), hasta: isoDate(hoy) };
  if (tipo === 'semanal') {
    const lunes = startOfWeek(hoy);
    return { desde: isoDate(lunes), hasta: isoDate(addDays(lunes, 6)) };
  }
  if (tipo === 'quincenal') return { desde: isoDate(addDays(hoy, -14)), hasta: isoDate(hoy) };
  if (tipo === 'mensual') return { desde: isoDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: isoDate(hoy) };
  return { desde: '', hasta: '' };
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(toNumber(value));
}

function formatDate(value) {
  if (!value) return '-';
  const [date] = String(value).split('T');
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function inPeriod(row, desde, hasta) {
  const fecha = String(row.semana_inicio || row.fecha_pago || row.created_at || '').slice(0, 10);
  if (!fecha) return true;
  if (desde && fecha < desde) return false;
  if (hasta && fecha > hasta) return false;
  return true;
}

function pedidoTotal(pedido) {
  return toNumber(pedido.importe_total ?? pedido.importe_calculado ?? pedido.total);
}

function pedidoPagado(pedido) {
  return toNumber(pedido.importe_pagado ?? pedido.importe_aplicado ?? pedido.pagado);
}

function pedidoSaldo(pedido) {
  return toNumber(pedido.saldo ?? (pedidoTotal(pedido) - pedidoPagado(pedido)));
}

function nombrePersona(item) {
  return `${item?.empleado_nombre || ''} ${item?.empleado_apellido || ''}`.trim() || item?.empleado_email || '-';
}

function nombrePlan(pedido) {
  return pedido.plan_nombre || 'Plan sin snapshot';
}

function detallePlan(pedido) {
  const partes = [];
  if (pedido.plan_gramaje_min) {
    partes.push(`${pedido.plan_gramaje_min}-${pedido.plan_gramaje_max || pedido.plan_gramaje_min} g`);
  }
  partes.push(pedido.plan_incluye_postre ? 'con postre' : 'sin postre');
  partes.push(pedido.plan_incluye_bebida ? 'con bebida' : 'sin bebida');
  return partes.join(' - ');
}

function observacionItem(pedido, item) {
  return [item?.notas, pedido?.observaciones].filter(Boolean).join(' - ');
}

function estadoGeneral({ pendiente, saldoFavor }) {
  if (saldoFavor > 0 && pendiente <= 0) return 'saldo a favor';
  if (pendiente > 0) return 'deuda';
  return 'al dia';
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function download(nombre, contenido, type) {
  const blob = new Blob([contenido], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function exportRows(pedidos, pagos) {
  const pedidoRows = pedidos.map(p => ({
    Tipo: 'Pedido',
    Fecha: formatDate(p.semana_inicio),
    Empresa: p.empresa_nombre || '',
    Persona: nombrePersona(p),
    Detalle: `Pedido #${p.id}`,
    Viandas: toNumber(p.cantidad_viandas ?? p.items?.filter(item => !item.sin_pedido).length ?? 1),
    Total: pedidoTotal(p),
    Cobrado: pedidoPagado(p),
    Saldo: pedidoSaldo(p),
    Metodo: '',
    Comprobante: '',
  }));
  const pagoRows = pagos.map(p => ({
    Tipo: 'Pago',
    Fecha: formatDate(p.fecha_pago),
    Empresa: p.empresa_nombre || '',
    Persona: nombrePersona(p),
    Detalle: `Pago #${p.id}`,
    Total: toNumber(p.monto),
    Cobrado: toNumber(p.monto_aplicado),
    Saldo: Math.max(toNumber(p.monto) - toNumber(p.monto_aplicado), 0),
    Metodo: p.metodo_pago || '',
    Comprobante: p.comprobante_url || '',
  }));
  return [...pedidoRows, ...pagoRows];
}

function csv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map(row => headers.map(key => escapeCsv(row[key])).join(','))].join('\n');
}

function buildResumenViandas(pedidos, nombreCuenta) {
  const map = new Map();

  for (const pedido of pedidos) {
    for (const item of pedido.items || []) {
      if (!item || item.sin_pedido) continue;
      const dia = item.dia;
      const diaIndex = DIAS_ORDEN.indexOf(dia);
      if (diaIndex < 0) continue;
      const fecha = addDaysISO(pedido.semana_inicio, diaIndex);
      const key = `${fecha}-${dia}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          cuenta: nombreCuenta,
          fecha,
          dia,
          detalles: [],
          cantidad: 0,
          total: 0,
          observaciones: '',
        });
      }
      const detalle = { pedido, item };
      const row = map.get(key);
      row.detalles.push(detalle);
      row.cantidad += 1;
      row.total += toNumber(item.precio_unitario);
    }
  }

  return [...map.values()]
    .map(row => ({
      ...row,
      observaciones: row.detalles
        .map(detalle => {
          const nota = observacionItem(detalle.pedido, detalle.item);
          return nota ? `${nombrePersona(detalle.pedido)}: ${nota}` : null;
        })
        .filter(Boolean)
        .join(' | '),
    }))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || DIAS_ORDEN.indexOf(a.dia) - DIAS_ORDEN.indexOf(b.dia));
}

function exportarResumenViandas({ nombre, periodo, rows }) {
  const resumenRows = rows.map(row => ({
    CUENTA: nombre,
    FECHA: formatDate(row.fecha),
    DIA: DIAS_NOMBRE[row.dia] || row.dia,
    'CANTIDAD DE VIANDAS': row.cantidad,
    TOTAL: row.total,
    OBSERVACIONES: row.observaciones,
  }));

  const detalleRows = rows.flatMap(row => row.detalles.map(({ pedido, item }) => ({
    CUENTA: nombre,
    FECHA: formatDate(row.fecha),
    DIA: DIAS_NOMBRE[row.dia] || row.dia,
    EMPLEADO: nombrePersona(pedido),
    PLAN: nombrePlan(pedido),
    'DETALLE PLAN': detallePlan(pedido),
    PLATO: item.plato_nombre || '',
    OPCION: item.opcion || '',
    GUARNICION: item.guarnicion_nombre || '',
    'PRECIO UNITARIO': toNumber(item.precio_unitario),
    OBSERVACIONES: observacionItem(pedido, item),
    ESTADO: pedido.estado || '',
  })));

  const wb = XLSX.utils.book_new();
  const wsResumen = XLSX.utils.json_to_sheet(resumenRows, {
    header: ['CUENTA', 'FECHA', 'DIA', 'CANTIDAD DE VIANDAS', 'TOTAL', 'OBSERVACIONES'],
  });
  wsResumen['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 54 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen viandas');

  const wsDetalle = XLSX.utils.json_to_sheet(detalleRows, {
    header: ['CUENTA', 'FECHA', 'DIA', 'EMPLEADO', 'PLAN', 'DETALLE PLAN', 'PLATO', 'OPCION', 'GUARNICION', 'PRECIO UNITARIO', 'OBSERVACIONES', 'ESTADO'],
  });
  wsDetalle['!cols'] = [
    { wch: 30 },
    { wch: 12 },
    { wch: 14 },
    { wch: 30 },
    { wch: 26 },
    { wch: 24 },
    { wch: 28 },
    { wch: 10 },
    { wch: 24 },
    { wch: 16 },
    { wch: 54 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle viandas');

  const desde = periodo.desde || 'inicio';
  const hasta = periodo.hasta || 'hoy';
  XLSX.writeFile(wb, `resumen-viandas-${nombre}-${desde}-${hasta}.xlsx`.replace(/[\\/:*?"<>|]+/g, '-'));
}

function textoWhatsApp({ nombre, metrics, pedidos }) {
  const rows = pedidos.slice(0, 25).map(p =>
    `- ${formatDate(p.semana_inicio)} | ${nombrePersona(p)} | ${formatMoney(pedidoTotal(p))} | saldo ${formatMoney(pedidoSaldo(p))}`
  );
  return [
    `Cuenta corriente - ${nombre}`,
    `Vendido: ${formatMoney(metrics.vendido)}`,
    `Cobrado: ${formatMoney(metrics.cobrado)}`,
    `Pendiente: ${formatMoney(metrics.pendiente)}`,
    `Saldo a favor: ${formatMoney(metrics.saldoFavor)}`,
    `Viandas: ${metrics.viandas}`,
    '',
    ...rows,
    pedidos.length > rows.length ? `... y ${pedidos.length - rows.length} pedidos más` : '',
  ].filter(Boolean).join('\n');
}

function imprimir(nombre, metrics, pedidos, pagos) {
  const rows = exportRows(pedidos, pagos).map(row => `
    <tr>
      <td>${row.Tipo}</td><td>${row.Fecha}</td><td>${row.Persona}</td><td>${row.Detalle}</td>
      <td>${formatMoney(row.Total)}</td><td>${formatMoney(row.Cobrado)}</td><td>${formatMoney(row.Saldo)}</td>
    </tr>
  `).join('');
  const w = window.open('', '_blank');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cuenta corriente</title>
    <style>body{font-family:Arial,sans-serif;margin:24px;font-size:12px;color:#111}h1{font-size:22px;margin:0 0 4px}.k{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.k div{border:1px solid #ddd;padding:8px}.k b{display:block;font-size:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:5px;text-align:left}th{background:#f3f4f6}</style>
  </head><body><h1>Cuenta corriente</h1><p>${nombre}</p><div class="k">
    <div>Vendido<b>${formatMoney(metrics.vendido)}</b></div><div>Cobrado<b>${formatMoney(metrics.cobrado)}</b></div>
    <div>Pendiente<b>${formatMoney(metrics.pendiente)}</b></div><div>Saldo a favor<b>${formatMoney(metrics.saldoFavor)}</b></div>
  </div><table><thead><tr><th>Tipo</th><th>Fecha</th><th>Persona</th><th>Detalle</th><th>Total</th><th>Cobrado</th><th>Saldo</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
  w.document.close();
  w.onload = () => {
    w.focus();
    w.print();
  };
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

function Table({ columns, rows, empty = 'Sin datos.' }) {
  return (
    <div className="overflow-x-auto border border-gray-200 bg-white">
      <table className="min-w-[860px] w-full border-collapse text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>{columns.map(col => <th key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''}`}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key || index} className="border-t border-gray-100">
              {columns.map(col => <td key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''}`}>{col.render ? col.render(row) : row[col.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="px-4 py-8 text-center text-sm text-gray-500">{empty}</p>}
    </div>
  );
}

function PagoForm({ tipo, sujetoId, nombre, periodo, grupal = false, onClose, onSaved }) {
  const registrarPago = useRegistrarPago();
  const [form, setForm] = useState({
    monto: '',
    fecha_pago: isoDate(new Date()),
    metodo_pago: 'transferencia',
    observacion: '',
    comprobante_url: '',
    numero_recibo: '',
  });
  const pagadorTipo = tipo === 'empresa' || grupal ? 'empresa' : 'empleado';
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    try {
      await registrarPago.mutateAsync({
        pagador_tipo: pagadorTipo,
        empresa_id: pagadorTipo === 'empresa' ? sujetoId : undefined,
        empleado_id: pagadorTipo === 'empleado' ? sujetoId : undefined,
        monto: toNumber(form.monto),
        fecha_pago: form.fecha_pago,
        metodo_pago: form.metodo_pago,
        periodo_desde: periodo.desde || undefined,
        periodo_hasta: periodo.hasta || undefined,
        observacion: form.observacion || undefined,
        comprobante_url: form.comprobante_url || undefined,
        numero_recibo: form.numero_recibo || undefined,
      });
      toast.success('Pago registrado');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'No se pudo registrar el pago');
    }
  }

  return (
    <Modal title={grupal ? 'Registrar pago grupal' : 'Registrar pago'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <p className="text-sm text-gray-500 md:col-span-2">Pagador: <strong>{pagadorTipo === 'empresa' ? 'empresa' : 'persona'}</strong> · {nombre}</p>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">Monto</span>
          <input required type="number" min="0" step="0.01" value={form.monto} onChange={e => set('monto', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">Fecha</span>
          <input required type="date" value={form.fecha_pago} onChange={e => set('fecha_pago', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">Metodo</span>
          <select value={form.metodo_pago} onChange={e => set('metodo_pago', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2">
            {METODOS_PAGO.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">Recibo interno</span>
          <input value={form.numero_recibo} onChange={e => set('numero_recibo', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-500">Comprobante URL</span>
          <input value={form.comprobante_url} onChange={e => set('comprobante_url', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-500">Observacion</span>
          <textarea value={form.observacion} onChange={e => set('observacion', e.target.value)} className="h-20 w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <div className="flex justify-end gap-2 md:col-span-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={registrarPago.isPending} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {registrarPago.isPending ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AsociarForm({ pedidos, pagos, onClose, onSaved }) {
  const aplicarPago = useAplicarPago();
  const pedidosPendientes = pedidos.filter(p => pedidoSaldo(p) > 0);
  const pagosConSaldo = pagos.filter(p => p.estado === 'activo' && toNumber(p.monto) > toNumber(p.monto_aplicado));
  const [form, setForm] = useState({
    pago_id: pagosConSaldo[0]?.id || '',
    pedido_id: pedidosPendientes[0]?.id || '',
    monto: pedidosPendientes[0] ? String(pedidoSaldo(pedidosPendientes[0])) : '',
  });
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    try {
      await aplicarPago.mutateAsync({
        id: form.pago_id,
        aplicaciones: [{ pedido_id: Number(form.pedido_id), monto_aplicado: toNumber(form.monto) }],
      });
      toast.success('Pago asociado');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'No se pudo asociar el pago');
    }
  }

  return (
    <Modal title="Asociar pago a pedido" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">Pago con saldo disponible</span>
          <select required value={form.pago_id} onChange={e => set('pago_id', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2">
            <option value="">Seleccionar pago</option>
            {pagosConSaldo.map(p => <option key={p.id} value={p.id}>#{p.id} · {formatDate(p.fecha_pago)} · disponible {formatMoney(toNumber(p.monto) - toNumber(p.monto_aplicado))}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">Pedido pendiente</span>
          <select required value={form.pedido_id} onChange={e => set('pedido_id', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2">
            <option value="">Seleccionar pedido</option>
            {pedidosPendientes.map(p => <option key={p.id} value={p.id}>#{p.id} · {formatDate(p.semana_inicio)} · {nombrePersona(p)} · saldo {formatMoney(pedidoSaldo(p))}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">Monto a aplicar</span>
          <input required type="number" min="0" step="0.01" value={form.monto} onChange={e => set('monto', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={aplicarPago.isPending} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {aplicarPago.isPending ? 'Aplicando...' : 'Asociar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DesasociarForm({ onClose, onSaved }) {
  const desasociar = useDesasociarAplicacionPago();
  const [form, setForm] = useState({ pagoId: '', aplicacionId: '' });
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    try {
      await desasociar.mutateAsync(form);
      toast.success('Aplicacion desasociada');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'No se pudo desasociar');
    }
  }

  return (
    <Modal title="Desasociar aplicacion" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <p className="text-sm text-gray-500">El contrato actual no lista IDs de aplicaciones en la cuenta; si tenes el ID, se puede desasociar con auditoria.</p>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">ID del pago</span>
          <input required value={form.pagoId} onChange={e => set('pagoId', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">ID de aplicacion</span>
          <input required value={form.aplicacionId} onChange={e => set('aplicacionId', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={desasociar.isPending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {desasociar.isPending ? 'Desasociando...' : 'Desasociar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ComprobanteForm({ pago, onClose, onSaved }) {
  const actualizarPago = useActualizarPago();
  const [url, setUrl] = useState(pago?.comprobante_url || '');

  async function submit(event) {
    event.preventDefault();
    try {
      await actualizarPago.mutateAsync({ id: pago.id, data: { comprobante_url: url || null } });
      toast.success('Comprobante actualizado');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el comprobante');
    }
  }

  return (
    <Modal title={`Comprobante pago #${pago.id}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">URL de comprobante</span>
          <input value={url} onChange={e => setUrl(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={actualizarPago.isPending} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {actualizarPago.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AplicacionesPagoModal({ pago, onClose, onDesasociar }) {
  const aplicaciones = pago?.aplicaciones || [];
  return (
    <Modal title={`Pedidos cubiertos por pago #${pago.id}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Total aplicado: <strong>{formatMoney(pago.monto_aplicado)}</strong> de {formatMoney(pago.monto)}.
        </p>
        <Table
          columns={[
            { key: 'id', label: 'Aplicacion', render: item => `#${item.id}` },
            { key: 'pedido_id', label: 'Pedido', render: item => `#${item.pedido_id}` },
            { key: 'semana_inicio', label: 'Fecha', render: item => formatDate(item.semana_inicio) },
            { key: 'persona', label: 'Persona', render: nombrePersona },
            { key: 'monto_aplicado', label: 'Monto', align: 'right', render: item => formatMoney(item.monto_aplicado) },
            {
              key: 'accion',
              label: 'Acción',
              render: item => (
                <button
                  type="button"
                  onClick={() => onDesasociar({ pagoId: pago.id, aplicacionId: item.id })}
                  className="text-red-600 underline"
                >
                  Desasociar
                </button>
              ),
            },
          ]}
          rows={aplicaciones}
          empty="Este pago no tiene aplicaciones."
        />
      </div>
    </Modal>
  );
}

function ResumenViandasModal({ nombre, periodo, pedidos, metrics, onClose }) {
  const [abiertos, setAbiertos] = useState(new Set());
  const rows = useMemo(() => buildResumenViandas(pedidos, nombre), [pedidos, nombre]);
  const totalViandas = rows.reduce((sum, row) => sum + row.cantidad, 0);
  const totalItems = rows.reduce((sum, row) => sum + row.total, 0);

  function toggle(key) {
    setAbiertos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function abrirTodo() {
    setAbiertos(new Set(rows.map(row => row.key)));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col bg-white shadow-xl md:rounded-lg">
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Resumen de viandas</p>
              <h3 className="text-lg font-bold text-gray-900">{nombre}</h3>
              <p className="text-sm text-gray-500">
                Periodo: {periodo.desde ? formatDate(periodo.desde) : 'inicio'} a {periodo.hasta ? formatDate(periodo.hasta) : 'hoy'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={abrirTodo} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">Abrir detalle</button>
              <button type="button" onClick={() => setAbiertos(new Set())} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">Cerrar detalle</button>
              <button
                type="button"
                onClick={() => exportarResumenViandas({ nombre, periodo, rows })}
                disabled={!rows.length}
                className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Exportar Excel
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">Cerrar</button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 overflow-hidden border border-gray-200 md:grid-cols-4">
            <Kpi label="Viandas" value={totalViandas} />
            <Kpi label="Total items" value={formatMoney(totalItems)} tone="green" />
            <Kpi label="Total cuenta" value={formatMoney(metrics.vendido)} />
            <Kpi label="Pendiente" value={formatMoney(metrics.pendiente)} tone="amber" />
          </div>
        </div>

        <div className="overflow-auto p-4">
          <div className="overflow-x-auto border border-gray-900 bg-white">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="w-[100px] border border-gray-900 px-2 py-1.5 text-left font-semibold text-gray-900">Fecha</th>
                  <th className="w-[150px] border border-gray-900 px-2 py-1.5 text-left font-semibold text-gray-900">Dia</th>
                  <th className="w-[170px] border border-gray-900 px-2 py-1.5 text-right font-semibold text-gray-900">Cantidad de viandas</th>
                  <th className="w-[130px] border border-gray-900 px-2 py-1.5 text-right font-semibold text-gray-900">Total</th>
                  <th className="border border-gray-900 px-2 py-1.5 text-left font-semibold text-gray-900">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const abierto = abiertos.has(row.key);
                  return (
                    <Fragment key={row.key}>
                      <tr className="bg-white hover:bg-brand-50">
                        <td className="border border-gray-900 px-2 py-1.5 tabular-nums">{formatDate(row.fecha)}</td>
                        <td className="border border-gray-900 px-2 py-1.5 font-medium">{DIAS_NOMBRE[row.dia] || row.dia}</td>
                        <td className="border border-gray-900 px-2 py-1.5 text-right font-semibold tabular-nums">
                          <button type="button" onClick={() => toggle(row.key)} className="inline-flex min-h-8 min-w-[72px] items-center justify-end gap-2 rounded px-2 text-right">
                            {row.cantidad}
                            <span className={`text-gray-500 transition-transform ${abierto ? 'rotate-180' : ''}`}>v</span>
                          </button>
                        </td>
                        <td className="border border-gray-900 px-2 py-1.5 text-right font-semibold">{formatMoney(row.total)}</td>
                        <td className="border border-gray-900 px-2 py-1.5 text-gray-800">{row.observaciones}</td>
                      </tr>
                      {abierto && (
                        <tr key={`${row.key}-detalle`} className="bg-gray-50">
                          <td colSpan={5} className="border border-gray-900 p-0">
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[980px] border-collapse text-xs">
                                <thead>
                                  <tr className="bg-gray-100 text-gray-600">
                                    <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold">Empleado</th>
                                    <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold">Plan</th>
                                    <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold">Plato</th>
                                    <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold">Guarnicion</th>
                                    <th className="border-b border-gray-300 px-3 py-2 text-right font-semibold">Precio</th>
                                    <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold">Observaciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...row.detalles]
                                    .sort((a, b) => nombrePersona(a.pedido).localeCompare(nombrePersona(b.pedido)))
                                    .map(({ pedido, item }) => (
                                      <tr key={`${pedido.id}-${item.id}`} className="bg-white even:bg-gray-50">
                                        <td className="border-b border-gray-200 px-3 py-2 font-medium text-gray-900">{nombrePersona(pedido)}</td>
                                        <td className="border-b border-gray-200 px-3 py-2 text-gray-700">
                                          <span className="block font-medium">{nombrePlan(pedido)}</span>
                                          <span className="text-[11px] text-gray-500">{detallePlan(pedido)}</span>
                                        </td>
                                        <td className="border-b border-gray-200 px-3 py-2 text-gray-800">
                                          {item.plato_nombre || '-'}
                                          {item.opcion && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">Op. {item.opcion}</span>}
                                        </td>
                                        <td className="border-b border-gray-200 px-3 py-2 text-gray-700">{item.guarnicion_nombre || ''}</td>
                                        <td className="border-b border-gray-200 px-3 py-2 text-right font-medium">{formatMoney(item.precio_unitario)}</td>
                                        <td className="border-b border-gray-200 px-3 py-2 text-amber-700">{observacionItem(pedido, item)}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && <p className="px-4 py-10 text-center text-sm text-gray-500">Sin viandas con detalle en el periodo seleccionado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <div className="flex h-full w-full flex-col overflow-y-auto bg-white p-4 shadow-xl md:h-auto md:max-h-[90vh] md:max-w-xl md:rounded-lg">
        <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-600">Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CuentaCorrienteFicha({ tipo, id, nombre, onClose }) {
  const [periodoTipo, setPeriodoTipo] = useState('mensual');
  const [draftPeriod, setDraftPeriod] = useState(defaultPeriod('mensual'));
  const [periodo, setPeriodo] = useState(defaultPeriod('mensual'));
  const [tab, setTab] = useState('Resumen');
  const [modal, setModal] = useState(null);

  const cuentaEmpresa = useCuentaCorrienteEmpresa(tipo === 'empresa' ? id : null);
  const cuentaEmpleado = useCuentaCorrienteEmpleado(tipo === 'empleado' ? id : null);
  const desasociar = useDesasociarAplicacionPago();
  const query = tipo === 'empresa' ? cuentaEmpresa : cuentaEmpleado;
  const data = query.data;
  const pedidos = useMemo(() => (data?.pedidos || []).filter(p => inPeriod(p, periodo.desde, periodo.hasta)), [data, periodo]);
  const pagos = useMemo(() => (data?.pagos || []).filter(p => inPeriod(p, periodo.desde, periodo.hasta)), [data, periodo]);
  const ajustes = useMemo(() => (data?.ajustes || []).filter(a => inPeriod(a, periodo.desde, periodo.hasta)), [data, periodo]);
  const tabs = tipo === 'empresa' ? TABS_EMPRESA : TABS_PERSONA;

  const metrics = useMemo(() => {
    const vendido = pedidos.reduce((sum, p) => sum + pedidoTotal(p), 0);
    const cobrado = pedidos.reduce((sum, p) => sum + pedidoPagado(p), 0);
    const pendiente = pedidos.reduce((sum, p) => sum + Math.max(pedidoSaldo(p), 0), 0);
    const saldoPedidosFavor = pedidos.reduce((sum, p) => sum + Math.max(-pedidoSaldo(p), 0), 0);
    const pagosSinAplicar = pagos.filter(p => p.estado === 'activo').reduce((sum, p) => sum + Math.max(toNumber(p.monto) - toNumber(p.monto_aplicado), 0), 0);
    const ajustesTotal = ajustes.reduce((sum, a) => sum + toNumber(a.monto), 0);
    const ultimoPago = [...pagos].sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)))[0] || null;
    return {
      vendido,
      cobrado,
      pendiente,
      saldoFavor: saldoPedidosFavor + pagosSinAplicar,
      ajustesTotal,
      viandas: pedidos.reduce((sum, pedido) => {
        const cantidad = toNumber(pedido.cantidad_viandas ?? pedido.items?.filter(item => !item.sin_pedido).length);
        return sum + (cantidad || 0);
      }, 0),
      ultimoPago,
      estado: estadoGeneral({ pendiente, saldoFavor: saldoPedidosFavor + pagosSinAplicar }),
    };
  }, [pedidos, pagos, ajustes]);

  const empleados = useMemo(() => {
    const map = new Map();
    for (const pedido of pedidos) {
      const key = pedido.empleado_id || nombrePersona(pedido);
      const item = map.get(key) || { key, nombre: nombrePersona(pedido), vendido: 0, cobrado: 0, pendiente: 0, viandas: 0 };
      item.vendido += pedidoTotal(pedido);
      item.cobrado += pedidoPagado(pedido);
      item.pendiente += Math.max(pedidoSaldo(pedido), 0);
      item.viandas += 1;
      map.set(key, item);
    }
    return [...map.values()].sort((a, b) => b.pendiente - a.pendiente || a.nombre.localeCompare(b.nombre));
  }, [pedidos]);

  function onPeriodoTipoChange(value) {
    setPeriodoTipo(value);
    if (value !== 'personalizado') setDraftPeriod(defaultPeriod(value));
  }

  function sacarCuenta() {
    setPeriodo(draftPeriod);
    toast.success('Cuenta recalculada');
  }

  function exportarExcel() {
    const rows = exportRows(pedidos, pagos);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cuenta corriente');
    XLSX.writeFile(wb, `cuenta-corriente-${tipo}-${id}.xlsx`);
  }

  function exportarCsv() {
    download(`cuenta-corriente-${tipo}-${id}.csv`, csv(exportRows(pedidos, pagos)), 'text/csv;charset=utf-8');
  }

  async function copiarWhatsApp() {
    await navigator.clipboard.writeText(textoWhatsApp({ nombre, metrics, pedidos }));
    toast.success('Resumen copiado');
  }

  const refresh = () => query.refetch();

  async function desasociarAplicacion({ pagoId, aplicacionId }) {
    try {
      await desasociar.mutateAsync({ pagoId, aplicacionId });
      toast.success('Aplicacion desasociada');
      await refresh();
      setModal(null);
    } catch (error) {
      toast.error(error.message || 'No se pudo desasociar');
    }
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (modal) {
        setModal(null);
        return;
      }
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modal, onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Cuenta corriente de ${nombre}`}
        className="fixed inset-0 z-[60] flex flex-col bg-white shadow-2xl md:left-auto md:right-0 md:w-[min(1180px,94vw)] md:border-l md:border-gray-200"
      >
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cuenta corriente {tipo === 'empresa' ? 'empresa' : 'persona'}</p>
            <h2 className="text-xl font-bold text-gray-900">{nombre}</h2>
            <p className="text-sm text-gray-500">Periodo: {periodo.desde ? formatDate(periodo.desde) : 'inicio'} a {periodo.hasta ? formatDate(periodo.hasta) : 'hoy'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setModal('pago')} className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white">Registrar pago</button>
            {tipo === 'empresa' && <button type="button" onClick={() => setModal('pago-grupal')} className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">Pago grupal</button>}
            <button type="button" onClick={() => setModal('resumen-viandas')} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">Resumen viandas</button>
            <button type="button" onClick={exportarExcel} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">Excel</button>
            <button type="button" onClick={exportarCsv} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">CSV</button>
            <button type="button" onClick={() => imprimir(nombre, metrics, pedidos, pagos)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">PDF</button>
            <button type="button" onClick={copiarWhatsApp} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">WhatsApp</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm">Cerrar</button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[160px_1fr_1fr_auto]">
          <select value={periodoTipo} onChange={e => onPeriodoTipoChange(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="diario">Diario</option>
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
            <option value="mensual">Mensual</option>
            <option value="personalizado">Personalizado</option>
          </select>
          <input type="date" value={draftPeriod.desde} onChange={e => setDraftPeriod(p => ({ ...p, desde: e.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <input type="date" value={draftPeriod.hasta} onChange={e => setDraftPeriod(p => ({ ...p, hasta: e.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <button type="button" onClick={sacarCuenta} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Sacar cuenta</button>
        </div>

        <div className="mt-3 flex gap-1 overflow-x-auto">
          {tabs.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${tab === item ? 'bg-brand-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.isLoading ? (
          <div className="p-6 text-sm text-gray-500">Cargando cuenta corriente...</div>
        ) : (
          <div className="space-y-4 p-4">
          {tab === 'Resumen' && (
            <>
              <div className="grid grid-cols-2 overflow-hidden border border-gray-200 lg:grid-cols-4 xl:grid-cols-8">
                <Kpi label="Total vendido" value={formatMoney(metrics.vendido)} />
                <Kpi label="Total cobrado" value={formatMoney(metrics.cobrado)} tone="green" />
                <Kpi label="Saldo pendiente" value={formatMoney(metrics.pendiente)} tone="amber" />
                <Kpi label="Saldo a favor" value={formatMoney(metrics.saldoFavor)} tone="blue" />
                <Kpi label="Viandas periodo" value={metrics.viandas} />
                <Kpi label="Último pago" value={metrics.ultimoPago ? formatDate(metrics.ultimoPago.fecha_pago) : '-'} />
                <Kpi label="Prox. vencimiento" value="Sin config." />
                <Kpi label="Estado" value={metrics.estado} tone={metrics.estado === 'deuda' ? 'amber' : 'green'} />
              </div>
              <section className="border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-bold text-gray-900">Lectura de cuenta</h3>
                <p className="mt-2 text-sm text-gray-600">
                  El saldo financiero se calcula desde pedidos.importe_total, pedidos.importe_pagado y pagos activos aplicados. El estado operativo del pedido no se usa como estado de pago.
                </p>
                {tipo === 'empresa' && (
                  <p className="mt-2 text-sm text-gray-600">
                    Si una persona paga por cuenta propia, el pedido aparece con su cobro aplicado; el pago individual se consulta desde la cuenta corriente de esa persona.
                  </p>
                )}
              </section>
            </>
          )}

          {tab === 'Pedidos' && (
            <Table
              columns={[
                { key: 'id', label: 'Pedido', render: p => `#${p.id}` },
                { key: 'semana_inicio', label: 'Fecha', render: p => formatDate(p.semana_inicio) },
                { key: 'persona', label: 'Persona', render: nombrePersona },
                { key: 'estado', label: 'Estado pedido' },
                { key: 'estado_financiero', label: 'Estado pago' },
                { key: 'total', label: 'Total', align: 'right', render: p => formatMoney(pedidoTotal(p)) },
                { key: 'pagado', label: 'Pagado', align: 'right', render: p => formatMoney(pedidoPagado(p)) },
                { key: 'saldo', label: 'Saldo', align: 'right', render: p => formatMoney(pedidoSaldo(p)) },
              ]}
              rows={pedidos}
              empty="Sin pedidos en el periodo."
            />
          )}

          {tab === 'Empleados' && tipo === 'empresa' && (
            <Table
              columns={[
                { key: 'nombre', label: 'Empleado' },
                { key: 'viandas', label: 'Viandas', align: 'right' },
                { key: 'vendido', label: 'Vendido', align: 'right', render: row => formatMoney(row.vendido) },
                { key: 'cobrado', label: 'Cobrado', align: 'right', render: row => formatMoney(row.cobrado) },
                { key: 'pendiente', label: 'Pendiente', align: 'right', render: row => formatMoney(row.pendiente) },
              ]}
              rows={empleados}
              empty="Sin empleados con pedidos en el periodo."
            />
          )}

          {tab === 'Pagos' && (
            <section className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setModal('asociar')} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium">Asociar pago a pedido</button>
                <button type="button" onClick={() => setModal('desasociar')} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium">Desasociar aplicacion</button>
              </div>
              <Table
                columns={[
                  { key: 'id', label: 'Pago', render: p => `#${p.id}` },
                  { key: 'fecha_pago', label: 'Fecha', render: p => formatDate(p.fecha_pago) },
                  { key: 'pagador_tipo', label: 'Pagador', render: p => p.pagador_tipo === 'empresa' ? 'Empresa' : 'Persona' },
                  { key: 'metodo_pago', label: 'Metodo' },
                  { key: 'monto', label: 'Monto', align: 'right', render: p => formatMoney(p.monto) },
                  { key: 'monto_aplicado', label: 'Aplicado', align: 'right', render: p => formatMoney(p.monto_aplicado) },
                  { key: 'saldo', label: 'Saldo pago', align: 'right', render: p => formatMoney(Math.max(toNumber(p.monto) - toNumber(p.monto_aplicado), 0)) },
                  { key: 'pedidos', label: 'Pedidos cubiertos', render: p => p.aplicaciones?.length ? (
                    <button type="button" onClick={() => setModal({ tipo: 'aplicaciones', pago: p })} className="text-brand-700 underline">
                      {p.aplicaciones.length} aplic.
                    </button>
                  ) : 'Sin aplicaciones' },
                  { key: 'comprobante', label: 'Comprobante', render: p => (
                    <button type="button" onClick={() => setModal({ tipo: 'comprobante', pago: p })} className="text-brand-700 underline">
                      {p.comprobante_url ? 'Ver/editar' : 'Adjuntar'}
                    </button>
                  ) },
                ]}
                rows={pagos}
                empty="Sin pagos en el periodo."
              />
            </section>
          )}

          {tab === 'Deuda' && (
            <Table
              columns={[
                { key: 'id', label: 'Pedido', render: p => `#${p.id}` },
                { key: 'semana_inicio', label: 'Fecha', render: p => formatDate(p.semana_inicio) },
                { key: 'persona', label: 'Persona', render: nombrePersona },
                { key: 'total', label: 'Total', align: 'right', render: p => formatMoney(pedidoTotal(p)) },
                { key: 'pagado', label: 'Pagado', align: 'right', render: p => formatMoney(pedidoPagado(p)) },
                { key: 'saldo', label: 'Saldo pendiente', align: 'right', render: p => formatMoney(pedidoSaldo(p)) },
              ]}
              rows={pedidos.filter(p => pedidoSaldo(p) > 0)}
              empty="Sin deuda pendiente en el periodo."
            />
          )}

          {tab === 'Comprobantes' && (
            <Table
              columns={[
                { key: 'id', label: 'Pago', render: p => `#${p.id}` },
                { key: 'fecha_pago', label: 'Fecha', render: p => formatDate(p.fecha_pago) },
                { key: 'monto', label: 'Monto', align: 'right', render: p => formatMoney(p.monto) },
                { key: 'comprobante_url', label: 'Comprobante', render: p => p.comprobante_url ? <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="text-brand-700 underline">Abrir</a> : '-' },
                { key: 'accion', label: 'Accion', render: p => <button type="button" onClick={() => setModal({ tipo: 'comprobante', pago: p })} className="text-brand-700 underline">Editar</button> },
              ]}
              rows={pagos}
              empty="Sin comprobantes en el periodo."
            />
          )}

          {tab === 'Configuracion de cobro' && (
            <section className="grid min-h-[220px] place-items-center border border-dashed border-gray-200 bg-white p-6 text-center">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Configuracion de cobro</h3>
                <p className="mt-2 max-w-md text-sm text-gray-500">
                  La configuracion de cobro estara disponible proximamente.
                </p>
              </div>
            </section>
          )}
          </div>
        )}
      </div>

      {modal === 'pago' && <PagoForm tipo={tipo} sujetoId={id} nombre={nombre} periodo={periodo} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal === 'pago-grupal' && <PagoForm tipo="empresa" sujetoId={id} nombre={nombre} periodo={periodo} grupal onClose={() => setModal(null)} onSaved={refresh} />}
      {modal === 'asociar' && <AsociarForm pedidos={pedidos} pagos={pagos} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal === 'desasociar' && <DesasociarForm onClose={() => setModal(null)} onSaved={refresh} />}
      {modal === 'resumen-viandas' && <ResumenViandasModal nombre={nombre} periodo={periodo} pedidos={pedidos} metrics={metrics} onClose={() => setModal(null)} />}
      {modal?.tipo === 'comprobante' && <ComprobanteForm pago={modal.pago} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.tipo === 'aplicaciones' && <AplicacionesPagoModal pago={modal.pago} onClose={() => setModal(null)} onDesasociar={desasociarAplicacion} />}
      </aside>
    </>
  );
}
