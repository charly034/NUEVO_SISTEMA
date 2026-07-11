import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Download,
  FileText,
  Receipt,
  RefreshCw,
  Trash2,
  UserRound,
  XCircle,
} from 'lucide-react';
import { apiGet, apiDelete } from '../services/apiCliente.js';
import { finanzasApi } from '../services/api.js';
import { confirmar, toast } from '../lib/swal.js';
import { unirClases } from '../compartido/utils/clases.js';
import { DIA_ABREV as DIAS_LABEL } from '../utils/dias.js';

const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIA_OFFSET = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };

const ESTADO_CFG = {
  confirmado:   { label: 'Confirmado',   Icon: CheckCircle2, color: '#1B7B5E', bg: '#E6F6F0' },
  pendiente:    { label: 'Pendiente',    Icon: Clock,        color: '#C8782A', bg: '#FEF3E8' },
  en_proceso:   { label: 'Pendiente',    Icon: Clock,        color: '#C8782A', bg: '#FEF3E8' },
  completo:      { label: 'Completo',     Icon: CheckCircle2, color: '#1B7B5E', bg: '#E6F6F0' },
  listo:         { label: 'Listo',        Icon: CheckCircle2, color: '#1B7B5E', bg: '#E6F6F0' },
  entregado:     { label: 'Entregado',    Icon: CheckCircle2, color: '#1B7B5E', bg: '#E6F6F0' },
  fuera_de_plazo:{ label: 'Fuera de plazo', Icon: XCircle,    color: '#9A9885', bg: '#F0EDE6' },
  cancelado:    { label: 'Cancelado',    Icon: XCircle,      color: '#C83030', bg: '#FEF0EE' },
  borrador:     { label: 'Borrador',     Icon: Clock,        color: '#C8782A', bg: '#FEF3E8' },
};

const ESTADO_FINANCIERO_CFG = {
  pendiente: { label: 'Pendiente', color: '#C8782A', bg: '#FEF3E8' },
  parcial: { label: 'Parcial', color: '#7A5C12', bg: '#FFF7D7' },
  pagado: { label: 'Pagado', color: '#1B7B5E', bg: '#E6F6F0' },
  saldo_a_favor: { label: 'Saldo a favor', color: '#4A6EA9', bg: '#EAF1FF' },
};

const ESTADOS_CANCELABLES = new Set(['pendiente', 'en_proceso']);

function fechaLocalDesdeISO(fechaISO) {
  const [anio, mes, dia] = String(fechaISO || '').split('-').map(Number);
  if (!anio || !mes || !dia) return null;
  return new Date(anio, mes - 1, dia);
}

function fechaDiaPedido(semanaInicio, dia) {
  const inicio = fechaLocalDesdeISO(semanaInicio);
  if (!inicio || !(dia in DIA_OFFSET)) return null;
  const fecha = new Date(inicio);
  fecha.setDate(inicio.getDate() + DIA_OFFSET[dia]);
  fecha.setHours(23, 59, 59, 999);
  return fecha;
}

function puedeCancelarItem(pedido, item, semanaInicio) {
  if (!pedido?.id || !ESTADOS_CANCELABLES.has(pedido.estado) || item?.sin_pedido) return false;
  if (typeof item?.puede_cancelar === 'boolean') return item.puede_cancelar;
  const fechaDia = fechaDiaPedido(semanaInicio, item?.dia || item?.diaId || item?.clave);
  return fechaDia ? fechaDia >= new Date() : false;
}

