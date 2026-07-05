import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'pedido-sugerencias-admin';
const OPCIONES_KEY = 'pedido-sugerencias-opciones';

export const usePedidoSugerencias = (params) =>
  useQuery({
    queryKey: [KEY, params],
    queryFn: () => api.get('/pedidos/sugerencias', { params }).then(r => r.data),
  });

export const usePedidoSugerenciaOpciones = (semanaInicio) =>
  useQuery({
    queryKey: [OPCIONES_KEY, semanaInicio],
    queryFn: () => api.get('/pedidos/sugerencias/opciones', { params: { semana_inicio: semanaInicio } }).then(r => r.data),
    enabled: Boolean(semanaInicio),
  });

export const useGuardarPedidoSugerenciaOpciones = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ semana_inicio, plato_ids }) => api.put('/pedidos/sugerencias/opciones', { semana_inicio, plato_ids }).then(r => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [OPCIONES_KEY, variables.semana_inicio] });
    },
  });
};
