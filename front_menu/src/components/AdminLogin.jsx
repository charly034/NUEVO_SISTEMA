import { useState } from 'react';

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <section className="card w-full max-w-sm p-8">
        <div className="text-center mb-7">
          <div className="text-5xl mb-2">🌿</div>
          <h1 className="text-2xl font-bold text-brand-700">La Quinta</h1>
          <p className="text-sm text-gray-500 mt-1">Panel administrativo</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              required
              autoFocus
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Contraseña
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}
