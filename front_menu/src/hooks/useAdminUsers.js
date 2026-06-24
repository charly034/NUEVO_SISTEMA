import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'admin-users';

export const useAdminUsers = (enabled = true) =>
  useQuery({
    queryKey: [KEY],
    queryFn: () => api.get('/admin/auth/usuarios').then(r => r.data),
    enabled,
  });

export const useCreateAdminUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/admin/auth/usuarios', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useUpdateAdminUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.patch(`/admin/auth/usuarios/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useDeleteAdminUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/admin/auth/usuarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};
