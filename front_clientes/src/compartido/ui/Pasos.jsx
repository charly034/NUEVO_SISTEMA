import { unirClases } from "../utils/clases.js";

export default function Pasos({ pasos, pasoActual }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {pasos.map((paso, index) => {
        const numero = index + 1;
        const activo = numero <= pasoActual;
        return (
          <div key={paso} className="flex items-center gap-2">
            {index > 0 && <span className="h-0.5 w-8 rounded bg-slate-200" />}
            <div
              className={unirClases(
                "flex items-center gap-1.5",
                activo ? "opacity-100" : "opacity-35",
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--verde)] text-xs font-extrabold text-white">
                {numero}
              </span>
              <span className="text-xs font-semibold text-[var(--verde)]">
                {paso}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
