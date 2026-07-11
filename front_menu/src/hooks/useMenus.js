import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menusService } from '../services/menus.service.js';

export const MENUS_KEY = 'menus-semanales';

export const useMenusSemanales = (params, options = {}) =>
  useQuery({
    queryKey: [MENUS_KEY, params],
    queryFn: () => menusService.getAll(params),
    select: (res) => res.data,
    ...options,
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

export const useDuplicarMenu = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => menusService.duplicar(id, data),
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

export const useDisenoMenu = (id) =>
  useQuery({
    queryKey: [MENUS_KEY, id, 'diseno'],
    queryFn: () => menusService.getDiseno(id),
    select: (res) => res.data,
    enabled: !!id,
  });

export const useAgregarPlato = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => menusService.agregarPlato(menuId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId] });
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId, 'diseno'] });
    },
  });
};

export const useSetEmpresasSlot = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dia, opcion, empresa_ids }) => menusService.setEmpresasSlot(menuId, dia, opcion, { empresa_ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId, 'diseno'] });
    },
  });
};

export const useActualizarGuarnicionSlot = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dia, opcion, ...data }) => menusService.actualizarGuarnicionSlot(menuId, dia, opcion, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId, 'diseno'] });
    },
  });
};

export const useActualizarSalsaSlot = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dia, opcion, ...data }) => menusService.actualizarSalsaSlot(menuId, dia, opcion, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId, 'diseno'] });
    },
  });
};

export const useQuitarPlato = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dia, opcion }) => menusService.quitarPlato(menuId, dia, opcion),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId] });
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId, 'diseno'] });
    },
  });
};

export const useMarcarSinServicio = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => menusService.marcarSinServicio(menuId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId] });
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId, 'diseno'] });
    },
  });
};

export const useQuitarSinServicio = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dia) => menusService.quitarSinServicio(menuId, dia),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId] });
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId, 'diseno'] });
    },
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
