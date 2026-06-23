import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platosService } from '../services/platos.service.js';

export const PLATOS_KEY = 'platos';

export const usePlatos = (params) =>
  useQuery({
    queryKey: [PLATOS_KEY, params],
    queryFn: () => platosService.getAll(params),
    select: (res) => res.data,
  });

export const usePlato = (id) =>
  useQuery({
    queryKey: [PLATOS_KEY, id],
    queryFn: () => platosService.getById(id),
    select: (res) => res.data,
    enabled: !!id,
  });

export const useCreatePlato = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: platosService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PLATOS_KEY] }),
  });
};

export const useUpdatePlato = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => platosService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PLATOS_KEY] }),
  });
};

export const useDeletePlato = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: platosService.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PLATOS_KEY] }),
  });
};

export const usePlatoTags = () =>
  useQuery({
    queryKey: [PLATOS_KEY, 'tags'],
    queryFn: () => platosService.getTags(),
    select: (res) => res.data,
    staleTime: 1000 * 60 * 5,
  });
