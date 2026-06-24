#!/usr/bin/env node
/**
 * backfill-historial.js
 * Llena historial_uso_platos a partir de menu_semanal_dias para todas las
 * semanas ya importadas (el seed original no populó esta tabla).
 *
 * Uso: node scripts/backfill-historial.js
 */

import pool, { getClient } from '../src/database/connection.js';

const DIA_OFFSET = {
  lunes:     0,
  martes:    1,
  miercoles: 2,
  jueves:    3,
  viernes:   4,
};

function fechaServicio(fechaInicio, dia) {
  const str = fechaInicio instanceof Date
    ? fechaInicio.toISOString().slice(0, 10)
    : String(fechaInicio);
  const [y, m, d] = str.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + DIA_OFFSET[dia]);
  return [
    base.getFullYear(),
    String(base.getMonth() + 1).padStart(2, '0'),
    String(base.getDate()).padStart(2, '0'),
  ].join('-');
}

async function backfill() {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Leer todos los dias asignados junto con la fecha_inicio de la semana y el nombre del plato
    const { rows } = await client.query(`
      SELECT
        msd.menu_semanal_id,
        msd.dia,
        msd.opcion,
        msd.plato_id,
        p.nombre AS plato_nombre,
        ms.fecha_inicio
      FROM menu_semanal_dias msd
      JOIN menus_semanales ms ON ms.id = msd.menu_semanal_id
      JOIN platos p ON p.id = msd.plato_id
      ORDER BY ms.fecha_inicio, msd.dia, msd.opcion
    `);

    console.log(`\n📋 ${rows.length} asignaciones encontradas en menu_semanal_dias`);

    let insertados = 0;
    let omitidos   = 0;

    for (const r of rows) {
      const fs = fechaServicio(r.fecha_inicio, r.dia);
      const res = await client.query(
        `INSERT INTO historial_uso_platos
           (plato_id, plato_nombre_snapshot, menu_semanal_id, dia, opcion, fecha_servicio)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [r.plato_id, r.plato_nombre, r.menu_semanal_id, r.dia, r.opcion, fs]
      );
      if (res.rowCount > 0) insertados++;
      else omitidos++;
    }

    await client.query('COMMIT');
    console.log(`✅ Insertados: ${insertados}`);
    if (omitidos > 0) console.log(`⏭️  Ya existían (omitidos): ${omitidos}`);
    console.log('\n🎉 Backfill completo');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error, rollback ejecutado:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch(err => {
  console.error(err);
  process.exit(1);
});
