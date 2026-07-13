import * as repo from './vista-semanal.repository.js';
import * as cocinaRepository from '../cocina/cocina.repository.js';
import * as empresasRepository from '../empresas/empresas.repository.js';
import { calcularFechaServicio } from '../../utils/fecha.js';
import { ApiError } from '../../utils/ApiError.js';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

// Determina, para un plato con reglas de disponibilidad local, que dias de
// ESTA semana matchean cada regla (diario: todos; dia_semana: el dia que
// coincide; fecha: solo si cae en el rango de la semana).
function diasQueMatchean(row, fechasPorDia) {
  if (row.patron === 'diario') return DIAS;
  if (row.patron === 'dia_semana') return [row.dia_semana];
  if (row.patron === 'fecha') {
    const dia = DIAS.find((d) => fechasPorDia[d] === row.fecha);
    return dia ? [dia] : [];
  }
  return [];
}

export const getVistaSemanal = async (menuSemanalId) => {
  const menu = await repo.findMenu(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const [slots, fijosSiempre, disponibilidadLocal, totalEmpresasActivas] = await Promise.all([
    repo.findSlotsEspeciales(menuSemanalId),
    cocinaRepository.findFijosYSiempre(),
    repo.findDisponibilidadLocalSemana(menu.fecha_inicio, menu.fecha_fin),
    empresasRepository.countAll({ estado: 'activa' }),
  ]);

  const fechasPorDia = Object.fromEntries(DIAS.map((dia) => [dia, calcularFechaServicio(menu.fecha_inicio, dia)]));

  // plato_id -> Set<dia> en los que ese plato esta disponible por-kilo esta semana
  const porKiloPorPlato = new Map();
  for (const row of disponibilidadLocal) {
    const dias = diasQueMatchean(row, fechasPorDia);
    if (!porKiloPorPlato.has(row.plato_id)) porKiloPorPlato.set(row.plato_id, new Set());
    dias.forEach((dia) => porKiloPorPlato.get(row.plato_id).add(dia));
  }

  const celdas = [];
  // Claves (plato_id::dia) ya cubiertas por un slot 'especial' esta semana --
  // un plato puede tener ADEMAS una regla global 'siempre'/'fijo_dia' que
  // apunte al mismo dia (encontrado en verificacion manual: un plato con
  // dia_fijo='sabado' que tambien tenia un slot especial ese mismo sabado).
  // El slot especial es mas especifico para ESTA semana y no debe perder su
  // informacion de vianda al mezclarse con la entrada global de solo lectura.
  const yaCubiertoPorEspecial = new Set();

  // Celdas de platos 'especial': canal vianda editable, sugerido con la
  // vianda ya asignada al slot; canal por-kilo editable via
  // plato_disponibilidad_local (patron 'fecha' para ese dia puntual).
  for (const slot of slots) {
    yaCubiertoPorEspecial.add(`${slot.plato_id}::${slot.dia}`);
    const diasLocal = porKiloPorPlato.get(slot.plato_id);
    celdas.push({
      dia: slot.dia,
      opcion: slot.opcion,
      plato_id: slot.plato_id,
      plato_nombre: slot.plato_nombre,
      categoria: 'especial',
      vianda: {
        activo: true,
        vianda_id: slot.vianda_id,
        nombre_vianda: slot.nombre_vianda,
        editable: true,
        empresas: {
          activas: slot.empresas_activas,
          total: totalEmpresasActivas,
          nombres: slot.empresas_nombres,
        },
      },
      porKilo: {
        origen: diasLocal?.has(slot.dia) ? 'especial-fecha' : 'inactivo',
        editable: true,
      },
    });
  }

  // Celdas de platos 'siempre'/'fijo_dia': solo lectura en v1 (Premisa 5 /
  // Open Question #1) -- no se ofrece toggle de canal vianda ni excepcion
  // por-dia para el canal por-kilo.
  for (const plato of fijosSiempre) {
    const diasAMostrar = plato.disponibilidad === 'siempre' ? DIAS : [plato.dia_fijo];
    for (const dia of diasAMostrar) {
      if (!dia) continue;
      if (yaCubiertoPorEspecial.has(`${plato.id}::${dia}`)) continue;
      celdas.push({
        dia,
        opcion: null,
        plato_id: plato.id,
        plato_nombre: plato.nombre,
        categoria: plato.disponibilidad,
        vianda: null,
        porKilo: {
          origen: plato.disponibilidad,
          editable: false,
        },
      });
    }
  }

  return {
    semana: {
      id: menu.id,
      nombre: menu.nombre,
      fecha_inicio: menu.fecha_inicio,
      fecha_fin: menu.fecha_fin,
      estado: menu.estado,
    },
    dias: DIAS,
    celdas,
  };
};
