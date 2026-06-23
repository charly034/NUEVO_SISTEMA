import { query } from '../../database/connection.js';

export const findAll = async (soloActivas = false) => {
  const where = soloActivas ? 'WHERE activo = true' : '';
  const r = await query(`SELECT id, nombre, activo, created_at FROM guarniciones ${where} ORDER BY nombre ASC`);
  return r.rows;
};

export const findById = async (id) => {
  const r = await query('SELECT id, nombre, activo FROM guarniciones WHERE id = $1', [id]);
  return r.rows[0] || null;
};

export const create = async (nombre) => {
  const r = await query(
    'INSERT INTO guarniciones (nombre) VALUES ($1) RETURNING id, nombre, activo, created_at',
    [nombre]
  );
  return r.rows[0];
};

export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  const vals = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(id);
  const r = await query(
    `UPDATE guarniciones SET ${set} WHERE id = $${vals.length} RETURNING id, nombre, activo`,
    vals
  );
  return r.rows[0] || null;
};

export const remove = async (id) => {
  const r = await query('DELETE FROM guarniciones WHERE id = $1 RETURNING id', [id]);
  return r.rows[0] || null;
};
