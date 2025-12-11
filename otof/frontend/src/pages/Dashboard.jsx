import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

const formatBytes = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const Dashboard = () => {
  const { user } = useAuth();
  const { hasConfig, checkConfig } = useSmtp();
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
  const [filterText, setFilterText] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
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
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [sendSummary, setSendSummary] = useState({ success: 0, failed: 0 });
  const [assignmentsModal, setAssignmentsModal] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
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
  const categories = useMemo(
    () => Array.from(new Set(badan.map((b) => b.kategori).filter(Boolean))).sort(),
    [badan]
  );
  const statuses = useMemo(() => Array.from(new Set(badan.map((b) => b.status).filter(Boolean))), [badan]);

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

        const successLogs = logs.filter((l) => l.status === 'success').length;
        const failedLogs = logs.filter((l) => l.status === 'failed').length;

        setStats({
          badanCount: badanData.length,
          sentCount,
          pendingCount,
          logCount: logs.length
        });
        setSendSummary({ success: successLogs, failed: failedLogs });
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

  const filteredBadan = useMemo(() => {
    const q = filterText.toLowerCase();
    return badan.filter((b) => {
      const matchText =
        b.nama_badan_publik?.toLowerCase().includes(q) ||
        b.kategori?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        b.pertanyaan?.toLowerCase().includes(q);
      const matchKategori = filterKategori ? b.kategori === filterKategori : true;
      const matchStatus = filterStatus ? b.status === filterStatus : true;
      return matchText && matchKategori && matchStatus;
    });
  }, [badan, filterText, filterKategori, filterStatus]);

  const toggleAll = () => {
    if (selectedIds.length === filteredBadan.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBadan.map((b) => b.id));
    }
  };

  const selectFiltered = () => {
    setSelectedIds(filteredBadan.map((b) => b.id));
  };

  const clearSelection = () => setSelectedIds([]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const limit = 7 * 1024 * 1024;
    if (file.size > limit) {
      setStatusMessage('Ukuran file maksimal 7MB agar tidak ditolak server.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setAttachment({
        filename: file.name,
        content: base64,
        encoding: 'base64',
        contentType: file.type,
        size: file.size
      });
      setAttachmentPreview({
        type: file.type,
        url: reader.result
      });
    };
    reader.readAsDataURL(file);
    setStatusMessage(`Lampiran: ${file.name} (${formatBytes(file.size)})`);
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

  const attachmentInfo = useMemo(() => {
    if (!attachment) return null;
    return `${attachment.filename || 'Lampiran'}${attachment.size ? ` (${formatBytes(attachment.size)})` : ''}${
      attachment.contentType ? ` • ${attachment.contentType}` : ''
    }`;
  }, [attachment]);

  const filteredAssignments = useMemo(() => {
    const q = assignmentSearch.toLowerCase();
    return assignments.filter(
      (a) =>
        a.badanPublik?.nama_badan_publik?.toLowerCase().includes(q) ||
        a.badanPublik?.kategori?.toLowerCase().includes(q)
    );
  }, [assignments, assignmentSearch]);

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
      setSendSummary((prev) => ({
        success: (prev.success || 0) + success,
        failed: (prev.failed || 0) + failed
      }));

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

  const verifySmtpQuick = async () => {
    setStatusMessage('');
    setToast(null);
    setSmtpTesting(true);
    try {
      const res = await api.post('/config/smtp/verify', {});
      setToast({ message: res.data?.message || 'SMTP siap digunakan.', type: 'success' });
      await checkConfig();
    } catch (err) {
      setToast({
        message:
          err.response?.data?.message ||
          'SMTP tidak valid. Periksa email + App Password di Settings (pastikan 2FA/IMAP aktif).',
        type: 'error'
      });
    } finally {
      setSmtpTesting(false);
    }
  };

  const cards = [
    { title: 'Total Badan Publik', value: stats.badanCount, accent: 'emerald', hint: 'Basis target aktif', source: 'API', updatedAt: 'sinkron' },
    { title: 'Email Terkirim', value: stats.sentCount, accent: 'sky', hint: 'Total kirim akumulasi', source: 'Log', updatedAt: 'real-time' },
    { title: 'Menunggu Kirim', value: stats.pendingCount, accent: 'amber', hint: 'Status pending', source: 'API', updatedAt: 'sinkron' },
    { title: 'Log Tercatat', value: stats.logCount, accent: 'slate', hint: 'Riwayat di History', source: 'Log', updatedAt: 'real-time' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-soft p-5 col-span-1 lg:col-span-2">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-[0.08em]">Halo, {user?.username}</p>
              <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: '"Newsreader", serif' }}>
                Jalur cepat keterbukaan informasi
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Ikuti tiga langkah: setel SMTP, siapkan data, kirim permohonan massal dengan lampiran KTP.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="px-3 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600">
                Peran: {user?.role}
              </span>
              <div className="flex items-center gap-2">
                <span
                  title={hasConfig ? 'SMTP tersimpan' : 'Belum ada SMTP, buka Settings'}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    hasConfig ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {hasConfig ? 'SMTP siap' : 'SMTP belum siap'}
                </span>
                <button
                  onClick={verifySmtpQuick}
                  disabled={smtpTesting}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold disabled:opacity-60"
                >
                  {smtpTesting ? 'Menguji...' : 'Cek SMTP'}
                </button>
                <Link
                  to="/settings"
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-soft hover:bg-slate-800"
                >
                  Settings
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { title: 'Setel SMTP', done: hasConfig, desc: 'App password & IMAP aktif', action: () => setShowGuide(false) },
              { title: 'Siapkan data', done: badan.length > 0, desc: 'Import / tambah badan publik', action: null },
              { title: 'Kirim', done: sendSummary.success > 0, desc: 'Pilih penerima, lampirkan KTP', action: null }
            ].map((step, idx) => (
              <div
                key={step.title}
                className={`rounded-xl border px-3 py-3 flex items-start gap-3 ${
                  step.done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step.done ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="text-sm">
                  <div className="font-semibold text-slate-900">{step.title}</div>
                  <div className="text-xs text-slate-600">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-soft p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Ringkasan kirim</div>
              <p className="text-xs text-slate-500">Status log terakhir</p>
            </div>
            <Link to="/history" className="text-xs font-semibold text-primary hover:underline">
              Lihat log
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              Berhasil: {sendSummary.success}
            </span>
            <span className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
              Gagal: {sendSummary.failed}
            </span>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="grid grid-cols-1 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Kuota harian</div>
                <div className="text-xs text-slate-600">
                  {quota
                    ? `${quota.used_today}/${quota.daily_quota} terpakai (sisa ${
                        quota.remaining ?? quota.daily_quota - quota.used_today
                      })`
                    : 'Memuat...'}
                </div>
              </div>
              <button
                onClick={() => setQuotaModal(true)}
                className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Ajukan kuota
              </button>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    quota && quota.daily_quota ? Math.round((quota.used_today / quota.daily_quota) * 100) : 0
                  )}%`
                }}
              />
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
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
            {assignments.length > 0 && (
              <button
                onClick={() => setAssignmentsModal(true)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Lihat semua
              </button>
            )}
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
      attachmentInfo={attachmentInfo}
        handleFile={handleFile}
        previewBody={previewBody}
        selectedCount={selectedIds.length}
        totalCount={filteredBadan.length}
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
        badan={filteredBadan}
        selectedIds={selectedIds}
        loading={loading}
        toggleAll={toggleAll}
        toggleSelect={toggleSelect}
        filterText={filterText}
        setFilterText={setFilterText}
        filterKategori={filterKategori}
        setFilterKategori={setFilterKategori}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        categories={categories}
        statuses={statuses}
        selectFiltered={selectFiltered}
        clearSelection={clearSelection}
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

      {!isAdmin && assignmentsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-5 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Penugasan Anda</h3>
                <p className="text-sm text-slate-600">Cari badan publik yang ditugaskan.</p>
              </div>
              <button
                onClick={() => setAssignmentsModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <input
              value={assignmentSearch}
              onChange={(e) => setAssignmentSearch(e.target.value)}
              placeholder="Cari nama/kategori"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[320px] overflow-auto">
              {filteredAssignments.length === 0 ? (
                <div className="text-sm text-slate-500 col-span-3">Tidak ada data.</div>
              ) : (
                filteredAssignments.map((a) => (
                  <div
                    key={a.badan_publik_id}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700"
                  >
                    <div className="font-semibold text-slate-900">{a.badanPublik?.nama_badan_publik}</div>
                    <div className="text-xs text-slate-500">{a.badanPublik?.kategori}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
