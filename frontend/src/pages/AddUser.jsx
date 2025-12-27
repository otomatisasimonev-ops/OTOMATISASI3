import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

const importFields = [
  { key: 'username', label: 'Username', aliases: ['username', 'user', 'akun'] },
  { key: 'group', label: 'Group', aliases: ['group', 'grup', 'kelompok', 'bagian'] },
  { key: 'nomer_hp', label: 'Nomor HP', aliases: ['nomer hp', 'nomor hp', 'no hp', 'no_hp', 'hp', 'phone', 'telp', 'telepon'] },
  { key: 'email', label: 'Email', aliases: ['email', 'e-mail'] }
];

const AddUser = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [form, setForm] = useState({
    username: '',
    password: '',
    group: '',
    nomer_hp: '',
    email: ''
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmUser, setConfirmUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [roleChangeUser, setRoleChangeUser] = useState(null);
  const [roleChangeLoading, setRoleChangeLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importRows, setImportRows] = useState([]);
  const [importMapping, setImportMapping] = useState(() => {
    const init = {};
    importFields.forEach((field) => {
      init[field.key] = '';
    });
    return init;
  });
  const [importError, setImportError] = useState('');

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
    setMessageType('info');
    try {
      const res = await api.post('/users', {
        username: form.username,
        password: form.password,
        group: form.group,
        nomer_hp: form.nomer_hp,
        email: form.email
      });
      setMessage(res.data?.message || 'User berhasil dibuat');
      setMessageType('success');
      setForm({ username: '', password: '', group: '', nomer_hp: '', email: '' });
      await loadUsers();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal membuat user');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmUser) return;
    setDeletingId(confirmUser.id);
    setMessage('');
    setMessageType('info');
    try {
      const res = await api.delete(`/users/${confirmUser.id}`);
      setMessage(res.data?.message || 'User dihapus');
      setMessageType('success');
      setUsers((prev) => prev.filter((u) => u.id !== confirmUser.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(confirmUser.id);
        return next;
      });
      setConfirmUser(null);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menghapus user');
      setMessageType('error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (!resetPassword.trim()) {
      setMessage('Password baru wajib diisi');
      return;
    }
    setResetLoading(true);
    setMessage('');
    setMessageType('info');
    try {
      const res = await api.patch(`/users/${resetUser.id}/password`, { password: resetPassword });
      setMessage(res.data?.message || 'Password direset');
      setMessageType('success');
      setResetPassword('');
      setResetUser(null);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal reset password');
      setMessageType('error');
    } finally {
      setResetLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!roleChangeUser) return;
    setRoleChangeLoading(true);
    setMessage('');
    setMessageType('info');
    try {
      const nextRole = roleChangeUser.role === 'admin' ? 'user' : 'admin';
      const res = await api.patch(`/users/${roleChangeUser.id}/role`, { role: nextRole });
      setMessage(res.data?.message || 'Role diubah');
      setMessageType('success');
      await loadUsers();
      setRoleChangeUser(null);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal mengubah role');
      setMessageType('error');
    } finally {
      setRoleChangeLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Hapus ${selectedIds.size} user terpilih?`)) return;
    setMessage('');
    setMessageType('info');
    try {
      const res = await api.post('/users/bulk-delete', { ids: Array.from(selectedIds) });
      setMessage(res.data?.message || `Berhasil menghapus ${selectedIds.size} user.`);
      setMessageType('success');
      const selectedSet = new Set(selectedIds);
      setUsers((prev) => prev.filter((u) => !selectedSet.has(u.id)));
      setSelectedIds(new Set());
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menghapus user terpilih');
      setMessageType('error');
    }
  };
  const handleImportFile = async (e) => {
    if (!isAdmin) {
      setImportError('Akses ditolak: import hanya untuk admin.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportPreview([]);
    setImportHeaders([]);
    setImportRows([]);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!rows.length) {
        setImportError('File kosong.');
        return;
      }
      const header = rows[0].map((h) => String(h || '').trim());
      const dataRows = rows.slice(1).filter((r) => r.some((cell) => String(cell || '').trim()));
      setImportHeaders(header);
      setImportRows(dataRows);

      const lowerHeader = header.map((h) => h.toLowerCase());
      const nextMap = {};
      importFields.forEach((field) => {
        const idx = lowerHeader.findIndex((h) => field.aliases.some((alias) => h.includes(alias)));
        nextMap[field.key] = idx >= 0 ? header[idx] : '';
      });
      setImportMapping(nextMap);

      const previewObjs = buildMappedPreview(dataRows, header, nextMap);
      setImportPreview(previewObjs.slice(0, 5));
    } catch (err) {
      console.error(err);
      setImportError('Gagal membaca file. Pastikan format CSV/XLSX.');
    }
  };

  const buildMappedPreview = (rows, header, mapping) =>
    rows.map((r) => {
      const rowMap = Object.fromEntries(header.map((h, idx) => [h, r[idx]]));
      const obj = {
        username: '',
        group: '',
        nomer_hp: '',
        email: '',
        password: ''
      };
      importFields.forEach((field) => {
        const selectedHeader = mapping[field.key];
        obj[field.key] = String(rowMap[selectedHeader] ?? '').trim();
      });
      obj.password = obj.nomer_hp;
      return obj;
    });

  useEffect(() => {
    if (!importRows.length) return;
    const previewObjs = buildMappedPreview(importRows, importHeaders, importMapping);
    setImportPreview(previewObjs.slice(0, 5));
  }, [importRows, importHeaders, importMapping]);

  const submitImport = async () => {
    if (!isAdmin) {
      setImportError('Akses ditolak: import hanya untuk admin.');
      return;
    }
    const missing = importFields.filter((field) => !importMapping[field.key]);
    if (missing.length) {
      setImportError(`Pilih kolom untuk: ${missing.map((m) => m.label).join(', ')}`);
      return;
    }
    if (importRows.length === 0) {
      setImportError('Tidak ada data untuk diimport.');
      return;
    }

    const mapped = buildMappedPreview(importRows, importHeaders, importMapping);
    try {
      const payloadRecords = mapped.map((row) => ({
        username: row.username,
        group: row.group,
        nomer_hp: row.nomer_hp,
        email: row.email,
        password: row.password
      }));
      await api.post('/users/import', { records: payloadRecords });
      setImportError('');
      setImportOpen(false);
      setMessage(`Import berhasil (${payloadRecords.length} data).`);
      setMessageType('success');
      setImportHeaders([]);
      setImportRows([]);
      setImportPreview([]);
      const resetMap = {};
      importFields.forEach((field) => (resetMap[field.key] = ''));
      setImportMapping(resetMap);
      await loadUsers();
    } catch (err) {
      setImportError(err.response?.data?.message || 'Gagal import user');
      setMessageType('error');
    }
  };

  const samplePreview = useMemo(() => users.slice(0, 3), [users]);
  const searchValue = search.toLowerCase();
  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter ? u.role === roleFilter : true;
    if (!matchesRole) return false;
    if (!searchValue) return true;
    return [u.username, u.email, u.nomer_hp, u.group].some((value) =>
      String(value || '').toLowerCase().includes(searchValue)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectableUsers = pagedUsers.filter((u) => u.role !== 'admin' && u.id !== user?.id);
  const allSelected =
    selectableUsers.length > 0 && selectableUsers.every((u) => selectedIds.has(u.id));

  const infoItems = [
    'Role otomatis "user" (tanpa akses admin).',
    'User hanya dapat melihat badan publik yang ditugaskan.',
    'Siapkan SMTP pribadi di halaman Pengaturan agar bisa mengirim.',
    'Password awal import disamakan dengan nomor HP.',
    'User bisa ganti password di halaman Pengaturan.',
    'Admin bisa reset password lewat tombol reset di tabel.'
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Kelola akun</p>
          <h1 className="text-2xl font-bold text-slate-900">Tambah User Baru</h1>
        </div>
        <span className="px-3 py-2 rounded-full bg-primary/10 text-primary text-xs font-semibold">Admin only</span>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-soft p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-3">
            <div className="text-sm text-slate-600">
              Buat akun dengan cepat. Role default <span className="font-semibold">user</span> sehingga akses terbatas
              hanya pada penugasan.
            </div>
            {message && (
              <div
                className={`px-4 py-3 rounded-xl border text-sm ${messageType === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : messageType === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
              >
                {message}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Group</label>
                  <input
                    value={form.group}
                    onChange={(e) => setForm({ ...form, group: e.target.value })}
                    className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Contoh: Kominfo"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Nomor HP</label>
                  <input
                    type="tel"
                    value={form.nomer_hp}
                    onChange={(e) => setForm({ ...form, nomer_hp: e.target.value })}
                    className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="nama@domain.com"
                  />
                </div>
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
            <button
              onClick={() => setImportOpen(true)}
              className="w-full mt-3 bg-emerald-600 text-white px-4 py-3 rounded-xl font-black shadow-soft hover:bg-emerald-700 tracking-[0.18em] uppercase text-lg md:text-base"
            >
              Import wizard
            </button>
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
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <span>{selectedIds.size} user dipilih</span>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
            >
              Hapus semua
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari email/username"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="">Semua role</option>
            <option value="admin">admin</option>
            <option value="user">user</option>
          </select>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >

            <option value={10}>10 baris</option>
            <option value={15}>15 baris</option>
            <option value={30}>30 baris</option>
            <option value={50}>50 baris</option>
          </select>
          <div className="flex items-center text-xs text-slate-500 px-2">Total: {filteredUsers.length}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left w-[48px]">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua"
                    checked={allSelected}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) {
                        selectableUsers.forEach((u) => next.add(u.id));
                      } else {
                        selectableUsers.forEach((u) => next.delete(u.id));
                      }
                      setSelectedIds(next);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Group</th>
                <th className="px-4 py-3 text-left">Nomor HP</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">SMTP</th>
                <th className="px-4 py-3 text-left">Aksi</th>
                <th className="px-4 py-3 text-left">Ganti role</th>
              </tr>
            </thead>
            <tbody>
              {pagedUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-4 text-center text-slate-500">
                    Belum ada user. Tambah user pertama untuk mulai penugasan.
                  </td>
                </tr>
              ) : (
                pagedUsers.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Pilih user ${u.username}`}
                        checked={selectedIds.has(u.id)}
                        disabled={u.role === 'admin' || u.id === user?.id}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) {
                            next.add(u.id);
                          } else {
                            next.delete(u.id);
                          }
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                    <td className="px-4 py-2">{u.id}</td>
                    <td className="px-4 py-2 font-semibold text-slate-900">{u.username}</td>
                    <td className="px-4 py-2 text-slate-700">{u.group || '-'}</td>
                    <td className="px-4 py-2 text-slate-700">{u.nomer_hp || '-'}</td>
                    <td className="px-4 py-2 text-slate-700">{u.email || '-'}</td>
                    <td className="px-4 py-2 text-slate-700">{u.role}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] border ${u.hasSmtp
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                      >
                        {u.hasSmtp ? 'Siap' : 'Belum'}
                      </span>
                    </td>
                    <td className="px-4 py-2 space-x-2">
                      <button
                        onClick={() => setResetUser(u)}
                        disabled={resetLoading || u.role === 'admin'}
                        className="text-primary font-semibold hover:underline disabled:text-slate-400"
                        title="Reset password"
                      >
                        Reset
                      </button>
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
                    <td className="px-4 py-2">
                      {u.id === user?.id ? (
                        <span className="text-xs text-slate-400">-</span>
                      ) : (
                        <button
                          onClick={() => setRoleChangeUser(u)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs"
                          title="Ubah role"
                        >
                          {u.role === 'admin' ? 'Turunkan' : 'Jadikan admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredUsers.length > pageSize && (
          <div className="flex items-center justify-between text-sm text-slate-600 mt-2">
            <span>
              Halaman {safePage} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-2 rounded-xl border border-slate-200 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-2 rounded-xl border border-slate-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {importOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Import User CSV/Excel</h2>
                <p className="text-sm text-slate-600">
                  Pilih pemetaan kolom untuk Username, Group, Nomor HP, Email. Password otomatis disamakan dengan Nomor HP.
                </p>
              </div>
              <button
                onClick={() => setImportOpen(false)}
                className="text-slate-500 hover:text-slate-800 text-xl font-bold"
                aria-label="Tutup"
              >
                X
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Upload file</label>
                <input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleImportFile}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3"
                />
                {importError && (
                  <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {importError}
                  </div>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-800 mb-1">Contoh header</div>
                <pre className="whitespace-pre-wrap text-xs text-slate-600">Username | Group | Nomor HP | Email</pre>
                <p className="text-xs text-slate-500 mt-2">
                  Pastikan baris pertama adalah header. Pilih kolom yang sesuai di bagian pemetaan.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {importHeaders.length > 0 ? (
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="text-sm font-semibold text-slate-800 mb-2">Pilih kolom untuk 4 field wajib</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {importFields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600">{field.label}</label>
                        <select
                          value={importMapping[field.key] || ''}
                          onChange={(e) =>
                            setImportMapping((prev) => ({
                              ...prev,
                              [field.key]: e.target.value
                            }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                        >
                          <option value="">-- pilih kolom --</option>
                          {importHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Header terdeteksi: {importHeaders.join(' | ')}</p>
                </div>
              ) : (
                <div className="border border-dashed border-slate-300 rounded-xl p-3 text-sm text-slate-600 bg-slate-50">
                  Upload file terlebih dahulu untuk memilih mapping kolom.
                </div>
              )}

              <div className="border-2 border-emerald-200 bg-emerald-50 rounded-xl p-3 shadow-soft">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-bold text-emerald-700 mb-2">
                  Contoh data (dari tabel saat ini)
                </div>
                <table className="w-full text-xs text-slate-700">
                  <thead>
                    <tr>
                      <th className="text-left">Username</th>
                      <th className="text-left">Group</th>
                      <th className="text-left">Nomor HP</th>
                      <th className="text-left">Email</th>
                      <th className="text-left">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samplePreview.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-2 text-slate-500">
                          Belum ada data.
                        </td>
                      </tr>
                    ) : (
                      samplePreview.map((row) => (
                        <tr key={row.id}>
                          <td className="py-1">{row.username || '-'}</td>
                          <td className="py-1">{row.group || '-'}</td>
                          <td className="py-1">{row.nomer_hp || '-'}</td>
                          <td className="py-1">{row.email || '-'}</td>
                          <td className="py-1">{row.nomer_hp || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-2 border-sky-200 bg-sky-50 rounded-xl p-3 shadow-soft">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white border border-sky-200 text-[11px] font-bold text-sky-700 mb-2">
                  Preview file (5 baris pertama)
                </div>
                <table className="w-full text-xs text-slate-700">
                  <thead>
                    <tr>
                      <th className="text-left">Username</th>
                      <th className="text-left">Group</th>
                      <th className="text-left">Nomor HP</th>
                      <th className="text-left">Email</th>
                      <th className="text-left">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-2 text-slate-500">
                          Upload file untuk melihat preview.
                        </td>
                      </tr>
                    ) : (
                      importPreview.slice(0, 3).map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-1">{row.username}</td>
                          <td className="py-1">{row.group}</td>
                          <td className="py-1">{row.nomer_hp}</td>
                          <td className="py-1">{row.email}</td>
                          <td className="py-1">{row.password}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setImportOpen(false)}
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={submitImport}
                className="px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

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

      {resetUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Reset password</h3>
                <p className="text-sm text-slate-600">
                  User <span className="font-semibold text-slate-900">{resetUser.username}</span>
                </p>
              </div>
              <button
                onClick={() => setResetUser(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Password baru</label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Minimal 4 karakter"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setResetUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="px-5 py-2 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 disabled:opacity-60"
              >
                {resetLoading ? 'Memproses...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {roleChangeUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Ubah role</h3>
                <p className="text-sm text-slate-600">
                  User <span className="font-semibold text-slate-900">{roleChangeUser.username}</span> sekarang{' '}
                  <span className="font-semibold text-slate-900">{roleChangeUser.role}</span>. Ganti?
                </p>
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Peringatan: mengganti role akan mengubah akses halaman dan hak admin. Pastikan Anda memilih user yang benar.
                </div>
              </div>
              <button
                onClick={() => setRoleChangeUser(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRoleChangeUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleChangeRole}
                disabled={roleChangeLoading}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold shadow-soft hover:bg-rose-700 disabled:opacity-60"
              >
                {roleChangeLoading ? 'Memproses...' : 'Ganti role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddUser;
