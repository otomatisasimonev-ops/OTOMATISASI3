import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSmtp } from '../../context/SmtpContext';
import StatsGrid from './StatsGrid';
import GuideCard from './GuideCard';
import ComposerSection from './ComposerSection';
import RecipientTable from './RecipientTable';
import ConfirmModal from './ConfirmModal';
import WarningModal from './WarningModal';
import SuccessModal from './SuccessModal';
import Toast from '../common/Toast';
import QuoteCard from './QuoteCard';
import KipFeedCard from './KipFeedCard';
import QuotaCard from './QuotaCard';
import AssignmentsCard from './AssignmentsCard';
import DEFAULT_TEMPLATES from '../../constants/templates';
import QUOTES from '../../constants/quotes';
import { getMonitoringMap, saveMonitoringMap } from '../../utils/monitoring';
import { computeDueInfo } from '../../utils/workdays';
import { fetchHolidays } from '../../services/holidays';

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

const isValidEmail = (val) => {
  if (!val) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
};

const DashboardPage = () => {
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
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningItems, setWarningItems] = useState([]);
  const [showGuide, setShowGuide] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [toast, setToast] = useState(null);
  const [quota, setQuota] = useState({ daily_quota: 40, used_today: 0, remaining: 40 });
  const [quotaModal, setQuotaModal] = useState(false);
  const [quotaRequest, setQuotaRequest] = useState({ requested_quota: 50, reason: '' });
  const [quotaRequests, setQuotaRequests] = useState([]);
  const [assignmentsModal, setAssignmentsModal] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [customTemplates, setCustomTemplates] = useState(() => loadTemplates(user?.role));
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [bodyTemplate, setBodyTemplate] = useState(DEFAULT_TEMPLATES[0].body);
  const [customValues, setCustomValues] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [monitoringMap, setMonitoringMap] = useState(() => getMonitoringMap());
  const [sentHistoryMap, setSentHistoryMap] = useState({});
  const [maxRows, setMaxRows] = useState(50);
  const [tablePage, setTablePage] = useState(1);
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

        const successLogs = logs.filter((l) => l.status === 'success');
        const failedLogs = logs.filter((l) => l.status === 'failed');
        const historyMap = {};
        successLogs.forEach((log) => {
          const targetId = log.badan_publik_id;
          const sentAt = log.sent_at || log.created_at || log.createdAt;
          if (!targetId || !sentAt) return;
          const current = historyMap[targetId];
          if (!current || new Date(sentAt).getTime() > new Date(current).getTime()) {
            historyMap[targetId] = sentAt;
          }
        });

        setStats({
          badanCount: badanData.length,
          sentCount,
          pendingCount,
          logCount: logs.length
        });
        setBadan(badanData);
        setSentHistoryMap(historyMap);
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

  const handleCustomValueChange = (field, value) => {
    setCustomValues((prev) => ({ ...prev, [field]: value }));
  };

  const updateMonitoring = useCallback((id, updates) => {
    setMonitoringMap((prev) => {
      const next = {
        ...prev,
        [id]: {
          status: 'menunggu',
          extraDays: false,
          ...prev[id],
          ...updates,
          updatedAt: new Date().toISOString()
        }
      };
      saveMonitoringMap(next);
      return next;
    });
  }, []);

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

  const displayedBadan = useMemo(() => {
    const limit = Number(maxRows) || 0;
    if (limit > 0) {
      const start = (tablePage - 1) * limit;
      return filteredBadan.slice(start, start + limit);
    }
    return filteredBadan;
  }, [filteredBadan, maxRows, tablePage]);

  const totalTablePages = useMemo(() => {
    const limit = Number(maxRows) || 0;
    if (limit <= 0) return 1;
    return Math.max(1, Math.ceil(filteredBadan.length / limit));
  }, [filteredBadan.length, maxRows]);

  useEffect(() => {
    setTablePage(1);
  }, [filterText, filterKategori, filterStatus, maxRows]);

  useEffect(() => {
    if (tablePage > totalTablePages) {
      setTablePage(totalTablePages);
    }
  }, [tablePage, totalTablePages]);

  const toggleAll = () => {
    const validIds = displayedBadan.filter((b) => isValidEmail(b.email)).map((b) => b.id);
    if (validIds.length === 0) {
      setSelectedIds([]);
      return;
    }
    const allSelected = validIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : validIds);
  };

  const selectFiltered = () => {
    const validIds = displayedBadan.filter((b) => isValidEmail(b.email)).map((b) => b.id);
    setSelectedIds(validIds);
  };

  const clearSelection = () => setSelectedIds([]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const limit = 2 * 1024 * 1024; // 2MB agar payload aman dan sesuai batas backend
    if (file.size > limit) {
      setStatusMessage('Ukuran file maksimal 2MB agar tidak ditolak server (sesuaikan resolusi/kompres).');
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

  const monitoringSummary = useMemo(() => {
    const overdue = [];
    const dueSoon = [];
    badan.forEach((b) => {
      const monitor = monitoringMap[b.id];
      if (!monitor || monitor.status === 'responded' || monitor.status === 'no-response') return;
      if (!monitor.startDate) return;
      const info = computeDueInfo({
        startDate: monitor.startDate,
        baseDays: 10,
        extraDays: monitor.extraDays ? 7 : 0,
        holidays
      });
      if (!info.dueDate) return;
      const entry = { id: b.id, name: b.nama_badan_publik, dueDate: info.dueDateLabel, daysLeft: info.daysLeft };
      if (info.overdue) {
        overdue.push(entry);
      } else if (info.daysLeft != null && info.daysLeft <= 2) {
        dueSoon.push(entry);
      }
    });
    return { overdue, dueSoon };
  }, [badan, monitoringMap, holidays]);

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
        setSentHistoryMap((prev) => {
          const next = { ...prev };
          const now = new Date().toISOString();
          results.forEach((r) => {
            if (r.status === 'success') {
              next[r.id] = now;
            }
          });
          return next;
        });
        const todayIso = new Date().toISOString().slice(0, 10);
        selectedIds.forEach((id) =>
          updateMonitoring(id, {
            startDate: todayIso,
            status: 'menunggu',
            extraDays: false,
            respondedAt: null,
            closedAt: null
          })
        );
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
    const repeatedIds = selectedIds.filter((id) => sentHistoryMap[id]);
    if (repeatedIds.length > 0) {
      const items = repeatedIds.map((id) => {
        const target = badan.find((b) => b.id === id);
        return {
          id,
          name: target?.nama_badan_publik || `ID ${id}`,
          lastSentAt: sentHistoryMap[id]
        };
      });
      setWarningItems(items);
      setWarningOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const cards = [
    { title: 'Total Badan Publik', value: stats.badanCount, accent: 'emerald', hint: 'Basis target aktif', source: 'API', updatedAt: 'sinkron' },
    { title: 'Email Terkirim', value: stats.sentCount, accent: 'sky', hint: 'Total kirim akumulasi', source: 'Log', updatedAt: 'real-time' },
    { title: 'Menunggu Kirim', value: stats.pendingCount, accent: 'amber', hint: 'Status pending', source: 'API', updatedAt: 'sinkron' },
    { title: 'Log Tercatat', value: stats.logCount, accent: 'slate', hint: 'Riwayat di History', source: 'Log', updatedAt: 'real-time' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <QuoteCard quotes={QUOTES} />
        <KipFeedCard compact />
      </div>
      {!isAdmin && (
        <QuotaCard quota={quota} quotaRequests={quotaRequests} onRequest={() => setQuotaModal(true)} />
      )}

      <GuideCard visible={showGuide} onClose={() => setShowGuide(false)} />

      <StatsGrid cards={cards} loading={loading} />

      {(monitoringSummary.overdue.length > 0 || monitoringSummary.dueSoon.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-soft p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Pengingat pemantauan</p>
              <h3 className="text-lg font-bold text-slate-900">Respon badan publik</h3>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {monitoringSummary.overdue.map((item) => (
              <span
                key={`over-${item.id}`}
                className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200"
              >
                Lewat tenggat: {item.name} (due {item.dueDate})
              </span>
            ))}
            {monitoringSummary.dueSoon.map((item) => (
              <span
                key={`soon-${item.id}`}
                className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200"
              >
                Jatuh tempo {item.dueDate} ({item.daysLeft} hari lagi) - {item.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {user?.role !== 'admin' && (
        <AssignmentsCard assignments={assignments} onOpenModal={() => setAssignmentsModal(true)} />
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
        badan={displayedBadan}
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
        holidays={holidays}
        monitoringMap={monitoringMap}
        onUpdateMonitoring={updateMonitoring}
        maxRows={maxRows}
        setMaxRows={setMaxRows}
        totalFiltered={filteredBadan.length}
        page={tablePage}
        setPage={setTablePage}
        totalPages={totalTablePages}
      />

      <SuccessModal info={successInfo} onClose={() => setSuccessInfo(null)} />
      <WarningModal
        open={warningOpen}
        items={warningItems}
        onCancel={() => setWarningOpen(false)}
        onConfirm={() => {
          setWarningOpen(false);
          setConfirmOpen(true);
        }}
      />
      <ConfirmModal
        open={confirmOpen}
        selectedCount={selectedIds.length}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={proceedSend}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      {!isAdmin && quotaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-6 border border-slate-200 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                  Ajukan Kuota Tambahan
                  <span className="text-emerald-800">Rekomendasi 40/hari</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Permintaan ekstra untuk hari ini, tidak mengganti kuota harian Anda. Isi angka dan alasan singkat.
                </p>
              </div>
              <button
                onClick={() => setQuotaModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
                aria-label="Tutup"
              >
                X
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Kuota tambahan yang diminta</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={quotaRequest.requested_quota}
                    onChange={(e) =>
                      setQuotaRequest((prev) => ({ ...prev, requested_quota: Number(e.target.value) }))
                    }
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 pr-16 focus:outline-none focus:ring-2 focus:ring-primary text-lg font-semibold text-slate-900 shadow-sm"
                    placeholder="40"
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-xs text-slate-500">/hari</span>
                </div>
                <p className="text-xs text-slate-500">Angka positif, contoh 40 atau 50.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">Alasan singkat</label>
                  <span className="text-[11px] text-slate-400">Opsional tapi disarankan</span>
                </div>
                <textarea
                  value={quotaRequest.reason}
                  onChange={(e) => setQuotaRequest((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px] text-sm shadow-sm"
                  placeholder="Contoh: Banyak permintaan baru hari ini, perlu tambahan slot."
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-end gap-2">
              <button
                onClick={() => setQuotaModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold"
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
                className="px-5 py-2 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 text-sm"
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
                X
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

export default DashboardPage;
