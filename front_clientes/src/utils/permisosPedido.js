export function tienePedidoSemana(semana) {
  const estadoPedido = semana?.metadata?.pedido?.estado;
  if (semana?.estado === "cancelado" || estadoPedido === "cancelado") return false;
  return Boolean(semana?.metadata?.pedidoId || semana?.estado === "confirmado");
}

export function tieneMenuSemana(semana) {
  return Boolean(semana?.metadata?.tieneMenuPublicado);
}

export function semanaEstaCerrada(semana) {
  return ["cerrado", "fuera_de_plazo"].includes(semana?.estado);
}

export function diaEstaSinServicio(dia) {
  return Boolean(dia?.motivo) || dia?.estado === "sin_servicio" || dia?.estado === "feriado";
}

export function diaEsEditablePedido(dia, semana) {
  if (!dia || semanaEstaCerrada(semana)) return false;
  if (dia.bloqueado) return false;
  if (diaEstaSinServicio(dia)) return false;
  return (dia.opciones || []).length > 0 || Boolean(dia.seleccion) || dia.estado === "sin_pedido_por_defecto";
}

export function obtenerDiasEditablesPedido(semana) {
  return (semana?.dias || []).filter((dia) => diaEsEditablePedido(dia, semana));
}

export function puedeHacerPedidoSemana(semana) {
  return tieneMenuSemana(semana) && obtenerDiasEditablesPedido(semana).length > 0;
}

export function debeAbrirPedidoSoloLectura(semana) {
  return tienePedidoSemana(semana) && !puedeHacerPedidoSemana(semana);
}

export function mensajePedidoNoEditable(semana) {
  const limite = semana?.metadata?.menuSemana?.limiteEmpresa;
  if (limite?.texto) return limite.texto;
  if (semanaEstaCerrada(semana)) return "El plazo para esta semana ya cerro.";
  return "No quedan dias habilitados para cargar pedido.";
}
