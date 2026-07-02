export function up(pgm) {
  pgm.sql(`
    ALTER TABLE platos
      ADD CONSTRAINT platos_calorias_non_negative
        CHECK (calorias IS NULL OR calorias >= 0),
      ADD CONSTRAINT platos_foto_url_public_upload
        CHECK (
          foto_url IS NULL
          OR foto_url = ''
          OR foto_url LIKE '/uploads/platos/%.webp'
          OR foto_url LIKE 'http://%'
          OR foto_url LIKE 'https://%'
        );
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE platos
      DROP CONSTRAINT IF EXISTS platos_calorias_non_negative,
      DROP CONSTRAINT IF EXISTS platos_foto_url_public_upload;
  `);
}
