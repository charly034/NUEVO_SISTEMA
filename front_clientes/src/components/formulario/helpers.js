// Funciones puras y constantes de utilidad para el formulario de pedido

export const ORDEN_DIAS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

export function fechaLocalDesdeISO(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  const soloFecha = String(fecha).split("T")[0];
  const [y, m, d] = soloFecha.split("-").map(Number);
  if (!y || !m || !d) return new Date(fecha);
  return new Date(y, m - 1, d);
}

export function fechaCorta(fecha) {
  const date = fechaLocalDesdeISO(fecha);
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function fechaConDiaYHora(fecha) {
  const date = new Date(fecha);
  if (!date || Number.isNaN(date.getTime())) return "";
  const dia = date.toLocaleDateString("es-AR", { weekday: "long" });
  const fechaTxt = fechaCorta(date);
  const hora = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${dia} ${fechaTxt} a las ${hora} hs`;
}

export function construirTextoResumenLimite({ semanaInicio, limiteEmpresa }) {
  const semanaTxt = semanaInicio
    ? `Semana del lunes ${fechaCorta(semanaInicio)}`
    : "Semana seleccionada";
  if (!limiteEmpresa) return semanaTxt;
  const hora = limiteEmpresa.hora || "";
  const corte = limiteEmpresa.fechaCorte
    ? fechaConDiaYHora(limiteEmpresa.fechaCorte).replace(" a las ", " ")
    : "";
  if (limiteEmpresa.tipo === "semanal")
    return `${semanaTxt} · Límite ${corte || limiteEmpresa.texto || ""}`.trim();
  if (limiteEmpresa.tipo === "diario")
    return `${semanaTxt} · Corte diario${hora ? ` ${hora} hs` : ""}`;
  if (limiteEmpresa.tipo === "ambos")
    return `${semanaTxt} · Corte semanal y diario${hora ? ` ${hora} hs` : ""}`;
  return `${semanaTxt} · ${limiteEmpresa.texto || ""}`.trim();
}

export function construirTextoLimitePedido({ fechaLimite, limiteEmpresa }) {
  if (fechaLimite) {
    const dia = fechaLimite.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
    });
    const hora = fechaLimite.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Límite ${dia} a las ${hora} hs`;
  }

  if (!limiteEmpresa) return "";

  if (limiteEmpresa.tipo === "semanal") {
    const corte = limiteEmpresa.fechaCorte
      ? fechaConDiaYHora(limiteEmpresa.fechaCorte)
      : "";
    return corte ? `Límite ${corte}` : "Pedido semanal";
  }

  if (limiteEmpresa.tipo === "diario") {
    const hora = limiteEmpresa.hora || "";
    return hora ? `Corte diario a las ${hora} hs` : "Corte diario";
  }

  if (limiteEmpresa.tipo === "ambos") {
    const corte = limiteEmpresa.fechaCorte
      ? fechaConDiaYHora(limiteEmpresa.fechaCorte)
      : "";
    return corte ? `Límite ${corte}` : "Corte semanal y diario";
  }

  return limiteEmpresa.texto || "";
}

export function construirDiasResumenPedido(items = [], dias = []) {
  const itemsPorDia = new Map(items.map((item) => [item.dia, item]));
  const diasBase = dias.length ? dias : items.map((item) => item.dia);
  return diasBase.map((dia) => ({
    dia,
    item: itemsPorDia.get(dia) || null,
  }));
}

function isoLocal(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function lunesActualISO() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = hoy.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  hoy.setDate(hoy.getDate() + diff);
  return isoLocal(hoy);
}

export function sumarSemanasISO(fechaISO, semanas) {
  const base = fechaLocalDesdeISO(fechaISO);
  base.setDate(base.getDate() + semanas * 7);
  return isoLocal(base);
}

export function semanaPermitePedido(menuSemana) {
  if (!menuSemana || menuSemana.placeholder || !menuSemana.menu?.id) return false;

  const ahora = new Date();
  const fechaFin = fechaLocalDesdeISO(menuSemana.menu.fecha_fin);
  if (fechaFin) {
    fechaFin.setHours(23, 59, 59, 999);
    if (ahora > fechaFin) return false;
  }

  if (menuSemana.menu.fecha_limite_pedidos && new Date(menuSemana.menu.fecha_limite_pedidos) < ahora) {
    return false;
  }

  if (menuSemana.limiteEmpresa?.vencido) return false;

  return true;
}
