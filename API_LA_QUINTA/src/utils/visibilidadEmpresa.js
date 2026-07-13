// Filtro de visibilidad por empresa, compartido entre pedidos.repository.js y
// cualquier query futura que necesite resolver "esta empresa puede ver este
// slot/plato". Modelo de allowlist: sin filas en la tabla de visibilidad =
// visible para todas las empresas; con filas = solo para las listadas. Si
// empresaId es null (sin contexto de empresa), no se restringe nada.
//
// paramIndex es la posicion ($1, $2, ...) del parametro empresaId en la query
// que use el filtro -- necesario porque node-postgres no soporta parametros
// con nombre, y cada query que lo usa tiene una forma distinta de parametros.
export function filtroVisibilidadSlot(paramIndex, slotAlias = 'msd') {
  return `(
  $${paramIndex}::integer IS NULL
  OR NOT EXISTS (SELECT 1 FROM menu_empresa_visibilidad mev WHERE mev.menu_semanal_dia_id = ${slotAlias}.id)
  OR EXISTS (SELECT 1 FROM menu_empresa_visibilidad mev WHERE mev.menu_semanal_dia_id = ${slotAlias}.id AND mev.empresa_id = $${paramIndex})
)`;
}

export function filtroVisibilidadPlato(paramIndex, platoAlias = 'p') {
  return `(
  $${paramIndex}::integer IS NULL
  OR NOT EXISTS (SELECT 1 FROM plato_empresa_visibilidad pev WHERE pev.plato_id = ${platoAlias}.id)
  OR EXISTS (SELECT 1 FROM plato_empresa_visibilidad pev WHERE pev.plato_id = ${platoAlias}.id AND pev.empresa_id = $${paramIndex})
)`;
}

// Visibilidad de un FIJO por semana (menu_semanal_fijos_visibilidad) --
// reemplaza a filtroVisibilidadPlato (catalogo) para fijos: quien puede
// verlos es una decision de la semana puntual, no del catalogo (hallazgo de
// sesion 2026-07-13). menuSemanalIdParamIndex referencia el menu_semanal_id
// de ESTE llamado -- a diferencia de filtroVisibilidadSlot/Plato, esta
// consulta no viene ya unida a menu_semanal_dias, asi que el id de la
// semana hay que pasarlo aparte como parametro.
export function filtroVisibilidadFijoSemana(empresaIdParamIndex, menuSemanalIdParamIndex, platoAlias = 'p') {
  return `(
  $${empresaIdParamIndex}::integer IS NULL
  OR $${menuSemanalIdParamIndex}::integer IS NULL
  OR NOT EXISTS (SELECT 1 FROM menu_semanal_fijos_visibilidad msfv WHERE msfv.menu_semanal_id = $${menuSemanalIdParamIndex} AND msfv.plato_id = ${platoAlias}.id)
  OR EXISTS (SELECT 1 FROM menu_semanal_fijos_visibilidad msfv WHERE msfv.menu_semanal_id = $${menuSemanalIdParamIndex} AND msfv.plato_id = ${platoAlias}.id AND msfv.empresa_id = $${empresaIdParamIndex})
)`;
}
