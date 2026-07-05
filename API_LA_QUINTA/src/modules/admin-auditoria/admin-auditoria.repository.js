import { query } from '../../database/connection.js';

export const create = async ({
  admin_id = null,
  admin_email = null,
  admin_nombre = null,
  accion,
  entidad_tipo,
  entidad_id = null,
  resumen = null,
  antes = null,
  despues = null,
  metadata = {},
}, db = query) => {
  const exists = await db("SELECT to_regclass('public.admin_auditoria') AS table_name");
  if (!exists.rows[0]?.table_name) return null;

  const result = await db(
    `INSERT INTO admin_auditoria (
      admin_id, admin_email, admin_nombre, accion, entidad_tipo, entidad_id,
      resumen, antes, despues, metadata
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)
     RETURNING id, admin_id, admin_email, admin_nombre, accion, entidad_tipo,
       entidad_id, resumen, antes, despues, metadata, created_at`,
    [
      admin_id,
      admin_email,
      admin_nombre,
      accion,
      entidad_tipo,
      entidad_id === null || entidad_id === undefined ? null : String(entidad_id),
      resumen,
      antes === null || antes === undefined ? null : JSON.stringify(antes),
      despues === null || despues === undefined ? null : JSON.stringify(despues),
      JSON.stringify(metadata || {}),
    ]
  );
  return result.rows[0];
};

export const findAll = async ({ limit = 80, offset = 0, entidad_tipo, accion, admin_id } = {}) => {
  const conditions = [];
  const values = [];

  if (entidad_tipo) {
    values.push(entidad_tipo);
    conditions.push(`entidad_tipo = $${values.length}`);
  }
  if (accion) {
    values.push(accion);
    conditions.push(`accion = $${values.length}`);
  }
  if (admin_id) {
    values.push(admin_id);
    conditions.push(`admin_id = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, offset);

  const result = await query(
    `SELECT id, admin_id, admin_email, admin_nombre, accion, entidad_tipo,
       entidad_id, resumen, antes, despues, metadata, created_at
     FROM admin_auditoria
     ${where}
     ORDER BY created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return result.rows;
};

export const countAll = async ({ entidad_tipo, accion, admin_id } = {}) => {
  const conditions = [];
  const values = [];

  if (entidad_tipo) {
    values.push(entidad_tipo);
    conditions.push(`entidad_tipo = $${values.length}`);
  }
  if (accion) {
    values.push(accion);
    conditions.push(`accion = $${values.length}`);
  }
  if (admin_id) {
    values.push(admin_id);
    conditions.push(`admin_id = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`SELECT COUNT(*)::int AS total FROM admin_auditoria ${where}`, values);
  return result.rows[0]?.total ?? 0;
};
