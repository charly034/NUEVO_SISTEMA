export const opcionSinPedido = {
  id: "sin-pedido",
  nombre: "Sin pedido para este día",
  descripcion: "No recibir comida este día",
  categoria: "sin_pedido",
  tipo: "sin_pedido",
  requiereGuarnicion: false,
  etiquetas: [],
  guarniciones: [],
};

const guarnicionesClasicas = [
  "Puré de papas",
  "Arroz",
  "Ensalada",
  "Puré de zapallo",
  "Verduras asadas",
];

const platosBase = [
  {
    id: "pollo-verdeo",
    nombre: "Pollo al verdeo",
    descripcion: "Principal con salsa suave",
    categoria: "pollo",
    tipo: "principal_con_guarnicion",
    requiereGuarnicion: true,
    etiquetas: ["Pollo", "Requiere guarnición"],
    guarniciones: guarnicionesClasicas,
  },
  {
    id: "ravioles-bolognesa",
    nombre: "Ravioles con bolognesa",
    descripcion: "Pasta casera con salsa",
    categoria: "pastas",
    tipo: "plato_completo",
    requiereGuarnicion: false,
    etiquetas: ["Pastas", "Plato completo"],
    guarniciones: [],
  },
  {
    id: "hamburguesa-carne",
    nombre: "Hamburguesa de carne",
    descripcion: "Medallón casero",
    categoria: "carne",
    tipo: "principal_con_guarnicion",
    requiereGuarnicion: true,
    etiquetas: ["Carne", "Requiere guarnición"],
    guarniciones: guarnicionesClasicas,
  },
  {
    id: "guiso-lentejas",
    nombre: "Guiso de lentejas",
    descripcion: "Plato completo y rendidor",
    categoria: "vegetariano",
    tipo: "plato_completo",
    requiereGuarnicion: false,
    etiquetas: ["Vegetariano", "Plato completo"],
    guarniciones: [],
  },
  {
    id: "tortilla-rellena",
    nombre: "Tortilla de papa rellena",
    descripcion: "Con ensalada fresca",
    categoria: "vegetariano",
    tipo: "plato_completo",
    requiereGuarnicion: false,
    etiquetas: ["Vegetariano", "Incluye ensalada"],
    guarniciones: [],
  },
  {
    id: "rollitos-pollo",
    nombre: "Rollitos de pollo",
    descripcion: "Principal liviano",
    categoria: "pollo",
    tipo: "principal_con_guarnicion",
    requiereGuarnicion: true,
    etiquetas: ["Pollo", "Requiere guarnición", "Liviano"],
    guarniciones: guarnicionesClasicas,
  },
  {
    id: "zapallito-relleno",
    nombre: "Zapallito relleno",
    descripcion: "Con salsa fileto",
    categoria: "vegetariano",
    tipo: "plato_completo",
    requiereGuarnicion: false,
    etiquetas: ["Vegetariano", "Liviano"],
    guarniciones: [],
  },
  {
    id: "pastel-papa",
    nombre: "Pastel de papa",
    descripcion: "Clásico de la casa",
    categoria: "carne",
    tipo: "plato_completo",
    requiereGuarnicion: false,
    etiquetas: ["Carne", "Plato completo"],
    guarniciones: [],
  },
  {
    id: "tacos-pollo",
    nombre: "Tacos de pollo",
    descripcion: "Con ensalada",
    categoria: "pollo",
    tipo: "plato_completo",
    requiereGuarnicion: false,
    etiquetas: ["Pollo", "Incluye ensalada"],
    guarniciones: [],
  },
  {
    id: "bife-criolla",
    nombre: "Bife a la criolla",
    descripcion: "Principal tradicional",
    categoria: "carne",
    tipo: "principal_con_guarnicion",
    requiereGuarnicion: true,
    etiquetas: ["Carne", "Requiere guarnición"],
    guarniciones: guarnicionesClasicas,
  },
  {
    id: "tarta-verduras",
    nombre: "Tarta de verduras",
    descripcion: "Opción vegetariana",
    categoria: "vegetariano",
    tipo: "plato_completo",
    requiereGuarnicion: false,
    etiquetas: ["Vegetariano", "Incluye ensalada"],
    guarniciones: [],
  },
  {
    id: "milanesa-pollo",
    nombre: "Milanesa de pollo",
    descripcion: "Principal con guarnición",
    categoria: "milanesas",
    tipo: "principal_con_guarnicion",
    requiereGuarnicion: true,
    etiquetas: ["Milanesas", "Pollo", "Requiere guarnición"],
    guarniciones: guarnicionesClasicas,
  },
  {
    id: "wok-vegetales",
    nombre: "Wok de vegetales",
    descripcion: "Salteado liviano",
    categoria: "vegetariano",
    tipo: "plato_completo",
    requiereGuarnicion: false,
    etiquetas: ["Vegetariano", "Liviano"],
    guarniciones: [],
  },
  {
    id: "suprema-caprese",
    nombre: "Suprema caprese",
    descripcion: "Principal con guarnición",
    categoria: "milanesas",
    tipo: "principal_con_guarnicion",
    requiereGuarnicion: true,
    etiquetas: ["Milanesas", "Pollo", "Requiere guarnición"],
    guarniciones: guarnicionesClasicas,
  },
  {
    id: "merluza-romana",
    nombre: "Merluza a la romana",
    descripcion: "Pescado con guarnición",
    categoria: "pescado",
    tipo: "principal_con_guarnicion",
    requiereGuarnicion: true,
    etiquetas: ["Pescado", "Requiere guarnición"],
    guarniciones: guarnicionesClasicas,
  },
  {
    id: "berenjenas-parmesana",
    nombre: "Berenjenas a la parmesana",
    descripcion: "Opción vegetariana al horno",
    categoria: "vegetariano",
    tipo: "plato_completo",
    requiereGuarnicion: false,
    etiquetas: ["Vegetariano"],
    guarniciones: [],
  },
];

