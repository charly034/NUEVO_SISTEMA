import { useQuery } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'pedido-sugerencias-admin';

export const usePedidoSugerencias = (params) =>
  useQuery({
    queryKey: [KEY, params],
    queryFn: () => api.get('/pedidos/sugerencias', { params }).then(r => r.data),
  });
