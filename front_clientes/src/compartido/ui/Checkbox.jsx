import { unirClases } from "../utils/clases.js";

export default function Checkbox({ label, className, ...props }) {
  return (
    <label
      className={unirClases(
        "flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-slate-500",
        className,
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-[var(--verde)]"
        {...props}
      />
      {label}
    </label>
  );
}
