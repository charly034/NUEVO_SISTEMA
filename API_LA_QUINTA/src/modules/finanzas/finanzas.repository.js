import { query } from '../../database/connection.js';

const execute = (db, text, params) => (
  typeof db === 'function' ? db(text, params) : db.query(text, params)
);

const PAGO_FIELDS = `
  fp.id, fp.empresa_id, fp.empleado_id, fp.pagador_tipo, fp.monto,
  fp.fecha_pago, fp.metodo_pago, fp.periodo_desde, fp.periodo_hasta,
  fp.observacion, fp.comprobante_url, fp.numero_recibo, fp.estado,
  fp.created_by_admin_id, fp.updated_by_admin_id, fp.anulado_by_admin_id,
  fp.anulado_at, fp.motivo_anulacion, fp.created_at, fp.updated_at,
  emp.nombre AS empresa_nombre,
  e.nombre AS empleado_nombre, e.apellido AS empleado_apellido, e.email AS empleado_email
`;

function whereCuenta({ tipo, id }, alias = '') {
  const prefijo = alias ? `${alias}.` : '';
  return tipo === 'empresa'
    ? [`${prefijo}empresa_id = $1`, [id]]
    : [`${prefijo}empleado_id = $1`, [id]];
}

export async function findPagoById(id, db = query) {
  const result = await execute(db, `
    SELECT ${PAGO_FIELDS}
    FROM finanzas_pagos fp
    LEFT JOIN empresas emp ON emp.id = fp.empresa_id
    LEFT JOIN empleados e ON e.id = fp.empleado_id
    WHERE fp.id = $1
  `, [id]);
  return result.rows[0] || null;
}

export async function crearPago(data, db = query) {
  const result = await execute(db, `
    INSERT INTO finanzas_pagos (
      empresa_id, empleado_id, pagador_tipo, monto, fecha_pago, metodo_pago,
      periodo_desde, periodo_hasta, observacion, comprobante_url, numero_recibo,
      created_by_admin_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id
  `, [
    data.empresa_id,
    data.empleado_id,
    data.pagador_tipo,
    data.monto,
    data.fecha_pago,
    data.metodo_pago,
    data.periodo_desde,
    data.periodo_hasta,
    data.observacion,
    data.comprobante_url,
    data.numero_recibo,
    data.created_by_admin_id,
  ]);
  return findPagoById(result.rows[0].id, db);
}

export async function actualizarPago(id, fields, adminId, db = query) {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const set = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  values.push(adminId || null, id);
  const result = await execute(db, `
    UPDATE finanzas_pagos
    SET ${set}, updated_by_admin_id = $${values.length - 1}, updated_at = NOW()
    WHERE id = $${values.length} AND estado = 'activo'
    RETURNING id
  `, values);
  return result.rows[0] ? findPagoById(result.rows[0].id, db) : null;
}

export async function anularPago(id, { adminId, motivo }, db = query) {
  const result = await execute(db, `
    UPDATE finanzas_pagos
    SET estado = 'anulado',
        anulado_by_admin_id = $2,
        anulado_at = NOW(),
        motivo_anulacion = $3,
        updated_by_admin_id = $2,
        updated_at = NOW()
    WHERE id = $1 AND estado = 'activo'
    RETURNING id
  `, [id, adminId || null, motivo || null]);
  return result.rows[0] ? findPagoById(result.rows[0].id, db) : null;
}

export async function findAplicacionesByPagoId(pagoId, db = query) {
  const result = await execute(db, `
    SELECT fpa.id, fpa.pago_id, fpa.pedido_id, fpa.pedido_item_id, fpa.monto_aplicado,
           fpa.created_by_admin_id, fpa.created_at,
           p.semana_inicio, p.estado AS pedido_estado,
           e.nombre AS empleado_nombre, e.apellido AS empleado_apellido,
           emp.nombre AS empresa_nombre
    FROM finanzas_pago_aplicaciones fpa
    LEFT JOIN pedidos p ON p.id = fpa.pedido_id
    LEFT JOIN empleados e ON e.id = p.empleado_id
    LEFT JOIN empresas emp ON emp.id = p.empresa_id
    WHERE fpa.pago_id = $1
    ORDER BY fpa.created_at ASC, fpa.id ASC
  `, [pagoId]);
  return result.rows;
}

