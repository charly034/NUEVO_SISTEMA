export const up = (pgm) => {
  pgm.sql(`ALTER TABLE platos ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS platos_tags_gin ON platos USING gin (tags)`);
};

export const down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS platos_tags_gin`);
  pgm.sql(`ALTER TABLE platos DROP COLUMN IF EXISTS tags`);
};
