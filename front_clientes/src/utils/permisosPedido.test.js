import { describe, expect, it } from "vitest";
import { tienePedidoSemana } from "./permisosPedido.js";

describe("permisosPedido", () => {
  it("no considera activo un pedido cancelado aunque quede pedidoId en metadata", () => {
    expect(
      tienePedidoSemana({
        estado: "sin_pedido",
        metadata: {
          pedidoId: 25,
          pedido: { id: 25, estado: "cancelado" },
        },
      }),
    ).toBe(false);
  });

  it("considera activo un pedido no cancelado", () => {
    expect(
      tienePedidoSemana({
        estado: "confirmado",
        metadata: {
          pedidoId: 26,
          pedido: { id: 26, estado: "pendiente" },
        },
      }),
    ).toBe(true);
  });
});
