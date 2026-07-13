// Fase B del teardown "la semana es el contenedor". Indices unicos parciales
// para proteger de fijos duplicados cuando se materialicen como filas de
// menu_semanal_dias (Fase C). Son el "rediseno de constraint" que el design
// doc dejaba pendiente para esta fase.
//
// Por que parciales sobre (opcion IS NULL): los fijos no usan letra de opcion,
// asi que su identidad es el plato dentro de la categoria (no la ranura
// dia/opcion como los especiales). La constraint vieja unique_menu_dia_opcion
// (menu, dia, opcion) sigue INTACTA -- protege a los especiales y la usa el
// ON CONFLICT de agregarPlato. Estos indices son ADITIVOS y hoy matchean 0
// filas (no hay ninguna fila con opcion NULL todavia), asi que crearlos es
// seguro y sin efecto observable.

export function up(pgm) {
  pgm.sql(`
    -- Fijos de siempre: un plato no se repite en la categoria del menu (dia NULL).
    CREATE UNIQUE INDEX IF NOT EXISTS menu_semanal_dias_fijo_siempre_uidx
      ON menu_semanal_dias (menu_semanal_id, categoria_id, plato_id)
      WHERE opcion IS NULL AND dia IS NULL;

    -- Fijos x dia: un plato no se repite en el mismo dia de la categoria del menu.
    CREATE UNIQUE INDEX IF NOT EXISTS menu_semanal_dias_fijo_dia_uidx
      ON menu_semanal_dias (menu_semanal_id, categoria_id, plato_id, dia)
      WHERE opcion IS NULL AND dia IS NOT NULL;
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS menu_semanal_dias_fijo_dia_uidx;
    DROP INDEX IF EXISTS menu_semanal_dias_fijo_siempre_uidx;
  `);
}
