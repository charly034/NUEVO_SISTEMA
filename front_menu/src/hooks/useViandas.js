import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'viandas';

export const useViandas = (params) =>
  useQuery({
    queryKey: [KEY, params || 'all'],
    queryFn: () => api.get('/viandas', { params }).then((r) => r.data),
  });

export const useCreateVianda = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/viandas', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useUpdateVianda = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/viandas/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};
