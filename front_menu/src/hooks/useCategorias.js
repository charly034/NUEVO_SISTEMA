import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient.js';

const KEY = 'categorias';
const SEMANA_KEY = 'semana-opciones';

// Invalida la lista/detalle de categorías y el resumen de la semana (las
// categorías cambian lo que dibuja TablaSemana).
function invalidarTodo(qc) {
  qc.invalidateQueries({ queryKey: [KEY] });
  qc.invalidateQueries({ queryKey: [SEMANA_KEY] });
}

// Lista de categorías (para el selector de reasignación y la gestión).
export const useCategorias = (filtros = {}) =>
  useQuery({
    queryKey: [KEY, filtros],
    queryFn: () => apiClient.get('/categorias', { params: filtros }).then((r) => r.data),
  });

// Detalle de una categoría (defaults + grupos con sus platos).
export const useCategoria = (id) =>
  useQuery({
    queryKey: [KEY, 'detalle', id],
    queryFn: () => apiClient.get(`/categorias/${id}`).then((r) => r.data),
    enabled: !!id,
  });

// ── CRUD de categorías ─────────────────────────────────────────────────

export const useCrearCategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiClient.post('/categorias', data).then((r) => r.data),
    onSuccess: () => invalidarTodo(qc),
  });
};

export const useActualizarCategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => apiClient.patch(`/categorias/${id}`, data).then((r) => r.data),
    onSuccess: () => invalidarTodo(qc),
  });
};

export const useEliminarCategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => apiClient.delete(`/categorias/${id}`),
    onSuccess: () => invalidarTodo(qc),
  });
};

export const useDuplicarCategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nombre }) => apiClient.post(`/categorias/${id}/duplicar`, nombre ? { nombre } : {}).then((r) => r.data),
    onSuccess: () => invalidarTodo(qc),
  });
};

// ── Grupos de rotación de una categoría ────────────────────────────────

export const useCrearGrupo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoriaId, data }) => apiClient.post(`/categorias/${categoriaId}/grupos`, data).then((r) => r.data),
    onSuccess: () => invalidarTodo(qc),
  });
};

export const useActualizarGrupo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoriaId, grupoId, data }) => apiClient.patch(`/categorias/${categoriaId}/grupos/${grupoId}`, data).then((r) => r.data),
    onSuccess: () => invalidarTodo(qc),
  });
};

export const useEliminarGrupo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoriaId, grupoId }) => apiClient.delete(`/categorias/${categoriaId}/grupos/${grupoId}`),
    onSuccess: () => invalidarTodo(qc),
  });
};

export const useAgregarPlatoGrupo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoriaId, grupoId, plato_id, orden }) =>
      apiClient.post(`/categorias/${categoriaId}/grupos/${grupoId}/platos`, { plato_id, orden }).then((r) => r.data),
    onSuccess: () => invalidarTodo(qc),
  });
};

export const useQuitarPlatoGrupo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoriaId, grupoId, platoId }) =>
      apiClient.delete(`/categorias/${categoriaId}/grupos/${grupoId}/platos/${platoId}`),
    onSuccess: () => invalidarTodo(qc),
  });
};

// ── Rotación por semana (materializar / excepción manual) ──────────────

export const useResembrarRotacion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoriaId, menu_semanal_id }) =>
      apiClient.post(`/categorias/${categoriaId}/rotacion/resembrar`, { menu_semanal_id }),
    onSuccess: () => invalidarTodo(qc),
  });
};

export const useForzarGrupoSemana = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoriaId, menu_semanal_id, grupo_id }) =>
      apiClient.put(`/categorias/${categoriaId}/rotacion/forzar`, { menu_semanal_id, grupo_id }),
    onSuccess: () => invalidarTodo(qc),
  });
};

export const useQuitarForzadoSemana = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoriaId, menu_semanal_id }) =>
      apiClient.delete(`/categorias/${categoriaId}/rotacion/forzar`, { data: { menu_semanal_id } }),
    onSuccess: () => invalidarTodo(qc),
  });
};

// Borra una celda puntual (una fila de menu_semanal_dias por id). Invalida el
// resumen de la semana para refrescar la grilla.
export const useDeleteMenuItem = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId) => apiClient.delete(`/menu-items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SEMANA_KEY, menuSemanalId] }),
  });
};

// Reasigna la categoría de una celda (mover a otra categoría o a "Sin
// categorizar" con categoria_id=null).
export const useReasignarMenuItem = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, categoria_id }) =>
      apiClient.patch(`/menu-items/${itemId}`, { categoria_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SEMANA_KEY, menuSemanalId] }),
  });
};

// Agrega un plato a una categoría desde la tabla (celda nueva). dia/opcion
// según el tipo de categoría (matriz: ambos; lista por día: dia; modo único: nada).
export const useAgregarItemCategoria = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoria_id, plato_id, dia = null, opcion = null }) =>
      apiClient.post('/menu-items', { menu_semanal_id: Number(menuSemanalId), categoria_id, plato_id, dia, opcion }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SEMANA_KEY, menuSemanalId] }),
  });
};
