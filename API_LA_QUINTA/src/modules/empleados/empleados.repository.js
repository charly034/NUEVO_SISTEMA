import { query } from '../../database/connection.js';

export const findAll = async (empresa_id) => {
  const where = empresa_id ? 'WHERE e.empresa_id = $1' : '';
  const vals = empresa_id ? [empresa_id] : [];
  const r = await query(
    `SELECT e.id, e.nombre, e.apellido, e.email, e.activo, e.rol, e.empresa_id,
            e.telefono, e.fecha_nacimiento, emp.nombre AS empresa_nombre, e.created_at
     FROM empleados e
     JOIN empresas emp ON emp.id = e.empresa_id
     ${where}
     ORDER BY e.apellido ASC, e.nombre ASC`,
    vals
  );
  return r.rows;
};

export const findById = async (id) => {
  const r = await query(
    `SELECT e.id, e.nombre, e.apellido, e.email, e.activo, e.rol, e.empresa_id,
            e.telefono, e.fecha_nacimiento, emp.nombre AS empresa_nombre, emp.plan, emp.modo_pedido
     FROM empleados e JOIN empresas emp ON emp.id = e.empresa_id
     WHERE e.id = $1`,
    [id]
  );
  return r.rows[0] || null;
};

export const findByEmail = async (email) => {
  const r = await query('SELECT id FROM empleados WHERE LOWER(email) = LOWER($1)', [email]);
  return r.rows[0] || null;
};

export const create = async ({ empresa_id, nombre, apellido, email, password_hash, rol = 'cliente', telefono = null, fecha_nacimiento = null }) => {
  const r = await query(
    `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, rol, telefono, fecha_nacimiento)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, empresa_id, nombre, apellido, email, activo, rol, telefono, fecha_nacimiento, created_at`,
    [empresa_id, nombre, apellido, email, password_hash, rol, telefono, fecha_nacimiento]
  );
  return r.rows[0];
};

export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  const vals = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(id);
  const r = await query(
    `UPDATE empleados SET ${set}, updated_at = NOW() WHERE id = $${vals.length}
     RETURNING id, nombre, apellido, email, activo, rol, empresa_id, telefono, fecha_nacimiento`,
    vals
  );
  return r.rows[0] || null;
};

export const remove = async (id) => {
  const r = await query('DELETE FROM empleados WHERE id = $1 RETURNING id', [id]);
  return r.rows[0] || null;
};

export const setResetCode = async (id, code, expiresAt) => {
  await query(
    `UPDATE empleados SET reset_code = $1, reset_code_expires_at = $2 WHERE id = $3`,
    [code, expiresAt, id]
  );
};

export const clearResetCode = async (id) => {
  await query(
    `UPDATE empleados SET reset_code = NULL, reset_code_expires_at = NULL WHERE id = $1`,
    [id]
  );
};

export const findByResetCode = async (code) => {
  const r = await query(
    `SELECT e.id, e.email, e.nombre, e.activo, e.empresa_id,
            e.reset_code_expires_at
     FROM empleados e
     WHERE e.reset_code = $1`,
    [code.trim().toUpperCase()]
  );
  return r.rows[0] || null;
};

export const setPassword = async (id, password_hash) => {
  await query(
    `UPDATE empleados SET password_hash = $1 WHERE id = $2`,
    [password_hash, id]
  );
};

export const findWithPasswordById = async (id) => {
  const r = await query(
    `SELECT id, password_hash FROM empleados WHERE id = $1 AND activo = true`,
    [id]
  );
  return r.rows[0] || null;
};
