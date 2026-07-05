import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient.js';

export const APP_TIMEZONE = 'America/Argentina/Buenos_Aires';

export function fechaISOEnZona(valor = new Date(), timeZone = APP_TIMEZONE) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  const base = Number.isNaN(fecha.getTime()) ? new Date() : fecha;
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base);

  const porTipo = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${porTipo.year}-${porTipo.month}-${porTipo.day}`;
}

export function addDiasISO(fechaISO, dias) {
  const base = new Date(`${fechaISO}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().split('T')[0];
}

export function indiceDiaSemanaISO(fechaISO) {
  const base = new Date(`${fechaISO}T12:00:00.000Z`);
  return (base.getUTCDay() + 6) % 7;
}

export function lunesDeSemanaISO(fechaISO, offset = 0) {
  return addDiasISO(fechaISO, -indiceDiaSemanaISO(fechaISO) + offset * 7);
}

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
