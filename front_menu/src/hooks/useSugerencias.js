import { useQuery } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

export function useSugerencias(fechaInicio) {
  return useQuery({
    queryKey: ['sugerencias', fechaInicio],
    queryFn: () => api.get('/sugerencias/semana', { params: { fecha_inicio: fechaInicio } }).then(r => r.data),
    enabled: !!fechaInicio,
  });
}
