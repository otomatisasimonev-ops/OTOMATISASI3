import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminGetUjiAksesReportDetail } from '../services/reports';
import { UJI_AKSES_QUESTIONS } from '../constants/ujiAksesRubric';
import { buildServerFileUrl } from '../utils/serverUrl';

const isImage = (mimetype = '') => String(mimetype).startsWith('image/');

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

const findOptionLabel = (questionKey, optionKey) => {
  const q = UJI_AKSES_QUESTIONS.find((x) => x.key === questionKey);
  const opt = q?.options?.find((o) => o.key === optionKey);
  return opt ? opt.label : '-';
};

const AdminUjiAksesReportDetail = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { id } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminGetUjiAksesReportDetail(id);
      setReport(data?.report || null);
    } catch (err) {
      setReport(null);
      setError(err.response?.data?.message || 'Gagal memuat detail');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [fetchData, isAdmin]);

  const total = useMemo(() => report?.total_skor ?? 0, [report]);

  if (!isAdmin) {
    return (
      <div className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
        Akses ditolak: halaman admin saja.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Detail Laporan Uji Akses</h1>
          <p className="text-sm text-slate-600">Skor per pertanyaan + total, berikut bukti dukung.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/laporan/uji-akses"
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
          >
            Kembali
          </Link>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="px-4 py-6 text-center text-slate-500">Memuat...</div>
      ) : !report ? (
        <div className="px-4 py-6 text-center text-slate-500">Data tidak ditemukan.</div>
      ) : (
        <>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">Badan Publik</div>
                <div className="text-lg font-bold text-slate-900">{report.badanPublik?.nama_badan_publik || '-'}</div>
                <div className="text-sm text-slate-600">{report.badanPublik?.kategori || '-'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Pembuat</div>
                <div className="text-lg font-bold text-slate-900">{report.user?.username || '-'}</div>
                <div className="text-sm text-slate-600">{report.user?.role || '-'}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-semibold text-slate-500">Total Skor</div>
                <div className="text-3xl font-extrabold text-slate-900">{total}</div>
                <div className="text-xs text-slate-500">
                  Status: <span className="font-semibold text-slate-700">{report.status}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600">
              <div>
                <span className="font-semibold text-slate-700">ID:</span> {report.id}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Dibuat:</span> {formatDate(report.created_at || report.createdAt)}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Submitted:</span>{' '}
                {formatDate(report.submitted_at || report.submittedAt)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Pertanyaan</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Jawaban</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Skor</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Bukti</th>
                </tr>
              </thead>
              <tbody>
                {UJI_AKSES_QUESTIONS.map((q, idx) => {
                  const ans = report.answers?.[q.key] || {};
                  const ev = Array.isArray(report.evidences?.[q.key]) ? report.evidences?.[q.key] : [];
                  return (
                    <tr key={q.key} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                          Pertanyaan {idx + 1}
                        </div>
                        <div className="text-sm text-slate-900 whitespace-pre-line">{q.text}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{findOptionLabel(q.key, ans.optionKey)}</div>
                        {ans.catatan && <div className="text-xs text-slate-600 mt-1">Catatan: {ans.catatan}</div>}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{ans.score ?? 0}</td>
                      <td className="px-4 py-3">
                        {ev.length === 0 ? (
                          <div className="text-xs text-slate-500">-</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ev.map((f, i) => {
                              const url = buildServerFileUrl(f.path);
                              return (
                                <a
                                  key={`${f.path || 'file'}-${i}`}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2 rounded-2xl border border-slate-200 hover:bg-slate-50 flex gap-2 items-center"
                                  title={f.filename}
                                >
                                  {isImage(f.mimetype) ? (
                                    <img
                                      src={url}
                                      alt={f.filename}
                                      className="h-10 w-10 object-cover rounded-xl border border-slate-200"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                      PDF
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-slate-800 truncate">{f.filename}</div>
                                    <div className="text-[11px] text-slate-500 truncate">{f.mimetype}</div>
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminUjiAksesReportDetail;
