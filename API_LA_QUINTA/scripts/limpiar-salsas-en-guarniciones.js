#!/usr/bin/env node
/**
 * limpiar-salsas-en-guarniciones.js
 *
 * Limpieza de datos: desactiva las filas historicas cuyo nombre empieza con
 * "Salsa" que quedaron en la tabla `guarniciones` como residuo de antes de que
 * Salsa se separara como entidad propia (tabla `salsas`, Fase 1 del replanteo
 * de dominio 2026-07-10). Esas filas aparecen mezcladas en el selector de
 * Guarnicion de front_menu/front_clientes junto a guarniciones reales.
 *
 * La desactivacion (activo=false) es REVERSIBLE y no borra historial: los
 * pedidos viejos que las referencian por guarnicion_id siguen intactos.
 *
 * Dry-run (no modifica nada, solo reporta filas y referencias):
 *   npm run salsas:limpiar-guarniciones
 *
 * Aplicar (desactiva):
 *   DESACTIVAR_SALSAS_GUARNICIONES_CONFIRM=SI npm run salsas:limpiar-guarniciones:apply
 *
 * Correr contra la base que tenga las filas (la del usuario). En una base
 * sembrada limpia con `npm run seed` no existen, asi que el dry-run reporta 0.
 */
import 'dotenv/config';
import pool, { getClient } from '../src/database/connection.js';

const APPLY = process.argv.includes('--apply');
const CONFIRM_VALUE = 'SI';
const PATRON_NOMBRE = 'salsa%';

function assertSafeMode() {
  if (APPLY && process.env.DESACTIVAR_SALSAS_GUARNICIONES_CONFIRM !== CONFIRM_VALUE) {
    console.error(`Para aplicar defini DESACTIVAR_SALSAS_GUARNICIONES_CONFIRM=${CONFIRM_VALUE}.`);
    process.exit(1);
  }
}

async function targets(client) {
  const res = await client.query(
    `SELECT id, nombre, activo, tipo
     FROM guarniciones
     WHERE nombre ILIKE $1
     ORDER BY nombre`,
    [PATRON_NOMBRE],
  );
  return res.rows;
}

// Descubre cualquier FK que apunte a guarniciones(id) y cuenta cuantas filas
// referencian a alguno de los ids objetivo, para que el dry-run muestre el
// impacto real de desactivar (nada se rompe, pero conviene verlo).
async function referencias(client, ids) {
  if (ids.length === 0) return [];
  const fks = await client.query(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'guarniciones'
      AND ccu.column_name = 'id'
    ORDER BY tc.table_name, kcu.column_name
  `);

  const out = [];
  for (const { table_name, column_name } of fks.rows) {
    const res = await client.query(
      `SELECT COUNT(*)::int AS total FROM "${table_name}" WHERE "${column_name}" = ANY($1::int[])`,
      [ids],
    );
    out.push({ referencia: `${table_name}.${column_name}`, filas: res.rows[0].total });
  }
  return out;
}

function printReporte(dbInfo, filas, refs) {
  console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Base:  ${dbInfo}`);

  console.log('\nFilas objetivo en guarniciones (nombre ILIKE "Salsa%"):');
  if (filas.length === 0) {
    console.log('  (ninguna)');
  } else {
    for (const f of filas) {
      console.log(`  - ${f.id}: ${f.nombre} [activo=${f.activo}, tipo=${f.tipo ?? '-'}]`);
    }
  }

  console.log('\nReferencias a esas filas (FKs a guarniciones.id):');
  if (refs.length === 0) {
    console.log('  (ninguna referencia)');
  } else {
    for (const r of refs) {
      console.log(`  ${r.referencia.padEnd(40)} ${r.filas}`);
    }
    console.log('  (desactivar no rompe estas referencias: activo=false es solo un flag reversible)');
  }
}

async function main() {
  assertSafeMode();
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const dbInfo = (await client.query(
      "SELECT current_database() || ' @ ' || COALESCE(inet_server_addr()::text, 'local') AS info",
    )).rows[0].info;

    const filas = await targets(client);
    const ids = filas.map((f) => f.id);
    const refs = await referencias(client, ids);
    printReporte(dbInfo, filas, refs);

    if (!APPLY) {
      console.log('\nDry-run: no se modifico la base de datos.');
      await client.query('ROLLBACK');
      return;
    }

    const activas = ids.length
      ? (await client.query(
        `UPDATE guarniciones SET activo = false
         WHERE id = ANY($1::int[]) AND activo = true`,
        [ids],
      )).rowCount
      : 0;

    await client.query('COMMIT');
    console.log(`\nDesactivadas ${activas} fila(s) de guarniciones "Salsa%". (${ids.length - activas} ya estaban inactivas)`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\nError durante la limpieza:', error.message);
    if (process.env.DEBUG) console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
