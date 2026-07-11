export function up(pgm) {
  pgm.sql(`
    ALTER TABLE planes_vianda RENAME TO planes_comerciales;
    ALTER SEQUENCE planes_vianda_id_seq RENAME TO planes_comerciales_id_seq;
    ALTER TABLE planes_comerciales RENAME CONSTRAINT planes_vianda_pkey TO planes_comerciales_pkey;
    ALTER TABLE planes_comerciales RENAME CONSTRAINT planes_vianda_codigo_key TO planes_comerciales_codigo_key;
    ALTER TABLE planes_comerciales RENAME CONSTRAINT planes_vianda_gramaje_check TO planes_comerciales_gramaje_check;
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE planes_comerciales RENAME CONSTRAINT planes_comerciales_gramaje_check TO planes_vianda_gramaje_check;
    ALTER TABLE planes_comerciales RENAME CONSTRAINT planes_comerciales_codigo_key TO planes_vianda_codigo_key;
    ALTER TABLE planes_comerciales RENAME CONSTRAINT planes_comerciales_pkey TO planes_vianda_pkey;
    ALTER SEQUENCE planes_comerciales_id_seq RENAME TO planes_vianda_id_seq;
    ALTER TABLE planes_comerciales RENAME TO planes_vianda;
  `);
}
