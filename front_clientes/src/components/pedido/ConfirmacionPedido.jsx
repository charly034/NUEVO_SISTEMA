import { createPortal } from "react-dom";

export default function ConfirmacionPedido({ mensaje }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] mx-auto flex max-w-[480px] items-center justify-center bg-[#08a85b] px-8 text-white md:max-w-[760px] lg:max-w-[860px]"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-[23rem] flex-col items-center text-center">
        <div
          className="flex h-36 w-36 items-center justify-center rounded-full bg-white/95 shadow-[0_18px_38px_rgba(0,0,0,0.2)]"
          aria-hidden="true"
        >
          <svg
            className="h-24 w-24"
            viewBox="0 0 96 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="48" cy="48" r="44" fill="#f0f7ee" />
            <path
              d="M28 49.5L42 63L69 34"
              stroke="#08a85b"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="mt-3 text-[2rem] font-black leading-tight tracking-normal">
          {mensaje}
        </p>
      </div>
    </div>,
    document.body,
  );
}
