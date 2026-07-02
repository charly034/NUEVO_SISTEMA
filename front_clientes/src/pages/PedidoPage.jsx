import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  Leaf,
  Lightbulb,
  RefreshCw,
  Sparkles,
  VolumeX,
} from "lucide-react";
import { usePedidoSemanal } from "../hooks/usePedidoSemanal.js";
import MenuViewScreen from "../components/pedido/MenuViewScreen.jsx";
import SuggestionSheet from "../components/pedido/SuggestionSheet.jsx";
import WeeklyOrderView from "../components/pedido/WeeklyOrderView.jsx";
import { rutasCliente } from "../routes/rutasCliente.js";
import { apiGet } from "../services/apiCliente.js";
import {
  debeAbrirPedidoSoloLectura,
  mensajePedidoNoEditable,
  puedeHacerPedidoSemana,
  tieneMenuSemana,
  tienePedidoSemana,
} from "../utils/permisosPedido.js";

const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function rangoSemana(semanaId) {
  if (!semanaId) return "";
  const [y, m, d] = String(semanaId).split("T")[0].split("-").map(Number);
  const lunes = new Date(y, m - 1, d);
  const viernes = new Date(y, m - 1, d + 4);
  const ml = meses[lunes.getMonth()];
  const mv = meses[viernes.getMonth()];
  const ini = ml === mv ? lunes.getDate() : `${lunes.getDate()} ${ml}`;
  return `${ini} - ${viernes.getDate()} ${mv}`;
}

function tienePedido(semana) {
  return tienePedidoSemana(semana);
}

function tieneMenu(semana) {
  return tieneMenuSemana(semana);
}

function estaCerrada(semana) {
  return !puedeHacerPedidoSemana(semana) && tieneMenu(semana);
}

function estadoSemana(semana) {
  if (tienePedido(semana)) return { label: "Pedido cargado", tono: "verde" };
  if (estaCerrada(semana)) return { label: "Fuera de plazo", tono: "gris" };
  if (tieneMenu(semana)) return { label: "Menu disponible", tono: "verde" };
  return { label: "Sin menu aun", tono: "ambar" };
}

function accionPrincipal(semana) {
  if (tienePedido(semana)) return "Ver pedido";
  if (estaCerrada(semana)) return "Ver menu";
  if (tieneMenu(semana)) return "Hacer pedido";
  return "Sugerir";
}

function textoCierre(semana) {
  const limite = semana?.limiteModificacion;
  if (!limite) return "Cierre pendiente de confirmar";
  const dia = limite.dia ? `${limite.dia.charAt(0).toUpperCase()}${limite.dia.slice(1)}` : "Domingo";
  return `Cierra: ${dia}, ${limite.hora || "20:00"} hs`;
}

function nombreUsuario(empleado) {
  const nombre = empleado?.nombre || empleado?.name || "";
  const apellido = empleado?.apellido || "";
  return { nombre: nombre || "bienvenido", apellido };
}

