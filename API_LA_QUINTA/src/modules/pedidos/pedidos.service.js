import * as repo from './pedidos.repository.js';
import * as empresasRepo from '../empresas/empresas.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getClient } from '../../database/connection.js';
import { validarPedidoInput } from './pedidos.validation.js';

const ESTADOS = ['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado'];
const DIAS_LABORALES = {
  lunes_viernes: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
  lunes_sabado: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
  lunes_domingo: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
};

// Índice de día en la semana (lunes=0 ... domingo=6)
const DIA_IDX = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };

/**
 * Dado un lunes de semana (YYYY-MM-DD) y un nombre de día, devuelve la Date de ese día.
 */
function fechaDeDia(semanaInicio, dia) {
  const base = new Date(semanaInicio + 'T00:00:00');
  base.setDate(base.getDate() + DIA_IDX[dia]);
  return base;
}

/**
 * Verifica si el momento actual está dentro del límite configurado para la empresa.
 * Devuelve null si está OK, o un string con el mensaje de error.
 */
function verificarLimiteEmpresa(empresa, semanaInicio, diasPedidos) {
  // Override activo: admin reabrió el plazo temporalmente
  if (empresa.plazo_override_hasta && new Date() <= new Date(empresa.plazo_override_hasta)) {
    return null;
  }

  const { modo_pedido, limite_dia_semana, limite_anticipacion_dias } = empresa;
  let limite_hora = empresa.limite_hora ? String(empresa.limite_hora).slice(0, 5) : null;
  // Default: semanal sin hora configurada → lunes 09:30
  if (!limite_hora && (modo_pedido === 'semanal' || modo_pedido === 'ambos')) {
    limite_hora = '09:30';
  }
  if (!limite_hora) return null;

  const ahora = new Date();
  const [hh, mm] = limite_hora.split(':').map(Number);

  if (modo_pedido === 'semanal' || modo_pedido === 'ambos') {
    // Límite semanal: hasta cierto día de la semana a cierta hora
    const diaCorte = limite_dia_semana || 'lunes';
    const fechaCorte = fechaDeDia(semanaInicio, diaCorte);
    fechaCorte.setHours(hh, mm, 0, 0);
    if (ahora > fechaCorte) {
      const diaLabel = diaCorte.charAt(0).toUpperCase() + diaCorte.slice(1);
      return `El plazo para pedir la semana completa venció el ${diaLabel} a las ${limite_hora}hs.`;
    }
  }

  if (modo_pedido === 'diario' || modo_pedido === 'ambos') {
    // Límite diario: para cada día pedido, verificar que no haya pasado el corte
    const anticipacion = limite_anticipacion_dias ?? 0;
    for (const dia of diasPedidos) {
      const fechaDia = fechaDeDia(semanaInicio, dia);
      // El corte es anticipacion días ANTES del día pedido, a la hora indicada
      const fechaCorte = new Date(fechaDia);
      fechaCorte.setDate(fechaCorte.getDate() - anticipacion);
      fechaCorte.setHours(hh, mm, 0, 0);
      if (ahora > fechaCorte) {
        const diaLabel = dia.charAt(0).toUpperCase() + dia.slice(1);
        const cuando = anticipacion === 0
          ? `el mismo ${diaLabel} a las ${limite_hora}hs`
          : `el día anterior a las ${limite_hora}hs`;
        return `El plazo para pedir el ${diaLabel} venció (límite: ${cuando}).`;
      }
    }
  }

  return null;
}

export const getMenuHoy = () => repo.menuHoy();

export const getMenuSemana = (semanaInicio) => {
  if (!semanaInicio) throw ApiError.badRequest('fecha_inicio es requerido');
  return repo.menuSemana(semanaInicio);
};

export const getMenuActivo = async (empresaId = null) => {
  const menus = await repo.menusPublicadosList();
  const ahora = new Date();

  let empresa = null;
  if (empresaId) empresa = await empresasRepo.findById(empresaId);

  const menus_disponibles = menus.map(menu => {
    if (menu.fecha_limite_pedidos && new Date(menu.fecha_limite_pedidos) < ahora) {
      return { disponible: false, cerrado: true, mensaje: 'El período de pedidos para esta semana ya cerró.', menu };
    }

    let limiteEmpresa = null;
    if (empresa) {
      const fechaStr = menu.fecha_inicio instanceof Date
        ? menu.fecha_inicio.toISOString().split('T')[0]
        : String(menu.fecha_inicio).split('T')[0];
      limiteEmpresa = construirInfoLimite(empresa, fechaStr);
    }

    return {
      disponible: true,
      menu,
      limiteEmpresa,
      dias_laborales: empresa?.dias_laborales ?? 'lunes_viernes',
    };
  });

  return { menus_disponibles };
};

