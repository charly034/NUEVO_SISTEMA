import { useEffect } from 'react';

const WIDTHS = {
  md: 'max-w-md',
  lg: 'max-w-xl',
};

export default function SideDrawer({ open, onClose, title, children, width = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-40 isolate flex justify-end ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`relative z-10 w-full ${WIDTHS[width]} bg-white shadow-2xl flex flex-col h-full transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900 text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-600 transition-colors text-xl leading-none p-1"
            aria-label="Cerrar panel"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
