import { unirClases } from "../utils/clases.js";

export default function AuthLayout({
  icono = "🌿",
  titulo = "La Quinta",
  subtitulo,
  children,
  compacto = false,
  className,
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-2 sm:py-5">
      <section
        className={unirClases(
          "w-full rounded-[20px] border border-slate-100 bg-white text-center shadow-[0_4px_24px_rgba(0,0,0,0.07)]",
          compacto
            ? "max-w-sm px-6 py-7 sm:px-7 sm:py-8"
            : "max-w-md px-5 py-5 sm:px-8 sm:py-10",
          className,
        )}
      >
        <div className="mb-1.5 text-3xl leading-none sm:mb-2 sm:text-5xl" aria-hidden="true">
          {icono}
        </div>
        <h1 className="text-xl font-extrabold text-[var(--verde)] sm:text-2xl">
          {titulo}
        </h1>
        {subtitulo && (
          <p className="mt-1 text-sm text-[var(--subtexto)]">{subtitulo}</p>
        )}
        <div className="mt-4 sm:mt-6">{children}</div>
      </section>
    </main>
  );
}
