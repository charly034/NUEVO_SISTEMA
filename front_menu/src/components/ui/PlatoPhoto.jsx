const PALETTES = [
  {
    surface: 'bg-emerald-50',
    ring: 'ring-emerald-100',
    accent: 'bg-emerald-200',
    icon: 'text-emerald-600',
    text: 'text-emerald-700',
  },
  {
    surface: 'bg-amber-50',
    ring: 'ring-amber-100',
    accent: 'bg-amber-200',
    icon: 'text-amber-600',
    text: 'text-amber-700',
  },
  {
    surface: 'bg-sky-50',
    ring: 'ring-sky-100',
    accent: 'bg-sky-200',
    icon: 'text-sky-600',
    text: 'text-sky-700',
  },
  {
    surface: 'bg-rose-50',
    ring: 'ring-rose-100',
    accent: 'bg-rose-200',
    icon: 'text-rose-600',
    text: 'text-rose-700',
  },
  {
    surface: 'bg-indigo-50',
    ring: 'ring-indigo-100',
    accent: 'bg-indigo-200',
    icon: 'text-indigo-600',
    text: 'text-indigo-700',
  },
  {
    surface: 'bg-teal-50',
    ring: 'ring-teal-100',
    accent: 'bg-teal-200',
    icon: 'text-teal-600',
    text: 'text-teal-700',
  },
];

function hash(value = '') {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total = (total * 31 + value.charCodeAt(i)) % PALETTES.length;
  return total;
}

function initials(value = '') {
  const parts = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'P';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function categoryName(plato) {
  return plato?.tags?.[0] || plato?.tipo || plato?.nombre || 'plato';
}

function PlateIcon({ className }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className={className} fill="none">
      <circle cx="24" cy="25" r="13" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="25" r="6" stroke="currentColor" strokeWidth="2" opacity="0.45" />
      <path d="M12 10v12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M9 10v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
      <path d="M15 10v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
      <path d="M36 10v28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36 10c4 4 4 10 0 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}

export default function PlatoPhoto({ src, alt, plato, className = '', imgClassName = 'h-full w-full object-cover', size = 'sm' }) {
  if (src) return <img src={src} alt={alt} className={imgClassName} />;

  const category = categoryName(plato);
  const palette = PALETTES[hash(category)];
  const large = size === 'lg';

  return (
    <div
      role="img"
      aria-label={`${alt || 'Plato'} sin foto`}
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${palette.surface} ${className}`}
    >
      <span className={`absolute -right-4 -top-4 h-12 w-12 rounded-full ${palette.accent} opacity-55`} />
      <span className={`absolute -bottom-5 -left-4 h-14 w-14 rounded-full ${palette.accent} opacity-35`} />
      <div className={`relative flex items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ${palette.ring} ${large ? 'h-16 w-16' : 'h-9 w-9'}`}>
        <PlateIcon className={`${large ? 'h-9 w-9' : 'h-5 w-5'} ${palette.icon}`} />
      </div>
      <span className={`absolute bottom-1.5 right-1.5 rounded-full bg-white/85 px-1.5 py-0.5 font-semibold leading-none shadow-sm ${large ? 'text-xs' : 'text-[10px]'} ${palette.text}`}>
        {initials(alt)}
      </span>
    </div>
  );
}
