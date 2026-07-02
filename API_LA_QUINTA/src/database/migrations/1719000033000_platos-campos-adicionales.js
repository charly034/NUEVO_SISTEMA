export function up(pgm) {
  pgm.sql(`
    ALTER TABLE platos
      ADD COLUMN IF NOT EXISTS vegetariano       BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS calorias          INTEGER,
      ADD COLUMN IF NOT EXISTS alergenos         TEXT[]  NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS foto_url          TEXT,
      ADD COLUMN IF NOT EXISTS descripcion_larga TEXT;
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE platos
      DROP COLUMN IF EXISTS vegetariano,
      DROP COLUMN IF EXISTS calorias,
      DROP COLUMN IF EXISTS alergenos,
      DROP COLUMN IF EXISTS foto_url,
      DROP COLUMN IF EXISTS descripcion_larga;
  `);
}
