import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import { useEmpleados } from '../hooks/useEmpleados.js';
import {
  useDestinatariosWhatsapp,
  useEliminarDestinatarioWhatsapp,
  useEliminarReglaNotificacion,
  useEnviarNotificacion,
  useEnviosWhatsapp,
  useGuardarDestinatarioWhatsapp,
  useGuardarReglaNotificacion,
  useGuardarWhatsappConfig,
  useNotificacionesAdmin,
  useProbarWebhookWhatsapp,
  useRevealWebhookUrl,
  useReglasNotificaciones,
  useWhatsappConfig,
  useWhatsappTestLogs,
} from '../hooks/useNotificaciones.js';
import { toast } from '../lib/toast.js';
import Spinner from '../components/ui/Spinner.jsx';
import SideDrawer from '../components/ui/SideDrawer.jsx';

const TIPOS = [
  { value: 'sistema', label: 'Sistema' },
  { value: 'menu', label: 'Menu' },
  { value: 'recordatorio', label: 'Recordatorio' },
  { value: 'confirmado', label: 'Pedido' },
];

const ALCANCES_MANUAL = [
  { value: 'todos', label: 'Todos los empleados' },
  { value: 'empresa', label: 'Una empresa' },
  { value: 'empleado', label: 'Un empleado' },
];

const EVENTOS = [
  { value: 'nuevo_registro', label: 'Nuevo registro' },
  { value: 'menu_publicado', label: 'Menu publicado' },
  { value: 'pedido_estado_cambiado', label: 'Cambio de estado de pedido' },
  { value: 'pedido_semanal_pendiente', label: 'Pedido semanal pendiente' },
];

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miercoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sabado' },
];

const ALCANCES_REGLA = [
  { value: 'todos', label: 'Todos los empleados' },
  { value: 'empresa', label: 'Una empresa' },
  { value: 'empleado', label: 'Un empleado' },
  { value: 'empleado_evento', label: 'Empleado del evento' },
];

const FILTROS_BASE = {
  alcance: 'todos',
  empresa_id: '',
  empleado_id: '',
  rol: 'todos',
  plan: 'todos',
  modo_pedido: 'todos',
  dias_laborales: 'todos',
  solo_preferencia_whatsapp: false,
  requiere_telefono: false,
  destinatario_whatsapp_ids: [],
};

const REGLA_BASE = {
  id: null,
  evento: 'menu_publicado',
  nombre: '',
  activo: true,
  titulo: '',
  cuerpo: '',
  filtros: FILTROS_BASE,
  programacion: {
    tipo: 'semanal',
    dia_semana: 1,
    hora: '09:00',
  },
};

const MANUAL_BASE = {
  alcance: 'todos',
  tipo: 'sistema',
  empresa_id: '',
  empleado_id: '',
  titulo: '',
  cuerpo: '',
};

const WHATSAPP_DEST_BASE = {
  id: null,
  nombre: '',
  telefono: '',
  email: '',
  empresa_id: '',
  activo: true,
};

const webhookUrlSchema = z.string()
  .trim()
  .min(1, 'La URL es requerida')
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Debe ser una URL valida y comenzar con https://');

const whatsappTestSchema = z.object({
  telefono: z.string().trim().min(1, 'El telefono es requerido')
    .refine((value) => value.startsWith('+'), 'Usa formato E.164, por ejemplo +549...')
    .refine((value) => parsePhoneNumberFromString(value)?.isValid(), 'El telefono no parece valido'),
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(160, 'Maximo 160 caracteres'),
  cuerpo: z.string().trim().min(1, 'El mensaje es requerido').max(900, 'Maximo 900 caracteres'),
});

