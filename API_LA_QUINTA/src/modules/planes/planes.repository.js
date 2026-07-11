import { query } from '../../database/connection.js';

const CAMPOS = `
  id, codigo, nombre, descripcion, gramaje_min, gramaje_max,
  incluye_postre, incluye_bebida, activo, orden, created_at, updated_at
`;

export const findAll = async ({ incluirInactivos = true } = {}) => {
  const where = incluirInactivos ? '' : 'WHERE activo = true';
  const r = await query(`SELECT ${CAMPOS} FROM planes_comerciales ${where} ORDER BY orden ASC, nombre ASC`);
  return r.rows;
};

export const findById = async (id) => {
  const r = await query(`SELECT ${CAMPOS} FROM planes_comerciales WHERE id = $1`, [id]);
  return r.rows[0] || null;
};

export const findByCodigo = async (codigo) => {
  const r = await query(`SELECT ${CAMPOS} FROM planes_comerciales WHERE codigo = $1`, [codigo]);
  return r.rows[0] || null;
};

export const findDefaultByLegacy = async (plan = 'basico') => {
  const codigo = plan === 'con_postre_bebida'
    ? 'clasico_450_completo'
    : plan === 'con_postre'
      ? 'clasico_450_postre'
      : 'clasico_450';
  return findByCodigo(codigo);
};

export const create = async ({
  codigo,
  nombre,
  descripcion = null,
  gramaje_min,
  gramaje_max = null,
  incluye_postre = false,
  incluye_bebida = false,
  activo = true,
  orden = 0,
}) => {
  const r = await query(
    `INSERT INTO planes_comerciales (
       codigo, nombre, descripcion, gramaje_min, gramaje_max,
       incluye_postre, incluye_bebida, activo, orden
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${CAMPOS}`,
    [
      codigo,
      nombre,
      descripcion,
      gramaje_min,
      gramaje_max,
      Boolean(incluye_postre),
      Boolean(incluye_bebida),
      Boolean(activo),
      orden ?? 0,
    ]
  );
  return r.rows[0];
};

export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  const vals = Object.values(fields);
  const set = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  vals.push(id);
  const r = await query(
    `UPDATE planes_comerciales SET ${set}, updated_at = NOW()
     WHERE id = $${vals.length}
     RETURNING ${CAMPOS}`,
    vals
  );
  return r.rows[0] || null;
};

export const deactivate = async (id) => {
  const r = await query(
    `UPDATE planes_comerciales SET activo = false, updated_at = NOW()
     WHERE id = $1
     RETURNING ${CAMPOS}`,
    [id]
  );
  return r.rows[0] || null;
};
