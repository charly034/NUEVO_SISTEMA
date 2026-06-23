import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'empleados';

export const useEmpleados = (empresa_id) =>
  useQuery({
    queryKey: [KEY, empresa_id],
    queryFn: () => api.get('/empleados', { params: empresa_id ? { empresa_id } : {} }).then(r => r.data),
  });

export const useCreateEmpleado = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/empleados', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useUpdateEmpleado = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.patch(`/empleados/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useDeleteEmpleado = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/empleados/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};
