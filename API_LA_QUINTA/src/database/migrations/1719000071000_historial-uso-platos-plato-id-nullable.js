// Bug real encontrado en vivo (2026-07-13, probando "crear plato nuevo"
// desde Resumen): DELETE /api/v1/platos/:id fallaba con violacion de
// NOT NULL para CUALQUIER plato que ya tuvo historial de uso -- es decir,
// practicamente cualquier plato real con algo de antiguedad.
//
// Causa: historial_uso_platos.plato_id tenia NOT NULL, pero su FK hacia
// platos(id) esta definida ON DELETE SET NULL desde la migracion original
// (1719000004000_create-historial-uso-platos.js). El propio comentario de
// esa migracion decia "Si el plato se elimina, conservamos el registro
// historico con null" -- la intencion siempre fue esta, la columna nunca
// llego a permitir null. plato_nombre_snapshot ya existe justamente para
// preservar el nombre cuando plato_id queda en null, asi que esta es la
// unica pieza que faltaba (no hace falta tocar plato_nombre_snapshot ni
// ningun JOIN existente: los que usan JOIN normal simplemente van a
// excluir el historial de platos borrados, que es el comportamiento
// esperado).
export function up(pgm) {
  pgm.sql(`
    ALTER TABLE historial_uso_platos ALTER COLUMN plato_id DROP NOT NULL;
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE historial_uso_platos ALTER COLUMN plato_id SET NOT NULL;
  `);
}
