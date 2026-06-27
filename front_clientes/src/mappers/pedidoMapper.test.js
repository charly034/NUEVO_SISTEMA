import { describe, expect, it } from "vitest";
import { construirPayloadActualizarPedido } from "./pedidoMapper.js";

describe("pedidoMapper", () => {
  it("conserva la guarnicion de dias ya guardados al modificar otro dia", () => {
    const semana = {
      id: "2026-06-29",
      metadata: {
        menuSemanalId: 12,
      },
      dias: [
        {
          clave: "martes",
          fecha: "2026-06-30",
          seleccion: {
            plato: {
              id: "menu-10-martes-A",
              platoId: 10,
              opcion: "A",
              requiereGuarnicion: true,
            },
            platoId: 10,
            guarnicion: {
              id: 3,
              nombre: "Pure de papas",
            },
            guarnicionId: 3,
            sinPedido: false,
          },
        },
        {
          clave: "jueves",
          fecha: "2026-07-02",
          seleccion: {
            plato: {
              id: "fijo-22",
              platoId: 22,
              opcion: null,
              requiereGuarnicion: false,
            },
            platoId: 22,
            guarnicion: "",
            guarnicionId: null,
            sinPedido: false,
          },
        },
      ],
    };

    const payload = construirPayloadActualizarPedido({
      pedidoId: 44,
      semana,
    });

    expect(payload.dias).toEqual([
      expect.objectContaining({
        diaId: "martes",
        platoId: 10,
        guarnicionId: 3,
        opcion: "A",
      }),
      expect.objectContaining({
        diaId: "jueves",
        platoId: 22,
        guarnicionId: null,
        opcion: null,
      }),
    ]);
  });

  it("recupera el id de guarnicion desde el texto del dia si la seleccion rehidratada viene incompleta", () => {
    const semana = {
      id: "2026-06-29",
      dias: [
        {
          clave: "miercoles",
          fecha: "2026-07-01",
          plato: "Hamburguesa de Zanahoria con ensalada de rucula",
          seleccion: {
            plato: {
              id: "menu-15-miercoles-B",
              platoId: 15,
              opcion: "B",
              requiereGuarnicion: true,
              guarniciones: [
                { id: 7, nombre: "Ensalada de rúcula" },
                { id: 8, nombre: "Pure de zapallo" },
              ],
            },
            platoId: 15,
            guarnicion: "",
            guarnicionId: null,
            sinPedido: false,
          },
        },
      ],
    };

    const payload = construirPayloadActualizarPedido({
      pedidoId: 45,
      semana,
    });

    expect(payload.dias[0]).toEqual(
      expect.objectContaining({
        diaId: "miercoles",
        platoId: 15,
        guarnicionId: 7,
        opcion: "B",
      }),
    );
  });
});
