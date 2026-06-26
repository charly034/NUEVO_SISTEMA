import { unirClases } from "../../compartido/utils/clases.js";

export default function BotonIcono({
  "aria-label": ariaLabel,
  children,
  className,
  disabled = false,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      className={unirClases(
        "inline-flex size-11 items-center justify-center rounded-full border border-[#e4ded3] bg-white/95 text-[#2d5a27] shadow-[0_10px_26px_rgba(45,90,39,0.14)] transition hover:bg-[#f0f7ee] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d5a27] disabled:cursor-not-allowed disabled:opacity-35",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
