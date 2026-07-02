import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch } from '../services/apiCliente.js';

const TIPO_ICON = {
  menu:        { emoji: '🍽️', bg: '#EDF0E4', color: '#5B6B2A' },
  recordatorio:{ emoji: '⏰', bg: '#FEF3E8', color: '#C8782A' },
  confirmado:  { emoji: '✅', bg: '#E6F6F0', color: '#1B7B5E' },
  sistema:     { emoji: '📢', bg: '#F0EDE6', color: '#7A7868' },
};

function tiempoRelativo(isoDate) {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.floor(hs / 24);
  return `hace ${dias} día${dias > 1 ? 's' : ''}`;
}

function FilaNotificacion({ notif, onMarcarLeida }) {
  const tipo = TIPO_ICON[notif.tipo] || TIPO_ICON.sistema;

  return (
    <button
      onClick={() => !notif.leida && onMarcarLeida(notif.id)}
      className={`w-full text-left flex items-start gap-3 px-4 py-4 border-b border-[#F0EDE6] last:border-0 transition-colors ${notif.leida ? 'bg-white' : 'bg-[#FDFCF8]'}`}
    >
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-lg"
        style={{ background: tipo.bg }}
      >
        {tipo.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${notif.leida ? 'font-medium text-[#7A7868]' : 'font-bold text-[#2A2C1F]'}`}>
            {notif.titulo}
          </p>
          {!notif.leida && (
            <span className="shrink-0 w-2 h-2 mt-1.5 rounded-full bg-[#5B6B2A]" />
          )}
        </div>
        {notif.cuerpo && (
          <p className="text-xs text-[#9A9885] mt-0.5 leading-relaxed">{notif.cuerpo}</p>
        )}
        <p className="text-[10px] text-[#C4C2B4] mt-1">{tiempoRelativo(notif.created_at)}</p>
      </div>
    </button>
  );
}

export default function NotificacionesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notificaciones = [], isLoading } = useQuery({
    queryKey: ['notificaciones'],
    queryFn: () => apiGet('/notificaciones'),
  });

  const marcarLeida = useMutation({
    mutationFn: (id) => apiPatch(`/notificaciones/${id}/leer`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  const marcarTodas = useMutation({
    mutationFn: () => apiPatch('/notificaciones/leer-todas'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  return (
    <div className="flex flex-col h-full bg-[#FAF8F3]">
      {/* Header */}
      <div className="bg-white border-b border-[#F0EDE6] px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-[#5B6B2A]">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[#2A2C1F] font-serif">Notificaciones</h1>
            {noLeidas > 0 && (
              <p className="text-xs text-[#9A9885]">{noLeidas} sin leer</p>
            )}
          </div>
          {noLeidas > 0 && (
            <button
              onClick={() => marcarTodas.mutate()}
              className="flex items-center gap-1.5 text-[#5B6B2A] text-sm font-bold"
            >
              <CheckCheck size={16} /> Leer todas
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-0">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-start gap-3 px-4 py-4 border-b border-[#F0EDE6]">
                <div className="w-10 h-10 rounded-2xl bg-[#E8E5DC] animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#E8E5DC] rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-[#F0EDE6] rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && notificaciones.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 bg-[#EDF0E4] rounded-full flex items-center justify-center">
              <Bell size={28} className="text-[#9A9885]" />
            </div>
            <p className="text-sm text-[#9A9885] font-semibold">Sin notificaciones</p>
          </div>
        )}

        {!isLoading && notificaciones.length > 0 && (
          <div className="bg-white mx-4 mt-4 rounded-2xl border border-[#E8E5DC] overflow-hidden">
            {notificaciones.map(n => (
              <FilaNotificacion
                key={n.id}
                notif={n}
                onMarcarLeida={(id) => marcarLeida.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
