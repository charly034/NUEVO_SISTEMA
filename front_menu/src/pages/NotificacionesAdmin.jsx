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
  if (errorCode === 'INVALID_WEBHOOK_URL') return 'Configurá una URL HTTPS válida antes de probar WhatsApp.';
  if (errorCode === 'N8N_TIMEOUT') return 'n8n no respondió a tiempo. Revisá si el workflow está activo.';
  if (status === 400) return error?.message || 'Revisá los datos ingresados.';
  if (status === 401 || status === 403) return 'Tu sesión no tiene permisos para esta acción.';
  if (status === 404) return 'No se encontró el recurso solicitado.';
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
  label,
  value,
  onChange,
  required = false,
  placeholder = '',
  type = 'text',
  maxLength,
  onBlur,
  error = '',
  inputRef,
  className = '',
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
    return empleados.filter((empleado) => Number(empleado.empresa_id) === Number(filtros.empresa_id));
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
      <Select label="Destinatarios" value={filtros.alcance} onChange={(value) => setFiltro('alcance', value)}>
        {alcances.map((alcance) => <option key={alcance.value} value={alcance.value}>{alcance.label}</option>)}
      </Select>

      {(filtros.alcance === 'empresa' || filtros.alcance === 'empleado') && (
        <Select
          label="Empresa"
          value={filtros.empresa_id}
          onChange={(value) => setFiltro('empresa_id', value)}
          required={filtros.alcance === 'empresa'}
        >
          <option value="">Todas</option>
          {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
        </Select>
      )}

      {filtros.alcance === 'empleado' && (
        <Select label="Empleado" value={filtros.empleado_id} onChange={(value) => setFiltro('empleado_id', value)} required>
          <option value="">Seleccionar empleado</option>
          {empleadosFiltrados.map((empleado) => (
            <option key={empleado.id} value={empleado.id}>
              {empleado.apellido}, {empleado.nombre} - {empleado.empresa_nombre}
            </option>
          ))}
        </Select>
      )}

      {filtros.alcance === 'destinatarios_whatsapp' && (
        <div>
          <span className="mb-2 block text-sm font-semibold text-gray-700">Contactos externos</span>
          <div className="max-h-36 overflow-auto rounded-lg border border-gray-200 bg-white p-2">
            {destinatariosWhatsapp.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-gray-600">No hay destinatarios externos cargados.</p>
            ) : destinatariosWhatsapp.map((destinatario) => (
              <label key={destinatario.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={(filtros.destinatario_whatsapp_ids || []).includes(Number(destinatario.id))}
                  onChange={() => toggleDestinatario(destinatario.id)}
                />
                <span>{destinatario.nombre} - {destinatario.telefono}</span>
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

      <div className="grid gap-2 text-sm text-gray-600">
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

function ReglaForm({ canal, regla, setRegla, empresas, empleados, destinatariosWhatsapp, onSubmit, saving }) {
  const setField = (field, value) => setRegla((prev) => ({ ...prev, [field]: value }));
  const setProgramacion = (field, value) => {
    setRegla((prev) => ({
      ...prev,
      programacion: {
        ...prev.programacion,
        [field]: value,
      },
    }));
  };
  const setFiltros = (updater) => {
    setRegla((prev) => ({
      ...prev,
      filtros: typeof updater === 'function' ? updater(prev.filtros) : updater,
    }));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900">{regla.id ? 'Editar regla' : 'Nueva regla'}</h2>
          <p className="text-sm text-gray-600">Usa variables como {'{{semana_rango}}'}, {'{{nombre}}'} o {'{{estado}}'}.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input type="checkbox" checked={regla.activo} onChange={(event) => setField('activo', event.target.checked)} />
          Activa
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Evento" value={regla.evento} onChange={(value) => setField('evento', value)}>
          {EVENTOS.map((evento) => <option key={evento.value} value={evento.value}>{evento.label}</option>)}
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
            {DIAS_SEMANA.map((dia) => <option key={dia.value} value={dia.value}>{dia.label}</option>)}
          </Select>
          <Input
            label="Hora"
            type="time"
            value={regla.programacion?.hora || '09:00'}
            onChange={(value) => setProgramacion('hora', value)}
            required
          />
          <p className="sm:col-span-2 text-xs text-amber-700">
            El scheduler envia esta regla solo a empleados activos que todavia no tengan pedido no cancelado para la semana publicada objetivo.
          </p>
        </div>
      )}

      <Input label="Título" value={regla.titulo} onChange={(value) => setField('titulo', value)} required maxLength={160} />
      <Textarea label="Mensaje" value={regla.cuerpo} onChange={(value) => setField('cuerpo', value)} required />

      <FiltrosRegla
        canal={canal}
        filtros={regla.filtros}
        setFiltros={setFiltros}
        empresas={empresas}
        empleados={empleados}
        destinatariosWhatsapp={destinatariosWhatsapp}
      />

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Guardando...' : regla.id ? 'Guardar cambios' : 'Crear regla'}
      </button>
    </form>
  );
}

function ReglasList({ reglas, onEdit, onDelete }) {
  if (reglas.length === 0) {
    return <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-600">No hay reglas configuradas.</div>;
  }

  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-sm">
      {reglas.map((regla) => (
        <article key={regla.id} className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">{getEventoLabel(regla.evento)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${regla.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                  {regla.activo ? 'Activa' : 'Pausada'}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                  {regla.filtros?.alcance || 'todos'}
                </span>
              </div>
              <h3 className="mt-2 font-semibold text-gray-900">{regla.nombre}</h3>
              <p className="mt-1 text-sm text-gray-600">{regla.titulo}</p>
              {regla.evento === 'pedido_semanal_pendiente' && regla.programacion?.hora && (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  {DIAS_SEMANA.find((dia) => dia.value === Number(regla.programacion.dia_semana))?.label || 'Dia'} a las {regla.programacion.hora}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-600">{regla.cuerpo}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => onEdit(regla)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Editar
              </button>
              <button type="button" onClick={() => onDelete(regla.id)} className="rounded-lg border border-red-100 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                Eliminar
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ManualInterna({ empresas, empleados }) {
  const [form, setForm] = useState(MANUAL_BASE);
  const enviar = useEnviarNotificacion();

  const empleadosFiltrados = useMemo(() => {
    if (!form.empresa_id) return empleados;
    return empleados.filter((empleado) => Number(empleado.empresa_id) === Number(form.empresa_id));
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
      const payload = {
        alcance: form.alcance,
        tipo: form.tipo,
        titulo: form.titulo,
        cuerpo: form.cuerpo,
      };
      if (form.alcance === 'empresa') payload.empresa_id = form.empresa_id;
      if (form.alcance === 'empleado') payload.empleado_id = form.empleado_id;
      const resultado = await enviar.mutateAsync(payload);
      toast.success(`Enviadas: ${resultado.enviadas}`);
      setForm(MANUAL_BASE);
    } catch (error) {
      toast.error(error?.message || 'No se pudo enviar la notificación');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-bold text-gray-900">Envío manual interno</h2>
        <p className="text-sm text-gray-600">Crea avisos dentro de la app de clientes.</p>
      </div>
      <Select label="Alcance" value={form.alcance} onChange={(value) => setField('alcance', value)}>
        {ALCANCES_MANUAL.map((alcance) => <option key={alcance.value} value={alcance.value}>{alcance.label}</option>)}
      </Select>
      {(form.alcance === 'empresa' || form.alcance === 'empleado') && (
        <Select label="Empresa" value={form.empresa_id} onChange={(value) => setField('empresa_id', value)} required={form.alcance === 'empresa'}>
          <option value="">Seleccionar empresa</option>
          {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
        </Select>
      )}
      {form.alcance === 'empleado' && (
        <Select label="Empleado" value={form.empleado_id} onChange={(value) => setField('empleado_id', value)} required>
          <option value="">Seleccionar empleado</option>
          {empleadosFiltrados.map((empleado) => (
            <option key={empleado.id} value={empleado.id}>{empleado.apellido}, {empleado.nombre} - {empleado.empresa_nombre}</option>
          ))}
        </Select>
      )}
      <Select label="Tipo" value={form.tipo} onChange={(value) => setField('tipo', value)}>
        {TIPOS.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
      </Select>
      <Input label="Título" value={form.titulo} onChange={(value) => setField('titulo', value)} required maxLength={120} placeholder="Ej: Menú publicado" />
      <Textarea label="Mensaje" value={form.cuerpo} onChange={(value) => setField('cuerpo', value)} required maxLength={700} placeholder="Escribi el aviso para los clientes." />
      <button
        type="submit"
        disabled={enviar.isPending}
        className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviar.isPending ? 'Enviando...' : 'Enviar notificación'}
      </button>
    </form>
  );
}

function HistorialInterno({ notificaciones, isLoading }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="font-bold text-gray-900">Últimas internas</h2>
        <p className="text-sm text-gray-600">Incluye envíos manuales y eventos automáticos.</p>
      </div>
      {isLoading ? (
        <div className="grid min-h-[200px] place-items-center"><Spinner /></div>
      ) : notificaciones.length === 0 ? (
        <div className="grid min-h-[200px] place-items-center px-5 text-center text-sm text-gray-600">Todavía no hay notificaciones creadas.</div>
      ) : (
        <div className="max-h-[520px] divide-y divide-gray-100 overflow-auto">
          {notificaciones.map((notificacion) => (
            <article key={notificacion.id} className="p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">{notificacion.tipo}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${notificacion.leida ? 'bg-gray-100 text-gray-700' : 'bg-amber-50 text-amber-700'}`}>
                      {notificacion.leida ? 'Leída' : 'No leída'}
                    </span>
                  </div>
                  <h3 className="mt-2 font-semibold text-gray-900">{notificacion.titulo}</h3>
                  <p className="mt-1 text-sm text-gray-600">{notificacion.cuerpo}</p>
                  <p className="mt-2 text-xs text-gray-600">
                    {notificacion.empleado_apellido}, {notificacion.empleado_nombre} - {notificacion.empresa_nombre}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-gray-600">{formatoFecha(notificacion.created_at)}</time>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Tabs({ value, onChange, items }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`relative rounded-md px-4 py-2 text-sm font-semibold transition-colors ${active ? 'text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            {item.label}
            {active && <span className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-green-700" />}
          </button>
        );
      })}
    </div>
  );
}

function TestHistoryList({ logs, isLoading, onRetry }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="font-bold text-gray-900">Historial de pruebas</h2>
        <p className="text-sm text-gray-600">Ultimos intentos manuales enviados desde Probar WhatsApp.</p>
      </div>
      {isLoading ? (
        <div className="grid min-h-[160px] place-items-center"><Spinner /></div>
      ) : logs.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-600">Todavia no hay pruebas registradas.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {logs.map((log) => {
            const expanded = expandedId === log.id;
            return (
              <article key={log.id} className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${log.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {log.success ? 'OK' : 'Error'}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                        {log.status_code ? `HTTP ${log.status_code}` : log.error_code || 'Sin codigo'}
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold text-gray-900">{log.nombre}</h3>
                    <p className="text-sm text-gray-700">{log.destinatario}</p>
                    <time className="mt-1 block text-xs text-gray-600">{formatoFecha(log.created_at)}</time>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : log.id)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRetry(log)}
                      className="rounded-lg border border-green-700 px-3 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-50"
                    >
                      Reintentar
                    </button>
                  </div>
                </div>
                {expanded && (
                  <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                    {JSON.stringify(log.response_body || {}, null, 2)}
                  </pre>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WhatsappConfig({ config }) {
  const [form, setForm] = useState({ activo: Boolean(config?.activo), webhook_url: '' });
  const [mostrarWebhook, setMostrarWebhook] = useState(false);
  const [errors, setErrors] = useState({ webhook_url: '', telefono: '', nombre: '', cuerpo: '' });
  const [highlightWebhook, setHighlightWebhook] = useState(false);
  const [test, setTest] = useState({ telefono: '', nombre: 'Prueba La Quinta', cuerpo: 'Mensaje de prueba desde La Quinta.' });
  const webhookRef = useRef(null);
  const guardar = useGuardarWhatsappConfig();
  const probar = useProbarWebhookWhatsapp();
  const reveal = useRevealWebhookUrl();
  const { data: testLogs = [], isLoading: loadingTestLogs } = useWhatsappTestLogs({ limit: 10 });
  const configured = Boolean(config?.configured);
  const inputWebhookValue = mostrarWebhook || form.webhook_url
    ? form.webhook_url
    : configured
      ? config.masked_webhook_url || '********'
      : '';

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
      await guardar.mutateAsync({
        activo: form.activo,
        webhook_url: form.webhook_url,
      });
      toast.success('Webhook guardado');
      setMostrarWebhook(false);
      setForm((prev) => ({ ...prev, webhook_url: '' }));
    } catch (error) {
      toast.error(mensajeErrorHttp(error, 'No se pudo guardar el webhook'));
    }
  };

  const probarWebhook = async (event) => {
    event.preventDefault();
    if (!validarTest()) return;
    try {
      const resultado = await probar.mutateAsync({ telefono: test.telefono, nombre: test.nombre, cuerpo: test.cuerpo });
      if (resultado.enviado) {
        toast.success('Webhook probado');
      } else {
        toast.error(resumenErrorWebhook(resultado) || 'La prueba quedo registrada como fallida');
      }
    } catch (error) {
      const detalle = error?.data?.data;
      if (error?.data?.errorCode === 'INVALID_WEBHOOK_URL') {
        webhookRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightWebhook(true);
      }
      toast.error(resumenErrorWebhook(detalle) || mensajeErrorHttp(error, 'No se pudo probar el webhook'));
    }
  };

  const retryTest = (log) => {
    setTest({
      telefono: log.telefono || log.destinatario || '',
      nombre: log.nombre || 'Prueba La Quinta',
      cuerpo: log.mensaje || '',
    });
    setErrors((prev) => ({ ...prev, telefono: '', nombre: '', cuerpo: '' }));
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={guardarConfig} className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Webhook n8n</h2>
              <p className="text-sm text-gray-600">La API envia a esta URL un JSON con evento, regla, destinatario y mensaje.</p>
            </div>
            <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {configured ? 'Webhook configurado OK' : 'Sin configurar'}
            </span>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input type="checkbox" checked={form.activo} onChange={(event) => setForm((prev) => ({ ...prev, activo: event.target.checked }))} />
            WhatsApp activo
          </label>
          <div className="space-y-3 border-b border-gray-100 pb-4">
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
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reveal.isPending ? 'Revelando...' : mostrarWebhook ? 'Revelado por 30s' : 'Revelar URL'}
              </button>
              {mostrarWebhook && (
                <button
                  type="button"
                  onClick={() => {
                    setMostrarWebhook(false);
                    setForm((prev) => ({ ...prev, webhook_url: '' }));
                  }}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Ocultar ahora
                </button>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={guardar.isPending}
            className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardar.isPending ? 'Guardando...' : 'Guardar webhook'}
          </button>
        </form>

        <form onSubmit={probarWebhook} className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-bold text-gray-900">Probar WhatsApp</h2>
            <p className="text-sm text-gray-600">Registra el resultado en el historial de pruebas y ultimos envios.</p>
          </div>
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
            className="w-full rounded-lg border border-green-700 px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {probar.isPending ? 'Probando...' : 'Enviar prueba'}
          </button>
        </form>
      </section>
      <TestHistoryList logs={testLogs} isLoading={loadingTestLogs} onRetry={retryTest} />
    </div>
  );
}

function DestinatariosWhatsapp({ empresas, destinatarios }) {
  const [form, setForm] = useState(WHATSAPP_DEST_BASE);
  const guardar = useGuardarDestinatarioWhatsapp();
  const eliminar = useEliminarDestinatarioWhatsapp();

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
      setForm(WHATSAPP_DEST_BASE);
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar el destinatario');
    }
  };

  const borrar = async (id) => {
    if (!window.confirm('Eliminar destinatario de WhatsApp?')) return;
    try {
      await eliminar.mutateAsync(id);
      toast.success('Destinatario eliminado');
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar el destinatario');
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-bold text-gray-900">{form.id ? 'Editar destinatario' : 'Destinatario externo'}</h2>
          <p className="text-sm text-gray-600">Contactos que no necesariamente tienen usuario cliente.</p>
        </div>
        <Input label="Nombre" value={form.nombre} onChange={(value) => setField('nombre', value)} required />
        <Input label="Telefono" value={form.telefono} onChange={(value) => setField('telefono', value)} required placeholder="+549..." />
        <Input label="Email" value={form.email} onChange={(value) => setField('email', value)} />
        <Select label="Empresa asociada" value={form.empresa_id} onChange={(value) => setField('empresa_id', value)}>
          <option value="">Sin empresa</option>
          {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input type="checkbox" checked={form.activo} onChange={(event) => setField('activo', event.target.checked)} />
          Activo
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="submit" disabled={guardar.isPending} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">
            {guardar.isPending ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setForm(WHATSAPP_DEST_BASE)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Limpiar
          </button>
        </div>
      </form>

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-sm">
        {destinatarios.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-600">No hay destinatarios externos cargados.</div>
        ) : destinatarios.map((destinatario) => (
          <article key={destinatario.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-gray-900">{destinatario.nombre}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${destinatario.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                  {destinatario.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className="text-sm text-gray-600">{destinatario.telefono}</p>
              <p className="text-xs text-gray-600">{destinatario.empresa_nombre || 'Sin empresa'}{destinatario.email ? ` - ${destinatario.email}` : ''}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({
                id: destinatario.id,
                nombre: destinatario.nombre,
                telefono: destinatario.telefono,
                email: destinatario.email || '',
                empresa_id: destinatario.empresa_id || '',
                activo: destinatario.activo,
              })} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Editar
              </button>
              <button type="button" onClick={() => borrar(destinatario.id)} className="rounded-lg border border-red-100 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EnviosWhatsapp({ envios, isLoading }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="font-bold text-gray-900">Últimos envíos WhatsApp</h2>
        <p className="text-sm text-gray-600">Auditoría de llamadas realizadas al webhook de n8n.</p>
      </div>
      {isLoading ? (
        <div className="grid min-h-[180px] place-items-center"><Spinner /></div>
      ) : envios.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-600">Todavia no hay envios registrados.</div>
      ) : (
        <div className="max-h-[420px] divide-y divide-gray-100 overflow-auto">
          {envios.map((envio) => (
            <article key={envio.id} className="p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${envio.estado === 'enviado' ? 'bg-emerald-50 text-emerald-700' : envio.estado === 'fallido' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700'}`}>
                      {envio.estado}
                    </span>
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">{getEventoLabel(envio.evento)}</span>
                  </div>
                  <h3 className="mt-2 font-semibold text-gray-900">{envio.destinatario?.nombre || 'Sin nombre'}</h3>
                  <p className="text-sm text-gray-600">{envio.destinatario?.telefono}</p>
                  <p className="mt-1 text-xs text-gray-600">{envio.regla_nombre || 'Prueba manual'}{envio.status_code ? ` - HTTP ${envio.status_code}` : ''}</p>
                  {envio.error && <p className="mt-1 text-xs text-red-600">{envio.error}</p>}
                  {resumenRespuestaWebhook(envio.respuesta) && (
                    <p className="mt-1 break-words text-xs text-gray-600">{resumenRespuestaWebhook(envio.respuesta)}</p>
                  )}
                </div>
                <time className="shrink-0 text-xs text-gray-600">{formatoFecha(envio.created_at)}</time>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function NotificacionesAdmin() {
  const [panel, setPanel] = useState('internas');
  const [reglaInterna, setReglaInterna] = useState(REGLA_BASE);
  const [reglaWhatsapp, setReglaWhatsapp] = useState({ ...REGLA_BASE, filtros: { ...FILTROS_BASE, requiere_telefono: true } });

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

  const resetReglaInterna = () => setReglaInterna(REGLA_BASE);
  const resetReglaWhatsapp = () => setReglaWhatsapp({ ...REGLA_BASE, filtros: { ...FILTROS_BASE, requiere_telefono: true } });

  const submitRegla = async (event, canal) => {
    event.preventDefault();
    const state = canal === 'interna' ? reglaInterna : reglaWhatsapp;
    try {
      await guardarRegla.mutateAsync({ id: state.id, data: prepararRegla(state, canal) });
      toast.success(state.id ? 'Regla actualizada' : 'Regla creada');
      if (canal === 'interna') resetReglaInterna();
      else resetReglaWhatsapp();
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

  return (
    <div className="mx-auto max-w-7xl min-w-0 overflow-x-hidden p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-sm text-gray-600">Panel de control para avisos internos y WhatsApp vía n8n.</p>
        </div>
        <Tabs
          value={panel}
          onChange={setPanel}
          items={[
            { value: 'internas', label: 'Internas' },
            { value: 'whatsapp', label: 'WhatsApp' },
          ]}
        />
      </div>

      {panel === 'internas' ? (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <ManualInterna empresas={empresas} empleados={empleados} />
            <ReglaForm
              canal="interna"
              regla={reglaInterna}
              setRegla={setReglaInterna}
              empresas={empresas}
              empleados={empleados}
              destinatariosWhatsapp={destinatariosWhatsapp}
              onSubmit={(event) => submitRegla(event, 'interna')}
              saving={guardarRegla.isPending}
            />
          </div>
          <div className="space-y-5">
            <ReglasList
              reglas={reglasInternas}
              onEdit={(regla) => setReglaInterna(normalizarReglaParaForm(regla))}
              onDelete={borrarRegla}
            />
            <HistorialInterno notificaciones={notificaciones} isLoading={loadingNotificaciones} />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {whatsappConfig ? (
            <WhatsappConfig config={whatsappConfig} />
          ) : (
            <div className="grid min-h-[180px] place-items-center rounded-xl border border-gray-100 bg-white shadow-sm">
              <Spinner />
            </div>
          )}
          <DestinatariosWhatsapp empresas={empresas} destinatarios={destinatariosWhatsapp} />
          <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <ReglaForm
              canal="whatsapp"
              regla={reglaWhatsapp}
              setRegla={setReglaWhatsapp}
              empresas={empresas}
              empleados={empleados}
              destinatariosWhatsapp={destinatariosWhatsapp}
              onSubmit={(event) => submitRegla(event, 'whatsapp')}
              saving={guardarRegla.isPending}
            />
            <ReglasList
              reglas={reglasWhatsapp}
              onEdit={(regla) => setReglaWhatsapp(normalizarReglaParaForm(regla))}
              onDelete={borrarRegla}
            />
          </div>
          <EnviosWhatsapp envios={enviosWhatsapp} isLoading={loadingEnvios} />
        </div>
      )}
    </div>
  );
}
