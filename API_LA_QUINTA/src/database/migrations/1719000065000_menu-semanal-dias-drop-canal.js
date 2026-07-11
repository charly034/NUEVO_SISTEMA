export function up(pgm) {
  pgm.sql(`
    ALTER TABLE menu_semanal_dias
      DROP COLUMN IF EXISTS canal;
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE menu_semanal_dias
      ADD COLUMN IF NOT EXISTS canal plato_canal NOT NULL DEFAULT 'vianda';
  `);
}
