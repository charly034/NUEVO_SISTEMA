import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menusService } from '../services/menus.service.js';

export const MENUS_KEY = 'menus-semanales';

export const useMenusSemanales = (params) =>
  useQuery({
    queryKey: [MENUS_KEY, params],
    queryFn: () => menusService.getAll(params),
    select: (res) => res.data,
  });

export const useMenuSemanal = (id) =>
  useQuery({
    queryKey: [MENUS_KEY, id],
    queryFn: () => menusService.getById(id),
    select: (res) => res.data,
    enabled: !!id,
  });

export const useCreateMenu = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: menusService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: [MENUS_KEY] }),
  });
};

export const useUpdateMenu = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => menusService.update(id, data),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: [MENUS_KEY, id] }),
  });
};

export const useDeleteMenu = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: menusService.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: [MENUS_KEY] }),
  });
};

export const useCambiarEstadoMenu = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado, extra }) => menusService.cambiarEstado(id, estado, extra),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MENUS_KEY] }),
  });
};

export const useAgregarPlato = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => menusService.agregarPlato(menuId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId] }),
  });
};

export const useQuitarPlato = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dia, opcion }) => menusService.quitarPlato(menuId, dia, opcion),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId] }),
  });
};

export const useMarcarSinServicio = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => menusService.marcarSinServicio(menuId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId] }),
  });
};

export const useQuitarSinServicio = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dia) => menusService.quitarSinServicio(menuId, dia),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId] }),
  });
};

export const useHistorialPlato = (platoId) =>
  useQuery({
    queryKey: ['historial', platoId],
    queryFn: () => menusService.getHistorialPlato(platoId),
    select: (res) => res.data,
    enabled: !!platoId,
  });

export const useNoUsados = (params) =>
  useQuery({
    queryKey: ['historial', 'no-usados', params],
    queryFn: () => menusService.getNoUsados(params),
    select: (res) => res.data,
  });
