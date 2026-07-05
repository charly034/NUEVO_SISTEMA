#!/usr/bin/env node
/**
 * Limpia datos creados por seeds de demo/test.
 *
 * Dry-run:
 *   npm run datos-prueba:limpiar
 *
 * Aplicar:
 *   CLEAN_TEST_DATA_CONFIRM=ELIMINAR_DATOS_PRUEBA npm run datos-prueba:limpiar:apply
 */
import 'dotenv/config';
import pool, { getClient } from '../src/database/connection.js';

const APPLY = process.argv.includes('--apply');
const CONFIRM_VALUE = 'ELIMINAR_DATOS_PRUEBA';

const TEST_COMPANY_SLUGS = [
  'test',
  'banco-hipotecario',
  'clinica-del-sol',
  'estudio-ferreyra',
  'centro-operativo-la-quinta',
  'universidad-mendoza',
];

const TEST_MENU_PATTERNS = [
  'Menu historico test %',
  'Menu semana actual %',
  'Menu semana proxima %',
];

function assertSafeMode() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Este script no se puede ejecutar con NODE_ENV=production.');
    process.exit(1);
  }

  if (APPLY && process.env.CLEAN_TEST_DATA_CONFIRM !== CONFIRM_VALUE) {
    console.error(`Para aplicar la limpieza defini CLEAN_TEST_DATA_CONFIRM=${CONFIRM_VALUE}.`);
    process.exit(1);
  }
}

async function tableExists(client, tableName) {
  const res = await client.query('SELECT to_regclass($1) AS table_name', [tableName]);
  return Boolean(res.rows[0]?.table_name);
}

async function scalar(client, sql, params = []) {
  const res = await client.query(sql, params);
  return Number(res.rows[0]?.count ?? 0);
}

async function countIfExists(client, tableName, sql) {
  if (!(await tableExists(client, tableName))) return 0;
  return scalar(client, sql);
}

async function deleteIfExists(client, tableName, label, sql, results) {
  if (!(await tableExists(client, tableName))) {
    results.push({ label, deleted: 0, skipped: true });
    return;
  }
  const res = await client.query(sql);
  results.push({ label, deleted: res.rowCount, skipped: false });
}