export async function crearAplicacion(data, db = query) {
  const result = await execute(db, `
    INSERT INTO finanzas_pago_aplicaciones (
      pago_id, pedido_id, pedido_item_id, monto_aplicado, created_by_admin_id
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, pago_id, pedido_id, pedido_item_id, monto_aplicado, created_by_admin_id, created_at
  `, [
    data.pago_id,
    data.pedido_id,
    data.pedido_item_id,
    data.monto_aplicado,
    data.created_by_admin_id,
  ]);
  return result.rows[0];
}

export async function eliminarAplicacion({ pagoId, aplicacionId }, db = query) {
  const result = await execute(db, `
    DELETE FROM finanzas_pago_aplicaciones
    WHERE id = $1 AND pago_id = $2
    RETURNING id, pago_id, pedido_id, pedido_item_id, monto_aplicado, created_at
  `, [aplicacionId, pagoId]);
  return result.rows[0] || null;
}

export async function totalAplicadoPago(pagoId, db = query) {
  const result = await execute(db, `
    SELECT COALESCE(SUM(monto_aplicado), 0)::numeric AS total
    FROM finanzas_pago_aplicaciones
    WHERE pago_id = $1
  `, [pagoId]);
  return Number(result.rows[0]?.total || 0);
}

export async function findPedidoFinancieroById(id, db = query) {
  const result = await execute(db, `
    WITH aplicaciones AS (
      SELECT fpa.pedido_id, COALESCE(SUM(fpa.monto_aplicado), 0) AS aplicado
      FROM finanzas_pago_aplicaciones fpa
      JOIN finanzas_pagos fp ON fp.id = fpa.pago_id AND fp.estado = 'activo'
      WHERE fpa.pedido_id = $1
      GROUP BY fpa.pedido_id
    ),
    items AS (
      SELECT pedido_id, COALESCE(SUM(COALESCE(precio_unitario, 0)), 0) AS total_items
      FROM pedido_items
      WHERE pedido_id = $1 AND COALESCE(sin_pedido, false) = false
      GROUP BY pedido_id
    )
    SELECT p.id, p.empleado_id, p.empresa_id, p.semana_inicio, p.estado,
           p.estado_financiero, p.importe_total, p.importe_pagado, p.moneda,
           COALESCE(NULLIF(p.importe_total, 0), i.total_items, 0)::numeric AS importe_calculado,
           COALESCE(a.aplicado, 0)::numeric AS importe_aplicado,
           emp.nombre AS empresa_nombre,
           e.nombre AS empleado_nombre, e.apellido AS empleado_apellido
    FROM pedidos p
    JOIN empresas emp ON emp.id = p.empresa_id
    JOIN empleados e ON e.id = p.empleado_id
    LEFT JOIN aplicaciones a ON a.pedido_id = p.id
    LEFT JOIN items i ON i.pedido_id = p.id
    WHERE p.id = $1
  `, [id]);
  return result.rows[0] || null;
}

export async function findPedidoIdByItemId(pedidoItemId, db = query) {
  const result = await execute(db, 'SELECT pedido_id FROM pedido_items WHERE id = $1', [pedidoItemId]);
  return result.rows[0]?.pedido_id || null;
}

export async function actualizarEstadoFinancieroPedido(id, { importeTotal, importePagado, estadoFinanciero }, db = query) {
  const result = await execute(db, `
    UPDATE pedidos
    SET importe_total = $2,
        importe_pagado = $3,
        estado_financiero = $4,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, estado_financiero, importe_total, importe_pagado
  `, [id, importeTotal, importePagado, estadoFinanciero]);
  return result.rows[0] || null;
}