const idsEspecialesPorDia = {
  lunes: ["pollo-verdeo", "ravioles-bolognesa"],
  martes: ["hamburguesa-carne", "guiso-lentejas"],
  miercoles: ["tortilla-rellena", "rollitos-pollo"],
  jueves: ["zapallito-relleno", "pastel-papa"],
  viernes: ["tacos-pollo", "merluza-romana"],
  sabado: ["milanesa-pollo", "tarta-verduras"],
  domingo: ["pastel-papa", "ravioles-bolognesa"],
};

const ordenCategorias = [
  "pollo",
  "carne",
  "milanesas",
  "pescado",
  "pastas",
  "vegetariano",
];

function enriquecerPlato(plato, destacado = false) {
  if (!destacado) return { ...plato };

  return {
    ...plato,
    destacado: true,
  };
}

function ordenarPorCategoria(platos) {
  return [...platos].sort((a, b) => {
    const ordenA = ordenCategorias.indexOf(a.categoria);
    const ordenB = ordenCategorias.indexOf(b.categoria);
    return (ordenA === -1 ? 99 : ordenA) - (ordenB === -1 ? 99 : ordenB);
  });
}

function crearOpcionesDia(claveDia) {
  const idsEspeciales = idsEspecialesPorDia[claveDia] || idsEspecialesPorDia.lunes;
  const especiales = idsEspeciales
    .map((id) => platosBase.find((plato) => plato.id === id))
    .filter(Boolean)
    .map((plato) => enriquecerPlato(plato, true));

  const restantes = ordenarPorCategoria(
    platosBase.filter((plato) => !idsEspeciales.includes(plato.id)),
  ).map((plato) => enriquecerPlato(plato));

  return [...especiales, ...restantes, opcionSinPedido];
}

export const opcionesMenuPorDia = {
  lunes: crearOpcionesDia("lunes"),
  martes: crearOpcionesDia("martes"),
  miercoles: crearOpcionesDia("miercoles"),
  jueves: crearOpcionesDia("jueves"),
  viernes: crearOpcionesDia("viernes"),
  sabado: crearOpcionesDia("sabado"),
  domingo: crearOpcionesDia("domingo"),
};

export function obtenerOpcionesMenuDia(claveDia) {
  return opcionesMenuPorDia[claveDia] || crearOpcionesDia("lunes");
}

export function obtenerMenusPublicadosDia(claveDia) {
  return obtenerOpcionesMenuDia(claveDia)
    .filter((plato) => plato.destacado)
    .slice(0, 2);
}
