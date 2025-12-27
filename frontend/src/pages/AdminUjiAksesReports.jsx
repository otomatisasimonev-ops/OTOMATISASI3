import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { adminListUjiAksesReports, getUjiAksesQuestions } from '../services/reports';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  const datePart = date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timePart = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${datePart}: ${timePart}`;
};

const AdminUjiAksesReports = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [badanPublik, setBadanPublik] = useState([]);
  const [reports, setReports] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [badanPublikId, setBadanPublikId] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const loadBadanPublik = useCallback(async () => {
    try {
      const res = await api.get('/badan-publik');
      setBadanPublik(res.data || []);
    } catch (_err) {
      setBadanPublik([]);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminListUjiAksesReports({
        q: q || undefined,
        status: status || undefined,
        badanPublikId: badanPublikId || undefined,
        sortBy,
        sortDir
      });
      setReports(data || []);
    } catch (err) {
      setReports([]);
      setError(err.response?.data?.message || 'Gagal memuat laporan admin');
    } finally {
      setLoading(false);
    }
  }, [q, status, badanPublikId, sortBy, sortDir]);

  useEffect(() => {
    loadBadanPublik();
  }, [loadBadanPublik]);

  useEffect(() => {
    if (isAdmin) fetchReports();
  }, [fetchReports, isAdmin]);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const data = await getUjiAksesQuestions();
        setQuestions(data || []);
      } catch (_err) {
        setQuestions([]);
      }
    };
    if (isAdmin) loadQuestions();
  }, [isAdmin]);

  const sorted = useMemo(() => (reports || []).slice(), [reports]);
  const totalReports = sorted.length;
  const questionColumns = useMemo(() => {
    return (questions || []).map((q, idx) => ({
      key: q.key,
      label: `Q${idx + 1}: ${q.text}`,
      options: q.options || []
    }));
  }, [questions]);
  const duplicateSummary = useMemo(() => {
    const map = new Map();
    sorted.forEach((r) => {
      const name = r.badanPublik?.nama_badan_publik || '-';
      map.set(name, (map.get(name) || 0) + 1);
    });
    const duplicates = Array.from(map.entries())
      .filter(([, count]) => count > 1)
      .map(([name, count]) => ({ name, count }));
    return duplicates;
  }, [sorted]);

  if (!isAdmin) {
    return (
      <div className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
        Akses ditolak: halaman admin saja.
      </div>
    );
  }

  const getQuestionScore = (question, answers) => {
    const answer = answers?.[question.key];
    if (!answer) return '';
    const option = (question.options || []).find((opt) => opt.key === answer.optionKey);
    if (!option) return '';
    return option.score ?? '';
  };

  const exportCsv = () => {
    const rows = sorted.map((item) => [
      formatDate(item.created_at || item.createdAt),
      item.badanPublik?.nama_badan_publik || '-',
      item.user?.username || '-',
      item.total_skor ?? 0,
      ...questionColumns.map((q) => getQuestionScore(q, item.answers))
    ]);
    const header = ['Tanggal', 'Badan Publik', 'User', 'Total Skor', ...questionColumns.map((q) => q.label)];
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
    link.download = 'admin-uji-akses-reports.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportXlsx = async () => {
    const { utils, writeFile } = await import('xlsx');
    const rows = sorted.map((item) => ({
      Tanggal: formatDate(item.created_at || item.createdAt),
      'Badan Publik': item.badanPublik?.nama_badan_publik || '-',
      User: item.user?.username || '-',
      'Total Skor': item.total_skor ?? 0,
      ...questionColumns.reduce((acc, q) => {
        acc[q.label] = getQuestionScore(q, item.answers);
        return acc;
      }, {})
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Laporan');
    writeFile(wb, 'admin-uji-akses-reports.xlsx');
  };

  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Laporan Uji Akses (Admin)', 14, 16);
    doc.setFontSize(10);
    let y = 26;
    sorted.forEach((item, idx) => {
      const lines = [
        `${idx + 1}. ${item.badanPublik?.nama_badan_publik || '-'}`,
        `User: ${item.user?.username || '-'}`,
        `Tanggal: ${formatDate(item.created_at || item.createdAt)}`,
        `Total Skor: ${item.total_skor ?? 0}`
      ];
      questionColumns.forEach((q) => {
        lines.push(`${q.label}: ${getQuestionScore(q, item.answers)}`);
      });
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
    doc.save('admin-uji-akses-reports.pdf');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin - Laporan Uji Akses</h1>
          <p className="text-sm text-slate-600">Filter, sort, dan lihat detail laporan.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCsv}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
          >
            Export CSV
          </button>
          <button
            onClick={exportXlsx}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
          >
            Export Excel
          </button>
          <button
            onClick={exportPdf}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search nama/kategori badan publik"
            className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
          <select
            value={badanPublikId}
            onChange={(e) => setBadanPublikId(e.target.value)}
            className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="">Semua badan publik</option>
            {badanPublik.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nama_badan_publik}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="">Semua status</option>
            <option value="draft">draft</option>
            <option value="submitted">submitted</option>
          </select>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="created_at">Tanggal</option>
              <option value="total_skor">Total Skor</option>
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="w-28 border border-slate-200 rounded-2xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
        <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 text-xs text-slate-600">
            <div className="relative flex items-center justify-between px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="absolute top-1 left-2 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
                Jumlah data
              </div>
              <div className="mt-4 text-2xl font-extrabold text-slate-900 leading-none">{totalReports}</div>
              <span className="text-[11px] text-slate-500 max-w-[160px] text-right leading-snug pr-1 mt-auto">
                Total laporan sesuai filter aktif.
              </span>
            </div>
            <div className="relative flex flex-col gap-1 px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="absolute top-1 left-2 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
                Data ganda
              </div>
              <div className="mt-4 text-2xl font-extrabold text-slate-900 leading-none">{duplicateSummary.length}</div>
              <div className="flex-1 text-[11px] text-slate-600 max-h-[48px] overflow-auto space-y-1 leading-tight">
                {duplicateSummary.length === 0 ? (
                  <div className="text-right pr-1 mt-auto">Tidak ada nama badan publik duplikat.</div>
                ) : (
                  duplicateSummary.map((item) => (
                    <div key={item.name} className="flex justify-between gap-2">
                      <span className="truncate">{item.name}</span>
                      <span className="font-semibold text-slate-700">x{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end lg:items-center">
            <button
              onClick={fetchReports}
              className="px-4 py-2 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 text-sm"
            >
              Terapkan
            </button>
          </div>
        </div>
      </div>
      {error && (
        <div className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Tanggal</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Badan Publik</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">User</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Status</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Total</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.08em]">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                  Memuat...
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                  Tidak ada laporan.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">{formatDate(r.created_at || r.createdAt)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.badanPublik?.nama_badan_publik || '-'}</td>
                  <td className="px-4 py-3">{r.user?.username || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${r.status === 'submitted'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">{r.total_skor ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/laporan/uji-akses/${r.id}`}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUjiAksesReports;
