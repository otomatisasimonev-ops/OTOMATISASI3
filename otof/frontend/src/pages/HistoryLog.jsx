import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const HistoryLog = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState(user?.role === 'admin' ? 'all' : 'mine');
  const [infoMessage, setInfoMessage] = useState('');
  const [streamStatus, setStreamStatus] = useState('idle');
  const [search, setSearch] = useState('');
  const [retryingId, setRetryingId] = useState(null);

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
    setInfoMessage('');
    try {
      const res = await api.get('/email/logs');
      const sorted = (res.data || []).sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      );
      setLogs(sorted);
    } catch (err) {
      console.error(err);
      setInfoMessage(err.response?.data?.message || 'Gagal memuat log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!user) return;
    setOwnerFilter(user.role === 'admin' ? 'all' : 'mine');
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const streamUrl = `${baseUrl}/email/streamxuserId=${user.id}&username=${user.username}`;
    setStreamStatus('connecting');
    const es = new EventSource(streamUrl);

    es.onopen = () => setStreamStatus('live');
    es.onerror = () => setStreamStatus('offline');
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        mergeLog(data);
      } catch (err) {
        console.error('Gagal parsing SSE', err);
      }
    };

    return () => {
      es.close();
      setStreamStatus('idle');
    };
  }, [baseUrl, mergeLog, user]);

  const filteredLogs = useMemo(() => {
    const byStatus = statusFilter === 'all' ? logs : logs.filter((l) => l.status === statusFilter);
    const byOwner =
      ownerFilter === 'all' ? byStatus : byStatus.filter((l) => l.user_id === user?.id);
    const q = search.toLowerCase();
    if (!q) return byOwner;
    return byOwner.filter(
      (l) =>
        l.subject?.toLowerCase().includes(q) ||
        l.badanPublik?.nama_badan_publik?.toLowerCase().includes(q) ||
        l.user?.username?.toLowerCase().includes(q) ||
        l.message_id?.toLowerCase().includes(q)
    );
  }, [logs, ownerFilter, statusFilter, user?.id, search]);

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
      item.subject || '-',
      item.status,
      formatDate(item.sent_at),
      item.message_id || ''
    ]);
    const header = ['Pengirim', 'Target', 'Subjek', 'Status', 'Waktu', 'MessageID'];
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
      Subjek: item.subject || '-',
      Status: item.status,
      Waktu: formatDate(item.sent_at),
      MessageID: item.message_id || ''
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
        `Subjek: ${item.subject || '-'}`,
        `Status: ${item.status} • ${formatDate(item.sent_at)}`,
        `MessageID: ${item.message_id || '-'}`
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

  const handleRetry = async (log) => {
    setRetryingId(log.id);
    setInfoMessage('');
    try {
      await api.post(`/email/retry/${log.id}`);
      setInfoMessage('Retry dikirim');
      fetchLogs();
    } catch (err) {
      setInfoMessage(err.response?.data?.message || 'Gagal retry');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500">Riwayat pengiriman</p>
          <h1 className="text-2xl font-bold text-slate-900">History Log</h1>
          <div className="flex items-center gap-2 mt-2">
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchLogs}
            className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Muat Ulang
          </button>
          <button
            onClick={exportCsv}
            className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            onClick={exportXlsx}
            className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Export Excel
          </button>
          <button
            onClick={exportPdf}
            className="px-4 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
          >
            Export PDF
          </button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari subject/target/message id"
            className="px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-4 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Status:</span>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden">
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
                <span className="text-sm text-slate-600">Kepemilikan:</span>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden">
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
            {infoMessage && (
              <span className="text-sm text-primary font-semibold">{infoMessage}</span>
            )}
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold mb-1">Timeline singkat</div>
            <div className="space-y-2 max-h-36 overflow-auto">
              {filteredLogs.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <div
                    className={`mt-0.5 w-2 h-2 rounded-full ${
                      item.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900 line-clamp-1">
                      {item.badanPublik?.nama_badan_publik || '-'}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-2">
                      {item.status === 'failed' ? item.error_message || 'Gagal' : 'Berhasil'} · {formatDate(item.sent_at)}
                    </div>
                  </div>
                </div>
              ))}
              {filteredLogs.length === 0 && <div className="text-xs text-slate-500">Belum ada log sesuai filter.</div>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Pengirim</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Subjek</th>
                <th className="px-4 py-3 text-left">Template/ID</th>
                <th className="px-4 py-3 text-left">Waktu</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                    Memuat log...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                    Belum ada riwayat. Pastikan SMTP sudah siap atau cek filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.user?.username}</td>
                    <td className="px-4 py-3 text-slate-700">{item.badanPublik?.nama_badan_publik}</td>
                    <td className="px-4 py-3 text-slate-700">{item.subject}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 w-max">
                          {item.template_id || item.meta?.template_id || 'Tidak diketahui'}
                        </span>
                        <span className="text-[11px] text-slate-500">Req #{item.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(item.sent_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
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

      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Detail Log</h3>
                <p className="text-sm text-slate-500">
                  {formatDate(selectedLog.sent_at)} - {selectedLog.user?.username}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-500 hover:text-slate-800 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-slate-600">Pengirim</div>
                <div className="font-semibold text-slate-900">{selectedLog.user?.username || '-'}</div>
                <div className="text-sm text-slate-600">Target</div>
                <div className="font-semibold text-slate-900">
                  {selectedLog.badanPublik?.nama_badan_publik || '-'}
                </div>
                <div className="text-sm text-slate-600">Subjek</div>
                <div className="font-semibold text-slate-900">{selectedLog.subject}</div>
                <div className="text-sm text-slate-600">Message ID</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 break-all">
                    {selectedLog.message_id || '-'}
                  </span>
                  {selectedLog.message_id && (
                    <button
                      onClick={() => openGmail(selectedLog.message_id)}
                      className="text-xs font-semibold text-secondary hover:underline"
                    >
                      Buka di Gmail
                    </button>
                  )}
                </div>
                {selectedLog.retry_of_id && (
                  <div className="text-xs text-slate-500">
                    Retry dari log #{selectedLog.retry_of_id}
                  </div>
                )}
                {selectedLog.error_message && (
                  <div className="text-xs text-rose-500">
                    Error: {selectedLog.error_message}
                  </div>
                )}
                <div className="text-sm text-slate-600">Status</div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(selectedLog.status)}`}>
                  {selectedLog.status}
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-700">Lampiran</div>
                {Array.isArray(selectedLog.attachments_meta) && selectedLog.attachments_meta.length > 0 ? (
                  <ul className="text-sm text-slate-700 list-disc pl-4 space-y-1">
                    {selectedLog.attachments_meta.map((att) => (
                      <li key={att.filename}>
                        {att.filename} ({att.readableSize || att.size || 'x'} | {att.contentType || 'unknown'})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Tidak ada info lampiran</p>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Body Email</div>
              <div className="border border-slate-200 rounded-xl p-3 max-h-72 overflow-auto text-sm leading-6 text-slate-800 bg-slate-50">
                {selectedLog.body ? (
                  <div dangerouslySetInnerHTML={{ __html: selectedLog.body }} />
                ) : (
                  'Body kosong'
                )}
              </div>
            </div>
              <div className="flex justify-end gap-2">
              {selectedLog.status === 'failed' && (
                <button
                  onClick={() => handleRetry(selectedLog)}
                  disabled={retryingId === selectedLog.id}
                  className="px-4 py-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  {retryingId === selectedLog.id ? 'Retrying...' : 'Retry kirim'}
                </button>
              )}
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-3 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryLog;
