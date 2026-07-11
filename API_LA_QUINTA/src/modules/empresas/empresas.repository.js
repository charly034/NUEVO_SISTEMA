import { query } from '../../database/connection.js';

const CAMPOS_BASE = 'id, nombre, slug, plan_id, modo_pedido, activo, limite_hora, limite_dia_semana, limite_anticipacion_dias, plazo_override_hasta, dias_laborales, codigo_registro, email, telefono, deleted_at, created_at';
const CAMPOS = `
  e.id, e.nombre, e.slug, e.plan_id, e.modo_pedido, e.activo,
  e.limite_hora, e.limite_dia_semana, e.limite_anticipacion_dias,
  e.plazo_override_hasta, e.dias_laborales, e.codigo_registro,
  e.email, e.telefono, e.deleted_at, e.created_at,
  pv.nombre AS plan_nombre,
  pv.codigo AS plan_codigo,
  pv.gramaje_min AS plan_gramaje_min,
  pv.gramaje_max AS plan_gramaje_max,
  pv.incluye_postre AS plan_incluye_postre,
  pv.incluye_bebida AS plan_incluye_bebida,
  CASE WHEN pv.id IS NULL THEN NULL ELSE json_build_object(
    'id', pv.id,
    'codigo', pv.codigo,
    'nombre', pv.nombre,
    'descripcion', pv.descripcion,
    'gramaje_min', pv.gramaje_min,
    'gramaje_max', pv.gramaje_max,
    'incluye_postre', pv.incluye_postre,
    'incluye_bebida', pv.incluye_bebida,
    'activo', pv.activo
  ) END AS plan_detalle
`;

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0,O,1,I para evitar confusiones

function generarCodigo() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

async function codigoUnico() {
  for (let intento = 0; intento < 10; intento += 1) {
    const codigo = generarCodigo();
    const r = await query('SELECT id FROM empresas WHERE codigo_registro = $1', [codigo]);
    if (r.rows.length === 0) return codigo;
  }
  throw new Error('No se pudo generar un codigo unico');
}

async function findEnriquecidaById(id) {
  const r = await query(`
    SELECT ${CAMPOS}
    FROM empresas e
    LEFT JOIN planes_comerciales pv ON pv.id = e.plan_id
    WHERE e.id = $1 AND e.deleted_at IS NULL
  `, [id]);
  return r.rows[0] || null;
}

