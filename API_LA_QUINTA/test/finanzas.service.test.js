import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularEstadoFinanciero,
  normalizarConfiguracionCobroInput,
  normalizarPagoInput,
} from '../src/modules/finanzas/finanzas.service.js';

test('calcula estado financiero pendiente sin pagos', () => {
  assert.equal(calcularEstadoFinanciero(1200, 0), 'pendiente');
});

test('calcula estado financiero parcial cuando el pago no cubre el total', () => {
  assert.equal(calcularEstadoFinanciero(1200, 500), 'parcial');
});

test('calcula estado financiero pagado cuando cubre el total exacto', () => {
  assert.equal(calcularEstadoFinanciero(1200, 1200), 'pagado');
});

test('calcula saldo a favor cuando el pago supera el total', () => {
  assert.equal(calcularEstadoFinanciero(1200, 1500), 'saldo_a_favor');
});

test('normaliza un pago de empresa valido', () => {
  const pago = normalizarPagoInput({
    pagador_tipo: 'empresa',
    empresa_id: 10,
    monto: '15000.50',
    fecha_pago: '2026-07-03',
    metodo_pago: 'transferencia',
    periodo_desde: '2026-07-01',
    periodo_hasta: '2026-07-15',
  });

  assert.equal(pago.pagador_tipo, 'empresa');
  assert.equal(pago.empresa_id, 10);
  assert.equal(pago.empleado_id, null);
  assert.equal(pago.monto, 15000.5);
});

test('rechaza pago de empleado sin empleado_id', () => {
  assert.throws(
    () => normalizarPagoInput({
      pagador_tipo: 'empleado',
      monto: 1000,
      fecha_pago: '2026-07-03',
      metodo_pago: 'efectivo',
    }),
    /empleado_id es requerido/,
  );
});

test('rechaza periodo de pago invertido', () => {
  assert.throws(
    () => normalizarPagoInput({
      pagador_tipo: 'empresa',
      empresa_id: 1,
      monto: 1000,
      fecha_pago: '2026-07-03',
      metodo_pago: 'efectivo',
      periodo_desde: '2026-07-15',
      periodo_hasta: '2026-07-01',
    }),
    /periodo_hasta/,
  );
});

test('normaliza configuracion de cobro por empresa', () => {
  const config = normalizarConfiguracionCobroInput({
    empresa_id: 2,
    modalidad: 'mensual',
    dia_vencimiento: 10,
  });

  assert.equal(config.empresa_id, 2);
  assert.equal(config.empleado_id, null);
  assert.equal(config.modalidad, 'mensual');
  assert.equal(config.dia_vencimiento, 10);
  assert.equal(config.activo, true);
});

test('rechaza configuracion de cobro con empresa y empleado a la vez', () => {
  assert.throws(
    () => normalizarConfiguracionCobroInput({
      empresa_id: 2,
      empleado_id: 3,
      modalidad: 'mensual',
    }),
    /empresa_id o empleado_id/,
  );
});
