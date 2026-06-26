import LottieReact from "lottie-react";
import { createPortal } from "react-dom";
import animacionExito from "../../../Success.json";

const Lottie = LottieReact.default || LottieReact;

export default function ConfirmacionPedido({ mensaje }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] mx-auto flex max-w-[480px] items-center justify-center bg-[#08a85b] px-8 text-white md:max-w-[760px] lg:max-w-[860px]"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-[23rem] flex-col items-center text-center">
        <div className="h-44 w-44 drop-shadow-[0_18px_38px_rgba(0,0,0,0.2)]">
          <Lottie
            animationData={animacionExito}
            autoplay
            loop={false}
            aria-hidden="true"
          />
        </div>

        <p className="mt-3 text-[2rem] font-black leading-tight tracking-normal">
          {mensaje}
        </p>
      </div>
    </div>,
    document.body,
  );
}
