// Fase G del teardown "la semana es el contenedor": rediseño de la unicidad de
// opción que Fase A dejó pendiente (ver design doc, Open Question #1 detalle).
//
// La constraint vieja unique_menu_dia_opcion (menu_semanal_id, dia, opcion) era
// GLOBAL: dos categorías distintas no podían usar la misma letra el mismo día
// (ej: Especiales "A" el lunes bloqueaba a una categoría custom "Especiales
// Semana Santa" usar su propia "A" el lunes). Ahora que las categorías son
// datos y una celda lleva categoria_id, la unicidad correcta es POR CATEGORÍA:
// (menu_semanal_id, categoria_id, dia, opcion).
//
// El índice es total (no parcial): las filas con opcion NULL (fijos, listas
// custom sin letra) o categoria_id NULL (Sin categorizar) tienen NULLs, que en
// un unique de Postgres son distintos entre sí -> no quedan restringidas por
// este índice (los fijos ya tienen sus propios índices parciales de Fase B, y
// una lista sin letra admite varios platos por día a propósito). Solo las filas
// con letra + categoría (especiales y custom con opción) quedan unívocas por
// categoría, que es exactamente lo buscado.
//
// Seguro sobre datos existentes: hoy todas las filas con opcion NOT NULL son
// especiales (categoria_id = Especiales), así que (menu, Especiales, dia, opcion)
// ya es único -> no hay colisiones al migrar.

export function up(pgm) {
  pgm.sql(`
    ALTER TABLE menu_semanal_dias DROP CONSTRAINT IF EXISTS unique_menu_dia_opcion;

    CREATE UNIQUE INDEX IF NOT EXISTS menu_semanal_dias_cat_dia_opcion_uidx
      ON menu_semanal_dias (menu_semanal_id, categoria_id, dia, opcion);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS menu_semanal_dias_cat_dia_opcion_uidx;

    -- Restaurar la constraint vieja solo es seguro si no quedaron dos categorías
    -- usando la misma (dia, opcion); en el estado inmediatamente posterior a
    -- esta migración eso no ocurre.
    ALTER TABLE menu_semanal_dias
      ADD CONSTRAINT unique_menu_dia_opcion UNIQUE (menu_semanal_id, dia, opcion);
  `);
}
