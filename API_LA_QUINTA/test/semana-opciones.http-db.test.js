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
     VALUES ('Admin', 'SemanaOpciones', $1, 'test', $2, true)
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
  // ILIKE: crearEmpresa fuerza el slug a minusculas, pero `prefijo` puede
  // tener mayusculas (ej. "sopA") -- LIKE case-sensitive dejaba huerfanas
  // las empresas de test en la base real (bug encontrado en verificacion manual).
  await query(
    `DELETE FROM empresa_opcion_semana eos USING empresas e
     WHERE eos.empresa_id = e.id AND e.slug ILIKE $1`,
    [`${prefijo}%`],
  );
  // menu_semanal_fijos_vianda.vianda_id es ON DELETE RESTRICT (no CASCADE) --
  // tiene que limpiarse ANTES que viandas, si no el DELETE de abajo falla con
  // violacion de FK (la cascada de menus_semanales todavia no corrio a esta altura).
  await query(
    `DELETE FROM menu_semanal_fijos_vianda msfv USING platos p
     WHERE msfv.plato_id = p.id AND p.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM viandas v USING platos p WHERE v.plato_id = p.id AND p.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM menu_semanal_dias msd USING menus_semanales ms
     WHERE msd.menu_semanal_id = ms.id AND ms.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM menu_semanal_sin_servicio mss USING menus_semanales ms
     WHERE mss.menu_semanal_id = ms.id AND ms.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query('DELETE FROM menus_semanales WHERE nombre LIKE $1', [`${prefijo}%`]);
  await query('DELETE FROM empresas WHERE slug ILIKE $1', [`${prefijo}%`]);
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
     VALUES ($1, 'Plato test semana opciones', true, 'especial', $2, $3)
     RETURNING *`,
    [`${prefijo} ${nombre}`, disponibilidad, diaFijo],
  )).rows[0];
  await query('INSERT INTO viandas (plato_id, activo) VALUES ($1, true)', [plato.id]);
  return plato;
}

async function crearEmpresa(prefijo, nombre, opcionDefault = null) {
  return (await query(
    `INSERT INTO empresas (nombre, slug, modo_pedido, activo, dias_laborales, codigo_registro, opcion_default)
     VALUES ($1, $2, 'semanal', true, 'lunes_domingo', $3, $4)
     RETURNING *`,
    [`${prefijo} ${nombre}`, `${prefijo}-${nombre}`.toLowerCase(), `${prefijo.slice(-8)}${nombre.slice(0, 2)}`.toUpperCase(), opcionDefault],
  )).rows[0];
}

test('GET /api/v1/semana-opciones/:menuSemanalId sin token devuelve 401', async () => {
  const respuesta = await requestJson(servidor.baseUrl, 'GET', '/semana-opciones/1');
  assert.equal(respuesta.status, 401);
});

