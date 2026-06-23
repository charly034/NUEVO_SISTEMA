import { query } from '../../database/connection.js';

const CAMPOS = 'id, nombre, apellido, email, rol, activo, created_at';

export const findAll = async () => {
  const r = await query(`SELECT ${CAMPOS} FROM usuarios_admin ORDER BY nombre ASC`);
  return r.rows;
};

export const findById = async (id) => {
  const r = await query(`SELECT ${CAMPOS} FROM usuarios_admin WHERE id = $1`, [id]);
  return r.rows[0] || null;
};

export const findByEmail = async (email) => {
  const r = await query(
    `SELECT id, nombre, apellido, email, password_hash, rol, activo FROM usuarios_admin WHERE LOWER(email) = LOWER($1)`,
    [email.trim()]
  );
  return r.rows[0] || null;
};

export const create = async ({ nombre, apellido, email, password_hash, rol = 'admin' }) => {
  const r = await query(
    `INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${CAMPOS}`,
    [nombre.trim(), apellido.trim(), email.trim().toLowerCase(), password_hash, rol]
  );
  return r.rows[0];
};

export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  const vals = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(id);
  const r = await query(
    `UPDATE usuarios_admin SET ${set} WHERE id = $${vals.length} RETURNING ${CAMPOS}`,
    vals
  );
  return r.rows[0] || null;
};

export const remove = async (id) => {
  const r = await query('DELETE FROM usuarios_admin WHERE id = $1 RETURNING id', [id]);
  return r.rows[0] || null;
};
