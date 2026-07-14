import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/database/connection.js';
import {
  cerrarPoolDb,
  crearFixturePedido,
  iniciarServidorTest,
  limpiarDatosTest,
  payloadPedidoValido,
  requestJson,
} from '../test_helpers/pedidos-http.helper.js';

// Flujo COMPLETO de la excepción de guarnición por empresa (plan-eng-review, T4+T8):
//
//   admin carga la excepción  →  el empleado de ESA empresa la VE en su menú
//                             →  y su pedido la SNAPSHOTEA en pedido_items
//
// Es el eslabón que cierra la feature: los tests de resolución (db) prueban el SQL,
// éste prueba el camino real por HTTP con el token del empleado, incluyendo que la
// empresa SIN excepción sigue viendo la resolución base (no se filtra entre empresas).

let servidor;

before(async () => {
  servidor = await iniciarServidorTest();
});

after(async () => {
  await servidor?.cerrar();
  await cerrarPoolDb();
});

// El payload del cliente es un árbol (semanas → días → opciones); buscamos el plato
// sin acoplarnos a su forma exacta.
function buscarPlato(nodo, platoId) {
  if (!nodo || typeof nodo !== 'object') return null;
  if (Array.isArray(nodo)) {
    for (const n of nodo) {
      const hit = buscarPlato(n, platoId);
      if (hit) return hit;
    }
    return null;
  }
  if ((nodo.platoId === platoId || nodo.plato_id === platoId) && 'guarnicionModo' in nodo) return nodo;
  for (const v of Object.values(nodo)) {
    const hit = buscarPlato(v, platoId);
    if (hit) return hit;
  }
  return null;
}

test('E2E excepción por empresa: el empleado la ve en su menú y su pedido la snapshotea', async () => {
  const fixture = await crearFixturePedido();
  const { prefijo, empresa, otraEmpresa, empleado, token, tokenOtraEmpresa, menu, platoConGuarnicion, guarnicion } = fixture;

  try {
    // Guarnición DISTINTA de la que el plato/vianda resuelve por defecto: es la que
    // va a imponer la excepción de la empresa.
    const guarnExcepcion = (await query(
      `INSERT INTO guarniciones (nombre, activo) VALUES ($1, true) RETURNING id, nombre`,
      [`${prefijo} Puré de la excepción`],
    )).rows[0];

    // La celda del lunes/opción A (el fixture la crea con platoConGuarnicion).
    const slot = (await query(
      `SELECT id, categoria_id, dia, opcion, plato_id FROM menu_semanal_dias
        WHERE menu_semanal_id = $1 AND dia = 'lunes' AND opcion = 'A'`,
      [menu.id],
    )).rows[0];
    assert.ok(slot, 'el fixture debe tener la celda lunes/A');

    // Endpoint REAL del cliente: el que consume useOpcionesMenu en front_clientes
    // (optionalAuth -> la empresa sale del token del empleado).
    const opciones = (tk) => requestJson(servidor.baseUrl, 'GET', `/menu/semanas/${menu.id}/opciones`, { token: tk });

    // ── Estado BASE (sin excepción): ambas empresas ven lo mismo ──────────────
    const semanasBase = await opciones(token);
    assert.equal(semanasBase.status, 200);
    const platoBase = buscarPlato(semanasBase.body, platoConGuarnicion.id);
    assert.ok(platoBase, 'el empleado debe ver el plato en su menú');
    const modoBase = platoBase.guarnicionModo;

    // ── El admin carga la excepción para la empresa del empleado ──────────────
    await query(
      `INSERT INTO menu_semanal_dia_empresa_override
         (menu_semanal_id, categoria_id, dia, opcion, empresa_id, plato_id_origen,
          guarnicion_modo_override, guarnicion_fija_override_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'fija', $7)`,
      [menu.id, slot.categoria_id, slot.dia, slot.opcion, empresa.id, slot.plato_id, guarnExcepcion.id],
    );

    // ── READ: el empleado de la empresa VE la guarnición de la excepción ──────
    const semanas = await opciones(token);
    assert.equal(semanas.status, 200);
    const plato = buscarPlato(semanas.body, platoConGuarnicion.id);
    assert.ok(plato, 'el empleado debe seguir viendo el plato');
    assert.equal(plato.guarnicionModo, 'fija', 'el empleado debe ver el modo de la excepción de su empresa');
    assert.equal(plato.guarnicionFija?.id, guarnExcepcion.id, 'debe ver la guarnición de la excepción');
    assert.equal(plato.guarnicionFija?.nombre, guarnExcepcion.nombre);

    // ── AISLAMIENTO: el empleado de OTRA empresa sigue viendo la base ─────────
    const semanasOtra = await opciones(tokenOtraEmpresa);
    assert.equal(semanasOtra.status, 200);
    const platoOtra = buscarPlato(semanasOtra.body, platoConGuarnicion.id);
    assert.ok(platoOtra, 'la otra empresa debe ver el plato');
    assert.equal(platoOtra.guarnicionModo, modoBase, `la empresa "${otraEmpresa.nombre}" no debe ver la excepción ajena`);
    assert.notEqual(platoOtra.guarnicionFija?.id, guarnExcepcion.id);

    // ── WRITE: el empleado pide, y el pedido SNAPSHOTEA la guarnición de su empresa.
    // El payload manda la guarnición que el cliente elegiría (fixture.guarnicion): como
    // la excepción impone modo 'fija', el servicio la ignora y persiste la de la empresa.
    const payload = payloadPedidoValido(fixture, {
      items: [{ dia: 'lunes', plato_id: platoConGuarnicion.id, opcion: 'A', guarnicion_id: guarnicion.id }],
    });
    const creado = await requestJson(servidor.baseUrl, 'POST', '/pedidos', { token, payload });
    assert.equal(creado.status, 201, `el pedido debe crearse: ${JSON.stringify(creado.body)}`);

    const item = (await query(
      `SELECT pi.guarnicion_id
         FROM pedido_items pi
         JOIN pedidos p ON p.id = pi.pedido_id
        WHERE p.empleado_id = $1 AND pi.dia = 'lunes'`,
      [empleado.id],
    )).rows[0];
    assert.ok(item, 'el pedido debe tener el ítem del lunes');
    assert.equal(
      item.guarnicion_id,
      guarnExcepcion.id,
      'el pedido debe quedar snapshoteado con la guarnición de la excepción de la empresa, no con la que mandó el cliente',
    );
    assert.notEqual(item.guarnicion_id, guarnicion.id);

    // La excepción se borra sola con el menú (CASCADE); la guarnición de test, a mano.
    await query('DELETE FROM guarniciones WHERE id = $1', [guarnExcepcion.id]);
  } finally {
    await limpiarDatosTest(prefijo);
  }
});
