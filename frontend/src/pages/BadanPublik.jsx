import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { computeDueInfo } from '../utils/workdays';
import { getMonitoringMap, saveMonitoringMap } from '../utils/monitoring';
import { fetchHolidays } from '../services/holidays';

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

const BadanPublik = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
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
      setStatusMessage('Hanya admin yang bisa menambah data baru.');
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
      setStatusMessage('Hanya admin yang bisa menambah data baru.');
      return;
    }
    try {
      if (editingId) {
        await api.put(`/badan-publik/${editingId}`, formData);
        setStatusMessage('Data diperbarui.');
      } else {
        await api.post('/badan-publik', formData);
        setStatusMessage('Data ditambahkan.');
      }
      setFormOpen(false);
      fetchData();
    } catch (err) {
      setStatusMessage(err.response?.data?.message || 'Gagal menyimpan data');
    }
  };

  const deleteData = async (id) => {
    if (!isAdmin) {
      setStatusMessage('Akses ditolak: hanya admin yang bisa menghapus data.');
      return;
    }
    if (!confirm('Hapus data ini?')) return;
    try {
      await api.delete(`/badan-publik/${id}`);
      setStatusMessage('Data dihapus.');
      fetchData();
    } catch (err) {
      setStatusMessage(err.response?.data?.message || 'Gagal menghapus data');
    }
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

  const handleBulkDelete = async () => {
    if (!isAdmin) {
      setStatusMessage('Akses ditolak: hanya admin yang bisa menghapus data.');
      return;
    }
    if (selectedIds.length === 0) {
      setStatusMessage('Pilih minimal satu data untuk dihapus.');
      return;
    }
    if (!confirm(`Hapus ${selectedIds.length} data badan publik?`)) return;
    try {
      const res = await api.post('/badan-publik/bulk-delete', { ids: selectedIds });
      setStatusMessage(res.data?.message || `Berhasil menghapus ${selectedIds.length} data.`);
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      setStatusMessage(err.response?.data?.message || 'Gagal menghapus data terpilih');
    }
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
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
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
        obj[f.key] = String(rowMap[selectedHeader] ?? '').trim();
      });
      return obj;
    });

  useEffect(() => {
    if (!importAssignRows.length) return;
    const previewObjs = buildAssignPreview(importAssignRows, importAssignHeaders, importAssignMapping);
    setImportAssignPreview(previewObjs.slice(0, 5));
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
      setStatusMessage(`Import berhasil (${payloadRecords.length} data).`);
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
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
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

    const mapped = buildAssignPreview(importAssignRows, importAssignHeaders, importAssignMapping);
    try {
      setImportAssignLoading(true);
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
      const res = await api.post('/badan-publik/import-assign', { records: payloadRecords });
      setImportAssignError('');
      setImportAssignOpen(false);
      setStatusMessage(res.data?.message || `Import berhasil (${payloadRecords.length} data).`);
      setImportAssignHeaders([]);
      setImportAssignRows([]);
      setImportAssignPreview([]);
      const resetMap = {};
      assignmentImportFields.forEach((f) => (resetMap[f.key] = ''));
      setImportAssignMapping(resetMap);
      fetchData();
    } catch (err) {
      setImportAssignError(err.response?.data?.message || 'Gagal import + penugasan');
    } finally {
      setImportAssignLoading(false);
    }
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

      {statusMessage && (
        <div className="p-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-700">{statusMessage}</div>
      )}

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
                    <td className="px-3 py-2 text-slate-700">{truncate(item.website || '-', 36)}</td>
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
                          <td className="py-1">{row.website}</td>
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
                          <td className="py-1">{row.website}</td>
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
                {importAssignError && (
                  <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {importAssignError}
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
                          <td className="py-1">{truncate(row.website, 24)}</td>
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
                onClick={() => setImportAssignOpen(false)}
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
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
    </div>
  );
};

export default BadanPublik;
