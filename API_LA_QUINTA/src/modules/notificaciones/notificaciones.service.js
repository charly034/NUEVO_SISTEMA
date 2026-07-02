import { ApiError } from '../../utils/ApiError.js';
import * as repo from './notificaciones.repository.js';

const TIPOS = ['menu', 'recordatorio', 'confirmado', 'sistema'];
const ALCANCES = ['todos', 'empresa', 'empleado'];
const CANALES = ['interna', 'whatsapp'];
const EVENTOS = ['manual', 'nuevo_registro', 'menu_publicado', 'pedido_estado_cambiado', 'pedido_semanal_pendiente'];
const ALCANCES_REGLA = ['todos', 'empresa', 'empleado', 'empleado_evento', 'destinatarios_whatsapp'];
const WHATSAPP_CONFIG_KEY = 'whatsapp_n8n';

const ESTADO_TITULO = {
  pendiente: 'Tu pedido esta pendiente',
  en_proceso: 'Tu pedido esta en preparacion',
  listo: 'Tu pedido esta listo',
  entregado: 'Tu pedido fue entregado',
  cancelado: 'Tu pedido fue cancelado',
};

function normalizarTexto(valor, campo, max) {
  const texto = String(valor || '').trim();
  if (!texto) throw ApiError.badRequest(`${campo} es requerido`);
  if (texto.length > max) throw ApiError.badRequest(`${campo} debe tener ${max} caracteres o menos`);
  return texto;
}

function normalizarTextoOpcional(valor, max) {
  const texto = String(valor || '').trim();
  if (!texto) return null;
  if (texto.length > max) throw ApiError.badRequest(`El texto debe tener ${max} caracteres o menos`);
  return texto;
}

function normalizarId(valor, campo) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest(`${campo} invalido`);
  return id;
}

function normalizarIdOpcional(valor, campo) {
  if (valor === null || valor === undefined || valor === '') return null;
  return normalizarId(valor, campo);
}

function normalizarBoolean(valor, fallback = true) {
  if (valor === undefined || valor === null || valor === '') return fallback;
  return Boolean(valor);
}

function normalizarHora(valor) {
  const hora = String(valor || '').trim();
  if (!/^\d{2}:\d{2}$/.test(hora)) throw ApiError.badRequest('hora debe tener formato HH:mm');
  const [hh, mm] = hora.split(':').map(Number);
  if (hh > 23 || mm > 59) throw ApiError.badRequest('hora debe tener formato HH:mm valido');
  return hora;
}

function fechaCorta(fecha) {
  return String(fecha || '').split('T')[0];
}

function normalizarEnvioAdmin(payload = {}) {
  const alcance = payload.alcance || 'todos';
  const tipo = payload.tipo || 'sistema';

  if (!ALCANCES.includes(alcance)) {
    throw ApiError.badRequest(`alcance invalido. Opciones: ${ALCANCES.join(', ')}`);
  }
  if (!TIPOS.includes(tipo)) {
    throw ApiError.badRequest(`tipo invalido. Opciones: ${TIPOS.join(', ')}`);
  }

  return {
    alcance,
    tipo,
    titulo: normalizarTexto(payload.titulo, 'titulo', 120),
    cuerpo: normalizarTexto(payload.cuerpo, 'cuerpo', 700),
    empresaId: alcance === 'empresa' ? normalizarId(payload.empresa_id, 'empresa_id') : null,
    empleadoId: alcance === 'empleado' ? normalizarId(payload.empleado_id, 'empleado_id') : null,
  };
}

