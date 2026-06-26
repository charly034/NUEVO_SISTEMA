import { obtenerOpcionesMenuDia } from "./opcionesMenuMock.js";
import { crearSeleccionDesdeTexto } from "../utils/reglasSeleccionPedido.js";

const diasSemanaCompleta = [
  { clave: "lunes", dia: "Lunes", fecha: "2026-06-22" },
  { clave: "martes", dia: "Martes", fecha: "2026-06-23" },
  { clave: "miercoles", dia: "Miercoles", fecha: "2026-06-24" },
  { clave: "jueves", dia: "Jueves", fecha: "2026-06-25" },
  { clave: "viernes", dia: "Viernes", fecha: "2026-06-26" },
  { clave: "sabado", dia: "Sabado", fecha: "2026-06-27" },
  { clave: "domingo", dia: "Domingo", fecha: "2026-06-28" },
];

const diasLaborales = diasSemanaCompleta.slice(0, 5);

function crearDias(platos, ajustes = {}) {
  const diasBase = ajustes.incluirFinDeSemana ? diasSemanaCompleta : diasLaborales;

  return diasBase.map((dia) => {
    const opciones = obtenerOpcionesMenuDia(dia.clave);
    const plato = platos[dia.clave] || "Sin seleccionar";
    const bloqueado = ajustes.bloqueados?.includes(dia.clave) || false;
    const seleccion = crearSeleccionDesdeTexto(plato, opciones);

    return {
      id: dia.clave,
      clave: dia.clave,
      nombre: dia.dia,
      dia: dia.dia,
      fecha: dia.fecha,
      estado: bloqueado ? "bloqueado" : seleccion ? "seleccionado" : "sin_seleccionar",
      plato,
      seleccion,
      opciones,
      regla: ajustes.reglas?.[dia.clave],
      bloqueado,
    };
  });
}

function crearSemana({
  id,
  tipo,
  etiqueta,
  fechaDesde,
  fechaHasta,
  estado,
  tipoPlan,
  fechaActualMock,
  dias,
  metadata,
  sugerencias,
  recomendacionesUsuario,
}) {
  const desde = fechaDesde.slice(8, 10);
  const hasta = fechaHasta.slice(8, 10);
  const mesDesde = fechaDesde.slice(5, 7);
  const mesHasta = fechaHasta.slice(5, 7);

  return {
    id,
    tipo,
    etiqueta,
    fechaDesde,
    fechaHasta,
    rango: `${desde}/${mesDesde} al ${hasta}/${mesHasta}`,
    titulo: `Semana del lunes ${desde}/${mesDesde}`,
    estado,
    tipoPlan,
    modalidad: tipoPlan,
    limiteModificacion: { dia: "lunes", hora: "09:30" },
    fechaActualMock,
    dias,
    metadata,
    sugerencias,
    recomendacionesUsuario,
  };
}

export const fechaActualMockPedido = new Date("2026-06-22T08:45:00");

export const semanasMock = [
  crearSemana({
    id: "semana-2026-06-15",
    tipo: "anterior",
    etiqueta: "Semana anterior",
    fechaDesde: "2026-06-15",
    fechaHasta: "2026-06-19",
    estado: "cerrado",
    tipoPlan: "semanal",
    fechaActualMock: "2026-06-20T12:00:00",
    dias: crearDias({
      lunes: "Pollo al verdeo con pure de papas",
      martes: "Guiso de lentejas",
      miercoles: "Suprema caprese con pure de papas",
      jueves: "Pastel de papa",
      viernes: "Bife a la criolla con arroz",
    }),
  }),
  crearSemana({
    id: "semana-2026-06-22-semanal",
    tipo: "actual",
    etiqueta: "Semana actual",
    fechaDesde: "2026-06-22",
    fechaHasta: "2026-06-26",
    estado: "confirmado",
    tipoPlan: "semanal",
    fechaActualMock: "2026-06-22T08:45:00",
    dias: crearDias({
      lunes: "Pollo al verdeo con pure de papas",
      martes: "Hamburguesa de carne con pure de papas",
      miercoles: "Rollitos de pollo con pure de zapallo",
      jueves: "Zapallito relleno",
      viernes: "Tacos de pollo",
    }),
  }),
  crearSemana({
    id: "semana-2026-06-22-diario",
    tipo: "actual",
    etiqueta: "Semana actual",
    fechaDesde: "2026-06-22",
    fechaHasta: "2026-06-26",
    estado: "confirmado",
    tipoPlan: "diario",
    fechaActualMock: "2026-06-24T10:15:00",
    dias: crearDias({
      lunes: "Ravioles con bolognesa",
      martes: "Guiso de lentejas",
      miercoles: "Tortilla de papa rellena",
      jueves: "Pastel de papa",
      viernes: "Bife a la criolla con arroz",
    }),
  }),
  crearSemana({
    id: "semana-2026-06-29",
    tipo: "proxima",
    etiqueta: "Semana proxima",
    fechaDesde: "2026-06-29",
    fechaHasta: "2026-07-05",
    estado: "sin_pedido",
    tipoPlan: "semanal",
    fechaActualMock: "2026-06-22T08:45:00",
    dias: crearDias(
      {
        lunes: "Sin seleccionar",
        martes: "Sin seleccionar",
        miercoles: "Sin seleccionar",
        jueves: "Sin seleccionar",
        viernes: "Sin seleccionar",
        sabado: "Sin seleccionar",
        domingo: "Sin seleccionar",
      },
      { incluirFinDeSemana: true },
    ),
  }),
  crearSemana({
    id: "semana-2026-07-06",
    tipo: "proxima",
    etiqueta: "Semana proxima",
    fechaDesde: "2026-07-06",
    fechaHasta: "2026-07-10",
    estado: "sin_menu",
    tipoPlan: "semanal",
    fechaActualMock: "2026-06-22T08:45:00",
    sugerencias: [
      { dia: "Lunes", plato: "Milanesa con pure de papas" },
      { dia: "Martes", plato: "Tarta de verduras con ensalada" },
      { dia: "Miercoles", plato: "Wok de pollo con arroz" },
    ],
    recomendacionesUsuario: [],
    metadata: {
      esSemanaSugerencias: true,
    },
    dias: crearDias({
      lunes: "Sin seleccionar",
      martes: "Sin seleccionar",
      miercoles: "Sin seleccionar",
      jueves: "Sin seleccionar",
      viernes: "Sin seleccionar",
    }),
  }),
];

export const indiceInicialSemanaMock = 1;