function formatoFecha(fecha) {
  if (!fecha) return '';
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEventoLabel(evento) {
  return EVENTOS.find((item) => item.value === evento)?.label || evento;
}

function recortarTexto(texto, max = 180) {
  const normalizado = String(texto || '').replace(/\s+/g, ' ').trim();
  return normalizado.length > max ? `${normalizado.slice(0, max)}...` : normalizado;
}

function parseRespuestaWebhook(respuesta) {
  if (!respuesta) return null;
  if (typeof respuesta === 'object') return respuesta;
  try {
    return JSON.parse(respuesta);
  } catch {
    return null;
  }
}

function mensajeN8n(parsed) {
  const mensaje = String(parsed?.message || '');
  const hint = String(parsed?.hint || '');
  if (!mensaje && !hint) return '';
  if (mensaje.includes('is not registered') && hint.includes('Execute workflow')) {
    return 'Webhook de test no registrado en n8n. Presiona Execute workflow y vuelve a probar.';
  }
  if (mensaje.includes('not registered for POST requests')) {
    return 'n8n no tiene este webhook registrado para POST. Revisa el metodo del nodo Webhook.';
  }
  return recortarTexto([mensaje, hint].filter(Boolean).join(' '), 220);
}

function resumenErrorWebhook(detalle) {
  if (!detalle) return '';
  const parsed = parseRespuestaWebhook(detalle.respuesta);
  const mensajeClaro = mensajeN8n(parsed);
  if (mensajeClaro) return mensajeClaro;
  const partes = [];
  if (detalle.status_code) partes.push(`HTTP ${detalle.status_code}`);
  if (detalle.error) partes.push(detalle.error);
  const respuesta = recortarTexto(detalle.respuesta, 120);
  if (respuesta && respuesta !== detalle.error) partes.push(respuesta);
  return partes.length ? `Prueba fallida: ${partes.join(' - ')}` : '';
}

function resumenRespuestaWebhook(respuesta) {
  const parsed = parseRespuestaWebhook(respuesta);
  const mensajeClaro = mensajeN8n(parsed);
  if (mensajeClaro) return mensajeClaro;
  const texto = recortarTexto(respuesta, 220);
  if (!texto) return '';
  return texto;
}

function mensajeErrorHttp(error, fallback) {
  const status = error?.status;
  const errorCode = error?.data?.errorCode || error?.data?.data?.errorCode;
  if (errorCode === 'INVALID_WEBHOOK_URL') return 'Configura una URL HTTPS valida antes de probar WhatsApp.';
  if (errorCode === 'N8N_TIMEOUT') return 'n8n no respondio a tiempo. Revisa si el workflow esta activo.';
  if (status === 400) return error?.message || 'Revisa los datos ingresados.';
  if (status === 401 || status === 403) return 'Tu sesion no tiene permisos para esta accion.';
  if (status === 404) return 'No se encontro el recurso solicitado.';
  if (status === 500 || status === 502 || status === 504) return error?.message || 'Hubo un problema del servidor o de n8n.';
  return error?.message || fallback;
}

function zodFieldError(error, field) {
  return error?.issues?.find((issue) => issue.path[0] === field)?.message || '';
}

function limpiarFiltros(filtros, canal) {
  const alcance = filtros.alcance || 'todos';
  return {
    alcance,
    empresa_id: filtros.empresa_id || null,
    empleado_id: filtros.empleado_id || null,
    rol: filtros.rol === 'todos' ? null : filtros.rol,
    plan: filtros.plan === 'todos' ? null : filtros.plan,
    modo_pedido: filtros.modo_pedido === 'todos' ? null : filtros.modo_pedido,
    dias_laborales: filtros.dias_laborales === 'todos' ? null : filtros.dias_laborales,
    solo_preferencia_whatsapp: Boolean(filtros.solo_preferencia_whatsapp),
    requiere_telefono: canal === 'whatsapp' ? true : Boolean(filtros.requiere_telefono),
    destinatario_whatsapp_ids: filtros.destinatario_whatsapp_ids || [],
  };
}

function limpiarProgramacion(programacion, evento) {
  if (evento !== 'pedido_semanal_pendiente') return {};
  return {
    tipo: 'semanal',
    dia_semana: Number(programacion?.dia_semana ?? 1),
    hora: programacion?.hora || '09:00',
  };
}

function prepararRegla(regla, canal) {
  return {
    canal,
    evento: regla.evento,
    nombre: regla.nombre,
    activo: regla.activo,
    titulo: regla.titulo,
    cuerpo: regla.cuerpo,
    filtros: limpiarFiltros(regla.filtros, canal),
    programacion: limpiarProgramacion(regla.programacion, regla.evento),
  };
}

function normalizarReglaParaForm(regla) {
  return {
    id: regla.id,
    evento: regla.evento,
    nombre: regla.nombre,
    activo: regla.activo,
    titulo: regla.titulo,
    cuerpo: regla.cuerpo,
    programacion: {
      tipo: 'semanal',
      dia_semana: Number(regla.programacion?.dia_semana ?? 1),
      hora: regla.programacion?.hora || '09:00',
    },
    filtros: {
      ...FILTROS_BASE,
      ...(regla.filtros || {}),
      empresa_id: regla.filtros?.empresa_id || '',
      empleado_id: regla.filtros?.empleado_id || '',
      rol: regla.filtros?.rol || 'todos',
      plan: regla.filtros?.plan || 'todos',
      modo_pedido: regla.filtros?.modo_pedido || 'todos',
      dias_laborales: regla.filtros?.dias_laborales || 'todos',
      destinatario_whatsapp_ids: regla.filtros?.destinatario_whatsapp_ids || [],
    },
  };
}

function Select({ label, value, onChange, children, required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function Input({
  label, value, onChange, required = false, placeholder = '',
  type = 'text', maxLength, onBlur, error = '', inputRef, className = '',
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-green-600 focus:outline-none ${error ? 'border-red-300 bg-red-50' : 'border-gray-200'} ${className}`}
      />
      {error && <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span>}
    </label>
  );
}

function Textarea({ label, value, onChange, required = false, maxLength = 900, placeholder = '', onBlur, error = '' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        maxLength={maxLength}
        required={required}
        rows={4}
        placeholder={placeholder}
        className={`w-full resize-none rounded-lg border px-3 py-2 text-sm focus:border-green-600 focus:outline-none ${error ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
      />
      <span className={`mt-1 block text-xs ${error ? 'font-semibold text-red-600' : 'text-right text-gray-600'}`}>
        {error || `${value.length}/${maxLength}`}
      </span>
    </label>
  );
}

function FiltrosRegla({ canal, filtros, setFiltros, empresas, empleados, destinatariosWhatsapp }) {
  const alcances = canal === 'whatsapp'
    ? [...ALCANCES_REGLA, { value: 'destinatarios_whatsapp', label: 'Destinatarios WhatsApp externos' }]
    : ALCANCES_REGLA;

  const empleadosFiltrados = useMemo(() => {
    if (!filtros.empresa_id) return empleados;
    return empleados.filter((e) => Number(e.empresa_id) === Number(filtros.empresa_id));
  }, [empleados, filtros.empresa_id]);

  const setFiltro = (field, value) => {
    setFiltros((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'alcance' ? { empresa_id: '', empleado_id: '', destinatario_whatsapp_ids: [] } : {}),
      ...(field === 'empresa_id' ? { empleado_id: '' } : {}),
    }));
  };

  const toggleDestinatario = (id) => {
    setFiltros((prev) => {
      const current = prev.destinatario_whatsapp_ids || [];
      const numericId = Number(id);
      return {
        ...prev,
        destinatario_whatsapp_ids: current.includes(numericId)
          ? current.filter((item) => item !== numericId)
          : [...current, numericId],
      };
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Destinatarios</p>
      <Select label="Alcance" value={filtros.alcance} onChange={(value) => setFiltro('alcance', value)}>
        {alcances.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
      </Select>

      {(filtros.alcance === 'empresa' || filtros.alcance === 'empleado') && (
        <Select label="Empresa" value={filtros.empresa_id} onChange={(value) => setFiltro('empresa_id', value)} required={filtros.alcance === 'empresa'}>
          <option value="">Todas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </Select>
      )}

      {filtros.alcance === 'empleado' && (
        <Select label="Empleado" value={filtros.empleado_id} onChange={(value) => setFiltro('empleado_id', value)} required>
          <option value="">Seleccionar empleado</option>
          {empleadosFiltrados.map((e) => (
            <option key={e.id} value={e.id}>{e.apellido}, {e.nombre} - {e.empresa_nombre}</option>
          ))}
        </Select>
      )}

      {filtros.alcance === 'destinatarios_whatsapp' && (
        <div>
          <span className="mb-2 block text-sm font-semibold text-gray-700">Contactos externos</span>
          <div className="max-h-36 overflow-auto rounded-lg border border-gray-200 bg-white p-2">
            {destinatariosWhatsapp.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-gray-600">No hay destinatarios externos cargados.</p>
            ) : destinatariosWhatsapp.map((d) => (
              <label key={d.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={(filtros.destinatario_whatsapp_ids || []).includes(Number(d.id))}
                  onChange={() => toggleDestinatario(d.id)}
                />
                <span>{d.nombre} - {d.telefono}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Rol" value={filtros.rol} onChange={(value) => setFiltro('rol', value)}>
          <option value="todos">Todos</option>
          <option value="cliente">Cliente</option>
        </Select>
        <Select label="Plan" value={filtros.plan} onChange={(value) => setFiltro('plan', value)}>
          <option value="todos">Todos</option>
          <option value="basico">Basico</option>
          <option value="con_postre">Con postre</option>
          <option value="con_postre_bebida">Con postre y bebida</option>
        </Select>
        <Select label="Modo pedido" value={filtros.modo_pedido} onChange={(value) => setFiltro('modo_pedido', value)}>
          <option value="todos">Todos</option>
          <option value="semanal">Semanal</option>
          <option value="diario">Diario</option>
          <option value="ambos">Ambos</option>
        </Select>
        <Select label="Dias laborales" value={filtros.dias_laborales} onChange={(value) => setFiltro('dias_laborales', value)}>
          <option value="todos">Todos</option>
          <option value="lunes_viernes">Lunes a viernes</option>
          <option value="lunes_sabado">Lunes a sabado</option>
          <option value="lunes_domingo">Lunes a domingo</option>
        </Select>
      </div>

      <div className="text-sm text-gray-600">
        {canal === 'whatsapp' && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(filtros.solo_preferencia_whatsapp)}
              onChange={(event) => setFiltro('solo_preferencia_whatsapp', event.target.checked)}
            />
            Solo empleados con preferencia WhatsApp activa
          </label>
        )}
        {canal === 'interna' && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(filtros.requiere_telefono)}
              onChange={(event) => setFiltro('requiere_telefono', event.target.checked)}
            />
            Solo empleados con telefono cargado
          </label>
        )}
      </div>
    </div>
  );
}

function ReglaForm({ canal, regla, setRegla, empresas, empleados, destinatariosWhatsapp, onSubmit, saving, onCancel }) {
  const setField = (field, value) => setRegla((prev) => ({ ...prev, [field]: value }));
  const setProgramacion = (field, value) => setRegla((prev) => ({
    ...prev,
    programacion: { ...prev.programacion, [field]: value },
  }));
  const setFiltros = (updater) => setRegla((prev) => ({
    ...prev,
    filtros: typeof updater === 'function' ? updater(prev.filtros) : updater,
  }));

  return (
    <form onSubmit={onSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Variables:</span>
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{'{{nombre}}'}</code>
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{'{{semana_rango}}'}</code>
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{'{{estado}}'}</code>
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input type="checkbox" checked={regla.activo} onChange={(e) => setField('activo', e.target.checked)} />
          Regla activa
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Evento" value={regla.evento} onChange={(value) => setField('evento', value)}>
            {EVENTOS.map((ev) => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
          </Select>
          <Input label="Nombre interno" value={regla.nombre} onChange={(value) => setField('nombre', value)} required maxLength={160} />
        </div>

        {regla.evento === 'pedido_semanal_pendiente' && (
          <div className="grid gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4 sm:grid-cols-2">
            <Select
              label="Dia de envio"
              value={String(regla.programacion?.dia_semana ?? 1)}
              onChange={(value) => setProgramacion('dia_semana', Number(value))}
            >
              {DIAS_SEMANA.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </Select>
            <Input label="Hora" type="time" value={regla.programacion?.hora || '09:00'} onChange={(value) => setProgramacion('hora', value)} required />
            <p className="sm:col-span-2 text-xs text-amber-700">
              El scheduler envia esta regla solo a empleados activos que todavia no tengan pedido no cancelado para la semana publicada objetivo.
            </p>
          </div>
        )}

        <Input label="Titulo del mensaje" value={regla.titulo} onChange={(value) => setField('titulo', value)} required maxLength={160} />
        <Textarea label="Cuerpo del mensaje" value={regla.cuerpo} onChange={(value) => setField('cuerpo', value)} required />

        <FiltrosRegla
          canal={canal}
          filtros={regla.filtros}
          setFiltros={setFiltros}
          empresas={empresas}
          empleados={empleados}
          destinatariosWhatsapp={destinatariosWhatsapp}
        />
      </div>

      <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
        <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">
          {saving ? 'Guardando...' : regla.id ? 'Guardar cambios' : 'Crear regla'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ManualInternaForm({ empresas, empleados, onDone }) {
  const [form, setForm] = useState(MANUAL_BASE);
  const enviar = useEnviarNotificacion();

  const empleadosFiltrados = useMemo(() => {
    if (!form.empresa_id) return empleados;
    return empleados.filter((e) => Number(e.empresa_id) === Number(form.empresa_id));
  }, [empleados, form.empresa_id]);

  const setField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'alcance' ? { empresa_id: '', empleado_id: '' } : {}),
      ...(field === 'empresa_id' ? { empleado_id: '' } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = { alcance: form.alcance, tipo: form.tipo, titulo: form.titulo, cuerpo: form.cuerpo };
      if (form.alcance === 'empresa') payload.empresa_id = form.empresa_id;
      if (form.alcance === 'empleado') payload.empleado_id = form.empleado_id;
      const resultado = await enviar.mutateAsync(payload);
      toast.success(`Enviadas: ${resultado.enviadas}`);
      setForm(MANUAL_BASE);
      onDone?.();
    } catch (error) {
      toast.error(error?.message || 'No se pudo enviar la notificacion');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto">
        <p className="text-sm text-gray-600">Crea avisos dentro de la app de clientes.</p>
        <Select label="Alcance" value={form.alcance} onChange={(value) => setField('alcance', value)}>
          {ALCANCES_MANUAL.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </Select>
        {(form.alcance === 'empresa' || form.alcance === 'empleado') && (
          <Select label="Empresa" value={form.empresa_id} onChange={(value) => setField('empresa_id', value)} required={form.alcance === 'empresa'}>
            <option value="">Seleccionar empresa</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </Select>
        )}
        {form.alcance === 'empleado' && (
          <Select label="Empleado" value={form.empleado_id} onChange={(value) => setField('empleado_id', value)} required>
            <option value="">Seleccionar empleado</option>
            {empleadosFiltrados.map((e) => (
              <option key={e.id} value={e.id}>{e.apellido}, {e.nombre} - {e.empresa_nombre}</option>
            ))}
          </Select>
        )}
        <Select label="Tipo" value={form.tipo} onChange={(value) => setField('tipo', value)}>
          {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Input label="Titulo" value={form.titulo} onChange={(value) => setField('titulo', value)} required maxLength={120} placeholder="Ej: Menu publicado" />
        <Textarea label="Mensaje" value={form.cuerpo} onChange={(value) => setField('cuerpo', value)} required maxLength={700} placeholder="Escribi el aviso para los clientes." />
      </div>
      <div className="mt-4 border-t border-gray-100 pt-4">
        <button type="submit" disabled={enviar.isPending} className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">
          {enviar.isPending ? 'Enviando...' : 'Enviar notificacion'}
        </button>
      </div>
    </form>
  );
}

function ReglaRow({ regla, onEdit, onDelete }) {
  return (
    <tr className="cursor-pointer hover:bg-gray-50" onClick={() => onEdit(regla)}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex h-2 w-2 rounded-full ${regla.activo ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="font-semibold text-gray-900 text-sm">{regla.nombre}</span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 truncate max-w-[260px]">{regla.titulo}</p>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">{getEventoLabel(regla.evento)}</span>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-500">
        {regla.filtros?.alcance || 'todos'}
        {regla.evento === 'pedido_semanal_pendiente' && regla.programacion?.hora && (
          <span className="ml-1 text-amber-600">
            {DIAS_SEMANA.find((d) => d.value === Number(regla.programacion.dia_semana))?.label} {regla.programacion.hora}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(regla.id); }}
          className="rounded-md px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}

function HistorialInterno({ notificaciones, isLoading }) {
  const [expandido, setExpandido] = useState(false);
  const visibles = expandido ? notificaciones : notificaciones.slice(0, 5);

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div>
          <h3 className="font-semibold text-gray-900">Historial de avisos internos</h3>
          <p className="text-xs text-gray-500">Ultimos {notificaciones.length} registros</p>
        </div>
      </div>
      {isLoading ? (
        <div className="grid min-h-[120px] place-items-center"><Spinner /></div>
      ) : notificaciones.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-gray-500">Todavia no hay notificaciones creadas.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {visibles.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">{n.tipo}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${n.leida ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'}`}>
                      {n.leida ? 'Leida' : 'No leida'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-800">{n.titulo}</p>
                  <p className="text-xs text-gray-500 truncate">{n.cuerpo}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{n.empleado_apellido}, {n.empleado_nombre} - {n.empresa_nombre}</p>
                </div>
                <time className="shrink-0 text-xs text-gray-400">{formatoFecha(n.created_at)}</time>
              </div>
            ))}
          </div>
          {notificaciones.length > 5 && (
            <div className="border-t border-gray-100 px-5 py-3">
              <button type="button" onClick={() => setExpandido(!expandido)} className="text-sm font-semibold text-green-700 hover:text-green-800">
                {expandido ? 'Mostrar menos' : `Ver todos (${notificaciones.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function WebhookConfigForm({ config, onClose }) {
  const [form, setForm] = useState({ activo: Boolean(config?.activo), webhook_url: '' });
  const [mostrarWebhook, setMostrarWebhook] = useState(false);
  const [errors, setErrors] = useState({ webhook_url: '' });
  const [highlightWebhook, setHighlightWebhook] = useState(false);
  const webhookRef = useRef(null);
  const guardar = useGuardarWhatsappConfig();
  const reveal = useRevealWebhookUrl();
  const configured = Boolean(config?.configured);
  const inputWebhookValue = mostrarWebhook || form.webhook_url
    ? form.webhook_url
    : configured ? (config.masked_webhook_url || '********') : '';

  useEffect(() => {
    if (!mostrarWebhook || !form.webhook_url) return undefined;
    const timeout = window.setTimeout(() => {
      setMostrarWebhook(false);
      setForm((prev) => ({ ...prev, webhook_url: '' }));
      setErrors((prev) => ({ ...prev, webhook_url: '' }));
    }, 30000);
    return () => window.clearTimeout(timeout);
  }, [mostrarWebhook, form.webhook_url]);

  useEffect(() => {
    if (!highlightWebhook) return undefined;
    const timeout = window.setTimeout(() => setHighlightWebhook(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [highlightWebhook]);

  const validarWebhookBlur = () => {
    if (configured && !form.webhook_url) {
      setErrors((prev) => ({ ...prev, webhook_url: '' }));
      return true;
    }
    const parsed = webhookUrlSchema.safeParse(form.webhook_url);
    setErrors((prev) => ({ ...prev, webhook_url: parsed.success ? '' : parsed.error.issues[0]?.message || 'URL invalida' }));
    return parsed.success;
  };

  const revelarWebhook = async () => {
    try {
      const data = await reveal.mutateAsync();
      setForm((prev) => ({ ...prev, webhook_url: data.webhook_url }));
      setMostrarWebhook(true);
      setErrors((prev) => ({ ...prev, webhook_url: '' }));
    } catch (error) {
      toast.error(mensajeErrorHttp(error, 'No se pudo revelar el webhook'));
    }
  };

  const guardarConfig = async (event) => {
    event.preventDefault();
    if (!validarWebhookBlur()) return;
    try {
      await guardar.mutateAsync({ activo: form.activo, webhook_url: form.webhook_url });
      toast.success('Webhook guardado');
      setMostrarWebhook(false);
      setForm((prev) => ({ ...prev, webhook_url: '' }));
      onClose?.();
    } catch (error) {
      toast.error(mensajeErrorHttp(error, 'No se pudo guardar el webhook'));
    }
  };

  return (
    <form onSubmit={guardarConfig} className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto">
        <p className="text-sm text-gray-600">La API envia a esta URL un JSON con evento, regla, destinatario y mensaje.</p>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input type="checkbox" checked={form.activo} onChange={(e) => setForm((prev) => ({ ...prev, activo: e.target.checked }))} />
          WhatsApp activo
        </label>
        <div className="space-y-3">
          <Input
            label="URL del webhook"
            type={mostrarWebhook ? 'url' : 'password'}
            value={inputWebhookValue}
            onChange={(value) => {
              setForm((prev) => ({ ...prev, webhook_url: value }));
              setErrors((prev) => ({ ...prev, webhook_url: '' }));
            }}
            onBlur={validarWebhookBlur}
            error={errors.webhook_url}
            inputRef={webhookRef}
            className={highlightWebhook ? 'webhook-highlight' : ''}
            placeholder="https://n8n.../webhook/..."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={revelarWebhook}
              disabled={!configured || reveal.isPending}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {reveal.isPending ? 'Revelando...' : mostrarWebhook ? 'Revelado (30s)' : 'Revelar URL'}
            </button>
            {mostrarWebhook && (
              <button
                type="button"
                onClick={() => { setMostrarWebhook(false); setForm((prev) => ({ ...prev, webhook_url: '' })); }}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Ocultar
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
        <button type="submit" disabled={guardar.isPending} className="flex-1 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">
          {guardar.isPending ? 'Guardando...' : 'Guardar webhook'}
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ProbarWhatsappForm({ onClose }) {
  const [test, setTest] = useState({ telefono: '', nombre: 'Prueba La Quinta', cuerpo: 'Mensaje de prueba desde La Quinta.' });
  const [errors, setErrors] = useState({ telefono: '', nombre: '', cuerpo: '' });
  const probar = useProbarWebhookWhatsapp();
  const { data: testLogs = [], isLoading: loadingTestLogs } = useWhatsappTestLogs({ limit: 5 });
  const [expandedId, setExpandedId] = useState(null);

  const validarTest = () => {
    const parsed = whatsappTestSchema.safeParse(test);
    setErrors((prev) => ({
      ...prev,
      telefono: parsed.success ? '' : zodFieldError(parsed.error, 'telefono'),
      nombre: parsed.success ? '' : zodFieldError(parsed.error, 'nombre'),
      cuerpo: parsed.success ? '' : zodFieldError(parsed.error, 'cuerpo'),
    }));
    return parsed.success;
  };

  const probarWebhook = async (event) => {
    event.preventDefault();
    if (!validarTest()) return;
    try {
      const resultado = await probar.mutateAsync({ telefono: test.telefono, nombre: test.nombre, cuerpo: test.cuerpo });
      if (resultado.enviado) {
        toast.success('Webhook probado correctamente');
      } else {
        toast.error(resumenErrorWebhook(resultado) || 'La prueba quedo registrada como fallida');
      }
    } catch (error) {
      const detalle = error?.data?.data;
      toast.error(resumenErrorWebhook(detalle) || mensajeErrorHttp(error, 'No se pudo probar el webhook'));
    }
  };

  const retryTest = (log) => {
    setTest({
      telefono: log.telefono || log.destinatario || '',
      nombre: log.nombre || 'Prueba La Quinta',
      cuerpo: log.mensaje || '',
    });
    setErrors({ telefono: '', nombre: '', cuerpo: '' });
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto">
      <form onSubmit={probarWebhook} className="space-y-4">
        <p className="text-sm text-gray-600">Registra el resultado en el historial de pruebas y ultimos envios.</p>
        <Input
          label="Telefono"
          value={test.telefono}
          onChange={(value) => setTest((prev) => ({ ...prev, telefono: value }))}
          onBlur={validarTest}
          error={errors.telefono}
          required
          placeholder="+549..."
        />
        <Input
          label="Nombre"
          value={test.nombre}
          onChange={(value) => setTest((prev) => ({ ...prev, nombre: value }))}
          onBlur={validarTest}
          error={errors.nombre}
          required
        />
        <Textarea
          label="Mensaje"
          value={test.cuerpo}
          onChange={(value) => setTest((prev) => ({ ...prev, cuerpo: value }))}
          onBlur={validarTest}
          error={errors.cuerpo}
          required
          maxLength={900}
        />
        <button
          type="submit"
          disabled={probar.isPending}
          className="w-full rounded-lg border border-green-700 px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60"
        >
          {probar.isPending ? 'Enviando...' : 'Enviar prueba'}
        </button>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Ultimas pruebas</h3>
        {loadingTestLogs ? (
          <div className="grid min-h-[80px] place-items-center"><Spinner /></div>
        ) : testLogs.length === 0 ? (
          <p className="text-sm text-gray-500">Sin pruebas registradas.</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {testLogs.map((log) => {
              const expanded = expandedId === log.id;
              return (
                <div key={log.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${log.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                          {log.success ? 'OK' : 'Error'}
                        </span>
                        <span className="text-xs text-gray-500">{log.destinatario}</span>
                      </div>
                      <time className="text-xs text-gray-400">{formatoFecha(log.created_at)}</time>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setExpandedId(expanded ? null : log.id)} className="rounded px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-50">
                        {expanded ? 'Ocultar' : 'Detalle'}
                      </button>
                      <button type="button" onClick={() => retryTest(log)} className="rounded px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-50">
                        Reintentar
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-950 p-2 text-xs text-gray-100">
                      {JSON.stringify(log.response_body || {}, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DestinatarioForm({ dest, empresas, onClose }) {
  const [form, setForm] = useState(dest || WHATSAPP_DEST_BASE);
  const guardar = useGuardarDestinatarioWhatsapp();
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    try {
      await guardar.mutateAsync({
        id: form.id,
        data: {
          nombre: form.nombre,
          telefono: form.telefono,
          email: form.email || null,
          empresa_id: form.empresa_id || null,
          activo: form.activo,
        },
      });
      toast.success(form.id ? 'Destinatario actualizado' : 'Destinatario creado');
      onClose?.();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar el destinatario');
    }
  };

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto">
        <p className="text-sm text-gray-600">Contactos que no necesariamente tienen usuario cliente.</p>
        <Input label="Nombre" value={form.nombre} onChange={(value) => setField('nombre', value)} required />
        <Input label="Telefono" value={form.telefono} onChange={(value) => setField('telefono', value)} required placeholder="+549..." />
        <Input label="Email" value={form.email} onChange={(value) => setField('email', value)} />
        <Select label="Empresa asociada" value={form.empresa_id} onChange={(value) => setField('empresa_id', value)}>
          <option value="">Sin empresa</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input type="checkbox" checked={form.activo} onChange={(e) => setField('activo', e.target.checked)} />
          Activo
        </label>
      </div>
      <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
        <button type="submit" disabled={guardar.isPending} className="flex-1 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">
          {guardar.isPending ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function EnviosWhatsappCompacto({ envios, isLoading }) {
  const [expandido, setExpandido] = useState(false);
  const visibles = expandido ? envios : envios.slice(0, 5);

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div>
          <h3 className="font-semibold text-gray-900">Ultimos envios WhatsApp</h3>
          <p className="text-xs text-gray-500">Auditoria de llamadas al webhook de n8n</p>
        </div>
      </div>
      {isLoading ? (
        <div className="grid min-h-[100px] place-items-center"><Spinner /></div>
      ) : envios.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-gray-500">Todavia no hay envios registrados.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {visibles.map((envio) => (
              <div key={envio.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${envio.estado === 'enviado' ? 'bg-emerald-50 text-emerald-700' : envio.estado === 'fallido' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                      {envio.estado}
                    </span>
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">{getEventoLabel(envio.evento)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-800">{envio.destinatario?.nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-gray-500">{envio.destinatario?.telefono} - {envio.regla_nombre || 'Prueba manual'}</p>
                  {envio.error && <p className="text-xs text-red-500">{envio.error}</p>}
                </div>
                <time className="shrink-0 text-xs text-gray-400">{formatoFecha(envio.created_at)}</time>
              </div>
            ))}
          </div>
          {envios.length > 5 && (
            <div className="border-t border-gray-100 px-5 py-3">
              <button type="button" onClick={() => setExpandido(!expandido)} className="text-sm font-semibold text-green-700 hover:text-green-800">
                {expandido ? 'Mostrar menos' : `Ver todos (${envios.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PageTabs({ value, onChange }) {
  const items = [
    { value: 'internas', label: 'Internas' },
    { value: 'whatsapp', label: 'WhatsApp' },
  ];
  return (
    <div className="flex gap-0 -mx-1 mt-3">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
            ${item.value === value
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function NotificacionesAdmin() {
  const [panel, setPanel] = useState('internas');
  const [drawer, setDrawer] = useState(null);
  const [reglaInterna, setReglaInterna] = useState(REGLA_BASE);
  const [reglaWhatsapp, setReglaWhatsapp] = useState({ ...REGLA_BASE, filtros: { ...FILTROS_BASE, requiere_telefono: true } });
  const [destEditando, setDestEditando] = useState(null);

  const { data: empresas = [] } = useEmpresas();
  const { data: empleados = [] } = useEmpleados();
  const { data: notificaciones = [], isLoading: loadingNotificaciones } = useNotificacionesAdmin({ limit: 60 });
  const { data: reglasInternas = [] } = useReglasNotificaciones({ canal: 'interna' });
  const { data: reglasWhatsapp = [] } = useReglasNotificaciones({ canal: 'whatsapp' });
  const { data: whatsappConfig } = useWhatsappConfig();
  const { data: destinatariosWhatsapp = [] } = useDestinatariosWhatsapp();
  const { data: enviosWhatsapp = [], isLoading: loadingEnvios } = useEnviosWhatsapp({ limit: 40 });
  const guardarRegla = useGuardarReglaNotificacion();
  const eliminarRegla = useEliminarReglaNotificacion();
  const eliminarDest = useEliminarDestinatarioWhatsapp();

  const closeDrawer = () => setDrawer(null);
  const resetReglaInterna = () => setReglaInterna(REGLA_BASE);
  const resetReglaWhatsapp = () => setReglaWhatsapp({ ...REGLA_BASE, filtros: { ...FILTROS_BASE, requiere_telefono: true } });

  const abrirEditarRegla = (canal, regla) => {
    if (canal === 'interna') setReglaInterna(normalizarReglaParaForm(regla));
    else setReglaWhatsapp(normalizarReglaParaForm(regla));
    setDrawer(canal === 'interna' ? 'regla-interna' : 'regla-whatsapp');
  };

  const abrirNuevaRegla = (canal) => {
    if (canal === 'interna') resetReglaInterna();
    else resetReglaWhatsapp();
    setDrawer(canal === 'interna' ? 'regla-interna' : 'regla-whatsapp');
  };

  const submitRegla = async (event, canal) => {
    event.preventDefault();
    const state = canal === 'interna' ? reglaInterna : reglaWhatsapp;
    try {
      await guardarRegla.mutateAsync({ id: state.id, data: prepararRegla(state, canal) });
      toast.success(state.id ? 'Regla actualizada' : 'Regla creada');
      if (canal === 'interna') resetReglaInterna();
      else resetReglaWhatsapp();
      closeDrawer();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la regla');
    }
  };

  const borrarRegla = async (id) => {
    if (!window.confirm('Eliminar esta regla?')) return;
    try {
      await eliminarRegla.mutateAsync(id);
      toast.success('Regla eliminada');
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar la regla');
    }
  };

  const borrarDest = async (id) => {
    if (!window.confirm('Eliminar destinatario de WhatsApp?')) return;
    try {
      await eliminarDest.mutateAsync(id);
      toast.success('Destinatario eliminado');
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar el destinatario');
    }
  };

  const configured = Boolean(whatsappConfig?.configured);
  const whatsappActivo = Boolean(whatsappConfig?.activo);

  return (
    <div className="mx-auto max-w-5xl min-w-0 overflow-x-hidden p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
        <p className="text-sm text-gray-500">Avisos internos y mensajes WhatsApp via n8n.</p>
        <PageTabs value={panel} onChange={setPanel} />
      </div>

      {panel === 'internas' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => abrirNuevaRegla('interna')} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
              + Nueva regla
            </button>
            <button type="button" onClick={() => setDrawer('manual')} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Envio manual
            </button>
          </div>

          <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 className="font-semibold text-gray-900">Reglas activas</h2>
              <p className="text-xs text-gray-500">{reglasInternas.length} regla{reglasInternas.length !== 1 ? 's' : ''} configurada{reglasInternas.length !== 1 ? 's' : ''}</p>
            </div>
            {reglasInternas.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-500">No hay reglas configuradas. Crea la primera con el boton de arriba.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2">Regla</th>
                    <th className="px-4 py-2 hidden md:table-cell">Evento</th>
                    <th className="px-4 py-2 hidden sm:table-cell">Alcance</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reglasInternas.map((r) => (
                    <ReglaRow key={r.id} regla={r} onEdit={(reg) => abrirEditarRegla('interna', reg)} onDelete={borrarRegla} />
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <HistorialInterno notificaciones={notificaciones} isLoading={loadingNotificaciones} />
        </div>
      )}

      {panel === 'whatsapp' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-lg ${configured && whatsappActivo ? 'bg-green-50' : 'bg-gray-100'}`}>
                {configured && whatsappActivo ? '✅' : '⚠️'}
              </span>
              <div>
                <p className="font-semibold text-gray-900">Webhook n8n</p>
                <p className="text-xs text-gray-500">
                  {configured ? (whatsappActivo ? 'Configurado y activo' : 'Configurado pero inactivo') : 'Sin configurar'}
                  {whatsappConfig?.masked_webhook_url && (
                    <span className="ml-2 font-mono text-gray-400">{whatsappConfig.masked_webhook_url}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDrawer('webhook-config')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Configurar
              </button>
              <button type="button" onClick={() => setDrawer('probar-wa')} className="rounded-lg border border-green-700 px-3 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-50">
                Probar
              </button>
            </div>
          </div>

          <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <div>
                <h2 className="font-semibold text-gray-900">Reglas de envio</h2>
                <p className="text-xs text-gray-500">{reglasWhatsapp.length} regla{reglasWhatsapp.length !== 1 ? 's' : ''}</p>
              </div>
              <button type="button" onClick={() => abrirNuevaRegla('whatsapp')} className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-800">
                + Nueva regla
              </button>
            </div>
            {reglasWhatsapp.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-500">No hay reglas configuradas.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2">Regla</th>
                    <th className="px-4 py-2 hidden md:table-cell">Evento</th>
                    <th className="px-4 py-2 hidden sm:table-cell">Alcance</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reglasWhatsapp.map((r) => (
                    <ReglaRow key={r.id} regla={r} onEdit={(reg) => abrirEditarRegla('whatsapp', reg)} onDelete={borrarRegla} />
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <div>
                <h2 className="font-semibold text-gray-900">Destinatarios externos</h2>
                <p className="text-xs text-gray-500">{destinatariosWhatsapp.length} contacto{destinatariosWhatsapp.length !== 1 ? 's' : ''}</p>
              </div>
              <button type="button" onClick={() => { setDestEditando(null); setDrawer('dest-form'); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                + Agregar
              </button>
            </div>
            {destinatariosWhatsapp.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-gray-500">No hay destinatarios externos cargados.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {destinatariosWhatsapp.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900">{d.nombre}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {d.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{d.telefono}{d.empresa_nombre ? ` - ${d.empresa_nombre}` : ''}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setDestEditando({ id: d.id, nombre: d.nombre, telefono: d.telefono, email: d.email || '', empresa_id: d.empresa_id || '', activo: d.activo });
                          setDrawer('dest-form');
                        }}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Editar
                      </button>
                      <button type="button" onClick={() => borrarDest(d.id)} className="rounded-md px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50">
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <EnviosWhatsappCompacto envios={enviosWhatsapp} isLoading={loadingEnvios} />
        </div>
      )}

      <SideDrawer open={drawer === 'regla-interna'} onClose={closeDrawer} title={reglaInterna.id ? 'Editar regla interna' : 'Nueva regla interna'} width="lg">
        <ReglaForm
          canal="interna"
          regla={reglaInterna}
          setRegla={setReglaInterna}
          empresas={empresas}
          empleados={empleados}
          destinatariosWhatsapp={destinatariosWhatsapp}
          onSubmit={(e) => submitRegla(e, 'interna')}
          saving={guardarRegla.isPending}
          onCancel={closeDrawer}
        />
      </SideDrawer>

      <SideDrawer open={drawer === 'regla-whatsapp'} onClose={closeDrawer} title={reglaWhatsapp.id ? 'Editar regla WhatsApp' : 'Nueva regla WhatsApp'} width="lg">
        <ReglaForm
          canal="whatsapp"
          regla={reglaWhatsapp}
          setRegla={setReglaWhatsapp}
          empresas={empresas}
          empleados={empleados}
          destinatariosWhatsapp={destinatariosWhatsapp}
          onSubmit={(e) => submitRegla(e, 'whatsapp')}
          saving={guardarRegla.isPending}
          onCancel={closeDrawer}
        />
      </SideDrawer>

      <SideDrawer open={drawer === 'manual'} onClose={closeDrawer} title="Envio manual interno" width="md">
        <ManualInternaForm empresas={empresas} empleados={empleados} onDone={closeDrawer} />
      </SideDrawer>

      <SideDrawer open={drawer === 'webhook-config'} onClose={closeDrawer} title="Configurar webhook n8n" width="md">
        {whatsappConfig ? (
          <WebhookConfigForm config={whatsappConfig} onClose={closeDrawer} />
        ) : (
          <div className="grid min-h-[200px] place-items-center"><Spinner /></div>
        )}
      </SideDrawer>

      <SideDrawer open={drawer === 'probar-wa'} onClose={closeDrawer} title="Probar WhatsApp" width="md">
        <ProbarWhatsappForm onClose={closeDrawer} />
      </SideDrawer>

      <SideDrawer open={drawer === 'dest-form'} onClose={closeDrawer} title={destEditando ? 'Editar destinatario' : 'Nuevo destinatario externo'} width="md">
        <DestinatarioForm dest={destEditando} empresas={empresas} onClose={closeDrawer} />
      </SideDrawer>
    </div>
  );
}
