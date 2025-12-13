import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import UjiAksesQuestionCard from '../components/reports/UjiAksesQuestionCard';
import { UJI_AKSES_QUESTIONS, computeUjiAksesScores, isUjiAksesComplete } from '../constants/ujiAksesRubric';
import {
  createUjiAksesReport,
  getUjiAksesReportDetail,
  submitUjiAksesReport,
  updateUjiAksesDraft,
  uploadUjiAksesEvidence
} from '../services/reports';

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

const normalizeAnswerState = (answersFromServer) => {
  const next = {};
  for (const q of UJI_AKSES_QUESTIONS) {
    const raw = answersFromServer?.[q.key] || {};
    next[q.key] = { optionKey: raw.optionKey || null, catatan: raw.catatan || '' };
  }
  return next;
};

const UjiAksesReportForm = ({ reportId }) => {
  const navigate = useNavigate();
  const [badanPublik, setBadanPublik] = useState([]);
  const [loadingBadan, setLoadingBadan] = useState(true);
  const [loadingReport, setLoadingReport] = useState(Boolean(reportId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [selectedBadanId, setSelectedBadanId] = useState('');
  const [report, setReport] = useState(null);
  const [answers, setAnswers] = useState(() => normalizeAnswerState({}));
  const [evidences, setEvidences] = useState({});
  const [pendingFiles, setPendingFiles] = useState(() => ({}));

  const computed = useMemo(() => computeUjiAksesScores(answers), [answers]);
  const isSubmitted = report?.status === 'submitted';
  const canEdit = !isSubmitted;

  const loadBadanPublik = useCallback(async () => {
    setLoadingBadan(true);
    try {
      const res = await api.get('/badan-publik');
      setBadanPublik(res.data || []);
    } catch (_err) {
      setBadanPublik([]);
    } finally {
      setLoadingBadan(false);
    }
  }, []);

  const loadReport = useCallback(async () => {
    if (!reportId) return;
    setLoadingReport(true);
    setError('');
    try {
      const data = await getUjiAksesReportDetail(reportId);
      const r = data?.report;
      setReport(r);
      setSelectedBadanId(String(r?.badan_publik_id || ''));
      setAnswers(normalizeAnswerState(r?.answers || {}));
      setEvidences(r?.evidences || {});
      setPendingFiles({});
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat laporan');
    } finally {
      setLoadingReport(false);
    }
  }, [reportId]);

  useEffect(() => {
    loadBadanPublik();
  }, [loadBadanPublik]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const updateAnswer = (key, patch) => {
    setAnswers((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const pickFiles = (questionKey, files) => {
    setPendingFiles((prev) => {
      const current = Array.isArray(prev[questionKey]) ? prev[questionKey] : [];
      return { ...prev, [questionKey]: [...current, ...files] };
    });
  };

  const doUploadForQuestion = async (id, questionKey) => {
    const files = pendingFiles?.[questionKey] || [];
    if (!files.length) return;
    const res = await uploadUjiAksesEvidence(id, questionKey, files);
    setEvidences(res?.evidences || {});
    setPendingFiles((prev) => ({ ...prev, [questionKey]: [] }));
  };

  const buildPayloadAnswers = () => {
    const payload = {};
    for (const q of UJI_AKSES_QUESTIONS) {
      payload[q.key] = {
        optionKey: answers?.[q.key]?.optionKey || null,
        catatan: answers?.[q.key]?.catatan || ''
      };
    }
    return payload;
  };

  const saveDraft = async ({ navigateAfterCreate = true } = {}) => {
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const badanPublikId = Number(selectedBadanId);
      if (!badanPublikId) {
        setError('Pilih badan publik terlebih dulu.');
        return null;
      }

      const payload = { badanPublikId, status: 'draft', answers: buildPayloadAnswers() };

      let current = report;
      if (!current?.id) {
        current = await createUjiAksesReport(payload);
        setReport(current);
        setEvidences(current?.evidences || {});
        if (navigateAfterCreate) {
          navigate(`/laporan/uji-akses/${current.id}`, { replace: true });
        }
      } else {
        current = await updateUjiAksesDraft(current.id, { answers: buildPayloadAnswers() });
        setReport(current);
      }

      const id = current.id;
      for (const q of UJI_AKSES_QUESTIONS) {
        await doUploadForQuestion(id, q.key);
      }

      setInfo('Draft tersimpan.');
      return current;
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan draft');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setError('');
    setInfo('');
    if (!selectedBadanId) {
      setError('Pilih badan publik terlebih dulu.');
      return;
    }
    if (!isUjiAksesComplete(answers)) {
      setError('Semua pertanyaan wajib dijawab untuk submit.');
      return;
    }

    const saved = await saveDraft({ navigateAfterCreate: false });
    if (!saved?.id) return;

    setSaving(true);
    try {
      const updated = await submitUjiAksesReport(saved.id);
      setReport(updated);
      setInfo('Laporan berhasil disubmit. Form menjadi read-only.');
      navigate(`/laporan/uji-akses/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal submit laporan');
    } finally {
      setSaving(false);
    }
  };

  const selectedBadan = useMemo(
    () => badanPublik.find((b) => String(b.id) === String(selectedBadanId)),
    [badanPublik, selectedBadanId]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{reportId ? 'Detail Laporan Uji Akses' : 'Buat Laporan Uji Akses'}</h1>
          <p className="text-sm text-slate-600">Rubrik: Penilaian Hasil Uji Akses 2025 (6 pertanyaan).</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <>
              <button
                onClick={() => saveDraft({ navigateAfterCreate: true })}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
                disabled={saving}
                type="button"
              >
                Simpan Draft
              </button>
              <button
                onClick={submit}
                className="px-4 py-2 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 text-sm"
                disabled={saving}
                type="button"
              >
                Submit
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
      )}
      {info && (
        <div className="px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{info}</div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Badan Publik yang diuji</label>
            <select
              value={selectedBadanId}
              onChange={(e) => setSelectedBadanId(e.target.value)}
              disabled={!canEdit || loadingBadan || loadingReport}
              className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="">{loadingBadan ? 'Memuat...' : 'Pilih badan publik'}</option>
              {badanPublik.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nama_badan_publik} — {b.kategori}
                </option>
              ))}
            </select>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">Total Skor</div>
            <div className="text-3xl font-extrabold text-slate-900">{computed.totalSkor}</div>
            <div className="text-xs text-slate-500">Maks: 100</div>
          </div>
        </div>

        {report?.id && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600">
            <div>
              <span className="font-semibold text-slate-700">ID:</span> {report.id}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Status:</span>{' '}
              <span
                className={`text-xs px-2 py-1 rounded-full border ${
                  report.status === 'submitted'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {report.status}
              </span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Dibuat:</span> {formatDate(report.created_at || report.createdAt)}
            </div>
          </div>
        )}
        {selectedBadan && (
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Terpilih:</span> {selectedBadan.nama_badan_publik}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {UJI_AKSES_QUESTIONS.map((q, idx) => (
          <UjiAksesQuestionCard
            key={q.key}
            number={idx + 1}
            text={q.text}
            options={q.options}
            value={answers?.[q.key]?.optionKey || null}
            catatan={answers?.[q.key]?.catatan || ''}
            onChangeOption={(optKey) => updateAnswer(q.key, { optionKey: optKey })}
            onChangeCatatan={(val) => updateAnswer(q.key, { catatan: val })}
            disabled={!canEdit || loadingReport}
            evidences={evidences?.[q.key] || []}
            pendingFiles={pendingFiles?.[q.key] || []}
            onPickFiles={(files) => pickFiles(q.key, files)}
            onUploadNow={
              report?.id
                ? async () => {
                    setError('');
                    setInfo('');
                    try {
                      setSaving(true);
                      await doUploadForQuestion(report.id, q.key);
                      setInfo('Bukti berhasil diupload.');
                    } catch (err) {
                      setError(err.response?.data?.message || 'Gagal upload bukti');
                    } finally {
                      setSaving(false);
                    }
                  }
                : null
            }
          />
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Ringkasan Skor</h2>
            <p className="text-sm text-slate-600">Skor otomatis mengikuti pilihan Anda.</p>
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Total:</span> {computed.totalSkor}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Pertanyaan</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Skor</th>
              </tr>
            </thead>
            <tbody>
              {UJI_AKSES_QUESTIONS.map((q, idx) => (
                <tr key={q.key} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Pertanyaan {idx + 1}
                    </div>
                    <div className="text-sm text-slate-900">{q.text}</div>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">{computed.answers?.[q.key]?.score ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UjiAksesReportForm;
