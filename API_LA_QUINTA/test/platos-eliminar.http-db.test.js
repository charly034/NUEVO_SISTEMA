import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { query } from '../src/database/connection.js';
import {
  cerrarPoolDb,
  iniciarServidorTest,
  requestJson,
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
     VALUES ('Admin', 'PlatosEliminar', $1, 'test', $2, true)
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
  await query('DELETE FROM historial_uso_platos WHERE plato_nombre_snapshot LIKE $1', [`${prefijo}%`]);
  await query('DELETE FROM viandas v USING platos p WHERE v.plato_id = p.id AND p.nombre LIKE $1', [`${prefijo}%`]);
  await query('DELETE FROM platos WHERE nombre LIKE $1', [`${prefijo}%`]);
}

test('DELETE /api/v1/platos/:id no rompe con violacion de NOT NULL cuando el plato ya tiene historial de uso (bug real encontrado en vivo 2026-07-13, fix migracion 1719000071000)', async () => {
  const prefijo = `itp${Date.now()}delhist`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const plato = (await query(
        `INSERT INTO platos (nombre, descripcion, activo, tipo, disponibilidad)
         VALUES ($1, 'Plato test eliminar con historial', true, 'especial', 'especial')
         RETURNING *`,
        [`${prefijo} PlatoConHistorial`],
      )).rows[0];

      // Simula lo que deja un uso real (agregar a un menu, luego sacarlo o
      // que el menu se borre): el historial sobrevive aunque el plato ya no
      // este asignado en ningun menu_semanal_dias actual.
      await query(
        `INSERT INTO historial_uso_platos (plato_id, plato_nombre_snapshot, dia, opcion, fecha_servicio)
         VALUES ($1, $2, 'lunes', 'A', '2026-07-13')`,
        [plato.id, plato.nombre],
      );

      const respuesta = await requestJson(servidor.baseUrl, 'DELETE', `/platos/${plato.id}`, { token });
      assert.equal(respuesta.status, 204, 'el DELETE debe completarse sin romper por la violacion de NOT NULL');

      const historial = (await query(
        'SELECT plato_id, plato_nombre_snapshot FROM historial_uso_platos WHERE plato_nombre_snapshot = $1',
        [plato.nombre],
      )).rows[0];
      assert.ok(historial, 'la fila de historial debe sobrevivir al borrado del plato');
      assert.equal(historial.plato_id, null, 'plato_id debe quedar en null (ON DELETE SET NULL), no bloquear el borrado');
      assert.equal(historial.plato_nombre_snapshot, plato.nombre, 'el nombre snapshot preserva el nombre aunque el plato ya no exista');

      const platoBorrado = (await query('SELECT id FROM platos WHERE id = $1', [plato.id])).rows[0];
      assert.equal(platoBorrado, undefined, 'el plato debe haberse borrado de verdad');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});