async function prepareTargets(client) {
  await client.query(`
    CREATE TEMP TABLE cleanup_empresas (id integer PRIMARY KEY) ON COMMIT DROP;
    CREATE TEMP TABLE cleanup_empleados (id integer PRIMARY KEY) ON COMMIT DROP;
    CREATE TEMP TABLE cleanup_pedidos (id integer PRIMARY KEY) ON COMMIT DROP;
    CREATE TEMP TABLE cleanup_pedido_items (id integer PRIMARY KEY) ON COMMIT DROP;
    CREATE TEMP TABLE cleanup_pagos (id integer PRIMARY KEY) ON COMMIT DROP;
    CREATE TEMP TABLE cleanup_menus (id integer PRIMARY KEY) ON COMMIT DROP;
  `);

  await client.query(`
    INSERT INTO cleanup_empresas (id)
    SELECT DISTINCT e.id
    FROM empresas e
    LEFT JOIN empleados emp ON emp.empresa_id = e.id
    WHERE e.slug = ANY($1::text[])
       OR UPPER(e.nombre) = 'TEST'
       OR LOWER(COALESCE(e.email, '')) LIKE '%.test'
       OR LOWER(COALESCE(emp.email, '')) LIKE '%.test'
       OR LOWER(COALESCE(emp.email, '')) = 'test@test.com'
    ON CONFLICT DO NOTHING
  `, [TEST_COMPANY_SLUGS]);

  await client.query(`
    INSERT INTO cleanup_empleados (id)
    SELECT DISTINCT emp.id
    FROM empleados emp
    WHERE emp.empresa_id IN (SELECT id FROM cleanup_empresas)
       OR LOWER(emp.email) LIKE '%.test'
       OR LOWER(emp.email) = 'test@test.com'
    ON CONFLICT DO NOTHING
  `);

  await client.query(`
    INSERT INTO cleanup_pedidos (id)
    SELECT DISTINCT p.id
    FROM pedidos p
    WHERE p.empresa_id IN (SELECT id FROM cleanup_empresas)
       OR p.empleado_id IN (SELECT id FROM cleanup_empleados)
       OR COALESCE(p.observaciones, '') ILIKE '%seed_test_data%'
       OR COALESCE(p.observaciones, '') ILIKE '%testing%'
    ON CONFLICT DO NOTHING
  `);

  await client.query(`
    INSERT INTO cleanup_pedido_items (id)
    SELECT DISTINCT pi.id
    FROM pedido_items pi
    WHERE pi.pedido_id IN (SELECT id FROM cleanup_pedidos)
       OR COALESCE(pi.origen, '') = 'seed_test_data'
    ON CONFLICT DO NOTHING
  `);

  if (await tableExists(client, 'finanzas_pagos')) {
    await client.query(`
      INSERT INTO cleanup_pagos (id)
      SELECT DISTINCT fp.id
      FROM finanzas_pagos fp
      LEFT JOIN finanzas_pago_aplicaciones fpa ON fpa.pago_id = fp.id
      WHERE fp.empresa_id IN (SELECT id FROM cleanup_empresas)
         OR fp.empleado_id IN (SELECT id FROM cleanup_empleados)
         OR fpa.pedido_id IN (SELECT id FROM cleanup_pedidos)
         OR fpa.pedido_item_id IN (SELECT id FROM cleanup_pedido_items)
      ON CONFLICT DO NOTHING
    `);
  }

  await client.query(`
    INSERT INTO cleanup_menus (id)
    SELECT DISTINCT ms.id
    FROM menus_semanales ms
    WHERE ms.nombre ILIKE ANY($1::text[])
    ON CONFLICT DO NOTHING
  `, [TEST_MENU_PATTERNS]);
}

async function buildSummary(client) {
  const empresas = await client.query(`
    SELECT id, nombre, slug
    FROM empresas
    WHERE id IN (SELECT id FROM cleanup_empresas)
    ORDER BY nombre
  `);

  const menus = await client.query(`
    SELECT id, nombre, fecha_inicio
    FROM menus_semanales
    WHERE id IN (SELECT id FROM cleanup_menus)
    ORDER BY fecha_inicio, id
  `);

  return {
    empresas: empresas.rows,
    menus: menus.rows,
    counts: [
      ['empresas', await scalar(client, 'SELECT COUNT(*) FROM cleanup_empresas')],
      ['empleados', await scalar(client, 'SELECT COUNT(*) FROM cleanup_empleados')],
      ['pedidos', await scalar(client, 'SELECT COUNT(*) FROM cleanup_pedidos')],
      ['pedido_items', await scalar(client, 'SELECT COUNT(*) FROM cleanup_pedido_items')],
      ['finanzas_pagos', await scalar(client, 'SELECT COUNT(*) FROM cleanup_pagos')],
      ['menus_semanales_seed_test', await scalar(client, 'SELECT COUNT(*) FROM cleanup_menus')],
      ['pedido_eventos', await countIfExists(client, 'pedido_eventos', `
        SELECT COUNT(*) FROM pedido_eventos WHERE pedido_id IN (SELECT id FROM cleanup_pedidos)
      `)],
      ['pedido_sugerencias', await countIfExists(client, 'pedido_sugerencias', `
        SELECT COUNT(*) FROM pedido_sugerencias
        WHERE empresa_id IN (SELECT id FROM cleanup_empresas)
           OR empleado_id IN (SELECT id FROM cleanup_empleados)
      `)],
      ['notificaciones', await countIfExists(client, 'notificaciones', `
        SELECT COUNT(*) FROM notificaciones WHERE empleado_id IN (SELECT id FROM cleanup_empleados)
      `)],
      ['sugerencias_empleados', await countIfExists(client, 'sugerencias_empleados', `
        SELECT COUNT(*) FROM sugerencias_empleados WHERE empleado_id IN (SELECT id FROM cleanup_empleados)
      `)],
      ['finanzas_ajustes', await countIfExists(client, 'finanzas_ajustes', `
        SELECT COUNT(*) FROM finanzas_ajustes
        WHERE empresa_id IN (SELECT id FROM cleanup_empresas)
           OR empleado_id IN (SELECT id FROM cleanup_empleados)
      `)],
      ['finanzas_configuracion_cobro', await countIfExists(client, 'finanzas_configuracion_cobro', `
        SELECT COUNT(*) FROM finanzas_configuracion_cobro
        WHERE empresa_id IN (SELECT id FROM cleanup_empresas)
           OR empleado_id IN (SELECT id FROM cleanup_empleados)
      `)],
      ['notificacion_destinatarios_whatsapp', await countIfExists(client, 'notificacion_destinatarios_whatsapp', `
        SELECT COUNT(*) FROM notificacion_destinatarios_whatsapp
        WHERE empresa_id IN (SELECT id FROM cleanup_empresas)
           OR LOWER(COALESCE(email, '')) LIKE '%.test'
      `)],
    ],
  };
}