export async function findPedidosParaAutoAplicar(pago, db = query) {
  const field = pago.pagador_tipo === 'empresa' ? 'p.empresa_id' : 'p.empleado_id';
  const value = pago.pagador_tipo === 'empresa' ? pago.empresa_id : pago.empleado_id;
  const result = await execute(db, `
    WITH aplicaciones AS (
      SELECT fpa.pedido_id, COALESCE(SUM(fpa.monto_aplicado), 0) AS aplicado
      FROM finanzas_pago_aplicaciones fpa
      JOIN finanzas_pagos fp ON fp.id = fpa.pago_id AND fp.estado = 'activo'
      GROUP BY fpa.pedido_id
    ),
    items AS (
      SELECT pedido_id, COALESCE(SUM(COALESCE(precio_unitario, 0)), 0) AS total_items
      FROM pedido_items
      WHERE COALESCE(sin_pedido, false) = false
      GROUP BY pedido_id
    )
    SELECT p.id AS pedido_id,
           COALESCE(NULLIF(p.importe_total, 0), i.total_items, 0)::numeric AS importe_total,
           COALESCE(a.aplicado, 0)::numeric AS importe_pagado
    FROM pedidos p
    LEFT JOIN aplicaciones a ON a.pedido_id = p.id
    LEFT JOIN items i ON i.pedido_id = p.id
    WHERE ${field} = $1
      AND p.estado <> 'cancelado'
      AND COALESCE(NULLIF(p.importe_total, 0), i.total_items, 0) > COALESCE(a.aplicado, 0)
    ORDER BY p.semana_inicio ASC, p.created_at ASC, p.id ASC
  `, [value]);
  return result.rows;
}

