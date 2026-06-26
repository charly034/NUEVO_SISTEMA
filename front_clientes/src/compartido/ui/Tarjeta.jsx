import { unirClases } from "../utils/clases.js";

export default function Tarjeta({ children, className, as: Element = "section" }) {
  return (
    <Element
      className={unirClases(
        "rounded-[14px] border border-[var(--borde)] bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </Element>
  );
}
