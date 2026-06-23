import { query } from '../../database/connection.js';

const CAMPOS = 'id, nombre, slug, plan, modo_pedido, activo, limite_hora, limite_dia_semana, limite_anticipacion_dias, plazo_override_hasta, dias_laborales, created_at';

export const findAll = async () => {
  const r = await query(`SELECT ${CAMPOS} FROM empresas ORDER BY nombre ASC`);
  return r.rows;
};

export const findById = async (id) => {
  const r = await query('SELECT * FROM empresas WHERE id = $1', [id]);
  return r.rows[0] || null;
};

export const findBySlug = async (slug) => {
  const r = await query('SELECT * FROM empresas WHERE LOWER(slug) = LOWER($1)', [slug]);
  return r.rows[0] || null;
};

export const create = async ({
  nombre,
  slug,
  plan,
  modo_pedido,
  dias_laborales,
  limite_hora,
  limite_dia_semana,
  limite_anticipacion_dias,
}) => {
  const r = await query(
    `INSERT INTO empresas (
       nombre, slug, plan, modo_pedido, dias_laborales,
       limite_hora, limite_dia_semana, limite_anticipacion_dias
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${CAMPOS}`,
    [
      nombre,
      slug,
      plan || 'basico',
      modo_pedido || 'semanal',
      dias_laborales || 'lunes_viernes',
      limite_hora || null,
      limite_dia_semana || null,
      limite_anticipacion_dias ?? 0,
    ]
  );
  return r.rows[0];
};

export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  const vals = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(id);
  const r = await query(
    `UPDATE empresas SET ${set} WHERE id = $${vals.length}
     RETURNING ${CAMPOS}`,
    vals
  );
  return r.rows[0] || null;
};

export const remove = async (id) => {
  const r = await query('DELETE FROM empresas WHERE id = $1 RETURNING id', [id]);
  return r.rows[0] || null;
};

export const setOverride = async (id, hasta) => {
  const r = await query(
    `UPDATE empresas SET plazo_override_hasta = $1 WHERE id = $2 RETURNING ${CAMPOS}`,
    [hasta, id]
  );
  return r.rows[0] || null;
};

export const clearOverride = async (id) => {
  const r = await query(
    `UPDATE empresas SET plazo_override_hasta = NULL WHERE id = $1 RETURNING ${CAMPOS}`,
    [id]
  );
  return r.rows[0] || null;
};
