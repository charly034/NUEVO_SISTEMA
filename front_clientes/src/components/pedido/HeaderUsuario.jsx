export default function HeaderUsuario({
  nombre = "Florencia",
  subtitulo = "Tu pedido semanal",
  estado = "Semana actual disponible",
}) {
  return (
    <header className="px-1 pt-1 pb-5">
      <p className="mb-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-[#2d5a27] shadow-[0_8px_20px_rgba(45,90,39,0.06)]">
        {estado}
      </p>
      <h1 className="text-3xl font-black leading-tight tracking-normal text-[#1a1a1a]">
        Hola, {nombre} 👋
      </h1>
      <p className="mt-1 text-sm font-medium text-[#716c64]">{subtitulo}</p>
    </header>
  );
}
