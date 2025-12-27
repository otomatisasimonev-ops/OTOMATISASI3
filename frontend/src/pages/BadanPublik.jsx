import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { computeDueInfo } from '../utils/workdays';
import { getMonitoringMap, saveMonitoringMap } from '../utils/monitoring';
import { fetchHolidays } from '../services/holidays';
import Toast from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import useToast from '../hooks/useToast';
import useConfirmDialog from '../hooks/useConfirmDialog';

const emptyForm = {
  nama_badan_publik: '',
  kategori: '',
  email: '',
  website: '',
  pertanyaan: '',
  status: 'pending',
  thread_id: ''
};

const requiredFields = [
  { key: 'nama_badan_publik', label: 'Nama' },
  { key: 'kategori', label: 'Kategori' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'pertanyaan', label: 'Pertanyaan' }
];

const assignmentImportFields = [
  { key: 'nama_badan_publik', label: 'Nama Badan Publik', aliases: ['nama badan publik', 'badan publik', 'nama instansi', 'instansi'] },
  { key: 'kategori', label: 'Kategori', aliases: ['kategori', 'category'] },
  { key: 'website', label: 'Website', aliases: ['website', 'web', 'url'] },
  { key: 'email', label: 'Email', aliases: ['email', 'email badan publik'] },
  { key: 'lembaga', label: 'Lembaga', aliases: ['lembaga', 'instansi penguji', 'group'] },
  { key: 'pertanyaan', label: 'Pertanyaan', aliases: ['pertanyaan', 'question', 'permohonan'] },
  { key: 'nama_penguji', label: 'Nama Penguji Akses', aliases: ['nama penguji akses', 'nama penguji'] },
  { key: 'email_penguji', label: 'Email Penguji', aliases: ['email penguji', 'email penguji akses'] },
  { key: 'no_hp_penguji', label: 'No HP Penguji', aliases: ['no hp', 'nomor hp', 'nomer hp', 'hp', 'phone', 'telepon', 'telp'] }
];
const assignmentRequiredKeys = assignmentImportFields
  .filter((f) => f.key !== 'email' && f.key !== 'email_penguji')
  .map((f) => f.key);

const normalizeValue = (val) => String(val ?? '').trim();

const normalizeEmail = (val) => {
  const trimmed = normalizeValue(val).toLowerCase();
  return trimmed || '';
};

const normalizePhone = (val) => {
  const cleaned = normalizeValue(val).replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+62')) {
    return `0${cleaned.slice(3)}`;
  }
  if (cleaned.startsWith('62')) {
    return `0${cleaned.slice(2)}`;
  }
  if (cleaned.startsWith('0')) {
    return cleaned;
  }
  return `0${cleaned}`;
};

const decodeHtml = (val) => {
  if (!val) return '';
  try {
    const doc = new DOMParser().parseFromString(String(val), 'text/html');
    return doc.documentElement.textContent || '';
  } catch (_err) {
    return String(val);
  }
};

const isValidEmail = (val) => {
  if (!val) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
};