function normalizarFiltros(payload = {}, canal = 'interna') {
  const alcance = payload.alcance || 'todos';
  if (!ALCANCES_REGLA.includes(alcance)) {
    throw ApiError.badRequest(`alcance de regla invalido. Opciones: ${ALCANCES_REGLA.join(', ')}`);
  }
  if (canal === 'interna' && alcance === 'destinatarios_whatsapp') {
    throw ApiError.badRequest('destinatarios_whatsapp solo aplica al canal WhatsApp');
  }

  const filtros = {
    alcance,
    empresa_id: alcance === 'empresa' ? normalizarId(payload.empresa_id, 'empresa_id') : normalizarIdOpcional(payload.empresa_id, 'empresa_id'),
    empleado_id: alcance === 'empleado' ? normalizarId(payload.empleado_id, 'empleado_id') : normalizarIdOpcional(payload.empleado_id, 'empleado_id'),
    rol: payload.rol && payload.rol !== 'todos' ? String(payload.rol).trim() : null,
    plan: payload.plan && payload.plan !== 'todos' ? String(payload.plan).trim() : null,
    modo_pedido: payload.modo_pedido && payload.modo_pedido !== 'todos' ? String(payload.modo_pedido).trim() : null,
    dias_laborales: payload.dias_laborales && payload.dias_laborales !== 'todos' ? String(payload.dias_laborales).trim() : null,
    solo_preferencia_whatsapp: Boolean(payload.solo_preferencia_whatsapp),
    requiere_telefono: canal === 'whatsapp' ? payload.requiere_telefono !== false : Boolean(payload.requiere_telefono),
  };

  if (alcance === 'destinatarios_whatsapp') {
    const ids = Array.isArray(payload.destinatario_whatsapp_ids)
      ? payload.destinatario_whatsapp_ids.map((id) => normalizarId(id, 'destinatario_whatsapp_ids'))
      : [];
    filtros.destinatario_whatsapp_ids = ids;
  }

  return filtros;
}

function normalizarProgramacion(payload = {}, evento = 'manual') {
  if (evento !== 'pedido_semanal_pendiente') return {};

  const tipo = payload.tipo || 'semanal';
  if (tipo !== 'semanal') throw ApiError.badRequest('programacion.tipo debe ser semanal');

  const diaSemana = Number(payload.dia_semana ?? 1);
  if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) {
    throw ApiError.badRequest('programacion.dia_semana debe ser 0 a 6');
  }

  return {
    tipo,
    dia_semana: diaSemana,
    hora: normalizarHora(payload.hora || '09:00'),
  };
}

function normalizarRegla(payload = {}, partial = false) {
  const canal = payload.canal || 'interna';
  const evento = payload.evento || 'manual';

  if (!CANALES.includes(canal)) throw ApiError.badRequest(`canal invalido. Opciones: ${CANALES.join(', ')}`);
  if (!EVENTOS.includes(evento)) throw ApiError.badRequest(`evento invalido. Opciones: ${EVENTOS.join(', ')}`);

  const regla = {};
  if (!partial || payload.canal !== undefined) regla.canal = canal;
  if (!partial || payload.evento !== undefined) regla.evento = evento;
  if (!partial || payload.nombre !== undefined) regla.nombre = normalizarTexto(payload.nombre, 'nombre', 160);
  if (!partial || payload.activo !== undefined) regla.activo = normalizarBoolean(payload.activo, true);
  if (!partial || payload.filtros !== undefined) regla.filtros = normalizarFiltros(payload.filtros || {}, canal);
  if (!partial || payload.titulo !== undefined) regla.titulo = normalizarTexto(payload.titulo, 'titulo', 160);
  if (!partial || payload.cuerpo !== undefined) regla.cuerpo = normalizarTexto(payload.cuerpo, 'cuerpo', 900);
  if (!partial || payload.programacion !== undefined) regla.programacion = normalizarProgramacion(payload.programacion || {}, evento);
  return regla;
}

