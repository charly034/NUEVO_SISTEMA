import { query } from '../../database/connection.js';

// ── Ancla global de rotacion (1 fila, se crea sola con el primer ciclo) ──

export const findRotacionConfig = async () => {
  const r = await query('SELECT fecha_ancla::text AS fecha_ancla FROM rotacion_config WHERE id = 1', []);
  return r.rows[0] || null;
};

export const crearRotacionConfigSiNoExiste = async (fechaAncla) => {
  await query(
    `INSERT INTO rotacion_config (id, fecha_ancla) VALUES (1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [fechaAncla]
  );
};

// ── Ciclos de rotacion ────────────────────────────────────────────────

export const findCiclos = async ({ dia_semana, activo } = {}) => {
  const conds = [];
  const vals = [];
  if (dia_semana) {
    vals.push(dia_semana);
    conds.push(`dia_semana = $${vals.length}`);
  }
  if (activo !== undefined) {
    vals.push(activo);
    conds.push(`activo = $${vals.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const r = await query(
    `SELECT id, dia_semana::text AS dia_semana, nombre, activo, created_at, updated_at
     FROM ciclo_rotacion ${where}
     ORDER BY dia_semana, nombre`,
    vals
  );
  return r.rows;
};

export const findCicloById = async (id) => {
  const r = await query(
    `SELECT id, dia_semana::text AS dia_semana, nombre, activo, created_at, updated_at
     FROM ciclo_rotacion WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
};

export const createCiclo = async ({ dia_semana, nombre }) => {
  const r = await query(
    `INSERT INTO ciclo_rotacion (dia_semana, nombre) VALUES ($1, $2) RETURNING id`,
    [dia_semana, nombre]
  );
  return findCicloById(r.rows[0].id);
};

export const updateCiclo = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findCicloById(id);
  const vals = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(id);
  const r = await query(
    `UPDATE ciclo_rotacion SET ${set}, updated_at = NOW() WHERE id = $${vals.length} RETURNING id`,
    vals
  );
  return r.rows[0] ? findCicloById(id) : null;
};

// ── Grupos rotativos (miembros del ciclo) ────────────────────────────

export const findGruposPorCiclo = async (cicloRotacionId, { soloActivos = false } = {}) => {
  const where = soloActivos ? 'AND activo = true' : '';
  const r = await query(
    `SELECT id, ciclo_rotacion_id, nombre, orden, activo, created_at, updated_at
     FROM grupo_rotativo
     WHERE ciclo_rotacion_id = $1 ${where}
     ORDER BY orden ASC`,
    [cicloRotacionId]
  );
  return r.rows;
};

export const findGrupoById = async (id) => {
  const r = await query(
    `SELECT id, ciclo_rotacion_id, nombre, orden, activo, created_at, updated_at
     FROM grupo_rotativo WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
};

export const createGrupo = async ({ ciclo_rotacion_id, nombre, orden }) => {
  const r = await query(
    `INSERT INTO grupo_rotativo (ciclo_rotacion_id, nombre, orden) VALUES ($1, $2, $3) RETURNING id`,
    [ciclo_rotacion_id, nombre, orden]
  );
  return findGrupoById(r.rows[0].id);
};

export const updateGrupo = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findGrupoById(id);
  const vals = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(id);
  const r = await query(
    `UPDATE grupo_rotativo SET ${set}, updated_at = NOW() WHERE id = $${vals.length} RETURNING id`,
    vals
  );
  return r.rows[0] ? findGrupoById(id) : null;
};

// ── Platos dentro de un grupo (N por grupo, orden=0 es el default) ───

export const findPlatosDeGrupo = async (grupoRotativoId) => {
  const r = await query(
    `SELECT grp.plato_id, grp.orden, p.nombre AS plato_nombre
     FROM grupo_rotativo_plato grp
     JOIN platos p ON p.id = grp.plato_id
     WHERE grp.grupo_rotativo_id = $1
     ORDER BY grp.orden ASC`,
    [grupoRotativoId]
  );
  return r.rows;
};

export const agregarPlatoAGrupo = async (grupoRotativoId, platoId, orden = 0) => {
  await query(
    `INSERT INTO grupo_rotativo_plato (grupo_rotativo_id, plato_id, orden)
     VALUES ($1, $2, $3)
     ON CONFLICT (grupo_rotativo_id, plato_id) DO UPDATE SET orden = EXCLUDED.orden`,
    [grupoRotativoId, platoId, orden]
  );
  return findPlatosDeGrupo(grupoRotativoId);
};

export const quitarPlatoDeGrupo = async (grupoRotativoId, platoId) => {
  await query(
    'DELETE FROM grupo_rotativo_plato WHERE grupo_rotativo_id = $1 AND plato_id = $2',
    [grupoRotativoId, platoId]
  );
  return findPlatosDeGrupo(grupoRotativoId);
};

// ── Seleccion/excepcion semanal (fuerza grupo y/o plato para una semana) ──

export const findSeleccionSemana = async (menuSemanalId, cicloRotacionId) => {
  const r = await query(
    `SELECT id, menu_semanal_id, ciclo_rotacion_id, grupo_rotativo_id, plato_id, created_at
     FROM grupo_rotativo_seleccion_semana
     WHERE menu_semanal_id = $1 AND ciclo_rotacion_id = $2`,
    [menuSemanalId, cicloRotacionId]
  );
  return r.rows[0] || null;
};

export const upsertSeleccionSemana = async ({ menu_semanal_id, ciclo_rotacion_id, grupo_rotativo_id, plato_id }) => {
  await query(
    `INSERT INTO grupo_rotativo_seleccion_semana (menu_semanal_id, ciclo_rotacion_id, grupo_rotativo_id, plato_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (menu_semanal_id, ciclo_rotacion_id) DO UPDATE
       SET grupo_rotativo_id = EXCLUDED.grupo_rotativo_id, plato_id = EXCLUDED.plato_id`,
    [menu_semanal_id, ciclo_rotacion_id, grupo_rotativo_id, plato_id ?? null]
  );
  return findSeleccionSemana(menu_semanal_id, ciclo_rotacion_id);
};

export const deleteSeleccionSemana = async (menuSemanalId, cicloRotacionId) => {
  await query(
    'DELETE FROM grupo_rotativo_seleccion_semana WHERE menu_semanal_id = $1 AND ciclo_rotacion_id = $2',
    [menuSemanalId, cicloRotacionId]
  );
};
