#!/usr/bin/env node
/**
 * materializar-fijos.js
 *
 * Fase C del teardown "la semana es el contenedor": materializa los platos
 * FIJOS de cada menu existente como filas de menu_semanal_dias con su
 * categoria_id, para que dejen de leerse de platos.disponibilidad y pasen a
 * ser dato por-semana. Establece el invariante "todo menu tiene sus fijos
 * materializados" que hace seguro el flip de las lecturas.
 *
 * Idempotente (materializarFijosMenu usa NOT EXISTS): correrlo dos veces no
 * duplica. Ya probado byte-a-byte contra el path viejo en
 * test/categorias-fase-b-paridad.db.test.js.
 *
 * Uso: node scripts/materializar-fijos.js
 */

import pool, { getClient } from '../src/database/connection.js';
import { materializarFijosMenu } from '../src/modules/categorias/categorias.repository.js';

async function main() {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: menus } = await client.query('SELECT id, nombre FROM menus_semanales ORDER BY id');
    console.log(`\n📋 ${menus.length} menú(s) a materializar`);

    let totalFijos = 0;
    for (const m of menus) {
      const res = await materializarFijosMenu(client, m.id);
      const insertados = res.rowCount ?? 0;
      totalFijos += insertados;
      console.log(`  ✅ ${m.nombre} (id ${m.id}) — ${insertados} fijo(s) materializado(s)`);
    }

    await client.query('COMMIT');
    console.log(`\n🎉 Listo — ${totalFijos} fila(s) de fijos materializadas en total`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error, rollback ejecutado:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
