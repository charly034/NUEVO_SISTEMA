import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'planes';

export const usePlanes = () =>
  useQuery({ queryKey: [KEY], queryFn: () => api.get('/planes').then(r => r.data) });

export const useCreatePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/planes', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useUpdatePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.patch(`/planes/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useDeletePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/planes/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};
