import { unirClases } from "../utils/clases.js";

export default function Pagina({ children, className }) {
  return (
    <main
      className={unirClases(
        "mx-auto min-h-dvh w-full max-w-[560px] px-3.5 pb-20 pt-5",
        className,
      )}
    >
      {children}
    </main>
  );
}
