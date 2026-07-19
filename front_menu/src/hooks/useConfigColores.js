import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'config-menu-colores';

// Default: paleta "Sobrio" (verde de marca / índigo / naranja). Debe coincidir
// con COLORES_DEFAULT del backend (configuracion.service.js).
export const COLORES_DEFAULT = { vianda: '#2b7330', porKilo: '#6366f1', ambos: '#f97316', ninguno: '#9ca3af', categoriaEstilo: 'sobrio', categorias: {} };

export const useColoresCeldas = () =>
  useQuery({
    queryKey: [KEY],
    queryFn: () => api.get('/configuracion/menu-colores').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: COLORES_DEFAULT,
  });

export const useUpdateColoresCeldas = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (colores) => api.put('/configuracion/menu-colores', colores).then((r) => r.data),
    onSuccess: (data) => qc.setQueryData([KEY], data),
  });
};
