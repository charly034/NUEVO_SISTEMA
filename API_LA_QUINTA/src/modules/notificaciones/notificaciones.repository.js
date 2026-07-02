import { query } from '../../database/connection.js';

export async function findByEmpleado(empleadoId, limit = 50) {
  const { rows } = await query(
    `SELECT id, tipo, titulo, cuerpo, leida, created_at
     FROM notificaciones
     WHERE empleado_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [empleadoId, limit]
  );
  return rows;
}

export async function countNoLeidas(empleadoId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM notificaciones WHERE empleado_id = $1 AND leida = FALSE`,
    [empleadoId]
  );
  return rows[0].count;
}

export async function marcarLeida(id, empleadoId) {
  const { rows } = await query(
    `UPDATE notificaciones SET leida = TRUE
     WHERE id = $1 AND empleado_id = $2
     RETURNING id`,
    [id, empleadoId]
  );
  return rows[0] || null;
}

export async function marcarTodasLeidas(empleadoId) {
  const { rowCount } = await query(
    `UPDATE notificaciones SET leida = TRUE WHERE empleado_id = $1 AND leida = FALSE`,
    [empleadoId]
  );
  return rowCount;
}

export async function crear({ empleadoId, tipo = 'sistema', titulo, cuerpo }) {
  const { rows } = await query(
    `INSERT INTO notificaciones (empleado_id, tipo, titulo, cuerpo)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [empleadoId, tipo, titulo, cuerpo]
  );
  return rows[0];
}
