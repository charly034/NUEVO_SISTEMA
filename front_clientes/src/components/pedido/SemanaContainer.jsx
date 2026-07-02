import { CalendarDays, CheckCircle2, ChevronLeft, Lightbulb, Utensils } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatearRangoPedido } from "../../utils/fechasPedido.js";
import Boton from "../ui/Boton.jsx";
import SemanaPedidoCard from "./SemanaPedidoCard.jsx";

function tieneSugerenciaEnviada(semana) {
  return (
    (semana?.recomendacionesUsuario || []).length > 0 ||
    Boolean(semana?.comentarioRecomendacion)
  );
}

function esSemanaParaSugerirMenu(semana) {
  if (!semana?.metadata?.esSemanaSugerencias && semana?.estado !== "sin_menu") return false;
  return !tieneSugerenciaEnviada(semana);
}

function obtenerIndiceSemanaActual(semanas, indiceInicial) {
  const indiceActual = semanas.findIndex((semana) => semana.tipo === "actual");
  if (indiceActual >= 0) return indiceActual;
  return semanas[indiceInicial] ? indiceInicial : 0;
}

function obtenerSemanaActual(semanas, indiceInicial) {
  const indiceActual = obtenerIndiceSemanaActual(semanas, indiceInicial);
  return semanas[indiceActual] || null;
}

function obtenerAccionSemanaActual(semana) {
  if (semana?.metadata?.pedidoId) return "Ver pedido";
  if (semana?.metadata?.tieneMenuPublicado) return "Ver menú";
  return "Ver semana";
}

function obtenerDescripcionSemanaActual(semana) {
  if (semana?.metadata?.pedidoId) return "Revisa el pedido que cargaste para esta semana.";
  if (semana?.metadata?.tieneMenuPublicado) return "¡El menú ya está publicado! Elegí tus platos para esta semana.";
  return "Todavia no hay menu publicado para esta semana.";
}

function obtenerModoSemanaActual() {
  return "lectura";
}

function esSemanaUrgente(semana) {
  return Boolean(semana?.metadata?.tieneMenuPublicado && !semana?.metadata?.pedidoId);
}

