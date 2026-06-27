import { obtenerOpcionesMenuDia } from "./opcionesMenuMock.js";
import { crearSeleccionDesdeTexto } from "../utils/reglasSeleccionPedido.js";

const diasSemanaCompleta = [
  { clave: "lunes", dia: "Lunes", desplazamiento: 0 },
  { clave: "martes", dia: "Martes", desplazamiento: 1 },
  { clave: "miercoles", dia: "Miercoles", desplazamiento: 2 },
  { clave: "jueves", dia: "Jueves", desplazamiento: 3 },
  { clave: "viernes", dia: "Viernes", desplazamiento: 4 },
  { clave: "sabado", dia: "Sabado", desplazamiento: 5 },
  { clave: "domingo", dia: "Domingo", desplazamiento: 6 },
];

const diasLaborales = diasSemanaCompleta.slice(0, 5);

function fechaDesdeISO(fechaISO) {
  const [anio, mes, dia] = String(fechaISO).split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function crearDias(platos, ajustes = {}) {
  const diasBase = ajustes.incluirFinDeSemana ? diasSemanaCompleta : diasLaborales;
  const inicio = fechaDesdeISO(ajustes.fechaDesde || "2026-06-22");

  return diasBase.map((dia) => {
    const fechaDia = new Date(inicio);
    fechaDia.setDate(inicio.getDate() + dia.desplazamiento);
    const opciones = obtenerOpcionesMenuDia(dia.clave);
    const plato = platos[dia.clave] || "Sin seleccionar";
    const bloqueado = ajustes.bloqueados?.includes(dia.clave) || false;
    const seleccion = crearSeleccionDesdeTexto(plato, opciones);

    return {
      id: dia.clave,
      clave: dia.clave,
      nombre: dia.dia,
      dia: dia.dia,
      fecha: fechaDia.toISOString().slice(0, 10),
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
    }, { fechaDesde: "2026-06-15" }),
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
    }, { fechaDesde: "2026-06-22" }),
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
      { fechaDesde: "2026-06-29", incluirFinDeSemana: true },
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
    }, { fechaDesde: "2026-07-06" }),
  }),
];

export const indiceInicialSemanaMock = 1;
