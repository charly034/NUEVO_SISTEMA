import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/database/connection.js';
import { cerrarPoolDb, insertarMenuSemana } from '../test_helpers/pedidos-http.helper.js';
import * as menusService from '../src/modules/menus-semanales/menus-semanales.service.js';
import * as pedidosRepo from '../src/modules/pedidos/pedidos.repository.js';

// Fase S3 del plan "semana como raiz": el invariante paso de la fecha suelta a
// semana_id. Verifica el schema resultante (NOT NULL + UNIQUE swappeados) y que
// los enforcements se comportan como el plan (1 pedido/semana, 1 menu/semana,
// 1 opcion-sugerencia por semana+plato, guardia de createMenuSemanal).

const PREFIJO = `s3c${Date.now()}`;
// Semana lejana y unica de este file (lunes), fuera del seed, para no colisionar
// con el UNIQUE(semana_id) ni con otros test files.
const LUNES = '2031-03-03';

after(async () => {
  await query('DELETE FROM pedido_sugerencia_opciones WHERE plato_id IN (SELECT id FROM platos WHERE nombre LIKE $1)', [`${PREFIJO}%`]);
  await query('DELETE FROM pedidos p USING empresas e WHERE p.empresa_id = e.id AND e.slug LIKE $1', [`${PREFIJO}%`]);
  await query('DELETE FROM pedido_sugerencias ps USING empresas e WHERE ps.empresa_id = e.id AND e.slug LIKE $1', [`${PREFIJO}%`]);
  await query('DELETE FROM menu_semanal_dias md USING menus_semanales ms WHERE md.menu_semanal_id = ms.id AND ms.nombre LIKE $1', [`${PREFIJO}%`]);
  await query('DELETE FROM menus_semanales WHERE nombre LIKE $1', [`${PREFIJO}%`]);
  await query('DELETE FROM empleados em USING empresas e WHERE em.empresa_id = e.id AND e.slug LIKE $1', [`${PREFIJO}%`]);
  await query('DELETE FROM empresas WHERE slug LIKE $1', [`${PREFIJO}%`]);
  await query('DELETE FROM platos WHERE nombre LIKE $1', [`${PREFIJO}%`]);
  await query('DELETE FROM menus_semanales ms USING semanas s WHERE ms.semana_id = s.id AND s.fecha_inicio = $1', [LUNES]);
  await cerrarPoolDb();
});

// ── Schema: NOT NULL + constraints swappeados ────────────────────────
test('S3 schema: semana_id NOT NULL en las 5 tablas ancladas', async () => {
  const tablas = ['menus_semanales', 'pedidos', 'pedido_sugerencias', 'sugerencias_empleados', 'pedido_sugerencia_opciones'];
  const r = await query(
    `SELECT table_name, is_nullable
     FROM information_schema.columns
     WHERE column_name = 'semana_id' AND table_name = ANY($1)`,
    [tablas],
  );
  assert.equal(r.rows.length, 5);
  for (const row of r.rows) {
    assert.equal(row.is_nullable, 'NO', `${row.table_name}.semana_id debe ser NOT NULL`);
  }
});

test('S3 schema: UNIQUE por semana_id reemplaza a los UNIQUE por fecha', async () => {
  const esperado = {
    pedidos: 'UNIQUE (empleado_id, semana_id)',
    pedido_sugerencias: 'UNIQUE (empleado_id, semana_id)',
    sugerencias_empleados: 'UNIQUE (empleado_id, semana_id)',
    pedido_sugerencia_opciones: 'UNIQUE (semana_id, plato_id)',
    menus_semanales: 'UNIQUE (semana_id)',
  };
  for (const [tabla, def] of Object.entries(esperado)) {
    const r = await query(
      `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c JOIN pg_class rel ON rel.oid = c.conrelid
       WHERE rel.relname = $1 AND c.contype = 'u'`,
      [tabla],
    );
    const defs = r.rows.map((x) => x.def);
    assert.ok(defs.includes(def), `${tabla} debe tener ${def} (tiene: ${defs.join(' | ')})`);
    // el UNIQUE viejo por fecha ya no debe existir
    assert.ok(!defs.some((d) => /semana_inicio/.test(d)), `${tabla} no debe conservar UNIQUE por semana_inicio`);
  }
});