function SemanaOpcionCard({
  accion,
  descripcion,
  icono: Icono,
  onClick,
  semana,
  subtitulo,
  titulo,
  urgente = false,
}) {
  return (
    <section
      className={urgente
        ? "rounded-3xl border-2 border-[#f0c040] bg-[#fffcf0] p-4 shadow-[0_12px_26px_rgba(139,100,20,0.10)]"
        : "rounded-3xl border border-[#eee8df] bg-white p-4 shadow-[0_12px_26px_rgba(45,90,39,0.07)]"}
    >
      {urgente && (
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#d4900c]" aria-hidden="true" />
          <span className="text-[0.72rem] font-black uppercase tracking-wide text-[#8a5a18]">
            Falta tu pedido
          </span>
        </div>
      )}
      <div className="flex items-start gap-3">
        <span
          className={urgente
            ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fef3c7] text-[#b45309]"
            : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f0f7ee] text-[#2d5a27]"}
        >
          <Icono className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={urgente
              ? "text-[0.72rem] font-black uppercase tracking-wide text-[#b45309]"
              : "text-[0.72rem] font-black uppercase tracking-wide text-[#5f7f55]"}
          >
            {subtitulo}
          </p>
          <h3 className="mt-1 text-[1.15rem] font-black leading-tight text-[#1a1a1a]">
            {titulo}
          </h3>
          <p className="mt-1 text-sm font-bold leading-snug text-[#716c64]">
            Semana del {formatearRangoPedido(semana.rango)}. {descripcion}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <Boton anchoCompleto onClick={onClick}>
          {accion}
        </Boton>
      </div>
    </section>
  );
}

export default function SemanaContainer({
  fechaActual,
  indiceInicial = 0,
  modoActivo = { semanaId: null, modo: "lectura" },
  onActualizarSemana,
  onCambiarModoSemana,
  onDirtyChange,
  onGuardarSugerencia,
  onIndiceActivoChange,
  semanas,
}) {
  const [semanaAccionAbiertaId, setSemanaAccionAbiertaId] = useState(null);
  const semanaActual = useMemo(
    () => obtenerSemanaActual(semanas, indiceInicial),
    [indiceInicial, semanas],
  );
  const semanasConMenu = useMemo(
    () => semanas.filter((semana) =>
      semana.tipo === "proxima" &&
      semana.metadata?.tieneMenuPublicado,
    ),
    [semanas],
  );
  const semanasParaSugerir = useMemo(
    () => semanas.filter((semana) =>
      semana.tipo === "proxima" &&
      esSemanaParaSugerirMenu(semana),
    ),
    [semanas],
  );
  const semanasConSugerenciaEnviada = useMemo(
    () => semanas.filter((semana) =>
      semana.tipo === "proxima" &&
      (semana?.metadata?.esSemanaSugerencias || semana?.estado === "sin_menu") &&
      tieneSugerenciaEnviada(semana),
    ),
    [semanas],
  );
  const semanaAccionAbierta = useMemo(
    () => semanas.find((semana) => semana.id === semanaAccionAbiertaId) || null,
    [semanaAccionAbiertaId, semanas],
  );

  const registrarSemanaActiva = useCallback((semana) => {
    const indice = semanas.findIndex((item) => item.id === semana?.id);
    if (indice >= 0) onIndiceActivoChange?.(indice);
  }, [onIndiceActivoChange, semanas]);

  const volverAPantallaPedido = useCallback(async () => {
    if (
      modoActivo.modo === "edicion" &&
      modoActivo.semanaId
    ) {
      const puedeSalir = await onCambiarModoSemana?.(modoActivo.semanaId, "lectura");
      if (puedeSalir === false) return;
    }

    setSemanaAccionAbiertaId(null);
    registrarSemanaActiva(semanaActual || semanasConMenu[0] || semanasParaSugerir[0]);
  }, [
    modoActivo,
    onCambiarModoSemana,
    registrarSemanaActiva,
    semanaActual,
    semanasConMenu,
    semanasParaSugerir,
  ]);

  const abrirAccionSemana = useCallback(async (semana, modo) => {
    if (!semana) return;

    const puedeCambiar = await onCambiarModoSemana?.(semana.id, modo);
    if (puedeCambiar === false) return;

    setSemanaAccionAbiertaId(semana.id);
    registrarSemanaActiva(semana);
  }, [onCambiarModoSemana, registrarSemanaActiva]);

  const cambiarModoSemanaAccion = useCallback(async (semana, modo, opciones) => {
    const puedeCambiar = await onCambiarModoSemana?.(semana.id, modo, opciones);
    if (puedeCambiar === false) return false;
    if (modo === "lectura") setSemanaAccionAbiertaId(null);
    return true;
  }, [onCambiarModoSemana]);

  useEffect(() => {
    window.addEventListener("pedido:ir-semana-actual", volverAPantallaPedido);
    return () => {
      window.removeEventListener("pedido:ir-semana-actual", volverAPantallaPedido);
    };
  }, [volverAPantallaPedido]);

  if (!semanaActual && semanasConMenu.length === 0 && semanasParaSugerir.length === 0) {
    return null;
  }

  if (semanaAccionAbierta) {
    return (
      <section aria-label="Pedido semanal" className="-mx-4 flex min-h-0 flex-1 flex-col md:-mx-6">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 md:px-6">
          <div className="mx-auto flex min-h-0 w-full max-w-[42rem] flex-1 flex-col gap-2">
            <button
              type="button"
              onClick={volverAPantallaPedido}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#d8e6d4] bg-white px-3 py-1.5 text-sm font-black text-[#2d5a27] shadow-[0_8px_18px_rgba(45,90,39,0.06)]"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Volver
            </button>
            <SemanaPedidoCard
              fechaActual={fechaActual}
              modoCard={
                modoActivo.semanaId === semanaAccionAbierta.id
                  ? modoActivo.modo
                  : "lectura"
              }
              semana={semanaAccionAbierta}
              onCambiarModo={(modo, opciones) =>
                cambiarModoSemanaAccion(semanaAccionAbierta, modo, opciones)
              }
              onDirtyChange={(hayCambios) => {
                if (modoActivo.semanaId === semanaAccionAbierta.id) {
                  onDirtyChange?.(hayCambios);
                }
              }}
              onActualizarSemana={onActualizarSemana}
              onGuardarSugerencia={onGuardarSugerencia}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Pedido semanal" className="-mx-4 flex min-h-0 flex-1 flex-col md:-mx-6">
      <header className="shrink-0 px-4 pb-2 md:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mt-0.5 text-sm font-bold leading-snug text-[#716c64]">
              Elegí una semana para ver el menú completo y después cargar tu pedido.
            </p>
          </div>
          <CalendarDays className="h-5 w-5 shrink-0 text-[#2d5a27]" aria-hidden="true" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-6">
        <div className="mx-auto flex max-w-[42rem] flex-col gap-3">
          {semanaActual && (
            <SemanaOpcionCard
              accion={obtenerAccionSemanaActual(semanaActual)}
              descripcion={obtenerDescripcionSemanaActual(semanaActual)}
              icono={CalendarDays}
              semana={semanaActual}
              subtitulo="Semana actual"
              titulo={esSemanaUrgente(semanaActual) ? "¡Todavía no pediste!" : "Esta semana"}
              urgente={esSemanaUrgente(semanaActual)}
              onClick={() => abrirAccionSemana(semanaActual, obtenerModoSemanaActual(semanaActual))}
            />
          )}

          {semanasConMenu.map((semana) => {
            const urgente = esSemanaUrgente(semana);
            return (
              <SemanaOpcionCard
                key={semana.id}
                accion={urgente ? "Ver menú" : "Ver pedido"}
                descripcion={
                  urgente
                    ? "El menú ya está publicado. No olvides elegir tus platos antes del cierre."
                    : "Ya tenés un pedido cargado para esta semana."
                }
                icono={Utensils}
                semana={semana}
                subtitulo={urgente ? "Próxima semana" : "Semana con menú"}
                titulo={urgente ? "¡Hacé tu pedido!" : "Pedido cargado"}
                urgente={urgente}
                onClick={() => abrirAccionSemana(semana, "lectura")}
              />
            );
          })}

          {semanasParaSugerir.map((semana) => (
            <SemanaOpcionCard
              key={semana.id}
              accion="Sugerir menu"
              descripcion="Todavia no hay menu publicado."
              icono={Lightbulb}
              semana={semana}
              subtitulo="Sugerencias"
              titulo="Ayudanos a pensar el proximo menu"
              onClick={() => abrirAccionSemana(semana, "recomendacion")}
            />
          ))}

          {semanasConSugerenciaEnviada.map((semana) => (
            <section
              key={semana.id}
              className="rounded-3xl border border-[#cde5c8] bg-[#f0f7ee] p-4 shadow-[0_12px_26px_rgba(45,90,39,0.07)]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#2d5a27]">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] font-black uppercase tracking-wide text-[#5f7f55]">
                    Sugerencias
                  </p>
                  <h3 className="mt-1 text-[1.15rem] font-black leading-tight text-[#1a1a1a]">
                    ¡Gracias! Tu sugerencia fue enviada
                  </h3>
                  <p className="mt-1 text-sm font-bold leading-snug text-[#716c64]">
                    Semana del {formatearRangoPedido(semana.rango)}. Ya enviamos tus ideas para esta semana.
                  </p>
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