function toNumber(value) {
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatFecha(fecha) {
  if (!fecha) return '-';
  const [year, month, day] = String(fecha).split('T')[0].split('-');
  if (!year || !month || !day) return '-';
  return `${day}/${month}/${year}`;
}

function rangoSemana(fechaISO) {
  if (!fechaISO) return '';
  const [y, m, d] = String(fechaISO).split('T')[0].split('-').map(Number);
  const lunes = new Date(y, m - 1, d);
  const viernes = new Date(y, m - 1, d + 4);
  const ml = meses[lunes.getMonth()];
  const mv = meses[viernes.getMonth()];
  const ini = ml === mv ? lunes.getDate() : `${lunes.getDate()} ${ml}`;
  return `${ini} - ${viernes.getDate()} ${mv}`;
}

function estadoCfg(estado) {
  return ESTADO_CFG[estado] || { label: estado || 'Confirmado', Icon: CheckCircle2, color: '#1B7B5E', bg: '#E6F6F0' };
}

function estadoFinancieroCfg(estado) {
  return ESTADO_FINANCIERO_CFG[estado] || ESTADO_FINANCIERO_CFG.pendiente;
}

function nombrePersona(pedido) {
  return [pedido.empleado_nombre, pedido.empleado_apellido].filter(Boolean).join(' ') || 'Persona';
}

function csvValue(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function descargarCsv(nombreArchivo, filas) {
  const csv = filas.map((fila) => fila.map(csvValue).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Tabs({ activo, onChange }) {
  const tabs = [
    { id: 'pedidos', label: 'Pedidos', Icon: FileText },
    { id: 'cuenta', label: 'Cuenta', Icon: CreditCard },
  ];
  return (
    <div className="mx-4 -mt-4 grid grid-cols-2 rounded-2xl border border-[#E8E5DC] bg-white p-1 shadow-sm">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={unirClases(
            'flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition',
            activo === id ? 'bg-[#EDF0E4] text-[#5B6B2A]' : 'text-[#6E6B64]',
          )}
        >
          <Icon size={15} />
          {label}
        </button>
      ))}
    </div>
  );
}

function FilaPedido({ cancelando, cancelandoDia, pedido, onCancelarDia, onEliminar }) {
  const [abierto, setAbierto] = useState(false);
  const cfg = estadoCfg(pedido.estado);
  const Icon = cfg.Icon;
  const items = pedido.items || pedido.dias || [];
  const semanaInicio = String(pedido.semana_inicio || pedido.semanaId || '').split('T')[0];
  const itemsCancelables = items.filter((item) => puedeCancelarItem(pedido, item, semanaInicio));
  const puedeCancelar = Boolean(pedido.id && semanaInicio && itemsCancelables.length > 0);
  const itemsActivos = items.filter((item) => !item.sin_pedido);
  const textoCancelarSemana = itemsActivos.length === itemsCancelables.length ? 'Cancelar pedido' : 'Cancelar dias pendientes';

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8E5DC] bg-white">
      <button
        onClick={() => setAbierto((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-4"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: cfg.bg }}
        >
          <Icon size={18} style={{ color: cfg.color }} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-bold text-[#2A2C1F]">{rangoSemana(pedido.semana_inicio || pedido.semanaId)}</p>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#6E6B64]">{items.length} dias</span>
          {abierto ? <ChevronUp size={16} className="text-[#6E6B64]" /> : <ChevronDown size={16} className="text-[#6E6B64]" />}
        </div>
      </button>

      {abierto && (
        <div className="space-y-1 border-t border-[#F0EDE6] px-4 pt-3 pb-4">
          {items.length === 0 && (
            <p className="py-2 text-sm text-[#6E6B64]">Sin dias registrados.</p>
          )}
          {items.map((item, index) => {
            const dia = item.dia || item.diaId || item.clave;
            const platoNombre = item.plato_nombre || item.plato?.nombre || item.nombre || '-';
            const sinVianda = item.sin_pedido;
            const puedeCancelarDia = puedeCancelarItem(pedido, item, semanaInicio);
            const diaKey = `${pedido.id}:${dia}`;
            return (
              <div key={`${dia || 'dia'}-${index}`} className="flex items-center gap-3 border-b border-[#F5F3EE] py-2 last:border-0">
                <span className="w-8 text-xs font-bold text-[#6E6B64]">{DIAS_LABEL[dia] || dia}</span>
                <p className={unirClases('flex-1 text-sm', sinVianda ? 'text-[#6E6B64] italic' : 'text-[#2A2C1F]')}>
                  {sinVianda ? 'Sin vianda' : platoNombre}
                </p>
                {puedeCancelarDia && (
                  <button
                    type="button"
                    onClick={() => onCancelarDia(pedido, dia)}
                    disabled={cancelandoDia === diaKey}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-[#FEF0EE] px-2 py-1 text-[11px] font-bold text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={12} /> {cancelandoDia === diaKey ? 'Cancelando' : 'Cancelar'}
                  </button>
                )}
              </div>
            );
          })}

          {puedeCancelar && (
            <button
              type="button"
              onClick={() => onEliminar(pedido)}
              disabled={cancelando}
              className="mt-3 flex items-center gap-1.5 text-xs font-bold text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={13} /> {cancelando ? 'Cancelando...' : textoCancelarSemana}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Metrica({ label, value, Icon, tone = 'verde' }) {
  const tonos = {
    verde: 'bg-[#EDF0E4] text-[#5B6B2A]',
    ambar: 'bg-[#FEF3E8] text-[#C8782A]',
    azul: 'bg-[#EAF1FF] text-[#4A6EA9]',
  };

  return (
    <div className="rounded-2xl border border-[#E8E5DC] bg-white p-3">
      <div className={unirClases('mb-2 flex h-8 w-8 items-center justify-center rounded-xl', tonos[tone])}>
        <Icon size={16} />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#6E6B64]">{label}</p>
      <p className="mt-1 text-base font-black text-[#2A2C1F]">{value}</p>
    </div>
  );
}

function BadgeFinanciero({ estado }) {
  const cfg = estadoFinancieroCfg(estado);
  return (
    <span
      className="inline-flex rounded-full px-2 py-1 text-[11px] font-black"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function PedidoFinanciero({ pedido, empresa }) {
  const principal = pedido.items?.find((item) => !item.sin_pedido)?.plato_nombre || 'Pedido semanal';
  return (
    <div className="rounded-2xl border border-[#E8E5DC] bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF0E4] text-[#5B6B2A]">
          {empresa ? <Building2 size={17} /> : <UserRound size={17} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-[#2A2C1F]">{rangoSemana(pedido.semana_inicio)}</p>
            <BadgeFinanciero estado={pedido.estado_financiero} />
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-[#6F725F]">
            {empresa ? nombrePersona(pedido) : principal}
          </p>
          {empresa && (
            <p className="mt-0.5 truncate text-xs text-[#6E6B64]">{principal}</p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="font-bold text-[#6E6B64]">Total</p>
              <p className="font-black text-[#2A2C1F]">{formatMoney(pedido.importe_total)}</p>
            </div>
            <div>
              <p className="font-bold text-[#6E6B64]">Pagado</p>
              <p className="font-black text-[#1B7B5E]">{formatMoney(pedido.importe_pagado)}</p>
            </div>
            <div>
              <p className="font-bold text-[#6E6B64]">Saldo</p>
              <p className="font-black text-[#C8782A]">{formatMoney(Math.max(0, toNumber(pedido.saldo)))}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#F5F3EE] px-2 py-1 text-[11px] font-bold text-[#6F725F]">
              {pedido.cantidad_viandas || 0} viandas
            </span>
            {pedido.pagado_por_empresa && (
              <span className="rounded-full bg-[#E6F6F0] px-2 py-1 text-[11px] font-bold text-[#1B7B5E]">
                Pagado por empresa
              </span>
            )}
            {pedido.pagado_por_empleado && empresa && (
              <span className="rounded-full bg-[#EAF1FF] px-2 py-1 text-[11px] font-bold text-[#4A6EA9]">
                Pago propio
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PagoItem({ pago }) {
  const saldo = Math.max(0, toNumber(pago.monto) - toNumber(pago.monto_aplicado));
  return (
    <div className="rounded-2xl border border-[#E8E5DC] bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E6F6F0] text-[#1B7B5E]">
          <Receipt size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#2A2C1F]">{formatMoney(pago.monto)}</p>
              <p className="mt-0.5 text-xs font-semibold text-[#6F725F]">{pago.metodo_pago || 'Pago'} - {formatFecha(pago.fecha_pago)}</p>
            </div>
            {pago.comprobante_url && (
              <a
                href={pago.comprobante_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#F5F3EE] px-2 py-1 text-[11px] font-black text-[#5B6B2A]"
              >
                Ver
              </a>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="font-bold text-[#6E6B64]">Aplicado</p>
              <p className="font-black text-[#1B7B5E]">{formatMoney(pago.monto_aplicado)}</p>
            </div>
            <div>
              <p className="font-bold text-[#6E6B64]">Sin aplicar</p>
              <p className="font-black text-[#4A6EA9]">{formatMoney(saldo)}</p>
            </div>
          </div>
          {pago.aplicaciones?.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-[#F0EDE6] pt-2">
              {pago.aplicaciones.slice(0, 4).map((aplicacion) => (
                <p key={aplicacion.id} className="text-xs text-[#6F725F]">
                  {formatMoney(aplicacion.monto_aplicado)} - semana {formatFecha(aplicacion.semana_inicio)}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CuentaFinanciera({ cuenta, loading, error, onRetry }) {
  const esEmpresa = cuenta?.alcance === 'empresa';
  const pedidos = cuenta?.pedidos || [];
  const pagos = cuenta?.pagos || [];
  const totales = cuenta?.totales || {};
  const saldo = toNumber(totales.saldo);
  const saldoPendiente = Math.max(0, saldo);
  const saldoAFavor = Math.max(0, -saldo);
  const viandas = pedidos.reduce((sum, pedido) => sum + toNumber(pedido.cantidad_viandas), 0);
  const pagosConComprobante = pagos.filter((pago) => pago.comprobante_url);

  const descargarResumen = () => {
    const encabezado = ['tipo', 'fecha', 'persona', 'total', 'pagado', 'saldo', 'estado_financiero'];
    const filas = pedidos.map((pedido) => [
      'pedido',
      formatFecha(pedido.semana_inicio),
      nombrePersona(pedido),
      pedido.importe_total,
      pedido.importe_pagado,
      pedido.saldo,
      pedido.estado_financiero,
    ]);
    const filasPagos = pagos.map((pago) => [
      'pago',
      formatFecha(pago.fecha_pago),
      pago.pagador_tipo,
      pago.monto,
      pago.monto_aplicado,
      Math.max(0, toNumber(pago.monto) - toNumber(pago.monto_aplicado)),
      pago.metodo_pago,
    ]);
    descargarCsv(`la-quinta-cuenta-${cuenta.alcance}.csv`, [encabezado, ...filas, ...filasPagos]);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl border border-[#E8E5DC] bg-white" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
        <p className="flex-1 text-sm text-red-700">No pudimos cargar la cuenta.</p>
        <button type="button" onClick={onRetry} className="text-red-500">
          <RefreshCw size={16} />
        </button>
      </div>
    );
  }

  if (!cuenta) return null;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3">
        <Metrica label="Vendido" value={formatMoney(totales.total_pedidos)} Icon={FileText} />
        <Metrica label="Cobrado" value={formatMoney(totales.total_pagos)} Icon={Receipt} />
        <Metrica label="Pendiente" value={formatMoney(saldoPendiente)} Icon={Clock} tone="ambar" />
        <Metrica label="Viandas" value={viandas} Icon={CheckCircle2} tone="azul" />
      </section>

      {saldoAFavor > 0 && (
        <div className="rounded-2xl border border-[#CFE0FF] bg-[#EAF1FF] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#4A6EA9]">Saldo a favor</p>
          <p className="mt-1 text-lg font-black text-[#2A2C1F]">{formatMoney(saldoAFavor)}</p>
        </div>
      )}

      <button
        type="button"
        onClick={descargarResumen}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#5B6B2A] px-4 text-sm font-black text-white"
      >
        <Download size={16} />
        Descargar resumen
      </button>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[#2A2C1F]">{esEmpresa ? 'Pedidos de empleados' : 'Mis pedidos'}</h2>
          <span className="text-xs font-bold text-[#6E6B64]">{pedidos.length}</span>
        </div>
        {pedidos.length === 0 ? (
          <p className="rounded-2xl border border-[#E8E5DC] bg-white px-4 py-5 text-center text-sm font-semibold text-[#6E6B64]">
            Sin pedidos con datos financieros.
          </p>
        ) : (
          pedidos.map((pedido) => (
            <PedidoFinanciero key={pedido.id} pedido={pedido} empresa={esEmpresa} />
          ))
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[#2A2C1F]">{esEmpresa ? 'Pagos de empresa' : 'Mis pagos'}</h2>
          <span className="text-xs font-bold text-[#6E6B64]">{pagos.length}</span>
        </div>
        {pagos.length === 0 ? (
          <p className="rounded-2xl border border-[#E8E5DC] bg-white px-4 py-5 text-center text-sm font-semibold text-[#6E6B64]">
            Todavia no hay pagos registrados.
          </p>
        ) : (
          pagos.map((pago) => <PagoItem key={pago.id} pago={pago} />)
        )}
      </section>

      {esEmpresa && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#2A2C1F]">Comprobantes</h2>
            <span className="text-xs font-bold text-[#6E6B64]">{pagosConComprobante.length}</span>
          </div>
          {pagosConComprobante.length === 0 ? (
            <p className="rounded-2xl border border-[#E8E5DC] bg-white px-4 py-5 text-center text-sm font-semibold text-[#6E6B64]">
              Sin comprobantes cargados.
            </p>
          ) : (
            pagosConComprobante.map((pago) => <PagoItem key={`comprobante-${pago.id}`} pago={pago} />)
          )}
        </section>
      )}
    </div>
  );
}

export default function HistorialPage({ empleado }) {
  const queryClient = useQueryClient();
  const [tabActiva, setTabActiva] = useState('pedidos');
  const userId = empleado?.id || empleado?.usuarioId;
  const empresaId = empleado?.empresa?.id || empleado?.empresaId || empleado?.empresa_id;

  const { data: pedidos = [], isLoading, error, refetch } = useQuery({
    queryKey: ['mi-historial', userId],
    queryFn: () => apiGet('/pedidos/mi-historial'),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: cuentaFinanciera,
    isLoading: cargandoFinanzas,
    error: errorFinanzas,
    refetch: refetchFinanzas,
  } = useQuery({
    queryKey: ['mi-historial-financiero', userId, empresaId],
    queryFn: finanzasApi.miHistorial,
    staleTime: 5 * 60 * 1000,
  });

  const cantidadPedidos = useMemo(() => pedidos.length, [pedidos]);

  async function invalidarHistorial() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['mi-historial', userId] }),
      queryClient.invalidateQueries({ queryKey: ['mi-historial-financiero', userId, empresaId] }),
      queryClient.invalidateQueries({ queryKey: ['pedido-semanal', userId] }),
      empresaId
        ? queryClient.invalidateQueries({ queryKey: ['pedido-semanal', userId, empresaId] })
        : Promise.resolve(),
    ]);
  }

  const eliminar = useMutation({
    mutationFn: (semanaInicio) => apiDelete(
      `/pedidos/mi-pedido?semana_inicio=${encodeURIComponent(semanaInicio)}`,
      { requiereAuth: true },
    ),
    onSuccess: async (pedidoCancelado) => {
      const parcial = pedidoCancelado?.cancelacion?.completa === false;
      toast.success(parcial ? 'Dias pendientes cancelados' : 'Pedido cancelado');
      await invalidarHistorial();
    },
    onError: (err) => toast.error(err?.message || 'No se pudo cancelar'),
  });

  const cancelarDia = useMutation({
    mutationFn: ({ pedidoId, dia }) => apiDelete(
      `/pedidos/${pedidoId}/dias/${dia}`,
      { requiereAuth: true },
    ),
    onSuccess: async () => {
      toast.success('Dia cancelado');
      await invalidarHistorial();
    },
    onError: (err) => toast.error(err?.message || 'No se pudo cancelar el dia'),
  });

  const handleEliminar = async (pedido) => {
    const semanaInicio = String(pedido.semana_inicio || pedido.semanaId || '').split('T')[0];
    const items = pedido.items || pedido.dias || [];
    const itemsActivos = items.filter((item) => !item.sin_pedido);
    const itemsCancelables = items.filter((item) => puedeCancelarItem(pedido, item, semanaInicio));
    const parcial = itemsActivos.length !== itemsCancelables.length;
    const ok = await confirmar({
      titulo: parcial ? 'Cancelar dias pendientes?' : 'Cancelar pedido?',
      texto: parcial
        ? 'Se cancelaran solo los dias que todavia no vencieron. Los dias ya entregados quedan registrados.'
        : 'Esta accion no se puede deshacer.',
      botonConfirmar: parcial ? 'Si, cancelar pendientes' : 'Si, cancelar',
      color: '#C83030',
    });
    if (ok) eliminar.mutate(semanaInicio);
  };

  const handleCancelarDia = async (pedido, dia) => {
    const ok = await confirmar({
      titulo: `Cancelar ${DIAS_LABEL[dia] || dia}?`,
      texto: 'Solo se cancelara este dia. Los demas dias del pedido quedan igual.',
      botonConfirmar: 'Si, cancelar dia',
      color: '#C83030',
    });
    if (ok) cancelarDia.mutate({ pedidoId: pedido.id, dia });
  };

  return (
    <div className="flex h-full flex-col bg-[#FAF8F3]">
      <div className="bg-[#5B6B2A] px-4 pt-12 pb-8">
        <h1 className="font-serif text-xl font-bold text-white">Mis pedidos</h1>
        <p className="mt-0.5 text-xs text-white/60">Historial y cuenta corriente</p>
      </div>

      <Tabs activo={tabActiva} onChange={setTabActiva} />

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {tabActiva === 'pedidos' ? (
          <div className="space-y-3">
            {isLoading && (
              <>
                {[1,2,3].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-2xl border border-[#E8E5DC] bg-white" />
                ))}
              </>
            )}

            {error && (
              <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="flex-1 text-sm text-red-700">No pudimos cargar el historial.</p>
                <button type="button" onClick={refetch} className="text-red-500">
                  <RefreshCw size={16} />
                </button>
              </div>
            )}

            {!isLoading && !error && cantidadPedidos === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EDF0E4]">
                  <CheckCircle2 size={24} className="text-[#6E6B64]" />
                </div>
                <p className="text-sm font-semibold text-[#6E6B64]">Todavia no tenes pedidos</p>
              </div>
            )}

            {pedidos.map((pedido) => (
              <FilaPedido
                key={pedido.id}
                cancelando={eliminar.isPending}
                cancelandoDia={cancelarDia.isPending ? `${cancelarDia.variables?.pedidoId}:${cancelarDia.variables?.dia}` : null}
                pedido={pedido}
                onCancelarDia={handleCancelarDia}
                onEliminar={handleEliminar}
              />
            ))}
          </div>
        ) : (
          <CuentaFinanciera
            cuenta={cuentaFinanciera}
            loading={cargandoFinanzas}
            error={errorFinanzas}
            onRetry={refetchFinanzas}
          />
        )}
      </div>
    </div>
  );
}
