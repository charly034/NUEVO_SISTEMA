// plan-eng-review T2: la resolución guarnición/salsa del slot pasa a ATÓMICA POR
// CAPA (modo+id se resuelven como un bloque por capa, ver pedidos.repository.js
// VIANDA_SLOT_COLS). El modelo anterior (per-columna) resolvía el modo con un CASE
// y el id con un COALESCE independiente, lo que permitía filas INCOHERENTES: un
// `*_fija_override_id` seteado SIN su `*_modo_override` (patrón del seed histórico,
// seed-catalogo-menus.js, que pinneaba una guarnición por id sin fijar el modo).
//
// Esta migración normaliza esas filas SIN cambiar lo que ve el cliente:
//   - Si la vianda del slot tiene guarnición/salsa (el slot ya resolvía 'fija' y
//     servía el id del override vía COALESCE): se explicita modo='fija' → el id del
//     override sigue ganando, comportamiento idéntico.
//   - Si no (el slot resolvía 'libre'/'sin' y el id del override era dead data que
//     el cliente nunca recibía): se borra el id → la fila queda coherente y el
//     cliente sigue viendo exactamente lo mismo ('a elección' / sin).
//
// Es la precondición para que el read atómico dé resultado byte-idéntico al viejo
// sobre la data real (ver test pedidos-resolucion-atomica.db.test.js).

export function up(pgm) {
  pgm.sql(`
    -- Guarnición: pin con vianda-que-tiene-guarnición → explicitar modo 'fija'.
    UPDATE menu_semanal_dias msd
       SET guarnicion_modo_override = 'fija'
      FROM viandas v
     WHERE v.id = msd.vianda_id
       AND msd.guarnicion_modo_override IS NULL
       AND msd.guarnicion_fija_override_id IS NOT NULL
       AND v.guarnicion_id IS NOT NULL;

    -- Guarnición: pin muerto (sin vianda-guarnición, resolvía 'libre'/'sin') → limpiar id.
    UPDATE menu_semanal_dias msd
       SET guarnicion_fija_override_id = NULL
     WHERE msd.guarnicion_modo_override IS NULL
       AND msd.guarnicion_fija_override_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM viandas v WHERE v.id = msd.vianda_id AND v.guarnicion_id IS NOT NULL
       );

    -- Salsa: mismo criterio (hoy 0 filas afectadas, se deja por simetría/futuro).
    UPDATE menu_semanal_dias msd
       SET salsa_modo_override = 'fija'
      FROM viandas v
     WHERE v.id = msd.vianda_id
       AND msd.salsa_modo_override IS NULL
       AND msd.salsa_fija_override_id IS NOT NULL
       AND v.salsa_id IS NOT NULL;

    UPDATE menu_semanal_dias msd
       SET salsa_fija_override_id = NULL
     WHERE msd.salsa_modo_override IS NULL
       AND msd.salsa_fija_override_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM viandas v WHERE v.id = msd.vianda_id AND v.salsa_id IS NOT NULL
       );
  `);
}

export function down() {
  // Normalización de datos: irreversible por diseño. No se puede (ni tiene sentido)
  // reconstruir el estado incoherente previo. No-op.
}
