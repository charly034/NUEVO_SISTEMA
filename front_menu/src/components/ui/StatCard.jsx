import Spinner from './Spinner.jsx';

export default function StatCard({ label, value, icon, color = 'brand', loading = false, sub }) {
  const colors = {
    brand:  'bg-brand-50  text-brand-700  border-brand-100',
    blue:   'bg-blue-50   text-blue-700   border-blue-100',
    amber:  'bg-amber-50  text-amber-700  border-amber-100',
    red:    'bg-red-50    text-red-700    border-red-100',
    gray:   'bg-gray-50   text-gray-700   border-gray-100',
  };

  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`flex-shrink-0 w-11 h-11 rounded-lg border flex items-center justify-center text-xl ${colors[color]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {loading ? (
          <Spinner size="sm" className="mt-2" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{value ?? '—'}</p>
        )}
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
