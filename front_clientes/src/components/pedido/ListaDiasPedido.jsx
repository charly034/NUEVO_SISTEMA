import FilaPedidoDia from "./FilaPedidoDia.jsx";

export default function ListaDiasPedido({ dias }) {
  return (
    <ul className="divide-y-0" aria-label="Días del pedido semanal">
      {dias.map((item) => (
        <FilaPedidoDia key={item.dia} dia={item.dia} plato={item.plato} />
      ))}
    </ul>
  );
}
