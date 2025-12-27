import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fetchHolidays } from '../services/holidays';
import { computeDueInfo } from '../utils/workdays';
import Toast from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import useToast from '../hooks/useToast';
import useConfirmDialog from '../hooks/useConfirmDialog';
import LogDetailModal from '../components/historyLog/LogDetailModal';
import SenderInfoModal from '../components/historyLog/SenderInfoModal';

const HistoryLog = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [senderInfo, setSenderInfo] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState(isAdmin ? 'all' : 'mine');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const { toast, showToast, clearToast } = useToast();
  const { confirmDialog, openConfirm, closeConfirm, handleConfirm } = useConfirmDialog();
  const [streamStatus, setStreamStatus] = useState('idle');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [retryingId, setRetryingId] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const eventSourceRef = useRef(null);

  const baseUrl = useMemo(() => {
    const url = api.defaults?.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
    return url.replace(/\/$/, '');
  }, []);


  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const mergeLog = useCallback((incoming) => {
    if (!incoming?.id) return;
    setLogs((prev) => {
      const others = prev.filter((item) => item.id !== incoming.id);
      return [incoming, ...others].sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      );
    });
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/email/logs');
      const sorted = (res.data || []).sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      );
      setLogs(sorted);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Gagal memuat log', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const res = await fetchHolidays();
        setHolidays(res || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadHolidays();
  }, []);

  useEffect(() => {
    if (!user) return;
    setOwnerFilter(isAdmin ? 'all' : 'mine');
  }, [isAdmin, user]);

  useEffect(() => {
    if (!user) return;
    
    const streamUrl = `${baseUrl}/email/stream?userId=${user.id}&username=${encodeURIComponent(
      user.username
    )}`;
    
     setStreamStatus('connecting');
    
    let es = null;
    let isCleanedUp = false;
    
    // Delay untuk skip React Strict Mode double mount
    const timeoutId = setTimeout(() => {
      if (isCleanedUp) {
        return;
      }
      
      es = new EventSourcePolyfill(streamUrl, {
        withCredentials: true,
        heartbeatTimeout: 300000, // 5 menit
      });
      
      eventSourceRef.current = es;

      es.onopen = (e) => {
        setStreamStatus('live');
      };
      
      es.onerror = (err) => {
        console.error('❌ SSE error:', err);

        
        // Jangan set offline jika sedang reconnecting
        if (es?.readyState === EventSourcePolyfill.CONNECTING) {
          setStreamStatus('connecting');
        } else {
          setStreamStatus('offline');
        }
      };
      
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          mergeLog(data);
        } catch (err) {
          console.error('Gagal parsing SSE', err, event.data);
        }
      };
    }, 10); // 10ms delay untuk skip first cleanup di Strict Mode

    return () => {
      isCleanedUp = true;
      clearTimeout(timeoutId);
      
      if (es || eventSourceRef.current) {
        es?.close();
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
      }
      setStreamStatus('idle');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, user]); // mergeLog tidak perlu di deps karena sudah useCallback stable

  const categories = useMemo(() => {
    const values = logs.map((l) => l.badanPublik?.kategori).filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'id-ID'));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const byStatus = statusFilter === 'all' ? logs : logs.filter((l) => l.status === statusFilter);
    const byOwner =
      ownerFilter === 'all' ? byStatus : byStatus.filter((l) => l.user_id === user?.id);
    const byCategory =
      categoryFilter === 'all'
        ? byOwner
        : byOwner.filter((l) => l.badanPublik?.kategori === categoryFilter);
    const q = search.toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter(
      (l) =>
        l.badanPublik?.nama_badan_publik?.toLowerCase().includes(q) ||
        l.badanPublik?.kategori?.toLowerCase().includes(q) ||
        l.user?.username?.toLowerCase().includes(q) ||
        l.message_id?.toLowerCase().includes(q)
    );
  }, [logs, ownerFilter, statusFilter, categoryFilter, user?.id, search]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    const ids = filteredLogs.map((l) => l.id);
    if (ids.length === 0) {
      setSelectedIds([]);
      return;
    }
    const allSelected = ids.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : ids);
  };

  const openGmail = (messageId) => {
    const url = messageId
      ? `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(messageId)}`
      : 'https://mail.google.com/mail/u/0/#sent';
    window.open(url, '_blank');
  };

  const exportCsv = () => {
    const rows = filteredLogs.map((item) => [
      item.user?.username || '-',
      item.badanPublik?.nama_badan_publik || '-',
      item.badanPublik?.email || '-',
      item.status,
      formatDate(item.sent_at)
    ]);
    const header = ['Pengirim', 'Target', 'Email Target', 'Status', 'Waktu'];
    const toCsv = [header, ...rows]
      .map((cols) =>
        cols
          .map((val) => {
            const safe = (val || '').toString().replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(',')
      )
      .join('\n');
    const blob = new Blob([toCsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'email-logs.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportXlsx = async () => {
    const { utils, writeFile } = await import('xlsx');
    const rows = filteredLogs.map((item) => ({
      Pengirim: item.user?.username || '-',
      Target: item.badanPublik?.nama_badan_publik || '-',
      'Email Target': item.badanPublik?.email || '-',
      Status: item.status,
      Waktu: formatDate(item.sent_at)
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Logs');
    writeFile(wb, 'email-logs.xlsx');
  };

  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('History Log', 14, 16);
    doc.setFontSize(10);
    let y = 26;
    filteredLogs.forEach((item, idx) => {
      const lines = [
        `${idx + 1}. ${item.user?.username || '-'} -> ${item.badanPublik?.nama_badan_publik || '-'}`,
        `Email Target: ${item.badanPublik?.email || '-'}`,
        `Status: ${item.status} - ${formatDate(item.sent_at)}`,
      ];
      lines.forEach((line) => {
        const wrapped = doc.splitTextToSize(line, 180);
        wrapped.forEach((chunk) => {
          if (y > 280) {
            doc.addPage();
            y = 16;
          }
          doc.text(chunk, 14, y);
          y += 6;
        });
      });
      y += 2;
    });
    doc.save('email-logs.pdf');
  };

  const statusBadge = (status) =>
    status === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-rose-100 text-rose-700';

  const normalizeBpStatus = (status) => {
    if (!status || status === 'pending' || status === 'sent') return 'belum dibalas';
    return status;
  };

  const bpStatusOptions = [
    { value: 'belum dibalas', label: 'Belum dibalas' },
    { value: 'dibalas', label: 'Dibalas' },
    { value: 'selesai', label: 'Selesai', disabled: !isAdmin }
  ];

  const bpStatusClass = (status) => {
    if (status === 'dibalas') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status === 'selesai') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const handleStatusChange = async (log, nextStatus) => {
    if (!log?.badanPublik?.id) return;
    try {
      await api.put(`/badan-publik/${log.badanPublik.id}`, { status: nextStatus });
      setLogs((prev) =>
        prev.map((item) =>
          item.badanPublik?.id === log.badanPublik.id
            ? { ...item, badanPublik: { ...item.badanPublik, status: nextStatus } }
            : item
        )
      );
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal memperbarui status', 'error');
    }
  };

  const getDueBadge = (log) => {
    const info = computeDueInfo({ startDate: log.sent_at, baseDays: 10, holidays });
    if (info.daysLeft == null) {
      return { label: '-', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
    if (info.daysLeft < 0) {
      return {
        label: `Lewat ${Math.abs(info.daysLeft)} hari`,
        className: 'bg-black text-white border-black'
      };
    }
    if (info.daysLeft <= 2) {
      return { label: `${info.daysLeft} hari`, className: 'bg-rose-100 text-rose-700 border-rose-200' };
    }
    if (info.daysLeft <= 3) {
      return { label: `${info.daysLeft} hari`, className: 'bg-orange-100 text-orange-700 border-orange-200' };
    }
    if (info.daysLeft <= 6) {
      return { label: `${info.daysLeft} hari`, className: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    return { label: `${info.daysLeft} hari`, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  };

  const handleRetry = async (log) => {
    setRetryingId(log.id);
    try {
      await api.post(`/email/retry/${log.id}`);
      showToast('Retry dikirim', 'success');
      fetchLogs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal retry', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const handleBulkDelete = async (ids) => {
    const deleteIds = ids || selectedIds;
    if (deleteIds.length === 0) {
      showToast('Pilih minimal satu log untuk dihapus.', 'error');
      return;
    }
    try {
      const res = await api.post('/email/logs/bulk-delete', { ids: deleteIds });
      showToast(res.data?.message || 'Log terhapus.', 'success');
      const selectedSet = new Set(deleteIds);
      setLogs((prev) => prev.filter((item) => !selectedSet.has(item.id)));
      setSelectedIds([]);
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal menghapus log terpilih.', 'error');
    }
  };

  const requestBulkDelete = () => {
    if (selectedIds.length === 0) {
      showToast('Pilih minimal satu log untuk dihapus.', 'error');
      return;
    }
    const ids = [...selectedIds];
    openConfirm({
      title: 'Hapus log terpilih?',
      message: `${ids.length} log akan dihapus dari riwayat.`,
      confirmLabel: 'Hapus',
      tone: 'danger',
      onConfirm: () => handleBulkDelete(ids)
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Riwayat pengiriman</p>
          <h1 className="text-2xl font-bold text-slate-900">History Log</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                user?.role === 'admin'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {user?.role === 'admin'
                ? 'Admin: melihat semua log'
                : 'User: hanya log milik Anda'}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                streamStatus === 'live'
                  ? 'bg-emerald-100 text-emerald-700'
                  : streamStatus === 'connecting'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              SSE {streamStatus}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchLogs}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold"
          >
            Muat Ulang
          </button>
          <button
            onClick={exportCsv}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold"
          >
            Export CSV
          </button>
          <button
            onClick={exportXlsx}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold"
          >
            Export Excel
          </button>
          <button
            onClick={exportPdf}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm font-semibold"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-[2.2fr,1fr] gap-4">
          <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Filter</p>
              <h3 className="text-lg font-bold text-slate-900">Atur tampilan log</h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Status Email</span>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
                  {['all', 'success', 'failed'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setStatusFilter(opt)}
                      className={`px-3 py-2 text-sm font-semibold ${
                        statusFilter === opt ? 'bg-primary text-white' : 'text-slate-700'
                      }`}
                    >
                      {opt === 'all' ? 'Semua' : opt}
                    </button>
                  ))}
                </div>
              </div>
              {user?.role === 'admin' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Kepemilikan</span>
                  <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
                    {[
                      { key: 'all', label: 'Semua user' },
                      { key: 'mine', label: 'Log saya' }
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setOwnerFilter(opt.key)}
                        className={`px-3 py-2 text-sm font-semibold ${
                          ownerFilter === opt.key ? 'bg-secondary text-white' : 'text-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Kategori</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="all">Semua kategori</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-2 items-center">
              <span className="text-sm text-slate-600">Cari</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Target, kategori, message id"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              />
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-700">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-2">Timeline singkat</div>
            <div className="space-y-2 max-h-44 overflow-auto">
              {filteredLogs.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <div
                    className={`mt-1 w-2 h-2 rounded-full ${
                      item.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900 line-clamp-1">
                      {item.badanPublik?.nama_badan_publik || '-'}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-2">
                      {item.status === 'failed' ? item.error_message || 'Gagal' : 'Berhasil'} - {formatDate(item.sent_at)}
                    </div>
                  </div>
                </div>
              ))}
              {filteredLogs.length === 0 && <div className="text-xs text-slate-500">Belum ada log sesuai filter.</div>}
            </div>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            <span>{selectedIds.length} log dipilih</span>
            <button
              onClick={requestBulkDelete}
              className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
            >
              Hapus terpilih
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left w-[42px]">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua log"
                    checked={filteredLogs.length > 0 && filteredLogs.every((l) => selectedIds.includes(l.id))}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 text-left">Pengirim</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Tenggat</th>
                <th className="px-4 py-3 text-left">Waktu</th>
                <th className="px-4 py-3 text-left">Status BP</th>
                <th className="px-4 py-3 text-left">Status Email</th>
                <th className="px-4 py-3 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                    Memuat log...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                    Belum ada riwayat. Pastikan SMTP sudah siap atau cek filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Pilih log ${item.id}`}
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="px-4 py-2 font-semibold text-slate-900">
                      <button
                        type="button"
                        onClick={() => setSenderInfo(item.user || null)}
                        className="text-left hover:underline"
                      >
                        {item.user?.username || '-'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-slate-700">{item.badanPublik?.nama_badan_publik}</td>
                    <td className="px-4 py-2">
                      {(() => {
                        const badge = getDueBadge(item);
                        return (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.className}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{formatDate(item.sent_at)}</td>
                    <td className="px-4 py-2">
                      <select
                        value={normalizeBpStatus(item.badanPublik?.status)}
                        onChange={(e) => handleStatusChange(item, e.target.value)}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold ${bpStatusClass(
                          normalizeBpStatus(item.badanPublik?.status)
                        )}`}
                        disabled={!isAdmin && normalizeBpStatus(item.badanPublik?.status) === 'selesai'}
                      >
                        {bpStatusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openGmail(item.message_id)}
                          className="text-sm font-semibold text-secondary hover:underline"
                        >
                          Gmail
                        </button>
                        {item.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(item)}
                            disabled={retryingId === item.id}
                            className="text-sm font-semibold text-rose-600 hover:underline disabled:opacity-50"
                          >
                            {retryingId === item.id ? 'Retrying...' : 'Retry'}
                          </button>
                        )}
                        <button onClick={() => setSelectedLog(item)} className="text-sm font-semibold text-primary hover:underline">
                          Detail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LogDetailModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onRetry={handleRetry}
        retryingId={retryingId}
        openGmail={openGmail}
        statusBadge={statusBadge}
        formatDate={formatDate}
      />

      <SenderInfoModal sender={senderInfo} onClose={() => setSenderInfo(null)} />

      <Toast toast={toast} onClose={clearToast} />
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        tone={confirmDialog.tone}
        loading={confirmDialog.loading}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
};

export default HistoryLog;
