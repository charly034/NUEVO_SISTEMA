export const up = (pgm) => {
  // Renombrar 'variable' → 'especial'
  pgm.sql(`UPDATE platos SET tipo = 'especial' WHERE tipo = 'variable'`);

  // Agregar CHECK constraint
  pgm.sql(`
    ALTER TABLE platos
    ADD CONSTRAINT platos_tipo_check
    CHECK (tipo IN ('fijo', 'especial', 'ambos'))
  `);

  // Actualizar default
  pgm.sql(`ALTER TABLE platos ALTER COLUMN tipo SET DEFAULT 'especial'`);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE platos DROP CONSTRAINT IF EXISTS platos_tipo_check`);
  pgm.sql(`UPDATE platos SET tipo = 'variable' WHERE tipo = 'especial'`);
  pgm.sql(`ALTER TABLE platos ALTER COLUMN tipo SET DEFAULT 'variable'`);
};
