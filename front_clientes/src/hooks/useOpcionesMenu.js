import { useCallback, useMemo, useState } from "react";
import { menuService } from "../services/menuService.js";

export function useOpcionesMenu({
  empresaId = "empresa_demo",
  service = menuService,
  semanaId,
} = {}) {
  const [opcionesPorDia, setOpcionesPorDia] = useState({});
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [errorOpciones, setErrorOpciones] = useState("");
  const [textoBusqueda, setTextoBusqueda] = useState("");

  const obtenerOpcionesDia = useCallback(
    async (dia) => {
      if (!dia) return [];
      if (dia.opciones?.length) return dia.opciones;

      const diaId = dia.id || dia.clave;
      if (opcionesPorDia[diaId]) return opcionesPorDia[diaId];

      setCargandoOpciones(true);
      setErrorOpciones("");

      try {
        const opciones = await service.obtenerOpcionesMenuPorDia({
          diaId,
          empresaId,
          semanaId,
        });
        setOpcionesPorDia((actuales) => ({
          ...actuales,
          [diaId]: opciones,
        }));
        return opciones;
      } catch (error) {
        setErrorOpciones(error.message || "No pudimos cargar las opciones del día.");
        return [];
      } finally {
        setCargandoOpciones(false);
      }
    },
    [empresaId, opcionesPorDia, semanaId, service],
  );

  const buscarOpciones = useCallback((texto) => {
    setTextoBusqueda(texto);
  }, []);

  const limpiarBusqueda = useCallback(() => {
    setTextoBusqueda("");
  }, []);

  const estadoOpciones = useMemo(
    () => ({
      cargandoOpciones,
      errorOpciones,
      textoBusqueda,
    }),
    [cargandoOpciones, errorOpciones, textoBusqueda],
  );

  return {
    buscarOpciones,
    cargandoOpciones,
    errorOpciones,
    estadoOpciones,
    limpiarBusqueda,
    obtenerOpcionesDia,
    opcionesPorDia,
    textoBusqueda,
  };
}
