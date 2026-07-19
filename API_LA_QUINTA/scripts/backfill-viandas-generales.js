#!/usr/bin/env node
/**
 * backfill-viandas-generales.js
 *
 * Crea la vianda "general" (sin guarnicion/salsa, empresa_id NULL) para cada
 * plato activo disponible_vianda=true que todavia NO tenga una vianda activa.
 *
 * Complementa el auto-create de platos.service.js::createPlato (que cubre los
 * platos NUEVOS): este backfill cubre los ya cargados, para que dejen de dar
 * "no tiene una vianda activa" al agregarlos a un menu. Golpe barato del
 * /plan-eng-review 2026-07-18 (ver docs/ai/91-spec-menu-compuesto.md).
 *
 * Aditivo e idempotente: solo INSERT de las que faltan; correrlo dos veces no
 * duplica. Los platos disponible_vianda=false (solo Local) se saltean a
 * proposito: no se ofrecen como vianda, no necesitan una.
 *
 * Dry-run (no modifica nada, lista los platos):
 *   npm run viandas:backfill-generales
 * Aplicar:
 *   npm run viandas:backfill-generales:apply
 */
import 'dotenv/config';
import pool, { getClient } from '../src/database/connection.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: faltantes } = await client.query(
      `SELECT p.id, p.nombre
       FROM platos p
       WHERE p.activo = true
         AND p.disponible_vianda = true
         AND NOT EXISTS (
           SELECT 1 FROM viandas v WHERE v.plato_id = p.id AND v.activo = true
         )
       ORDER BY p.nombre`,
    );

    console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`\nPlatos activos disponibles-para-vianda SIN vianda activa: ${faltantes.length}`);
    for (const p of faltantes) {
      console.log(`  - ${p.id}: ${p.nombre}`);
    }

    if (!APPLY) {
      console.log('\nDry-run: no se modifico la base de datos.');
      await client.query('ROLLBACK');
      return;
    }

    let creadas = 0;
    for (const p of faltantes) {
      const res = await client.query('INSERT INTO viandas (plato_id) VALUES ($1)', [p.id]);
      creadas += res.rowCount;
    }

    await client.query('COMMIT');
    console.log(`\nCreadas ${creadas} vianda(s) general(es).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nError en el backfill:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
