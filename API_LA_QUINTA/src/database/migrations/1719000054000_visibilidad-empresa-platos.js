export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS menu_empresa_visibilidad (
      id                  SERIAL PRIMARY KEY,
      menu_semanal_dia_id INTEGER NOT NULL REFERENCES menu_semanal_dias(id) ON DELETE CASCADE,
      empresa_id          INTEGER NOT NULL REFERENCES empresas(id)           ON DELETE CASCADE,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_menu_dia_empresa UNIQUE (menu_semanal_dia_id, empresa_id)
    );

    CREATE INDEX IF NOT EXISTS mev_menu_semanal_dia_id_idx ON menu_empresa_visibilidad (menu_semanal_dia_id);
    CREATE INDEX IF NOT EXISTS mev_empresa_id_idx          ON menu_empresa_visibilidad (empresa_id);

    CREATE TABLE IF NOT EXISTS plato_empresa_visibilidad (
      id         SERIAL PRIMARY KEY,
      plato_id   INTEGER NOT NULL REFERENCES platos(id)   ON DELETE CASCADE,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_plato_empresa UNIQUE (plato_id, empresa_id)
    );

    CREATE INDEX IF NOT EXISTS pev_plato_id_idx   ON plato_empresa_visibilidad (plato_id);
    CREATE INDEX IF NOT EXISTS pev_empresa_id_idx ON plato_empresa_visibilidad (empresa_id);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS plato_empresa_visibilidad;
    DROP TABLE IF EXISTS menu_empresa_visibilidad;
  `);
}
