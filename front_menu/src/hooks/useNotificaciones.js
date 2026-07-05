import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

const KEY = 'notificaciones-admin';

export const useNotificacionesAdmin = (filters = {}) =>
  useQuery({
    queryKey: [KEY, filters],
    queryFn: () => api.get('/notificaciones/admin', { params: filters }).then(r => r.data),
  });

export const useEnviarNotificacion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/notificaciones/admin', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useReglasNotificaciones = (filters = {}) =>
  useQuery({
    queryKey: [KEY, 'reglas', filters],
    queryFn: () => api.get('/notificaciones/admin/reglas', { params: filters }).then(r => r.data),
  });

export const useGuardarReglaNotificacion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => (
      id
        ? api.patch(`/notificaciones/admin/reglas/${id}`, data).then(r => r.data)
        : api.post('/notificaciones/admin/reglas', data).then(r => r.data)
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'reglas'] }),
  });
};

export const useEliminarReglaNotificacion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/notificaciones/admin/reglas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'reglas'] }),
  });
};

export const useWhatsappConfig = () =>
  useQuery({
    queryKey: [KEY, 'whatsapp-config'],
    queryFn: () => api.get('/notificaciones/admin/whatsapp/config').then(r => r.data),
  });

export const useRevealWebhookUrl = () =>
  useMutation({
    mutationFn: () => api.get('/notificaciones/admin/whatsapp/config/reveal').then(r => r.data),
  });

export const useGuardarWhatsappConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.patch('/notificaciones/admin/whatsapp/config', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'whatsapp-config'] }),
  });
};

export const useDestinatariosWhatsapp = () =>
  useQuery({
    queryKey: [KEY, 'whatsapp-destinatarios'],
    queryFn: () => api.get('/notificaciones/admin/whatsapp/destinatarios').then(r => r.data),
  });

export const useGuardarDestinatarioWhatsapp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => (
      id
        ? api.patch(`/notificaciones/admin/whatsapp/destinatarios/${id}`, data).then(r => r.data)
        : api.post('/notificaciones/admin/whatsapp/destinatarios', data).then(r => r.data)
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'whatsapp-destinatarios'] }),
  });
};

export const useEliminarDestinatarioWhatsapp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/notificaciones/admin/whatsapp/destinatarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'whatsapp-destinatarios'] }),
  });
};

export const useEnviosWhatsapp = (filters = {}) =>
  useQuery({
    queryKey: [KEY, 'whatsapp-envios', filters],
    queryFn: () => api.get('/notificaciones/admin/whatsapp/envios', { params: filters }).then(r => r.data),
  });

export const useWhatsappTestLogs = (filters = {}) =>
  useQuery({
    queryKey: [KEY, 'whatsapp-test-logs', filters],
    queryFn: () => api.get('/notificaciones/admin/whatsapp/test-logs', { params: filters }).then(r => r.data),
  });

export const useProbarWebhookWhatsapp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/notificaciones/admin/whatsapp/probar', data).then(r => r.data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [KEY, 'whatsapp-envios'] });
      qc.invalidateQueries({ queryKey: [KEY, 'whatsapp-test-logs'] });
    },
  });
};
