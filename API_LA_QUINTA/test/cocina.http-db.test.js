import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { query } from '../src/database/connection.js';
import { diaDeNombre, lunesDe } from '../src/modules/cocina/cocina.repository.js';
import {
  cerrarPoolDb,
  iniciarServidorTest,
  requestJson,
  insertarMenuSemana,
} from '../test_helpers/pedidos-http.helper.js';

let servidor;

before(async () => {
  servidor = await iniciarServidorTest();
});

after(async () => {
  await servidor?.cerrar();
  await cerrarPoolDb();
});

async function conAdminTest(prefijo, prueba, rol = 'superadmin') {
  const email = `${prefijo}+admin-${Date.now()}@test.local`;
  const admin = (await query(
    `INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol, activo)
     VALUES ('Admin', 'Cocina', $1, 'test', $2, true)
     RETURNING id`,
    [email, rol],
  )).rows[0];
  const token = jwt.sign({ sub: admin.id, tipo: 'admin' }, env.JWT_SECRET, { expiresIn: '1h' });

  try {
    return await prueba({ admin, token });
  } finally {
    await query('DELETE FROM usuarios_admin WHERE id = $1', [admin.id]);
  }
}

async function limpiarTest(prefijo) {
  await query(
    `DELETE FROM plato_disponibilidad_local pdl USING platos p
     WHERE pdl.plato_id = p.id AND p.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM pedido_items pi USING pedidos pe, empresas em
     WHERE pi.pedido_id = pe.id AND pe.empresa_id = em.id AND em.slug LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM pedidos pe USING empresas em
     WHERE pe.empresa_id = em.id AND em.slug LIKE $1`,
    [`${prefijo}%`],
  );
  await query(`DELETE FROM menus_semanales WHERE nombre LIKE $1`, [`${prefijo}%`]);
  await query(
    `DELETE FROM empleados em USING empresas e
     WHERE em.empresa_id = e.id AND e.slug LIKE $1`,
    [`${prefijo}%`],
  );
  await query('DELETE FROM empresas WHERE slug LIKE $1', [`${prefijo}%`]);
  await query('DELETE FROM platos WHERE nombre LIKE $1', [`${prefijo}%`]);
  await query('DELETE FROM guarniciones WHERE nombre LIKE $1', [`${prefijo}%`]);
  await query('DELETE FROM salsas WHERE nombre LIKE $1', [`${prefijo}%`]);
}

test('GET /api/v1/cocina/hoy consolida conteo de vianda (con salsa) y checklist del Local, sin cantidades para el Local', async () => {
  const prefijo = `itp${Date.now()}cocina`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const hoyISO = new Date().toISOString().slice(0, 10);
      const dia = diaDeNombre(hoyISO);
      const lunes = lunesDe(hoyISO);

      const empresa = (await query(
        `INSERT INTO empresas (nombre, slug, modo_pedido, activo, dias_laborales, codigo_registro)
         VALUES ($1, $2, 'semanal', true, 'lunes_domingo', $3)
         RETURNING *`,
        [`${prefijo} Empresa`, prefijo, prefijo.slice(-10).toUpperCase()],
      )).rows[0];

      const empleado = (await query(
        `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, activo)
         VALUES ($1, 'Empleado', 'Cocina', $2, 'test', true)
         RETURNING *`,
        [empresa.id, `${prefijo}+empleado@test.local`],
      )).rows[0];

      const guarnicion = (await query(
        `INSERT INTO guarniciones (nombre, activo, tipo) VALUES ($1, true, 'caliente') RETURNING *`,
        [`${prefijo} Pure`],
      )).rows[0];

      const salsa = (await query(
        `INSERT INTO salsas (nombre, activo) VALUES ($1, true) RETURNING *`,
        [`${prefijo} Salsa bolognesa`],
      )).rows[0];

      const platoVianda = (await query(
        `INSERT INTO platos (nombre, descripcion, activo, tipo, tiene_guarnicion, salsa_modo)
         VALUES ($1, 'Plato vianda test cocina', true, 'fijo', true, 'libre')
         RETURNING *`,
        [`${prefijo} Fideos con salsa`],
      )).rows[0];

      const platoLocal = (await query(
        `INSERT INTO platos (nombre, descripcion, activo, tipo)
         VALUES ($1, 'Plato solo local test cocina', true, 'especial')
         RETURNING *`,
        [`${prefijo} Pastel de papa`],
      )).rows[0];

      await query(
        `INSERT INTO plato_disponibilidad_local (plato_id, patron, dia_semana)
         VALUES ($1, 'dia_semana', $2)`,
        [platoLocal.id, dia],
      );

      const menu = await insertarMenuSemana(query, {
        nombre: `${prefijo} Menu`, fecha_inicio: lunes, estado: 'publicado',
      });

      const pedido = (await query(
        `WITH sem AS (
           INSERT INTO semanas (fecha_inicio, fecha_fin) VALUES ($4, ($4::date + 6))
           ON CONFLICT (fecha_inicio) DO UPDATE SET updated_at = NOW() RETURNING id
         )
         INSERT INTO pedidos (empleado_id, empresa_id, menu_semanal_id, semana_id, estado)
         SELECT $1, $2, $3, sem.id, 'pendiente' FROM sem
         RETURNING *`,
        [empleado.id, empresa.id, menu.id, lunes],
      )).rows[0];

      await query(
        `INSERT INTO pedido_items (pedido_id, dia, plato_id, guarnicion_id, salsa_id, sin_pedido, origen)
         VALUES ($1, $2, $3, $4, $5, false, 'usuario')`,
        [pedido.id, dia, platoVianda.id, guarnicion.id, salsa.id],
      );

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/cocina/hoy?fecha=${hoyISO}`, { token });

      assert.equal(respuesta.status, 200);
      assert.equal(respuesta.body.data.dia, dia);

      const conteoVianda = respuesta.body.data.conteos_vianda.find((c) => c.plato_id === platoVianda.id);
      assert.ok(conteoVianda, 'debe incluir el conteo del plato vianda del pedido de hoy');
      assert.equal(conteoVianda.total, 1);
      assert.equal(conteoVianda.empresas[0].empresa_id, empresa.id);

      const itemChecklist = respuesta.body.data.checklist_local.find((p) => p.id === platoLocal.id);
      assert.ok(itemChecklist, 'debe incluir el plato del Local programado para hoy en el checklist');
      assert.equal(itemChecklist.cantidad, undefined);
      assert.equal(itemChecklist.total, undefined);
    } finally {
      await limpiarTest(prefijo);
    }
  });
});
