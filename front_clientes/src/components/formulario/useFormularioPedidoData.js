import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { menuApi, pedidoApi, guarnicionesApi } from "../../services/api.js";
import { getDiasSemana } from "../../utils/dias.js";
import { addDias } from "../../utils/dates.js";
import { lunesActualISO, semanaPermitePedido, sumarSemanasISO } from "./helpers.js";

function construirSemanasCarrusel({ menus, historial, diasLaborales }) {
  const porSemanaMenu = new Map(
    menus
      .map((item) => [item.menu?.fecha_inicio?.split("T")[0], item])
      .filter(([fecha]) => !!fecha),
  );
  const porSemanaPedido = new Map(
    historial
      .filter((pedido) => pedido.estado !== "cancelado")
      .map((pedido) => [String(pedido.semana_inicio).split("T")[0], pedido]),
  );

  const actual = lunesActualISO();
  const fechas = new Set();
  for (let i = -2; i <= 2; i++) fechas.add(sumarSemanasISO(actual, i));
  const minFecha = sumarSemanasISO(actual, -2);
  const maxFecha = sumarSemanasISO(actual, 2);
  const enVentana = (fecha) => fecha >= minFecha && fecha <= maxFecha;

  for (const fecha of porSemanaMenu.keys()) {
    if (enVentana(fecha)) fechas.add(fecha);
  }

  for (const fecha of porSemanaPedido.keys()) {
    if (enVentana(fecha)) fechas.add(fecha);
  }

  return Array.from(fechas)
    .sort()
    .map((fecha) => {
      const existente = porSemanaMenu.get(fecha);
      if (existente) {
        return {
          ...existente,
          semana_inicio: fecha,
          pedidoHistorial: porSemanaPedido.get(fecha) || null,
        };
      }

      return {
        disponible: false,
        placeholder: true,
        semana_inicio: fecha,
        pedidoHistorial: porSemanaPedido.get(fecha) || null,
        dias_laborales: diasLaborales || "lunes_viernes",
        menu: {
          fecha_inicio: fecha,
          fecha_fin: sumarSemanasISO(fecha, 0),
          variables: [],
          fijos: [],
          sin_servicio: [],
        },
      };
    });
}

export function useFormularioPedidoData({ empleado }) {
  const [semanaSelIdx, setSemanaSelIdx] = useState(2);

  const { data: menuData, isLoading: loadingMenu } = useQuery({
    queryKey: ["menus-publicados"],
    queryFn: menuApi.activo,
    refetchOnWindowFocus: false,
  });

  const { data: guarniciones = [] } = useQuery({
    queryKey: ["guarniciones"],
    queryFn: guarnicionesApi.listar,
  });

  const { data: historial = [] } = useQuery({
    queryKey: ["mi-historial", empleado.id],
    queryFn: pedidoApi.miHistorial,
    staleTime: 5 * 60 * 1000,
  });

  const menusPublicados = menuData?.menus_disponibles ?? [];
  const menusDisponibles = construirSemanasCarrusel({
    menus: menusPublicados,
    historial,
    diasLaborales: empleado.empresa?.dias_laborales,
  });
  const menuSemana = menusDisponibles[semanaSelIdx] ?? null;
  const semanaInicio =
    menuSemana?.semana_inicio ||
    menuSemana?.menu?.fecha_inicio?.split("T")[0] ||
    null;
  const limiteEmpresaVencido = menuSemana?.limiteEmpresa?.vencido === true;

  const { data: pedidoExistente, isFetching: cargandoPedidoExistente } =
    useQuery({
      queryKey: ["mi-pedido", empleado.id, semanaInicio],
      queryFn: () => pedidoApi.miPedido(semanaInicio),
      enabled: !!semanaInicio && menuSemana?.disponible,
    });

  const pedidoHistorialSemana = menuSemana?.pedidoHistorial;
  const pedidoVisible =
    (pedidoExistente?.items?.length ?? 0) > 0
      ? pedidoExistente
      : (pedidoHistorialSemana?.items?.length ?? 0) > 0
        ? pedidoHistorialSemana
        : null;
  const tienePedidoGuardado = (pedidoVisible?.items?.length ?? 0) > 0;
  const puedeModificarPedido = semanaPermitePedido(menuSemana);
  const menu = semanaPermitePedido(menuSemana) ? menuSemana.menu : null;
  const diasSemana = getDiasSemana(menuSemana?.dias_laborales);
  const diasCerrados = new Set(menuSemana?.limiteEmpresa?.diasCerrados ?? []);
  const diasConFechaYBloqueo = semanaInicio
    ? diasSemana.map((dia, index) => ({
        dia,
        fecha: addDias(semanaInicio, index),
        bloqueado: diasCerrados.has(dia),
      }))
    : [];
  const diasSinServicio = new Map(
    (menu?.sin_servicio || []).map((item) => [item.dia, item.motivo]),
  );

  return {
    semanaSelIdx,
    setSemanaSelIdx,
    loadingMenu,
    guarniciones,
    historial,
    menusDisponibles,
    menuSemana,
    semanaInicio,
    limiteEmpresaVencido,
    pedidoExistente,
    cargandoPedidoExistente,
    pedidoVisible,
    tienePedidoGuardado,
    puedeModificarPedido,
    menu,
    diasSemana,
    diasConFechaYBloqueo,
    diasSinServicio,
  };
}
