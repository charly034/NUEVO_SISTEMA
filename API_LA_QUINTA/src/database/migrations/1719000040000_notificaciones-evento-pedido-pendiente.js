export function up(pgm) {
  pgm.sql(`
    ALTER TYPE notificacion_evento ADD VALUE IF NOT EXISTS 'pedido_semanal_pendiente';
  `);
}

export function down() {
  // PostgreSQL no permite eliminar un valor puntual de un enum sin recrearlo.
}
