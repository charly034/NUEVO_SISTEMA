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

test('rechaza días duplicados', () => {
  assert.throws(
    () => validarPedidoInput({ ...valido, items: [valido.items[0], valido.items[0]] }),
    /está repetido/
  );
});

test('rechaza una semana con formato inválido', () => {
  assert.throws(
    () => validarPedidoInput({ ...valido, semana_inicio: '22/06/2026' }),
    /YYYY-MM-DD/
  );
});

test('rechaza opciones que no sean una letra mayúscula', () => {
  assert.throws(
    () => validarPedidoInput({ ...valido, items: [{ ...valido.items[0], opcion: 'aa' }] }),
    /Opción inválida/
  );
});

test('rechaza notas mayores a 300 caracteres', () => {
  assert.throws(
    () => validarPedidoInput({ ...valido, items: [{ ...valido.items[0], notas: 'x'.repeat(301) }] }),
    /300 caracteres/
  );
});
