import { cloneElement } from 'react';

export function Tabs({ value, onChange, children }) {
  return (
    <div className="border-b border-gray-200">
      <nav className="flex gap-0" role="tablist">
        {children && (Array.isArray(children) ? children : [children]).map((child) =>
          child ? cloneElement(child, { _active: child.props.value === value, _onChange: onChange }) : null
        )}
      </nav>
    </div>
  );
}

export function Tab({ value, label, _active, _onChange }) {
  return (
    <button
      role="tab"
      aria-selected={_active}
      onClick={() => _onChange(value)}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        _active
          ? 'border-green-700 text-green-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}
