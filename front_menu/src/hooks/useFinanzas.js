import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

export const FINANZAS_KEY = 'finanzas';

export const useFinanzasResumen = (options = {}) =>
  useQuery({
    queryKey: [FINANZAS_KEY, 'resumen'],
    queryFn: () => api.get('/finanzas/resumen').then(r => r.data),
    staleTime: 30_000,
    ...options,
  });

export const useFinanzasPedidosPagos = (params = {}, options = {}) =>
  useQuery({
    queryKey: [FINANZAS_KEY, 'pedidos-pagos', params],
    queryFn: () => api.get('/finanzas/pedidos-pagos', { params }).then(r => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    ...options,
  });

export const useCuentaCorrienteEmpresa = (empresaId, options = {}) =>
  useQuery({
    queryKey: [FINANZAS_KEY, 'cuenta-corriente', 'empresa', empresaId],
    queryFn: () => api.get(`/finanzas/cuenta-corriente/empresas/${empresaId}`).then(r => r.data),
    enabled: Boolean(empresaId),
    ...options,
  });

export const useCuentaCorrienteEmpleado = (empleadoId, options = {}) =>
  useQuery({
    queryKey: [FINANZAS_KEY, 'cuenta-corriente', 'empleado', empleadoId],
    queryFn: () => api.get(`/finanzas/cuenta-corriente/empleados/${empleadoId}`).then(r => r.data),
    enabled: Boolean(empleadoId),
    ...options,
  });

export const useRegistrarPago = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/finanzas/pagos', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FINANZAS_KEY] }),
  });
};

export const useActualizarPago = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.patch(`/finanzas/pagos/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FINANZAS_KEY] }),
  });
};

export const useAnularPago = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }) => api.post(`/finanzas/pagos/${id}/anular`, { motivo }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FINANZAS_KEY] }),
  });
};

export const useAplicarPago = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, aplicaciones }) => api.post(`/finanzas/pagos/${id}/aplicar`, { aplicaciones }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FINANZAS_KEY] }),
  });
};

export const useDesasociarAplicacionPago = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pagoId, aplicacionId }) => api.delete(`/finanzas/pagos/${pagoId}/aplicaciones/${aplicacionId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FINANZAS_KEY] }),
  });
};
