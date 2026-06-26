export const pedidoMock = {
  id: "pedido-mock-2026-06-22",
  empresaId: "empresa-la-quinta-demo",
  usuarioId: "usuario-florencia-demo",
  semanaId: "2026-06-22-semanal",
  estado: "confirmado",
  dias: [
    {
      diaId: "lunes",
      fecha: "2026-06-22",
      platoId: "pollo-verdeo",
      guarnicionId: "pure-papas",
      sinPedido: false,
    },
    {
      diaId: "martes",
      fecha: "2026-06-23",
      platoId: "hamburguesa-carne",
      guarnicionId: "pure-papas",
      sinPedido: false,
    },
  ],
};

export const usuarioPedidoMock = {
  empresaId: "empresa-la-quinta-demo",
  usuarioId: "usuario-florencia-demo",
};
