import { describe, it, expect } from "vitest";
import {
  construirTextoResumenLimite,
  construirTextoLimitePedido,
  construirDiasResumenPedido,
} from "./helpers.js";

describe("formulario/helpers", () => {
  it("arma resumen con limite semanal", () => {
    const texto = construirTextoResumenLimite({
      semanaInicio: "2026-06-22",
      limiteEmpresa: {
        tipo: "semanal",
        texto: "viernes 12:00",
      },
    });

    expect(texto).toContain("Semana del lunes 22/06");
    expect(texto.toLowerCase()).toContain("límite");
  });

  it("construye texto de corte diario", () => {
    const texto = construirTextoLimitePedido({
      limiteEmpresa: {
        tipo: "diario",
        hora: "11:30",
      },
    });

    expect(texto).toBe("Corte diario a las 11:30 hs");
  });

  it("mapea items por dia respetando dias base", () => {
    const dias = ["lunes", "martes", "miercoles"];
    const items = [{ dia: "martes", plato_nombre: "Milanesa" }];

    const resumen = construirDiasResumenPedido(items, dias);

    expect(resumen).toHaveLength(3);
    expect(resumen[0]).toEqual({ dia: "lunes", item: null });
    expect(resumen[1].item?.plato_nombre).toBe("Milanesa");
    expect(resumen[2]).toEqual({ dia: "miercoles", item: null });
  });
});
