import { useQuery } from '@tanstack/react-query';
import { menusService } from '../services/menus.service.js';

export const useUsados = (params) =>
  useQuery({
    queryKey: ['historial', 'usados', params],
    queryFn: () => menusService.getUsados(params),
    select: (res) => res.data,
    enabled: Object.values(params).some(Boolean), // al menos un filtro activo
  });

export const useNoUsados = (params) =>
  useQuery({
    queryKey: ['historial', 'no-usados', params],
    queryFn: () => menusService.getNoUsados(params),
    select: (res) => res.data,
  });

export const useHistorialPlato = (platoId) =>
  useQuery({
    queryKey: ['historial', 'plato', platoId],
    queryFn: () => menusService.getHistorialPlato(platoId),
    select: (res) => res.data,
    enabled: !!platoId,
  });
