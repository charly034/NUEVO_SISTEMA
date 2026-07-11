import { useMemo, useState } from "react";
import { ChevronLeft, Flame, Leaf, UtensilsCrossed } from "lucide-react";
import BtnPrimary from "../ui/BtnPrimary.jsx";
import {
  mensajePedidoNoEditable,
  puedeHacerPedidoSemana,
  tienePedidoSemana,
} from "../../utils/permisosPedido.js";

const ABBR = {
  lunes: "LUN",
  martes: "MAR",
  miercoles: "MIE",
  jueves: "JUE",
  viernes: "VIE",
  sabado: "SAB",
  domingo: "DOM",
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function claveDia(dia) {
  return dia.id || dia.clave;
}

function parseFecha(fechaISO) {
  const [, mes, dia] = String(fechaISO || "").split("T")[0].split("-").map(Number);
  return {
    dia: String(dia || ""),
    mes: MESES[(mes || 1) - 1] || "",
  };
}

function normalizarAlergenos(plato) {
  if (Array.isArray(plato.alergenos)) return plato.alergenos;
  if (Array.isArray(plato.allergens)) return plato.allergens;
  return [];
}

function PlatoMenuCard({ plato }) {
  const foto = plato.foto_url || plato.fotoUrl || plato.photo || "";
  const alergenos = normalizarAlergenos(plato);
  const guarniciones = plato.guarniciones || [];
  const salsas = plato.salsas || [];
  const vegetariano = Boolean(
    plato.vegetariano ||
      plato.vegetarian ||
      (plato.etiquetas || []).some((item) => String(item).toLowerCase().includes("veget")),
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-[#E8E5DC] bg-white shadow-sm">
      <div className="flex gap-3 p-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EDF0E4]">
          {foto ? (
            <img src={foto} alt={plato.nombre} className="h-full w-full object-cover" />
          ) : (
            <UtensilsCrossed className="h-8 w-8 text-[#5B6B2A]/35" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[#EDF0E4] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#5B6B2A]">
              {plato.destacado ? "Especial" : plato.categoria || "Fijo"}
            </span>
            {vegetariano && <Leaf size={13} className="text-emerald-600" aria-label="Vegetariano" />}
            {plato.calorias && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3E8] px-2 py-0.5 text-[10px] font-bold text-[#A65F18]">
                <Flame size={11} aria-hidden="true" />
                {plato.calorias} kcal
              </span>
            )}
          </div>
          <h3 className="text-[15px] font-black leading-tight text-[#2A2C1F]">{plato.nombre}</h3>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#7A7868]">
            {plato.descripcion || "Menu publicado"}
          </p>
          {alergenos.length > 0 && (
            <p className="mt-2 text-[11px] font-semibold text-amber-800">
              Alergenos: {alergenos.join(", ")}
            </p>
          )}
          {guarniciones.length > 0 && (
            <p className="mt-1 text-[11px] font-semibold text-[#5B6B2A]">
              Guarnicion a elegir
            </p>
          )}
          {salsas.length > 0 && (
            <p className="mt-0.5 text-[11px] font-semibold text-[#A61A1A]">
              Salsa a elegir
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function MenuViewScreen({ onBack, onHacerPedido, semana }) {
  const dias = useMemo(() => semana?.dias || [], [semana]);
  const primerDiaConOpciones = useMemo(
    () => dias.find((dia) => (dia.opciones || []).length > 0) || dias[0] || null,
    [dias],
  );
  const [diaActivo, setDiaActivo] = useState(() => claveDia(primerDiaConOpciones || {}));
  const dia = dias.find((item) => claveDia(item) === diaActivo) || primerDiaConOpciones;
  const opciones = dia?.opciones || [];
  const puedePedir = puedeHacerPedidoSemana(semana);
  const pedidoCargado = tienePedidoSemana(semana);

  if (!semana) return null;

  return (
    <div className="flex h-full flex-col bg-[#FAF8F3]">
      <div className="shrink-0 bg-[#5B6B2A] px-5 pb-5 pt-12" style={{ borderRadius: "0 0 32px 32px" }}>
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 mb-3 flex items-center gap-1 text-white/70 hover:text-white"
        >
          <ChevronLeft size={20} />
          <span className="text-[13px] font-bold">Inicio</span>
        </button>
        <p className="text-xs font-bold uppercase tracking-widest text-white/55">Menu semanal</p>
        <h1 className="mt-1 font-serif text-[24px] font-bold text-white">{semana.rango}</h1>
        <p className="mt-1 text-[13px] text-white/60">Consulta los platos antes de cargar tu pedido.</p>
      </div>

      <div className="shrink-0 border-b border-[#E8E5DC] bg-white px-4 py-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {dias.map((item) => {
            const key = claveDia(item);
            const fecha = parseFecha(item.fecha);
            const activo = key === claveDia(dia || {});
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDiaActivo(key)}
                className={[
                  "min-w-14 rounded-2xl border px-3 py-2 text-center transition",
                  activo
                    ? "border-[#5B6B2A] bg-[#5B6B2A] text-white"
                    : "border-[#E8E5DC] bg-[#FAF8F3] text-[#7A7868]",
                ].join(" ")}
              >
                <span className="block font-serif text-lg font-bold leading-none">{fecha.dia}</span>
                <span className="mt-1 block text-[10px] font-black">{ABBR[key] || key?.slice(0, 3)?.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4">
        <div className="mb-3">
          <h2 className="font-serif text-xl font-bold text-[#2A2C1F]">{dia?.dia || "Dia"}</h2>
          <p className="text-sm text-[#6E6B64]">
            {opciones.length > 0 ? `${opciones.length} opciones disponibles` : "Sin opciones publicadas"}
          </p>
        </div>

        {dia?.motivo ? (
          <div className="mb-3 rounded-2xl border border-[#E8E5DC] bg-[#F5F3EE] px-4 py-3 text-sm font-semibold text-[#7A7868]">
            {dia.motivo}
          </div>
        ) : null}

        <div className="space-y-2">
          {opciones.map((plato) => (
            <PlatoMenuCard key={plato.id} plato={plato} />
          ))}
        </div>
      </div>

      {(puedePedir || pedidoCargado) ? (
        <div className="fixed inset-x-0 bottom-[calc(4.65rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[480px] border-t border-[#E8E5DC] bg-white/95 px-5 py-3 backdrop-blur">
          <BtnPrimary onClick={onHacerPedido} className="w-full">
            {pedidoCargado ? "Ver pedido" : "Hacer mi pedido"}
          </BtnPrimary>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-[calc(4.65rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[480px] border-t border-[#E8E5DC] bg-white/95 px-5 py-3 backdrop-blur">
          <div className="rounded-2xl bg-[#F7F6EF] px-4 py-3 text-center text-[12px] font-semibold text-[#7A7868]">
            {mensajePedidoNoEditable(semana)}
          </div>
        </div>
      )}
    </div>
  );
}
