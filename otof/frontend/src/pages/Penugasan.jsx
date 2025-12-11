import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';

const DEFAULT_QUOTA = 20;

const Penugasan = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [badan, setBadan] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignedIds, setAssignedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState(null);
  const [quota, setQuota] = useState(DEFAULT_QUOTA);
  const [filter, setFilter] = useState('');
  const [requests, setRequests] = useState([]);
  const [allAssignments, setAllAssignments] = useState([]);
  const [actioningId, setActioningId] = useState(null);
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const refreshData = useCallback(
    async (keepSelection = true, currentSelectedId = '') => {
      if (!isAdmin) return;
      setLoading(true);
      setMessage('');
      try {
        const [userRes, badanRes, reqRes, assignRes, historyRes] = await Promise.all([
          api.get('/users'),
          api.get('/badan-publik'),
          api.get('/quota/requests'),
          api.get('/assignments'),
          api.get('/assignments/history/all')
        ]);

        const userList = userRes.data || [];
        setUsers(userList);
        setBadan(badanRes.data || []);
        setRequests(reqRes.data || []);
        setAllAssignments(assignRes.data || []);
        setHistory(historyRes.data || []);

        const firstUser = userList.find((u) => u.role === 'user');
        const stillValid =
          keepSelection &&
          currentSelectedId &&
          userList.some((u) => u.id.toString() === currentSelectedId);
        const nextSelected = stillValid ? currentSelectedId : firstUser?.id?.toString() || '';
        setSelectedUserId(nextSelected);

        if (!nextSelected) {
          setAssignedIds([]);
        } else {
          const selected = userList.find((u) => u.id.toString() === nextSelected);
          setQuota(selected?.daily_quota || DEFAULT_QUOTA);
        }
      } catch (err) {
        console.error(err);
        setMessage(err.response?.data?.message || 'Gagal memuat data');
      } finally {
        setLoading(false);
      }
    },
    [isAdmin]
  );

  useEffect(() => {
    if (isAdmin) refreshData(false, '');
  }, [isAdmin, refreshData]);

  useEffect(() => {
    const fetchAssignment = async () => {
      if (!selectedUserId) {
        setAssignedIds([]);
        return;
      }
      try {
        const assignRes = await api.get(`/assignments/${selectedUserId}`);
        const ids = (assignRes.data || []).map((a) => a.badan_publik_id);
        setAssignedIds(ids);
        const selected = users.find((u) => u.id === Number(selectedUserId));
        setQuota(selected?.daily_quota || DEFAULT_QUOTA);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAssignment();
  }, [selectedUserId, users]);

  if (!isAdmin) {
    return (
      <div className="p-6 rounded-2xl border border-slate-200 bg-white text-slate-700">
        Halaman ini hanya untuk admin.
      </div>
    );
  }

  const toggleAssign = (id) => {
    setAssignedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (assignedIds.length === badan.length) {
      setAssignedIds([]);
    } else {
      setAssignedIds(badan.map((b) => b.id));
    }
  };

  const saveAssign = async () => {
    if (!selectedUserId) {
      setMessage('Pilih user terlebih dahulu.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await api.post('/assignments', {
        user_id: selectedUserId,
        badan_publik_ids: assignedIds
      });
      await api.patch(`/quota/user/${selectedUserId}`, { daily_quota: Number(quota) || DEFAULT_QUOTA });
      setMessage('Penugasan dan kuota disimpan');
      setToast({ message: 'Penugasan dan kuota disimpan', type: 'success' });
      await refreshData(true, selectedUserId);
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan penugasan/kuota';
      setMessage(msg);
      setToast({ message: msg, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const filteredBadan = useMemo(() => {
    const q = filter.toLowerCase();
    return badan.filter(
      (b) =>
        b.nama_badan_publik?.toLowerCase().includes(q) ||
        b.kategori?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q)
    );
  }, [badan, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredBadan.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedBadan = useMemo(() => {
    const safePage = Math.max(1, currentPage);
    const start = (safePage - 1) * pageSize;
    return filteredBadan.slice(start, start + pageSize);
  }, [filteredBadan, currentPage]);

  const assignmentsMap = useMemo(() => {
    // Ambil satu penugas (terbaru dari API) per badan publik
    const map = {};
    allAssignments.forEach((a) => {
      if (!a?.badan_publik_id || !a?.user) return;
      if (!map[a.badan_publik_id]) {
        map[a.badan_publik_id] = a.user.username;
      }
    });
    return map;
  }, [allAssignments]);

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);
  const pendingByUser = useMemo(() => {
    const map = {};
    pendingRequests.forEach((r) => {
      map[r.user_id] = (map[r.user_id] || 0) + 1;
    });
    return map;
  }, [pendingRequests]);

  const badanSummary = useMemo(
    () =>
      badan.map((b) => ({
        ...b,
        assignedTo: assignmentsMap[b.id] || ''
      })),
    [assignmentsMap, badan]
  );

  const handleRequestAction = async (reqId, status) => {
    setActioningId(reqId);
    try {
      await api.patch(`/quota/requests/${reqId}`, { status });
      const verb = status === 'approved' ? 'disetujui' : 'ditolak';
      setToast({ message: `Permintaan kuota ${verb}`, type: 'success' });
      await refreshData(true, selectedUserId);
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal memproses permintaan';
      setToast({ message: msg, type: 'error' });
    } finally {
      setActioningId(null);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">Atur akses badan publik</p>
          <h1 className="text-2xl font-bold text-slate-900">Penugasan</h1>
          <p className="text-sm text-slate-500">User hanya melihat badan publik yang ditugaskan.</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingRequests.length > 0 && (
            <span className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              {pendingRequests.length} permintaan kuota menunggu
            </span>
          )}
          <Link
            to="/users"
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold shadow-soft hover:bg-emerald-700"
          >
            + Tambah User
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-3">
          <div className="border border-slate-200 rounded-2xl bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-slate-800">Data User</div>
                <p className="text-xs text-slate-500">Klik user, lalu atur penugasan & kuota</p>
              </div>
              <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Langkah 1
              </span>
            </div>
            <div className="space-y-2 max-h-96 overflow-auto">
              {users
                .filter((u) => u.role === 'user')
                .map((u) => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id.toString())}
                    className={`px-3 py-2 rounded-xl cursor-pointer border transition-all ${
                      selectedUserId === u.id.toString()
                        ? 'border-primary bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{u.username}</div>
                      {pendingByUser[u.id] ? (
                        <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          {pendingByUser[u.id]} req
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">kuota {u.daily_quota}/hari</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">Kuota {u.daily_quota}/hari · ID #{u.id}</div>
                  </div>
                ))}
              {users.filter((u) => u.role === 'user').length === 0 && (
                <div className="text-xs text-slate-500">Belum ada user role user</div>
              )}
            </div>
          </div>

          <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 shadow-soft">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-amber-800">Permintaan kuota pending</div>
                <p className="text-xs text-amber-700">Setujui atau tolak permintaan tambahan kuota</p>
              </div>
              <span className="text-[11px] px-2 py-1 rounded-full bg-white text-amber-700 border border-amber-200">
                {pendingRequests.length} menunggu
              </span>
            </div>
            {pendingRequests.length === 0 ? (
              <div className="text-xs text-amber-700">Belum ada permintaan.</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto">
                {pendingRequests.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-white border border-amber-200">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{r.user?.username}</div>
                        <p className="text-[11px] text-slate-500">Meminta {r.requested_quota}/hari</p>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                        pending
                      </span>
                    </div>
                    {r.reason && <p className="text-xs text-slate-600 mt-1 truncate">Alasan: {r.reason}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handleRequestAction(r.id, 'approved')}
                        disabled={actioningId === r.id}
                        className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Setujui
                      </button>
                      <button
                        onClick={() => handleRequestAction(r.id, 'rejected')}
                        disabled={actioningId === r.id}
                        className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs hover:border-slate-400 disabled:opacity-60"
                      >
                        Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="border border-slate-200 rounded-2xl bg-white p-5 shadow-soft space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">Panel penugasan</div>
                <p className="text-xs text-slate-500">
                  1) pilih user · 2) checklist badan publik · 3) atur kuota (default 20/hari) · 4) simpan
                </p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm border border-slate-200">
                {selectedUserId ? `${assignedIds.length} ditugaskan` : 'Pilih user dulu'}
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="text-sm font-semibold text-slate-700">Cari badan publik</label>
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Cari nama/kategori/email"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="w-56">
                <label className="text-sm font-semibold text-slate-700">Kuota harian user</label>
                <input
                  type="number"
                  min={1}
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="disarankan 20"
                />
                <p className="text-[11px] text-slate-500 mt-1">Default 20/hari · sesuaikan jika perlu</p>
              </div>
              <div className="flex items-center gap-2 self-end">
                <button
                  onClick={toggleAll}
                  className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
                >
                  {assignedIds.length === badan.length && badan.length > 0 ? 'Batal pilih semua' : 'Pilih semua'}
                </button>
                <button
                  onClick={saveAssign}
                  disabled={saving}
                  className="px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Penugasan'}
                </button>
              </div>
            </div>

            {message && (
              <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                {message}
              </div>
            )}
            <div className="text-sm text-slate-600">
              Dipilih: {assignedIds.length} / {badan.length} | Filter: {filter || '-'}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gradient-to-r from-slate-50 to-white text-slate-600">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={assignedIds.length === badan.length && badan.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">Nama</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Ditugaskan ke</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                        Memuat data...
                      </td>
                    </tr>
                  ) : filteredBadan.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                        Tidak ada data / tidak cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    pagedBadan.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={assignedIds.includes(item.id)}
                            onChange={() => toggleAssign(item.id)}
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.nama_badan_publik}</td>
                        <td className="px-4 py-3 text-slate-700">{item.email}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {assignmentsMap[item.id] ? assignmentsMap[item.id] : 'Belum ditugaskan'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600 mt-2">
              <div>
                Halaman {currentPage} / {totalPages} • {filteredBadan.length} data
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-xl border border-slate-200 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 rounded-xl border border-slate-200 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-slate-800">Ringkasan penugasan</div>
            <p className="text-xs text-slate-500">Lihat badan publik dan siapa yang memegangnya</p>
          </div>
          <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Total {badan.length} badan publik
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 to-white text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Nama Badan Publik</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-left">Ditugaskan ke</th>
              </tr>
            </thead>
            <tbody>
              {badanSummary.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={3}>
                    Belum ada data badan publik.
                  </td>
                </tr>
              ) : (
                badanSummary.map((b, idx) => (
                  <tr
                    key={b.id}
                    className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">{b.nama_badan_publik}</td>
                    <td className="px-4 py-3 text-slate-700">{b.kategori}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {b.assignedTo ? b.assignedTo : 'Belum ditugaskan'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl bg-white p-5 shadow-soft space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-800">Histori penugasan</div>
            <p className="text-xs text-slate-500">Siapa memindah ke siapa (100 log terbaru)</p>
          </div>
          <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {history.length} log
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Waktu</th>
                <th className="px-3 py-2 text-left">Aktor</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Badan Publik</th>
                <th className="px-3 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-center text-slate-500" colSpan={5}>
                    Belum ada histori.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{new Date(h.createdAt).toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{h.actor?.username || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{h.assignee?.username || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{h.badanPublik?.nama_badan_publik || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{h.action}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default Penugasan;
