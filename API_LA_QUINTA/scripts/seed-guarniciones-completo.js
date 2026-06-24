#!/usr/bin/env node
/**
 * seed-guarniciones-completo.js
 * Inserta/actualiza todas las guarniciones con clasificación caliente/fría.
 *
 * Uso: node scripts/seed-guarniciones-completo.js
 */

import pool, { getClient } from '../src/database/connection.js';

// fría  → ensaladas y preparaciones frías que se sirven sin calentar
// caliente → preparaciones que se sirven calientes

const GUARNICIONES = [
  // ── FRÍAS ─────────────────────────────────────────────────────────────────────
  { nombre: 'Ensalada Rusa',                    tipo: 'fria' },
  { nombre: 'Ensalada Mixta',                   tipo: 'fria' },
  { nombre: 'Ensalada de remolacha',            tipo: 'fria' },
  { nombre: 'Ensalada de tomate cherry',        tipo: 'fria' },
  { nombre: 'Ensalada de rúcula',               tipo: 'fria' },
  { nombre: 'Ensalada de arroz con lentejas',   tipo: 'fria' },
  { nombre: 'Zanahoria rallada',                tipo: 'fria' },

  // ── CALIENTES ─────────────────────────────────────────────────────────────────
  { nombre: 'Puré de Papas',                    tipo: 'caliente' },
  { nombre: 'Puré de calabaza',                 tipo: 'caliente' },
  { nombre: 'Verduras Asadas',                  tipo: 'caliente' },
  { nombre: 'Papas al Horno',                   tipo: 'caliente' },
  { nombre: 'Arroz primavera',                  tipo: 'caliente' },
];

async function main() {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    let insertadas = 0;
    let actualizadas = 0;

    for (const g of GUARNICIONES) {
      const res = await client.query(
        `INSERT INTO guarniciones (nombre, tipo, activo)
         VALUES ($1, $2, true)
         ON CONFLICT (nombre) DO UPDATE SET
           tipo   = EXCLUDED.tipo,
           activo = true
         RETURNING (xmax = 0) AS es_nueva`,
        [g.nombre, g.tipo]
      );
      if (res.rows[0]?.es_nueva) insertadas++;
      else actualizadas++;
      const emoji = g.tipo === 'caliente' ? '🔥' : '❄️';
      console.log(`  ${emoji} [${g.tipo}] ${g.nombre}`);
    }

    await client.query('COMMIT');

    console.log('\n=== Seed completado ===');
    console.log(`  Frías     : ${GUARNICIONES.filter(g => g.tipo === 'fria').length}`);
    console.log(`  Calientes : ${GUARNICIONES.filter(g => g.tipo === 'caliente').length}`);
    console.log(`  Insertadas  : ${insertadas}`);
    console.log(`  Actualizadas: ${actualizadas}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en seed, rollback ejecutado:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
