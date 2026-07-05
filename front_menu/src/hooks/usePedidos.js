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