function HeaderInicio({ empleado, notificacionesNoLeidas = 0, onNotificaciones }) {
  const persona = nombreUsuario(empleado);

  return (
    <header className="relative shrink-0 overflow-hidden rounded-b-[2rem] bg-[#596B28] px-4 pb-6 pt-10 text-white shadow-[0_14px_28px_rgba(44,60,20,0.18)]">
      <div className="absolute right-6 top-[-3rem] h-24 w-24 rounded-full bg-white/5" aria-hidden="true" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-none text-white/70">Buenos dias,</p>
          <h1 className="mt-1 font-serif text-[1.55rem] font-bold leading-[1.05] tracking-normal">
            <span className="block">{persona.nombre}</span>
            {persona.apellido && <span className="block">{persona.apellido}</span>}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-1">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white/45"
            aria-label="Sonido desactivado"
          >
            <VolumeX size={16} />
          </button>
          <button
            type="button"
            onClick={onNotificaciones}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/16 text-white"
            aria-label="Ver notificaciones"
          >
            <Bell size={17} />
            {notificacionesNoLeidas > 0 && (
              <span className="absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C8782A] px-1 text-[9px] font-black text-white">
                {notificacionesNoLeidas > 9 ? "9+" : notificacionesNoLeidas}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

function AvisoPrimeraSemana() {
  return (
    <section className="mx-4 -mt-1 rounded-xl bg-[#667638] px-4 py-3 text-white shadow-[0_10px_22px_rgba(74,91,36,0.14)]">
      <div className="flex gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-white/85" aria-hidden="true" />
        <div>
          <p className="text-[12px] font-black leading-tight">Primera semana!</p>
          <p className="mt-1 text-[11px] font-semibold leading-snug text-white/82">
            Elegi un plato para cada dia y confirma antes del cierre.
          </p>
        </div>
      </div>
    </section>
  );
}

function EstadoPunto({ estado }) {
  const color = estado.tono === "ambar" ? "bg-[#C8782A]" : estado.tono === "gris" ? "bg-[#9A9885]" : "bg-[#5B6B2A]";
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#5B6B2A]">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden="true" />
      {estado.label}
    </span>
  );
}

function SemanaActualCard({ onHacerPedido, onSugerir, onVerMenu, semana }) {
  if (!semana) return null;
  const estado = estadoSemana(semana);
  const puedePedir = puedeHacerPedidoSemana(semana);
  const pedidoCargado = tienePedido(semana);
  const pendiente = tieneMenu(semana) && !pedidoCargado && puedePedir;
  const sinMenu = !tieneMenu(semana);

  const accion = () => {
    if (sinMenu) {
      onSugerir(semana);
      return;
    }
    if (!puedePedir && !pedidoCargado) {
      onVerMenu(semana);
      return;
    }
    onHacerPedido(semana, { soloLectura: debeAbrirPedidoSoloLectura(semana) });
  };

  return (
    <section className="mx-4 mt-3">
      <p className="mb-2 text-[12px] font-semibold text-[#7A7868]">Semana actual</p>

      <article className="overflow-hidden rounded-2xl border border-[#ECE8DE] bg-white shadow-[0_14px_30px_rgba(32,44,18,0.08)]">
        <div className="bg-[#FAFCF3] px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-[#6C7A3A]">{rangoSemana(semana.id)}</p>
              <h2 className="mt-1 font-serif text-[18px] font-bold leading-tight text-[#2A2C1F]">
                Semana actual
              </h2>
            </div>
            <EstadoPunto estado={estado} />
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#9A9885]">
            <Clock3 size={11} aria-hidden="true" />
            {textoCierre(semana)}
          </div>
        </div>

        <div className="border-t border-[#F0EDE6] px-4 py-3">
          {pendiente ? (
            <div className="mb-3 rounded-xl bg-[#FFFDF6] px-3 py-2">
              <div className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F0C040]" aria-hidden="true" />
                <div>
                  <p className="text-[12px] font-bold text-[#4A3D20]">Todavia no hiciste tu pedido.</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#8A846F]">
                    Elegi un plato por dia y confirma junto.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-3 rounded-xl bg-[#F7F6EF] px-3 py-2 text-[12px] font-semibold text-[#7A7868]">
              {sinMenu ? "Todavia no hay menu publicado para esta semana." : estado.label}
              {!sinMenu && !pedidoCargado && !puedePedir && (
                <span className="mt-1 block text-[11px] font-medium">
                  {mensajePedidoNoEditable(semana)}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={accion}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#5B6B2A] px-5 text-[12px] font-black text-white shadow-[0_10px_18px_rgba(91,107,42,0.24)]"
            >
              {accionPrincipal(semana)}
              <ChevronRight size={14} />
            </button>

            {tieneMenu(semana) && (puedePedir || pedidoCargado) && (
              <button
                type="button"
                onClick={() => onVerMenu(semana)}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#E5E7D8] bg-[#FAFCF3] px-5 text-[12px] font-black text-[#4A5822]"
              >
                Ver menu
              </button>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}

function FilaSemanaProxima({ onHacerPedido, onSugerir, onVerMenu, semana }) {
  const estado = estadoSemana(semana);
  const sinMenu = !tieneMenu(semana);
  const pedidoCargado = tienePedido(semana);
  const puedePedir = puedeHacerPedidoSemana(semana);
  const cerrada = !puedePedir && !pedidoCargado;

  if (!sinMenu) {
    const mensaje = pedidoCargado
      ? {
          titulo: "Pedido cargado",
          detalle: "Ya tenes un pedido para esta semana. Podes revisarlo o consultar el menu.",
        }
      : cerrada
        ? {
            titulo: "Semana cerrada",
            detalle: "El plazo ya cerro. Podes consultar el menu publicado.",
          }
        : {
            titulo: "Todavia no hiciste tu pedido.",
            detalle: "El menu ya esta disponible. Elegi tus platos antes del cierre.",
          };

    return (
      <article className="overflow-hidden rounded-2xl border border-[#ECE8DE] bg-white shadow-[0_14px_30px_rgba(32,44,18,0.08)]">
        <div className="bg-[#FAFCF3] px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-[#6C7A3A]">{rangoSemana(semana.id)}</p>
              <h3 className="mt-1 font-serif text-[18px] font-bold leading-tight text-[#2A2C1F]">
                {semana.tipo === "proxima" ? "Proxima semana" : "Semana"}
              </h3>
            </div>
            <EstadoPunto estado={estado} />
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#9A9885]">
            <Clock3 size={11} aria-hidden="true" />
            {textoCierre(semana)}
          </div>
        </div>

        <div className="border-t border-[#F0EDE6] px-4 py-3">
          <div className={[
            "mb-3 rounded-xl px-3 py-2",
            pedidoCargado || cerrada ? "bg-[#F7F6EF]" : "bg-[#FFFDF6]",
          ].join(" ")}>
            <div className="flex gap-2">
              <span
                className={[
                  "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                  pedidoCargado ? "bg-[#5B6B2A]" : cerrada ? "bg-[#9A9885]" : "bg-[#F0C040]",
                ].join(" ")}
                aria-hidden="true"
              />
              <div>
                <p className="text-[12px] font-bold text-[#4A3D20]">{mensaje.titulo}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-[#8A846F]">
                  {mensaje.detalle}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(pedidoCargado || puedePedir) && (
              <button
                type="button"
                onClick={() => onHacerPedido(semana, { soloLectura: debeAbrirPedidoSoloLectura(semana) })}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#5B6B2A] px-5 text-[12px] font-black text-white shadow-[0_10px_18px_rgba(91,107,42,0.24)]"
              >
                {pedidoCargado ? "Ver pedido" : "Hacer pedido"}
                <ChevronRight size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onVerMenu(semana)}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#E5E7D8] bg-[#FAFCF3] px-5 text-[12px] font-black text-[#4A5822]"
            >
              Ver menu
            </button>
          </div>
        </div>
      </article>
    );
  }

  const ejecutarAccion = () => {
    if (tienePedido(semana) || estaCerrada(semana)) {
      onHacerPedido(semana, { soloLectura: estaCerrada(semana) });
      return;
    }
    if (tieneMenu(semana)) {
      onVerMenu(semana);
      return;
    }
    onSugerir(semana);
  };

  return (
    <article className="rounded-2xl border border-[#ECE8DE] bg-white px-4 py-3 shadow-[0_10px_22px_rgba(32,44,18,0.05)]">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FAF8F3] text-[#B5AA95]">
          <CalendarDays size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-[#9A9885]">{rangoSemana(semana.id)}</p>
          <h3 className="mt-0.5 text-[13px] font-black leading-tight text-[#2A2C1F]">
            {semana.tipo === "proxima" ? "Proxima semana" : "Semana"}
          </h3>
          <p className="mt-0.5 text-[11px] font-semibold text-[#9A9885]">{estado.label}</p>
        </div>

        <button
          type="button"
          onClick={ejecutarAccion}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-[#F2EFE8] px-4 text-[11px] font-black text-[#657237]"
        >
          {sinMenu ? <Lightbulb size={12} /> : <Leaf size={12} />}
          {sinMenu ? "Sugerir" : "Ver menu"}
        </button>
      </div>
    </article>
  );
}

export default function PedidoPage({ empleado }) {
  const navigate = useNavigate();
  const [vista, setVista] = useState(null);
  const [semanaSugerencia, setSemanaSugerencia] = useState(null);

  const {
    cargando,
    error,
    guardarCambios,
    guardarSugerencia,
    recargarPedido,
    semanas,
  } = usePedidoSemanal({ empleado });
  const { data: contadorNotificaciones } = useQuery({
    queryKey: ["notificaciones-no-leidas"],
    queryFn: () => apiGet("/notificaciones/no-leidas/count", { requiereAuth: true }),
    staleTime: 60 * 1000,
  });

  const semanaActual = semanas.find((s) => s.tipo === "actual") || semanas[0] || null;
  const proximas = semanas.filter((s) => s.tipo !== "actual" && s.tipo !== "anterior");
  const pedidoPendienteInicio = useMemo(
    () => Boolean(semanaActual && tieneMenu(semanaActual) && !tienePedido(semanaActual) && !estaCerrada(semanaActual)),
    [semanaActual],
  );

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("pedido:estado-inicio", {
      detail: { pedidoPendiente: pedidoPendienteInicio },
    }));
  }, [pedidoPendienteInicio]);

  const abrirPedido = (semana, opciones = {}) => {
    if (!tienePedido(semana) && !puedeHacerPedidoSemana(semana)) {
      setVista({ tipo: "menu", semana });
      return;
    }
    setVista({
      tipo: "pedido",
      semana,
      soloLectura: Boolean(opciones.soloLectura || debeAbrirPedidoSoloLectura(semana)),
    });
  };

  const abrirMenu = (semana) => {
    setVista({ tipo: "menu", semana });
  };

  if (vista) {
    const semanaActualizada = semanas.find((s) => s.id === vista.semana.id) || vista.semana;

    if (vista.tipo === "menu") {
      return (
        <MenuViewScreen
          semana={semanaActualizada}
          onBack={() => setVista(null)}
          onHacerPedido={() => abrirPedido(semanaActualizada)}
        />
      );
    }

    return (
      <WeeklyOrderView
        readOnly={vista.soloLectura}
        semana={semanaActualizada}
        onBack={() => setVista(null)}
        onGuardar={guardarCambios}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#FAF8F3]">
      <HeaderInicio
        empleado={empleado}
        notificacionesNoLeidas={Number(contadorNotificaciones?.count || 0)}
        onNotificaciones={() => navigate(rutasCliente.notificaciones)}
      />

      <div className="flex-1 overflow-y-auto pb-24 pt-4">
        <AvisoPrimeraSemana />

        {cargando && !semanas.length && (
          <div className="mx-4 mt-4 h-36 animate-pulse rounded-2xl bg-[#EDF0E4]" />
        )}

        {error && (
          <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="flex-1 text-sm text-red-700">{error}</p>
            <button type="button" onClick={recargarPedido} className="text-red-500" aria-label="Reintentar">
              <RefreshCw size={16} />
            </button>
          </div>
        )}

        {!cargando && !error && semanas.length === 0 && (
          <div className="mx-4 mt-4 rounded-2xl border border-[#E8E5DC] bg-white px-4 py-5 text-center">
            <p className="text-sm text-[#9A9885]">No hay semanas disponibles.</p>
          </div>
        )}

        {semanaActual && (
          <SemanaActualCard
            semana={semanaActual}
            onHacerPedido={abrirPedido}
            onSugerir={setSemanaSugerencia}
            onVerMenu={abrirMenu}
          />
        )}

        {proximas.length > 0 && (
          <section className="mx-4 mt-5">
            <p className="mb-2 text-[12px] font-semibold text-[#7A7868]">Proximas semanas</p>
            <div className="space-y-2">
              {proximas.map((semana) => (
                <FilaSemanaProxima
                  key={semana.id}
                  semana={semana}
                  onHacerPedido={abrirPedido}
                  onSugerir={setSemanaSugerencia}
                  onVerMenu={abrirMenu}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {semanaSugerencia && (
        <SuggestionSheet
          key={semanaSugerencia.id}
          abierto
          semana={semanaSugerencia}
          onCerrar={() => setSemanaSugerencia(null)}
          onGuardar={guardarSugerencia}
        />
      )}
    </div>
  );
}
