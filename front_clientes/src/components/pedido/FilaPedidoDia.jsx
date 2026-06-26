export default function FilaPedidoDia({ dia, plato }) {
  return (
    <li className="grid grid-cols-[5.75rem_1fr] gap-3 border-b border-[#f0ebe2] py-4 last:border-b-0">
      <span className="text-sm font-black text-[#2d5a27]">{dia}</span>
      <span className="text-right text-sm font-semibold leading-relaxed text-[#1a1a1a]">
        {plato}
      </span>
    </li>
  );
}
