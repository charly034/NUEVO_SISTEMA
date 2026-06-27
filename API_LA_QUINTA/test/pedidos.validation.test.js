import test from 'node:test';
import assert from 'node:assert/strict';
import { validarPedidoInput } from '../src/modules/pedidos/pedidos.validation.js';

const valido = {
  semana_inicio: '2026-06-22',
  menu_semanal_id: 4,
  items: [{ dia: 'lunes', plato_id: 10, opcion: 'A', notas: 'Sin sal' }],
};

test('acepta un pedido bien formado', () => {
  const dias = validarPedidoInput(valido);
  assert.deepEqual([...dias], ['lunes']);
});

test('rechaza dias duplicados', () => {
  assert.throws(
    () => validarPedidoInput({ ...valido, items: [valido.items[0], valido.items[0]] }),
    /esta repetido/
  );
});

test('rechaza una semana con formato invalido', () => {
  assert.throws(
    () => validarPedidoInput({ ...valido, semana_inicio: '22/06/2026' }),
    /YYYY-MM-DD/
  );
});

test('rechaza opciones que no sean una letra mayuscula', () => {
  assert.throws(
    () => validarPedidoInput({ ...valido, items: [{ ...valido.items[0], opcion: 'aa' }] }),
    /Opcion invalida/
  );
});

test('rechaza notas mayores a 300 caracteres', () => {
  assert.throws(
    () => validarPedidoInput({ ...valido, items: [{ ...valido.items[0], notas: 'x'.repeat(301) }] }),
    /300 caracteres/
  );
});

test('acepta un dia marcado sin pedido sin plato ni guarnicion', () => {
  const dias = validarPedidoInput({
    semana_inicio: '2026-06-22',
    menu_semanal_id: null,
    items: [{ dia: 'sabado', plato_id: null, guarnicion_id: null, sin_pedido: true, origen: 'default' }],
  });

  assert.deepEqual([...dias], ['sabado']);
});

test('rechaza sin pedido con plato cargado', () => {
  assert.throws(
    () => validarPedidoInput({
      semana_inicio: '2026-06-22',
      menu_semanal_id: null,
      items: [{ dia: 'sabado', plato_id: 10, guarnicion_id: null, sin_pedido: true }],
    }),
    /no debe enviar plato/
  );
});

test('rechaza sin pedido con guarnicion cargada', () => {
  assert.throws(
    () => validarPedidoInput({
      semana_inicio: '2026-06-22',
      menu_semanal_id: null,
      items: [{ dia: 'domingo', plato_id: null, guarnicion_id: 2, sin_pedido: true }],
    }),
    /no debe enviar guarnicion/
  );
});

test('rechaza origen invalido en sin pedido', () => {
  assert.throws(
    () => validarPedidoInput({
      semana_inicio: '2026-06-22',
      menu_semanal_id: null,
      items: [{ dia: 'domingo', plato_id: null, guarnicion_id: null, sin_pedido: true, origen: 'api' }],
    }),
    /Origen invalido/
  );
});
