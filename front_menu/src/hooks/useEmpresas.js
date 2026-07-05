import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'empresas';

export const useEmpresas = (params = null) =>
  useQuery({
    queryKey: [KEY, params || 'all'],
    queryFn: () => api.get('/empresas', {
      params: params || { page: 1, pageSize: 1000, estado: 'todas' },
    }).then((r) => {
      if (params) return r.data;
      return Array.isArray(r.data) ? r.data : r.data?.data || [];
    }),
  });

export const getDependenciasEmpresa = (id) =>
  api.get(`/empresas/${id}/dependencias`).then(r => r.data);

export const useCreateEmpresa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/empresas', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useUpdateEmpresa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.patch(`/empresas/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useDeleteEmpresa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/empresas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useReopenPlazo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, horas }) => api.post(`/empresas/${id}/reabrir-plazo`, { horas }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useClearOverride = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/empresas/${id}/reabrir-plazo`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useRegenerarCodigo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/empresas/${id}/regenerar-codigo`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};
