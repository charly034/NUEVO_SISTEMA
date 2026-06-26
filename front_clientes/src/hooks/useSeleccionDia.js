import { useEffect, useMemo, useState } from "react";
import { opcionSinPedido } from "../data/opcionesMenuMock.js";
import { pedidoService } from "../services/pedidoService.js";
import {
  construirTextoPlatoSeleccionado,
  crearSeleccionDesdeTexto,
  platoRequiereGuarnicion,
  seleccionDiaEsValida,
} from "../utils/reglasSeleccionPedido.js";

const filtrosIniciales = [
  { id: "todos", label: "Todos" },
  { id: "especiales", label: "Especiales" },
  { id: "pollo", label: "Pollo" },
  { id: "carne", label: "Carne" },
  { id: "vegetariano", label: "Vegetariano" },
  { id: "completos", label: "Completos" },
  { id: "guarnicion", label: "Con guarnición" },
];

function obtenerOpcionesDia(dia, opcionesCargadas) {
  return opcionesCargadas.length > 0 ? opcionesCargadas : dia?.opciones || [];
}

function obtenerSeleccionInicial(dia, opciones = []) {
  return dia?.seleccion || crearSeleccionDesdeTexto(dia?.plato, opciones) || null;
}

function coincideFiltro(plato, filtroActivo) {
  if (filtroActivo === "todos") return true;
  if (filtroActivo === "especiales") return Boolean(plato.destacado);
  if (filtroActivo === "completos") return plato.tipo === "plato_completo";
  if (filtroActivo === "guarnicion") return platoRequiereGuarnicion(plato);
  return plato.categoria === filtroActivo;
}

export function useSeleccionDia({
  cerrarAlConfirmar = true,
  dia,
  onCerrar,
  onConfirmar,
  service = pedidoService,
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState("todos");
  const [opcionesCargadas, setOpcionesCargadas] = useState([]);
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [errorOpciones, setErrorOpciones] = useState("");
  const opcionesDia = useMemo(
    () => obtenerOpcionesDia(dia, opcionesCargadas),
    [dia, opcionesCargadas],
  );
  const [seleccion, setSeleccion] = useState(() => obtenerSeleccionInicial(dia, opcionesDia));

  useEffect(() => {
    setBusqueda("");
    setFiltroActivo("todos");
    setOpcionesCargadas([]);
    setSeleccion(obtenerSeleccionInicial(dia, dia?.opciones || []));
  }, [dia]);

  useEffect(() => {
    if (!dia || dia.opciones?.length) return undefined;

    let activo = true;
    setCargandoOpciones(true);
    setErrorOpciones("");

    service.obtenerOpcionesMenuPorDia(dia.id || dia.clave)
      .then((opciones) => {
        if (!activo) return;
        setOpcionesCargadas(opciones);
        setSeleccion((seleccionActual) =>
          seleccionActual || obtenerSeleccionInicial(dia, opciones),
        );
      })
      .catch((error) => {
        if (!activo) return;
        setErrorOpciones(error.message || "No pudimos cargar las opciones del día.");
      })
      .finally(() => {
        if (activo) setCargandoOpciones(false);
      });

    return () => {
      activo = false;
    };
  }, [dia, service]);

  const opcionesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return opcionesDia
      .filter((plato) => plato.id !== opcionSinPedido.id)
      .filter((plato) => coincideFiltro(plato, filtroActivo))
      .filter((plato) => {
        if (!termino) return true;
        return `${plato.nombre} ${plato.descripcion} ${plato.etiquetas?.join(" ")}`
          .toLowerCase()
          .includes(termino);
      });
  }, [busqueda, filtroActivo, opcionesDia]);

  const opcionNoPedir = useMemo(
    () => opcionesDia.find((plato) => plato.id === opcionSinPedido.id) || opcionSinPedido,
    [opcionesDia],
  );

  const requiereGuarnicion = platoRequiereGuarnicion(seleccion?.plato);
  const seleccionValida = seleccionDiaEsValida(seleccion);
  const mensajeValidacion = !seleccion?.plato
    ? "Seleccioná un plato para este día."
    : requiereGuarnicion && !seleccion?.guarnicion
      ? "Elegí una guarnición para confirmar este plato."
      : "";

  function confirmarSeleccionCompleta(seleccionCompleta) {
    if (!seleccionDiaEsValida(seleccionCompleta)) return false;

    onConfirmar?.({
      ...dia,
      seleccion: seleccionCompleta,
      plato: construirTextoPlatoSeleccionado(seleccionCompleta),
    });

    if (cerrarAlConfirmar) onCerrar?.();
    return true;
  }

  function seleccionarPlato(plato) {
    const seleccionNueva = {
      plato,
      guarnicion: "",
    };

    setSeleccion(seleccionNueva);

    if (!platoRequiereGuarnicion(plato)) {
      confirmarSeleccionCompleta(seleccionNueva);
    }
  }

  function seleccionarGuarnicion(guarnicion) {
    const seleccionCompleta = {
      ...seleccion,
      guarnicion,
    };

    setSeleccion(seleccionCompleta);
    confirmarSeleccionCompleta(seleccionCompleta);
  }

  function confirmarSeleccionDia() {
    return confirmarSeleccionCompleta(seleccion);
  }

  return {
    busqueda,
    cambiarBusqueda: setBusqueda,
    cambiarFiltro: setFiltroActivo,
    cargandoOpciones,
    confirmarSeleccionDia,
    errorOpciones,
    filtrosPlatos: filtrosIniciales,
    filtroActivo,
    mensajeValidacion,
    opcionNoPedir,
    opcionesDia,
    opcionesFiltradas,
    requiereGuarnicion,
    seleccion,
    seleccionValida,
    seleccionarGuarnicion,
    seleccionarPlato,
  };
}