function normalizarConfigWhatsapp(payload = {}) {
  const activo = Boolean(payload.activo);
  const webhookUrl = String(payload.webhook_url || '').trim();
  if (activo && !webhookUrl) throw ApiError.badRequest('webhook_url es requerido para activar WhatsApp');
  if (webhookUrl) {
    try {
      const url = new URL(webhookUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid');
    } catch {
      throw ApiError.badRequest('webhook_url debe ser una URL http/https valida');
    }
  }
  return { activo, webhook_url: webhookUrl };
}

function normalizarDestinatarioWhatsapp(payload = {}, partial = false) {
  const data = {};
  if (!partial || payload.nombre !== undefined) data.nombre = normalizarTexto(payload.nombre, 'nombre', 160);
  if (!partial || payload.telefono !== undefined) data.telefono = normalizarTexto(payload.telefono, 'telefono', 40);
  if (!partial || payload.email !== undefined) data.email = normalizarTextoOpcional(payload.email, 255);
  if (!partial || payload.empresa_id !== undefined) data.empresa_id = normalizarIdOpcional(payload.empresa_id, 'empresa_id');
  if (!partial || payload.activo !== undefined) data.activo = normalizarBoolean(payload.activo, true);
  return data;
}

function valorPreferenciaWhatsapp(empleado) {
  return Boolean(empleado?.preferencias_alimentarias?.recibir_recordatorios_whatsapp);
}

function filtrarEmpleadosPorParametros(empleados, filtros) {
  return empleados.filter((empleado) => {
    if (filtros.rol && empleado.rol !== filtros.rol) return false;
    if (filtros.plan && empleado.plan !== filtros.plan) return false;
    if (filtros.modo_pedido && empleado.modo_pedido !== filtros.modo_pedido) return false;
    if (filtros.dias_laborales && empleado.dias_laborales !== filtros.dias_laborales) return false;
    if (filtros.requiere_telefono && !empleado.telefono) return false;
    if (filtros.solo_preferencia_whatsapp && !valorPreferenciaWhatsapp(empleado)) return false;
    return true;
  });
}

function filtrarPorPermitidos(empleados, contexto = {}) {
  if (!Array.isArray(contexto.empleado_ids_permitidos)) return empleados;
  const permitidos = new Set(contexto.empleado_ids_permitidos.map(Number));
  return empleados.filter((empleado) => permitidos.has(Number(empleado.id)));
}

async function resolverEmpleados(filtros = {}, contexto = {}) {
  if (filtros.alcance === 'destinatarios_whatsapp') return [];

  const alcance = filtros.alcance === 'empleado_evento'
    ? 'empleado'
    : filtros.alcance || 'todos';
  const empleadoId = filtros.alcance === 'empleado_evento'
    ? contexto.empleado_id
    : filtros.empleado_id;

  if (alcance === 'empleado' && !empleadoId) return [];

  const destinatarios = await repo.findDestinatarios({
    alcance,
    empresaId: filtros.empresa_id,
    empleadoId,
  });

  return filtrarPorPermitidos(filtrarEmpleadosPorParametros(destinatarios, filtros), contexto);
}

async function resolverDestinatariosWhatsapp(filtros = {}, contexto = {}) {
  if (filtros.alcance === 'destinatarios_whatsapp') {
    const destinatarios = await repo.findDestinatariosWhatsapp({ soloActivos: true });
    return destinatarios
      .filter((destinatario) => {
        if (filtros.empresa_id && Number(destinatario.empresa_id) !== Number(filtros.empresa_id)) return false;
        if (Array.isArray(filtros.destinatario_whatsapp_ids) && filtros.destinatario_whatsapp_ids.length > 0) {
          return filtros.destinatario_whatsapp_ids.includes(Number(destinatario.id));
        }
        return true;
      })
      .map((destinatario) => ({
        tipo: 'destinatario_whatsapp',
        id: destinatario.id,
        nombre: destinatario.nombre,
        telefono: destinatario.telefono,
        email: destinatario.email,
        empresa_id: destinatario.empresa_id,
        empresa_nombre: destinatario.empresa_nombre,
      }));
  }

  const empleados = await resolverEmpleados(filtros, contexto);
  return empleados
    .filter((empleado) => Boolean(empleado.telefono))
    .map((empleado) => ({
      tipo: 'empleado',
      id: empleado.id,
      nombre: `${empleado.nombre} ${empleado.apellido}`.trim(),
      telefono: empleado.telefono,
      email: empleado.email,
      empresa_id: empleado.empresa_id,
      empresa_nombre: empleado.empresa_nombre,
    }));
}

function crearContextoBase(evento, contexto = {}) {
  return {
    evento,
    ...contexto,
    semana_inicio: fechaCorta(contexto.semana_inicio),
    semana_fin: fechaCorta(contexto.semana_fin),
    semana_rango: contexto.semana_rango || (
      contexto.semana_inicio && contexto.semana_fin
        ? `${fechaCorta(contexto.semana_inicio)} al ${fechaCorta(contexto.semana_fin)}`
        : ''
    ),
    pedido_estado_titulo: ESTADO_TITULO[contexto.estado] || 'Tu pedido cambio de estado',
  };
}

function renderTemplate(template, contexto, destinatario = {}) {
  const valores = {
    ...contexto,
    destinatario_nombre: destinatario.nombre || '',
    telefono: destinatario.telefono || '',
  };

  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => (
    valores[key] === undefined || valores[key] === null ? '' : String(valores[key])
  ));
}

