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

export const useMarcarSinServicio = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => menusService.marcarSinServicio(menuId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId] });
      qc.invalidateQueries({ queryKey: [MENUS_KEY, menuId, 'diseno'] });
      // 'semana-opciones' (pantalla Resumen) tambien lee sin_servicio desde
      // que empezo a migrar acciones de Disenar menu (2026-07-13) -- sin
      // esto, la nueva pantalla queda desactualizada tras la mutacion.
      qc.invalidateQueries({ queryKey: ['semana-opciones', menuId] });
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
      qc.invalidateQueries({ queryKey: ['semana-opciones', menuId] });
    },
  });
};

export const useAgregarPlato = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => menusService.agregarPlato(menuId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semana-opciones', menuId] }),
  });
};

export const useQuitarPlato = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dia, opcion }) => menusService.quitarPlato(menuId, dia, opcion),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semana-opciones', menuId] }),
  });
};

export const useSetEmpresasSlot = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dia, opcion, empresa_ids }) => menusService.setEmpresasSlot(menuId, dia, opcion, { empresa_ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semana-opciones', menuId] }),
  });
};

// Override de guarnición a nivel CELDA (solo esta semana). null en el modo = volver
// a lo de la vianda (limpiar el override). Invalida el resumen para refrescar la
// procedencia ("de la vianda" -> "pisado esta semana").
export const useSetGuarnicionSlot = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dia, opcion, guarnicion_modo_override, guarnicion_fija_override_id = null }) =>
      menusService.setGuarnicionSlot(menuId, dia, opcion, { guarnicion_modo_override, guarnicion_fija_override_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semana-opciones', menuId] }),
  });
};

export const useSetSalsaSlot = (menuId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dia, opcion, salsa_modo_override, salsa_fija_override_id = null }) =>
      menusService.setSalsaSlot(menuId, dia, opcion, { salsa_modo_override, salsa_fija_override_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semana-opciones', menuId] }),
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
