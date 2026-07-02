import { query } from '../../database/connection.js';

export async function findBySemana(empleadoId, semanaInicio) {
  const { rows } = await query(
    `SELECT id, semana_inicio, ideas, comentario, created_at
     FROM sugerencias_empleados
     WHERE empleado_id = $1 AND semana_inicio = $2`,
    [empleadoId, semanaInicio]
  );
  return rows[0] || null;
}

export async function crear({ empleadoId, semanaInicio, ideas, comentario }) {
  const { rows } = await query(
    `INSERT INTO sugerencias_empleados (empleado_id, semana_inicio, ideas, comentario)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (empleado_id, semana_inicio)
     DO UPDATE SET ideas = EXCLUDED.ideas, comentario = EXCLUDED.comentario
     RETURNING *`,
    [empleadoId, semanaInicio, ideas, comentario || null]
  );
  return rows[0];
}
