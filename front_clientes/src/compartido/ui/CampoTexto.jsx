import { forwardRef } from "react";
import { unirClases } from "../utils/clases.js";

const CampoTexto = forwardRef(function CampoTexto(
  {
    label,
    ayuda,
    error,
    id,
    endAdornment,
    className,
    inputClassName,
    ...props
  },
  ref,
) {
  const inputId = id || props.name || undefined;
  const ayudaId = ayuda && inputId ? `${inputId}-ayuda` : undefined;
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  const describedBy = [props["aria-describedby"], ayudaId, errorId]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <label className={unirClases("flex flex-col gap-1.5 text-left", className)}>
      {label && (
        <span className="text-sm font-semibold text-slate-700">{label}</span>
      )}
      <span className="relative block">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || props["aria-invalid"]}
          aria-describedby={describedBy}
          className={unirClases(
            "h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--verde-light)]",
            endAdornment && "pr-11",
            error && "border-red-500",
            inputClassName,
          )}
          {...props}
        />
        {endAdornment}
      </span>
      {ayuda && (
        <span id={ayudaId} className="text-xs italic text-slate-500">
          {ayuda}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </span>
      )}
    </label>
  );
});

export default CampoTexto;
