import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { menuService } from "../services/menuService.js";
import { medirPromesaPerformance } from "../utils/performance.js";

const STALE_OPCIONES_MENU_MS = 10 * 60 * 1000;
const GC_OPCIONES_MENU_MS = 30 * 60 * 1000;

export function useOpcionesMenu({
  empresaId = "empresa_demo",
  service = menuService,
  semanaId,
} = {}) {
  const queryClient = useQueryClient();
  const opcionesPorDiaRef = useRef({});
  const [opcionesPorDia, setOpcionesPorDia] = useState({});
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [errorOpciones, setErrorOpciones] = useState("");

  useEffect(() => {
    opcionesPorDiaRef.current = {};
    queueMicrotask(() => setOpcionesPorDia({}));
  }, [empresaId, semanaId]);

  const obtenerOpcionesDia = useCallback(
    async (dia, opcionesCarga = {}) => {
      if (!dia) return [];
      if (dia.opciones?.length && !opcionesCarga.forzar) return dia.opciones;

      const diaId = dia.id || dia.clave;
      if (opcionesPorDiaRef.current[diaId] && !opcionesCarga.forzar) {
        return opcionesPorDiaRef.current[diaId];
      }

      setCargandoOpciones(true);
      setErrorOpciones("");

      try {
        if (!semanaId) {
          throw new Error("No pudimos identificar la semana para cargar opciones.");
        }

        const semana = await queryClient.fetchQuery({
          queryKey: ["opciones-menu-semana", empresaId || "sin_empresa", semanaId],
          queryFn: () => medirPromesaPerformance("menu:carga-opciones-semana", () =>
            service.obtenerOpcionesMenuPorSemana({ empresaId, semanaId }),
          ),
          staleTime: STALE_OPCIONES_MENU_MS,
          gcTime: GC_OPCIONES_MENU_MS,
        });
        const diaSemana = (semana.dias || []).find(
          (item) => String(item.diaId).toLowerCase() === String(diaId).toLowerCase(),
        );
        const opciones = diaSemana?.opciones || [];

        if (opciones.length === 0) {
          setErrorOpciones("No hay opciones disponibles para este dia.");
        }

        opcionesPorDiaRef.current = {
          ...opcionesPorDiaRef.current,
          [diaId]: opciones,
        };
        setOpcionesPorDia(opcionesPorDiaRef.current);
        return opciones;
      } catch (error) {
        setErrorOpciones(error.message || "No pudimos cargar las opciones de este dia.");
        return [];
      } finally {
        setCargandoOpciones(false);
      }
    },
    [empresaId, queryClient, semanaId, service],
  );

  const recargarOpcionesDia = useCallback(
    (dia) => obtenerOpcionesDia(dia, { forzar: true }),
    [obtenerOpcionesDia],
  );

  return {
    cargandoOpciones,
    errorOpciones,
    obtenerOpcionesDia,
    opcionesPorDia,
    recargarOpcionesDia,
  };
}
