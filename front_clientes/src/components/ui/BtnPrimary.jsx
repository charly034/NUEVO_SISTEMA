function cn(...args) { return args.filter(Boolean).join(' '); }

const SIZES = {
  sm: 'px-4 py-2 text-sm gap-1.5',
  md: 'px-5 py-3.5 text-[15px] gap-2',
};

const VARIANTS = {
  primary:   'bg-[#5B6B2A] text-white hover:bg-[#4D5A24] shadow-[0_4px_16px_rgba(91,107,42,0.30)]',
  secondary: 'bg-[#EDF0E4] text-[#3A4A1A] hover:bg-[#E2E8D2] border border-[#5B6B2A]/12',
  ghost:     'text-[#5B6B2A] hover:bg-[#EDF0E4]',
  danger:    'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200',
};

export default function BtnPrimary({
  children, onClick, variant = 'primary', disabled, loading,
  size = 'md', className, type = 'button',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
    >
      {loading
        ? <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />Guardando...</>
        : children}
    </button>
  );
}
