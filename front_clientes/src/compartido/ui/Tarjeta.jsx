import { unirClases } from "../utils/clases.js";

export default function Tarjeta({ children, className, as: Element = "section" }) {
  return (
    <Element
      className={unirClases(
        "rounded-3xl border border-[#eee8df] bg-white shadow-[0_12px_26px_rgba(45,90,39,0.07)]",
        className,
      )}
    >
      {children}
    </Element>
  );
}
