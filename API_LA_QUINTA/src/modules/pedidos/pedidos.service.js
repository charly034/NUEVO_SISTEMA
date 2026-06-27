import * as repo from './pedidos.repository.js';
import * as empresasRepo from '../empresas/empresas.repository.js';
import * as guarnicionesRepo from '../guarniciones/guarniciones.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getClient } from '../../database/connection.js';
import { validarPedidoInput } from './pedidos.validation.js';

const ESTADOS = ['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado'];
const DIAS_LABORALES = {
  lunes_viernes: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
  lunes_sabado: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
  lunes_domingo: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
};
const DIAS_LABEL = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miercoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sabado',
  domingo: 'Domingo',
};


// Índice de día en la semana (lunes=0 ... domingo=6)
const DIA_IDX = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };

function fechaISO(fecha) {
  if (fecha instanceof Date) return fecha.toISOString().split('T')[0];
  return String(fecha || '').split('T')[0];
}

function aISO(fecha) {
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDias(fecha, dias) {
  const base = new Date(`${fechaISO(fecha)}T00:00:00`);
  base.setDate(base.getDate() + dias);
  return aISO(base);
}

function lunesDeSemana(fechaReferencia = new Date()) {
  const fecha = new Date(fechaReferencia);
  fecha.setHours(0, 0, 0, 0);
  const dia = fecha.getDay();
  fecha.setDate(fecha.getDate() + (dia === 0 ? -6 : 1 - dia));
  return aISO(fecha);
}

function fechaCorta(fecha) {
  const [anio, mes, dia] = fechaISO(fecha).split('-');
  void anio;
  return `${dia}/${mes}`;
}

function obtenerTipoSemana(semanaInicio, semanaActual) {
  if (semanaInicio === semanaActual) return 'actual';
  return semanaInicio < semanaActual ? 'anterior' : 'proxima';
}

function obtenerEtiquetaSemana(tipo) {
  if (tipo === 'actual') return 'Semana actual';
  if (tipo === 'proxima') return 'Semana proxima';
  return 'Semana anterior';
}

function obtenerDiasPorDefectoSinPedido(empresa) {
  return empresa?.dias_laborales === 'lunes_domingo' ? ['sabado', 'domingo'] : [];
}

function normalizarGuarniciones(guarniciones) {
  return guarniciones.map((guarnicion) => ({
    id: guarnicion.id,
    nombre: guarnicion.nombre,
    tipo: guarnicion.tipo || null,
  }));
}

function crearEtiquetasPlato(plato, extra = []) {
  const tags = Array.isArray(plato.tags)
    ? plato.tags
    : String(plato.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

  return [
    ...extra,
    ...tags,
    plato.tiene_guarnicion ? 'Requiere guarnicion' : 'Plato completo',
  ].filter(Boolean);
}

function mapearPlatoEspecial(plato, guarniciones) {
  return {
    id: `menu-${plato.plato_id}-${plato.dia}-${plato.opcion || 'sin-opcion'}`,
    platoId: plato.plato_id,
    opcion: plato.opcion || null,
    nombre: plato.plato_nombre,
    descripcion: plato.descripcion || 'Menu publicado',
    categoria: 'menu',
    tipo: plato.tiene_guarnicion ? 'principal_con_guarnicion' : 'plato_completo',
    requiereGuarnicion: Boolean(plato.tiene_guarnicion),
    destacado: true,
    grupo: 'especiales',
    estado: 'disponible',
    etiquetas: crearEtiquetasPlato(plato, [`Opcion ${plato.opcion || ''}`.trim()]),
    guarniciones: plato.tiene_guarnicion ? guarniciones : [],
  };
}

function mapearPlatoFijo(plato, guarniciones) {
  return {
    id: `fijo-${plato.plato_id}`,
    platoId: plato.plato_id,
    opcion: null,
    nombre: plato.plato_nombre,
    descripcion: plato.descripcion || 'Plato fijo',
    categoria: 'fijo',
    tipo: plato.tiene_guarnicion ? 'principal_con_guarnicion' : 'plato_completo',
    requiereGuarnicion: Boolean(plato.tiene_guarnicion),
    destacado: false,
    grupo: 'fijos',
    estado: 'disponible',
    etiquetas: crearEtiquetasPlato(plato, ['Fijo']),
    guarniciones: plato.tiene_guarnicion ? guarniciones : [],
    diasDisponibles: plato.dias_disponibles || null,
  };
}

function obtenerEstadoSemana({ menuSemana, semanaInicio, pedidoVisible }) {
  if (pedidoVisible) return 'confirmado';
  if (!menuSemana?.menu?.id) return semanaInicio > lunesDeSemana() ? 'sin_menu' : 'sin_pedido';
  if (menuSemana.cerrado || menuSemana.limiteEmpresa?.vencido) return 'cerrado';
  return 'sin_pedido';
}

function construirTextoItem(item) {
  if (!item?.plato_nombre) return null;
  return item.guarnicion_nombre
    ? `${item.plato_nombre} con ${String(item.guarnicion_nombre).toLowerCase()}`
    : item.plato_nombre;
}

function construirSeleccionItem(item, opciones) {
  if (!item) return null;
  const plato = opciones.find(
    (opcion) =>
      Number(opcion.platoId) === Number(item.plato_id) &&
      String(opcion.opcion || '') === String(item.opcion || ''),
  );
  if (!plato) return null;

  return {
    plato,
    guarnicion: item.guarnicion_id
      ? { id: item.guarnicion_id, nombre: item.guarnicion_nombre }
      : '',
    platoId: plato.platoId,
    nombrePlato: plato.nombre,
    guarnicionId: item.guarnicion_id || null,
    nombreGuarnicion: item.guarnicion_nombre || '',
    sinPedido: false,
  };
}

function crearSugerenciasSemana(diasPedido) {
  const sugerenciasBase = [
    'Milanesa con pure de papas',
    'Tarta de verduras con ensalada',
    'Wok de pollo con arroz',
    'Ravioles con salsa fileto',
    'Hamburguesa casera con vegetales',
    'Pastel de papa',
    'Pollo al horno con calabaza',
  ];

  return diasPedido.slice(0, 3).map((dia, indice) => ({
    dia: DIAS_LABEL[dia] || dia,
    plato: sugerenciasBase[indice % sugerenciasBase.length],
  }));
}

/**
 * Dado un lunes de semana (YYYY-MM-DD) y un nombre de día, devuelve la Date de ese día.
 */
function fechaDeDia(semanaInicio, dia) {
  const base = new Date(`${fechaISO(semanaInicio)}T00:00:00`);
  base.setDate(base.getDate() + (DIA_IDX[dia] ?? 0));
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
    if (menu.fecha_fin && new Date(menu.fecha_fin) < ahora) {
      return { disponible: false, cerrado: true, mensaje: 'Esta semana ya finalizó.', menu };
    }

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

export const getSemanasPedido = async ({ empleadoId, empresaId, fechaReferencia = new Date() }) => {
  if (!empresaId) throw ApiError.badRequest('empresaId es requerido');

  const [empresa, menus, historial, guarnicionesActivas] = await Promise.all([
    empresasRepo.findById(empresaId),
    repo.menusPublicadosList(),
    empleadoId ? repo.findHistorialByEmpleado(empleadoId, 24) : Promise.resolve([]),
    guarnicionesRepo.findAll(true),
  ]);

  if (!empresa) throw ApiError.notFound(`Empresa ${empresaId} no encontrada`);

  const diasPedido = DIAS_LABORALES[empresa.dias_laborales] ?? DIAS_LABORALES.lunes_viernes;
  const diasPorDefectoSinPedido = obtenerDiasPorDefectoSinPedido(empresa);
  const guarniciones = normalizarGuarniciones(guarnicionesActivas);
  const semanaActual = lunesDeSemana(fechaReferencia);
  const menusPorSemana = new Map(menus.map((menu) => {
    const semanaInicio = fechaISO(menu.fecha_inicio);
    return [
      semanaInicio,
      {
        disponible: true,
        menu,
        limiteEmpresa: construirInfoLimite(empresa, semanaInicio),
        dias_laborales: empresa.dias_laborales,
      },
    ];
  }));
  const pedidosPorSemana = new Map(
    historial
      .filter((pedido) => pedido.estado !== 'cancelado')
      .map((pedido) => [fechaISO(pedido.semana_inicio), pedido]),
  );
  const fechas = new Set([...menusPorSemana.keys(), ...pedidosPorSemana.keys()]);

  if (fechas.size === 0) fechas.add(semanaActual);
  if (![...fechas].some((fecha) => fecha >= semanaActual)) fechas.add(semanaActual);
  fechas.add(addDias([...fechas].sort().at(-1) || semanaActual, 7));

  const semanas = [...fechas].sort().map((semanaInicio) => {
    const menuSemana = menusPorSemana.get(semanaInicio) || {
      disponible: false,
      menu: {
        fecha_inicio: semanaInicio,
        fecha_fin: addDias(semanaInicio, Math.max(diasPedido.length - 1, 0)),
        sin_servicio: [],
      },
      dias_laborales: empresa.dias_laborales,
    };
    const pedidoVisible = pedidosPorSemana.get(semanaInicio) || null;
    const tipo = obtenerTipoSemana(semanaInicio, semanaActual);
    const estado = obtenerEstadoSemana({ menuSemana, semanaInicio, pedidoVisible });
    const fechaFin = addDias(semanaInicio, Math.max(diasPedido.length - 1, 0));
    const tieneMenuPublicado = Boolean(menuSemana?.menu?.id);
    const esSemanaSugerencias = !tieneMenuPublicado && semanaInicio > semanaActual;
    const itemsPorDia = new Map((pedidoVisible?.items || []).map((item) => [item.dia, item]));
    const sinServicioPorDia = new Map((menuSemana.menu?.sin_servicio || []).map((item) => [item.dia, item.motivo]));

    return {
      id: semanaInicio,
      etiqueta: obtenerEtiquetaSemana(tipo),
      tipo,
      fechaDesde: semanaInicio,
      fechaHasta: fechaFin,
      rango: `${fechaCorta(semanaInicio)} al ${fechaCorta(fechaFin)}`,
      titulo: `Semana del lunes ${fechaCorta(semanaInicio)}`,
      estado,
      tipoPlan: empresa.modo_pedido || 'semanal',
      modalidad: empresa.modo_pedido || 'semanal',
      limiteModificacion: {
        dia: empresa.limite_dia_semana || 'lunes',
        hora: empresa.limite_hora ? String(empresa.limite_hora).slice(0, 5) : '09:30',
      },
      diasSeleccionados: pedidoVisible?.items?.length || 0,
      editable: ['sin_pedido', 'pendiente', 'confirmado'].includes(estado),
      sugerencias: esSemanaSugerencias ? crearSugerenciasSemana(diasPedido) : [],
      dias: diasPedido.map((dia, indice) => {
        const item = itemsPorDia.get(dia);
        const especiales = (menuSemana.menu?.variables || [])
          .filter((plato) => plato.dia === dia)
          .map((plato) => mapearPlatoEspecial(plato, guarniciones));
        const fijos = (menuSemana.menu?.fijos || []).map((plato) => mapearPlatoFijo(plato, guarniciones));
        const opciones = [...especiales, ...fijos];
        const motivoSinServicio = sinServicioPorDia.get(dia);
        const sinPedidoPorDefecto = !item && diasPorDefectoSinPedido.includes(dia);
        const seleccion = construirSeleccionItem(item, opciones);
        const sinMenuEspecial = !motivoSinServicio && especiales.length === 0 && fijos.length > 0;

        return {
          id: dia,
          clave: dia,
          dia: DIAS_LABEL[dia] || dia,
          fecha: addDias(semanaInicio, indice),
          estado: motivoSinServicio
            ? 'sin_servicio'
            : sinPedidoPorDefecto
              ? 'sin_pedido_por_defecto'
              : seleccion
                ? 'seleccionado'
                : sinMenuEspecial
                  ? 'sin_menu'
                  : 'sin_seleccionar',
          bloqueado: Boolean(motivoSinServicio),
          motivo: motivoSinServicio ? `No hay servicio este dia: ${motivoSinServicio}` : null,
          mensajeMenu: sinMenuEspecial
            ? 'Todavia no hay menu especial para este dia. Podes elegir un plato fijo.'
            : null,
          plato: seleccion
            ? construirTextoItem(item)
            : sinPedidoPorDefecto
              ? 'Sin pedido por defecto'
              : motivoSinServicio
                ? `Sin servicio: ${motivoSinServicio}`
                : 'Sin seleccionar',
          seleccion: seleccion || null,
          especiales,
          fijos,
          opciones,
          regla: empresa.modo_pedido === 'diario' ? 'diario' : 'semanal',
        };
      }),
      metadata: {
        pedidoId: pedidoVisible?.id || null,
        pedido: pedidoVisible,
        cantidadDias: diasPedido.length,
        diasPedido,
        diasPorDefectoSinPedido,
        tieneMenuPublicado,
        esSemanaSugerencias,
        menuSemana,
      },
    };
  });

  return {
    empresa: {
      id: empresa.id,
      nombre: empresa.nombre,
      diasLaborales: empresa.dias_laborales,
      diasPedido,
      diasPorDefectoSinPedido,
    },
    semanas,
  };
};

export const getOpcionesMenuSemana = async ({ empresaId, semanaId }) => {
  if (!semanaId) throw ApiError.badRequest('semanaId es requerido');
  if (!empresaId) throw ApiError.badRequest('empresaId es requerido');

  const [empresa, menus, guarnicionesActivas] = await Promise.all([
    empresasRepo.findById(empresaId),
    repo.menusPublicadosList(),
    guarnicionesRepo.findAll(true),
  ]);

  if (!empresa) throw ApiError.notFound(`Empresa ${empresaId} no encontrada`);

  const diasPedido = DIAS_LABORALES[empresa.dias_laborales] ?? DIAS_LABORALES.lunes_viernes;
  const menu = menus.find((item) =>
    String(item.id) === String(semanaId) ||
    fechaISO(item.fecha_inicio) === fechaISO(semanaId),
  );
  const guarniciones = normalizarGuarniciones(guarnicionesActivas);

  return {
    semanaId,
    dias: diasPedido.map((dia, indice) => {
      const motivoSinServicio = (menu?.sin_servicio || [])
        .find((item) => item.dia === dia)?.motivo || null;
      const especiales = motivoSinServicio
        ? []
        : (menu?.variables || [])
          .filter((plato) => plato.dia === dia)
          .map((plato) => mapearPlatoEspecial(plato, guarniciones));
      const fijos = motivoSinServicio
        ? []
        : (menu?.fijos || []).map((plato) => mapearPlatoFijo(plato, guarniciones));
      const sinMenuEspecial = !motivoSinServicio && especiales.length === 0 && fijos.length > 0;

      return {
        diaId: dia,
        fecha: menu?.fecha_inicio ? addDias(menu.fecha_inicio, indice) : null,
        estadoMenu: motivoSinServicio
          ? 'sin_servicio'
          : especiales.length > 0
            ? 'con_menu_especial'
            : sinMenuEspecial
              ? 'sin_menu_especial'
              : 'sin_menu',
        mensaje: motivoSinServicio
          ? `No hay servicio este dia: ${motivoSinServicio}`
          : sinMenuEspecial
            ? 'Todavia no hay menu especial para este dia. Podes elegir un plato fijo.'
            : null,
        sinServicio: Boolean(motivoSinServicio),
        motivoSinServicio,
        especiales,
        fijos,
        opciones: [...especiales, ...fijos],
      };
    }),
  };
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

export const getPedidoById = async (id) => {
  const pedido = await repo.findById(id);
  if (!pedido) throw ApiError.notFound(`Pedido con id ${id} no encontrado`);
  return pedido;
};

export const getMiPedido = (empleadoId, semanaInicio) => {
  if (!semanaInicio) throw ApiError.badRequest('semana_inicio es requerido');
  return repo.findPedidoByEmpleadoSemana(empleadoId, semanaInicio);
};

export const guardarPedido = async (empleadoId, empresaId, { semana_inicio, menu_semanal_id, items, observaciones }, actor = {}) => {
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
    const pedidoPrevio = await repo.findPedidoByEmpleadoSemana(empleadoId, semana_inicio, client);

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
    await repo.registrarEvento({
      pedido_id: pedido.id,
      tipo: pedidoPrevio ? 'pedido_actualizado' : 'pedido_creado',
      actor_tipo: actor.actor_tipo || 'empleado',
      actor_id: actor.actor_id || empleadoId,
      actor_nombre: actor.actor_nombre || null,
      estado_anterior: pedidoPrevio?.estado || null,
      estado_nuevo: pedido.estado,
      resumen: pedidoPrevio
        ? `Pedido actualizado (${itemsGuardados.length} día${itemsGuardados.length !== 1 ? 's' : ''})`
        : `Pedido creado (${itemsGuardados.length} día${itemsGuardados.length !== 1 ? 's' : ''})`,
      metadata: {
        dias: itemsGuardados.map(item => item.dia),
        total_items: itemsGuardados.length,
      },
    }, client);

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

export const cancelarMiPedido = async (empleadoId, semanaInicio, actor = {}) => {
  if (!semanaInicio) throw ApiError.badRequest('semana_inicio es requerido');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const pedido = await repo.cancelarPedidoByEmpleado(empleadoId, semanaInicio, client);
    if (!pedido) {
      throw ApiError.conflict('El pedido no existe o ya no se puede cancelar');
    }
    await repo.registrarEvento({
      pedido_id: pedido.id,
      tipo: 'pedido_cancelado',
      actor_tipo: actor.actor_tipo || 'empleado',
      actor_id: actor.actor_id || empleadoId,
      actor_nombre: actor.actor_nombre || null,
      estado_anterior: pedido.estado_anterior || null,
      estado_nuevo: pedido.estado,
      resumen: 'Pedido cancelado por el usuario',
      metadata: { semana_inicio: pedido.semana_inicio },
    }, client);
    await client.query('COMMIT');
    return pedido;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const cambiarEstado = async (id, estado, actor = {}) => {
  if (!ESTADOS.includes(estado)) throw ApiError.badRequest(`Estado invalido. Opciones: ${ESTADOS.join(', ')}`);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const anterior = await repo.findPedidoCabeceraById(id, client);
    if (!anterior) throw ApiError.notFound(`Pedido ${id} no encontrado`);

    const pedido = await repo.updateEstado(id, estado, client);
    await repo.registrarEvento({
      pedido_id: pedido.id,
      tipo: 'estado_cambiado',
      actor_tipo: actor.actor_tipo || 'admin',
      actor_id: actor.actor_id || null,
      actor_nombre: actor.actor_nombre || null,
      estado_anterior: anterior.estado,
      estado_nuevo: estado,
      resumen: `Estado cambiado de ${anterior.estado} a ${estado}`,
      metadata: {},
    }, client);

    await client.query('COMMIT');
    return pedido;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
