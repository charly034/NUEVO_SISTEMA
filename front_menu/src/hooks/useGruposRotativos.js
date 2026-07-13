import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient.js';

const KEY = 'ciclos-rotativos';

export const useCiclosRotativos = () =>
  useQuery({
    queryKey: [KEY],
    queryFn: () => apiClient.get('/grupos-rotativos/ciclos').then((r) => r.data),
  });

export const useCicloDetalle = (cicloId) =>
  useQuery({
    queryKey: [KEY, cicloId],
    queryFn: () => apiClient.get(`/grupos-rotativos/ciclos/${cicloId}`).then((r) => r.data),
    enabled: !!cicloId,
  });

function invalidarCiclo(qc, cicloId) {
  qc.invalidateQueries({ queryKey: [KEY] });
  if (cicloId) qc.invalidateQueries({ queryKey: [KEY, cicloId] });
}

export const useCrearCiclo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiClient.post('/grupos-rotativos/ciclos', data).then((r) => r.data),
    onSuccess: () => invalidarCiclo(qc),
  });
};

export const useActualizarCiclo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => apiClient.patch(`/grupos-rotativos/ciclos/${id}`, data).then((r) => r.data),
    onSuccess: (_data, { id }) => invalidarCiclo(qc, id),
  });
};

export const useCrearGrupo = (cicloId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiClient.post('/grupos-rotativos/grupos', data).then((r) => r.data),
    onSuccess: () => invalidarCiclo(qc, cicloId),
  });
};

export const useAgregarPlatoAGrupo = (cicloId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ grupoId, plato_id, orden }) =>
      apiClient.post(`/grupos-rotativos/grupos/${grupoId}/platos`, { plato_id, orden }).then((r) => r.data),
    onSuccess: () => invalidarCiclo(qc, cicloId),
  });
};

export const useQuitarPlatoDeGrupo = (cicloId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ grupoId, platoId }) =>
      apiClient.delete(`/grupos-rotativos/grupos/${grupoId}/platos/${platoId}`).then((r) => r.data),
    onSuccess: () => invalidarCiclo(qc, cicloId),
  });
};

export const useForzarSeleccionSemana = (cicloId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiClient.post('/grupos-rotativos/seleccion-semana', data).then((r) => r.data),
    onSuccess: () => invalidarCiclo(qc, cicloId),
  });
};
