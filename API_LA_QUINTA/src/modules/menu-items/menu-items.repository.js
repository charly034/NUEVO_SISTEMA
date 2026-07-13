import { query } from '../../database/connection.js';

// Una fila de menu_semanal_dias = un "item" del menú de la semana (una celda:
// un plato en un día/opción de una categoría). Teardown "la semana es el
// contenedor": esta es la unidad que se reasigna de categoría o se borra suelta.

export const findById = async (id) => {
  const r = await query(
    `SELECT id, menu_semanal_id, dia::text AS dia, opcion, plato_id, categoria_id,
            vianda_id, disponible_por_kilo
     FROM menu_semanal_dias WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
};

export const setCategoria = async (id, categoriaId) => {
  const r = await query(
    'UPDATE menu_semanal_dias SET categoria_id = $2 WHERE id = $1 RETURNING id',
    [id, categoriaId]
  );
  return r.rows[0] ? findById(id) : null;
};

export const remove = async (id) => {
  const r = await query('DELETE FROM menu_semanal_dias WHERE id = $1 RETURNING id', [id]);
  return Boolean(r.rows[0]);
};

// Inserta una celda nueva en una categoría (agregar plato desde la tabla). dia
// y opcion pueden ir NULL según el tipo de categoría (lista sin letra / modo
// único). La unicidad por (menu, categoria, dia, opcion) la garantiza el índice
// menu_semanal_dias_cat_dia_opcion_uidx (Fase G).
export const insertItem = async ({ menu_semanal_id, categoria_id, plato_id, dia, opcion, vianda_id, disponible_por_kilo }) => {
  const r = await query(
    `INSERT INTO menu_semanal_dias
       (menu_semanal_id, categoria_id, plato_id, dia, opcion, vianda_id, disponible_por_kilo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [menu_semanal_id, categoria_id, plato_id, dia ?? null, opcion ?? null, vianda_id ?? null, disponible_por_kilo]
  );
  return findById(r.rows[0].id);
};
