// "vianda_activa" para platos FIJOS (fijo_dia/siempre/rotativo) era, hasta
// ahora, una propiedad del CATALOGO: existsActivaParaPlato(plato_id) solo
// preguntaba "¿este plato tiene ALGUNA vianda activa alguna vez?", sin
// importar si de verdad se decidio ofrecerlo como vianda ESTA semana --
// distinto de los especiales, que ya anclan su decision por semana via
// menu_semanal_dias.vianda_id (hallazgo de sesion con el usuario, PDF
// SEMANA VIANDAS de referencia: cada celda es una decision por-semana, no
// un atributo permanente del plato). Como los fijos no tienen fila propia
// en menu_semanal_dias, esta tabla es su equivalente: el mismo anclaje
// (menu_semanal_id + plato_id -> vianda_id), pero sin depender de un slot
// de dia/opcion que los fijos no tienen.

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS menu_semanal_fijos_vianda (
      id               SERIAL PRIMARY KEY,
      menu_semanal_id  INTEGER NOT NULL REFERENCES menus_semanales(id) ON DELETE CASCADE,
      plato_id         INTEGER NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
      vianda_id        INTEGER NOT NULL REFERENCES viandas(id) ON DELETE RESTRICT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (menu_semanal_id, plato_id)
    );

    CREATE INDEX IF NOT EXISTS menu_semanal_fijos_vianda_menu_idx ON menu_semanal_fijos_vianda (menu_semanal_id);
    CREATE INDEX IF NOT EXISTS menu_semanal_fijos_vianda_vianda_idx ON menu_semanal_fijos_vianda (vianda_id);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS menu_semanal_fijos_vianda;
  `);
}