function tipoPorEvento(evento, contexto = {}) {
  if (evento === 'menu_publicado') return 'menu';
  if (evento === 'pedido_semanal_pendiente') return 'recordatorio';
  if (evento === 'pedido_estado_cambiado') {
    return contexto.estado === 'listo' || contexto.estado === 'entregado' ? 'confirmado' : 'sistema';
  }
  if (evento === 'nuevo_registro') return 'sistema';
  return 'sistema';
}

function esTablaFaltante(error) {
  return error?.code === '42P01' || error?.code === '42703';
}

function dedupePrefix(evento, regla, contexto = {}) {
  const base = contexto.dedupe_key || contexto.menu_id || contexto.pedido_id || contexto.empleado_id || Date.now();
  return `${evento}:${base}:regla:${regla.id}`;
}

async function dispararEventoInternoLegacy(evento, contexto) {
  if (evento === 'menu_publicado') {
    const destinatarios = await repo.findDestinatarios({ alcance: 'todos' });
    const creadas = await repo.crearParaEmpleados({
      empleadoIds: destinatarios.map((destinatario) => destinatario.id),
      tipo: 'menu',
      titulo: 'Menu semanal publicado',
      cuerpo: `Ya podes ver el menu de la semana ${contexto.semana_rango} y cargar tu pedido.`,
      dedupeKeyPrefix: contexto.dedupe_key || null,
    });
    return { enviadas: creadas.length, destinatarios: destinatarios.length, legacy: true };
  }

  if (evento === 'pedido_estado_cambiado') {
    const notificacion = await repo.crear({
      empleadoId: contexto.empleado_id,
      tipo: tipoPorEvento(evento, contexto),
      titulo: contexto.pedido_estado_titulo || 'Tu pedido cambio de estado',
      cuerpo: `El pedido de la semana ${contexto.semana_inicio} paso de ${contexto.estado_anterior} a ${contexto.estado}.`,
      dedupeKey: contexto.dedupe_key || null,
    });
    return { enviadas: notificacion ? 1 : 0, destinatarios: contexto.empleado_id ? 1 : 0, legacy: true };
  }

  if (evento === 'nuevo_registro') {
    const notificacion = await repo.crear({
      empleadoId: contexto.empleado_id,
      tipo: 'sistema',
      titulo: 'Bienvenido a La Quinta',
      cuerpo: 'Tu cuenta ya esta lista para ver menus y cargar pedidos.',
      dedupeKey: contexto.dedupe_key || null,
    });
    return { enviadas: notificacion ? 1 : 0, destinatarios: contexto.empleado_id ? 1 : 0, legacy: true };
  }

  return { enviadas: 0, destinatarios: 0, legacy: true };
}

async function enviarWebhookWhatsapp({ config, regla, evento, destinatario, titulo, cuerpo, contexto }) {
  const payload = {
    canal: 'whatsapp',
    evento,
    regla: { id: regla.id, nombre: regla.nombre },
    destinatario,
    mensaje: { titulo, cuerpo },
    contexto,
  };
  const envio = await repo.crearEnvioWhatsapp({
    reglaId: regla.id,
    evento,
    destinatario,
    payload,
  });

  try {
    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    const detalle = {
      ok: response.ok,
      envio_id: envio.id,
      estado: response.ok ? 'enviado' : 'fallido',
      status_code: response.status,
      respuesta: text.slice(0, 1000),
      error: response.ok ? null : `Webhook respondio ${response.status}`,
    };
    await repo.actualizarEnvioWhatsapp(envio.id, {
      estado: detalle.estado,
      statusCode: detalle.status_code,
      respuesta: detalle.respuesta,
      error: detalle.error,
    });
    return detalle;
  } catch (error) {
    const detalle = {
      ok: false,
      envio_id: envio.id,
      estado: 'fallido',
      status_code: null,
      respuesta: null,
      error: error.message,
    };
    await repo.actualizarEnvioWhatsapp(envio.id, {
      estado: detalle.estado,
      error: detalle.error,
    });
    return detalle;
  }
}

async function dispararReglaInterna(regla, evento, contexto) {
  const destinatarios = await resolverEmpleados(regla.filtros || {}, contexto);
  const tipo = tipoPorEvento(evento, contexto);
  const creadas = [];

  for (const destinatario of destinatarios) {
    const titulo = renderTemplate(regla.titulo, contexto, destinatario);
    const cuerpo = renderTemplate(regla.cuerpo, contexto, destinatario);
    const notificacion = await repo.crear({
      empleadoId: destinatario.id,
      tipo,
      titulo,
      cuerpo,
      dedupeKey: `${dedupePrefix(evento, regla, contexto)}:${destinatario.id}`,
    });
    if (notificacion) creadas.push(notificacion);
  }

  return { enviadas: creadas.length, destinatarios: destinatarios.length };
}

