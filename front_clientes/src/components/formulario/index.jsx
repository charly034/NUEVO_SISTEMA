import { toast } from "../../lib/swal.js";

import {
  ORDEN_DIAS,
  construirTextoResumenLimite,
  construirTextoLimitePedido,
  construirDiasResumenPedido,
} from "./helpers.js";
import { Pantalla } from "./DiaCard.jsx";
import SelectorSemana from "./SelectorSemana.jsx";
import { useFormularioPedidoData } from "./useFormularioPedidoData.js";
import { useFormularioPedidoEditor } from "./useFormularioPedidoEditor.js";
import {
  PedidoConfirmadoCard,
  MenuSemanalCard,
  MenuNoDisponibleCard,
} from "./SemanaCards.jsx";
import {
  HeaderUsuario,
  LoadingMenuState,
  ConfirmacionPedidoState,
  NoMenusPublicadosState,
  PedidoCargandoState,
} from "./FormularioPedidoEstados.jsx";
import FormularioPedidoEditable from "./FormularioPedidoEditable.jsx";

export default function FormularioPedido({ empleado }) {
  const {
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
  } = useFormularioPedidoData({ empleado });

  const {
    diaRefs,
    selecciones,
    confirmado,
    noAsiste,
    modoEdicionPedido,
    modoCreacionPedido,
    diaEfectivo,
    pedidoAnterior,
    mutation,
    mutationCancelar,
    handleEnviar,
    handleCancelarPedido,
    handleVerPedido,
    toggleExpandido,
    toggleNoAsiste,
    elegirPlato,
    setGuarnicion,
    setNotas,
    aplicarPedidoAnterior,
    avanzarAlSiguiente,
    setModoEdicionPedido,
    setModoCreacionPedido,
    setExpandidoDia,
    envioBloqueado,
    textoBotonEnviar,
    mostrarFooterPedido,
  } = useFormularioPedidoEditor({
    empleado,
    semanaSelIdx,
    menuSemana,
    semanaInicio,
    historial,
    pedidoExistente,
    pedidoVisible,
    tienePedidoGuardado,
    menu,
    diasSemana,
    diasConFechaYBloqueo,
    diasSinServicio,
  });

  if (loadingMenu) {
    return <LoadingMenuState />;
  }

  if (confirmado) {
    return (
      <ConfirmacionPedidoState
        diasSemana={diasSemana}
        semanaInicio={semanaInicio}
        empleado={empleado}
        selecciones={selecciones}
        guarniciones={guarniciones}
        onVerPedido={handleVerPedido}
        onCancelar={handleCancelarPedido}
        cancelando={mutationCancelar.isPending}
      />
    );
  }

  if (menusDisponibles.length === 0) {
    return <NoMenusPublicadosState empleado={empleado} />;
  }

  if (menuSemana?.disponible && limiteEmpresaVencido) {
    const itemsExistentes = (pedidoExistente?.items ?? [])
      .slice()
      .sort((a, b) => ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia));
    const textoResumenLimite = construirTextoResumenLimite({
      semanaInicio,
      limiteEmpresa: menuSemana.limiteEmpresa,
    });
    const diasResumen = construirDiasResumenPedido(itemsExistentes, diasSemana);

    return (
      <Pantalla noScroll>
        <HeaderUsuario empleado={empleado} />
        <SelectorSemana
          menus={menusDisponibles}
          selIdx={semanaSelIdx}
          onChange={setSemanaSelIdx}
          noScroll
        />
        {itemsExistentes.length > 0 ? (
          <PedidoConfirmadoCard
            dias={diasResumen}
            textoResumen={`${itemsExistentes.length} día${itemsExistentes.length !== 1 ? "s" : ""} · ${textoResumenLimite}`}
          />
        ) : (
          <MenuSemanalCard
            menu={menuSemana.menu}
            textoResumen={textoResumenLimite}
          />
        )}
      </Pantalla>
    );
  }

  if (!menuSemana?.disponible) {
    const pedidoHistorial = menuSemana?.pedidoHistorial;
    const tieneMenuPublicado =
      !menuSemana?.placeholder && !!menuSemana?.menu?.id;

    if (pedidoHistorial?.items?.length) {
      const itemsExistentes = pedidoHistorial.items
        .slice()
        .sort((a, b) => ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia));
      const diasResumen = construirDiasResumenPedido(
        itemsExistentes,
        diasSemana,
      );

      return (
        <Pantalla noScroll>
          <HeaderUsuario empleado={empleado} />
          <SelectorSemana
            menus={menusDisponibles}
            selIdx={semanaSelIdx}
            onChange={setSemanaSelIdx}
            noScroll
          />
          <PedidoConfirmadoCard
            dias={diasResumen}
            textoResumen={`${itemsExistentes.length} día${itemsExistentes.length !== 1 ? "s" : ""} · ${construirTextoResumenLimite({ semanaInicio })}`}
          />
        </Pantalla>
      );
    }

    if (tieneMenuPublicado) {
      return (
        <Pantalla noScroll>
          <HeaderUsuario empleado={empleado} />
          <SelectorSemana
            menus={menusDisponibles}
            selIdx={semanaSelIdx}
            onChange={setSemanaSelIdx}
            noScroll
          />
          <MenuSemanalCard
            menu={menuSemana.menu}
            textoResumen={construirTextoResumenLimite({ semanaInicio })}
          />
        </Pantalla>
      );
    }

    return (
      <Pantalla noScroll>
        <HeaderUsuario empleado={empleado} />
        <SelectorSemana
          menus={menusDisponibles}
          selIdx={semanaSelIdx}
          onChange={setSemanaSelIdx}
          noScroll
        />
        <MenuNoDisponibleCard
          textoResumen={construirTextoResumenLimite({ semanaInicio })}
          mensaje={
            menuSemana?.placeholder
              ? "Todavía no hay menú publicado para esta semana."
              : menuSemana?.mensaje || "Esta semana ya no acepta pedidos."
          }
        />
      </Pantalla>
    );
  }

  const fechaLimite = menu.fecha_limite_pedidos
    ? new Date(menu.fecha_limite_pedidos)
    : null;
  const textoLimitePedido = construirTextoLimitePedido({
    semanaInicio,
    fechaLimite,
    limiteEmpresa: menuSemana?.limiteEmpresa,
  });

  if (tienePedidoGuardado && !modoEdicionPedido) {
    const itemsExistentes = (pedidoVisible?.items ?? [])
      .slice()
      .sort((a, b) => ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia));
    const textoResumenPedido = construirTextoResumenLimite({
      semanaInicio,
      limiteEmpresa: menuSemana?.limiteEmpresa,
    });
    const diasResumen = construirDiasResumenPedido(itemsExistentes, diasSemana);

    return (
      <Pantalla noScroll>
        <HeaderUsuario empleado={empleado} />
        <SelectorSemana
          menus={menusDisponibles}
          selIdx={semanaSelIdx}
          onChange={setSemanaSelIdx}
          noScroll
        />
        <PedidoConfirmadoCard
          dias={diasResumen}
          textoResumen={`${itemsExistentes.length} día${itemsExistentes.length !== 1 ? "s" : ""} · ${textoResumenPedido}`}
          onModificar={
            puedeModificarPedido
              ? () => {
                  if (
                    !pedidoExistente?.items?.length &&
                    cargandoPedidoExistente
                  ) {
                    toast.warning(
                      "Estamos cargando tu pedido. Probá de nuevo en unos segundos.",
                    );
                    return;
                  }
                  setModoEdicionPedido(true);
                  setExpandidoDia(null);
                }
              : null
          }
        />
      </Pantalla>
    );
  }

  if (!tienePedidoGuardado && semanaSelIdx > 0 && !modoCreacionPedido) {
    return (
      <Pantalla noScroll>
        <HeaderUsuario empleado={empleado} />
        <SelectorSemana
          menus={menusDisponibles}
          selIdx={semanaSelIdx}
          onChange={setSemanaSelIdx}
          noScroll
        />
        <MenuSemanalCard
          menu={menu}
          textoResumen={construirTextoResumenLimite({
            semanaInicio,
            limiteEmpresa: menuSemana?.limiteEmpresa,
          })}
          onComenzar={() => {
            setModoCreacionPedido(true);
            setExpandidoDia(undefined);
          }}
        />
      </Pantalla>
    );
  }

  if (
    modoEdicionPedido &&
    tienePedidoGuardado &&
    !pedidoExistente?.items?.length
  ) {
    return (
      <PedidoCargandoState
        empleado={empleado}
        menusDisponibles={menusDisponibles}
        semanaSelIdx={semanaSelIdx}
        onChangeSemana={setSemanaSelIdx}
      />
    );
  }

  return (
    <FormularioPedidoEditable
      empleado={empleado}
      menusDisponibles={menusDisponibles}
      semanaSelIdx={semanaSelIdx}
      setSemanaSelIdx={setSemanaSelIdx}
      fechaLimiteVisible={!!(fechaLimite || menuSemana?.limiteEmpresa)}
      textoLimitePedido={textoLimitePedido}
      pedidoAnterior={pedidoAnterior}
      tienePedidoGuardado={tienePedidoGuardado}
      aplicarPedidoAnterior={aplicarPedidoAnterior}
      diasConFechaYBloqueo={diasConFechaYBloqueo}
      diasSinServicio={diasSinServicio}
      noAsiste={noAsiste}
      selecciones={selecciones}
      diaEfectivo={diaEfectivo}
      toggleExpandido={toggleExpandido}
      diaRefs={diaRefs}
      menuSemana={menuSemana}
      menu={menu}
      guarniciones={guarniciones}
      toggleNoAsiste={toggleNoAsiste}
      elegirPlato={elegirPlato}
      setGuarnicion={setGuarnicion}
      setNotas={setNotas}
      avanzarAlSiguiente={avanzarAlSiguiente}
      mostrarFooterPedido={mostrarFooterPedido}
      envioBloqueado={envioBloqueado}
      handleEnviar={handleEnviar}
      textoBotonEnviar={textoBotonEnviar}
      mutation={mutation}
    />
  );
}
