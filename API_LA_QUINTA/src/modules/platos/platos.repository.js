import { query } from '../../database/connection.js';

const SELECT_COLS = `
  id, nombre, descripcion, tags, tipo, tiene_guarnicion, activo,
  vegetariano, calorias, alergenos, foto_url, descripcion_larga,
  disponibilidad, dia_fijo,
  created_at, updated_at
`;

const SORT_MAP = {
  nombre:     'p.nombre',
  activo:     'p.activo',
  created_at: 'p.created_at',
  ultimo_uso: 'h.fecha_servicio',
};

export const findAll = async ({ limit = 20, offset = 0, activo, search, tag, tipo, disponibilidad, sort_by = 'nombre', sort_dir = 'asc' } = {}) => {
  const conditions = [];
  const values = [];

  if (activo !== undefined) {
    values.push(activo === 'true');
    conditions.push(`activo = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(p.nombre ILIKE $${values.length} OR p.descripcion ILIKE $${values.length})`);
  }
  if (tag) {
    values.push(tag);
    conditions.push(`$${values.length} = ANY(p.tags)`);
  }
  if (tipo) {
    values.push(tipo);
    conditions.push(`p.tipo = $${values.length}`);
  }
  if (disponibilidad) {
    values.push(disponibilidad);
    conditions.push(`p.disponibilidad = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const col   = SORT_MAP[sort_by] ?? 'p.nombre';
  const dir   = sort_dir === 'desc' ? 'DESC' : 'ASC';
  const nulls = sort_by === 'ultimo_uso' ? 'NULLS LAST' : '';
  // Solo agrega nombre como secundario si no es la columna primaria
  const secondary = col !== 'p.nombre' ? ', p.nombre ASC' : '';

  values.push(limit, offset);
  const result = await query(
    `SELECT p.id, p.nombre, p.descripcion, p.tags, p.tipo, p.tiene_guarnicion,
            p.activo, p.vegetariano, p.calorias, p.alergenos, p.foto_url,
            p.descripcion_larga, p.disponibilidad, p.dia_fijo, p.created_at, p.updated_at,
            h.fecha_servicio AS ultimo_uso_fecha,
            h.dia            AS ultimo_uso_dia,
            h.opcion         AS ultimo_uso_opcion,
            h.menu_nombre    AS ultimo_uso_menu
     FROM platos p
     LEFT JOIN LATERAL (
       SELECT h2.fecha_servicio, h2.dia, h2.opcion, ms2.nombre AS menu_nombre
       FROM historial_uso_platos h2
       LEFT JOIN menus_semanales ms2 ON ms2.id = h2.menu_semanal_id
       WHERE h2.plato_id = p.id
       ORDER BY h2.fecha_servicio DESC
       LIMIT 1
     ) h ON true
     ${where}
     ORDER BY ${col} ${dir} ${nulls}${secondary}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return result.rows.map(r => ({
    id: r.id, nombre: r.nombre, descripcion: r.descripcion,
    tags: r.tags, tipo: r.tipo, tiene_guarnicion: r.tiene_guarnicion,
    activo: r.activo, vegetariano: r.vegetariano, calorias: r.calorias,
    alergenos: r.alergenos, foto_url: r.foto_url,
    descripcion_larga: r.descripcion_larga,
    disponibilidad: r.disponibilidad, dia_fijo: r.dia_fijo,
    created_at: r.created_at, updated_at: r.updated_at,
    ultimo_uso: r.ultimo_uso_fecha
      ? { fecha_servicio: r.ultimo_uso_fecha, dia: r.ultimo_uso_dia, opcion: r.ultimo_uso_opcion, menu_semanal_nombre: r.ultimo_uso_menu }
      : null,
  }));
};

export const countAll = async ({ activo, search, tag, tipo, disponibilidad } = {}) => {
  const conditions = [];
  const values = [];

  if (activo !== undefined) {
    values.push(activo === 'true');
    conditions.push(`activo = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(nombre ILIKE $${values.length} OR descripcion ILIKE $${values.length})`);
  }
  if (tag) {
    values.push(tag);
    conditions.push(`$${values.length} = ANY(tags)`);
  }
  if (tipo) {
    values.push(tipo);
    conditions.push(`tipo = $${values.length}`);
  }
  if (disponibilidad) {
    values.push(disponibilidad);
    conditions.push(`disponibilidad = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`SELECT COUNT(*) as total FROM platos ${where}`, values);
  return parseInt(result.rows[0].total, 10);
};

export const findById = async (id) => {
  const result = await query(
    `SELECT ${SELECT_COLS} FROM platos WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

export const findAllTags = async () => {
  const result = await query(
    `SELECT DISTINCT unnest(tags) AS tag FROM platos WHERE activo = true ORDER BY tag ASC`
  );
  return result.rows.map((r) => r.tag);
};

export const create = async ({
  nombre,
  descripcion,
  tags = [],
  tipo = 'especial',
  tiene_guarnicion = false,
  vegetariano = false,
  calorias = null,
  alergenos = [],
  foto_url = null,
  descripcion_larga = null,
  disponibilidad = 'especial',
  dia_fijo = null,
}) => {
  const result = await query(
    `INSERT INTO platos (
       nombre, descripcion, tags, tipo, tiene_guarnicion,
       vegetariano, calorias, alergenos, foto_url, descripcion_larga,
       disponibilidad, dia_fijo
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${SELECT_COLS}`,
    [
      nombre,
      descripcion ?? null,
      tags,
      tipo,
      tiene_guarnicion,
      vegetariano,
      calorias,
      alergenos,
      foto_url,
      descripcion_larga,
      disponibilidad,
      dia_fijo,
    ]
  );
  return result.rows[0];
};

export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  values.push(id);

  const result = await query(
    `UPDATE platos SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}
     RETURNING ${SELECT_COLS}`,
    values
  );
  return result.rows[0] || null;
};

export const remove = async (id) => {
  const result = await query('DELETE FROM platos WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
};

export const isUsedInMenuSemanal = async (id) => {
  const result = await query(
    'SELECT 1 FROM menu_semanal_dias WHERE plato_id = $1 LIMIT 1',
    [id]
  );
  return result.rows.length > 0;
};

// ── Visibilidad por empresa ───────────────────────────────────────

export const findVisibilidadEmpresas = async (platoId) => {
  const result = await query(
    `SELECT e.id, e.nombre
     FROM plato_empresa_visibilidad pev
     JOIN empresas e ON e.id = pev.empresa_id
     WHERE pev.plato_id = $1
     ORDER BY e.nombre ASC`,
    [platoId]
  );
  return result.rows;
};

// Reemplaza toda la lista de empresas con visibilidad para un plato
export const setVisibilidadEmpresas = async (platoId, empresaIds) => {
  await query('DELETE FROM plato_empresa_visibilidad WHERE plato_id = $1', [platoId]);
  if (empresaIds.length === 0) return [];
  const values = empresaIds.map((_, i) => `($1, $${i + 2})`).join(', ');
  const result = await query(
    `INSERT INTO plato_empresa_visibilidad (plato_id, empresa_id) VALUES ${values}
     ON CONFLICT DO NOTHING
     RETURNING empresa_id`,
    [platoId, ...empresaIds]
  );
  return result.rows.map((r) => r.empresa_id);
};

// ── Disponibilidad en el Local (calendario: diario / dia(s) de semana / fecha puntual) ──
// El Local no genera pedidos ni ventas en este sistema; este calendario solo alimenta
// el checklist de Cocina.

export const findDisponibilidadLocal = async (platoId) => {
  const result = await query(
    `SELECT id, patron, dia_semana, fecha, created_at
     FROM plato_disponibilidad_local
     WHERE plato_id = $1
     ORDER BY patron ASC, dia_semana ASC NULLS LAST, fecha ASC NULLS LAST`,
    [platoId]
  );
  return result.rows;
};

// Reemplaza todo el calendario de un plato en una transaccion (delete + insert)
export const setDisponibilidadLocal = async (platoId, entradas) => {
  await query('DELETE FROM plato_disponibilidad_local WHERE plato_id = $1', [platoId]);
  if (entradas.length === 0) return [];
  const values = [];
  const placeholders = entradas.map((entrada, i) => {
    const base = i * 4;
    values.push(platoId, entrada.patron, entrada.dia_semana ?? null, entrada.fecha ?? null);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
  }).join(', ');
  const result = await query(
    `INSERT INTO plato_disponibilidad_local (plato_id, patron, dia_semana, fecha)
     VALUES ${placeholders}
     RETURNING id, patron, dia_semana, fecha, created_at`,
    values
  );
  return result.rows;
};

// Platos disponibles en el Local para una fecha dada: diario + dia_semana que matchea + fecha puntual.
// Usada por Cocina para el checklist, sin cantidades.
export const findParaFecha = async (fecha) => {
  const result = await query(
    `SELECT DISTINCT p.id, p.nombre, p.descripcion, p.foto_url
     FROM plato_disponibilidad_local pdl
     JOIN platos p ON p.id = pdl.plato_id
     WHERE p.activo = true
       AND (
         pdl.patron = 'diario'
         OR (
           pdl.patron = 'dia_semana'
           AND pdl.dia_semana::text = (ARRAY['domingo','lunes','martes','miercoles','jueves','viernes','sabado'])[EXTRACT(DOW FROM $1::date)::int + 1]
         )
         OR (pdl.patron = 'fecha' AND pdl.fecha = $1::date)
       )
     ORDER BY p.nombre ASC`,
    [fecha]
  );
  return result.rows;
};
