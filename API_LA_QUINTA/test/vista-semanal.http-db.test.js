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
     VALUES ('Admin', 'VistaSemanal', $1, 'test', $2, true)
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
    `DELETE FROM plato_empresa_visibilidad pev USING platos p
     WHERE pev.plato_id = p.id AND p.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM plato_disponibilidad_local pdl USING platos p
     WHERE pdl.plato_id = p.id AND p.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM viandas v USING platos p
     WHERE v.plato_id = p.id AND p.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM menu_semanal_dias msd USING menus_semanales ms
     WHERE msd.menu_semanal_id = ms.id AND ms.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(`DELETE FROM menus_semanales WHERE nombre LIKE $1`, [`${prefijo}%`]);
  await query('DELETE FROM empresas WHERE slug LIKE $1', [`${prefijo}%`]);
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

async function crearPlatoConVianda(prefijo, nombre, extra = {}) {
  const { disponibilidad = 'especial', diaFijo = null } = extra;
  const plato = (await query(
    `INSERT INTO platos (nombre, descripcion, activo, tipo, disponibilidad, dia_fijo)
     VALUES ($1, 'Plato test vista semanal', true, 'especial', $2, $3)
     RETURNING *`,
    [`${prefijo} ${nombre}`, disponibilidad, diaFijo],
  )).rows[0];
  await query('INSERT INTO viandas (plato_id, activo) VALUES ($1, true)', [plato.id]);
  return plato;
}

test('GET /api/v1/vista-semanal/:menuSemanalId sin token devuelve 401', async () => {
  const respuesta = await requestJson(servidor.baseUrl, 'GET', '/vista-semanal/1');
  assert.equal(respuesta.status, 401);
});

test('GET /api/v1/vista-semanal/:menuSemanalId con id inexistente devuelve 404', async () => {
  const prefijo = `itp${Date.now()}vistasem404`;
  await conAdminTest(prefijo, async ({ token }) => {
    const respuesta = await requestJson(servidor.baseUrl, 'GET', '/vista-semanal/99999999', { token });
    assert.equal(respuesta.status, 404);
  });
});

test('GET /api/v1/vista-semanal/:menuSemanalId devuelve slot especial con vianda y agregado de empresas sin restriccion', async () => {
  const prefijo = `itp${Date.now()}vistasemA`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo);
      const plato = await crearPlatoConVianda(prefijo, 'Milanesa');
      await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id)
         VALUES ($1, 'lunes', 'A', $2)`,
        [menu.id, plato.id],
      );

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/vista-semanal/${menu.id}`, { token });
      assert.equal(respuesta.status, 200);
      assert.equal(respuesta.body.data.semana.id, menu.id);

      const celda = respuesta.body.data.celdas.find((c) => c.plato_id === plato.id);
      assert.ok(celda, 'debe incluir la celda del plato especial');
      assert.equal(celda.dia, 'lunes');
      assert.equal(celda.categoria, 'especial');
      assert.equal(celda.vianda.activo, true);
      assert.equal(celda.vianda.editable, true);
      // Sin filas en plato_empresa_visibilidad/menu_empresa_visibilidad = visible
      // para todas las empresas activas (modelo allowlist) -- ver
      // utils/visibilidadEmpresa.js. No afirmamos un numero exacto porque el
      // total de empresas activas depende del estado de la base, pero el
      // modelo garantiza activas === total cuando no hay restriccion.
      assert.equal(celda.vianda.empresas.activas, celda.vianda.empresas.total);
      assert.ok(celda.vianda.empresas.total >= 1);
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('GET /api/v1/vista-semanal/:menuSemanalId refleja restriccion de plato_empresa_visibilidad en el agregado', async () => {
  const prefijo = `itp${Date.now()}vistasemB`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo);
      const plato = await crearPlatoConVianda(prefijo, 'Ravioles');

      const empresaVisible = (await query(
        `INSERT INTO empresas (nombre, slug, modo_pedido, activo, dias_laborales, codigo_registro)
         VALUES ($1, $2, 'semanal', true, 'lunes_domingo', $3)
         RETURNING *`,
        [`${prefijo} Empresa Visible`, `${prefijo}-visible`, `${prefijo.slice(-8)}V1`.toUpperCase()],
      )).rows[0];

      // Restringe el plato a UNA sola empresa -- el agregado debe reflejar
      // exactamente esa cantidad sin importar cuantas otras empresas existan
      // en la base (la restriccion es por plato_id, no global).
      await query(
        'INSERT INTO plato_empresa_visibilidad (plato_id, empresa_id) VALUES ($1, $2)',
        [plato.id, empresaVisible.id],
      );

      await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id)
         VALUES ($1, 'martes', 'A', $2)`,
        [menu.id, plato.id],
      );

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/vista-semanal/${menu.id}`, { token });
      assert.equal(respuesta.status, 200);

      const celda = respuesta.body.data.celdas.find((c) => c.plato_id === plato.id);
      assert.ok(celda);
      assert.equal(celda.vianda.empresas.activas, 1);
      assert.ok(celda.vianda.empresas.total >= 1);
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('GET /api/v1/vista-semanal/:menuSemanalId prioriza el slot especial sobre la regla global fijo_dia cuando coinciden en el mismo dia', async () => {
  const prefijo = `itp${Date.now()}vistasemD`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo);
      // Plato con regla global fijo_dia=martes (apareceria como celda de
      // solo lectura via cargarPlatosFijos) Y ADEMAS programado como slot
      // especial ese mismo martes en esta semana puntual -- el slot
      // especial (con su vianda e info editable) debe ganar, no perderse
      // detras de la entrada global de solo lectura.
      const plato = await crearPlatoConVianda(prefijo, 'Ambos', { disponibilidad: 'fijo_dia', diaFijo: 'martes' });
      await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id)
         VALUES ($1, 'martes', 'A', $2)`,
        [menu.id, plato.id],
      );

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/vista-semanal/${menu.id}`, { token });
      assert.equal(respuesta.status, 200);

      const celdasDelPlato = respuesta.body.data.celdas.filter((c) => c.plato_id === plato.id);
      assert.equal(celdasDelPlato.length, 1, 'no debe duplicarse en dos celdas para el mismo dia');
      assert.equal(celdasDelPlato[0].categoria, 'especial');
      assert.ok(celdasDelPlato[0].vianda, 'debe conservar la info de vianda del slot especial');
      assert.equal(celdasDelPlato[0].vianda.editable, true);
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('GET /api/v1/vista-semanal/:menuSemanalId incluye platos siempre/fijo_dia como celdas de solo lectura', async () => {
  const prefijo = `itp${Date.now()}vistasemC`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo, '2026-08-10'); // lunes
      const platoSiempre = await crearPlatoConVianda(prefijo, 'Tarta de Zapallitos', { disponibilidad: 'siempre' });
      const platoFijoMartes = await crearPlatoConVianda(prefijo, 'Torre de Pionono', { disponibilidad: 'fijo_dia', diaFijo: 'martes' });

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/vista-semanal/${menu.id}`, { token });
      assert.equal(respuesta.status, 200);

      const celdasSiempre = respuesta.body.data.celdas.filter((c) => c.plato_id === platoSiempre.id);
      assert.equal(celdasSiempre.length, 7, 'un plato siempre debe aparecer los 7 dias de la semana');
      assert.ok(celdasSiempre.every((c) => c.vianda === null && c.porKilo.editable === false));

      const celdasFijoMartes = respuesta.body.data.celdas.filter((c) => c.plato_id === platoFijoMartes.id);
      assert.equal(celdasFijoMartes.length, 1, 'un plato fijo_dia debe aparecer solo en su dia fijo');
      assert.equal(celdasFijoMartes[0].dia, 'martes');
      assert.equal(celdasFijoMartes[0].porKilo.editable, false);
    } finally {
      await limpiarTest(prefijo);
    }
  });
});
