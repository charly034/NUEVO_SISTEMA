import { useQuery } from '@tanstack/react-query';
import { cocinaService } from '../services/cocina.service.js';

export const COCINA_KEY = 'cocina';

export const useCocinaHoy = (fecha) =>
  useQuery({
    queryKey: [COCINA_KEY, 'hoy', fecha ?? 'today'],
    queryFn: () => cocinaService.getHoy(fecha),
    select: (res) => res.data,
    refetchInterval: 5 * 60 * 1000,
  });

export const useCocinaSemana = (menuId) =>
  useQuery({
    queryKey: [COCINA_KEY, 'semana', menuId],
    queryFn: () => cocinaService.getSemana(menuId),
    select: (res) => res.data,
    enabled: !!menuId,
  });

export const useEtiquetas = (menuId, dia) =>
  useQuery({
    queryKey: [COCINA_KEY, 'etiquetas', menuId, dia],
    queryFn: () => cocinaService.getEtiquetas(menuId, dia),
    select: (res) => res.data,
    enabled: !!(menuId && dia),
  });
