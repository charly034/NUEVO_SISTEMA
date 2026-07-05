import { useQuery } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const get = (path, params) => api.get(path, { params }).then(r => r.data);

export const useResumen         = () => useQuery({ queryKey: ['stats-resumen'],      queryFn: () => get('/estadisticas/resumen') });
export const usePlatosmasUsados = (p) => useQuery({ queryKey: ['stats-top', p],      queryFn: () => get('/estadisticas/platos-mas-usados', p) });
export const useDistribucionTags= (p) => useQuery({ queryKey: ['stats-tags', p],     queryFn: () => get('/estadisticas/distribucion-tags', p) });
export const useUsoPorDia       = (p) => useQuery({ queryKey: ['stats-dia', p],       queryFn: () => get('/estadisticas/uso-por-dia', p) });
export const useTendencia       = (p) => useQuery({ queryKey: ['stats-tendencia', p], queryFn: () => get('/estadisticas/tendencia-mensual', p) });
export const useTopPorDia       = () => useQuery({ queryKey: ['stats-top-dia'],       queryFn: () => get('/estadisticas/top-por-dia') });
