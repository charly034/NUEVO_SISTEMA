import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'pedidos-admin';

export const usePedidos = (params, options = {}) =>
  useQuery({
    queryKey: [KEY, params],
    queryFn: () => api.get('/pedidos', { params }).then(r => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    ...options,
  });

export const useUpdateEstadoPedido = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }) => api.patch(`/pedidos/${id}/estado`, { estado }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useSugerenciasResumen = (semanaInicio, options = {}) =>
  useQuery({
    queryKey: ['sugerencias-resumen', semanaInicio],
    queryFn: () => api.get('/pedidos/sugerencias/resumen', { params: { semana_inicio: semanaInicio } }).then(r => r.data?.data ?? r.data),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(semanaInicio),
    ...options,
  });

export const useUpdateEstadoPedidoItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, estado }) => api.patch(`/pedidos/items/${itemId}/estado`, { estado }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};
