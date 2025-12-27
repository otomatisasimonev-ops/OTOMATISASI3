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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [recentlyChanged, setRecentlyChanged] = useState([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState([]);
  const [detailRequest, setDetailRequest] = useState(null);
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryPageSize, setSummaryPageSize] = useState(20);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const refreshData = useCallback(
    async (keepSelection = true, currentSelectedId = '') => {
      if (!isAdmin) return;
      setLoading(true);
      setMessage('');
      try {
        const [userRes, badanRes, reqRes, assignRes] = await Promise.all([
          api.get('/users'),
          api.get('/badan-publik'),
          api.get('/quota/requests'),
          api.get('/assignments')
        ]);

        const userList = userRes.data || [];
        setUsers(userList);
        setBadan(badanRes.data || []);
        setRequests(reqRes.data || []);
        setAllAssignments(assignRes.data || []);

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
          const selectedUser = userList.find((u) => u.id.toString() === nextSelected);
          if (selectedUser?.daily_quota != null) {
            setQuota(selectedUser.daily_quota);
          }
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
        if (selected?.daily_quota != null) {
          setQuota(selected.daily_quota);
        }
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

  const userNameMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u?.id) {
        map[u.id] = u.username || u.email || '';
      }
    });
    return map;
  }, [users]);

  const assignmentsMap = useMemo(() => {
    // Ambil satu penugas (terbaru dari API) per badan publik
    const map = {};
    allAssignments.forEach((a) => {
      if (!a?.badan_publik_id) return;
      if (!map[a.badan_publik_id]) {
        const userId = a.user_id || a.user?.id;
        map[a.badan_publik_id] = (userId && userNameMap[userId]) || a.user?.username || '';
      }
    });
    return map;
  }, [allAssignments, userNameMap]);

  const filteredBadan = useMemo(() => {
    const q = filter.toLowerCase();
    const assignedName = (id) => (assignmentsMap[id] || '').toLowerCase();
    return badan.filter(
      (b) =>
        b.nama_badan_publik?.toLowerCase().includes(q) ||
        b.kategori?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        assignedName(b.id).includes(q)
    );
  }, [badan, filter, assignmentsMap]);

  const totalPages = Math.max(1, Math.ceil(filteredBadan.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedBadan = useMemo(() => {
    const safePage = Math.max(1, currentPage);
    const start = (safePage - 1) * pageSize;
    return filteredBadan.slice(start, start + pageSize);
  }, [filteredBadan, currentPage]);
  const unassignedCount = useMemo(
    () => badan.filter((b) => !assignmentsMap[b.id]).length,
    [assignmentsMap, badan]
  );

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);
  const pendingByUser = useMemo(() => {
    const map = {};
    pendingRequests.forEach((r) => {
      map[r.user_id] = (map[r.user_id] || 0) + 1;
    });
    return map;
  }, [pendingRequests]);

  const assignedCountByUser = useMemo(() => {
    const map = {};
    allAssignments.forEach((a) => {
      if (!a?.user_id) return;
      map[a.user_id] = (map[a.user_id] || 0) + 1;
    });
    return map;
  }, [allAssignments]);

  const badanSummary = useMemo(
    () =>
      badan.map((b) => ({
        ...b,
        assignedTo: assignmentsMap[b.id] || ''
      })),
    [assignmentsMap, badan]
  );

  const summaryTotalPages = Math.max(1, Math.ceil(badanSummary.length / summaryPageSize));
  const summaryCurrentPage = Math.min(summaryPage, summaryTotalPages);
  const pagedBadanSummary = useMemo(() => {
    const start = (summaryCurrentPage - 1) * summaryPageSize;
    return badanSummary.slice(start, start + summaryPageSize);
  }, [badanSummary, summaryCurrentPage, summaryPageSize]);

  const handleRequestAction = async (reqId, status) => {
    setActioningId(reqId);
    try {
      await api.patch(`/quota/requests/${reqId}`, { status });
      const verb = status === 'approved' ? 'disetujui' : 'ditolak';
      setToast({ message: `Permintaan kuota ${verb}`, type: 'success' });
      await refreshData(true, selectedUserId);
      window.dispatchEvent(new Event('quota-requests-updated'));
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

  useEffect(() => {
    setSummaryPage(1);
  }, [badanSummary.length]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSelectUser = (id) => {
    setSelectedUserId(id.toString());
    const selectedUser = users.find((u) => u.id === Number(id));
    if (selectedUser) {
      if (selectedUser.daily_quota != null) {
        setQuota(selectedUser.daily_quota);
      }
    }
  };

  const handleSaveClick = () => {
    if (!selectedUserId) {
      setMessage('Pilih user terlebih dahulu.');
      setToast({ message: 'Pilih user terlebih dahulu', type: 'error' });
      return;
    }
    setShowSaveConfirm(true);
  };

  const markRecentlyChanged = (idOrIds) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    setRecentlyChanged((prev) => {
      const merged = Array.from(new Set([...prev, ...ids]));
      return merged;
    });
    setTimeout(() => {
      setRecentlyChanged((prev) => prev.filter((x) => !ids.includes(x)));
    }, 2000);
  };

  const toggleAssign = (id) => {
    setAssignedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next;
    });
    markRecentlyChanged(id);
  };

  const toggleAll = () => {
    if (assignedIds.length === badan.length) {
      setAssignedIds([]);
      markRecentlyChanged(badan.map((b) => b.id));
    } else {
      setAssignedIds(badan.map((b) => b.id));
      markRecentlyChanged(badan.map((b) => b.id));
    }
  };

  const toggleRequestSelection = (id) => {
    setSelectedRequestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const nameFontClass = (name) => {
    const len = String(name || '').length;
    if (len > 80) return 'text-[11px]';
    if (len > 50) return 'text-xs';
    return 'text-sm';
  };

  const toggleAllRequests = () => {
    const ids = filteredPendingRequests.map((r) => r.id);
    if (selectedRequestIds.length === ids.length) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(ids);
    }
  };

  const handleBatchAction = async (status) => {
    if (!selectedRequestIds.length) {
      setToast({ message: 'Pilih permintaan terlebih dahulu', type: 'error' });
      return;
    }
    setActioningId('batch');
    try {
      await Promise.all(selectedRequestIds.map((id) => api.patch(`/quota/requests/${id}`, { status })));
      const verb = status === 'approved' ? 'disetujui' : 'ditolak';
      setToast({ message: `${selectedRequestIds.length} permintaan ${verb}`, type: 'success' });
      setSelectedRequestIds([]);
      await refreshData(true, selectedUserId);
      window.dispatchEvent(new Event('quota-requests-updated'));
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal memproses batch';
      setToast({ message: msg, type: 'error' });
    } finally {
      setActioningId(null);
    }
  };

  const filteredPendingRequests = pendingRequests;
  const filteredUsers = useMemo(() => users.filter((u) => u.role === 'user'), [users]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">Atur akses badan publik</p>
          <h1 className="text-2xl font-bold text-slate-900">Penugasan</h1>
          <p className="text-sm text-slate-500">User hanya melihat badan publik yang ditugaskan.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingRequests.length > 0 && (
            <span className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              {pendingRequests.length} permintaan kuota menunggu
            </span>
          )}
          <span
            className={`px-3 py-2 rounded-xl text-sm border ${unassignedCount
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
          >
            {unassignedCount ? `${unassignedCount} badan publik belum ada penugas` : 'Semua sudah ditugaskan'}
          </span>
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
            <div className="space-y-2 max-h-[90vh] overflow-auto">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u.id)}
                  className={`px-3 py-2 rounded-xl cursor-pointer border transition-all ${selectedUserId === u.id.toString()
                    ? 'border-primary bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-primary/50'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{u.username}</div>
                      <span
                        className={`text-[11px] px-2 py-1 rounded-full border ${
                          pendingByUser[u.id]
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {pendingByUser[u.id]
                          ? `${pendingByUser[u.id]} req`
                          : `${assignedCountByUser[u.id] || 0} ditugaskan`}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Ditugaskan: {assignedCountByUser[u.id] || 0} badan publik - ID #{u.id}
                    </div>
                  </div>
                ))}
              {filteredUsers.length === 0 && (
                <div className="text-xs text-slate-500">Belum ada user</div>
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
            {filteredPendingRequests.length === 0 ? (
              <div className="text-xs text-amber-700">Belum ada permintaan.</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto">
                <div className="flex items-center justify-between text-xs text-amber-800">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        selectedRequestIds.length > 0 &&
                        selectedRequestIds.length === filteredPendingRequests.length
                      }
                      onChange={toggleAllRequests}
                    />
                    <span>Pilih semua</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBatchAction('approved')}
                      disabled={actioningId === 'batch'}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Setujui terpilih
                    </button>
                    <button
                      onClick={() => handleBatchAction('rejected')}
                      disabled={actioningId === 'batch'}
                      className="px-3 py-1 rounded-lg bg-white border border-amber-200 text-amber-800 text-xs hover:bg-amber-100 disabled:opacity-60"
                    >
                      Tolak terpilih
                    </button>
                  </div>
                </div>
                {filteredPendingRequests.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-white border border-amber-200">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{r.user?.username}</div>
                        <p className="text-[11px] text-slate-500">
                          Menambah {r.requested_quota}/hari • {new Date(r.createdAt).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                        pending
                      </span>
                    </div>
                    {r.reason && (
                      <button
                        onClick={() => setDetailRequest(r)}
                        className="text-xs text-amber-700 underline mt-1"
                      >
                        Lihat detail
                      </button>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={selectedRequestIds.includes(r.id)}
                        onChange={() => toggleRequestSelection(r.id)}
                      />
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
                  disabled={!selectedUserId}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:opacity-60"
                  placeholder={selectedUserId ? undefined : 'Pilih user dulu'}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Kuota aktif: {selectedUserId ? `${quota ?? DEFAULT_QUOTA}/hari` : '-'}
                </p>
              </div>
              <div className="flex items-center gap-2 self-end">
                <button
                  onClick={handleSaveClick}
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

            <div className="flex items-center justify-between text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span>Page size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setPageSize(next);
                    setPage(1);
                  }}
                  className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span>Lompat ke:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => setPage(Math.min(totalPages, Math.max(1, Number(e.target.value))))}
                  className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gradient-to-r from-slate-50 to-white text-slate-600 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 sticky left-0 bg-gradient-to-r from-white to-slate-50 shadow-[4px_0_6px_-4px_rgba(0,0,0,0.1)]">
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
                        Tidak ada data / tidak cocok dengan pencarian
                      </td>
                    </tr>
                  ) : (
                    pagedBadan.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`border-t border-slate-100 ${assignmentsMap[item.id]
                          ? 'bg-slate-200/50'
                          : idx % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50/60'
                          } ${recentlyChanged.includes(item.id) ? 'bg-emerald-50/70' : ''
                          }`}
                      >
                        <td className="px-4 py-3 sticky left-0 bg-inherit">
                          <input
                            type="checkbox"
                            checked={assignedIds.includes(item.id)}
                            onChange={() => toggleAssign(item.id)}
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 max-w-[360px]">
                          <div
                            className={`truncate ${nameFontClass(item.nama_badan_publik)}`}
                            title={item.nama_badan_publik}
                          >
                            {item.nama_badan_publik}
                          </div>
                        </td>
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
        <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
          <div className="flex items-center gap-2">
            <span>Page size:</span>
            <select
              value={summaryPageSize}
              onChange={(e) => {
                setSummaryPageSize(Number(e.target.value));
                setSummaryPage(1);
              }}
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>
              Halaman {summaryCurrentPage} / {summaryTotalPages}
            </span>
            <button
              onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}
              disabled={summaryCurrentPage === 1}
              className="px-3 py-2 rounded-xl border border-slate-200 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setSummaryPage((p) => Math.min(summaryTotalPages, p + 1))}
              disabled={summaryCurrentPage === summaryTotalPages}
              className="px-3 py-2 rounded-xl border border-slate-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
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
              {pagedBadanSummary.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={3}>
                    Belum ada data badan publik.
                  </td>
                </tr>
              ) : (
                pagedBadanSummary.map((b, idx) => (
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
      {showSaveConfirm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowSaveConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">Simpan penugasan?</div>
                <p className="text-xs text-slate-500">Perubahan akan diterapkan ke user terpilih.</p>
              </div>
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                Tutup
              </button>
            </div>
            <div className="text-sm text-slate-700 space-y-1">
              <div>User ID: {selectedUserId || '-'}</div>
              <div>Total badan publik dipilih: {assignedIds.length}</div>
              <div>Kuota harian: {quota || DEFAULT_QUOTA}</div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  setShowSaveConfirm(false);
                  await saveAssign();
                }}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 disabled:opacity-60 text-sm"
              >
                Ya, simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {detailRequest && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">Detail Permintaan Kuota</div>
                <p className="text-xs text-slate-500">{detailRequest.user?.username}</p>
              </div>
              <button
                onClick={() => setDetailRequest(null)}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                Tutup
              </button>
            </div>
            <div className="text-sm text-slate-700 space-y-1">
              <div>Diminta: {detailRequest.requested_quota} / hari</div>
              <div>Tanggal: {new Date(detailRequest.createdAt).toLocaleString('id-ID')}</div>
              <div>Status: {detailRequest.status}</div>
              <div className="pt-2">
                <div className="text-xs text-slate-500 mb-1">Alasan</div>
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50 min-h-[80px]">
                  {detailRequest.reason || '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default Penugasan;
