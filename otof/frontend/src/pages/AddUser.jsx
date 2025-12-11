import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const AddUser = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [form, setForm] = useState({ username: '', password: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmUser, setConfirmUser] = useState(null);

  if (!isAdmin) {
    return (
      <div className="p-6 rounded-2xl border border-slate-200 bg-white text-slate-700">
        Halaman ini hanya untuk admin.
      </div>
    );
  }

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data || []);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal mengambil daftar user');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await api.post('/users', {
        username: form.username,
        password: form.password
      });
      setMessage(res.data?.message || 'User berhasil dibuat');
      setForm({ username: '', password: '' });
      await loadUsers();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal membuat user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmUser) return;
    setDeletingId(confirmUser.id);
    setMessage('');
    try {
      const res = await api.delete(`/users/${confirmUser.id}`);
      setMessage(res.data?.message || 'User dihapus');
      await loadUsers();
      setConfirmUser(null);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menghapus user');
    } finally {
      setDeletingId(null);
    }
  };

  const infoItems = [
    'Role otomatis "user" (tanpa akses admin).',
    'User hanya dapat melihat badan publik yang ditugaskan.',
    'Siapkan SMTP pribadi di halaman Pengaturan agar bisa mengirim.',
    'Gunakan password kuat, admin bisa reset lewat DB jika lupa.'
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Kelola akun</p>
          <h1 className="text-2xl font-bold text-slate-900">Tambah User Baru</h1>
        </div>
        <span className="px-3 py-2 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          Admin only
        </span>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-soft p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-3">
            <div className="text-sm text-slate-600">
              Buat akun dengan cepat. Role default <span className="font-semibold">user</span> sehingga akses terbatas
              hanya pada penugasan.
            </div>
            {message && (
              <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                {message}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
              <div>
                <label className="text-sm font-semibold text-slate-700">Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoComplete="username"
              className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="contoh: user01"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="new-password"
              className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="minimal 8 karakter"
            />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 disabled:opacity-60"
                >
                  {loading ? 'Memproses...' : 'Tambah User'}
                </button>
                <span className="text-xs text-slate-500">Role: user (default)</span>
              </div>
            </form>
          </div>
          <div className="md:w-80 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="text-sm font-semibold text-slate-800">Catatan cepat</div>
            <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
              {infoItems.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-soft p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-800">Daftar User</div>
            <p className="text-xs text-slate-500">Hapus user akan mengosongkan penugasan mereka.</p>
          </div>
          {loadingUsers && <span className="text-xs text-slate-500">Memuat...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-slate-500">
                    Belum ada user.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{u.id}</td>
                    <td className="px-4 py-2 font-semibold text-slate-900">{u.username}</td>
                    <td className="px-4 py-2 text-slate-700">{u.role}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => setConfirmUser(u)}
                        disabled={deletingId === u.id || u.id === user?.id || u.role === 'admin'}
                        className="text-rose-600 font-semibold hover:underline disabled:text-slate-400"
                        title={
                          u.id === user?.id
                            ? 'Tidak bisa hapus akun sendiri'
                            : u.role === 'admin'
                            ? 'Tidak bisa hapus admin'
                            : 'Hapus user'
                        }
                      >
                        {deletingId === u.id ? 'Menghapus...' : 'Hapus'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Hapus user?</h3>
                <p className="text-sm text-slate-600">
                  User <span className="font-semibold text-slate-900">{confirmUser.username}</span> akan dihapus dan
                  penugasannya di-reset menjadi belum ditugaskan.
                </p>
              </div>
              <button
                onClick={() => setConfirmUser(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingId === confirmUser.id}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold shadow-soft hover:bg-rose-700 disabled:opacity-60"
              >
                {deletingId === confirmUser.id ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddUser;
