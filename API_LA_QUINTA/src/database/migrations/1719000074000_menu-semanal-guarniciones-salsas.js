// Guarniciones y salsas "sueltas" ofrecidas una semana puntual (venta en el
// local, independiente de formar parte de la composicion de una vianda) --
// pedido de sesion 2026-07-13: poder sumarlas al Resumen semanal igual que
// los platos fijos, colapsadas por defecto (mismo patron que "Fijos de
// siempre"). No hay tabla previa que registre esto: guarniciones/salsas
// hasta ahora solo existian como catalogo (guarniciones, salsas) o como
// componente de una vianda (viandas.guarnicion_id/salsa_id) -- nunca como
// item propio ofrecido en una semana.
//
// Mismo modelo que menu_semanal_fijos_vianda: ancla simple por
// (menu_semanal_id, entidad_id), sin necesidad de slot de dia/opcion.
export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS menu_semanal_guarniciones (
      id               SERIAL PRIMARY KEY,
      menu_semanal_id  INTEGER NOT NULL REFERENCES menus_semanales(id) ON DELETE CASCADE,
      guarnicion_id    INTEGER NOT NULL REFERENCES guarniciones(id) ON DELETE CASCADE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (menu_semanal_id, guarnicion_id)
    );

    CREATE INDEX IF NOT EXISTS menu_semanal_guarniciones_menu_idx ON menu_semanal_guarniciones (menu_semanal_id);

    CREATE TABLE IF NOT EXISTS menu_semanal_salsas (
      id               SERIAL PRIMARY KEY,
      menu_semanal_id  INTEGER NOT NULL REFERENCES menus_semanales(id) ON DELETE CASCADE,
      salsa_id         INTEGER NOT NULL REFERENCES salsas(id) ON DELETE CASCADE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (menu_semanal_id, salsa_id)
    );

    CREATE INDEX IF NOT EXISTS menu_semanal_salsas_menu_idx ON menu_semanal_salsas (menu_semanal_id);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS menu_semanal_guarniciones;
    DROP TABLE IF EXISTS menu_semanal_salsas;
  `);
}