test('empresa con opcion_default NULL aparece asignada en todas las opciones del dia', async () => {
  const prefijo = `itp${Date.now()}sopA`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo);
      const platoA = await crearPlatoConVianda(prefijo, 'Milanesa');
      const platoB = await crearPlatoConVianda(prefijo, 'Pollo');
      await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES
           ($1, 'lunes', 'A', $2), ($1, 'lunes', 'B', $3)`,
        [menu.id, platoA.id, platoB.id],
      );
      const empresa = await crearEmpresa(prefijo, 'Todas', null);

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      assert.equal(respuesta.status, 200);

      const lunes = respuesta.body.data.dias.find((d) => d.dia === 'lunes');
      const opcionA = lunes.opciones.find((o) => o.opcion === 'A');
      const opcionB = lunes.opciones.find((o) => o.opcion === 'B');
      assert.ok(opcionA.empresas.some((e) => e.empresa_id === empresa.id), 'empresa sin default debe ver Opcion A');
      assert.ok(opcionB.empresas.some((e) => e.empresa_id === empresa.id), 'empresa sin default debe ver Opcion B tambien');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('empresa con opcion_default fijo solo aparece en esa opcion, no en las otras', async () => {
  const prefijo = `itp${Date.now()}sopB`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo);
      const platoA = await crearPlatoConVianda(prefijo, 'Ravioles');
      const platoB = await crearPlatoConVianda(prefijo, 'Tarta');
      await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES
           ($1, 'martes', 'A', $2), ($1, 'martes', 'B', $3)`,
        [menu.id, platoA.id, platoB.id],
      );
      const empresa = await crearEmpresa(prefijo, 'SoloB', 'B');

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      const martes = respuesta.body.data.dias.find((d) => d.dia === 'martes');
      const opcionA = martes.opciones.find((o) => o.opcion === 'A');
      const opcionB = martes.opciones.find((o) => o.opcion === 'B');
      assert.ok(!opcionA.empresas.some((e) => e.empresa_id === empresa.id), 'no debe aparecer en Opcion A');
      assert.ok(opcionB.empresas.some((e) => e.empresa_id === empresa.id), 'debe aparecer en Opcion B (su default)');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('excepcion puntual de esta semana gana sobre el default permanente de la empresa', async () => {
  const prefijo = `itp${Date.now()}sopC`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo);
      const platoA = await crearPlatoConVianda(prefijo, 'Sopa');
      const platoB = await crearPlatoConVianda(prefijo, 'Guiso');
      await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES
           ($1, 'miercoles', 'A', $2), ($1, 'miercoles', 'B', $3)`,
        [menu.id, platoA.id, platoB.id],
      );
      const empresa = await crearEmpresa(prefijo, 'ExcepcionEmp', 'A');

      const excepcion = await requestJson(
        servidor.baseUrl, 'POST', `/semana-opciones/${menu.id}/empresas/${empresa.id}/opcion-excepcion`,
        { token, payload: { opcion: 'B' } }
      );
      assert.equal(excepcion.status, 200);

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      const miercoles = respuesta.body.data.dias.find((d) => d.dia === 'miercoles');
      const opcionA = miercoles.opciones.find((o) => o.opcion === 'A');
      const opcionB = miercoles.opciones.find((o) => o.opcion === 'B');
      assert.ok(!opcionA.empresas.some((e) => e.empresa_id === empresa.id), 'la excepcion debe sacarla de su default A');
      assert.ok(opcionB.empresas.some((e) => e.empresa_id === empresa.id), 'la excepcion la pone en B solo esta semana');

      // El default permanente de la empresa no debe haber cambiado.
      const empresaDb = (await query('SELECT opcion_default FROM empresas WHERE id = $1', [empresa.id])).rows[0];
      assert.equal(empresaDb.opcion_default, 'A', 'el default permanente no se toca con la excepcion semanal');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('excepcion con una opcion que no existe en el menu de esta semana devuelve 400', async () => {
  const prefijo = `itp${Date.now()}sopD`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo);
      const plato = await crearPlatoConVianda(prefijo, 'Unico');
      await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES ($1, 'jueves', 'A', $2)`,
        [menu.id, plato.id],
      );
      const empresa = await crearEmpresa(prefijo, 'Rechazo', null);

      const respuesta = await requestJson(
        servidor.baseUrl, 'POST', `/semana-opciones/${menu.id}/empresas/${empresa.id}/opcion-excepcion`,
        { token, payload: { opcion: 'Z' } }
      );
      assert.equal(respuesta.status, 400);
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('toggle disponible_por_kilo no afecta el canal vianda de la misma celda', async () => {
  const prefijo = `itp${Date.now()}sopE`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo);
      const plato = await crearPlatoConVianda(prefijo, 'PorKilo');
      const slot = (await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES ($1, 'viernes', 'A', $2) RETURNING id`,
        [menu.id, plato.id],
      )).rows[0];

      const respuestaOff = await requestJson(
        servidor.baseUrl, 'PUT', `/semana-opciones/slots/${slot.id}/disponible-por-kilo`,
        { token, payload: { disponible: false } }
      );
      assert.equal(respuestaOff.status, 200);

      const vista = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      const viernes = vista.body.data.dias.find((d) => d.dia === 'viernes');
      const opcionA = viernes.opciones.find((o) => o.opcion === 'A');
      assert.equal(opcionA.disponible_por_kilo, false);
      assert.equal(opcionA.plato_id, plato.id, 'el plato/vianda de la celda sigue intacto');
      assert.equal(opcionA.vianda_id, null, 'no se creo/rompio ninguna vianda por el toggle');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('disponible_por_kilo: puesto en el menu es disponible por defecto, el flag del slot solo excluye puntualmente (decision de sesion 2026-07-13, revierte el requisito de regla de catalogo)', async () => {
  const prefijo = `itp${Date.now()}sopL`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo, '2026-08-10'); // lunes

      // Especial recien agregado, sin tocar el flag -> disponible por kilo
      // por defecto (sin necesidad de ninguna regla de catalogo).
      const platoDefault = await crearPlatoConVianda(prefijo, 'DefaultPorKilo');
      await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES ($1, 'lunes', 'A', $2)`,
        [menu.id, platoDefault.id],
      );

      // Especial excluido puntualmente esta semana -> false.
      const platoExcluido = await crearPlatoConVianda(prefijo, 'ExcluidoPorKilo');
      const slotExcluido = (await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES ($1, 'lunes', 'B', $2) RETURNING id`,
        [menu.id, platoExcluido.id],
      )).rows[0];
      await requestJson(servidor.baseUrl, 'PUT', `/semana-opciones/slots/${slotExcluido.id}/disponible-por-kilo`, { token, payload: { disponible: false } });

      // Fijo de siempre -> true sin ninguna configuracion de catalogo (esta
      // puesto en el menu todas las semanas por definicion, no tiene
      // excepcion semanal posible).
      const platoFijo = await crearPlatoConVianda(prefijo, 'FijoPorKilo', { disponibilidad: 'siempre' });

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      assert.equal(respuesta.status, 200);
      const lunes = respuesta.body.data.dias.find((d) => d.dia === 'lunes');

      assert.equal(lunes.opciones.find((o) => o.opcion === 'A').disponible_por_kilo, true, 'especial recien agregado, disponible por kilo por defecto');
      assert.equal(lunes.opciones.find((o) => o.opcion === 'B').disponible_por_kilo, false, 'especial excluido puntualmente esta semana -> no disponible');
      assert.equal(lunes.fijos.find((f) => f.plato_id === platoFijo.id).disponible_por_kilo, true, 'fijo siempre disponible por kilo, sin configuracion de catalogo necesaria');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('platos siempre/fijo_dia globales aparecen en Fijos, no en Menu semanal (fix tras verificacion manual)', async () => {
  const prefijo = `itp${Date.now()}sopF`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo, '2026-08-10'); // lunes
      const platoSiempre = await crearPlatoConVianda(prefijo, 'Fijo de siempre', { disponibilidad: 'siempre' });
      const platoFijoSabado = await crearPlatoConVianda(prefijo, 'Fijo del sabado', { disponibilidad: 'fijo_dia', diaFijo: 'sabado' });

      // Hallazgo de /office-hours + /plan-design-review (2026-07-12/13): los
      // platos globales fijo_dia/siempre son "Fijos" de verdad (19 reales en
      // produccion) y deben aparecer en dias[].fijos, no quedar invisibles.
      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      assert.equal(respuesta.status, 200);

      const lunes = respuesta.body.data.dias.find((d) => d.dia === 'lunes');
      assert.equal(lunes.opciones.length, 0, 'no debe aparecer como Menu semanal (menu_semanal_dias vacio)');
      assert.ok(
        lunes.fijos.some((f) => f.plato_id === platoSiempre.id && f.origen === 'global' && f.categoria === 'siempre'),
        'el plato siempre debe aparecer en Fijos todos los dias, incluido lunes'
      );
      assert.ok(
        !lunes.fijos.some((f) => f.plato_id === platoFijoSabado.id),
        'el fijo de sabado no debe aparecer en lunes'
      );

      const sabado = respuesta.body.data.dias.find((d) => d.dia === 'sabado');
      assert.ok(
        sabado.fijos.some((f) => f.plato_id === platoFijoSabado.id && f.categoria === 'fijo_dia'),
        'el fijo de sabado debe aparecer en Fijos el sabado'
      );
      assert.ok(
        sabado.fijos.some((f) => f.plato_id === platoSiempre.id),
        'el plato siempre tambien aparece el sabado (todos los dias)'
      );
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('un especial de esta semana no duplica el mismo plato en Fijos (precedencia, mismo patron que vista-semanal)', async () => {
  const prefijo = `itp${Date.now()}sopH`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo, '2026-08-10'); // lunes
      // Plato con regla global fijo_dia=sabado Y ADEMAS programado como
      // especial ese mismo sabado en esta semana puntual -- el especial
      // (mas especifico) gana, no debe duplicarse en Fijos.
      const plato = await crearPlatoConVianda(prefijo, 'Ambos', { disponibilidad: 'fijo_dia', diaFijo: 'sabado' });
      await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES ($1, 'sabado', 'A', $2)`,
        [menu.id, plato.id],
      );

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      assert.equal(respuesta.status, 200);
      const sabado = respuesta.body.data.dias.find((d) => d.dia === 'sabado');
      assert.ok(sabado.opciones.some((o) => o.plato_id === plato.id), 'debe aparecer como Menu semanal (especial)');
      assert.ok(!sabado.fijos.some((f) => f.plato_id === plato.id), 'no debe duplicarse en Fijos ese mismo dia');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('un ciclo rotativo con 1 grupo resuelve el plato en la columna Fijos (regresion: menu.fecha_inicio llega como Date, no string)', async () => {
  const prefijo = `itp${Date.now()}sopG`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      // menus_semanales.fecha_inicio es DATE -- pg lo devuelve como objeto
      // Date, no string. calcularIndiceRotacion hacia interpolacion de
      // template string asumiendo 'YYYY-MM-DD' y daba NaN silencioso con un
      // Date, resolviendo grupo=null aunque hubiera exactamente 1 grupo
      // activo (bug real encontrado en verificacion manual en navegador).
      const menu = await crearMenu(prefijo, '2026-08-08'); // sabado
      const plato = await crearPlatoConVianda(prefijo, 'Rotativo');

      const ciclo = (await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/ciclos', {
        token, payload: { dia_semana: 'sabado', nombre: `${prefijo} Ciclo` },
      })).body.data;
      const grupo = (await requestJson(servidor.baseUrl, 'POST', '/grupos-rotativos/grupos', {
        token, payload: { ciclo_rotacion_id: ciclo.id, nombre: 'Grupo A', orden: 0 },
      })).body.data;
      await requestJson(servidor.baseUrl, 'POST', `/grupos-rotativos/grupos/${grupo.id}/platos`, {
        token, payload: { plato_id: plato.id, orden: 0 },
      });

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      assert.equal(respuesta.status, 200);
      const sabado = respuesta.body.data.dias.find((d) => d.dia === 'sabado');
      const fijo = sabado.fijos.find((f) => f.ciclo_id === ciclo.id);
      assert.ok(fijo, 'el ciclo debe aparecer en la columna Fijos');
      assert.equal(fijo.grupo_id, grupo.id, 'con 1 solo grupo activo, siempre debe resolverse (nunca null)');
      assert.equal(fijo.plato_id, plato.id, 'debe resolver el plato orden=0 del grupo');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('vianda_activa: especial usa la decision del slot, fijos usan el anclaje por semana (menu_semanal_fijos_vianda), no el catalogo (hallazgo de sesion viendo datos reales)', async () => {
  const prefijo = `itp${Date.now()}sopJ`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo, '2026-08-10'); // lunes

      // Especial A: el slot SI tiene vianda_id anclado -> vianda_activa true.
      const platoA = await crearPlatoConVianda(prefijo, 'EspecialConDecision');
      const viandaA = (await query('SELECT id FROM viandas WHERE plato_id = $1', [platoA.id])).rows[0];
      await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id, vianda_id) VALUES ($1, 'lunes', 'A', $2, $3)`,
        [menu.id, platoA.id, viandaA.id],
      );

      // Especial B: el plato tiene vianda activa, pero el slot NO la ancla
      // (misma situacion que el test de disponible_por_kilo) -> vianda_activa false.
      const platoB = await crearPlatoConVianda(prefijo, 'EspecialSinDecision');
      await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES ($1, 'lunes', 'B', $2)`,
        [menu.id, platoB.id],
      );

      // Fijo con vianda activa en el CATALOGO pero SIN anclar esta semana ->
      // vianda_activa debe dar false (antes daba true por error: leia
      // existencia en el catalogo, no la decision de esta semana).
      const platoFijoCatalogoSinAnclar = await crearPlatoConVianda(prefijo, 'FijoCatalogoSinAnclar', { disponibilidad: 'siempre' });

      // Fijo anclado para ESTA semana (INSERT directo en menu_semanal_fijos_vianda,
      // simulando lo que hace marcarFijoVianda) -> vianda_activa true.
      const platoFijoAnclado = await crearPlatoConVianda(prefijo, 'FijoAnclado', { disponibilidad: 'siempre' });
      const viandaFijoAnclado = (await query('SELECT id FROM viandas WHERE plato_id = $1', [platoFijoAnclado.id])).rows[0];
      await query(
        `INSERT INTO menu_semanal_fijos_vianda (menu_semanal_id, plato_id, vianda_id) VALUES ($1, $2, $3)`,
        [menu.id, platoFijoAnclado.id, viandaFijoAnclado.id],
      );

      // Fijo sin ninguna vianda en el catalogo -> vianda_activa false.
      const platoFijoSin = (await query(
        `INSERT INTO platos (nombre, descripcion, activo, tipo, disponibilidad)
         VALUES ($1, 'Plato test semana opciones', true, 'especial', 'siempre') RETURNING *`,
        [`${prefijo} FijoSinVianda`],
      )).rows[0];

      const respuesta = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      assert.equal(respuesta.status, 200);
      const lunes = respuesta.body.data.dias.find((d) => d.dia === 'lunes');

      const opcionA = lunes.opciones.find((o) => o.opcion === 'A');
      const opcionB = lunes.opciones.find((o) => o.opcion === 'B');
      assert.equal(opcionA.vianda_activa, true, 'slot con vianda_id anclado debe dar vianda_activa true');
      assert.equal(opcionB.vianda_activa, false, 'slot sin vianda_id anclado debe dar vianda_activa false aunque el plato tenga una vianda activa');

      const fijoCatalogoSinAnclar = lunes.fijos.find((f) => f.plato_id === platoFijoCatalogoSinAnclar.id);
      const fijoAnclado = lunes.fijos.find((f) => f.plato_id === platoFijoAnclado.id);
      const fijoSin = lunes.fijos.find((f) => f.plato_id === platoFijoSin.id);
      assert.equal(fijoCatalogoSinAnclar.vianda_activa, false, 'fijo con vianda en el catalogo pero sin anclar esta semana debe dar vianda_activa false');
      assert.equal(fijoAnclado.vianda_activa, true, 'fijo anclado para esta semana en menu_semanal_fijos_vianda debe dar vianda_activa true');
      assert.equal(fijoSin.vianda_activa, false, 'fijo sin ninguna vianda en el catalogo debe dar vianda_activa false');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('POST/DELETE fijos/:platoId/vianda: marcar y quitar el anclaje de vianda de un fijo para esta semana', async () => {
  const prefijo = `itp${Date.now()}sopK`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo, '2026-08-10'); // lunes
      const platoConVianda = await crearPlatoConVianda(prefijo, 'MarcarFijo', { disponibilidad: 'siempre' });
      const platoSinVianda = (await query(
        `INSERT INTO platos (nombre, descripcion, activo, tipo, disponibilidad)
         VALUES ($1, 'Plato test semana opciones', true, 'especial', 'siempre') RETURNING *`,
        [`${prefijo} SinViandaCatalogo`],
      )).rows[0];

      // Marcar un plato sin ninguna vianda en el catalogo -> 400, no hay nada que anclar.
      const rechazo = await requestJson(
        servidor.baseUrl, 'POST', `/semana-opciones/${menu.id}/fijos/${platoSinVianda.id}/vianda`, { token }
      );
      assert.equal(rechazo.status, 400);

      // Marcar un plato con vianda activa -> 200, queda anclado.
      const marcado = await requestJson(
        servidor.baseUrl, 'POST', `/semana-opciones/${menu.id}/fijos/${platoConVianda.id}/vianda`, { token }
      );
      assert.equal(marcado.status, 200);

      const conAncla = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      const lunesConAncla = conAncla.body.data.dias.find((d) => d.dia === 'lunes');
      assert.equal(
        lunesConAncla.fijos.find((f) => f.plato_id === platoConVianda.id).vianda_activa,
        true,
        'tras marcar, el fijo debe aparecer con vianda_activa true'
      );

      // Quitar -> 200, deja de estar anclado.
      const quitado = await requestJson(
        servidor.baseUrl, 'DELETE', `/semana-opciones/${menu.id}/fijos/${platoConVianda.id}/vianda`, { token }
      );
      assert.equal(quitado.status, 200);

      const sinAncla = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      const lunesSinAncla = sinAncla.body.data.dias.find((d) => d.dia === 'lunes');
      assert.equal(
        lunesSinAncla.fijos.find((f) => f.plato_id === platoConVianda.id).vianda_activa,
        false,
        'tras quitar, el fijo debe volver a vianda_activa false'
      );
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('POST/DELETE slots/:slotId/vianda: marcar y quitar el anclaje de vianda de un especial (fix del gap real: ningun endpoint vivo seteaba menu_semanal_dias.vianda_id)', async () => {
  const prefijo = `itp${Date.now()}sopM`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo, '2026-08-10'); // lunes
      const platoConVianda = await crearPlatoConVianda(prefijo, 'MarcarEspecial');
      const slot = (await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES ($1, 'lunes', 'A', $2) RETURNING id`,
        [menu.id, platoConVianda.id],
      )).rows[0];

      const platoSinVianda = (await query(
        `INSERT INTO platos (nombre, descripcion, activo, tipo, disponibilidad)
         VALUES ($1, 'Plato test semana opciones', true, 'especial', 'especial') RETURNING *`,
        [`${prefijo} EspecialSinVianda`],
      )).rows[0];
      const slotSinVianda = (await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES ($1, 'lunes', 'B', $2) RETURNING id`,
        [menu.id, platoSinVianda.id],
      )).rows[0];

      // Marcar un slot cuyo plato no tiene vianda en el catalogo -> 400.
      const rechazo = await requestJson(
        servidor.baseUrl, 'POST', `/semana-opciones/slots/${slotSinVianda.id}/vianda`, { token }
      );
      assert.equal(rechazo.status, 400);

      // Marcar un slot con vianda activa -> 200, ancla vianda_id en el slot.
      const marcado = await requestJson(
        servidor.baseUrl, 'POST', `/semana-opciones/slots/${slot.id}/vianda`, { token }
      );
      assert.equal(marcado.status, 200);

      const conAncla = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      const lunesConAncla = conAncla.body.data.dias.find((d) => d.dia === 'lunes');
      const opcionAConAncla = lunesConAncla.opciones.find((o) => o.opcion === 'A');
      assert.equal(opcionAConAncla.vianda_activa, true, 'tras marcar, el especial debe aparecer con vianda_activa true');
      assert.ok(opcionAConAncla.vianda_id, 'el slot debe tener vianda_id anclado');

      // Quitar -> 200, deja de estar anclado.
      const quitado = await requestJson(
        servidor.baseUrl, 'DELETE', `/semana-opciones/slots/${slot.id}/vianda`, { token }
      );
      assert.equal(quitado.status, 200);

      const sinAncla = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      const lunesSinAncla = sinAncla.body.data.dias.find((d) => d.dia === 'lunes');
      const opcionASinAncla = lunesSinAncla.opciones.find((o) => o.opcion === 'A');
      assert.equal(opcionASinAncla.vianda_activa, false, 'tras quitar, el especial debe volver a vianda_activa false');
      assert.equal(opcionASinAncla.vianda_id, null, 'el slot debe quedar sin vianda_id');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('visible_empresa_ids expone el allowlist real (menu_empresa_visibilidad), distinto del campo empresas (asignacion de Opcion A/B/C, organizativa)', async () => {
  const prefijo = `itp${Date.now()}sopN`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo, '2026-08-10'); // lunes
      const plato = await crearPlatoConVianda(prefijo, 'VisibilidadSlot');
      const slot = (await query(
        `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id) VALUES ($1, 'lunes', 'A', $2) RETURNING id`,
        [menu.id, plato.id],
      )).rows[0];
      const empresaPermitida = await crearEmpresa(prefijo, 'Permitida', null);
      const empresaNoRestringida = await crearEmpresa(prefijo, 'OtraSinRestriccion', null);

      // Sin filas en menu_empresa_visibilidad -> [] (visible para todas).
      const sinRestriccion = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      const opcionSinRestriccion = sinRestriccion.body.data.dias.find((d) => d.dia === 'lunes').opciones.find((o) => o.opcion === 'A');
      assert.deepEqual(opcionSinRestriccion.visible_empresa_ids, [], 'sin filas en menu_empresa_visibilidad, visible para todas');

      await query('INSERT INTO menu_empresa_visibilidad (menu_semanal_dia_id, empresa_id) VALUES ($1, $2)', [slot.id, empresaPermitida.id]);

      const conRestriccion = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      const opcionConRestriccion = conRestriccion.body.data.dias.find((d) => d.dia === 'lunes').opciones.find((o) => o.opcion === 'A');
      assert.deepEqual(opcionConRestriccion.visible_empresa_ids, [empresaPermitida.id], 'con una fila, solo esa empresa esta en el allowlist');
      assert.ok(!opcionConRestriccion.visible_empresa_ids.includes(empresaNoRestringida.id), 'la otra empresa no debe aparecer en el allowlist');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('sin_servicio expone el estado y motivo por dia (primer paso de migracion de edicion, /office-hours 2026-07-13)', async () => {
  const prefijo = `itp${Date.now()}sopI`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const menu = await crearMenu(prefijo, '2026-08-10'); // lunes

      const sinMarcar = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      const juevesAntes = sinMarcar.body.data.dias.find((d) => d.dia === 'jueves');
      assert.equal(juevesAntes.sin_servicio, false);
      assert.equal(juevesAntes.motivo_sin_servicio, null);

      const marcado = await requestJson(servidor.baseUrl, 'POST', `/menus-semanales/${menu.id}/sin-servicio`, {
        token, payload: { dia: 'jueves', motivo: 'Feriado' },
      });
      assert.equal(marcado.status, 201);

      const conMarcar = await requestJson(servidor.baseUrl, 'GET', `/semana-opciones/${menu.id}`, { token });
      const juevesDespues = conMarcar.body.data.dias.find((d) => d.dia === 'jueves');
      assert.equal(juevesDespues.sin_servicio, true);
      assert.equal(juevesDespues.motivo_sin_servicio, 'Feriado');

      const otroDia = conMarcar.body.data.dias.find((d) => d.dia === 'viernes');
      assert.equal(otroDia.sin_servicio, false, 'no debe afectar otros dias');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});