async function dispararReglasInternas(evento, contexto) {
  const reglas = await repo.findReglas({ canal: 'interna', evento, soloActivas: true });
  let enviadas = 0;
  let destinatariosTotal = 0;

  for (const regla of reglas) {
    const resultado = await dispararReglaInterna(regla, evento, contexto);
    destinatariosTotal += resultado.destinatarios;
    enviadas += resultado.enviadas;
  }

  return { enviadas, destinatarios: destinatariosTotal };
}

async function getWhatsappConfigActiva() {
  const configRecord = await repo.getConfiguracion(WHATSAPP_CONFIG_KEY);
  const config = configRecord?.valor || { activo: false, webhook_url: '' };
  return config.activo && config.webhook_url ? config : null;
}

async function dispararReglaWhatsapp(regla, evento, contexto, config = null) {
  const configActiva = config || await getWhatsappConfigActiva();
  if (!configActiva) return { enviadas: 0, destinatarios: 0, omitidas: true };

  const destinatarios = await resolverDestinatariosWhatsapp(regla.filtros || {}, contexto);
  let enviadas = 0;

  for (const destinatario of destinatarios) {
    const titulo = renderTemplate(regla.titulo, contexto, destinatario);
    const cuerpo = renderTemplate(regla.cuerpo, contexto, destinatario);
    const resultado = await enviarWebhookWhatsapp({
      config: configActiva,
      regla,
      evento,
      destinatario,
      titulo,
      cuerpo,
      contexto,
    });
    if (resultado.ok) enviadas += 1;
  }

  return { enviadas, destinatarios: destinatarios.length };
}

async function dispararReglasWhatsapp(evento, contexto) {
  const config = await getWhatsappConfigActiva();
  if (!config) return { enviadas: 0, destinatarios: 0, omitidas: true };

  const reglas = await repo.findReglas({ canal: 'whatsapp', evento, soloActivas: true });
  let enviadas = 0;
  let destinatariosTotal = 0;

  for (const regla of reglas) {
    const resultado = await dispararReglaWhatsapp(regla, evento, contexto, config);
    destinatariosTotal += resultado.destinatarios;
    enviadas += resultado.enviadas;
  }

  return { enviadas, destinatarios: destinatariosTotal };
}

export const listarEmpleado = (empleadoId) => repo.findByEmpleado(empleadoId);

export const contarNoLeidas = (empleadoId) => repo.countNoLeidas(empleadoId);

export const marcarLeida = async (id, empleadoId) => {
  const notif = await repo.marcarLeida(id, empleadoId);
  if (!notif) throw ApiError.notFound('Notificacion no encontrada');
  return notif;
};

export const marcarTodasLeidas = (empleadoId) => repo.marcarTodasLeidas(empleadoId);

export const listarAdmin = (filtros) => repo.findAllAdmin({
  limit: Math.min(Number(filtros?.limit || 50), 100),
  offset: Number(filtros?.offset || 0),
  empresaId: filtros?.empresa_id || null,
  empleadoId: filtros?.empleado_id || null,
  tipo: filtros?.tipo || null,
  leida: filtros?.leida === 'true' || filtros?.leida === true
    ? true
    : filtros?.leida === 'false' || filtros?.leida === false
      ? false
      : null,
});

export const enviarDesdeAdmin = async (payload = {}) => {
  const envio = normalizarEnvioAdmin(payload);
  const destinatarios = await repo.findDestinatarios(envio);

  if (destinatarios.length === 0) {
    return { enviadas: 0, destinatarios: 0 };
  }

  const creadas = await repo.crearParaEmpleados({
    empleadoIds: destinatarios.map((destinatario) => destinatario.id),
    tipo: envio.tipo,
    titulo: envio.titulo,
    cuerpo: envio.cuerpo,
  });

  return {
    enviadas: creadas.length,
    destinatarios: destinatarios.length,
  };
};

export const listarReglas = (filtros = {}) => repo.findReglas({
  canal: filtros.canal || null,
  evento: filtros.evento || null,
});

export const crearRegla = (payload = {}) => repo.crearRegla(normalizarRegla(payload));

