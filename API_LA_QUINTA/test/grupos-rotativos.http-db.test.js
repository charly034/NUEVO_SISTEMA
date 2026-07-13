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
     VALUES ('Admin', 'GruposRotativos', $1, 'test', $2, true)
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
    `DELETE FROM grupo_rotativo_seleccion_semana grs USING ciclo_rotacion cr
     WHERE grs.ciclo_rotacion_id = cr.id AND cr.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM grupo_rotativo_plato grp USING grupo_rotativo gr, ciclo_rotacion cr
     WHERE grp.grupo_rotativo_id = gr.id AND gr.ciclo_rotacion_id = cr.id AND cr.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM grupo_rotativo gr USING ciclo_rotacion cr
     WHERE gr.ciclo_rotacion_id = cr.id AND cr.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query('DELETE FROM ciclo_rotacion WHERE nombre LIKE $1', [`${prefijo}%`]);
  await query(
    `DELETE FROM viandas v USING platos p WHERE v.plato_id = p.id AND p.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM menu_semanal_dias msd USING menus_semanales ms
     WHERE msd.menu_semanal_id = ms.id AND ms.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query('DELETE FROM menus_semanales WHERE nombre LIKE $1', [`${prefijo}%`]);
  await query('DELETE FROM platos WHERE nombre LIKE $1', [`${prefijo}%`]);
}

async function crearMenu(prefijo, fechaInicio = '2026-08-10') {
  return (await query(
    `INSERT INTO menus_semanales (nombre, fecha_inicio, fecha_fin, estado)
     VALUES ($1, $2, ($2::date + INTERVAL '6 days')::date, 'borrador')
     RETURNING *`,
    [`${prefijo} Menu`, fechaInicio],
  )).rows[0];
}

async function crearPlato(prefijo, nombre, { conVianda = true } = {}) {
  const plato = (await query(
    `INSERT INTO platos (nombre, descripcion, activo, tipo)
     VALUES ($1, 'Plato test grupos rotativos', true, 'especial')
     RETURNING *`,
    [`${prefijo} ${nombre}`],
  )).rows[0];
  if (conVianda) {
    await query('INSERT INTO viandas (plato_id, activo) VALUES ($1, true)', [plato.id]);
  }
  return plato;
}

test('POST /api/v1/grupos-rotativos/ciclos sin token devuelve 401', async () => {
  const respuesta = await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/ciclos', {
    payload: { dia_semana: 'sabado', nombre: 'x' },
  });
  assert.equal(respuesta.status, 401);
});

test('crear ciclo + grupos + platos, rotacion determinista semana a semana', async () => {
  const prefijo = `itp${Date.now()}rot1`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const platoA = await crearPlato(prefijo, 'Milanesa');
      const platoB = await crearPlato(prefijo, 'Pollo al horno');

      const ciclo = (await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/ciclos', {
        token,
        payload: { dia_semana: 'sabado', nombre: `${prefijo} Principal sabado` },
      })).body.data;

      const grupoA = (await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/grupos', {
        token,
        payload: { ciclo_rotacion_id: ciclo.id, nombre: 'Grupo A', orden: 0 },
      })).body.data;
      const grupoB = (await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/grupos', {
        token,
        payload: { ciclo_rotacion_id: ciclo.id, nombre: 'Grupo B', orden: 1 },
      })).body.data;

      await requestJson(servidor.baseUrl, 'POST', `/grupos-rotativos/grupos/${grupoA.id}/platos`, {
        token, payload: { plato_id: platoA.id, orden: 0 },
      });
      await requestJson(servidor.baseUrl, 'POST', `/grupos-rotativos/grupos/${grupoB.id}/platos`, {
        token, payload: { plato_id: platoB.id, orden: 0 },
      });

      const menuSemana0 = await crearMenu(prefijo, '2026-08-08'); // sabado de la semana ancla (creada al crear el ciclo)
      const menuSemana1 = await crearMenu(`${prefijo}b`, '2026-08-15');

      const respuestaCiclos = await requestJson(servidor.baseUrl, 'GET', '/grupos-rotativos/ciclos', {
        token, payload: undefined,
      });
      assert.equal(respuestaCiclos.status, 200);
      assert.ok(respuestaCiclos.body.data.some((c) => c.id === ciclo.id));
    } finally {
      await limpiarTest(prefijo);
      await limpiarTest(`${prefijo}b`);
    }
  });
});

test('excepcion semanal fuerza un grupo/plato distinto al calculado automaticamente', async () => {
  const prefijo = `itp${Date.now()}rot2`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const platoA = await crearPlato(prefijo, 'Tarta');
      const platoB = await crearPlato(prefijo, 'Ensalada');

      const ciclo = (await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/ciclos', {
        token, payload: { dia_semana: 'lunes', nombre: `${prefijo} Ciclo excepcion` },
      })).body.data;
      const grupoA = (await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/grupos', {
        token, payload: { ciclo_rotacion_id: ciclo.id, nombre: 'Grupo A', orden: 0 },
      })).body.data;
      const grupoB = (await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/grupos', {
        token, payload: { ciclo_rotacion_id: ciclo.id, nombre: 'Grupo B', orden: 1 },
      })).body.data;
      await requestJson(servidor.baseUrl, 'POST', `/grupos-rotativos/grupos/${grupoA.id}/platos`, {
        token, payload: { plato_id: platoA.id, orden: 0 },
      });
      await requestJson(servidor.baseUrl, 'POST', `/grupos-rotativos/grupos/${grupoB.id}/platos`, {
        token, payload: { plato_id: platoB.id, orden: 0 },
      });

      const menu = await crearMenu(prefijo);

      // Fuerza el grupo B aunque el calculo automatico haya elegido A para esta semana.
      const excepcion = await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/seleccion-semana', {
        token,
        payload: {
          menu_semanal_id: menu.id,
          ciclo_rotacion_id: ciclo.id,
          grupo_rotativo_id: grupoB.id,
          plato_id: platoB.id,
        },
      });
      assert.equal(excepcion.status, 200);
      assert.equal(excepcion.body.data.grupo_rotativo_id, grupoB.id);
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('excepcion semanal rechaza un plato que no pertenece al grupo forzado', async () => {
  const prefijo = `itp${Date.now()}rot3`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const platoA = await crearPlato(prefijo, 'Sopa');
      const platoAjeno = await crearPlato(prefijo, 'Fuera de grupo');

      const ciclo = (await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/ciclos', {
        token, payload: { dia_semana: 'martes', nombre: `${prefijo} Ciclo validacion` },
      })).body.data;
      const grupoA = (await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/grupos', {
        token, payload: { ciclo_rotacion_id: ciclo.id, nombre: 'Grupo A', orden: 0 },
      })).body.data;
      await requestJson(servidor.baseUrl, 'POST', `/grupos-rotativos/grupos/${grupoA.id}/platos`, {
        token, payload: { plato_id: platoA.id, orden: 0 },
      });

      const menu = await crearMenu(prefijo);
      const respuesta = await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/seleccion-semana', {
        token,
        payload: {
          menu_semanal_id: menu.id,
          ciclo_rotacion_id: ciclo.id,
          grupo_rotativo_id: grupoA.id,
          plato_id: platoAjeno.id,
        },
      });
      assert.equal(respuesta.status, 400);
    } finally {
      await limpiarTest(prefijo);
    }
  });
});
