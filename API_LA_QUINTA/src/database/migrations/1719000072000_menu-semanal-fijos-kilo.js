// "disponible_por_kilo" para platos FIJOS era hasta ahora un valor fijo
// (siempre true, sin excepcion posible) -- decision de sesion 2026-07-13
// que asumia que un fijo "esta puesto en el menu todas las semanas por
// definicion". El usuario pidio que TODOS los platos (fijos incluidos)
// puedan activarse/desactivarse para venta por kilo, semana a semana --
// mismo patron que ya existe para "sin_servicio" y para la vianda de
// fijos (menu_semanal_fijos_vianda): un fijo no tiene fila propia en
// menu_semanal_dias, asi que la excepcion se guarda en una tabla aparte
// keyed por (menu_semanal_id, plato_id).
//
// Polaridad invertida respecto a menu_semanal_fijos_vianda: ahi la fila
// ancla la decision ACTIVA (vianda_id). Aca el default es "disponible por
// kilo = true", asi que la fila representa la EXCEPCION (excluido esta
// semana) -- evita tener que insertar una fila para cada fijo de cada
// semana, solo para los que se sacan explicitamente.
export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS menu_semanal_fijos_kilo (
      id               SERIAL PRIMARY KEY,
      menu_semanal_id  INTEGER NOT NULL REFERENCES menus_semanales(id) ON DELETE CASCADE,
      plato_id         INTEGER NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (menu_semanal_id, plato_id)
    );

    CREATE INDEX IF NOT EXISTS menu_semanal_fijos_kilo_menu_idx ON menu_semanal_fijos_kilo (menu_semanal_id);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS menu_semanal_fijos_kilo;
  `);
}
