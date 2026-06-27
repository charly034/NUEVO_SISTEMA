import { useEffect, useMemo, useState } from "react";
import { SIN_PEDIDO_ID } from "../constants/estadosPedido.js";
import { useOpcionesMenu } from "./useOpcionesMenu.js";
import {
  construirTextoPlatoSeleccionado,
  crearSeleccionPedido,
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

const opcionSinPedidoFallback = {
  id: SIN_PEDIDO_ID,
  nombre: "Sin pedido para este día",
  descripcion: "No recibir comida este día",
  categoria: "sin_pedido",
  tipo: "sin_pedido",
  requiereGuarnicion: false,
  etiquetas: [],
  guarniciones: [],
};

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
  empresaId,
  onCerrar,
  onConfirmar,
  semanaId,
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState("todos");
  const [opcionesDia, setOpcionesDia] = useState(dia?.opciones || []);
  const [seleccion, setSeleccion] = useState(() => obtenerSeleccionInicial(dia, opcionesDia));
  const {
    cargandoOpciones,
    errorOpciones,
    obtenerOpcionesDia,
  } = useOpcionesMenu({ empresaId, semanaId });

  useEffect(() => {
    let activo = true;
    setBusqueda("");
    setFiltroActivo("todos");
    setOpcionesDia(dia?.opciones || []);
    setSeleccion(obtenerSeleccionInicial(dia, dia?.opciones || []));

    obtenerOpcionesDia(dia).then((opciones) => {
      if (!activo || opciones.length === 0) return;
      setOpcionesDia(opciones);
      setSeleccion((seleccionActual) =>
        seleccionActual || obtenerSeleccionInicial(dia, opciones),
      );
    });

    return () => {
      activo = false;
    };
  }, [dia, obtenerOpcionesDia]);

  const opcionesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return opcionesDia
      .filter((plato) => plato.id !== SIN_PEDIDO_ID)
      .filter((plato) => coincideFiltro(plato, filtroActivo))
      .filter((plato) => {
        if (!termino) return true;
        return `${plato.nombre} ${plato.descripcion} ${plato.etiquetas?.join(" ")}`
          .toLowerCase()
          .includes(termino);
      });
  }, [busqueda, filtroActivo, opcionesDia]);

  const opcionNoPedir = useMemo(
    () => opcionesDia.find((plato) => plato.id === SIN_PEDIDO_ID) || opcionSinPedidoFallback,
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
    const seleccionNueva = crearSeleccionPedido(plato);

    setSeleccion(seleccionNueva);

    if (!platoRequiereGuarnicion(plato)) {
      confirmarSeleccionCompleta(seleccionNueva);
    }
  }

  function seleccionarGuarnicion(guarnicion) {
    const seleccionCompleta = crearSeleccionPedido(seleccion?.plato, guarnicion);

    setSeleccion(seleccionCompleta);
    confirmarSeleccionCompleta(seleccionCompleta);
  }

  function confirmarSeleccionDia() {
    return confirmarSeleccionCompleta(seleccion);
  }

  function cancelarSeleccion() {
    setSeleccion(obtenerSeleccionInicial(dia, opcionesDia));
    onCerrar?.();
  }

  return {
    busqueda,
    cambiarBusqueda: setBusqueda,
    cambiarFiltro: setFiltroActivo,
    cancelarSeleccion,
    cargandoOpciones,
    confirmarSeleccionDia,
    errorOpciones,
    filtrosPlatos: filtrosIniciales,
    filtroActivo,
    guarnicionTemporal: seleccion?.guarnicion || "",
    mensajeValidacion,
    opcionNoPedir,
    opcionesDia,
    opcionesFiltradas,
    platoTemporal: seleccion?.plato || null,
    requiereGuarnicion,
    seleccion,
    seleccionValida,
    seleccionarGuarnicion,
    seleccionarPlato,
  };
}