function normalizarTextoBusqueda(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function sqlTextoNormalizado(campo) {
  return `TRANSLATE(LOWER(COALESCE(${campo}, '')), 'áàäâãéèëêíìïîóòöôõúùüûñ', 'aaaaaeeeeiiiiooooouuuun')`;
}

function buildFiltrosListado({ search, estado } = {}) {
  const values = [];
  const conditions = ['e.deleted_at IS NULL'];

  if (estado === 'activa') conditions.push('e.activo = TRUE');
  if (estado === 'inactiva') conditions.push('e.activo = FALSE');

  const termino = normalizarTextoBusqueda(search);
  if (termino) {
    values.push(`%${termino}%`);
    const idx = values.length;
    conditions.push(`(
      ${sqlTextoNormalizado('e.nombre')} LIKE $${idx}
      OR ${sqlTextoNormalizado('e.slug')} LIKE $${idx}
      OR ${sqlTextoNormalizado('e.email')} LIKE $${idx}
    )`);
  }

  return {
    values,
    where: `WHERE ${conditions.join(' AND ')}`,
  };
}

export const findAll = async ({ page = 1, pageSize = 20, search = '', estado = 'todas' } = {}) => {
  const limit = Math.min(Math.max(Number(pageSize) || 20, 1), 1000);
  const currentPage = Math.max(Number(page) || 1, 1);
  const offset = (currentPage - 1) * limit;
  const { values, where } = buildFiltrosListado({ search, estado });
  const r = await query(`
    SELECT ${CAMPOS}
    FROM empresas e
    LEFT JOIN planes_comerciales pv ON pv.id = e.plan_id
    ${where}
    ORDER BY e.nombre ASC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `, [...values, limit, offset]);
  return r.rows;
};

export const countAll = async ({ search = '', estado = 'todas' } = {}) => {
  const { values, where } = buildFiltrosListado({ search, estado });
  const r = await query(`
    SELECT COUNT(*)::int AS total
    FROM empresas e
    ${where}
  `, values);
  return r.rows[0]?.total || 0;
};

export const findById = findEnriquecidaById;

export const findBySlug = async (slug) => {
  const r = await query(`
    SELECT ${CAMPOS}
    FROM empresas e
    LEFT JOIN planes_comerciales pv ON pv.id = e.plan_id
    WHERE LOWER(e.slug) = LOWER($1) AND e.deleted_at IS NULL
  `, [slug]);
  return r.rows[0] || null;
};

export const findByCodigo = async (codigo) => {
  const r = await query(
    `SELECT e.id, e.nombre, e.dias_laborales, e.activo, e.plan_id,
            pv.nombre AS plan_nombre, pv.codigo AS plan_codigo,
            pv.gramaje_min AS plan_gramaje_min, pv.gramaje_max AS plan_gramaje_max,
            pv.incluye_postre AS plan_incluye_postre,
            pv.incluye_bebida AS plan_incluye_bebida
     FROM empresas e
     LEFT JOIN planes_comerciales pv ON pv.id = e.plan_id
     WHERE UPPER(e.codigo_registro) = UPPER($1) AND e.deleted_at IS NULL`,
    [codigo.trim()]
  );
  return r.rows[0] || null;
};

export const create = async ({
  nombre,
  slug,
  plan_id,
  modo_pedido,
  dias_laborales,
  limite_hora,
  limite_dia_semana,
  limite_anticipacion_dias,
  email = null,
  telefono = null,
}) => {
  const codigo_registro = await codigoUnico();
  const r = await query(
    `INSERT INTO empresas (
       nombre, slug, plan_id, modo_pedido, dias_laborales,
       limite_hora, limite_dia_semana, limite_anticipacion_dias, codigo_registro,
       email, telefono
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      nombre,
      slug,
      plan_id || null,
      modo_pedido || 'semanal',
      dias_laborales || 'lunes_viernes',
      limite_hora || null,
      limite_dia_semana || null,
      limite_anticipacion_dias ?? 0,
      codigo_registro,
      email || null,
      telefono || null,
    ]
  );
  return findEnriquecidaById(r.rows[0].id);
};

export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  const vals = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(id);
  const r = await query(
    `UPDATE empresas SET ${set} WHERE id = $${vals.length} RETURNING ${CAMPOS_BASE}`,
    vals
  );
  return r.rows[0] ? findEnriquecidaById(r.rows[0].id) : null;
};

export const remove = async (id) => {
  const r = await query(
    `UPDATE empresas
     SET activo = FALSE, deleted_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING ${CAMPOS_BASE}`,
    [id],
  );
  return r.rows[0] || null;
};

export const getDependenciasEliminacion = async (id) => {
  const pedidos = await query(
    `SELECT COUNT(*)::int AS total
     FROM pedidos
     WHERE empresa_id = $1
       AND estado IN ('pendiente', 'en_proceso', 'completo')`,
    [id],
  );

  const saldo = await query(`
    WITH items AS (
      SELECT pedido_id, COALESCE(SUM(COALESCE(precio_unitario, 0)), 0) AS total_items
      FROM pedido_items
      WHERE COALESCE(sin_pedido, false) = false
      GROUP BY pedido_id
    ),
    pedidos_empresa AS (
      SELECT COALESCE(NULLIF(p.importe_total, 0), i.total_items, 0) AS importe_total
      FROM pedidos p
      LEFT JOIN items i ON i.pedido_id = p.id
      WHERE p.empresa_id = $1 AND p.estado <> 'cancelado'
    ),
    pagos_empresa AS (
      SELECT COALESCE(SUM(fp.monto), 0) AS total_pagos
      FROM finanzas_pagos fp
      WHERE fp.empresa_id = $1 AND fp.pagador_tipo = 'empresa' AND fp.estado = 'activo'
    ),
    ajustes_empresa AS (
      SELECT COALESCE(SUM(fa.monto), 0) AS total_ajustes
      FROM finanzas_ajustes fa
      WHERE fa.empresa_id = $1
    )
    SELECT (
      COALESCE((SELECT SUM(importe_total) FROM pedidos_empresa), 0)
      + COALESCE((SELECT total_ajustes FROM ajustes_empresa), 0)
      - COALESCE((SELECT total_pagos FROM pagos_empresa), 0)
    )::numeric AS saldo
  `, [id]);

  const pedidosActivos = pedidos.rows[0]?.total || 0;
  const saldoCuentaCorriente = Number(saldo.rows[0]?.saldo || 0);

  return {
    puedeEliminarse: pedidosActivos === 0 && saldoCuentaCorriente === 0,
    pedidosActivos,
    saldoCuentaCorriente,
  };
};

export const setOverride = async (id, hasta) => {
  const r = await query(
    `UPDATE empresas SET plazo_override_hasta = $1 WHERE id = $2 RETURNING ${CAMPOS_BASE}`,
    [hasta, id]
  );
  return r.rows[0] ? findEnriquecidaById(r.rows[0].id) : null;
};

export const clearOverride = async (id) => {
  const r = await query(
    `UPDATE empresas SET plazo_override_hasta = NULL WHERE id = $1 RETURNING ${CAMPOS_BASE}`,
    [id]
  );
  return r.rows[0] ? findEnriquecidaById(r.rows[0].id) : null;
};

export const regenerarCodigo = async (id) => {
  const codigo_registro = await codigoUnico();
  const r = await query(
    `UPDATE empresas SET codigo_registro = $1 WHERE id = $2 RETURNING ${CAMPOS_BASE}`,
    [codigo_registro, id]
  );
  return r.rows[0] ? findEnriquecidaById(r.rows[0].id) : null;
};
