import OpcionPlatoCard from "./OpcionPlatoCard.jsx";

export default function ListaOpcionesPlato({
  onSeleccionar,
  opciones,
  platoSeleccionado,
  renderSeleccion,
}) {
  if (opciones.length === 0) {
    return (
      <p className="rounded-3xl border border-[#ebe6dc] bg-white p-4 text-center text-sm font-bold text-[#716c64]">
        No encontramos platos con esa búsqueda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {opciones.map((plato) => {
        const estaSeleccionado = platoSeleccionado?.id === plato.id;

        return (
          <div key={plato.id} className="space-y-2">
            <OpcionPlatoCard
              plato={plato}
              seleccionado={estaSeleccionado}
              onSeleccionar={onSeleccionar}
            />
            {estaSeleccionado ? renderSeleccion?.(plato) : null}
          </div>
        );
      })}
    </div>
  );
}
