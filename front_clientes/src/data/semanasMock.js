import { obtenerOpcionesMenuDia } from "./opcionesMenuMock.js";

const diasSemanaCompleta = [
  { clave: "lunes", dia: "Lunes", fecha: "2026-06-22" },
  { clave: "martes", dia: "Martes", fecha: "2026-06-23" },
  { clave: "miercoles", dia: "Miércoles", fecha: "2026-06-24" },
  { clave: "jueves", dia: "Jueves", fecha: "2026-06-25" },
  { clave: "viernes", dia: "Viernes", fecha: "2026-06-26" },
  { clave: "sabado", dia: "Sábado", fecha: "2026-06-27" },
  { clave: "domingo", dia: "Domingo", fecha: "2026-06-28" },
];

const diasLaborales = diasSemanaCompleta.slice(0, 5);

function crearDias(platos, ajustes = {}) {
  const diasBase = ajustes.incluirFinDeSemana ? diasSemanaCompleta : diasLaborales;

  return diasBase.map((dia) => ({
    ...dia,
    plato: platos[dia.clave] || "Sin seleccionar",
    opciones: obtenerOpcionesMenuDia(dia.clave),
    regla: ajustes.reglas?.[dia.clave],
    bloqueado: ajustes.bloqueados?.includes(dia.clave),
  }));
}

export const fechaActualMockPedido = new Date("2026-06-22T08:45:00");

export const semanasMock = [
  {
    id: "2026-06-15",
    tipo: "anterior",
    etiqueta: "Semana anterior",
    rango: "15/06 al 19/06",
    titulo: "Semana del lunes 15/06",
    estado: "cerrado",
    modalidad: "semanal",
    limiteModificacion: { dia: "lunes", hora: "09:30" },
    fechaActualMock: "2026-06-20T12:00:00",
    dias: crearDias({
      lunes: "Pollo al verdeo con puré",
      martes: "Guiso de lentejas",
      miercoles: "Suprema caprese con puré",
      jueves: "Pastel de papa",
      viernes: "Bife a la criolla",
    }),
  },
  {
    id: "2026-06-22-semanal",
    tipo: "actual",
    etiqueta: "Semana actual",
    rango: "22/06 al 26/06",
    titulo: "Semana del lunes 22/06",
    estado: "confirmado",
    modalidad: "semanal",
    limiteModificacion: { dia: "lunes", hora: "09:30" },
    fechaActualMock: "2026-06-22T08:45:00",
    dias: crearDias({
      lunes: "Pollo al verdeo con puré",
      martes: "Hamburguesa de carne con puré de papas",
      miercoles: "Rollitos de pollo con puré de zapallo",
      jueves: "Zapallito relleno con salsa fileto",
      viernes: "Tacos de pollo con ensalada",
    }),
  },
  {
    id: "2026-06-22-diario",
    tipo: "actual",
    etiqueta: "Semana actual",
    rango: "22/06 al 26/06",
    titulo: "Semana del lunes 22/06",
    estado: "confirmado",
    modalidad: "diario",
    limiteModificacion: { hora: "09:30" },
    fechaActualMock: "2026-06-24T10:15:00",
    dias: crearDias({
      lunes: "Ravioles con bolognesa",
      martes: "Guiso de lentejas",
      miercoles: "Tortilla de papa rellena con ensalada",
      jueves: "Pastel de papa",
      viernes: "Bife a la criolla",
    }),
  },
  {
    id: "2026-06-29",
    tipo: "proxima",
    etiqueta: "Semana próxima",
    rango: "29/06 al 05/07",
    titulo: "Semana del lunes 29/06",
    estado: "sin_pedido",
    modalidad: "semanal",
    limiteModificacion: { dia: "lunes", hora: "09:30" },
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
  },
  {
    id: "2026-07-06",
    tipo: "proxima",
    etiqueta: "Semana próxima",
    rango: "06/07 al 10/07",
    titulo: "Semana del lunes 06/07",
    estado: "sin_menu",
    modalidad: "semanal",
    limiteModificacion: { dia: "lunes", hora: "09:30" },
    fechaActualMock: "2026-06-22T08:45:00",
    sugerencias: [
      { dia: "Lunes", plato: "Milanesa con puré de papas" },
      { dia: "Martes", plato: "Tarta de verduras con ensalada" },
      { dia: "Miércoles", plato: "Wok de pollo con arroz" },
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
  },
];

export const indiceInicialSemanaMock = 1;