export const actualizarRegla = async (id, payload = {}) => {
  const regla = await repo.findReglaById(id);
  if (!regla) throw ApiError.notFound('Regla no encontrada');

  const datos = normalizarRegla({
    canal: payload.canal ?? regla.canal,
    evento: payload.evento ?? regla.evento,
    nombre: payload.nombre ?? regla.nombre,
    activo: payload.activo ?? regla.activo,
    filtros: payload.filtros ?? regla.filtros,
    titulo: payload.titulo ?? regla.titulo,
    cuerpo: payload.cuerpo ?? regla.cuerpo,
    programacion: payload.programacion ?? regla.programacion,
  }, false);
  return repo.actualizarRegla(id, datos);
};

export const eliminarRegla = async (id) => {
  const deleted = await repo.eliminarRegla(id);
  if (!deleted) throw ApiError.notFound('Regla no encontrada');
  return deleted;
};

export const getConfigWhatsapp = async () => {
  const record = await repo.getConfiguracion(WHATSAPP_CONFIG_KEY);
  return record?.valor || { activo: false, webhook_url: '' };
};

export const actualizarConfigWhatsapp = async (payload = {}) => {
  const config = normalizarConfigWhatsapp(payload);
  const record = await repo.upsertConfiguracion(WHATSAPP_CONFIG_KEY, config);
  return record.valor;
};

export const listarDestinatariosWhatsapp = () => repo.findDestinatariosWhatsapp();

export const crearDestinatarioWhatsapp = (payload = {}) => {
  const data = normalizarDestinatarioWhatsapp(payload);
  return repo.crearDestinatarioWhatsapp({
    nombre: data.nombre,
    telefono: data.telefono,
    email: data.email,
    empresaId: data.empresa_id,
    activo: data.activo,
  });
};

export const actualizarDestinatarioWhatsapp = async (id, payload = {}) => {
  const actual = await repo.findDestinatarioWhatsappById(id);
  if (!actual) throw ApiError.notFound('Destinatario no encontrado');
  const data = normalizarDestinatarioWhatsapp(payload, true);
  if (Object.keys(data).length === 0) throw ApiError.badRequest('Sin datos para actualizar');
  return repo.actualizarDestinatarioWhatsapp(id, data);
};

export const eliminarDestinatarioWhatsapp = async (id) => {
  const deleted = await repo.eliminarDestinatarioWhatsapp(id);
  if (!deleted) throw ApiError.notFound('Destinatario no encontrado');
  return deleted;
};

export const listarEnviosWhatsapp = (filtros = {}) => repo.findEnviosWhatsapp({
  limit: Math.min(Number(filtros.limit || 50), 100),
  offset: Number(filtros.offset || 0),
});

export const probarWebhookWhatsapp = async (payload = {}) => {
  const config = await getConfigWhatsapp();
  if (!config.activo || !config.webhook_url) {
    throw ApiError.badRequest('Configura y activa el webhook de n8n antes de probar');
  }

  const destinatario = {
    tipo: 'prueba',
    id: null,
    nombre: normalizarTexto(payload.nombre || 'Prueba La Quinta', 'nombre', 160),
    telefono: normalizarTexto(payload.telefono, 'telefono', 40),
    email: null,
    empresa_id: null,
    empresa_nombre: null,
  };
  const contexto = crearContextoBase('manual', { prueba: true });
  const regla = { id: null, nombre: 'Prueba manual de webhook' };
  const titulo = normalizarTexto(payload.titulo || 'Prueba de WhatsApp', 'titulo', 160);
  const cuerpo = normalizarTexto(payload.cuerpo || 'Mensaje de prueba desde La Quinta.', 'cuerpo', 900);
  const resultado = await enviarWebhookWhatsapp({ config, regla, evento: 'manual', destinatario, titulo, cuerpo, contexto });
  return {
    enviado: resultado.ok,
    envio_id: resultado.envio_id,
    estado: resultado.estado,
    status_code: resultado.status_code,
    respuesta: resultado.respuesta,
    error: resultado.error,
  };
};

