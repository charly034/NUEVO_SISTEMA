export default function HeaderUsuario({
  nombre = "Florencia",
  subtitulo = "Tu pedido semanal",
}) {
  return (
    <header className="shrink-0 px-1 pb-1.5 md:pb-3">
      <h1 className="text-[1.65rem] font-black leading-tight tracking-normal text-[#1a1a1a] md:text-[2rem]">
        Hola, {nombre} 👋
      </h1>
      <p className="text-[0.95rem] font-medium leading-tight text-[#716c64]">
        {subtitulo}
      </p>
    </header>
  );
}
