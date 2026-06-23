import { query } from '../../database/connection.js';

export const registrar = async ({ plato_id, plato_nombre_snapshot, menu_semanal_id, dia, opcion, fecha_servicio }) => {
  await query(
    `INSERT INTO historial_uso_platos
       (plato_id, plato_nombre_snapshot, menu_semanal_id, dia, opcion, fecha_servicio)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING`,
    [plato_id, plato_nombre_snapshot, menu_semanal_id, dia, opcion, fecha_servicio]
  );
};

// Historial completo de un plato, del más reciente al más antiguo
export const findByPlato = async (platoId) => {
  const result = await query(
    `SELECT h.id, h.dia, h.opcion, h.fecha_servicio, h.plato_nombre_snapshot,
            h.menu_semanal_id, ms.nombre AS menu_semanal_nombre
     FROM historial_uso_platos h
     LEFT JOIN menus_semanales ms ON ms.id = h.menu_semanal_id
     WHERE h.plato_id = $1
     ORDER BY h.fecha_servicio DESC`,
    [platoId]
  );
  return result.rows;
};

// Última fecha en que se usó cada plato — para enriquecer la lista de platos
export const findUltimoUso = async (platoIds) => {
  if (platoIds.length === 0) return {};

  const placeholders = platoIds.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(
    `SELECT DISTINCT ON (plato_id)
            plato_id, fecha_servicio, dia, opcion
     FROM historial_uso_platos
     WHERE plato_id IN (${placeholders})
     ORDER BY plato_id, fecha_servicio DESC`,
    platoIds
  );
  return Object.fromEntries(result.rows.map((r) => [r.plato_id, r]));
};

// Construye el rango de fechas desde los filtros recibidos.
// Prioridad: desde/hasta explícito > dias > mes > semana > (sin filtro = todo)
const buildRango = (filtros) => {
  const { desde, hasta, dias, mes, semana } = filtros;

  if (desde || hasta) {
    return { desde: desde ?? null, hasta: hasta ?? null };
  }

  if (dias) {
    return { desde: `CURRENT_DATE - INTERVAL '${parseInt(dias, 10)} days'`, hasta: null };
  }

  if (mes) {
    // mes = 'YYYY-MM'  →  primer y último día del mes
    return {
      desde: `DATE_TRUNC('month', DATE '${mes}-01')`,
      hasta: `(DATE_TRUNC('month', DATE '${mes}-01') + INTERVAL '1 month - 1 day')::date`,
    };
  }

  if (semana) {
    // semana = 'YYYY-Www' (ISO, ej: 2026-W25)  →  lunes y domingo de esa semana
    return {
      desde: `DATE_TRUNC('week', TO_DATE('${semana}', 'IYYY-"W"IW'))::date`,
      hasta: `(DATE_TRUNC('week', TO_DATE('${semana}', 'IYYY-"W"IW')) + INTERVAL '6 days')::date`,
    };
  }

  return { desde: null, hasta: null };
};

// Agrega condiciones WHERE para el rango de fechas a un array de conditions/values
const applyRango = (rango, conditions, values) => {
  if (rango.desde) {
    // Si es una expresión SQL la incrustamos directamente; si es una fecha literal usamos parámetro
    if (rango.desde.startsWith('CURRENT_DATE') || rango.desde.startsWith('DATE_TRUNC') || rango.desde.startsWith('(DATE')) {
      conditions.push(`fecha_servicio >= ${rango.desde}`);
    } else {
      values.push(rango.desde);
      conditions.push(`fecha_servicio >= $${values.length}`);
    }
  }
  if (rango.hasta) {
    if (rango.hasta.startsWith('CURRENT_DATE') || rango.hasta.startsWith('DATE_TRUNC') || rango.hasta.startsWith('(DATE')) {
      conditions.push(`fecha_servicio <= ${rango.hasta}`);
    } else {
      values.push(rango.hasta);
      conditions.push(`fecha_servicio <= $${values.length}`);
    }
  }
};

// Platos usados dentro del rango indicado
export const findUsados = async (filtros) => {
  const rango = buildRango(filtros);
  const conditions = [];
  const values = [];
  applyRango(rango, conditions, values);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT DISTINCT ON (plato_id)
            plato_id, plato_nombre_snapshot, fecha_servicio, dia, opcion
     FROM historial_uso_platos
     ${where}
     ORDER BY plato_id, fecha_servicio DESC`,
    values
  );
  return result.rows;
};

// Platos NO usados dentro del rango indicado (candidatos para el próximo menú)
export const findNoUsados = async (filtros) => {
  const rango = buildRango(filtros);
  const conditions = [];
  const values = [];
  applyRango(rango, conditions, values);

  // Sub-query: ids de platos que SÍ se usaron en el rango
  const subWhere = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT p.id, p.nombre, p.descripcion,
            MAX(h_all.fecha_servicio) AS ultima_vez_usado,
            CURRENT_DATE - MAX(h_all.fecha_servicio)::date AS dias_desde_ultimo_uso
     FROM platos p
     LEFT JOIN historial_uso_platos h_all ON h_all.plato_id = p.id
     WHERE p.activo = true
       AND p.id NOT IN (
         SELECT DISTINCT plato_id
         FROM historial_uso_platos
         WHERE plato_id IS NOT NULL ${subWhere}
       )
     GROUP BY p.id, p.nombre, p.descripcion
     ORDER BY dias_desde_ultimo_uso DESC NULLS FIRST, p.nombre ASC`,
    values
  );
  return result.rows;
};