/**
 * Devuelve un objeto legible con la configuración de límite de la empresa
 * para mostrarla en el frontend del cliente.
 */
function construirInfoLimite(empresa, semanaInicio) {
  // Override activo: mostrar al cliente que el plazo fue reabierto
  if (empresa.plazo_override_hasta && new Date() <= new Date(empresa.plazo_override_hasta)) {
    const hasta = new Date(empresa.plazo_override_hasta);
    const hh = hasta.getHours().toString().padStart(2, '0');
    const mm = hasta.getMinutes().toString().padStart(2, '0');
    return {
      tipo: 'override',
      texto: `Pedido habilitado hasta las ${hh}:${mm}hs (apertura especial).`,
      vencido: false,
      fechaCorte: empresa.plazo_override_hasta,
    };
  }

  const { modo_pedido, limite_dia_semana, limite_anticipacion_dias } = empresa;
  let limite_hora = empresa.limite_hora ? String(empresa.limite_hora).slice(0, 5) : null;
  // Default: semanal sin hora configurada → lunes 09:30
  if (!limite_hora && (modo_pedido === 'semanal' || modo_pedido === 'ambos')) {
    limite_hora = '09:30';
  }
  if (!limite_hora) return null;

  let fechaCorteSemanal = null;
  let semanalVencido = false;
  if (modo_pedido === 'semanal' || modo_pedido === 'ambos') {
    const diaCorte = limite_dia_semana || 'lunes';
    fechaCorteSemanal = semanaInicio ? fechaDeDia(semanaInicio, diaCorte) : null;
    if (fechaCorteSemanal) {
      fechaCorteSemanal.setHours(...limite_hora.split(':').map(Number), 0, 0);
      semanalVencido = new Date() > fechaCorteSemanal;
    }
  }

  const diasCerrados = [];
  if (modo_pedido === 'diario' || modo_pedido === 'ambos') {
    const anticipacion = limite_anticipacion_dias ?? 0;
    const dias = DIAS_LABORALES[empresa.dias_laborales] ?? DIAS_LABORALES.lunes_viernes;
    const [hh, mm] = limite_hora.split(':').map(Number);
    for (const dia of dias) {
      const corte = fechaDeDia(semanaInicio, dia);
      corte.setDate(corte.getDate() - anticipacion);
      corte.setHours(hh, mm, 0, 0);
      if (new Date() > corte) diasCerrados.push(dia);
    }
  }

  if (modo_pedido === 'semanal') {
    const diaCorte = limite_dia_semana || 'lunes';
    return {
      tipo: 'semanal',
      texto: `Pedido semanal. Límite: ${diaCorte} a las ${limite_hora}hs.`,
      vencido: semanalVencido,
      fechaCorte: fechaCorteSemanal?.toISOString() ?? null,
      diasCerrados: semanalVencido
        ? (DIAS_LABORALES[empresa.dias_laborales] ?? DIAS_LABORALES.lunes_viernes)
        : [],
    };
  }

  if (modo_pedido === 'diario') {
    const anticipacion = limite_anticipacion_dias ?? 0;
    const cuando = anticipacion === 0
      ? `el mismo día hasta las ${limite_hora}hs`
      : `el día anterior hasta las ${limite_hora}hs`;
    return {
      tipo: 'diario',
      texto: `Pedido diario. Límite: ${cuando}.`,
      vencido: false,
      anticipacion_dias: anticipacion,
      hora: limite_hora,
      diasCerrados,
    };
  }

  const diaCorte = limite_dia_semana || 'lunes';
  return {
    tipo: 'ambos',
    texto: `Pedido semanal hasta ${diaCorte} ${limite_hora}hs y corte diario a las ${limite_hora}hs.`,
    vencido: semanalVencido,
    fechaCorte: fechaCorteSemanal?.toISOString() ?? null,
    anticipacion_dias: limite_anticipacion_dias ?? 0,
    hora: limite_hora,
    diasCerrados: semanalVencido
      ? (DIAS_LABORALES[empresa.dias_laborales] ?? DIAS_LABORALES.lunes_viernes)
      : diasCerrados,
  };
}

export const getPedidos = (filters) => repo.findAll(filters);

