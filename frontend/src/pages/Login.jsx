import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(username, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message || 'Login gagal');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sand-50 via-white to-secondary/10 px-4 relative overflow-hidden">
      <div className="absolute inset-10 rounded-[32px] bg-white/20 backdrop-blur-3xl border border-white/40" aria-hidden />
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 max-w-5xl w-full gap-4">
        <div className="hidden md:flex flex-col justify-between p-8 rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-lg shadow-2xl">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-primary font-semibold mb-2">Portal Keterbukaan Informasi</div>
            <h1 className="text-3xl font-bold text-slate-900 leading-tight" style={{ fontFamily: '"Newsreader", serif' }}>
              Transparansi cepat untuk instansi pemerintah
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              Kirim permohonan informasi dengan template terkontrol, lampiran aman, dan status log real-time.
            </p>
          </div>
          <div className="mt-6 space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Jalur aman dengan SMTP pribadi dan App Password.
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Validasi data penerima sebelum kirim massal.
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Log terbuka, siap audit.
            </div>
          </div>
        </div>
        <div className="bg-white shadow-2xl rounded-3xl p-8 w-full border border-white/60">
          <div className="mb-6">
            <p className="text-sm font-semibold text-primary">Email Automation</p>
            <h2 className="text-2xl font-bold text-slate-900">Masuk ke Dashboard</h2>
            <p className="text-slate-500 text-sm mt-1">Gunakan akun admin atau user.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="********"
              />
            </div>
            {error && <div className="text-sm text-rose-500">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold shadow-soft hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
