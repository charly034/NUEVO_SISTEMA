import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient.js';
import {
  APP_TIMEZONE,
  fechaISOEnZona,
  addDiasISO,
  indiceDiaSemanaISO,
  lunesDeSemanaISO,
} from '../lib/fechas.js';

// Re-export para compatibilidad: las primitivas ahora viven en lib/fechas.js.
export { APP_TIMEZONE, fechaISOEnZona, addDiasISO, indiceDiaSemanaISO, lunesDeSemanaISO };

export const useFechaOperativa = () =>
  useQuery({
    queryKey: ['fecha-operativa'],
    queryFn: () => apiClient.get('/health'),
    select: (res) => {
      const data = res.data ?? {};
      const referencia = data.database?.serverTime || data.timestamp || new Date();
      return {
        fecha: fechaISOEnZona(referencia),
        referencia,
        timezone: APP_TIMEZONE,
      };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
