import { getClient } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';
import * as auditoriaService from '../admin-auditoria/admin-auditoria.service.js';
import * as repo from './finanzas.repository.js';

const PAGADOR_TIPOS = ['empresa', 'empleado'];
const PAGO_ESTADOS = ['activo', 'anulado'];
const ESTADOS_FINANCIEROS = ['pendiente', 'parcial', 'pagado', 'saldo_a_favor'];
const MODALIDADES = ['por_pedido', 'semanal', 'quincenal', 'mensual', 'personalizado', 'a_demanda', 'por_empleado'];

function toNumber(value, campo) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) throw ApiError.badRequest(`${campo} debe ser numerico`);
  return Math.round(numero * 100) / 100;
}

function normalizarId(value, campo) {
  if (value === null || value === undefined || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest(`${campo} invalido`);
  return id;
}

function normalizarFecha(value, campo, requerido = false) {
  if (!value) {
    if (requerido) throw ApiError.badRequest(`${campo} es requerido`);
    return null;
  }
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw ApiError.badRequest(`${campo} debe tener formato YYYY-MM-DD`);
  return text;
}

function normalizarTexto(value, campo, { requerido = false, max = 500 } = {}) {
  const text = String(value || '').trim();
  if (!text) {
    if (requerido) throw ApiError.badRequest(`${campo} es requerido`);
    return null;
  }
  if (text.length > max) throw ApiError.badRequest(`${campo} supera ${max} caracteres`);
  return text;
}

function adminId(adminUser = {}) {
  return adminUser.sub ?? adminUser.id ?? null;
}

export function calcularEstadoFinanciero(importeTotal, importePagado) {
  const total = toNumber(importeTotal || 0, 'importe_total');
  const pagado = toNumber(importePagado || 0, 'importe_pagado');
  if (pagado <= 0) return 'pendiente';
  if (total <= 0 || pagado > total) return 'saldo_a_favor';
  if (pagado === total) return 'pagado';
  return 'parcial';
}

export function normalizarPagoInput(payload = {}, parcial = false) {
  const data = {};

  if (!parcial || payload.pagador_tipo !== undefined) {
    if (!PAGADOR_TIPOS.includes(payload.pagador_tipo)) {
      throw ApiError.badRequest('pagador_tipo debe ser empresa o empleado');
    }
    data.pagador_tipo = payload.pagador_tipo;
  }

  const pagadorTipo = data.pagador_tipo || payload.pagador_tipo;
  if (!parcial || payload.empresa_id !== undefined || pagadorTipo === 'empresa') {
    data.empresa_id = normalizarId(payload.empresa_id, 'empresa_id');
  }
  if (!parcial || payload.empleado_id !== undefined || pagadorTipo === 'empleado') {
    data.empleado_id = normalizarId(payload.empleado_id, 'empleado_id');
  }

  if (pagadorTipo === 'empresa' && !data.empresa_id && !payload.empresa_id) {
    throw ApiError.badRequest('empresa_id es requerido para pagador_tipo empresa');
  }
  if (pagadorTipo === 'empleado' && !data.empleado_id && !payload.empleado_id) {
    throw ApiError.badRequest('empleado_id es requerido para pagador_tipo empleado');
  }

  if (!parcial || payload.monto !== undefined) {
    const monto = toNumber(payload.monto, 'monto');
    if (monto <= 0) throw ApiError.badRequest('monto debe ser mayor a 0');
    data.monto = monto;
  }
  if (!parcial || payload.fecha_pago !== undefined) {
    data.fecha_pago = normalizarFecha(payload.fecha_pago, 'fecha_pago', true);
  }
  if (!parcial || payload.metodo_pago !== undefined) {
    data.metodo_pago = normalizarTexto(payload.metodo_pago, 'metodo_pago', { requerido: true, max: 80 });
  }

  if (payload.periodo_desde !== undefined) {
    data.periodo_desde = normalizarFecha(payload.periodo_desde, 'periodo_desde');
  } else if (!parcial) {
    data.periodo_desde = null;
  }
  if (payload.periodo_hasta !== undefined) {
    data.periodo_hasta = normalizarFecha(payload.periodo_hasta, 'periodo_hasta');
  } else if (!parcial) {
    data.periodo_hasta = null;
  }
  if (data.periodo_desde && data.periodo_hasta && data.periodo_hasta < data.periodo_desde) {
    throw ApiError.badRequest('periodo_hasta no puede ser anterior a periodo_desde');
  }

  if (payload.observacion !== undefined || !parcial) {
    data.observacion = normalizarTexto(payload.observacion, 'observacion', { max: 1000 });
  }
  if (payload.comprobante_url !== undefined || !parcial) {
    data.comprobante_url = normalizarTexto(payload.comprobante_url, 'comprobante_url', { max: 1000 });
  }
  if (payload.numero_recibo !== undefined || !parcial) {
    data.numero_recibo = normalizarTexto(payload.numero_recibo, 'numero_recibo', { max: 80 });
  }

  return data;
}

function normalizarAplicacionInput(input = {}) {
  const pedidoId = normalizarId(input.pedido_id, 'pedido_id');
  const pedidoItemId = normalizarId(input.pedido_item_id, 'pedido_item_id');
  if (!pedidoId && !pedidoItemId) throw ApiError.badRequest('pedido_id o pedido_item_id es requerido');
  const montoAplicado = toNumber(input.monto_aplicado, 'monto_aplicado');
  if (montoAplicado <= 0) throw ApiError.badRequest('monto_aplicado debe ser mayor a 0');
  return {
    pedido_id: pedidoId,
    pedido_item_id: pedidoItemId,
    monto_aplicado: montoAplicado,
  };
}

function normalizarFiltros(filters = {}) {
  const result = {};
  for (const key of ['empresa_id', 'empleado_id']) {
    if (filters[key] !== undefined && filters[key] !== '') result[key] = normalizarId(filters[key], key);
  }
  for (const key of ['semana_inicio', 'desde', 'hasta']) {
    if (filters[key]) result[key] = normalizarFecha(filters[key], key);
  }
  if (filters.estado_financiero) {
    if (!ESTADOS_FINANCIEROS.includes(filters.estado_financiero)) {
      throw ApiError.badRequest('estado_financiero invalido');
    }
    result.estado_financiero = filters.estado_financiero;
  }
  if (filters.estado) result.estado = String(filters.estado).trim();
  if (filters.limit) result.limit = filters.limit;
  if (filters.offset) result.offset = filters.offset;
  return result;
}

function assertPedidoPerteneceAlPagador(pago, pedido) {
  if (pago.pagador_tipo === 'empresa' && Number(pedido.empresa_id) !== Number(pago.empresa_id)) {
    throw ApiError.unprocessable('El pedido no pertenece a la empresa pagadora');
  }
  if (pago.pagador_tipo === 'empleado' && Number(pedido.empleado_id) !== Number(pago.empleado_id)) {
    throw ApiError.unprocessable('El pedido no pertenece al empleado pagador');
  }
}

async function recalcularPedido(pedidoId, db) {
  const pedido = await repo.findPedidoFinancieroById(pedidoId, db);
  if (!pedido) return null;
  const importeTotal = Number(pedido.importe_calculado || 0);
  const importePagado = Number(pedido.importe_aplicado || 0);
  const estadoFinanciero = calcularEstadoFinanciero(importeTotal, importePagado);
  return repo.actualizarEstadoFinancieroPedido(pedidoId, {
    importeTotal,
    importePagado,
    estadoFinanciero,
  }, db);
}

function calcularTotalesCuenta(cuenta) {
  const totalPedidos = cuenta.pedidos
    .filter((pedido) => pedido.estado !== 'cancelado')
    .reduce((sum, pedido) => sum + Number(pedido.importe_total || 0), 0);
  const totalPagos = cuenta.pagos
    .filter((pago) => pago.estado === 'activo')
    .reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
  const totalAjustes = cuenta.ajustes.reduce((sum, ajuste) => sum + Number(ajuste.monto || 0), 0);
  const saldo = Math.round((totalPedidos + totalAjustes - totalPagos) * 100) / 100;
  return {
    total_pedidos: totalPedidos,
    total_pagos: totalPagos,
    total_ajustes: totalAjustes,
    saldo,
    estado: saldo < 0 ? 'saldo_a_favor' : saldo === 0 ? 'pagado' : 'pendiente',
  };
}

function calcularTotalesHistorialCliente(cuenta) {
  const pedidosVigentes = cuenta.pedidos.filter((pedido) => pedido.estado !== 'cancelado');
  const totalPedidos = pedidosVigentes.reduce((sum, pedido) => sum + Number(pedido.importe_total || 0), 0);
  const totalAplicado = pedidosVigentes.reduce((sum, pedido) => sum + Number(pedido.importe_pagado || 0), 0);
  const totalPagosVisibles = cuenta.pagos.reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
  const totalAplicadoVisible = cuenta.pagos.reduce((sum, pago) => sum + Number(pago.monto_aplicado || 0), 0);
  const saldoVisibleSinAplicar = Math.max(0, totalPagosVisibles - totalAplicadoVisible);
  const totalAjustes = cuenta.ajustes.reduce((sum, ajuste) => sum + Number(ajuste.monto || 0), 0);
  const saldo = Math.round((totalPedidos + totalAjustes - totalAplicado - saldoVisibleSinAplicar) * 100) / 100;
  return {
    total_pedidos: totalPedidos,
    total_aplicado: totalAplicado,
    total_pagos: Math.round((totalAplicado + saldoVisibleSinAplicar) * 100) / 100,
    total_pagos_visibles: totalPagosVisibles,
    total_pagos_sin_aplicar: saldoVisibleSinAplicar,
    total_ajustes: totalAjustes,
    saldo,
    estado: saldo < 0 ? 'saldo_a_favor' : saldo === 0 ? 'pagado' : 'pendiente',
  };
}

export async function getResumen() {
  return repo.resumen();
}

export async function getPedidosPagos(filters) {
  return repo.listarPedidosPagos(normalizarFiltros(filters));
}

export async function getCuentaCorriente(tipo, id) {
  const cuentaId = normalizarId(id, `${tipo}_id`);
  const cuenta = await repo.cuentaCorriente({ tipo, id: cuentaId });
  return {
    ...cuenta,
    totales: calcularTotalesHistorialCliente(cuenta),
  };
}

export async function getMiHistorialFinanciero(empleado = {}) {
  const empleadoId = normalizarId(empleado.sub ?? empleado.id, 'empleado_id');
  const empresaId = normalizarId(empleado.empresa_id, 'empresa_id');
  const esResponsableEmpresa = empleado.rol === 'admin';
  const cuenta = await repo.cuentaCorrienteCliente({
    empleadoId,
    empresaId,
    esResponsableEmpresa,
  });

  return {
    ...cuenta,
    totales: calcularTotalesCuenta(cuenta),
  };
}

export async function crearPago(payload, adminUser) {
  const data = normalizarPagoInput(payload);
  data.created_by_admin_id = adminId(adminUser);

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const pago = await repo.crearPago(data, client);
    await auditoriaService.registrarAdminAction({
      adminUser,
      accion: 'crear',
      entidad_tipo: 'finanzas_pago',
      entidad_id: pago.id,
      resumen: `Registro pago ${pago.id} por ${pago.monto}`,
      despues: pago,
    }, client);
    await client.query('COMMIT');
    return pago;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function actualizarPago(id, payload, adminUser) {
  const pagoId = normalizarId(id, 'pago_id');
  const actual = await repo.findPagoById(pagoId);
  if (!actual) throw ApiError.notFound('Pago no encontrado');
  if (actual.estado !== 'activo') throw ApiError.conflict('No se puede editar un pago anulado');
  const data = normalizarPagoInput({ ...actual, ...payload }, true);
  if (Object.keys(data).length === 0) throw ApiError.badRequest('No hay campos validos para actualizar');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const actualizado = await repo.actualizarPago(pagoId, data, adminId(adminUser), client);
    if (!actualizado) throw ApiError.notFound('Pago no encontrado');
    await auditoriaService.registrarAdminAction({
      adminUser,
      accion: 'actualizar',
      entidad_tipo: 'finanzas_pago',
      entidad_id: pagoId,
      resumen: `Actualizo pago ${pagoId}`,
      antes: actual,
      despues: actualizado,
    }, client);
    await client.query('COMMIT');
    return actualizado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function anularPago(id, payload, adminUser) {
  const pagoId = normalizarId(id, 'pago_id');
  const actual = await repo.findPagoById(pagoId);
  if (!actual) throw ApiError.notFound('Pago no encontrado');
  if (actual.estado === 'anulado') throw ApiError.conflict('El pago ya esta anulado');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const aplicaciones = await repo.findAplicacionesByPagoId(pagoId, client);
    const anulado = await repo.anularPago(pagoId, {
      adminId: adminId(adminUser),
      motivo: normalizarTexto(payload?.motivo, 'motivo', { max: 500 }),
    }, client);
    for (const aplicacion of aplicaciones) {
      if (aplicacion.pedido_id) await recalcularPedido(aplicacion.pedido_id, client);
    }
    await auditoriaService.registrarAdminAction({
      adminUser,
      accion: 'anular',
      entidad_tipo: 'finanzas_pago',
      entidad_id: pagoId,
      resumen: `Anulo pago ${pagoId}`,
      antes: actual,
      despues: anulado,
      metadata: { aplicaciones_afectadas: aplicaciones.map((item) => item.id) },
    }, client);
    await client.query('COMMIT');
    return anulado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function buildAplicacionesAutomaticas(pago, disponible, db) {
  const aplicaciones = [];
  let restante = disponible;
  const pedidos = await repo.findPedidosParaAutoAplicar(pago, db);
  for (const pedido of pedidos) {
    if (restante <= 0) break;
    const saldo = Number(pedido.importe_total || 0) - Number(pedido.importe_pagado || 0);
    if (saldo <= 0) continue;
    const monto = Math.min(restante, saldo);
    aplicaciones.push({ pedido_id: pedido.pedido_id, pedido_item_id: null, monto_aplicado: monto });
    restante = Math.round((restante - monto) * 100) / 100;
  }
  return aplicaciones;
}

export async function aplicarPago(id, payload = {}, adminUser) {
  const pagoId = normalizarId(id, 'pago_id');
  const pago = await repo.findPagoById(pagoId);
  if (!pago) throw ApiError.notFound('Pago no encontrado');
  if (pago.estado !== 'activo') throw ApiError.conflict('No se puede aplicar un pago anulado');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const yaAplicado = await repo.totalAplicadoPago(pagoId, client);
    const disponible = Math.round((Number(pago.monto) - yaAplicado) * 100) / 100;
    if (disponible <= 0) throw ApiError.conflict('El pago no tiene saldo disponible para aplicar');

    const aplicacionesPayload = Array.isArray(payload.aplicaciones) && payload.aplicaciones.length > 0
      ? payload.aplicaciones.map(normalizarAplicacionInput)
      : await buildAplicacionesAutomaticas(pago, disponible, client);

    if (aplicacionesPayload.length === 0) {
      throw ApiError.conflict('No hay pedidos con saldo pendiente para aplicar automaticamente');
    }

    const totalNuevo = aplicacionesPayload.reduce((sum, item) => sum + item.monto_aplicado, 0);
    if (totalNuevo > disponible) throw ApiError.unprocessable('Las aplicaciones superan el saldo disponible del pago');

    const creadas = [];
    const pedidosARecalcular = new Set();
    for (const aplicacion of aplicacionesPayload) {
      const pedidoId = aplicacion.pedido_id || await repo.findPedidoIdByItemId(aplicacion.pedido_item_id, client);
      if (!pedidoId) throw ApiError.notFound(`Item de pedido ${aplicacion.pedido_item_id} no encontrado`);
      const pedido = await repo.findPedidoFinancieroById(pedidoId, client);
      if (!pedido) throw ApiError.notFound(`Pedido ${aplicacion.pedido_id} no encontrado`);
      assertPedidoPerteneceAlPagador(pago, pedido);
      const creada = await repo.crearAplicacion({
        pago_id: pagoId,
        pedido_id: pedidoId,
        pedido_item_id: aplicacion.pedido_item_id,
        monto_aplicado: aplicacion.monto_aplicado,
        created_by_admin_id: adminId(adminUser),
      }, client);
      creadas.push(creada);
      pedidosARecalcular.add(pedidoId);
    }

    for (const pedidoId of pedidosARecalcular) {
      await recalcularPedido(pedidoId, client);
    }

    await auditoriaService.registrarAdminAction({
      adminUser,
      accion: 'aplicar',
      entidad_tipo: 'finanzas_pago',
      entidad_id: pagoId,
      resumen: `Aplico pago ${pagoId} a ${creadas.length} pedido(s)`,
      despues: { aplicaciones: creadas },
    }, client);
    await client.query('COMMIT');
    return {
      pago_id: pagoId,
      aplicaciones: creadas,
      saldo_disponible: Math.round((disponible - totalNuevo) * 100) / 100,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function desasociarAplicacion(pagoIdParam, aplicacionIdParam, adminUser) {
  const pagoId = normalizarId(pagoIdParam, 'pago_id');
  const aplicacionId = normalizarId(aplicacionIdParam, 'aplicacion_id');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const eliminada = await repo.eliminarAplicacion({ pagoId, aplicacionId }, client);
    if (!eliminada) throw ApiError.notFound('Aplicacion de pago no encontrada');
    if (eliminada.pedido_id) await recalcularPedido(eliminada.pedido_id, client);
    await auditoriaService.registrarAdminAction({
      adminUser,
      accion: 'desasociar_aplicacion',
      entidad_tipo: 'finanzas_pago',
      entidad_id: pagoId,
      resumen: `Desasocio aplicacion ${aplicacionId} del pago ${pagoId}`,
      antes: eliminada,
    }, client);
    await client.query('COMMIT');
    return eliminada;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function normalizarConfiguracionCobroInput(payload = {}) {
  const empresaId = normalizarId(payload.empresa_id, 'empresa_id');
  const empleadoId = normalizarId(payload.empleado_id, 'empleado_id');
  if ((empresaId && empleadoId) || (!empresaId && !empleadoId)) {
    throw ApiError.badRequest('Debe indicar empresa_id o empleado_id, pero no ambos');
  }
  if (!MODALIDADES.includes(payload.modalidad)) throw ApiError.badRequest('modalidad invalida');
  const dia = payload.dia_vencimiento === undefined || payload.dia_vencimiento === null || payload.dia_vencimiento === ''
    ? null
    : Number(payload.dia_vencimiento);
  if (dia !== null && (!Number.isInteger(dia) || dia < 1 || dia > 31)) {
    throw ApiError.badRequest('dia_vencimiento debe estar entre 1 y 31');
  }
  return {
    empresa_id: empresaId,
    empleado_id: empleadoId,
    modalidad: payload.modalidad,
    dia_vencimiento: dia,
    activo: payload.activo === undefined ? true : Boolean(payload.activo),
  };
}

export async function crearAjuste(payload, adminUser) {
  const empresaId = normalizarId(payload?.empresa_id, 'empresa_id');
  const empleadoId = normalizarId(payload?.empleado_id, 'empleado_id');
  if ((empresaId && empleadoId) || (!empresaId && !empleadoId)) {
    throw ApiError.badRequest('Debe indicar empresa_id o empleado_id, pero no ambos');
  }
  const monto = toNumber(payload?.monto, 'monto');
  if (monto === 0) throw ApiError.badRequest('monto no puede ser 0');
  const data = {
    empresa_id: empresaId,
    empleado_id: empleadoId,
    monto,
    motivo: normalizarTexto(payload?.motivo, 'motivo', { requerido: true, max: 180 }),
    referencia: normalizarTexto(payload?.referencia, 'referencia', { max: 180 }),
    created_by_admin_id: adminId(adminUser),
  };

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const ajuste = await repo.crearAjuste(data, client);
    await auditoriaService.registrarAdminAction({
      adminUser,
      accion: 'crear',
      entidad_tipo: 'finanzas_ajuste',
      entidad_id: ajuste.id,
      resumen: `Registro ajuste financiero ${ajuste.id} por ${ajuste.monto}`,
      despues: ajuste,
    }, client);
    await client.query('COMMIT');
    return ajuste;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export const constantes = {
  PAGADOR_TIPOS,
  PAGO_ESTADOS,
  ESTADOS_FINANCIEROS,
  MODALIDADES,
};
