import { useQuery } from '@tanstack/react-query';
import api from '../lib/apiClient.js';

export const useAdminAuditoria = (params) =>
  useQuery({
    queryKey: ['admin-auditoria', params],
    queryFn: () => api.get('/admin/auditoria', { params }).then(r => r.data),
  });
