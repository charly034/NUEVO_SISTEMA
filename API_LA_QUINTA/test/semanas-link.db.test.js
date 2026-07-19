import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/database/connection.js';
import { cerrarPoolDb } from '../test_helpers/pedidos-http.helper.js';

// Fase S1 del plan "semana como raiz": verifica que el backfill de semana_id
// quedo coherente. Paridad shadow-read a nivel dato: la semana referenciada por
// semana_id es la misma que la que resuelve la fecha vieja (date_trunc week).

after(async () => {
  await cerrarPoolDb();
});

// tabla + columna de fecha vieja. Nombres constantes (no input de usuario).
const TABLAS = [
  { tabla: 'menus_semanales', col: 'fecha_inicio' },
  { tabla: 'pedidos', col: 'semana_inicio' },
  { tabla: 'pedido_sugerencias', col: 'semana_inicio' },
  { tabla: 'sugerencias_empleados', col: 'semana_inicio' },
  { tabla: 'pedido_sugerencia_opciones', col: 'semana_inicio' },
];

for (const { tabla, col } of TABLAS) {
  test(`${tabla}: sin semana_id NULL tras el backfill`, async () => {
    const n = (await query(`SELECT COUNT(*)::int AS n FROM ${tabla} WHERE semana_id IS NULL`)).rows[0].n;
    assert.equal(n, 0, `${tabla} no debe tener filas sin semana_id`);
  });

  test(`${tabla}: semana_id resuelve a la semana de ${col} (paridad)`, async () => {
    const n = (await query(
      `SELECT COUNT(*)::int AS n
       FROM ${tabla} t
       JOIN semanas s ON s.id = t.semana_id
       WHERE s.fecha_inicio <> date_trunc('week', t.${col})::date`,
    )).rows[0].n;
    assert.equal(n, 0, `${tabla}.semana_id debe coincidir con date_trunc('week', ${col})`);
  });
}
