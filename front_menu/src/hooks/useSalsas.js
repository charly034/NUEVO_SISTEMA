import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'salsas';

export const useSalsas = () =>
  useQuery({ queryKey: [KEY], queryFn: () => api.get('/salsas').then(r => r.data) });

export const useCreateSalsa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nombre }) => api.post('/salsas', { nombre }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useUpdateSalsa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.patch(`/salsas/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useDeleteSalsa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/salsas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};