export const dispararEvento = async (evento, contexto = {}) => {
  if (!EVENTOS.includes(evento) || evento === 'manual') {
    throw ApiError.badRequest('Evento automatico invalido');
  }

  const contextoBase = crearContextoBase(evento, contexto);
  let internas;
  let whatsapp;

  try {
    internas = await dispararReglasInternas(evento, contextoBase);
  } catch (error) {
    if (!esTablaFaltante(error)) throw error;
    internas = await dispararEventoInternoLegacy(evento, contextoBase);
  }

  try {
    whatsapp = await dispararReglasWhatsapp(evento, contextoBase);
  } catch (error) {
    if (!esTablaFaltante(error)) throw error;
    whatsapp = { enviadas: 0, destinatarios: 0, omitidas: true, legacy: true };
  }

  return { internas, whatsapp };
};

export const listarReglasProgramadasActivas = async () => {
  const reglas = await repo.findReglas({
    evento: 'pedido_semanal_pendiente',
    soloActivas: true,
  });
  return reglas.filter((regla) => regla.programacion?.tipo === 'semanal');
};

export const ejecutarReglaProgramada = async ({ regla, runKey }) => {
  if (!regla?.id) throw ApiError.badRequest('regla requerida');
  if (regla.evento !== 'pedido_semanal_pendiente') {
    throw ApiError.badRequest('Solo se pueden ejecutar reglas programadas de pedido_semanal_pendiente');
  }

  const ejecucion = await repo.crearEjecucionProgramada({ reglaId: regla.id, runKey });
  if (!ejecucion) return { omitida: true, motivo: 'ya_ejecutada' };

  try {
    const semana = await repo.findSemanaPublicadaObjetivo();
    if (!semana) {
      const resultado = { enviadas: 0, destinatarios: 0, motivo: 'sin_menu_publicado' };
      await repo.finalizarEjecucionProgramada(ejecucion.id, { estado: 'omitida', resultado });
      return resultado;
    }

    const pendientes = await repo.findEmpleadosSinPedidoSemanal(fechaCorta(semana.fecha_inicio));
    const contexto = crearContextoBase('pedido_semanal_pendiente', {
      menu_id: semana.id,
      menu_nombre: semana.nombre,
      semana_inicio: semana.fecha_inicio,
      semana_fin: semana.fecha_fin,
      semana_rango: `${fechaCorta(semana.fecha_inicio)} al ${fechaCorta(semana.fecha_fin)}`,
      empleado_ids_permitidos: pendientes.map((empleado) => empleado.id),
      empleados_pendientes: pendientes.length,
      dedupe_key: `pedido-semanal-pendiente:${fechaCorta(semana.fecha_inicio)}:${runKey}`,
    });

    const resultado = regla.canal === 'whatsapp'
      ? await dispararReglaWhatsapp(regla, 'pedido_semanal_pendiente', contexto)
      : await dispararReglaInterna(regla, 'pedido_semanal_pendiente', contexto);

    await repo.finalizarEjecucionProgramada(ejecucion.id, { estado: 'completada', resultado });
    return resultado;
  } catch (error) {
    await repo.finalizarEjecucionProgramada(ejecucion.id, {
      estado: 'fallida',
      error: error.message,
    });
    throw error;
  }
};

export const notificarMenuPublicado = async (menu) => dispararEvento('menu_publicado', {
  menu_id: menu.id,
  menu_nombre: menu.nombre,
  semana_inicio: menu.fecha_inicio,
  semana_fin: menu.fecha_fin,
  semana_rango: `${fechaCorta(menu.fecha_inicio)} al ${fechaCorta(menu.fecha_fin)}`,
  dedupe_key: `menu-publicado:${menu.id}`,
});

export const notificarCambioEstadoPedido = async ({ pedido, estadoAnterior }) => {
  if (!pedido?.empleado_id || pedido.estado === estadoAnterior) return null;
  return dispararEvento('pedido_estado_cambiado', {
    pedido_id: pedido.id,
    empleado_id: pedido.empleado_id,
    semana_inicio: pedido.semana_inicio,
    estado_anterior: estadoAnterior,
    estado: pedido.estado,
    pedido_estado_titulo: ESTADO_TITULO[pedido.estado] || 'Tu pedido cambio de estado',
    dedupe_key: `pedido-estado:${pedido.id}:${pedido.estado}`,
  });
};

export const notificarNuevoRegistro = async ({ empleado, empresa }) => dispararEvento('nuevo_registro', {
  empleado_id: empleado.id,
  nombre: empleado.nombre,
  apellido: empleado.apellido,
  email: empleado.email,
  telefono: empleado.telefono,
  empresa_id: empresa.id,
  empresa_nombre: empresa.nombre,
  dedupe_key: `nuevo-registro:${empleado.id}`,
});
