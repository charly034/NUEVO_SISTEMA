import { describe, expect, it } from "vitest";
import {
  adaptarSemanasPedido,
  obtenerIndiceSemanaInicial,
} from "./adaptadoresPedido.js";

const empleadoDomingo = {
  id: 1,
  nombre: "Florencia",
  empresa: { dias_laborales: "lunes_domingo" },
};

describe("adaptarSemanasPedido", () => {
  it("muestra semanas con menu publicado y agrega la siguiente sin menu con sugerencias", () => {
    const semanas = adaptarSemanasPedido({
      empleado: empleadoDomingo,
      fechaReferencia: new Date(2026, 5, 24),
      menuData: {
        menus_disponibles: [
          {
            disponible: true,
            dias_laborales: "lunes_domingo",
            menu: {
              id: 10,
              fecha_inicio: "2026-06-22",
              fecha_fin: "2026-06-28",
              sin_servicio: [],
            },
          },
          {
            disponible: true,
            dias_laborales: "lunes_domingo",
            menu: {
              id: 11,
              fecha_inicio: "2026-06-29",
              fecha_fin: "2026-07-05",
              sin_servicio: [],
            },
          },
        ],
      },
      historial: [],
    });

    expect(semanas.map((semana) => semana.id)).toEqual([
      "2026-06-22",
      "2026-06-29",
      "2026-07-06",
    ]);
    expect(semanas.at(-1)).toMatchObject({
      estado: "sin_menu",
      metadata: { esSemanaSugerencias: true },
    });
    expect(semanas.at(-1).sugerencias.length).toBeGreaterThan(0);
    expect(obtenerIndiceSemanaInicial(semanas)).toBe(0);
  });

  it("arma semanas con siete dias cuando la empresa trabaja de lunes a domingo", () => {
    const semanas = adaptarSemanasPedido({
      empleado: empleadoDomingo,
      fechaReferencia: new Date(2026, 5, 24),
      menuData: {
        menus_disponibles: [
          {
            disponible: true,
            dias_laborales: "lunes_domingo",
            menu: {
              id: 10,
              fecha_inicio: "2026-06-22",
              fecha_fin: "2026-06-28",
              sin_servicio: [],
            },
          },
        ],
      },
      historial: [
        {
          id: 20,
          estado: "pendiente",
          semana_inicio: "2026-06-22",
          items: [
            { dia: "sabado", plato_nombre: "Pollo al horno" },
            { dia: "domingo", plato_nombre: "Ravioles caseros" },
          ],
        },
      ],
    });

    const semanaActual = semanas.find((semana) => semana.tipo === "actual");

    expect(semanaActual.dias).toHaveLength(7);
    expect(semanaActual.rango).toBe("22/06 al 28/06");
    expect(semanaActual.estado).toBe("confirmado");
    expect(semanaActual.dias.at(-2)).toMatchObject({
      dia: "Sábado",
      plato: "Pollo al horno",
    });
    expect(semanaActual.dias.at(-1)).toMatchObject({
      dia: "Domingo",
      plato: "Ravioles caseros",
    });
  });

  it("devuelve como indice inicial la semana actual", () => {
    const semanas = [
      { id: "anterior", tipo: "anterior" },
      { id: "actual", tipo: "actual" },
      { id: "proxima", tipo: "proxima" },
    ];

    expect(obtenerIndiceSemanaInicial(semanas)).toBe(1);
  });
});
