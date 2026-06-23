export default function ErrorMessage({ message = 'Ocurrió un error', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="text-3xl">⚠️</div>
      <p className="text-gray-600 text-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-xs">
          Reintentar
        </button>
      )}
    </div>
  );
}