async function applyCleanup(client) {
  const results = [];

  await deleteIfExists(client, 'finanzas_pago_aplicaciones', 'finanzas_pago_aplicaciones', `
    DELETE FROM finanzas_pago_aplicaciones
    WHERE pago_id IN (SELECT id FROM cleanup_pagos)
       OR pedido_id IN (SELECT id FROM cleanup_pedidos)
       OR pedido_item_id IN (SELECT id FROM cleanup_pedido_items)
  `, results);
  await deleteIfExists(client, 'finanzas_pagos', 'finanzas_pagos', `
    DELETE FROM finanzas_pagos WHERE id IN (SELECT id FROM cleanup_pagos)
  `, results);
  await deleteIfExists(client, 'finanzas_ajustes', 'finanzas_ajustes', `
    DELETE FROM finanzas_ajustes
    WHERE empresa_id IN (SELECT id FROM cleanup_empresas)
       OR empleado_id IN (SELECT id FROM cleanup_empleados)
  `, results);
  await deleteIfExists(client, 'finanzas_configuracion_cobro', 'finanzas_configuracion_cobro', `
    DELETE FROM finanzas_configuracion_cobro
    WHERE empresa_id IN (SELECT id FROM cleanup_empresas)
       OR empleado_id IN (SELECT id FROM cleanup_empleados)
  `, results);
  await deleteIfExists(client, 'pedido_eventos', 'pedido_eventos', `
    DELETE FROM pedido_eventos WHERE pedido_id IN (SELECT id FROM cleanup_pedidos)
  `, results);
  await deleteIfExists(client, 'pedido_sugerencias', 'pedido_sugerencias', `
    DELETE FROM pedido_sugerencias
    WHERE empresa_id IN (SELECT id FROM cleanup_empresas)
       OR empleado_id IN (SELECT id FROM cleanup_empleados)
  `, results);
  await deleteIfExists(client, 'notificaciones', 'notificaciones', `
    DELETE FROM notificaciones WHERE empleado_id IN (SELECT id FROM cleanup_empleados)
  `, results);
  await deleteIfExists(client, 'sugerencias_empleados', 'sugerencias_empleados', `
    DELETE FROM sugerencias_empleados WHERE empleado_id IN (SELECT id FROM cleanup_empleados)
  `, results);
  await deleteIfExists(client, 'notificacion_destinatarios_whatsapp', 'notificacion_destinatarios_whatsapp', `
    DELETE FROM notificacion_destinatarios_whatsapp
    WHERE empresa_id IN (SELECT id FROM cleanup_empresas)
       OR LOWER(COALESCE(email, '')) LIKE '%.test'
  `, results);
  await deleteIfExists(client, 'admin_auditoria', 'admin_auditoria', `
    DELETE FROM admin_auditoria
    WHERE (entidad_tipo = 'empresa' AND entidad_id IN (SELECT id::text FROM cleanup_empresas))
       OR (entidad_tipo = 'empleado' AND entidad_id IN (SELECT id::text FROM cleanup_empleados))
       OR (entidad_tipo = 'pedido' AND entidad_id IN (SELECT id::text FROM cleanup_pedidos))
       OR (entidad_tipo = 'menu_semanal' AND entidad_id IN (SELECT id::text FROM cleanup_menus))
  `, results);

  const deleteItems = await client.query('DELETE FROM pedido_items WHERE pedido_id IN (SELECT id FROM cleanup_pedidos)');
  results.push({ label: 'pedido_items', deleted: deleteItems.rowCount, skipped: false });

  const deletePedidos = await client.query('DELETE FROM pedidos WHERE id IN (SELECT id FROM cleanup_pedidos)');
  results.push({ label: 'pedidos', deleted: deletePedidos.rowCount, skipped: false });

  await deleteIfExists(client, 'historial_uso_platos', 'historial_uso_platos', `
    DELETE FROM historial_uso_platos WHERE menu_semanal_id IN (SELECT id FROM cleanup_menus)
  `, results);
  await deleteIfExists(client, 'menu_semanal_sin_servicio', 'menu_semanal_sin_servicio', `
    DELETE FROM menu_semanal_sin_servicio WHERE menu_semanal_id IN (SELECT id FROM cleanup_menus)
  `, results);
  await deleteIfExists(client, 'menu_semanal_dias', 'menu_semanal_dias', `
    DELETE FROM menu_semanal_dias WHERE menu_semanal_id IN (SELECT id FROM cleanup_menus)
  `, results);

  const deleteMenus = await client.query('DELETE FROM menus_semanales WHERE id IN (SELECT id FROM cleanup_menus)');
  results.push({ label: 'menus_semanales', deleted: deleteMenus.rowCount, skipped: false });

  const deleteEmpleados = await client.query('DELETE FROM empleados WHERE id IN (SELECT id FROM cleanup_empleados)');
  results.push({ label: 'empleados', deleted: deleteEmpleados.rowCount, skipped: false });

  const deleteEmpresas = await client.query('DELETE FROM empresas WHERE id IN (SELECT id FROM cleanup_empresas)');
  results.push({ label: 'empresas', deleted: deleteEmpresas.rowCount, skipped: false });

  return results;
}

