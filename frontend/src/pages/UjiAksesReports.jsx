import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyUjiAksesReports, getUjiAksesQuestions } from '../services/reports';

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

const UjiAksesReports = () => {
  const [reports, setReports] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listMyUjiAksesReports();
      setReports(data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat laporan');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const data = await getUjiAksesQuestions();
        setQuestions(data || []);
      } catch (_err) {
        setQuestions([]);
      }
    };
    loadQuestions();
  }, []);

  const sorted = useMemo(() => {
    return (reports || []).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [reports]);

  const questionColumns = useMemo(() => {
    return (questions || []).map((q, idx) => ({
      key: q.key,
      label: `Q${idx + 1}: ${q.text}`,
      options: q.options || []
    }));
  }, [questions]);

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
      item.total_skor ?? 0,
      ...questionColumns.map((q) => getQuestionScore(q, item.answers))
    ]);
    const header = ['Tanggal', 'Badan Publik', 'Total Skor', ...questionColumns.map((q) => q.label)];
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
    link.download = 'uji-akses-reports.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportXlsx = async () => {
    const { utils, writeFile } = await import('xlsx');
    const rows = sorted.map((item) => ({
      Tanggal: formatDate(item.created_at || item.createdAt),
      'Badan Publik': item.badanPublik?.nama_badan_publik || '-',
      'Total Skor': item.total_skor ?? 0,
      ...questionColumns.reduce((acc, q) => {
        acc[q.label] = getQuestionScore(q, item.answers);
        return acc;
      }, {})
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Laporan');
    writeFile(wb, 'uji-akses-reports.xlsx');
  };

  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Laporan Uji Akses', 14, 16);
    doc.setFontSize(10);
    let y = 26;
    sorted.forEach((item, idx) => {
      const lines = [
        `${idx + 1}. ${item.badanPublik?.nama_badan_publik || '-'}`,
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
    doc.save('uji-akses-reports.pdf');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Laporan Uji Akses</h1>
          <p className="text-sm text-slate-600">Daftar laporan uji akses yang Anda buat.</p>
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
          <Link
            to="/laporan/uji-akses/new"
            className="px-4 py-2 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 text-sm"
          >
            Buat Laporan
          </Link>
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
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Status</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Total Skor</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.08em]">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                  Memuat...
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                  Belum ada laporan.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">{formatDate(r.created_at || r.createdAt)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.badanPublik?.nama_badan_publik || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${
                        r.status === 'submitted'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.total_skor ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/laporan/uji-akses/${r.id}`}
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

export default UjiAksesReports;
