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

const expectedHeaders = [
  'Nama Badan Publik',
  'Kategori',
  'Website',
  'Pertanyaan',
  'Email',
  'Status',
  'Thread Id'
];
const optionalHeaders = ['Email'];
const requiredHeaders = expectedHeaders.filter((h) => !optionalHeaders.includes(h));

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
  const [importError, setImportError] = useState('');
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

  const samplePreview = useMemo(() => data.slice(0, 5), [data]);
  const filteredData = useMemo(() => {
    if (emailFilter === 'with-email') return data.filter((d) => d.email);
    if (emailFilter === 'no-email') return data.filter((d) => !d.email);
    return data;
  }, [data, emailFilter]);

  const openForm = (item) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        nama_badan_publik: item.nama_badan_publik,
        kategori: item.kategori,
        email: item.email,
        website: item.website || '',
        pertanyaan: item.pertanyaan || '',
        status: item.status,
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
    if (!confirm('Hapus data ini?')) return;
    try {
      await api.delete(`/badan-publik/${id}`);
      setStatusMessage('Data dihapus.');
      fetchData();
    } catch (err) {
      setStatusMessage(err.response?.data?.message || 'Gagal menghapus data');
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportPreview([]);
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
      const normalizedHeader = header.map((h) => h.toLowerCase());
      const normalizedRequired = requiredHeaders.map((h) => h.toLowerCase());

      const headerValid =
        normalizedHeader.length >= normalizedRequired.length &&
        normalizedRequired.every((h) => normalizedHeader.includes(h));

      if (!headerValid) {
        setImportError('Struktur header tidak sesuai. Ikuti contoh template. Kolom Email opsional.');
        return;
      }

      const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell));
      const objs = dataRows.map((r) => {
        const map = Object.fromEntries(header.map((h, idx) => [h, r[idx]]));
        const email = String(map['Email'] ?? '').trim();
        return {
          nama_badan_publik: String(map['Nama Badan Publik'] ?? '').trim(),
          kategori: String(map['Kategori'] ?? '').trim(),
          website: String(map['Website'] ?? '').trim(),
          pertanyaan: String(map['Pertanyaan'] ?? '').trim(),
          email,
          status: String(map['Status'] ?? '').trim() || 'pending',
          thread_id: String(map['Thread Id'] ?? '').trim()
        };
      });

      setImportPreview(objs.slice(0, 5));
    } catch (err) {
      console.error(err);
      setImportError('Gagal membaca file. Pastikan format CSV/XLSX.');
    }
  };

  const submitImport = async () => {
    if (importPreview.length === 0) {
      setImportError('Tidak ada data untuk diimport.');
      return;
    }
    try {
      const payloadRecords = importPreview.map((r) => {
        const clean = { ...r };
        if (!clean.email) {
          delete clean.email;
        }
        return clean;
      });
      await api.post('/badan-publik/import', { records: payloadRecords });
      setImportError('');
      setImportOpen(false);
      setStatusMessage(`Import berhasil (${importPreview.length} data contoh; total mengikuti file).`);
      fetchData();
    } catch (err) {
      setImportError(err.response?.data?.message || 'Gagal import data');
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
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 to-white text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left w-[28%]">Nama</th>
                <th className="px-4 py-3 text-left w-[14%]">Kategori</th>
                <th className="px-4 py-3 text-left w-[18%]">Email</th>
                <th className="px-4 py-3 text-left w-[18%]">Website</th>
                <th className="px-4 py-3 text-left w-[22%] min-w-[320px]">Pertanyaan</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Tenggat</th>
                {isAdmin && <th className="px-4 py-3 text-left">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={isAdmin ? 8 : 7}>
                    Memuat data...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={isAdmin ? 8 : 7}>
                    Tidak ada data sesuai filter ini.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">{truncate(item.nama_badan_publik, 70)}</td>
                    <td className="px-4 py-3 text-slate-700">{truncate(item.kategori, 16)}</td>
                    <td className="px-4 py-3 text-slate-700">
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
                    <td className="px-4 py-3 text-slate-700">{truncate(item.website || '-', 36)}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-pre-wrap w-[22%] min-w-[320px] align-top">
                      {truncate(item.pertanyaan || '-', 60)}
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-slate-700">
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
                    {isAdmin && (
                      <td className="px-4 py-3 space-x-2">
                        <button
                          onClick={() => openForm(item)}
                          className="text-primary font-semibold hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteData(item.id)}
                          className="text-rose-500 font-semibold hover:underline"
                        >
                          Hapus
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? 'Edit Badan Publik' : 'Tambah Badan Publik'}
              </h2>
              <button
                onClick={() => setFormOpen(false)}
                className="text-slate-500 hover:text-slate-800 text-xl font-bold"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <form onSubmit={saveForm} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="text-sm font-semibold text-slate-700">Nama</label>
                <input
                  required
                  value={formData.nama_badan_publik}
                  onChange={(e) => setFormData({ ...formData, nama_badan_publik: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="col-span-1">
                <label className="text-sm font-semibold text-slate-700">Kategori</label>
                <input
                  required
                  value={formData.kategori}
                  onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="col-span-1">
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="col-span-1">
                <label className="text-sm font-semibold text-slate-700">Website</label>
                <input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-semibold text-slate-700">Pertanyaan</label>
                <textarea
                  value={formData.pertanyaan}
                  onChange={(e) => setFormData({ ...formData, pertanyaan: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                />
              </div>
              <div className="col-span-1">
                <label className="text-sm font-semibold text-slate-700">Status</label>
                <input
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="col-span-1">
                <label className="text-sm font-semibold text-slate-700">Thread Id</label>
                <input
                  value={formData.thread_id}
                  onChange={(e) => setFormData({ ...formData, thread_id: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Import CSV/Excel</h2>
                <p className="text-sm text-slate-600">
                  Ikuti struktur header: {expectedHeaders.join(', ')}. Kolom Email opsional/ boleh kosong.
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
                <pre className="whitespace-pre-wrap text-xs text-slate-600">
                  {expectedHeaders.join(' | ')}
                </pre>
                <p className="text-xs text-slate-500 mt-2">
                  Pastikan baris pertama adalah header. Preview di bawah menampilkan 5 data pertama (biasanya termasuk header).
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-emerald-200 bg-emerald-50 rounded-xl p-3 shadow-soft">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-bold text-emerald-700 mb-2">
                  Contoh data (dari tabel saat ini)
                </div>
                <table className="w-full text-xs text-slate-700">
                  <thead>
                    <tr>
                      <th className="text-left">Nama</th>
                      <th className="text-left">Email</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samplePreview.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-2 text-slate-500">
                          Belum ada data.
                        </td>
                      </tr>
                    ) : (
                      samplePreview.map((row) => (
                        <tr key={row.id}>
                          <td className="py-1">{row.nama_badan_publik}</td>
                          <td className="py-1">{row.email}</td>
                          <td className="py-1">{row.status}</td>
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
                      <th className="text-left">Email</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-2 text-slate-500">
                          Upload file untuk melihat preview.
                        </td>
                      </tr>
                    ) : (
                      importPreview.slice(0, 5).map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-1">{row.nama_badan_publik}</td>
                          <td className="py-1">{row.email}</td>
                          <td className="py-1">{row.status}</td>
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
    </div>
  );
};

export default BadanPublik;
