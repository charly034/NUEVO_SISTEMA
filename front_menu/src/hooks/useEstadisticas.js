import { useQuery } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const get = (path, params) => api.get(path, { params }).then(r => r.data);

export const useResumen         = () => useQuery({ queryKey: ['stats-resumen'],      queryFn: () => get('/estadisticas/resumen') });
export const usePlatosmasUsados = (p) => useQuery({ queryKey: ['stats-top', p],      queryFn: () => get('/estadisticas/platos-mas-usados', p) });
export const useDistribucionTags= (p) => useQuery({ queryKey: ['stats-tags', p],     queryFn: () => get('/estadisticas/distribucion-tags', p) });
export const useUsoPorDia       = () => useQuery({ queryKey: ['stats-dia'],           queryFn: () => get('/estadisticas/uso-por-dia') });
export const useTendencia       = () => useQuery({ queryKey: ['stats-tendencia'],     queryFn: () => get('/estadisticas/tendencia-mensual') });
export const useTopPorDia       = () => useQuery({ queryKey: ['stats-top-dia'],       queryFn: () => get('/estadisticas/top-por-dia') });
