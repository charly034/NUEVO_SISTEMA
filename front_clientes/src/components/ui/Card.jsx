import { unirClases } from "../../compartido/utils/clases.js";

export default function Card({ children, className, ...props }) {
  return (
    <article
      className={unirClases(
        "rounded-[2rem] border border-[#ebe6dc] bg-white shadow-[0_18px_45px_rgba(45,90,39,0.08)]",
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}
