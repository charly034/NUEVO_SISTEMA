import * as repo from './pedidos.repository.js';
import * as empresasRepo from '../empresas/empresas.repository.js';
import * as guarnicionesRepo from '../guarniciones/guarniciones.repository.js';
import * as salsasRepo from '../salsas/salsas.repository.js';
import * as notificacionesService from '../notificaciones/notificaciones.service.js';
import * as auditoriaService from '../admin-auditoria/admin-auditoria.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { getClient } from '../../database/connection.js';
import { validarPedidoInput } from './pedidos.validation.js';

const ESTADOS_PEDIDO = ['pendiente', 'en_proceso', 'completo', 'cancelado'];
const ESTADOS_ITEM = ['pendiente', 'preparado', 'entregado', 'cancelado'];
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


// Indice de dia en la semana (lunes=0 ... domingo=6)
const DIA_IDX = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };
const DIAS_VALIDOS = Object.keys(DIA_IDX);
const ESTADOS_CANCELABLES_CLIENTE = new Set(['pendiente', 'en_proceso']);

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

function normalizarSalsas(salsas) {
  return salsas.map((salsa) => ({
    id: salsa.id,
    nombre: salsa.nombre,
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

// Modo efectivo de guarnicion de un plato/slot ya resuelto por el repositorio
// (override de slot > vianda del catalogo > legacy tiene_guarnicion="libre").
// 'fija' es una eleccion deliberada del modelo nuevo y siempre gana.
function modoGuarnicionPlato(plato) {
  if (plato.guarnicion_modo === 'fija') return 'fija';
  if (plato.tiene_guarnicion) return 'libre';
  return plato.guarnicion_modo || 'sin_guarnicion';
}

// Modo efectivo de salsa. Analogo a modoGuarnicionPlato, pero sin booleano legacy:
// salsa_modo es un concepto nuevo, no tiene arrastre historico.
function modoSalsaPlato(plato) {
  if (plato.salsa_modo === 'fija') return 'fija';
  return plato.salsa_modo || 'sin_salsa';
}

// Un plato de disponibilidad='fijo_dia' solo esta disponible su dia_fijo;
// 'siempre' y el legacy tipo='fijo' estan disponibles todos los dias.
function platoFijoDisponibleEnDia(plato, dia) {
  if (plato.disponibilidad === 'fijo_dia') return plato.dia_fijo === dia;
  return true;
}

function mapearPlatoEspecial(plato, guarniciones, salsas) {
  const modo = modoGuarnicionPlato(plato);
  const modoSalsa = modoSalsaPlato(plato);
  return {
    id: `menu-${plato.plato_id}-${plato.dia}-${plato.opcion || 'sin-opcion'}`,
    platoId: plato.plato_id,
    opcion: plato.opcion || null,
    nombre: plato.plato_nombre,
    descripcion: plato.descripcion || plato.descripcion_larga || 'Menu publicado',
    descripcionLarga: plato.descripcion_larga || null,
    categoria: 'menu',
    tipo: modo !== 'sin_guarnicion' ? 'principal_con_guarnicion' : 'plato_completo',
    requiereGuarnicion: modo === 'libre',
    requiereSalsa: modoSalsa === 'libre',
    destacado: true,
    grupo: 'especiales',
    estado: 'disponible',
    calorias: plato.calorias ?? null,
    alergenos: plato.alergenos || [],
    foto_url: plato.foto_url || null,
    vegetariano: Boolean(plato.vegetariano),
    etiquetas: crearEtiquetasPlato(plato, [`Opcion ${plato.opcion || ''}`.trim()]),
    guarniciones: modo === 'libre' ? guarniciones : [],
    guarnicionModo: modo,
    guarnicionFija: modo === 'fija' ? { id: plato.guarnicion_fija_id, nombre: plato.guarnicion_fija_nombre } : null,
    salsas: modoSalsa === 'libre' ? salsas : [],
    salsaModo: modoSalsa,
    salsaFija: modoSalsa === 'fija' ? { id: plato.salsa_fija_id, nombre: plato.salsa_fija_nombre } : null,
  };
}

function mapearPlatoFijo(plato, guarniciones, salsas) {
  const modo = modoGuarnicionPlato(plato);
  const modoSalsa = modoSalsaPlato(plato);
  return {
    id: `fijo-${plato.plato_id}`,
    platoId: plato.plato_id,
    opcion: null,
    nombre: plato.plato_nombre,
    descripcion: plato.descripcion || plato.descripcion_larga || 'Plato fijo',
    descripcionLarga: plato.descripcion_larga || null,
    categoria: 'fijo',
    tipo: modo !== 'sin_guarnicion' ? 'principal_con_guarnicion' : 'plato_completo',
    requiereGuarnicion: modo === 'libre',
    requiereSalsa: modoSalsa === 'libre',
    destacado: false,
    grupo: 'fijos',
    estado: 'disponible',
    calorias: plato.calorias ?? null,
    alergenos: plato.alergenos || [],
    foto_url: plato.foto_url || null,
    vegetariano: Boolean(plato.vegetariano),
    etiquetas: crearEtiquetasPlato(plato, ['Fijo']),
    guarniciones: modo === 'libre' ? guarniciones : [],
    guarnicionModo: modo,
    guarnicionFija: modo === 'fija' ? { id: plato.guarnicion_fija_id, nombre: plato.guarnicion_fija_nombre } : null,
    salsas: modoSalsa === 'libre' ? salsas : [],
    salsaModo: modoSalsa,
    salsaFija: modoSalsa === 'fija' ? { id: plato.salsa_fija_id, nombre: plato.salsa_fija_nombre } : null,
    diasDisponibles: plato.dias_disponibles || null,
  };
}

function todosLosDiasCerrados(menuSemana, diasPedido) {
  const diasCerrados = menuSemana?.limiteEmpresa?.diasCerrados || [];
  return diasPedido.length > 0 && diasPedido.every((dia) => diasCerrados.includes(dia));
}

function obtenerDiasSinServicio(menu) {
  return new Set((menu?.sin_servicio || []).map((item) => item.dia));
}

function construirSnapshotPlan(empresa) {
  const plan = empresa?.plan_detalle || null;
  return {
    plan_id: plan?.id || empresa?.plan_id || null,
    plan_codigo: plan?.codigo || empresa?.plan_codigo || null,
    plan_nombre: plan?.nombre || empresa?.plan_nombre || empresa?.plan || null,
    plan_gramaje_min: plan?.gramaje_min ?? empresa?.plan_gramaje_min ?? null,
    plan_gramaje_max: plan?.gramaje_max ?? empresa?.plan_gramaje_max ?? null,
    plan_incluye_postre: Boolean(plan?.incluye_postre ?? empresa?.plan_incluye_postre),
    plan_incluye_bebida: Boolean(plan?.incluye_bebida ?? empresa?.plan_incluye_bebida),
  };
}

function obtenerEstadoSemana({ menuSemana, semanaInicio, pedidoVisible, diasPedido = [] }) {
  if (pedidoVisible) return 'confirmado';
  if (!menuSemana?.menu?.id) return semanaInicio > lunesDeSemana() ? 'sin_menu' : 'sin_pedido';
  if (menuSemana.cerrado || menuSemana.limiteEmpresa?.vencido || todosLosDiasCerrados(menuSemana, diasPedido)) return 'cerrado';
  return 'sin_pedido';
}

function construirTextoItem(item) {
  if (item?.sin_pedido) return 'Sin pedido';
  if (!item?.plato_nombre) return null;
  const extras = [item.guarnicion_nombre, item.salsa_nombre]
    .filter(Boolean)
    .map((nombre) => String(nombre).toLowerCase());
  return extras.length > 0
    ? `${item.plato_nombre} con ${extras.join(' y ')}`
    : item.plato_nombre;
}

function construirSeleccionItem(item, opciones) {
  if (!item) return null;
  if (item.sin_pedido) {
    return {
      plato: null,
      guarnicion: '',
      salsa: '',
      platoId: null,
      nombrePlato: '',
      guarnicionId: null,
      nombreGuarnicion: '',
      salsaId: null,
      nombreSalsa: '',
      origenSinPedido: item.origen || 'usuario',
      sinPedido: true,
    };
  }
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
    salsa: item.salsa_id
      ? { id: item.salsa_id, nombre: item.salsa_nombre }
      : '',
    platoId: plato.platoId,
    nombrePlato: plato.nombre,
    guarnicionId: item.guarnicion_id || null,
    nombreGuarnicion: item.guarnicion_nombre || '',
    salsaId: item.salsa_id || null,
    nombreSalsa: item.salsa_nombre || '',
    sinPedido: false,
  };
}

function normalizarEnteroOpcional(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function normalizarIdOpcional(valor) {
  return normalizarEnteroOpcional(valor);
}

function normalizarDiaPedido(dia) {
  const sinPedido = Boolean(dia.sinPedido ?? dia.sin_pedido);
  const diaId = dia.diaId || dia.dia || dia.clave;

  return {
    dia: diaId,
    fecha: dia.fecha || null,
    plato_id: sinPedido ? null : normalizarEnteroOpcional(dia.platoId ?? dia.plato_id),
    opcion: sinPedido ? null : (dia.opcion || dia.opcionMenu || null),
    guarnicion_id: sinPedido ? null : normalizarEnteroOpcional(dia.guarnicionId ?? dia.guarnicion_id),
    salsa_id: sinPedido ? null : normalizarEnteroOpcional(dia.salsaId ?? dia.salsa_id),
    sin_pedido: sinPedido,
    origen: sinPedido ? dia.origen || 'usuario' : null,
    notas: dia.notas || null,
  };
}

function normalizarPayloadPedido(payload = {}) {
  if (Array.isArray(payload.items)) {
    return {
      semana_inicio: payload.semana_inicio || payload.semanaId,
      menu_semanal_id: normalizarIdOpcional(payload.menu_semanal_id || payload.menuSemanalId),
      observaciones: payload.observaciones || null,
      items: payload.items.map((item) => ({
        ...item,
        sin_pedido: Boolean(item.sin_pedido),
        origen: item.origen || null,
      })),
    };
  }

  return {
    semana_inicio: payload.semana_inicio || payload.semanaId,
    menu_semanal_id: normalizarIdOpcional(payload.menu_semanal_id || payload.menuSemanalId),
    observaciones: payload.observaciones || null,
    items: (payload.dias || []).map(normalizarDiaPedido),
  };
}

function normalizarPedidoGuardado(pedido, mensaje = 'Pedido guardado correctamente') {
  const items = pedido?.items || [];

  return {
    ok: true,
    mensaje,
    pedido: {
      id: pedido?.id,
      semanaId: fechaISO(pedido?.semana_inicio),
      estado: pedido?.estado === 'cancelado' ? 'cancelado' : 'confirmado',
      fechaConfirmacion: pedido?.updated_at || pedido?.created_at || null,
      fechaUltimaModificacion: pedido?.updated_at || pedido?.created_at || null,
      dias: items.map((item) => ({
        diaId: item.dia,
        fecha: null,
        estado: item.sin_pedido ? 'sin_pedido' : 'seleccionado',
        sinPedido: Boolean(item.sin_pedido),
        origen: item.origen || (item.sin_pedido ? 'usuario' : null),
        plato: item.sin_pedido
          ? null
          : {
              id: item.plato_id,
              nombre: item.plato_nombre,
            },
        guarnicion: item.guarnicion_id
          ? {
              id: item.guarnicion_id,
              nombre: item.guarnicion_nombre,
            }
          : null,
        salsa: item.salsa_id
          ? {
              id: item.salsa_id,
              nombre: item.salsa_nombre,
            }
          : null,
      })),
    },
  };
}

function normalizarSugerenciaGuardada(sugerencia) {
  return {
    id: sugerencia?.id,
    semanaId: fechaISO(sugerencia?.semana_inicio),
    recomendacionesUsuario: Array.isArray(sugerencia?.ideas) ? sugerencia.ideas : [],
    comentarioRecomendacion: sugerencia?.comentario || '',
    fechaUltimaModificacion: sugerencia?.updated_at || sugerencia?.created_at || null,
  };
}

function normalizarSugerenciaAdmin(sugerencia) {
  return {
    id: sugerencia?.id,
    semanaId: fechaISO(sugerencia?.semana_inicio),
    semana_inicio: fechaISO(sugerencia?.semana_inicio),
    empleado_id: sugerencia?.empleado_id,
    empresa_id: sugerencia?.empresa_id,
    empleado_nombre: sugerencia?.empleado_nombre || '',
    empleado_apellido: sugerencia?.empleado_apellido || '',
    email: sugerencia?.email || '',
    empresa_nombre: sugerencia?.empresa_nombre || '',
    ideas: Array.isArray(sugerencia?.ideas) ? sugerencia.ideas : [],
    comentario: sugerencia?.comentario || '',
    created_at: sugerencia?.created_at || null,
    updated_at: sugerencia?.updated_at || null,
  };
}

function normalizarPayloadSugerencia(payload = {}) {
  const semana_inicio = payload.semana_inicio || payload.semanaId;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana_inicio || '')) {
    throw ApiError.badRequest('semana_inicio es requerido en formato YYYY-MM-DD');
  }

  const ideas = Array.isArray(payload.ideas)
    ? payload.ideas.map((idea) => String(idea || '').trim()).filter(Boolean)
    : [];
  const comentario = String(payload.comentario || '').trim();

  if (ideas.length === 0 && comentario.length === 0) {
    throw ApiError.badRequest('Envia al menos una sugerencia o comentario');
  }
  if (ideas.length > 12) {
    throw ApiError.badRequest('No se pueden enviar mas de 12 sugerencias');
  }
  if (ideas.some((idea) => idea.length > 120)) {
    throw ApiError.badRequest('Cada sugerencia debe tener 120 caracteres o menos');
  }
  if (comentario.length > 500) {
    throw ApiError.badRequest('El comentario debe tener 500 caracteres o menos');
  }

  return {
    semana_inicio,
    ideas: [...new Set(ideas)],
    comentario,
  };
}

function validarSemanaInicioLunes(semanaInicio) {
  const iso = fechaISO(semanaInicio);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) {
    throw ApiError.badRequest('semana_inicio es requerido en formato YYYY-MM-DD');
  }
  const fecha = new Date(`${iso}T00:00:00`);
  if (fecha.getDay() !== 1) {
    throw ApiError.badRequest('semana_inicio debe ser lunes');
  }
  return iso;
}

function normalizarOpcionSugerencia(opcion) {
  return {
    id: opcion.id,
    semana_inicio: fechaISO(opcion.semana_inicio),
    plato_id: opcion.plato_id,
    plato_nombre: opcion.plato_nombre,
    nombre: opcion.plato_nombre,
    descripcion: opcion.descripcion || '',
    tags: Array.isArray(opcion.tags) ? opcion.tags : [],
    tipo: opcion.tipo || '',
    foto_url: opcion.foto_url || null,
    orden: opcion.orden ?? 0,
  };
}

function crearSugerenciasSemana(diasPedido, opciones = []) {
  return opciones.slice(0, Math.max(diasPedido.length, 1)).map((opcion, indice) => {
    const dia = diasPedido[indice % Math.max(diasPedido.length, 1)] || 'lunes';
    return {
      id: opcion.plato_id,
      dia: DIAS_LABEL[dia] || dia,
      plato: opcion.plato_nombre,
    };
  });
}

/**
 * Dado un lunes de semana (YYYY-MM-DD) y un nombre de dia, devuelve la Date de ese dia.
 */
function fechaDeDia(semanaInicio, dia) {
  const base = new Date(`${fechaISO(semanaInicio)}T00:00:00`);
  base.setDate(base.getDate() + (DIA_IDX[dia] ?? 0));
  return base;
}

/**
 * Verifica si el momento actual esta dentro del limite configurado para la empresa.
 * Devuelve null si esta OK, o un string con el mensaje de error.
 */
function verificarLimiteEmpresa(empresa, semanaInicio, diasPedidos) {
  // Override activo: admin reabrio el plazo temporalmente
  if (tienePlazoOverrideActivo(empresa)) {
    return null;
  }

  const { modo_pedido, limite_dia_semana, limite_anticipacion_dias } = empresa;
  let limite_hora = empresa.limite_hora ? String(empresa.limite_hora).slice(0, 5) : null;
  // Default: semanal sin hora configurada -> lunes 09:30
  if (!limite_hora && (modo_pedido === 'semanal' || modo_pedido === 'ambos')) {
    limite_hora = '09:30';
  }
  if (!limite_hora) return null;

  const ahora = new Date();
  const [hh, mm] = limite_hora.split(':').map(Number);

  if (modo_pedido === 'semanal' || modo_pedido === 'ambos') {
    // Limite semanal: hasta cierto dia de la semana a cierta hora
    const diaCorte = limite_dia_semana || 'lunes';
    const fechaCorte = fechaDeDia(semanaInicio, diaCorte);
    fechaCorte.setHours(hh, mm, 0, 0);
    if (ahora > fechaCorte) {
      const diaLabel = diaCorte.charAt(0).toUpperCase() + diaCorte.slice(1);
      return `El plazo para pedir la semana completa vencio el ${diaLabel} a las ${limite_hora}hs.`;
    }
  }

  if (modo_pedido === 'diario' || modo_pedido === 'ambos') {
    // Limite diario: para cada dia pedido, verificar que no haya pasado el corte
    const anticipacion = limite_anticipacion_dias ?? 0;
    for (const dia of diasPedidos) {
      const fechaDia = fechaDeDia(semanaInicio, dia);
      // El corte es anticipacion dias ANTES del dia pedido, a la hora indicada
      const fechaCorte = new Date(fechaDia);
      fechaCorte.setDate(fechaCorte.getDate() - anticipacion);
      fechaCorte.setHours(hh, mm, 0, 0);
      if (ahora > fechaCorte) {
        const diaLabel = dia.charAt(0).toUpperCase() + dia.slice(1);
        const cuando = anticipacion === 0
          ? `el mismo ${diaLabel} a las ${limite_hora}hs`
          : `el dia anterior a las ${limite_hora}hs`;
        return `El plazo para pedir el ${diaLabel} vencio (limite: ${cuando}).`;
      }
    }
  }

  return null;
}

function tienePlazoOverrideActivo(empresa) {
  return Boolean(empresa?.plazo_override_hasta && new Date() <= new Date(empresa.plazo_override_hasta));
}

export const getMenuHoy = () => repo.menuHoy();

export const getMenuSemana = (semanaInicio) => {
  if (!semanaInicio) throw ApiError.badRequest('fecha_inicio es requerido');
  return repo.menuSemana(semanaInicio);
};

export const getMenuActivo = async (empresaId = null) => {
  const menus = await repo.menusPublicadosList(empresaId);
  const ahora = new Date();

  let empresa = null;
  if (empresaId) empresa = await empresasRepo.findById(empresaId);

  const menus_disponibles = menus.map(menu => {
    if (menu.fecha_fin && new Date(menu.fecha_fin) < ahora) {
      return { disponible: false, cerrado: true, mensaje: 'Esta semana ya finalizo.', menu };
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

  const [empresa, menus, historial, sugerenciasUsuario, guarnicionesActivas, salsasActivas] = await Promise.all([
    empresasRepo.findById(empresaId),
    repo.menusPublicadosList(empresaId),
    empleadoId ? repo.findHistorialByEmpleado(empleadoId, 24) : Promise.resolve([]),
    empleadoId ? repo.findSugerenciasByEmpleado(empleadoId) : Promise.resolve([]),
    guarnicionesRepo.findAll(true),
    salsasRepo.findAll(true),
  ]);

  if (!empresa) throw ApiError.notFound(`Empresa ${empresaId} no encontrada`);

  const diasPedido = DIAS_LABORALES[empresa.dias_laborales] ?? DIAS_LABORALES.lunes_viernes;
  const diasPorDefectoSinPedido = obtenerDiasPorDefectoSinPedido(empresa);
  const guarniciones = normalizarGuarniciones(guarnicionesActivas);
  const salsas = normalizarSalsas(salsasActivas);
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
  const sugerenciasPorSemana = new Map(
    sugerenciasUsuario.map((sugerencia) => [fechaISO(sugerencia.semana_inicio), sugerencia]),
  );
  const fechas = new Set([...menusPorSemana.keys(), ...pedidosPorSemana.keys()]);

  if (fechas.size === 0) fechas.add(semanaActual);
  if (![...fechas].some((fecha) => fecha >= semanaActual)) fechas.add(semanaActual);
  fechas.add(addDias([...fechas].sort().at(-1) || semanaActual, 7));

  const opcionesSugerencia = await repo.findOpcionesSugerenciaBySemanas([...fechas]);
  const opcionesSugerenciaPorSemana = new Map();
  for (const opcion of opcionesSugerencia) {
    const semanaInicio = fechaISO(opcion.semana_inicio);
    if (!opcionesSugerenciaPorSemana.has(semanaInicio)) opcionesSugerenciaPorSemana.set(semanaInicio, []);
    opcionesSugerenciaPorSemana.get(semanaInicio).push(opcion);
  }

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
    const sugerenciaVisible = sugerenciasPorSemana.get(semanaInicio) || null;
    const tipo = obtenerTipoSemana(semanaInicio, semanaActual);
    const estado = obtenerEstadoSemana({ menuSemana, semanaInicio, pedidoVisible, diasPedido });
    const fechaFin = addDias(semanaInicio, Math.max(diasPedido.length - 1, 0));
    const tieneMenuPublicado = Boolean(menuSemana?.menu?.id);
    const esSemanaSugerencias = !tieneMenuPublicado && semanaInicio > semanaActual;
    const opcionesSugerenciaSemana = opcionesSugerenciaPorSemana.get(semanaInicio) || [];
    const itemsPorDia = new Map((pedidoVisible?.items || []).map((item) => [item.dia, item]));
    const sinServicioPorDia = new Map(
      (menuSemana.menu?.sin_servicio || []).map((item) => [item.dia, item.motivo || 'Sin servicio']),
    );

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
      sugerencias: esSemanaSugerencias ? crearSugerenciasSemana(diasPedido, opcionesSugerenciaSemana) : [],
      opcionesSugerencia: esSemanaSugerencias ? opcionesSugerenciaSemana.map(normalizarOpcionSugerencia) : [],
      recomendacionesUsuario: sugerenciaVisible?.ideas || [],
      comentarioRecomendacion: sugerenciaVisible?.comentario || '',
      dias: diasPedido.map((dia, indice) => {
        const item = itemsPorDia.get(dia);
        const especiales = (menuSemana.menu?.variables || [])
          .filter((plato) => plato.dia === dia)
          .map((plato) => mapearPlatoEspecial(plato, guarniciones, salsas));
        const fijos = (menuSemana.menu?.fijos || [])
          .filter((plato) => platoFijoDisponibleEnDia(plato, dia))
          .map((plato) => mapearPlatoFijo(plato, guarniciones, salsas));
        const opciones = [...especiales, ...fijos];
        const tieneSinServicio = sinServicioPorDia.has(dia);
        const motivoSinServicio = sinServicioPorDia.get(dia) || null;
        const sinPedidoGuardado = Boolean(item?.sin_pedido);
        const sinPedidoPorDefecto = !item && (
          diasPorDefectoSinPedido.includes(dia) ||
          tieneSinServicio
        );
        const seleccion = construirSeleccionItem(item, opciones);
        const sinMenuEspecial = especiales.length === 0 && fijos.length > 0;
        const fechaDia = addDias(semanaInicio, indice);

        return {
          id: dia,
          clave: dia,
          dia: DIAS_LABEL[dia] || dia,
          fecha: fechaDia,
          estado: sinPedidoGuardado || sinPedidoPorDefecto
              ? 'sin_pedido_por_defecto'
              : seleccion
                ? 'seleccionado'
                : sinMenuEspecial
                  ? 'sin_menu'
                  : 'sin_seleccionar',
          bloqueado: (menuSemana.limiteEmpresa?.diasCerrados || []).includes(dia),
          limiteTexto: textoLimiteDia(dia, fechaDia, menuSemana.limiteEmpresa),
          motivo: tieneSinServicio ? `No hay servicio este dia: ${motivoSinServicio}` : null,
          mensajeMenu: tieneSinServicio
            ? 'Este dia no tiene servicio. Queda sin vianda por defecto y no se puede editar.'
            : sinMenuEspecial
              ? 'Todavia no hay menu especial para este dia. Podes elegir un plato fijo.'
              : null,
          plato: seleccion
            ? construirTextoItem(item)
            : sinPedidoGuardado || sinPedidoPorDefecto
              ? 'Sin pedido por defecto'
              : 'Sin seleccionar',
          seleccion: seleccion || null,
          especiales,
          fijos,
          opciones,
          regla: empresa.modo_pedido === 'diario'
            ? 'diario'
            : empresa.modo_pedido === 'ambos'
              ? 'mixto'
              : 'semanal',
        };
      }),
      metadata: {
        pedidoId: pedidoVisible?.id || null,
        pedido: pedidoVisible,
        sugerenciaId: sugerenciaVisible?.id || null,
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

export const guardarSugerenciaPedido = async (empleadoId, empresaId, payload) => {
  const empresa = await empresasRepo.findById(empresaId);
  if (!empresa) throw ApiError.notFound('Empresa no encontrada');

  const sugerenciaNormalizada = normalizarPayloadSugerencia(payload);
  const sugerencia = await repo.upsertSugerencia({
    empleado_id: empleadoId,
    empresa_id: empresaId,
    ...sugerenciaNormalizada,
  });

  return {
    ok: true,
    mensaje: 'Gracias por tu sugerencia',
    sugerencia: normalizarSugerenciaGuardada(sugerencia),
  };
};

export const getOpcionesMenuSemana = async ({ empresaId, semanaId }) => {
  if (!semanaId) throw ApiError.badRequest('semanaId es requerido');
  if (!empresaId) throw ApiError.badRequest('empresaId es requerido');

  const [empresa, menus, guarnicionesActivas, salsasActivas] = await Promise.all([
    empresasRepo.findById(empresaId),
    repo.menusPublicadosList(empresaId),
    guarnicionesRepo.findAll(true),
    salsasRepo.findAll(true),
  ]);

  if (!empresa) throw ApiError.notFound(`Empresa ${empresaId} no encontrada`);

  const diasPedido = DIAS_LABORALES[empresa.dias_laborales] ?? DIAS_LABORALES.lunes_viernes;
  const menu = menus.find((item) =>
    String(item.id) === String(semanaId) ||
    fechaISO(item.fecha_inicio) === fechaISO(semanaId),
  );
  const guarniciones = normalizarGuarniciones(guarnicionesActivas);
  const salsas = normalizarSalsas(salsasActivas);

  return {
    semanaId,
    dias: diasPedido.map((dia, indice) => {
      const sinServicio = (menu?.sin_servicio || []).find((item) => item.dia === dia) || null;
      const motivoSinServicio = sinServicio?.motivo || 'Sin servicio';
      const especiales = (menu?.variables || [])
          .filter((plato) => plato.dia === dia)
          .map((plato) => mapearPlatoEspecial(plato, guarniciones, salsas));
      const fijos = (menu?.fijos || [])
          .filter((plato) => platoFijoDisponibleEnDia(plato, dia))
          .map((plato) => mapearPlatoFijo(plato, guarniciones, salsas));
      const sinMenuEspecial = especiales.length === 0 && fijos.length > 0;

      return {
        diaId: dia,
        fecha: menu?.fecha_inicio ? addDias(menu.fecha_inicio, indice) : null,
        estadoMenu: sinServicio
          ? 'sin_servicio'
          : especiales.length > 0
            ? 'con_menu_especial'
            : sinMenuEspecial
              ? 'sin_menu_especial'
              : 'sin_menu',
        mensaje: sinServicio
          ? 'Este dia no tiene servicio. Queda sin vianda por defecto y no se puede editar.'
          : sinMenuEspecial
            ? 'Todavia no hay menu especial para este dia. Podes elegir un plato fijo.'
            : null,
        sinServicio: Boolean(sinServicio),
        motivoSinServicio: sinServicio ? motivoSinServicio : null,
        especiales,
        fijos,
        opciones: [...especiales, ...fijos],
      };
    }),
  };
};

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_SEMANA_TEXTO = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function formatearFechaHoraLimite(fecha) {
  const diaSemana = DIAS_SEMANA_TEXTO[fecha.getDay()];
  const dia = fecha.getDate();
  const mes = MESES_CORTOS[fecha.getMonth()];
  const hh = String(fecha.getHours()).padStart(2, '0');
  const mm = String(fecha.getMinutes()).padStart(2, '0');
  return `${diaSemana} ${dia} ${mes} a las ${hh}:${mm}hs`;
}

/**
 * Traduce limiteEmpresa (construirInfoLimite) a un mensaje puntual por dia:
 * "Editable hasta el..." o "Cerro el...". Evita que el cliente choque contra
 * el plazo sin entender por que quedo bloqueado.
 */
function textoLimiteDia(diaClave, fechaDiaISO, limiteEmpresa) {
  if (!limiteEmpresa || limiteEmpresa.tipo === 'override') return null;

  if (limiteEmpresa.tipo === 'semanal') {
    if (!limiteEmpresa.fechaCorte) return null;
    const corte = new Date(limiteEmpresa.fechaCorte);
    const cuando = formatearFechaHoraLimite(corte);
    return limiteEmpresa.vencido ? `Cerro el ${cuando}` : `Editable hasta el ${cuando}`;
  }

  // 'diario' o 'ambos': cada dia cierra por su cuenta, con anticipacion desde su propia fecha.
  const anticipacion = limiteEmpresa.anticipacion_dias ?? 0;
  const hora = limiteEmpresa.hora || '09:30';
  const [hh, mm] = hora.split(':').map(Number);
  const [anio, mes, dia] = fechaDiaISO.split('-').map(Number);
  const corte = new Date(anio, mes - 1, dia - anticipacion, hh || 0, mm || 0, 0, 0);
  const cuando = formatearFechaHoraLimite(corte);
  const bloqueado = (limiteEmpresa.diasCerrados || []).includes(diaClave);
  return bloqueado ? `Cerro el ${cuando}` : `Editable hasta el ${cuando}`;
}

/**
 * Devuelve un objeto legible con la configuracion de limite de la empresa
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
  // Default: semanal sin hora configurada -> lunes 09:30
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
      texto: `Pedido semanal. Limite: ${diaCorte} a las ${limite_hora}hs.`,
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
      ? `el mismo dia hasta las ${limite_hora}hs`
      : `el dia anterior hasta las ${limite_hora}hs`;
    return {
      tipo: 'diario',
      texto: `Pedido diario. Limite: ${cuando}.`,
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

export const getSugerenciasPedidoAdmin = async (filters) => {
  const sugerencias = await repo.findSugerenciasAdmin(filters);
  return sugerencias.map(normalizarSugerenciaAdmin);
};

export const getResumenSugerencias = async ({ semana_inicio }) => {
  const semanaInicio = validarSemanaInicioLunes(semana_inicio);
  return repo.findResumenSugerencias(semanaInicio);
};

export const getOpcionesSugerencia = async ({ semana_inicio }) => {
  const semanaInicio = validarSemanaInicioLunes(semana_inicio);
  const opciones = await repo.findOpcionesSugerencia(semanaInicio);
  return opciones.map(normalizarOpcionSugerencia);
};

export const reemplazarOpcionesSugerencia = async ({ semana_inicio, plato_ids }) => {
  const semanaInicio = validarSemanaInicioLunes(semana_inicio);
  const ids = Array.isArray(plato_ids)
    ? [...new Set(plato_ids.map((id) => Number.parseInt(id, 10)).filter((id) => Number.isInteger(id) && id > 0))]
    : [];

  if (ids.length > 24) throw ApiError.badRequest('No se pueden configurar mas de 24 platos sugeridos');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await repo.replaceOpcionesSugerencia({ semana_inicio: semanaInicio, plato_ids: ids }, client);
    const opciones = await repo.findOpcionesSugerencia(semanaInicio, client);
    await client.query('COMMIT');
    return opciones.map(normalizarOpcionSugerencia);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getPedidoById = async (id) => {
  const pedido = await repo.findById(id);
  if (!pedido) throw ApiError.notFound(`Pedido con id ${id} no encontrado`);
  return pedido;
};

export const getMiPedido = (empleadoId, semanaInicio) => {
  if (!semanaInicio) throw ApiError.badRequest('semana_inicio es requerido');
  return repo.findPedidoByEmpleadoSemana(empleadoId, semanaInicio);
};

export const guardarPedido = async (empleadoId, empresaId, payload, actor = {}) => {
  const pedidoNormalizado = normalizarPayloadPedido(payload);
  const { semana_inicio, observaciones } = pedidoNormalizado;
  const { items } = pedidoNormalizado;
  let { menu_semanal_id } = pedidoNormalizado;
  const diasUnicos = validarPedidoInput({ semana_inicio, menu_semanal_id, items });
  const empresa = await empresasRepo.findById(empresaId);
  if (!empresa) throw ApiError.notFound('Empresa no encontrada');

  const menuActivo = menu_semanal_id
    ? await repo.menuActivoPorId(menu_semanal_id, undefined, empresaId)
    : await repo.menuPublicadoPorSemana(semana_inicio, undefined, empresaId);

  if (menuActivo) {
    menu_semanal_id = menuActivo.id;
    if (fechaISO(menuActivo.fecha_inicio) !== semana_inicio) {
      throw ApiError.conflict('La semana indicada no coincide con el menu seleccionado.');
    }
  }

  const diasPermitidos = DIAS_LABORALES[empresa.dias_laborales] ?? DIAS_LABORALES.lunes_viernes;
  const diaFueraDeJornada = items.find((item) => !diasPermitidos.includes(item.dia));
  if (diaFueraDeJornada) {
    throw ApiError.unprocessable(`El ${diaFueraDeJornada.dia} no es un dia laboral para tu empresa`);
  }

  const errorLimite = verificarLimiteEmpresa(empresa, semana_inicio, items.map(i => i.dia));
  if (errorLimite) throw ApiError.conflict(errorLimite);

  const diasSinServicio = obtenerDiasSinServicio(menuActivo);
  const itemSinServicio = items.find((item) => diasSinServicio.has(item.dia));
  if (itemSinServicio) {
    throw ApiError.unprocessable(`El ${itemSinServicio.dia} no tiene servicio y no se puede modificar`);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const pedidoPrevio = await repo.findPedidoByEmpleadoSemana(empleadoId, semana_inicio, client);

    for (const item of items) {
      if (item.sin_pedido) continue;

      const plato = await repo.validateItemForMenu(menuActivo?.id || null, item, client, empresaId);
      if (!plato || !plato.activo || !plato.tiene_vianda) {
        throw ApiError.unprocessable(`El plato seleccionado para el ${item.dia} ya no esta disponible`);
      }
      const esFijo = plato.tipo === 'fijo'
        || plato.disponibilidad === 'siempre'
        || (plato.disponibilidad === 'fijo_dia' && plato.dia_fijo === item.dia);
      if (!esFijo && !menuActivo) {
        throw ApiError.unprocessable(`Todavia no hay menu publicado para elegir plato especial el ${item.dia}`);
      }
      if (!esFijo && !plato.pertenece_menu) {
        throw ApiError.unprocessable(`El plato "${plato.nombre}" no corresponde al ${item.dia} y opcion indicados`);
      }
      if (esFijo && item.opcion) {
        throw ApiError.badRequest(`Los platos fijos no deben indicar opcion (${item.dia})`);
      }
      if (!esFijo && !item.opcion) {
        throw ApiError.badRequest(`La opcion es requerida para el plato del ${item.dia}`);
      }

      const modo = modoGuarnicionPlato(plato);
      if (modo === 'fija') {
        // La guarnicion no se elige: siempre viaja la fija de la vianda/slot.
        item.guarnicion_id = plato.guarnicion_fija_id;
      } else if (modo === 'sin_guarnicion') {
        if (item.guarnicion_id) {
          throw ApiError.unprocessable(`El plato "${plato.nombre}" no admite guarnicion`);
        }
      } else {
        if (!item.guarnicion_id) {
          throw ApiError.unprocessable(`Elegi una guarnicion para continuar con el ${item.dia}`);
        }
        if (!plato.guarnicion_valida) {
          throw ApiError.unprocessable(`La guarnicion del ${item.dia} no existe o no esta activa`);
        }
      }

      const modoSalsa = modoSalsaPlato(plato);
      if (modoSalsa === 'fija') {
        // La salsa no se elige: siempre viaja la fija de la vianda/slot.
        item.salsa_id = plato.salsa_fija_id;
      } else if (modoSalsa === 'sin_salsa') {
        if (item.salsa_id) {
          throw ApiError.unprocessable(`El plato "${plato.nombre}" no admite salsa`);
        }
      } else {
        if (!item.salsa_id) {
          throw ApiError.unprocessable(`Elegi una salsa para continuar con el ${item.dia}`);
        }
        if (!plato.salsa_valida) {
          throw ApiError.unprocessable(`La salsa del ${item.dia} no existe o no esta activa`);
        }
      }
    }

    const pedido = await repo.upsertPedido({
      empleado_id: empleadoId,
      empresa_id: empresaId,
      menu_semanal_id,
      semana_inicio,
      observaciones,
      plan_snapshot: construirSnapshotPlan(empresa),
    }, client);

    const diasProtegidos = (pedidoPrevio?.items || [])
      .filter((item) => verificarLimiteEmpresa(empresa, semana_inicio, [item.dia]))
      .map((item) => item.dia);
    await repo.deleteItemsNotInDays(pedido.id, [...new Set([...diasUnicos, ...diasProtegidos])], client);
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
        ? `Pedido actualizado (${itemsGuardados.length} dias)`
        : `Pedido creado (${itemsGuardados.length} dias)`,
      metadata: {
        dias: itemsGuardados.map(item => item.dia),
        total_items: itemsGuardados.length,
      },
    }, client);

    const pedidoCompleto = await repo.findPedidoByEmpleadoSemana(empleadoId, semana_inicio, client);
    await client.query('COMMIT');
    return normalizarPedidoGuardado(
      pedidoCompleto || { ...pedido, items: itemsGuardados },
      pedidoPrevio ? 'Cambios guardados correctamente' : 'Pedido confirmado correctamente',
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const actualizarPedidoEmpleado = async (empleadoId, empresaId, pedidoId, payload, actor = {}) => {
  const pedidoActual = await repo.findPedidoCabeceraById(pedidoId);
  if (!pedidoActual) throw ApiError.notFound('Pedido no encontrado');
  if (Number(pedidoActual.empleado_id) !== Number(empleadoId) || Number(pedidoActual.empresa_id) !== Number(empresaId)) {
    throw ApiError.forbidden('No podes modificar un pedido que no te pertenece');
  }

  const semanaPayload = payload?.semanaId || payload?.semana_inicio;
  if (semanaPayload && fechaISO(semanaPayload) !== fechaISO(pedidoActual.semana_inicio)) {
    throw ApiError.conflict('No se puede cambiar la semana de un pedido existente');
  }

  return guardarPedido(
    empleadoId,
    empresaId,
    {
      ...payload,
      semanaId: fechaISO(pedidoActual.semana_inicio),
      menu_semanal_id: payload?.menu_semanal_id || payload?.menuSemanalId || pedidoActual.menu_semanal_id,
    },
    actor,
  );
};

export const confirmarPedidoEmpleado = async (empleadoId, empresaId, pedidoId, actor = {}) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const pedidoActual = await repo.findPedidoCabeceraById(pedidoId, client);
    if (!pedidoActual) throw ApiError.notFound('Pedido no encontrado');
    if (Number(pedidoActual.empleado_id) !== Number(empleadoId) || Number(pedidoActual.empresa_id) !== Number(empresaId)) {
      throw ApiError.forbidden('No podes confirmar un pedido que no te pertenece');
    }
    if (pedidoActual.estado === 'cancelado') {
      throw ApiError.conflict('No se puede confirmar un pedido cancelado');
    }

    await repo.touchPedido(pedidoId, client);
    await repo.registrarEvento({
      pedido_id: pedidoId,
      tipo: 'pedido_confirmado',
      actor_tipo: actor.actor_tipo || 'empleado',
      actor_id: actor.actor_id || empleadoId,
      actor_nombre: actor.actor_nombre || null,
      estado_anterior: pedidoActual.estado,
      estado_nuevo: pedidoActual.estado,
      resumen: 'Pedido confirmado por el usuario',
      metadata: { semana_inicio: fechaISO(pedidoActual.semana_inicio) },
    }, client);

    const pedidoCompleto = await repo.findPedidoByEmpleadoSemana(empleadoId, fechaISO(pedidoActual.semana_inicio), client);
    await client.query('COMMIT');
    return normalizarPedidoGuardado(pedidoCompleto, 'Pedido confirmado correctamente');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getMiHistorial = async (empleadoId) => {
  const historial = await repo.findHistorialByEmpleado(empleadoId);
  const empresaId = historial.find((pedido) => pedido.empresa_id)?.empresa_id;
  const empresa = empresaId ? await empresasRepo.findById(empresaId) : null;

  return historial.map((pedido) => {
    const estadoCancelable = ESTADOS_CANCELABLES_CLIENTE.has(pedido.estado);
    const items = (pedido.items || []).map((item) => ({
      ...item,
      puede_cancelar: Boolean(
        estadoCancelable &&
        empresa &&
        !item.sin_pedido &&
        !verificarLimiteEmpresa(empresa, fechaISO(pedido.semana_inicio), [item.dia])
      ),
    }));

    return {
      ...pedido,
      puede_cancelar: items.some((item) => item.puede_cancelar),
      items,
    };
  });
};

export const cancelarMiPedido = async (empleadoId, semanaInicio, actor = {}) => {
  if (!semanaInicio) throw ApiError.badRequest('semana_inicio es requerido');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const pedidoActual = await repo.findPedidoByEmpleadoSemana(empleadoId, semanaInicio, client);
    if (!pedidoActual || !ESTADOS_CANCELABLES_CLIENTE.has(pedidoActual.estado)) {
      throw ApiError.conflict('El pedido no existe o ya no se puede cancelar');
    }

    const empresa = await empresasRepo.findById(pedidoActual.empresa_id);
    if (!empresa) throw ApiError.notFound('Empresa no encontrada');

    const itemsActivos = (pedidoActual.items || []).filter((item) => !item.sin_pedido);
    const diasCancelables = itemsActivos
      .filter((item) => !verificarLimiteEmpresa(empresa, fechaISO(pedidoActual.semana_inicio), [item.dia]))
      .map((item) => item.dia);
    const diasProtegidos = itemsActivos
      .filter((item) => !diasCancelables.includes(item.dia))
      .map((item) => item.dia);

    if (diasCancelables.length === 0) {
      throw ApiError.conflict('No quedan dias pendientes que se puedan cancelar');
    }

    if (diasProtegidos.length === 0) {
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
        metadata: { semana_inicio: pedido.semana_inicio, dias_cancelados: diasCancelables },
      }, client);
      await client.query('COMMIT');
      return { ...pedido, cancelacion: { completa: true, dias_cancelados: diasCancelables, dias_conservados: [] } };
    }

    for (const dia of diasCancelables) {
      await repo.cancelarItemPedido(pedidoActual.id, dia, client);
    }

    await repo.registrarEvento({
      pedido_id: pedidoActual.id,
      tipo: 'pedido_cancelado_parcial',
      actor_tipo: actor.actor_tipo || 'empleado',
      actor_id: actor.actor_id || empleadoId,
      actor_nombre: actor.actor_nombre || null,
      estado_anterior: pedidoActual.estado,
      estado_nuevo: pedidoActual.estado,
      resumen: `Pedido cancelado parcialmente (${diasCancelables.length} dias)`,
      metadata: {
        semana_inicio: fechaISO(pedidoActual.semana_inicio),
        dias_cancelados: diasCancelables,
        dias_conservados: diasProtegidos,
      },
    }, client);

    const pedidoCompleto = await repo.findPedidoByEmpleadoSemana(empleadoId, semanaInicio, client);
    await client.query('COMMIT');
    return {
      ...normalizarPedidoGuardado(pedidoCompleto, 'Dias pendientes cancelados correctamente'),
      cancelacion: {
        completa: false,
        dias_cancelados: diasCancelables,
        dias_conservados: diasProtegidos,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const cancelarDiaMiPedido = async (empleadoId, empresaId, pedidoId, dia, actor = {}) => {
  if (!DIAS_VALIDOS.includes(dia)) {
    throw ApiError.badRequest(`Dia invalido. Opciones: ${DIAS_VALIDOS.join(', ')}`);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const pedido = await repo.findPedidoCabeceraById(pedidoId, client);
    if (!pedido) throw ApiError.notFound('Pedido no encontrado');
    if (Number(pedido.empleado_id) !== Number(empleadoId) || Number(pedido.empresa_id) !== Number(empresaId)) {
      throw ApiError.forbidden('No podes cancelar un pedido que no te pertenece');
    }
    if (!ESTADOS_CANCELABLES_CLIENTE.has(pedido.estado)) {
      throw ApiError.conflict('El pedido ya no se puede cancelar');
    }

    const empresa = await empresasRepo.findById(empresaId);
    if (!empresa) throw ApiError.notFound('Empresa no encontrada');

    const errorLimite = verificarLimiteEmpresa(empresa, fechaISO(pedido.semana_inicio), [dia]);
    if (errorLimite) throw ApiError.conflict(errorLimite);

    const pedidoCompletoAntes = await repo.findPedidoByEmpleadoSemana(empleadoId, fechaISO(pedido.semana_inicio), client);
    const item = (pedidoCompletoAntes?.items || []).find((pedidoItem) => pedidoItem.dia === dia);
    if (!item || item.sin_pedido) {
      throw ApiError.conflict(`No hay vianda activa para cancelar el ${dia}`);
    }

    await repo.cancelarItemPedido(pedido.id, dia, client);
    await repo.registrarEvento({
      pedido_id: pedido.id,
      tipo: 'pedido_dia_cancelado',
      actor_tipo: actor.actor_tipo || 'empleado',
      actor_id: actor.actor_id || empleadoId,
      actor_nombre: actor.actor_nombre || null,
      estado_anterior: pedido.estado,
      estado_nuevo: pedido.estado,
      resumen: `Dia cancelado por el usuario: ${dia}`,
      metadata: { semana_inicio: fechaISO(pedido.semana_inicio), dia },
    }, client);

    const pedidoCompleto = await repo.findPedidoByEmpleadoSemana(empleadoId, fechaISO(pedido.semana_inicio), client);
    await client.query('COMMIT');
    return normalizarPedidoGuardado(pedidoCompleto, `Vianda del ${dia} cancelada correctamente`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const cambiarEstado = async (id, estado, actor = {}) => {
  if (!ESTADOS_PEDIDO.includes(estado)) throw ApiError.badRequest(`Estado invalido. Opciones: ${ESTADOS_PEDIDO.join(', ')}`);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const anterior = await repo.findPedidoCabeceraById(id, client);
    if (!anterior) throw ApiError.notFound(`Pedido ${id} no encontrado`);

    const pedido = await repo.updateEstado(id, estado, client);
    const ESTADO_A_ITEMS = { completo: 'entregado', pendiente: 'pendiente', cancelado: 'cancelado' };
    const estadoItems = ESTADO_A_ITEMS[estado] ?? null;
    if (estadoItems) await repo.updateItemsEstadoByPedido(id, estadoItems, client);
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
    await auditoriaService.registrarAdminAction({
      adminUser: actor.adminUser || null,
      accion: 'cambiar_estado',
      entidad_tipo: 'pedido',
      entidad_id: pedido.id,
      resumen: `Cambió pedido ${pedido.id} de ${anterior.estado} a ${estado}`,
      antes: anterior,
      despues: pedido,
    }, client.query.bind(client));

    await client.query('COMMIT');

    // Notificacion/webhook fuera de la transaccion: no debe retener el lock
    // de la fila ni hacer fallar el cambio de estado si el envio falla.
    try {
      await notificacionesService.notificarCambioEstadoPedido({
        pedido,
        estadoAnterior: anterior.estado,
      });
    } catch (notifyError) {
      console.error('Error notificando cambio de estado de pedido', pedido.id, notifyError);
    }

    return pedido;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const cambiarEstadoItem = async (itemId, estado, actor = {}) => {
  if (!ESTADOS_ITEM.includes(estado)) throw ApiError.badRequest(`Estado invalido. Opciones: ${ESTADOS_ITEM.join(', ')}`);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    // Bloquea el pedido padre para serializar updates concurrentes sobre ítems del mismo pedido
    await client.query('SELECT id FROM pedidos WHERE id = (SELECT pedido_id FROM pedido_items WHERE id = $1) FOR UPDATE', [itemId]);
    const anterior = await repo.findItemConPedidoById(itemId, client);
    if (!anterior) throw ApiError.notFound(`Vianda ${itemId} no encontrada`);
    if (anterior.sin_pedido) throw ApiError.conflict('No se puede cambiar el estado de una vianda marcada como sin pedido');
    if (anterior.pedido_estado === 'cancelado') throw ApiError.conflict('No se puede cambiar una vianda de un pedido cancelado');

    const item = await repo.updateItemEstado(itemId, estado, client);
    const estadoPedido = await repo.calcularEstadoPedidoPorItems(anterior.pedido_id, client);
    const pedido = await repo.updateEstado(anterior.pedido_id, estadoPedido, client);

    await repo.registrarEvento({
      pedido_id: anterior.pedido_id,
      tipo: 'estado_item_cambiado',
      actor_tipo: actor.actor_tipo || 'admin',
      actor_id: actor.actor_id || null,
      actor_nombre: actor.actor_nombre || null,
      estado_anterior: anterior.estado,
      estado_nuevo: estado,
      resumen: `Estado de vianda ${anterior.dia} cambiado de ${anterior.estado} a ${estado}`,
      metadata: {
        pedido_item_id: item.id,
        dia: item.dia,
        pedido_estado_anterior: anterior.pedido_estado,
        pedido_estado_nuevo: estadoPedido,
      },
    }, client);

    await auditoriaService.registrarAdminAction({
      adminUser: actor.adminUser || null,
      accion: 'cambiar_estado_item',
      entidad_tipo: 'pedido_item',
      entidad_id: item.id,
      resumen: `Cambio vianda ${item.id} (${item.dia}) de ${anterior.estado} a ${estado}`,
      antes: anterior,
      despues: { ...item, pedido_estado: estadoPedido },
    }, client.query.bind(client));

    await client.query('COMMIT');

    // Notificacion/webhook fuera de la transaccion: no debe retener el lock
    // FOR UPDATE ni hacer fallar el cambio de estado si el envio falla.
    if (estadoPedido !== anterior.pedido_estado) {
      try {
        await notificacionesService.notificarCambioEstadoPedido({
          pedido,
          estadoAnterior: anterior.pedido_estado,
        });
      } catch (notifyError) {
        console.error('Error notificando cambio de estado de vianda', item.id, notifyError);
      }
    }

    return { item, pedido };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