// ── Enforcement: 1 pedido/semana via UNIQUE(empleado_id, semana_id) ──
test('pedidos: UNIQUE(empleado_id, semana_id) impide 2 pedidos en la misma semana; ON CONFLICT hace upsert', async () => {
  const empresa = (await query(
    `INSERT INTO empresas (nombre, slug, modo_pedido, activo, codigo_registro)
     VALUES ($1, $2, 'semanal', true, $3) RETURNING id`,
    [`${PREFIJO} Empresa`, `${PREFIJO}-emp`, `${PREFIJO.slice(-8)}E`.toUpperCase()],
  )).rows[0];
  const empleado = (await query(
    `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, activo)
     VALUES ($1, 'E', 'Uno', $2, 'test', true) RETURNING id`,
    [empresa.id, `${PREFIJO}+u@test.local`],
  )).rows[0];

  // S4: el pedido cuelga de semana_id (getOrCreate de la semana desde el lunes).
  const semanaId = (await query(
    `INSERT INTO semanas (fecha_inicio, fecha_fin) VALUES ($1, ($1::date + 6))
     ON CONFLICT (fecha_inicio) DO UPDATE SET updated_at = NOW() RETURNING id`,
    [LUNES],
  )).rows[0].id;

  // 1er pedido
  await query(
    `INSERT INTO pedidos (empleado_id, empresa_id, semana_id, estado)
     VALUES ($1, $2, $3, 'pendiente')`,
    [empleado.id, empresa.id, semanaId],
  );

  // 2do pedido crudo misma semana -> viola UNIQUE(empleado_id, semana_id).
  await assert.rejects(
    query(
      `INSERT INTO pedidos (empleado_id, empresa_id, semana_id, estado)
       VALUES ($1, $2, $3, 'pendiente')`,
      [empleado.id, empresa.id, semanaId],
    ),
    (err) => err.code === '23505' && /empleado_semana_id/.test(err.constraint),
  );

  // ON CONFLICT (empleado_id, semana_id) DO UPDATE: upsert, no error, sigue 1 fila.
  await query(
    `INSERT INTO pedidos (empleado_id, empresa_id, semana_id, estado, observaciones)
     VALUES ($1, $2, $3, 'pendiente', 'upsert')
     ON CONFLICT (empleado_id, semana_id) DO UPDATE SET observaciones = EXCLUDED.observaciones`,
    [empleado.id, empresa.id, semanaId],
  );
  const n = (await query('SELECT COUNT(*)::int AS n FROM pedidos WHERE empleado_id = $1', [empleado.id])).rows[0].n;
  assert.equal(n, 1, 'debe haber exactamente 1 pedido para el empleado en la semana');
});

// ── Enforcement: 1 opcion-sugerencia por semana+plato ───────────────
test('pedido_sugerencia_opciones: UNIQUE(semana_id, plato_id) impide duplicar plato en la misma semana', async () => {
  const plato = (await query(
    `INSERT INTO platos (nombre, activo, tipo) VALUES ($1, true, 'especial') RETURNING id`,
    [`${PREFIJO} Plato sugerencia`],
  )).rows[0];

  const semanaId = (await query(
    `INSERT INTO semanas (fecha_inicio, fecha_fin) VALUES ($1, ($1::date + 6))
     ON CONFLICT (fecha_inicio) DO UPDATE SET updated_at = NOW() RETURNING id`,
    [LUNES],
  )).rows[0].id;
  await query(
    `INSERT INTO pedido_sugerencia_opciones (semana_id, plato_id, orden) VALUES ($1, $2, 0)`,
    [semanaId, plato.id],
  );
  await assert.rejects(
    query(
      `INSERT INTO pedido_sugerencia_opciones (semana_id, plato_id, orden) VALUES ($1, $2, 1)`,
      [semanaId, plato.id],
    ),
    (err) => err.code === '23505' && /semana_id_plato/.test(err.constraint),
  );
});

// ── Guardia de createMenuSemanal: rechaza 2do menu/semana ───────────
test('createMenuSemanal rechaza un 2do menu para una semana ya usada (409)', async () => {
  await insertarMenuSemana(query, { nombre: `${PREFIJO} Menu existente`, fecha_inicio: LUNES });
  await assert.rejects(
    menusService.createMenuSemanal({ nombre: `${PREFIJO} Menu duplicado`, fecha_inicio: LUNES, fecha_fin: '2031-03-09' }),
    (err) => err.statusCode === 409 || /[Yy]a existe un men/.test(err.message),
  );
});

// ── Regresión S4: upsert para una semana AÚN NO existente en `semanas` ───
// El getOrCreate de la semana ocurre en la MISMA sentencia (CTE `sem`). El SELECT
// final debe joinear la CTE `sem`, no la tabla base `semanas` (que por snapshot
// pre-sentencia no ve la fila recién insertada) -> si no, devuelve undefined.
// Los fixtures normales no lo detectan porque pre-crean la semana aparte.
test('upsertSugerencia/upsertPedido devuelven la fila cuando la semana es nueva (CTE visible)', async () => {
  const empresa = (await query(
    `INSERT INTO empresas (nombre, slug, modo_pedido, activo, codigo_registro)
     VALUES ($1, $2, 'semanal', true, $3) RETURNING id`,
    [`${PREFIJO} EmpresaNueva`, `${PREFIJO}-empn`, `${PREFIJO.slice(-7)}EN`.toUpperCase()],
  )).rows[0];
  const empleado = (await query(
    `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, activo)
     VALUES ($1, 'E', 'Nueva', $2, 'test', true) RETURNING id`,
    [empresa.id, `${PREFIJO}+n@test.local`],
  )).rows[0];

  // Semanas far-future (lunes) GARANTIZADAS inexistentes en `semanas`.
  const WSUG = '2034-02-06';
  const WPED = '2034-02-13';
  await query(`DELETE FROM semanas WHERE fecha_inicio = ANY($1::date[])`, [[WSUG, WPED]]);

  const sug = await pedidosRepo.upsertSugerencia({
    empleado_id: empleado.id, empresa_id: empresa.id, semana_inicio: WSUG,
    ideas: ['milanesa'], comentario: 'test',
  });
  assert.ok(sug, 'upsertSugerencia no debe devolver undefined para semana nueva');
  assert.equal(new Date(sug.semana_inicio).toISOString().slice(0, 10), WSUG);

  const ped = await pedidosRepo.upsertPedido({
    empleado_id: empleado.id, empresa_id: empresa.id, menu_semanal_id: null,
    semana_inicio: WPED, observaciones: 'test',
  });
  assert.ok(ped, 'upsertPedido no debe devolver undefined para semana nueva');
  assert.equal(new Date(ped.semana_inicio).toISOString().slice(0, 10), WPED);
  assert.ok(ped.id, 'el pedido debe tener id');
});
