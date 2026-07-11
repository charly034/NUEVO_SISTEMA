export const up = (pgm) => {
  pgm.sql('ALTER TABLE platos ADD COLUMN IF NOT EXISTS foto_url TEXT');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE platos DROP COLUMN IF EXISTS foto_url');
};
