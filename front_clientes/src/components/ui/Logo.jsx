export default function Logo({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={className}>
      <line x1="8"    y1="3"  x2="8"    y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12.5" y1="3"  x2="12.5" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="17"   y1="3"  x2="17"   y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 10 C8 13 12.5 13 12.5 13 C12.5 13 17 13 17 10" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <line x1="12.5" y1="13" x2="12.5" y2="25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 17 Q23.5 13.5 22.5 20 Q21.5 24.5 17 23.5 C18.5 21.5 17.5 19 17 17Z" fill="currentColor" opacity="0.65" />
      <circle cx="21.5" cy="15.5" r="2" fill="currentColor" opacity="0.45" />
    </svg>
  );
}
