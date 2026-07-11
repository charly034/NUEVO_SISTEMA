export function up(pgm) {
  pgm.sql(`
    ALTER TABLE menu_semanal_dias
      ADD COLUMN IF NOT EXISTS salsa_modo_override        salsa_modo NULL,
      ADD COLUMN IF NOT EXISTS salsa_fija_override_id      INTEGER    NULL REFERENCES salsas(id) ON DELETE SET NULL;
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE menu_semanal_dias
      DROP COLUMN IF EXISTS salsa_fija_override_id,
      DROP COLUMN IF EXISTS salsa_modo_override;
  `);
}