export const getMiPedido = (empleadoId, semanaInicio) => {
  if (!semanaInicio) throw ApiError.badRequest('semana_inicio es requerido');
  return repo.findPedidoByEmpleadoSemana(empleadoId, semanaInicio);
};

export const guardarPedido = async (empleadoId, empresaId, { semana_inicio, menu_semanal_id, items, observaciones }) => {
  const diasUnicos = validarPedidoInput({ semana_inicio, menu_semanal_id, items });

  const menuActivo = await repo.menuActivoPorId(menu_semanal_id);
  if (!menuActivo) throw ApiError.conflict('El menú indicado no existe o no está publicado.');
  const inicioActivo = menuActivo.fecha_inicio instanceof Date
    ? menuActivo.fecha_inicio.toISOString().split('T')[0]
    : String(menuActivo.fecha_inicio).split('T')[0];
  if (inicioActivo !== semana_inicio) {
    throw ApiError.conflict('La semana indicada no coincide con el menú seleccionado.');
  }
  if (menuActivo.fecha_limite_pedidos && new Date(menuActivo.fecha_limite_pedidos) < new Date()) {
    throw ApiError.conflict('El período de pedidos ya cerró para esta semana.');
  }

  // Validar límite por empresa
  const empresa = await empresasRepo.findById(empresaId);
  if (empresa) {
    const diasPermitidos = DIAS_LABORALES[empresa.dias_laborales] ?? DIAS_LABORALES.lunes_viernes;
    const diaFueraDeJornada = items.find((item) => !diasPermitidos.includes(item.dia));
    if (diaFueraDeJornada) {
      throw ApiError.badRequest(`El ${diaFueraDeJornada.dia} no es un día laboral para tu empresa`);
    }
    const diasPedidos = items.map(i => i.dia);
    const error = verificarLimiteEmpresa(empresa, semana_inicio, diasPedidos);
    if (error) throw ApiError.conflict(error);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (const item of items) {
      const plato = await repo.validateItemForMenu(menuActivo.id, item, client);
      if (!plato || !plato.activo) {
        throw ApiError.badRequest(`El plato del ${item.dia} no existe o está inactivo`);
      }
      if (plato.sin_servicio) {
        throw ApiError.conflict(`El ${item.dia} está marcado como día sin servicio`);
      }
      if (plato.tipo !== 'fijo' && !plato.pertenece_menu) {
        throw ApiError.badRequest(`El plato "${plato.nombre}" no corresponde al ${item.dia} y opción indicados`);
      }
      if (plato.tipo === 'fijo' && item.opcion) {
        throw ApiError.badRequest(`Los platos fijos no deben indicar opción (${item.dia})`);
      }
      if (plato.tipo !== 'fijo' && !item.opcion) {
        throw ApiError.badRequest(`La opción es requerida para el plato del ${item.dia}`);
      }
      if (item.guarnicion_id && !plato.tiene_guarnicion) {
        throw ApiError.badRequest(`El plato "${plato.nombre}" no admite guarnición`);
      }
      if (!plato.guarnicion_valida) {
        throw ApiError.badRequest(`La guarnición del ${item.dia} no existe o está inactiva`);
      }
    }

    const pedido = await repo.upsertPedido({
      empleado_id: empleadoId,
      empresa_id: empresaId,
      menu_semanal_id,
      semana_inicio,
      observaciones,
    }, client);

    await repo.deleteItemsNotInDays(pedido.id, [...diasUnicos], client);
    const itemsGuardados = [];
    for (const item of items) {
      itemsGuardados.push(await repo.upsertItem(pedido.id, item, client));
    }

    await client.query('COMMIT');
    return { ...pedido, items: itemsGuardados };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getMiHistorial = (empleadoId) => repo.findHistorialByEmpleado(empleadoId);

export const cancelarMiPedido = async (empleadoId, semanaInicio) => {
  if (!semanaInicio) throw ApiError.badRequest('semana_inicio es requerido');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const pedido = await repo.cancelarPedidoByEmpleado(empleadoId, semanaInicio, client);
    if (!pedido) {
      throw ApiError.conflict('El pedido no existe o ya no se puede cancelar');
    }
    await client.query('COMMIT');
    return pedido;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const cambiarEstado = async (id, estado) => {
  if (!ESTADOS.includes(estado)) throw ApiError.badRequest(`Estado inválido. Opciones: ${ESTADOS.join(', ')}`);
  const pedido = await repo.updateEstado(id, estado);
  if (!pedido) throw ApiError.notFound(`Pedido ${id} no encontrado`);
  return pedido;
};
