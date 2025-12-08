import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  nama_badan_publik: '',
  kategori: '',
  email: '',
  website: '',
  pertanyaan: '',
  status: 'pending'
};

const BadanPublik = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

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

  const openForm = (item) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        nama_badan_publik: item.nama_badan_publik,
        kategori: item.kategori,
        email: item.email,
        website: item.website || '',
        pertanyaan: item.pertanyaan || '',
        status: item.status
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Data sasaran surat</p>
          <h1 className="text-2xl font-bold text-slate-900">Badan Publik</h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => openForm(null)}
            className="bg-primary text-white px-4 py-3 rounded-xl font-semibold shadow-soft hover:bg-emerald-700"
          >
            Tambah Data
          </button>
        )}
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-700">{statusMessage}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 to-white text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Website</th>
                <th className="px-4 py-3 text-left w-[420px]">Pertanyaan</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Sent</th>
                {isAdmin && <th className="px-4 py-3 text-left">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={isAdmin ? 7 : 6}>
                    Memuat data...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={isAdmin ? 7 : 6}>
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                data.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.nama_badan_publik}</td>
                    <td className="px-4 py-3 text-slate-700">{item.kategori}</td>
                    <td className="px-4 py-3 text-slate-700">{item.email}</td>
                    <td className="px-4 py-3 text-slate-700">{item.website || '-'}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-3xl whitespace-pre-wrap">{item.pertanyaan || '-'}</td>
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
                    <td className="px-4 py-3 text-slate-700">{item.sent_count}</td>
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
    </div>
  );
};

export default BadanPublik;
