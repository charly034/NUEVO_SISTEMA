const TONE_CLASSES = {
  neutral: 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:ring-gray-400',
  brand: 'text-gray-500 hover:bg-brand-50 hover:text-brand-600 focus:ring-brand-500',
  danger: 'text-gray-500 hover:bg-red-50 hover:text-red-500 focus:ring-red-500',
};

export function IconActionButton({ label, tooltip = label, tone = 'neutral', onClick, children, disabled = false }) {
  return (
    <span className="group/action relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={tooltip}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 ${TONE_CLASSES[tone] ?? TONE_CLASSES.neutral}`}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/action:opacity-100 group-focus-within/action:opacity-100">
        {tooltip}
      </span>
    </span>
  );
}

export function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 2 4 4L8 20l-5 1 1-5L18 2Z" />
      <path d="m14 6 4 4" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
