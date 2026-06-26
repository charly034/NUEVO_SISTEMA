import { unirClases } from "../../compartido/utils/clases.js";

export default function AppMobileShell({ children, className }) {
  return (
    <main
      className={unirClases(
        "mx-auto flex h-dvh max-w-[480px] flex-col overflow-hidden bg-[#faf8f4] px-4 pt-3 pb-[calc(4.35rem+env(safe-area-inset-bottom))] text-[#1a1a1a] md:max-w-[760px] md:px-6 md:pt-5 lg:max-w-[860px]",
        className,
      )}
    >
      {children}
    </main>
  );
}
