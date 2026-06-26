import { Search } from "lucide-react";

export default function Buscador({
  "aria-label": ariaLabel,
  onChange,
  placeholder = "Buscar",
  value,
}) {
  const label = ariaLabel || placeholder;

  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-[#8a857c]"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={label}
        autoComplete="off"
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-[#e8e3da] bg-white pl-10 pr-3 text-base font-bold text-[#1a1a1a] outline-none placeholder:text-[#9c968d] focus:border-[#2d5a27] focus:ring-2 focus:ring-[#d8e9d2]"
      />
    </label>
  );
}
