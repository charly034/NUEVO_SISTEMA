#!/usr/bin/env node
import pool, { getClient, query } from '../src/database/connection.js';
import {
  esDescripcionLargaPlaceholder,
  esDescripcionPlaceholder,
} from './backfill-platos-metadata-aproximada.js';

const aplicar = process.argv.includes('--apply');

function resumir(texto) {
  if (!texto) return '';
  const limpio = String(texto).replace(/\s+/g, ' ').trim();
  return limpio.length > 110 ? `${limpio.slice(0, 107)}...` : limpio;
}

async function main() {
  const { rows } = await query(`
    SELECT id, nombre, descripcion, descripcion_larga
    FROM platos
    ORDER BY nombre
  `);

  const afectados = rows
    .map((plato) => ({
      ...plato,
      limpiarDescripcion: esDescripcionPlaceholder(plato.descripcion),
      limpiarDescripcionLarga: esDescripcionLargaPlaceholder(plato.descripcion_larga),
    }))
    .filter((plato) => plato.limpiarDescripcion || plato.limpiarDescripcionLarga);

  console.log(`Platos revisados: ${rows.length}`);
  console.log(`Platos con placeholders detectados: ${afectados.length}`);

  for (const plato of afectados.slice(0, 25)) {
    const campos = [
      plato.limpiarDescripcion ? 'descripcion' : null,
      plato.limpiarDescripcionLarga ? 'descripcion_larga' : null,
    ].filter(Boolean).join(', ');
    console.log(`- #${plato.id} ${plato.nombre} (${campos})`);
    if (plato.limpiarDescripcion) console.log(`  descripcion: ${resumir(plato.descripcion)}`);
    if (plato.limpiarDescripcionLarga) console.log(`  descripcion_larga: ${resumir(plato.descripcion_larga)}`);
  }

  if (afectados.length > 25) {
    console.log(`... ${afectados.length - 25} platos mas omitidos en la vista previa.`);
  }

  if (!aplicar) {
    console.log('');
    console.log('Dry-run: no se modifico la base. Para limpiar, ejecuta:');
    console.log('  npm run platos:limpiar-placeholders:apply');
    await pool.end();
    return;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const plato of afectados) {
      await client.query(
        `UPDATE platos
         SET descripcion = CASE WHEN $2 THEN NULL ELSE descripcion END,
             descripcion_larga = CASE WHEN $3 THEN NULL ELSE descripcion_larga END,
             updated_at = NOW()
         WHERE id = $1`,
        [plato.id, plato.limpiarDescripcion, plato.limpiarDescripcionLarga],
      );
    }
    await client.query('COMMIT');
    console.log('');
    console.log(`Limpieza aplicada: ${afectados.length} platos actualizados.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
