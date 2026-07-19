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

// Cobertura de la deuda debt-admin-auditoria-cobertura-parcial: verifica que las
// operaciones CRUD admin de modulos que antes NO auditaban ahora dejan un evento
// en admin_auditoria. Cubrimos guarniciones y empresas como muestras
// representativas de los dos patrones usados (auditoria en controller).

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
     VALUES ('Admin', 'AuditoriaCobertura', $1, 'test', $2, true)
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

async function eventosDe(entidad_tipo, entidad_id) {
  const { rows } = await query(
    `SELECT accion, admin_id, resumen FROM admin_auditoria
     WHERE entidad_tipo = $1 AND entidad_id = $2
     ORDER BY created_at ASC`,
    [entidad_tipo, String(entidad_id)],
  );
  return rows;
}

test('crear y eliminar una guarnicion deja eventos en admin_auditoria', async () => {
  const prefijo = `itp${Date.now()}audg`;
  await conAdminTest(prefijo, async ({ admin, token }) => {
    let guarnicionId;
    try {
      const creada = await requestJson(servidor.baseUrl, 'POST', '/guarniciones', {
        token,
        payload: { nombre: `${prefijo} Papas`, tipo: 'caliente' },
      });
      assert.equal(creada.status, 201);
      guarnicionId = creada.body.data.id;

      const trasCrear = await eventosDe('guarnicion', guarnicionId);
      assert.equal(trasCrear.length, 1, 'crear guarnicion debe dejar exactamente un evento');
      assert.equal(trasCrear[0].accion, 'crear');
      assert.equal(Number(trasCrear[0].admin_id), admin.id, 'el evento debe atribuirse al admin autenticado');

      const eliminada = await requestJson(servidor.baseUrl, 'DELETE', `/guarniciones/${guarnicionId}`, { token });
      assert.equal(eliminada.status, 204);

      const trasEliminar = await eventosDe('guarnicion', guarnicionId);
      assert.equal(trasEliminar.length, 2, 'eliminar guarnicion debe agregar un segundo evento');
      assert.equal(trasEliminar[1].accion, 'eliminar');
    } finally {
      await query('DELETE FROM admin_auditoria WHERE entidad_tipo = $1 AND entidad_id = $2', ['guarnicion', String(guarnicionId)]);
      await query('DELETE FROM guarniciones WHERE nombre LIKE $1', [`${prefijo}%`]);
    }
  });
});

test('crear una empresa deja un evento crear en admin_auditoria', async () => {
  const prefijo = `itp${Date.now()}aude`;
  await conAdminTest(prefijo, async ({ admin, token }) => {
    let empresaId;
    try {
      const creada = await requestJson(servidor.baseUrl, 'POST', '/empresas', {
        token,
        payload: { nombre: `${prefijo} SA`, slug: `${prefijo}-sa` },
      });
      assert.equal(creada.status, 201);
      empresaId = creada.body.data.id;

      const eventos = await eventosDe('empresa', empresaId);
      assert.equal(eventos.length, 1, 'crear empresa debe dejar exactamente un evento');
      assert.equal(eventos[0].accion, 'crear');
      assert.equal(Number(eventos[0].admin_id), admin.id);
    } finally {
      await query('DELETE FROM admin_auditoria WHERE entidad_tipo = $1 AND entidad_id = $2', ['empresa', String(empresaId)]);
      await query('DELETE FROM empresas WHERE slug LIKE $1', [`${prefijo}%`]);
    }
  });
});