function printSummary(summary) {
  console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('\nEmpresas objetivo:');
  if (summary.empresas.length === 0) {
    console.log('  (ninguna)');
  } else {
    for (const empresa of summary.empresas) {
      console.log(`  - ${empresa.id}: ${empresa.nombre} (${empresa.slug})`);
    }
  }

  console.log('\nMenus seed/test objetivo:');
  if (summary.menus.length === 0) {
    console.log('  (ninguno)');
  } else {
    for (const menu of summary.menus) {
      console.log(`  - ${menu.id}: ${menu.nombre} (${String(menu.fecha_inicio).slice(0, 10)})`);
    }
  }

  console.log('\nConteos:');
  for (const [label, count] of summary.counts) {
    console.log(`  ${label.padEnd(34)} ${count}`);
  }
}

function printResults(results) {
  console.log('\nFilas eliminadas:');
  for (const item of results) {
    const suffix = item.skipped ? ' (tabla no existe)' : '';
    console.log(`  ${item.label.padEnd(34)} ${item.deleted}${suffix}`);
  }
}

async function main() {
  assertSafeMode();
  const client = await getClient();

  try {
    await client.query('BEGIN');
    await prepareTargets(client);
    const summary = await buildSummary(client);
    printSummary(summary);

    if (!APPLY) {
      console.log('\nDry-run: no se modifico la base de datos.');
      await client.query('ROLLBACK');
      return;
    }

    const results = await applyCleanup(client);
    printResults(results);
    await client.query('COMMIT');
    console.log('\nLimpieza de datos de prueba aplicada.');
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
