import FilaPedidoDia from "./FilaPedidoDia.jsx";

export default function ListaDiasPedido({
  dias,
  compacta = false,
  modoConfirmado = false,
  modoMenuPublicado = false,
}) {
  return (
    <ul
      className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-0.5"
      aria-label="Días del pedido semanal"
    >
      {dias.map((item) => (
        <FilaPedidoDia
          key={item.clave || item.dia}
          dia={item.dia}
          fecha={item.fecha}
          modoConfirmado={modoConfirmado}
          modoMenuPublicado={modoMenuPublicado}
          opciones={item.opciones}
          plato={item.plato}
          compacta={compacta}
        />
      ))}
    </ul>
  );
}