const buildTemplateCsv = () => {
  const header = assignmentImportFields.map((f) => f.label);
  const sample = [
    'Dinas Kominfo',
    'Pemerintah',
    'https://dinas.go.id',
    'ppid@dinas.go.id',
    'Pemda',
    'Permohonan informasi publik',
    'Budi Santoso',
    'budi@contoh.id',
    '08123456789'
  ];
  return [header, sample]
    .map((cols) => cols.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    .join('\n');
};

const buildTemplateXlsx = () => {
  const header = assignmentImportFields.reduce((acc, f) => {
    acc[f.label] = '';
    return acc;
  }, {});
  header['Nama Badan Publik'] = 'Dinas Kominfo';
  header['Kategori'] = 'Pemerintah';
  header['Website'] = 'https://dinas.go.id';
  header['Email'] = 'ppid@dinas.go.id';
  header['Lembaga'] = 'Pemda';
  header['Pertanyaan'] = 'Permohonan informasi publik';
  header['Nama Penguji Akses'] = 'Budi Santoso';
  header['Email Penguji'] = 'budi@contoh.id';
  header['No HP Penguji'] = '08123456789';
  return [header];
};

const BadanPublik = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const { toast, showToast, clearToast } = useToast();
  const { confirmDialog, openConfirm, closeConfirm, handleConfirm } = useConfirmDialog();
  const [forceDeleteIds, setForceDeleteIds] = useState([]);
  const [forceDeleting, setForceDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importRows, setImportRows] = useState([]);
  const [importMapping, setImportMapping] = useState(() => {
    const init = {};
    requiredFields.forEach((f) => {
      init[f.key] = '';
    });
    return init;
  });
  const [importError, setImportError] = useState('');
  const [importAssignOpen, setImportAssignOpen] = useState(false);
  const [importAssignPreview, setImportAssignPreview] = useState([]);
  const [importAssignHeaders, setImportAssignHeaders] = useState([]);
  const [importAssignRows, setImportAssignRows] = useState([]);
  const [importAssignMapping, setImportAssignMapping] = useState(() => {
    const init = {};
    assignmentImportFields.forEach((f) => {
      init[f.key] = '';
    });
    return init;
  });
  const [importAssignError, setImportAssignError] = useState('');
  const [importAssignLoading, setImportAssignLoading] = useState(false);
  const [importAssignIssues, setImportAssignIssues] = useState([]);
  const [importAssignSummary, setImportAssignSummary] = useState(null);
  const [importAssignController, setImportAssignController] = useState(null);
  const [importAssignSimulated, setImportAssignSimulated] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [emailFilter, setEmailFilter] = useState('all');
  const [holidays, setHolidays] = useState([]);
  const [monitoringMap, setMonitoringMap] = useState(() => getMonitoringMap());

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/badan-publik');
      setData(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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


  const samplePreview = useMemo(() => data.slice(0, 3), [data]);
  const filteredData = useMemo(() => {
    if (emailFilter === 'with-email') return data.filter((d) => d.email);
    if (emailFilter === 'no-email') return data.filter((d) => !d.email);
    return data;
  }, [data, emailFilter]);

  useEffect(() => {
    setSelectedIds([]);
  }, [data, emailFilter]);

  const openForm = (item) => {
    // Admin bisa tambah/edit; user hanya boleh edit data yang sudah ada (misal koreksi email)
    if (!isAdmin && !item) {
      showToast('Hanya admin yang bisa menambah data baru.', 'error');
      return;
    }
    if (item) {
      setEditingId(item.id);
      setFormData({
        nama_badan_publik: item.nama_badan_publik || '',
        kategori: item.kategori || '',
        email: item.email || '',
        website: item.website || '',
        pertanyaan: item.pertanyaan || '',
        status: item.status || 'pending',
        thread_id: item.thread_id || ''
      });
    } else {
      setEditingId(null);
      setFormData(emptyForm);
    }
    setFormOpen(true);
  };

  const saveForm = async (e) => {
    e.preventDefault();
    // User boleh edit data (editingId ada), tapi tidak boleh tambah data baru
    if (!isAdmin && !editingId) {
      showToast('Hanya admin yang bisa menambah data baru.', 'error');
      return;
    }
    try {
      if (editingId) {
        await api.put(`/badan-publik/${editingId}`, formData);
        showToast('Data diperbarui.', 'success');
      } else {
        await api.post('/badan-publik', formData);
        showToast('Data ditambahkan.', 'success');
      }
      setFormOpen(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal menyimpan data', 'error');
    }
  };

  const applyLocalDelete = (ids) => {
    const idSet = new Set(ids);
    setData((prev) => prev.filter((item) => !idSet.has(item.id)));
    setSelectedIds((prev) => prev.filter((selectedId) => !idSet.has(selectedId)));
    setMonitoringMap((prev) => {
      const next = { ...prev };
      ids.forEach((removeId) => {
        if (next[removeId]) {
          delete next[removeId];
        }
      });
      saveMonitoringMap(next);
      return next;
    });
  };

  const performDelete = async (id) => {
    try {
      await api.delete(`/badan-publik/${id}`);
      showToast('Data dihapus.', 'success');
      setForceDeleteIds([]);
      applyLocalDelete([id]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menghapus data';
      if (err.response?.status === 409) {
        setForceDeleteIds([id]);
        showToast(msg, 'error', { label: 'Force delete', onClick: handleForceDelete });
        return;
      }
      showToast(msg, 'error');
    }
  };

  const deleteData = (id) => {
    if (!isAdmin) {
      showToast('Akses ditolak: hanya admin yang bisa menghapus data.', 'error');
      return;
    }
    openConfirm({
      title: 'Hapus data badan publik?',
      message: 'Data badan publik ini akan dihapus dari sistem.',
      confirmLabel: 'Hapus',
      tone: 'danger',
      onConfirm: () => performDelete(id)
    });
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredData.map((item) => item.id));
  };

  const performBulkDelete = async (ids) => {
    if (!isAdmin) {
      showToast('Akses ditolak: hanya admin yang bisa menghapus data.', 'error');
      return;
    }
    if (ids.length === 0) {
      showToast('Pilih minimal satu data untuk dihapus.', 'error');
      return;
    }
    try {
      const res = await api.post('/badan-publik/bulk-delete', { ids });
      showToast(res.data?.message || `Berhasil menghapus ${ids.length} data.`, 'success');
      setForceDeleteIds([]);
      applyLocalDelete(ids);
      setSelectedIds([]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menghapus data terpilih';
      if (err.response?.status === 409) {
        setForceDeleteIds(ids);
        showToast(msg, 'error', { label: 'Force delete', onClick: handleForceDelete });
        return;
      }
      showToast(msg, 'error');
    }
  };

  const handleBulkDelete = () => {
    if (!isAdmin) {
      showToast('Akses ditolak: hanya admin yang bisa menghapus data.', 'error');
      return;
    }
    if (selectedIds.length === 0) {
      showToast('Pilih minimal satu data untuk dihapus.', 'error');
      return;
    }
    const ids = [...selectedIds];
    openConfirm({
      title: 'Hapus data terpilih?',
      message: `${ids.length} data badan publik akan dihapus.`,
      confirmLabel: 'Hapus',
      tone: 'danger',
      onConfirm: () => performBulkDelete(ids)
    });
  };

  const performForceDelete = async (ids) => {
    if (ids.length === 0) return;
    setForceDeleting(true);
    try {
      const res = await api.post('/badan-publik/bulk-delete', {
        ids,
        force: true
      });
      showToast(res.data?.message || 'Force delete berhasil.', 'success');
      applyLocalDelete(ids);
      setForceDeleteIds([]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Force delete gagal.';
      showToast(msg, 'error');
    } finally {
      setForceDeleting(false);
    }
  };

  const handleForceDelete = () => {
    if (forceDeleteIds.length === 0) return;
    const ids = [...forceDeleteIds];
    openConfirm({
      title: 'Force delete data?',
      message: 'Force delete akan menghapus badan publik beserta data terhubung (riwayat penugasan, log, laporan).',
      confirmLabel: 'Force delete',
      tone: 'danger',
      onConfirm: () => performForceDelete(ids)
    });
  };

  const handleImportFile = async (e) => {
    if (!isAdmin) {
      setImportError('Akses ditolak: import hanya untuk admin.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportPreview([]);
    setImportHeaders([]);
    setImportRows([]);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
      if (!rows.length) {
        setImportError('File kosong.');
        return;
      }
      const header = rows[0].map((h) => String(h || '').trim());
      const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell));
      setImportHeaders(header);
      setImportRows(dataRows);

      // auto-guess mapping based on header names
      const lowerHeader = header.map((h) => h.toLowerCase());
      const nextMap = {};
      requiredFields.forEach((f) => {
        const idx = lowerHeader.findIndex((h) => h.includes(f.label.toLowerCase()));
        nextMap[f.key] = idx >= 0 ? header[idx] : '';
      });
      setImportMapping(nextMap);

      const previewObjs = buildMappedPreview(dataRows, header, nextMap);
      setImportPreview(previewObjs.slice(0, 5));
    } catch (err) {
      console.error(err);
      setImportError('Gagal membaca file. Pastikan format CSV/XLSX.');
    }
  };

  const buildMappedPreview = (rows, header, mapping) =>
    rows.map((r) => {
      const rowMap = Object.fromEntries(header.map((h, idx) => [h, r[idx]]));
      const obj = {
        nama_badan_publik: '',
        kategori: '',
        email: '',
        website: '',
        pertanyaan: '',
        status: 'pending',
        thread_id: ''
      };
      requiredFields.forEach((f) => {
        const selectedHeader = mapping[f.key];
        obj[f.key] = String(rowMap[selectedHeader] ?? '').trim();
      });
      return obj;
    });

  useEffect(() => {
    if (!importRows.length) return;
    const previewObjs = buildMappedPreview(importRows, importHeaders, importMapping);
    setImportPreview(previewObjs.slice(0, 5));
  }, [importRows, importHeaders, importMapping]);

  const buildAssignPreview = (rows, header, mapping) =>
    rows.map((r) => {
      const rowMap = Object.fromEntries(header.map((h, idx) => [h, r[idx]]));
      const obj = {
        nama_badan_publik: '',
        kategori: '',
        website: '',
        email: '',
        lembaga: '',
        pertanyaan: '',
        nama_penguji: '',
        email_penguji: '',
        no_hp_penguji: ''
      };
      assignmentImportFields.forEach((f) => {
        const selectedHeader = mapping[f.key];
        const value = normalizeValue(rowMap[selectedHeader]);
        if (f.key === 'email') obj[f.key] = normalizeEmail(value);
        else if (f.key === 'email_penguji') obj[f.key] = normalizeEmail(value);
        else if (f.key === 'no_hp_penguji') obj[f.key] = normalizePhone(value);
        else obj[f.key] = value;
      });
      return obj;
    });

  useEffect(() => {
    if (!importAssignRows.length) return;
    const previewObjs = buildAssignPreview(importAssignRows, importAssignHeaders, importAssignMapping);
    setImportAssignPreview(previewObjs.slice(0, 5));
  }, [importAssignRows, importAssignHeaders, importAssignMapping]);

  const computeAssignDiagnostics = (rows, header, mapping) => {
    if (!rows.length) {
      return { preview: [], issues: [], summary: null };
    }

    const mapped = buildAssignPreview(rows, header, mapping);
    const issues = [];
    const emailSeen = new Map();
    let missingRequired = 0;
    let invalidEmail = 0;
    let missingAssignee = 0;
    let duplicateEmail = 0;
    let duplicateName = 0;
    const duplicateNameRows = [];
    const missingByField = {};
    const existingNameSet = new Set(
      data.map((item) => normalizeValue(item.nama_badan_publik).toLowerCase()).filter(Boolean)
    );

    mapped.forEach((row, idx) => {
      const rowIndex = idx + 2; // header + 1
      const missingFields = assignmentRequiredKeys.filter((key) => !row[key]);
      if (missingFields.length) {
        missingRequired++;
        missingFields.forEach((key) => {
          missingByField[key] = (missingByField[key] || 0) + 1;
        });
        const labels = missingFields
          .map((key) => assignmentImportFields.find((f) => f.key === key)?.label || key)
          .join(', ');
        issues.push({ rowIndex, type: 'required', message: `Data belum lengkap (kolom: ${labels}).` });
      }

      if (row.email && !isValidEmail(row.email)) {
        invalidEmail++;
        issues.push({ rowIndex, type: 'email', message: 'Email badan publik tidak valid.' });
      }

      const hasAssignee = row.nama_penguji && row.no_hp_penguji;
      if (!hasAssignee) {
        missingAssignee++;
        issues.push({ rowIndex, type: 'assignee', message: 'Penguji belum lengkap (nama + no hp).' });
      }

      if (row.email) {
        const key = row.email.toLowerCase();
        if (emailSeen.has(key)) {
          duplicateEmail++;
          issues.push({ rowIndex, type: 'duplicate', message: `Duplikat email badan publik (baris ${emailSeen.get(key)}).` });
        } else {
          emailSeen.set(key, rowIndex);
        }
      }

      if (row.nama_badan_publik) {
        const key = row.nama_badan_publik.toLowerCase();
        if (existingNameSet.has(key)) {
          duplicateName++;
          if (duplicateNameRows.length < 3) {
            duplicateNameRows.push(rowIndex);
          }
        }
      }
    });

    const summary = {
      total: mapped.length,
      missingRequired,
      invalidEmail,
      missingAssignee,
      duplicateEmail,
      duplicateName,
      duplicateNameRows,
      missingByField,
      valid: mapped.length - missingRequired
    };

    return { preview: mapped, issues, summary };
  };

  useEffect(() => {
    if (!importAssignRows.length) {
      setImportAssignIssues([]);
      setImportAssignSummary(null);
      return;
    }
    const { preview, issues, summary } = computeAssignDiagnostics(
      importAssignRows,
      importAssignHeaders,
      importAssignMapping
    );
    setImportAssignPreview(preview.slice(0, 5));
    setImportAssignIssues(issues);
    setImportAssignSummary(summary);
  }, [importAssignRows, importAssignHeaders, importAssignMapping]);

  const submitImport = async () => {
    if (!isAdmin) {
      setImportError('Akses ditolak: import hanya untuk admin.');
      return;
    }
    const missing = requiredFields.filter((f) => !importMapping[f.key]);
    if (missing.length) {
      setImportError(`Pilih kolom untuk: ${missing.map((m) => m.label).join(', ')}`);
      return;
    }
    if (importRows.length === 0) {
      setImportError('Tidak ada data untuk diimport.');
      return;
    }

    const mapped = buildMappedPreview(importRows, importHeaders, importMapping);
    try {
      const payloadRecords = mapped.map((r) => {
        const clean = { ...r };
        if (!clean.email) {
          delete clean.email;
        }
        clean.status = clean.status || 'pending';
        clean.thread_id = clean.thread_id || '';
        return clean;
      });
      await api.post('/badan-publik/import', { records: payloadRecords });
      setImportError('');
      setImportOpen(false);
      showToast(`Import berhasil (${payloadRecords.length} data).`, 'success');
      setImportHeaders([]);
      setImportRows([]);
      setImportPreview([]);
      const resetMap = {};
      requiredFields.forEach((f) => (resetMap[f.key] = ''));
      setImportMapping(resetMap);
      fetchData();
    } catch (err) {
      setImportError(err.response?.data?.message || 'Gagal import data');
    }
  };

  const handleImportAssignFile = async (e) => {
    if (!isAdmin) {
      setImportAssignError('Akses ditolak: import hanya untuk admin.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setImportAssignError('');
    setImportAssignPreview([]);
    setImportAssignHeaders([]);
    setImportAssignRows([]);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
      if (!rows.length) {
        setImportAssignError('File kosong.');
        return;
      }
      const header = rows[0].map((h) => String(h || '').trim());
      const dataRows = rows.slice(1).filter((r) => r.some((cell) => String(cell || '').trim()));
      setImportAssignHeaders(header);
      setImportAssignRows(dataRows);

      const lowerHeader = header.map((h) => h.toLowerCase());
      const nextMap = {};
      assignmentImportFields.forEach((f) => {
        const idx = lowerHeader.findIndex((h) => f.aliases.some((alias) => h.includes(alias)));
        nextMap[f.key] = idx >= 0 ? header[idx] : '';
      });
      setImportAssignMapping(nextMap);

      const previewObjs = buildAssignPreview(dataRows, header, nextMap);
      setImportAssignPreview(previewObjs.slice(0, 5));
    } catch (err) {
      console.error(err);
      setImportAssignError('Gagal membaca file. Pastikan format CSV/XLSX.');
    }
  };

  const performImportAssign = async () => {
    const mapped = buildAssignPreview(importAssignRows, importAssignHeaders, importAssignMapping);
    try {
      setImportAssignLoading(true);
      setImportAssignSimulated('');
      const controller = new AbortController();
      setImportAssignController(controller);
      const payloadRecords = mapped.map((r) => ({
        nama_badan_publik: r.nama_badan_publik,
        kategori: r.kategori,
        website: r.website,
        email: r.email,
        lembaga: r.lembaga,
        pertanyaan: r.pertanyaan,
        nama_penguji: r.nama_penguji,
        email_penguji: r.email_penguji,
        no_hp_penguji: r.no_hp_penguji
      }));
      const res = await api.post('/badan-publik/import-assign', { records: payloadRecords }, { signal: controller.signal });
      setImportAssignError('');
      setImportAssignOpen(false);
      const stats = res.data?.stats;
      const detail = stats
        ? `Dibuat ${stats.created}, user ${stats.createdUsers}, penugasan ${stats.assigned}, duplikat ${stats.skippedExisting}.`
        : '';
      showToast(res.data?.message || `Import berhasil (${payloadRecords.length} data). ${detail}`.trim(), 'success');
      setImportAssignHeaders([]);
      setImportAssignRows([]);
      setImportAssignPreview([]);
      setImportAssignIssues([]);
      setImportAssignSummary(null);
      const resetMap = {};
      assignmentImportFields.forEach((f) => (resetMap[f.key] = ''));
      setImportAssignMapping(resetMap);
      fetchData();
    } catch (err) {
      if (err?.name === 'CanceledError') {
        setImportAssignError('Proses import dibatalkan.');
      } else {
        setImportAssignError(err.response?.data?.message || 'Gagal import + penugasan');
      }
    } finally {
      setImportAssignLoading(false);
      setImportAssignController(null);
    }
  };

  const submitImportAssign = async () => {
    if (!isAdmin) {
      setImportAssignError('Akses ditolak: import hanya untuk admin.');
      return;
    }
    const missing = ['nama_badan_publik', 'kategori'].filter((key) => !importAssignMapping[key]);
    if (missing.length) {
      setImportAssignError(`Pilih kolom untuk: ${missing.map((m) => m.replace(/_/g, ' ')).join(', ')}`);
      return;
    }
    if (importAssignRows.length === 0) {
      setImportAssignError('Tidak ada data untuk diimport.');
      return;
    }

    const { summary } = computeAssignDiagnostics(importAssignRows, importAssignHeaders, importAssignMapping);
    if (summary?.missingRequired) {
      const missingLabels = Object.keys(summary.missingByField || {})
        .map((key) => assignmentImportFields.find((f) => f.key === key)?.label || key)
        .join(', ');
      setImportAssignError(`Data belum lengkap (kolom: ${missingLabels}).`);
      return;
    }
    if (summary?.duplicateName) {
      const samples = (summary.duplicateNameRows || []).join(', ');
      setImportAssignError(
        `Nama badan publik sudah ada di database (${summary.duplicateName} baris). Contoh baris: ${samples || '-'}`
      );
      return;
    }
    const summaryMessage = [
      `Total baris: ${summary?.total || 0}`,
      `Valid: ${summary?.valid || 0}`,
      `Tanpa penguji lengkap: ${summary?.missingAssignee || 0}`,
      `Duplikat email: ${summary?.duplicateEmail || 0}`,
      `Nama badan publik sudah ada di database: ${summary?.duplicateName || 0}`
    ].join('\n');
    openConfirm({
      title: 'Konfirmasi import',
      message: summaryMessage,
      confirmLabel: 'Import',
      tone: 'primary',
      onConfirm: performImportAssign
    });
  };

  const simulateImportAssign = () => {
    if (!importAssignRows.length) {
      setImportAssignError('Tidak ada data untuk disimulasikan.');
      return;
    }
    const { summary } = computeAssignDiagnostics(importAssignRows, importAssignHeaders, importAssignMapping);
    setImportAssignError('');
    setImportAssignSimulated(
      `Simulasi selesai. Total ${summary?.total || 0}, valid ${summary?.valid || 0}, tanpa penguji ${summary?.missingAssignee || 0}, duplikat email ${summary?.duplicateEmail || 0}.`
    );
  };

  const updateMonitoring = (id, updates) => {
    setMonitoringMap((prev) => {
      const next = {
        ...prev,
        [id]: { status: 'menunggu', extraDays: false, ...prev[id], ...updates, updatedAt: new Date().toISOString() }
      };
      saveMonitoringMap(next);
      return next;
    });
  };

  const truncate = (text, limit) => {
    if (!text) return '';
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Data sasaran surat</p>
          <h1 className="text-2xl font-bold text-slate-900">Badan Publik</h1>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="bg-slate-900 text-white px-4 py-3 rounded-xl font-semibold shadow-soft hover:bg-slate-800"
            >
              Import CSV/Excel
            </button>
            <button
              onClick={() => setImportAssignOpen(true)}
              className="bg-emerald-600 text-white px-4 py-3 rounded-xl font-semibold shadow-soft hover:bg-emerald-700"
            >
              Import + Penugasan
            </button>
            <button
              onClick={() => openForm(null)}
              className="bg-primary text-white px-4 py-3 rounded-xl font-semibold shadow-soft hover:bg-emerald-700"
            >
              Tambah Data
            </button>
          </div>
        )}
      </div>

      {isAdmin && selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          <span>{selectedIds.length} data dipilih</span>
          <button
            onClick={handleBulkDelete}
            className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
          >
            Hapus terpilih
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft">
        <div className="flex flex-wrap items-center gap-3 px-4 pt-4 text-sm text-slate-600">
          <span className="text-xs uppercase tracking-[0.08em] text-slate-500">Filter cepat</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEmailFilter('all')}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${
                emailFilter === 'all' ? 'bg-primary text-white border-primary' : 'border-slate-200 text-slate-700'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setEmailFilter('with-email')}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${
                emailFilter === 'with-email' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'border-slate-200 text-slate-700'
              }`}
            >
              Punya email
            </button>
            <button
              onClick={() => setEmailFilter('no-email')}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${
                emailFilter === 'no-email' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'border-slate-200 text-slate-700'
              }`}
            >
              Belum ada email
            </button>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
            {filteredData.length} data sesuai filter
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gradient-to-r from-slate-50 to-white text-slate-600">
              <tr>
                {isAdmin && (
                  <th className="px-3 py-2 text-left w-[42px]">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua"
                      checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th className="px-3 py-2 text-left w-[50px]">No</th>
                <th className="px-3 py-2 text-left w-[28%]">Nama</th>
                <th className="px-3 py-2 text-left w-[14%]">Kategori</th>
                <th className="px-3 py-2 text-left w-[18%]">Email</th>
                <th className="px-3 py-2 text-left w-[18%]">Website</th>
                <th className="px-3 py-2 text-left w-[22%] min-w-[320px]">Pertanyaan</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Tenggat</th>
                <th className="px-3 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={isAdmin ? 10 : 9}>
                    Memuat data...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={isAdmin ? 10 : 9}>
                    Tidak ada data sesuai filter ini.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                  >
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${item.nama_badan_publik}`}
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 text-slate-700">{idx + 1}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{truncate(item.nama_badan_publik, 70)}</td>
                    <td className="px-3 py-2 text-slate-700">{truncate(item.kategori, 16)}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {item.email ? (
                        <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
                          {truncate(item.email, 36)}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs">
                          email kosong
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{truncate(decodeHtml(item.website) || '-', 36)}</td>
                    <td className="px-3 py-2 text-slate-700 whitespace-pre-wrap w-[22%] min-w-[320px] align-top">
                      {truncate(item.pertanyaan || '-', 60)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {(() => {
                        const monitor = monitoringMap[item.id] || {};
                        const info = computeDueInfo({
                          startDate: monitor.startDate,
                          baseDays: 10,
                          extraDays: monitor.extraDays ? 7 : 0,
                          holidays
                        });
                        return (
                          <div className="space-y-2 text-xs text-slate-600">
                            <button
                              onClick={() => updateMonitoring(item.id, { extraDays: !monitor.extraDays })}
                              disabled={!monitor.startDate}
                              className={`text-[11px] px-3 py-1.5 rounded-lg border ${
                                monitor.extraDays
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                              } ${!monitor.startDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {monitor.extraDays ? '+7 hari aktif' : '+7 hari'}
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 space-x-2">
                      <button
                        onClick={() => openForm(item)}
                        className="text-primary font-semibold hover:underline"
                      >
                        Edit
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => deleteData(item.id)}
                          className="text-rose-500 font-semibold hover:underline"
                        >
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-6 space-y-4 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold border border-primary/30">
                  {editingId ? 'Mode Edit' : 'Mode Tambah'}
                  <span className="text-slate-600">{isAdmin ? 'Admin' : 'User'}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingId ? 'Edit Badan Publik' : 'Tambah Badan Publik'}
                </h2>
                <p className="text-sm text-slate-600">
                  Koreksi data (email/website) jika ada yang keliru. Admin bisa menambah entri baru.
                </p>
              </div>
              <button
                onClick={() => setFormOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
                aria-label="Tutup"
              >
                X
              </button>
            </div>

            <form onSubmit={saveForm} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Nama</label>
                  <input
                    required
                    value={formData.nama_badan_publik}
                    onChange={(e) => setFormData({ ...formData, nama_badan_publik: e.target.value })}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Kategori</label>
                  <input
                    required
                    value={formData.kategori}
                    onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">Email</label>
                    <span className="text-[11px] text-slate-400">Boleh dikoreksi user</span>
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    placeholder="nama@domain.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Website</label>
                  <input
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    placeholder="https://"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">Pertanyaan</label>
                  <span className="text-[11px] text-slate-400">Bisa multi-baris</span>
                </div>
                <textarea
                  value={formData.pertanyaan}
                  onChange={(e) => setFormData({ ...formData, pertanyaan: e.target.value })}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm min-h-[120px]"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Status</label>
                  <input
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Thread Id</label>
                  <input
                    value={formData.thread_id}
                    onChange={(e) => setFormData({ ...formData, thread_id: e.target.value })}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    placeholder="Opsional"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-600">
                <span>Tip: User boleh koreksi email/website. Tambah data baru tetap oleh admin.</span>
                <span className="px-2 py-1 rounded-full bg-white border border-slate-200 text-[11px]">
                  {editingId ? `ID #${editingId}` : 'Entri baru'}
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Import CSV/Excel</h2>
                <p className="text-sm text-slate-600">
                  Pilih pemetaan 5 kolom wajib: Nama, Kategori, Email, Website, Pertanyaan. Kolom lain akan diisi
                  default (status pending).
                </p>
              </div>
              <button
                onClick={() => setImportOpen(false)}
                className="text-slate-500 hover:text-slate-800 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Upload file</label>
                <input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleImportFile}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3"
                />
                {importError && (
                  <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {importError}
                  </div>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-800 mb-1">Contoh header</div>
                <pre className="whitespace-pre-wrap text-xs text-slate-600">Nama | Kategori | Email | Website | Pertanyaan</pre>
                <p className="text-xs text-slate-500 mt-2">
                  Pastikan baris pertama adalah header. Pilih kolom yang sesuai di bagian pemetaan.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {importHeaders.length > 0 ? (
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="text-sm font-semibold text-slate-800 mb-2">Pilih kolom untuk 5 field wajib</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {requiredFields.map((f) => (
                      <div key={f.key} className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600">{f.label}</label>
                        <select
                          value={importMapping[f.key] || ''}
                          onChange={(e) =>
                            setImportMapping((prev) => ({
                              ...prev,
                              [f.key]: e.target.value
                            }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                        >
                          <option value="">-- pilih kolom --</option>
                          {importHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Header terdeteksi: {importHeaders.join(' | ')}</p>
                </div>
              ) : (
                <div className="border border-dashed border-slate-300 rounded-xl p-3 text-sm text-slate-600 bg-slate-50">
                  Upload file terlebih dahulu untuk memilih mapping kolom.
                </div>
              )}
              <div className="border-2 border-emerald-200 bg-emerald-50 rounded-xl p-3 shadow-soft">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-bold text-emerald-700 mb-2">
                  Contoh data (dari tabel saat ini)
                </div>
                <table className="w-full text-xs text-slate-700">
                  <thead>
                    <tr>
                      <th className="text-left">Nama</th>
                      <th className="text-left">Kategori</th>
                      <th className="text-left">Email</th>
                      <th className="text-left">Website</th>
                      <th className="text-left">Pertanyaan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samplePreview.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-2 text-slate-500">
                          Belum ada data.
                        </td>
                      </tr>
                    ) : (
                      samplePreview.map((row) => (
                        <tr key={row.id}>
                          <td className="py-1">{row.nama_badan_publik}</td>
                          <td className="py-1">{row.kategori}</td>
                          <td className="py-1">{row.email}</td>
                          <td className="py-1">{decodeHtml(row.website)}</td>
                          <td className="py-1">{truncate(row.pertanyaan, 30)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-2 border-sky-200 bg-sky-50 rounded-xl p-3 shadow-soft">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white border border-sky-200 text-[11px] font-bold text-sky-700 mb-2">
                  Preview file (5 baris pertama)
                </div>
                <table className="w-full text-xs text-slate-700">
                  <thead>
                    <tr>
                      <th className="text-left">Nama</th>
                      <th className="text-left">Kategori</th>
                      <th className="text-left">Email</th>
                      <th className="text-left">Website</th>
                      <th className="text-left">Pertanyaan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-2 text-slate-500">
                          Upload file untuk melihat preview.
                        </td>
                      </tr>
                    ) : (
                      importPreview.slice(0, 3).map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-1">{row.nama_badan_publik}</td>
                          <td className="py-1">{row.kategori}</td>
                          <td className="py-1">{row.email}</td>
                          <td className="py-1">{decodeHtml(row.website)}</td>
                          <td className="py-1">{truncate(row.pertanyaan, 30)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setImportOpen(false)}
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={submitImport}
                className="px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {importAssignOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[96vw] max-w-7xl p-6 space-y-4 max-h-[94vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Import Badan Publik + Penugasan</h2>
                <p className="text-sm text-slate-600">
                  Mapping kolom lengkap agar badan publik langsung ditugaskan. Jika penguji belum ada, badan publik tetap diimport dan status penugasan kosong.
                </p>
              </div>
              <button
                onClick={() => setImportAssignOpen(false)}
                className="text-slate-500 hover:text-slate-800 text-xl font-bold"
              >
                X
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Upload file</label>
                <input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleImportAssignFile}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const csv = buildTemplateCsv();
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = 'template-import-penugasan.csv';
                      link.click();
                      URL.revokeObjectURL(link.href);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs hover:bg-slate-50"
                  >
                    Download Template CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const rows = buildTemplateXlsx();
                      const ws = XLSX.utils.json_to_sheet(rows);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, 'Template');
                      XLSX.writeFile(wb, 'template-import-penugasan.xlsx');
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs hover:bg-slate-50"
                  >
                    Download Template Excel
                  </button>
                </div>
                {importAssignError && (
                  <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {importAssignError}
                  </div>
                )}
                {importAssignSimulated && (
                  <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    {importAssignSimulated}
                  </div>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-800 mb-1">Contoh header</div>
                <pre className="whitespace-pre-wrap text-xs text-slate-600">
                  Nama Badan Publik | KATEGORI | WEBSITE | email | LEMBAGA | pertanyaan | NAMA PENGUJI AKSES | email penguji | no hp
                </pre>
                <p className="text-xs text-slate-500 mt-2">
                  Anda bisa menyesuaikan mapping kolom bila header berbeda.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {importAssignHeaders.length > 0 ? (
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="text-sm font-semibold text-slate-800 mb-2">Pilih kolom sesuai field</div>
                  {['nama_badan_publik', 'kategori'].some((key) => !importAssignMapping[key]) && (
                    <div className="text-xs text-rose-600 mb-2">
                      Field wajib belum lengkap: Nama Badan Publik dan Kategori harus dipilih.
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {assignmentImportFields.map((f) => (
                      <div key={f.key} className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600">{f.label}</label>
                        <select
                          value={importAssignMapping[f.key] || ''}
                          onChange={(e) =>
                            setImportAssignMapping((prev) => ({
                              ...prev,
                              [f.key]: e.target.value
                            }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                        >
                          <option value="">-- pilih kolom --</option>
                          {importAssignHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Header terdeteksi: {importAssignHeaders.join(' | ')}</p>
                </div>
              ) : (
                <div className="border border-dashed border-slate-300 rounded-xl p-3 text-sm text-slate-600 bg-slate-50">
                  Upload file terlebih dahulu untuk memilih mapping kolom.
                </div>
              )}

              {importAssignSummary && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 text-xs text-amber-700 space-y-1">
                  <div className="font-semibold text-amber-800">Ringkasan validasi</div>
                  <div>Total baris: {importAssignSummary.total}</div>
                  <div>Valid (nama & kategori lengkap): {importAssignSummary.valid}</div>
                  <div>Baris belum lengkap (kecuali email badan publik & email penguji): {importAssignSummary.missingRequired}</div>
                  <div>Duplikat email badan publik: {importAssignSummary.duplicateEmail}</div>
                  <div>Nama badan publik sudah ada di database: {importAssignSummary.duplicateName}</div>
                  <div>Email badan publik tidak valid: {importAssignSummary.invalidEmail}</div>
                  <div>Penguji tidak lengkap (nama + no hp): {importAssignSummary.missingAssignee}</div>
                </div>
              )}

              {importAssignIssues.length > 0 && (
                <div className="border border-rose-200 bg-rose-50 rounded-xl p-3 text-xs text-rose-700 space-y-1">
                  <div className="font-semibold text-rose-800">Contoh issue (maks 8 baris)</div>
                  {importAssignIssues.slice(0, 8).map((issue, idx) => (
                    <div key={`${issue.rowIndex}-${idx}`}>
                      Baris {issue.rowIndex}: {issue.message}
                    </div>
                  ))}
                </div>
              )}
              {importAssignSummary?.duplicateName > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 text-xs text-amber-700">
                  Nama badan publik sudah ada di database ({importAssignSummary.duplicateName} baris). Contoh baris:{' '}
                  {(importAssignSummary.duplicateNameRows || []).join(', ') || '-'}
                </div>
              )}

              <div className="border-2 border-sky-200 bg-sky-50 rounded-xl p-3 shadow-soft">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white border border-sky-200 text-[11px] font-bold text-sky-700 mb-2">
                  Preview file (5 baris pertama)
                </div>
                <table className="w-full text-xs text-slate-700">
                  <thead>
                    <tr>
                      <th className="text-left">Nama</th>
                      <th className="text-left">Kategori</th>
                      <th className="text-left">Email</th>
                      <th className="text-left">Website</th>
                      <th className="text-left">Lembaga</th>
                      <th className="text-left">Penguji</th>
                      <th className="text-left">Email Penguji</th>
                      <th className="text-left">No HP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importAssignPreview.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-2 text-slate-500">
                          Upload file untuk melihat preview.
                        </td>
                      </tr>
                    ) : (
                      importAssignPreview.slice(0, 3).map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-1">{row.nama_badan_publik}</td>
                          <td className="py-1">{row.kategori}</td>
                          <td className="py-1">{truncate(row.email, 24)}</td>
                          <td className="py-1">{truncate(decodeHtml(row.website), 24)}</td>
                          <td className="py-1">{truncate(row.lembaga, 18)}</td>
                          <td className="py-1">{truncate(row.nama_penguji, 16)}</td>
                          <td className="py-1">{truncate(row.email_penguji, 24)}</td>
                          <td className="py-1">{truncate(row.no_hp_penguji, 14)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  if (importAssignLoading && importAssignController) {
                    importAssignController.abort();
                    return;
                  }
                  setImportAssignOpen(false);
                }}
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                {importAssignLoading ? 'Batalkan proses' : 'Batal'}
              </button>
              <button
                onClick={simulateImportAssign}
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                disabled={importAssignLoading}
              >
                Simulasi
              </button>
              <button
                onClick={submitImportAssign}
                disabled={importAssignLoading}
                className="px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 disabled:opacity-60"
              >
                {importAssignLoading ? 'Memproses...' : 'Import + Penugasan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={clearToast} />
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        tone={confirmDialog.tone}
        loading={confirmDialog.loading || forceDeleting || importAssignLoading}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
};

export default BadanPublik;
