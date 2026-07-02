import { unirClases } from "../utils/clases.js";

export default function Pagina({ children, className }) {
  return (
    <main
      className={unirClases(
        "mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-[#faf8f4] px-4 pt-5 pb-[calc(5.25rem+env(safe-area-inset-bottom))] text-[#1a1a1a] md:max-w-[760px] md:px-6 md:pt-6 lg:max-w-[860px]",
        className,
      )}
    >
      {children}
    </main>
  );
}
