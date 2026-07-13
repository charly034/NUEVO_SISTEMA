import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient.js';

const KEY = 'semana-opciones';

export const useSemanaOpciones = (menuSemanalId) =>
  useQuery({
    queryKey: [KEY, menuSemanalId],
    queryFn: () => apiClient.get(`/semana-opciones/${menuSemanalId}`).then((r) => r.data),
    enabled: !!menuSemanalId,
  });

export const useMarcarFijoVianda = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platoId) => apiClient.post(`/semana-opciones/${menuSemanalId}/fijos/${platoId}/vianda`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, menuSemanalId] }),
  });
};

export const useQuitarFijoVianda = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platoId) => apiClient.delete(`/semana-opciones/${menuSemanalId}/fijos/${platoId}/vianda`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, menuSemanalId] }),
  });
};

export const useMarcarSlotVianda = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => apiClient.post(`/semana-opciones/slots/${slotId}/vianda`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, menuSemanalId] }),
  });
};

export const useQuitarSlotVianda = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => apiClient.delete(`/semana-opciones/slots/${slotId}/vianda`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, menuSemanalId] }),
  });
};

export const useSetDisponiblePorKilo = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, disponible }) =>
      apiClient.put(`/semana-opciones/slots/${slotId}/disponible-por-kilo`, { disponible }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, menuSemanalId] }),
  });
};

export const useSetFijoDisponiblePorKilo = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ platoId, disponible }) =>
      apiClient.put(`/semana-opciones/${menuSemanalId}/fijos/${platoId}/disponible-por-kilo`, { disponible }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, menuSemanalId] }),
  });
};

export const useSetEmpresasFijo = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ platoId, empresa_ids }) =>
      apiClient.put(`/semana-opciones/${menuSemanalId}/fijos/${platoId}/empresas`, { empresa_ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, menuSemanalId] }),
  });
};

export const useAgregarGuarnicionSemana = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (guarnicionId) => apiClient.post(`/semana-opciones/${menuSemanalId}/guarniciones/${guarnicionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, menuSemanalId] }),
  });
};

export const useQuitarGuarnicionSemana = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (guarnicionId) => apiClient.delete(`/semana-opciones/${menuSemanalId}/guarniciones/${guarnicionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, menuSemanalId] }),
  });
};

export const useAgregarSalsaSemana = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (salsaId) => apiClient.post(`/semana-opciones/${menuSemanalId}/salsas/${salsaId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, menuSemanalId] }),
  });
};

export const useQuitarSalsaSemana = (menuSemanalId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (salsaId) => apiClient.delete(`/semana-opciones/${menuSemanalId}/salsas/${salsaId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, menuSemanalId] }),
  });
};
