export function up(pgm) {
  pgm.sql(`
    ALTER TABLE empleados
      ADD COLUMN IF NOT EXISTS preferencias_alimentarias JSONB NOT NULL DEFAULT '{}';
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE empleados
      DROP COLUMN IF EXISTS preferencias_alimentarias;
  `);
}
