import { useState } from 'react';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err?.message || 'Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>🌿</div>
        <h1 style={s.titulo}>La Quinta</h1>
        <p style={s.sub}>Sistema de pedidos</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>
            Email
            <input
              style={s.input}
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="martin@um.edu.ar"
            />
          </label>
          <label style={s.label}>
            Contraseña
            <input
              style={s.input}
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {error && <p style={s.error}>{error}</p>}
          <button type="submit" style={s.btn} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  wrap: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { background: '#fff', borderRadius: 20, padding: '40px 32px', width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' },
  logo: { fontSize: 56, marginBottom: 8 },
  titulo: { fontSize: 28, fontWeight: 800, color: 'var(--verde)', marginBottom: 4 },
  sub: { color: 'var(--subtexto)', marginBottom: 32 },
  form: { display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 600, fontSize: 14 },
  input: { padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--borde)', fontSize: 16, outline: 'none' },
  error: { color: 'var(--error)', fontSize: 14, textAlign: 'center' },
  btn: { background: 'var(--verde)', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 16, fontWeight: 700, marginTop: 8 },
};
