import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'guarniciones';

export const useGuarniciones = () =>
  useQuery({ queryKey: [KEY], queryFn: () => api.get('/guarniciones').then(r => r.data) });

export const useCreateGuarnicion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nombre) => api.post('/guarniciones', { nombre }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useUpdateGuarnicion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.patch(`/guarniciones/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useDeleteGuarnicion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/guarniciones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};
