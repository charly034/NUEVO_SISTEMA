// Visibilidad por empresa de un plato FIJO era, hasta ahora, una propiedad
// del CATALOGO (tabla plato_empresa_visibilidad, sin nocion de semana) --
// mismo problema conceptual que ya se corrigio para vianda_activa de fijos
// (ver menu_semanal_fijos_vianda): el usuario senalo en sesion 2026-07-13
// que "quienes pueden ver o no ver [un fijo] es propiedad de la vianda EN
// LA SEMANA, no del plato o vianda en el catalogo".
//
// Confirmado antes de crear esta migracion: plato_empresa_visibilidad tiene
// 0 filas en uso hoy (para cualquier plato, no solo fijos) -- no hace falta
// migrar datos existentes, se puede partir de cero. La tabla de catalogo
// sigue existiendo y sigue aplicando a ESPECIALES (via filtroVisibilidadPlato
// en pedidos.repository.js), esta migracion no la toca; solo agrega el
// mecanismo por-semana que faltaba para fijos.
//
// Mismo modelo allowlist que menu_empresa_visibilidad: sin filas = visible
// para todas las empresas; con filas = solo para las listadas. Sin slot_id
// (los fijos no tienen fila en menu_semanal_dias), por eso el anclaje es
// directamente (menu_semanal_id, plato_id), como menu_semanal_fijos_vianda.
export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS menu_semanal_fijos_visibilidad (
      id               SERIAL PRIMARY KEY,
      menu_semanal_id  INTEGER NOT NULL REFERENCES menus_semanales(id) ON DELETE CASCADE,
      plato_id         INTEGER NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
      empresa_id       INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (menu_semanal_id, plato_id, empresa_id)
    );

    CREATE INDEX IF NOT EXISTS menu_semanal_fijos_visibilidad_menu_plato_idx
      ON menu_semanal_fijos_visibilidad (menu_semanal_id, plato_id);
    CREATE INDEX IF NOT EXISTS menu_semanal_fijos_visibilidad_empresa_idx
      ON menu_semanal_fijos_visibilidad (empresa_id);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS menu_semanal_fijos_visibilidad;
  `);
}
