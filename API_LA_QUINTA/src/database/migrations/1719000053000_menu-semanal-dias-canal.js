export function up(pgm) {
  pgm.sql(`
    ALTER TABLE menu_semanal_dias
      ADD COLUMN IF NOT EXISTS canal                    plato_canal     NOT NULL DEFAULT 'vianda',
      ADD COLUMN IF NOT EXISTS guarnicion_modo_override guarnicion_modo NULL,
      ADD COLUMN IF NOT EXISTS guarnicion_fija_override_id INTEGER       NULL REFERENCES guarniciones(id) ON DELETE SET NULL;
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE menu_semanal_dias
      DROP COLUMN IF EXISTS guarnicion_fija_override_id,
      DROP COLUMN IF EXISTS guarnicion_modo_override,
      DROP COLUMN IF EXISTS canal;
  `);
}
