import { unirClases } from "../../compartido/utils/clases.js";

export default function AppMobileShell({ children, className }) {
  return (
    <main
      className={unirClases(
        "mx-auto min-h-dvh max-w-[480px] bg-[#faf8f4] px-4 pt-5 pb-28 text-[#1a1a1a]",
        className,
      )}
    >
      {children}
    </main>
  );
}