export async function listarPedidosPagos(filters = {}) {
  const values = [];
  const conditions = [];

  if (filters.empresa_id) {
    values.push(filters.empresa_id);
    conditions.push(`p.empresa_id = $${values.length}`);
  }
  if (filters.empleado_id) {
    values.push(filters.empleado_id);
    conditions.push(`p.empleado_id = $${values.length}`);
  }
  if (filters.semana_inicio) {
    values.push(filters.semana_inicio);
    conditions.push(`p.semana_inicio = $${values.length}`);
  }
  if (filters.estado_financiero) {
    values.push(filters.estado_financiero);
    conditions.push(`p.estado_financiero = $${values.length}`);
  }
  if (filters.estado) {
    values.push(filters.estado);
    conditions.push(`p.estado = $${values.length}`);
  }
  if (filters.desde) {
    values.push(filters.desde);
    conditions.push(`p.semana_inicio >= $${values.length}`);
  }
  if (filters.hasta) {
    values.push(filters.hasta);
    conditions.push(`p.semana_inicio <= $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Number.parseInt(filters.limit, 10) || 200, 500);
  const offset = Number.parseInt(filters.offset, 10) || 0;
  values.push(limit, offset);

  const result = await query(`
    WITH aplicaciones AS (
      SELECT fpa.pedido_id, COALESCE(SUM(fpa.monto_aplicado), 0) AS aplicado
      FROM finanzas_pago_aplicaciones fpa
      JOIN finanzas_pagos fp ON fp.id = fpa.pago_id AND fp.estado = 'activo'
      GROUP BY fpa.pedido_id
    ),
    items AS (
      SELECT pedido_id, COALESCE(SUM(COALESCE(precio_unitario, 0)), 0) AS total_items
      FROM pedido_items
      WHERE COALESCE(sin_pedido, false) = false
      GROUP BY pedido_id
    )
    SELECT p.id, p.semana_inicio, p.estado, p.estado_financiero,
           p.importe_total, p.importe_pagado, p.moneda,
           p.empleado_id, p.empresa_id,
           e.nombre AS empleado_nombre, e.apellido AS empleado_apellido, e.email AS empleado_email,
           emp.nombre AS empresa_nombre,
           COALESCE(NULLIF(p.importe_total, 0), i.total_items, 0)::numeric AS importe_calculado,
           COALESCE(a.aplicado, 0)::numeric AS importe_aplicado,
           (COALESCE(NULLIF(p.importe_total, 0), i.total_items, 0) - COALESCE(a.aplicado, 0))::numeric AS saldo
    FROM pedidos p
    JOIN empleados e ON e.id = p.empleado_id
    JOIN empresas emp ON emp.id = p.empresa_id
    LEFT JOIN aplicaciones a ON a.pedido_id = p.id
    LEFT JOIN items i ON i.pedido_id = p.id
    ${where}
    ORDER BY p.semana_inicio DESC, emp.nombre ASC, e.apellido ASC, e.nombre ASC
    LIMIT $${values.length - 1} OFFSET $${values.length}
  `, values);
  return result.rows;
}

export async function resumen() {
  const result = await query(`
    WITH aplicaciones AS (
      SELECT fpa.pedido_id, COALESCE(SUM(fpa.monto_aplicado), 0) AS aplicado
      FROM finanzas_pago_aplicaciones fpa
      JOIN finanzas_pagos fp ON fp.id = fpa.pago_id AND fp.estado = 'activo'
      GROUP BY fpa.pedido_id
    ),
    items AS (
      SELECT pedido_id, COALESCE(SUM(COALESCE(precio_unitario, 0)), 0) AS total_items
      FROM pedido_items
      WHERE COALESCE(sin_pedido, false) = false
      GROUP BY pedido_id
    ),
    pedidos_fin AS (
      SELECT COALESCE(NULLIF(p.importe_total, 0), i.total_items, 0) AS importe_total,
             COALESCE(a.aplicado, 0) AS importe_pagado,
             p.estado_financiero
      FROM pedidos p
      LEFT JOIN aplicaciones a ON a.pedido_id = p.id
      LEFT JOIN items i ON i.pedido_id = p.id
      WHERE p.estado <> 'cancelado'
    ),
    pagos AS (
      SELECT COALESCE(SUM(monto), 0) AS total_pagos
      FROM finanzas_pagos
      WHERE estado = 'activo'
    ),
    ajustes AS (
      SELECT COALESCE(SUM(monto), 0) AS total_ajustes
      FROM finanzas_ajustes
    )
    SELECT
      COALESCE(SUM(pf.importe_total), 0)::numeric AS total_pedidos,
      COALESCE(SUM(pf.importe_pagado), 0)::numeric AS total_aplicado,
      COALESCE((SELECT total_pagos FROM pagos), 0)::numeric AS total_pagos,
      COALESCE((SELECT total_ajustes FROM ajustes), 0)::numeric AS total_ajustes,
      COALESCE(SUM(pf.importe_total - pf.importe_pagado), 0)::numeric AS saldo_pedidos,
      COUNT(*)::int AS pedidos_contados,
      COUNT(*) FILTER (WHERE pf.estado_financiero = 'pendiente')::int AS pedidos_pendientes,
      COUNT(*) FILTER (WHERE pf.estado_financiero = 'parcial')::int AS pedidos_parciales,
      COUNT(*) FILTER (WHERE pf.estado_financiero = 'pagado')::int AS pedidos_pagados,
      COUNT(*) FILTER (WHERE pf.estado_financiero = 'saldo_a_favor')::int AS pedidos_saldo_a_favor
    FROM pedidos_fin pf
  `);
  return result.rows[0];
}

export async function cuentaCorriente({ tipo, id }) {
  const [wherePedidos, valuesPedidos] = whereCuenta({ tipo, id }, 'p');
  const [wherePagos, valuesPagos] = whereCuenta({ tipo, id }, 'fp');
  const [whereAjustes, valuesAjustes] = whereCuenta({ tipo, id }, 'fa');

  const pedidos = await query(`
    WITH aplicaciones AS (
      SELECT fpa.pedido_id, COALESCE(SUM(fpa.monto_aplicado), 0) AS aplicado
      FROM finanzas_pago_aplicaciones fpa
      JOIN finanzas_pagos fp ON fp.id = fpa.pago_id AND fp.estado = 'activo'
      GROUP BY fpa.pedido_id
    ),
    items AS (
      SELECT pi.pedido_id,
             COUNT(*) FILTER (WHERE COALESCE(pi.sin_pedido, false) = false)::int AS cantidad_viandas,
             COALESCE(
               SUM(COALESCE(pi.precio_unitario, 0)) FILTER (WHERE COALESCE(pi.sin_pedido, false) = false),
               0
             ) AS total_items,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'id', pi.id,
                   'dia', pi.dia,
                   'plato_id', pi.plato_id,
                   'plato_nombre', pl.nombre,
                   'opcion', pi.opcion,
                   'guarnicion_id', pi.guarnicion_id,
                   'guarnicion_nombre', g.nombre,
                   'sin_pedido', COALESCE(pi.sin_pedido, false),
                   'notas', pi.notas,
                   'precio_unitario', pi.precio_unitario,
                   'precio_moneda', pi.precio_moneda
                 )
                 ORDER BY pi.id ASC
               ) FILTER (WHERE pi.id IS NOT NULL),
               '[]'::json
             ) AS items
      FROM pedido_items pi
      LEFT JOIN platos pl ON pl.id = pi.plato_id
      LEFT JOIN guarniciones g ON g.id = pi.guarnicion_id
      GROUP BY pi.pedido_id
    )
    SELECT p.id, p.semana_inicio, p.estado, p.estado_financiero, p.observaciones,
           COALESCE(NULLIF(p.importe_total, 0), i.total_items, 0)::numeric AS importe_total,
           COALESCE(a.aplicado, 0)::numeric AS importe_pagado,
           (COALESCE(NULLIF(p.importe_total, 0), i.total_items, 0) - COALESCE(a.aplicado, 0))::numeric AS saldo,
           COALESCE(i.cantidad_viandas, 0)::int AS cantidad_viandas,
           COALESCE(i.items, '[]'::json) AS items,
           p.plan_id, p.plan_codigo, p.plan_nombre, p.plan_gramaje_min, p.plan_gramaje_max,
           p.plan_incluye_postre, p.plan_incluye_bebida,
           e.nombre AS empleado_nombre, e.apellido AS empleado_apellido,
           emp.nombre AS empresa_nombre
    FROM pedidos p
    JOIN empleados e ON e.id = p.empleado_id
    JOIN empresas emp ON emp.id = p.empresa_id
    LEFT JOIN aplicaciones a ON a.pedido_id = p.id
    LEFT JOIN items i ON i.pedido_id = p.id
    WHERE ${wherePedidos}
    ORDER BY p.semana_inicio DESC, p.id DESC
  `, valuesPedidos);

  const pagos = await query(`
    SELECT ${PAGO_FIELDS},
           COALESCE(SUM(fpa.monto_aplicado), 0)::numeric AS monto_aplicado,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id', fpa.id,
                 'pedido_id', fpa.pedido_id,
                 'pedido_item_id', fpa.pedido_item_id,
                 'monto_aplicado', fpa.monto_aplicado,
                 'created_at', fpa.created_at,
                 'semana_inicio', pa.semana_inicio,
                 'pedido_estado', pa.estado,
                 'estado_financiero', pa.estado_financiero,
                 'empleado_nombre', ea.nombre,
                 'empleado_apellido', ea.apellido,
                 'empresa_nombre', empa.nombre
               )
               ORDER BY fpa.created_at ASC, fpa.id ASC
             ) FILTER (WHERE fpa.id IS NOT NULL),
             '[]'::json
           ) AS aplicaciones
    FROM finanzas_pagos fp
    LEFT JOIN empresas emp ON emp.id = fp.empresa_id
    LEFT JOIN empleados e ON e.id = fp.empleado_id
    LEFT JOIN finanzas_pago_aplicaciones fpa ON fpa.pago_id = fp.id
    LEFT JOIN pedidos pa ON pa.id = fpa.pedido_id
    LEFT JOIN empleados ea ON ea.id = pa.empleado_id
    LEFT JOIN empresas empa ON empa.id = pa.empresa_id
    WHERE ${wherePagos}
    GROUP BY fp.id, emp.id, e.id
    ORDER BY fp.fecha_pago DESC, fp.id DESC
  `, valuesPagos);

  const ajustes = await query(`
    SELECT fa.id, fa.empresa_id, fa.empleado_id, fa.monto, fa.motivo, fa.referencia,
           fa.created_by_admin_id, fa.created_at
    FROM finanzas_ajustes fa
    WHERE ${whereAjustes}
    ORDER BY fa.created_at DESC, fa.id DESC
  `, valuesAjustes);

  return {
    tipo,
    id: Number(id),
    pedidos: pedidos.rows,
    pagos: pagos.rows,
    ajustes: ajustes.rows,
  };
}

export async function cuentaCorrienteCliente({ empleadoId, empresaId, esResponsableEmpresa = false }) {
  const tipo = esResponsableEmpresa ? 'empresa' : 'empleado';
  const id = esResponsableEmpresa ? empresaId : empleadoId;
  const wherePedidos = esResponsableEmpresa ? 'p.empresa_id = $1' : 'p.empleado_id = $1';
  const wherePagos = esResponsableEmpresa
    ? "fp.pagador_tipo = 'empresa' AND fp.empresa_id = $1"
    : "fp.pagador_tipo = 'empleado' AND fp.empleado_id = $1";
  const whereAjustes = esResponsableEmpresa ? 'fa.empresa_id = $1' : 'fa.empleado_id = $1';
  const whereConfig = esResponsableEmpresa ? 'fcc.empresa_id = $1' : 'fcc.empleado_id = $1';

  const pedidos = await query(`
    WITH aplicaciones AS (
      SELECT fpa.pedido_id,
             COALESCE(SUM(fpa.monto_aplicado), 0) AS aplicado,
             BOOL_OR(fp.pagador_tipo = 'empresa') AS pagado_por_empresa,
             BOOL_OR(fp.pagador_tipo = 'empleado') AS pagado_por_empleado,
             MAX(fp.fecha_pago) AS fecha_ultimo_pago,
             STRING_AGG(DISTINCT fp.metodo_pago, ', ') AS metodo_pago
      FROM finanzas_pago_aplicaciones fpa
      JOIN finanzas_pagos fp ON fp.id = fpa.pago_id AND fp.estado = 'activo'
      GROUP BY fpa.pedido_id
    ),
    items AS (
      SELECT pi.pedido_id,
             COUNT(*) FILTER (WHERE COALESCE(pi.sin_pedido, false) = false)::int AS cantidad_viandas,
             COALESCE(
               SUM(COALESCE(pi.precio_unitario, 0)) FILTER (WHERE COALESCE(pi.sin_pedido, false) = false),
               0
             ) AS total_items,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'id', pi.id,
                   'dia', pi.dia,
                   'plato_id', pi.plato_id,
                   'plato_nombre', pl.nombre,
                   'opcion', pi.opcion,
                   'guarnicion_id', pi.guarnicion_id,
                   'guarnicion_nombre', g.nombre,
                   'sin_pedido', COALESCE(pi.sin_pedido, false),
                   'precio_unitario', pi.precio_unitario,
                   'precio_moneda', pi.precio_moneda
                 )
                 ORDER BY pi.id ASC
               ) FILTER (WHERE pi.id IS NOT NULL),
               '[]'::json
             ) AS items
      FROM pedido_items pi
      LEFT JOIN platos pl ON pl.id = pi.plato_id
      LEFT JOIN guarniciones g ON g.id = pi.guarnicion_id
      GROUP BY pi.pedido_id
    )
    SELECT p.id, p.semana_inicio, p.estado, p.estado_financiero,
           COALESCE(NULLIF(p.importe_total, 0), i.total_items, 0)::numeric AS importe_total,
           COALESCE(a.aplicado, 0)::numeric AS importe_pagado,
           (COALESCE(NULLIF(p.importe_total, 0), i.total_items, 0) - COALESCE(a.aplicado, 0))::numeric AS saldo,
           p.moneda,
           COALESCE(i.cantidad_viandas, 0)::int AS cantidad_viandas,
           COALESCE(i.items, '[]'::json) AS items,
           COALESCE(a.pagado_por_empresa, false) AS pagado_por_empresa,
           COALESCE(a.pagado_por_empleado, false) AS pagado_por_empleado,
           a.fecha_ultimo_pago,
           a.metodo_pago,
           p.empleado_id, e.nombre AS empleado_nombre, e.apellido AS empleado_apellido,
           p.empresa_id, emp.nombre AS empresa_nombre
    FROM pedidos p
    JOIN empleados e ON e.id = p.empleado_id
    JOIN empresas emp ON emp.id = p.empresa_id
    LEFT JOIN aplicaciones a ON a.pedido_id = p.id
    LEFT JOIN items i ON i.pedido_id = p.id
    WHERE ${wherePedidos}
    ORDER BY p.semana_inicio DESC, p.id DESC
  `, [id]);

  const pagos = await query(`
    SELECT fp.id, fp.empresa_id, fp.empleado_id, fp.pagador_tipo, fp.monto,
           fp.fecha_pago, fp.metodo_pago, fp.periodo_desde, fp.periodo_hasta,
           fp.observacion, fp.comprobante_url, fp.numero_recibo, fp.estado,
           fp.created_at, fp.updated_at,
           emp.nombre AS empresa_nombre,
           e.nombre AS empleado_nombre, e.apellido AS empleado_apellido,
           COALESCE(SUM(fpa.monto_aplicado), 0)::numeric AS monto_aplicado,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id', fpa.id,
                 'pedido_id', fpa.pedido_id,
                 'pedido_item_id', fpa.pedido_item_id,
                 'monto_aplicado', fpa.monto_aplicado,
                 'created_at', fpa.created_at,
                 'semana_inicio', pa.semana_inicio,
                 'pedido_estado', pa.estado,
                 'estado_financiero', pa.estado_financiero,
                 'empleado_nombre', ea.nombre,
                 'empleado_apellido', ea.apellido
               )
               ORDER BY fpa.created_at ASC, fpa.id ASC
             ) FILTER (WHERE fpa.id IS NOT NULL),
             '[]'::json
           ) AS aplicaciones
    FROM finanzas_pagos fp
    LEFT JOIN empresas emp ON emp.id = fp.empresa_id
    LEFT JOIN empleados e ON e.id = fp.empleado_id
    LEFT JOIN finanzas_pago_aplicaciones fpa ON fpa.pago_id = fp.id
    LEFT JOIN pedidos pa ON pa.id = fpa.pedido_id
    LEFT JOIN empleados ea ON ea.id = pa.empleado_id
    WHERE ${wherePagos}
      AND fp.estado = 'activo'
    GROUP BY fp.id, emp.id, e.id
    ORDER BY fp.fecha_pago DESC, fp.id DESC
  `, [id]);

  const ajustes = await query(`
    SELECT fa.id, fa.empresa_id, fa.empleado_id, fa.monto, fa.motivo, fa.referencia, fa.created_at
    FROM finanzas_ajustes fa
    WHERE ${whereAjustes}
    ORDER BY fa.created_at DESC, fa.id DESC
  `, [id]);

  const configuracionCobro = await query(`
    SELECT fcc.id, fcc.empresa_id, fcc.empleado_id, fcc.modalidad, fcc.dia_vencimiento, fcc.activo
    FROM finanzas_configuracion_cobro fcc
    WHERE ${whereConfig}
      AND fcc.activo = true
    ORDER BY fcc.updated_at DESC, fcc.id DESC
    LIMIT 1
  `, [id]);

  return {
    tipo,
    id: Number(id),
    alcance: esResponsableEmpresa ? 'empresa' : 'empleado',
    puede_ver_empresa: Boolean(esResponsableEmpresa),
    pedidos: pedidos.rows,
    pagos: pagos.rows,
    ajustes: ajustes.rows,
    configuracion_cobro: configuracionCobro.rows[0] || null,
  };
}

export async function crearAjuste(data, db = query) {
  const result = await execute(db, `
    INSERT INTO finanzas_ajustes (
      empresa_id, empleado_id, monto, motivo, referencia, created_by_admin_id
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, empresa_id, empleado_id, monto, motivo, referencia, created_by_admin_id, created_at
  `, [
    data.empresa_id,
    data.empleado_id,
    data.monto,
    data.motivo,
    data.referencia,
    data.created_by_admin_id,
  ]);
  return result.rows[0];
}
