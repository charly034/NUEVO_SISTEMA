import { getDiasSemana } from "../../utils/dias.js";
import { addDias } from "../../utils/dates.js";

const DIAS_LABEL = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

function fechaISO(fecha) {
  return String(fecha || "").split("T")[0];
}

function fechaLocalDesdeISO(fecha) {
  const [anio, mes, dia] = fechaISO(fecha).split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function aISO(fecha) {
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0"),
  ].join("-");
}

function lunesDeSemana(fechaReferencia = new Date()) {
  const fecha = new Date(fechaReferencia);
  fecha.setHours(0, 0, 0, 0);
  const dia = fecha.getDay();
  const diferencia = dia === 0 ? -6 : 1 - dia;
  fecha.setDate(fecha.getDate() + diferencia);
  return aISO(fecha);
}

function sumarSemanas(fecha, semanas) {
  const base = fechaLocalDesdeISO(fecha);
  base.setDate(base.getDate() + semanas * 7);
  return aISO(base);
}

function fechaCorta(fecha) {
  const date = fechaLocalDesdeISO(fecha);
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function obtenerTipoSemana(semanaInicio, semanaActual) {
  if (semanaInicio === semanaActual) return "actual";
  return semanaInicio < semanaActual ? "anterior" : "proxima";
}

function obtenerEtiquetaSemana(tipo) {
  if (tipo === "actual") return "Semana actual";
  if (tipo === "proxima") return "Semana próxima";
  return "Semana anterior";
}

function obtenerPedidoVisible({ pedidoExistente, pedidoHistorial }) {
  if ((pedidoExistente?.items?.length ?? 0) > 0) return pedidoExistente;
  if ((pedidoHistorial?.items?.length ?? 0) > 0) return pedidoHistorial;
  return null;
}

function normalizarGuarnicion(guarnicion) {
  if (!guarnicion) return null;
  if (typeof guarnicion === "string") return { id: guarnicion, nombre: guarnicion };
  return {
    id: guarnicion.id ?? guarnicion.guarnicion_id ?? guarnicion.nombre,
    nombre: guarnicion.nombre ?? guarnicion.guarnicion_nombre ?? String(guarnicion.id),
  };
}

function crearEtiquetasPlato(plato, extra = []) {
  const tags = Array.isArray(plato.tags)
    ? plato.tags
    : String(plato.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

  return [
    ...extra,
    ...tags,
    plato.tiene_guarnicion ? "Requiere guarnición" : "Plato completo",
  ].filter(Boolean);
}

function adaptarOpcionVariable(plato, guarniciones) {
  const opcion = plato.opcion ? `Opción ${plato.opcion}` : "Menú del día";

  return {
    id: `menu-${plato.plato_id}-${plato.dia}-${plato.opcion || "sin-opcion"}`,
    platoId: plato.plato_id,
    opcion: plato.opcion || null,
    nombre: plato.plato_nombre,
    descripcion: plato.descripcion || "Menú publicado",
    categoria: "menu",
    tipo: plato.tiene_guarnicion ? "principal_con_guarnicion" : "plato_completo",
    requiereGuarnicion: Boolean(plato.tiene_guarnicion),
    destacado: true,
    etiquetas: crearEtiquetasPlato(plato, [opcion]),
    guarniciones: plato.tiene_guarnicion ? guarniciones : [],
  };
}

function adaptarOpcionFija(plato, guarniciones) {
  return {
    id: `fijo-${plato.plato_id}`,
    platoId: plato.plato_id,
    opcion: null,
    nombre: plato.plato_nombre,
    descripcion: plato.descripcion || "Plato fijo",
    categoria: "fijo",
    tipo: plato.tiene_guarnicion ? "principal_con_guarnicion" : "plato_completo",
    requiereGuarnicion: Boolean(plato.tiene_guarnicion),
    destacado: false,
    etiquetas: crearEtiquetasPlato(plato, ["Fijo"]),
    guarniciones: plato.tiene_guarnicion ? guarniciones : [],
  };
}

function construirOpcionesDia(menu, dia, guarniciones = []) {
  const guarnicionesNormalizadas = guarniciones.map(normalizarGuarnicion).filter(Boolean);
  const variables = (menu?.variables || [])
    .filter((plato) => plato.dia === dia)
    .map((plato) => adaptarOpcionVariable(plato, guarnicionesNormalizadas));
  const fijos = (menu?.fijos || []).map((plato) =>
    adaptarOpcionFija(plato, guarnicionesNormalizadas),
  );

  return [...variables, ...fijos];
}

function buscarOpcionPedido(item, opciones) {
  if (!item) return null;
  return opciones.find(
    (opcion) =>
      Number(opcion.platoId) === Number(item.plato_id) &&
      String(opcion.opcion || "") === String(item.opcion || ""),
  ) || null;
}

function construirSeleccionPedido(item, opciones) {
  const plato = buscarOpcionPedido(item, opciones);
  if (!plato) return null;
  const guarnicionPorNombre = item.guarnicion_nombre
    ? plato.guarniciones.find(
        (guarnicion) =>
          String(guarnicion.nombre).toLowerCase() ===
          String(item.guarnicion_nombre).toLowerCase(),
      )
    : null;
  const guarnicion = item.guarnicion_id || guarnicionPorNombre
    ? {
        id: item.guarnicion_id || guarnicionPorNombre.id,
        nombre: item.guarnicion_nombre || guarnicionPorNombre.nombre,
      }
    : "";

  return {
    plato,
    guarnicion,
    platoId: plato.platoId,
    nombrePlato: plato.nombre,
    guarnicionId: guarnicion ? guarnicion.id : null,
    nombreGuarnicion: guarnicion ? guarnicion.nombre : "",
    sinPedido: false,
  };
}

function estaCerrada(menuSemana, semanaInicio) {
  if (menuSemana?.limiteEmpresa?.vencido) return true;

  const ahora = new Date();
  const fechaFinMenu = menuSemana?.menu?.fecha_fin || addDias(semanaInicio, 6);
  const cierreSemana = fechaLocalDesdeISO(fechaFinMenu);
  cierreSemana.setHours(23, 59, 59, 999);

  if (ahora > cierreSemana) return true;

  const limite = menuSemana?.menu?.fecha_limite_pedidos;
  return limite ? new Date(limite) < ahora : false;
}

function obtenerEstadoSemana({ menuSemana, semanaInicio, pedidoVisible }) {
  if (pedidoVisible) return "confirmado";
  if (!menuSemana?.menu?.id) return semanaInicio > lunesDeSemana() ? "sin_menu" : "sin_pedido";
  if (estaCerrada(menuSemana, semanaInicio)) return "cerrado";
  return "pendiente";
}

function obtenerTextoDia({ item, estado, motivoSinServicio }) {
  if (item?.plato_nombre) {
    return item.guarnicion_nombre
      ? `${item.plato_nombre} + ${item.guarnicion_nombre}`
      : item.plato_nombre;
  }

  if (motivoSinServicio) return motivoSinServicio;
  if (estado === "pendiente" || estado === "sin_pedido") {
    return "Sin seleccionar";
  }

  return "No pediste vianda";
}

function crearSemanaPlaceholder({ semanaInicio, diasLaborales }) {
  return {
    disponible: false,
    placeholder: true,
    semana_inicio: semanaInicio,
    dias_laborales: diasLaborales,
    menu: {
      fecha_inicio: semanaInicio,
      fecha_fin: addDias(semanaInicio, 6),
      sin_servicio: [],
    },
  };
}

function crearSugerenciasSemana({ diasLaborales }) {
  const dias = getDiasSemana(diasLaborales);
  const sugerenciasBase = [
    "Milanesa con puré de papas",
    "Tarta de verduras con ensalada",
    "Wok de pollo con arroz",
    "Ravioles con salsa fileto",
    "Hamburguesa casera con vegetales",
    "Pastel de papa",
    "Pollo al horno con calabaza",
  ];

  return dias.slice(0, 3).map((dia, indice) => ({
    dia: DIAS_LABEL[dia] || dia,
    plato: sugerenciasBase[indice % sugerenciasBase.length],
  }));
}

function construirMapas({ menusDisponibles, historial }) {
  const menusPorSemana = new Map(
    menusDisponibles
      .map((menuSemana) => [
        fechaISO(menuSemana.semana_inicio || menuSemana.menu?.fecha_inicio),
        menuSemana,
      ])
      .filter(([fecha]) => !!fecha),
  );

  const pedidosPorSemana = new Map(
    historial
      .filter((pedido) => pedido.estado !== "cancelado")
      .map((pedido) => [fechaISO(pedido.semana_inicio), pedido]),
  );

  return { menusPorSemana, pedidosPorSemana };
}

function construirSemanasBase({
  menusDisponibles,
  historial,
  diasLaborales,
  fechaReferencia,
}) {
  const semanaActual = lunesDeSemana(fechaReferencia);
  const { menusPorSemana, pedidosPorSemana } = construirMapas({
    menusDisponibles,
    historial,
  });
  const fechas = new Set([...menusPorSemana.keys(), ...pedidosPorSemana.keys()]);

  if (fechas.size === 0) fechas.add(semanaActual);
  if (!Array.from(fechas).some((fecha) => fecha >= semanaActual)) {
    fechas.add(semanaActual);
  }

  const fechaMasNueva = Array.from(fechas).sort().at(-1) || semanaActual;
  fechas.add(sumarSemanas(fechaMasNueva, 1));

  return Array.from(fechas)
    .sort()
    .map((semanaInicio) => ({
      semanaInicio,
      menuSemana:
        menusPorSemana.get(semanaInicio) ||
        crearSemanaPlaceholder({ semanaInicio, diasLaborales }),
      pedidoHistorial: pedidosPorSemana.get(semanaInicio) || null,
    }));
}

export function adaptarSemanasPedido({
  menuData,
  historial = [],
  empleado,
  guarniciones = [],
  pedidosPorSemana = new Map(),
  fechaReferencia = new Date(),
}) {
  const diasLaborales = empleado?.empresa?.dias_laborales || "lunes_viernes";
  const menusDisponibles = menuData?.menus_disponibles ?? [];
  const semanaActual = lunesDeSemana(fechaReferencia);

  return construirSemanasBase({
    menusDisponibles,
    historial,
    diasLaborales,
    fechaReferencia,
  }).map(({ semanaInicio, menuSemana, pedidoHistorial }) => {
    const pedidoVisible = obtenerPedidoVisible({
      pedidoExistente: pedidosPorSemana.get(semanaInicio),
      pedidoHistorial,
    });
    const dias = getDiasSemana(menuSemana.dias_laborales || diasLaborales);
    const tipo = obtenerTipoSemana(semanaInicio, semanaActual);
    const estado = obtenerEstadoSemana({
      menuSemana,
      semanaInicio,
      pedidoVisible,
    });
    const itemsPorDia = new Map(
      (pedidoVisible?.items ?? []).map((item) => [item.dia, item]),
    );
    const sinServicioPorDia = new Map(
      (menuSemana.menu?.sin_servicio ?? []).map((item) => [
        item.dia,
        item.motivo,
      ]),
    );
    const fechaFin = addDias(semanaInicio, Math.max(dias.length - 1, 0));
    const tieneMenuPublicado = !!menuSemana?.menu?.id;
    const esSemanaSugerencias = !tieneMenuPublicado && semanaInicio > semanaActual;

    return {
      id: semanaInicio,
      etiqueta: obtenerEtiquetaSemana(tipo),
      tipo,
      rango: `${fechaCorta(semanaInicio)} al ${fechaCorta(fechaFin)}`,
      titulo: `Semana del lunes ${fechaCorta(semanaInicio)}`,
      estado,
      diasSeleccionados: pedidoVisible?.items?.length ?? 0,
      editable:
        estado === "pendiente" ||
        (estado === "confirmado" && !estaCerrada(menuSemana, semanaInicio)),
      dias: dias.map((dia, indice) => {
        const item = itemsPorDia.get(dia);
        const opciones = tieneMenuPublicado
          ? construirOpcionesDia(menuSemana.menu, dia, guarniciones)
          : [];
        const seleccion = construirSeleccionPedido(item, opciones);

        return {
          dia: DIAS_LABEL[dia] || dia,
          clave: dia,
          fecha: addDias(semanaInicio, indice),
          bloqueado: (menuSemana.limiteEmpresa?.diasCerrados || []).includes(dia),
          regla: menuSemana.limiteEmpresa?.tipo === "diario" ? "diario" : "semanal",
          opciones,
          seleccion,
          plato: seleccion
            ? obtenerTextoDia({ item, estado })
            : obtenerTextoDia({
                item,
                estado,
                motivoSinServicio: sinServicioPorDia.get(dia),
              }),
        };
      }),
      sugerencias: esSemanaSugerencias
        ? crearSugerenciasSemana({
            diasLaborales: menuSemana.dias_laborales || diasLaborales,
          })
        : [],
      metadata: {
        semanaInicio,
        menuSemana,
        pedido: pedidoVisible,
        cantidadDias: dias.length,
        tieneMenuPublicado,
        esSemanaSugerencias,
      },
    };
  });
}

export function obtenerIndiceSemanaInicial(semanas) {
  const indiceActual = semanas.findIndex((semana) => semana.tipo === "actual");
  if (indiceActual >= 0) return indiceActual;
  return Math.max(0, Math.floor((semanas.length - 1) / 2));
}

export function tieneJornadaExtendida(semana) {
  return (semana?.metadata?.cantidadDias ?? semana?.dias?.length ?? 5) > 5;
}
