import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSmtp } from '../context/SmtpContext';
import StatsGrid from '../components/dashboard/StatsGrid';
import GuideCard from '../components/dashboard/GuideCard';
import ComposerSection from '../components/dashboard/ComposerSection';
import RecipientTable from '../components/dashboard/RecipientTable';
import ConfirmModal from '../components/dashboard/ConfirmModal';
import SuccessModal from '../components/dashboard/SuccessModal';
import Toast from '../components/Toast';
import DEFAULT_TEMPLATES from '../constants/templates';

const extractPlaceholders = (subject, body) => {
  const set = new Set();
  const regex = /{{\s*([\w.]+)\s*}}/g;
  [subject, body].forEach((tpl) => {
    const content = tpl || '';
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(content))) {
      set.add(match[1]);
    }
  });
  return Array.from(set);
};

const formatLabel = (key) =>
  key
    .replace(/_/g, ' ')
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ');

const Dashboard = () => {
  const { user } = useAuth();
  const { hasConfig } = useSmtp();
  const isAdmin = user?.role === 'admin';
  const loadTemplates = (role) => {
    const roleKey = role ? `customTemplates:${role}` : 'customTemplates';
    try {
      const stored = localStorage.getItem(roleKey);
      if (stored) return JSON.parse(stored);
      if (roleKey !== 'customTemplates') {
        const legacy = localStorage.getItem('customTemplates');
        if (legacy) return JSON.parse(legacy);
      }
      return [];
    } catch (err) {
      return [];
    }
  };

  const todayText = useMemo(
    () =>
      new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }),
    []
  );

  const [stats, setStats] = useState({
    badanCount: 0,
    sentCount: 0,
    pendingCount: 0,
    logCount: 0
  });
  const [badan, setBadan] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [toast, setToast] = useState(null);
  const [quota, setQuota] = useState({ daily_quota: 40, used_today: 0, remaining: 40 });
  const [quotaModal, setQuotaModal] = useState(false);
  const [quotaRequest, setQuotaRequest] = useState({ requested_quota: 50, reason: '' });
  const [quotaRequests, setQuotaRequests] = useState([]);
  const [customTemplates, setCustomTemplates] = useState(() => loadTemplates(user?.role));
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [bodyTemplate, setBodyTemplate] = useState(DEFAULT_TEMPLATES[0].body);
  const [customValues, setCustomValues] = useState({});
  const templates = useMemo(() => {
    const overrideMap = new Map(customTemplates.map((t) => [t.id, t]));
    const defaultIds = new Set(DEFAULT_TEMPLATES.map((t) => t.id));
    const mergedDefaults = DEFAULT_TEMPLATES.map((t) => overrideMap.get(t.id) || t);
    const customOnly = customTemplates.filter((t) => !defaultIds.has(t.id));
    return [...mergedDefaults, ...customOnly];
  }, [customTemplates]);
  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || templates[0],
    [templates, selectedTemplateId]
  );

  const [form, setForm] = useState({
    pemohon: '',
    tujuan: '',
    subject: DEFAULT_TEMPLATES[0].subject,
    tanggal: todayText
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [badanRes, logRes] = await Promise.all([api.get('/badan-publik'), api.get('/email/logs')]);
        const badanData = badanRes.data || [];
        const logs = logRes.data || [];

        const sentCount = badanData.reduce((acc, item) => acc + (item.sent_count || 0), 0);
        const pendingCount = badanData.filter((item) => item.status === 'pending').length;

        setStats({
          badanCount: badanData.length,
          sentCount,
          pendingCount,
          logCount: logs.length
        });
        setBadan(badanData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!user || isAdmin) return;
      try {
        const res = await api.get('/assignments/me');
        setAssignments(res.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAssignments();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || isAdmin) return;

    const fetchQuota = async () => {
      try {
        const res = await api.get('/quota/me');
        setQuota(res.data || { daily_quota: 40, used_today: 0, remaining: 40 });
      } catch (err) {
        console.error(err);
      }
    };
    const fetchMyRequests = async () => {
      try {
        const res = await api.get('/quota/my-requests');
        setQuotaRequests(res.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchQuota();
    fetchMyRequests();
  }, [user, isAdmin]);

  useEffect(() => {
    setCustomTemplates(loadTemplates(user?.role));
  }, [user?.role]);

  useEffect(() => {
    if (!templates.length) return;
    const exists = templates.some((t) => t.id === selectedTemplateId);
    if (!exists) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  useEffect(() => {
    const tpl = templates.find((t) => t.id === selectedTemplateId) || templates[0];
    if (tpl) {
      setForm((prev) => ({ ...prev, subject: tpl.subject }));
      setBodyTemplate(tpl.body);
      setCustomValues({});
    }
  }, [selectedTemplateId, templates]);

  // Template tambahan dibuat via halaman Template Editor, disimpan di localStorage (customTemplates)

  const handleCustomValueChange = (field, value) => {
    setCustomValues((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (selectedIds.length === badan.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(badan.map((b) => b.id));
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage('Ukuran file maksimal 5MB agar tidak ditolak server.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setAttachment({
        filename: file.name,
        content: base64,
        encoding: 'base64',
        contentType: file.type
      });
      setAttachmentPreview({
        type: file.type,
        url: reader.result
      });
    };
    reader.readAsDataURL(file);
  };

  const placeholderKeys = useMemo(
    () => extractPlaceholders(form.subject, bodyTemplate),
    [form.subject, bodyTemplate]
  );
  const KNOWN_META_FIELDS = ['pemohon', 'tujuan', 'tanggal'];
  const KNOWN_TARGET_FIELDS = ['nama_badan_publik', 'kategori', 'email', 'pertanyaan'];
  const manualFields = useMemo(
    () => placeholderKeys.filter((k) => !KNOWN_META_FIELDS.includes(k) && !KNOWN_TARGET_FIELDS.includes(k)),
    [placeholderKeys]
  );
  const missingManualFields = useMemo(
    () => manualFields.filter((f) => !customValues[f]),
    [manualFields, customValues]
  );

  const renderTemplate = useCallback(
    (tpl, target) => {
      if (!tpl) return '';
      const toHtml = (val) => (val == null ? '' : String(val).replace(/\n/g, '<br/>'));
      const replacements = {
        nama_badan_publik: target?.nama_badan_publik || '',
        kategori: target?.kategori || '',
        email: target?.email || '',
        pertanyaan: toHtml(target?.pertanyaan || ''),
        pemohon: toHtml(form.pemohon),
        tujuan: toHtml(form.tujuan),
        tanggal: toHtml(form.tanggal || todayText),
        asal_kampus: '',
        prodi: '',
        nama_media: '',
        deadline: ''
      };
      manualFields.forEach((f) => {
        replacements[f] = toHtml(customValues[f] || '');
      });
      let output = tpl;
      const regex = /{{\s*([\w.]+)\s*}}/g;
      output = output.replace(regex, (_, key) => (replacements[key] != null ? replacements[key] : ''));
      return output.replace(/\n/g, '<br/>');
    },
    [form.pemohon, form.tujuan, form.tanggal, todayText, manualFields, customValues]
  );

  const previewBody = useMemo(() => {
    const sampleTarget = badan.find((b) => selectedIds.includes(b.id)) || badan[0] || {};
    return renderTemplate(bodyTemplate, sampleTarget);
  }, [badan, selectedIds, bodyTemplate, renderTemplate]);

  const proceedSend = async () => {
    setStatusMessage('');
    if (!hasConfig) {
      setStatusMessage('SMTP belum disetel. Klik indikator merah/hijau di navbar dulu.');
      return;
    }
    if (selectedIds.length === 0) {
      setStatusMessage('Pilih minimal satu badan publik.');
      return;
    }
    if (!form.pemohon || !form.tujuan || !form.subject) {
      setStatusMessage('Lengkapi nama pemohon, tujuan, dan subjek.');
      return;
    }
    if (!attachment) {
      setStatusMessage('Lampiran KTP wajib diunggah sebelum mengirim.');
      return;
    }
    setConfirmOpen(false);
    setSending(true);
    try {
      const payload = {
        badan_publik_ids: selectedIds,
        subject_template: form.subject,
        body_template: bodyTemplate,
        meta: {
          pemohon: form.pemohon,
          tujuan: form.tujuan,
          tanggal: form.tanggal || todayText,
          custom_fields: customValues,
          template_id: selectedTemplateId
        },
        attachments: attachment ? [attachment] : []
      };
      const res = await api.post('/email/send', payload);
      const results = res.data?.results || [];
      const failed = results.filter((r) => r.status === 'failed').length;
      const success = results.filter((r) => r.status === 'success').length;

      if (success === 0) {
        setStatusMessage(failed > 0 ? 'Gagal mengirim: semua target gagal. Periksa email tujuan.' : 'Gagal mengirim.');
      } else {
        const msg =
          failed > 0
            ? `Berhasil ke ${success}, gagal ${failed} (cek email kosong/invalid).`
            : res.data?.message || 'Email diproses';
        setSuccessInfo({
          message: msg,
          total: success,
          attachment: Boolean(attachment)
        });
        setSelectedIds([]);
        setAttachment(null);
        setAttachmentPreview(null);
        setStatusMessage(failed > 0 ? 'Beberapa target gagal, cek kembali data email.' : '');
      }
    } catch (err) {
      setStatusMessage(err.response?.data?.message || 'Gagal mengirim email');
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    setStatusMessage('');
    if (!hasConfig) {
      setStatusMessage('SMTP belum disetel. Klik indikator merah/hijau di navbar dulu.');
      return;
    }
    if (selectedIds.length === 0) {
      setStatusMessage('Pilih minimal satu badan publik.');
      return;
    }
    if (!form.pemohon || !form.tujuan || !form.subject) {
      setStatusMessage('Lengkapi nama pemohon, tujuan, dan subjek.');
      return;
    }
    if (!attachment) {
      setStatusMessage('Lampiran KTP wajib diunggah sebelum mengirim.');
      return;
    }
    const missingDynamic = manualFields.find((f) => !customValues[f]);
    if (missingDynamic) {
      setStatusMessage(`Isi field ${formatLabel(missingDynamic)} untuk template ini.`);
      return;
    }
    setConfirmOpen(true);
  };

  const cards = [
    { title: 'Total Badan Publik', value: stats.badanCount, accent: 'emerald', hint: 'Basis target aktif' },
    { title: 'Email Terkirim', value: stats.sentCount, accent: 'sky', hint: 'Total kirim akumulasi' },
    { title: 'Menunggu Kirim', value: stats.pendingCount, accent: 'amber', hint: 'Status pending' },
    { title: 'Log Tercatat', value: stats.logCount, accent: 'slate', hint: 'Riwayat di History' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Halo, {user?.username}</p>
          <h1 className="text-2xl font-bold text-slate-900">Kirim Email Massal Sekarang</h1>
          <p className="text-sm text-slate-500">Pilih penerima, isi template, lampirkan KTP, lalu kirim.</p>
        </div>
        <span className="px-3 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600">
          Peran: {user?.role}
        </span>
      </div>

      
      {!isAdmin && (
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-soft">
            <span className="w-3 h-3 rounded-full bg-slate-400 shadow-inner" />
            <div>
              <div className="text-sm font-semibold text-slate-900">Kuota harian</div>
              <div className="text-xs text-slate-600">
                {quota
                  ? `${quota.used_today}/${quota.daily_quota} terpakai (sisa ${quota.remaining ?? quota.daily_quota - quota.used_today})`
                  : 'Memuat...'}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => setQuotaModal(true)}
                  className="text-xs px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Ajukan kuota tambahan
                </button>
                {quotaRequests[0] && (
                  <span
                    className={`text-[11px] px-2 py-1 rounded-full ${
                      quotaRequests[0].status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : quotaRequests[0].status === 'rejected'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    Permintaan terakhir: {quotaRequests[0].status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <GuideCard visible={showGuide} onClose={() => setShowGuide(false)} />

      <StatsGrid cards={cards} loading={loading} />

      {user?.role !== 'admin' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-soft p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Akses penugasan</p>
              <h2 className="text-lg font-bold text-slate-900">
                Anda ditugaskan ke {assignments.length} badan publik
              </h2>
            </div>
          </div>
          {assignments.length === 0 ? (
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              Belum ada penugasan. Hubungi admin agar Anda mendapat akses badan publik.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {assignments.slice(0, 6).map((a) => (
                <div
                  key={a.badan_publik_id}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700"
                >
                  <div className="font-semibold text-slate-900">{a.badanPublik?.nama_badan_publik}</div>
                  <div className="text-xs text-slate-500">{a.badanPublik?.kategori}</div>
                </div>
              ))}
              {assignments.length > 6 && (
                <div className="px-3 py-2 text-sm text-slate-500">+{assignments.length - 6} lainnya</div>
              )}
            </div>
          )}
        </div>
      )}

      <ComposerSection
        form={form}
        setForm={setForm}
        attachment={attachment}
        attachmentPreview={attachmentPreview}
        handleFile={handleFile}
        previewBody={previewBody}
        selectedCount={selectedIds.length}
        totalCount={badan.length}
        statusMessage={statusMessage}
        handleSend={handleSend}
        sending={sending}
        templates={templates}
        activeTemplate={activeTemplate}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={setSelectedTemplateId}
        placeholderKeys={placeholderKeys}
        manualFields={manualFields}
        customValues={customValues}
        onChangeCustomValue={handleCustomValueChange}
        missingManualFields={missingManualFields}
      />

      <RecipientTable
        badan={badan}
        selectedIds={selectedIds}
        loading={loading}
        toggleAll={toggleAll}
        toggleSelect={toggleSelect}
      />

      <SuccessModal info={successInfo} onClose={() => setSuccessInfo(null)} />
      <ConfirmModal
        open={confirmOpen}
        selectedCount={selectedIds.length}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={proceedSend}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      {!isAdmin && quotaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Ajukan Kuota Tambahan</h3>
                <p className="text-sm text-slate-600">Saran default 40/hari. Isi angka dan alasan singkat.</p>
              </div>
              <button
                onClick={() => setQuotaModal(false)}
                className="text-slate-500 hover:text-slate-800 text-xl font-bold"
              >
                X
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Kuota diminta</label>
              <input
                type="number"
                min={1}
                value={quotaRequest.requested_quota}
                onChange={(e) =>
                  setQuotaRequest((prev) => ({ ...prev, requested_quota: Number(e.target.value) }))
                }
                className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Alasan</label>
              <textarea
                value={quotaRequest.reason}
                onChange={(e) => setQuotaRequest((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setQuotaModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  try {
                    await api.post('/quota/request', quotaRequest);
                    setToast({ message: 'Permintaan kuota dikirim', type: 'success' });
                    const resReq = await api.get('/quota/my-requests');
                    setQuotaRequests(resReq.data || []);
                    setQuotaModal(false);
                  } catch (err) {
                    setToast({
                      message: err.response?.data?.message || 'Gagal mengajukan kuota',
                      type: 'error'
                    });
                  }
                }}
                className="px-5 py-2 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700"
              >
                Kirim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
