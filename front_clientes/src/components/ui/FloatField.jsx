import { useState } from 'react';

function cn(...args) { return args.filter(Boolean).join(' '); }

export default function FloatField({
  label, type = 'text', value, onChange, error, right, disabled, autoFocus,
}) {
  const [focused, setFocused] = useState(false);
  const floated = focused || (value?.length > 0) || type === 'date';

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <label className={cn(
          'absolute left-4 pointer-events-none transition-all duration-150 z-10',
          floated ? 'top-[7px] text-[10px] font-bold tracking-wide' : 'top-[14px] text-[15px]',
          floated
            ? (error ? 'text-red-500' : focused ? 'text-[#5B6B2A]' : 'text-[#9A9885]')
            : 'text-[#B8B6A8]',
        )}>
          {label}
        </label>
        <input
          type={type}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          className={cn(
            'w-full pt-6 pb-2 px-4 rounded-xl border text-[#2A2C1F] text-[15px] bg-white focus:outline-none transition-all',
            right && 'pr-11',
            disabled && 'bg-[#F5F3EE] text-[#7A7868] cursor-not-allowed',
            error
              ? 'border-red-400 ring-2 ring-red-200'
              : focused
                ? 'border-[#5B6B2A] ring-2 ring-[#5B6B2A]/12'
                : 'border-[#D8D5C8]',
          )}
        />
        {right && <div className="absolute right-3 bottom-2.5">{right}</div>}
      </div>
      {error && (
        <p className="text-[11px] text-red-500 px-1">{error}</p>
      )}
    </div>
  );
}
