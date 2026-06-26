export const rutasCliente = {
  inicio: "/pedido-semanal",
  pedidoSemanal: "/pedido-semanal",
  misPedidos: "/mis-pedidos",
  miCuenta: "/mi-cuenta",
};

export const rutasAutenticacion = {
  iniciarSesion: "/iniciar-sesion",
  crearCuenta: "/crear-cuenta",
  recuperarAcceso: "/recuperar-acceso",
};

export const rutasCompatibilidad = [
  { desde: "/pedido", hacia: rutasCliente.pedidoSemanal },
  { desde: "/historial", hacia: rutasCliente.misPedidos },
  { desde: "/perfil", hacia: rutasCliente.miCuenta },
  { desde: "/login", hacia: rutasAutenticacion.iniciarSesion },
  { desde: "/registro", hacia: rutasAutenticacion.crearCuenta },
  { desde: "/recuperar", hacia: rutasAutenticacion.recuperarAcceso },
];
