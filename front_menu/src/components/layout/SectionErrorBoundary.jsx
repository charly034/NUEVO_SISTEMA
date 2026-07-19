import { Component } from 'react';
import { Link } from 'react-router-dom';

function ErrorFallback({ onRetry }) {
  return (
    <section className="mx-auto flex min-h-[360px] max-w-2xl items-center justify-center px-4 py-10">
      <div className="w-full rounded-xl border border-red-100 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-700">
          <span className="text-xl font-bold">!</span>
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">Ocurrió un error al cargar esta sección</h1>
        <p className="mt-2 text-sm text-gray-500">
          Podés reintentar la carga o volver al inicio del panel.
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 sm:w-auto"
          >
            Reintentar
          </button>
          <Link
            to="/"
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </section>
  );
}

export default class SectionErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('Error al renderizar seccion admin:', error, info);
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
