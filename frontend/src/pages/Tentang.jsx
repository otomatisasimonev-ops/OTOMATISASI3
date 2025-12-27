import { useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const Tentang = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const title = 'COMING SOON';

  const [resetOpen, setResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const canReset = useMemo(
    () => confirmText.trim().toLowerCase() === 'saya yakin',
    [confirmText]
  );

  const handleReset = async () => {
    if (!canReset || resetting) return;
    setResetting(true);
    setResetMessage('');
    try {
      const res = await api.post('/config/reset');
      setResetMessage(res.data?.message || 'Reset database berhasil.');
      setConfirmText('');
      setResetOpen(false);
    } catch (err) {
      setResetMessage(err.response?.data?.message || 'Reset database gagal.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-[100vh] bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-12">
        <div className="text-center space-y-6">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Tentang</div>
          <div
            className="font-black leading-tight text-slate-900"
            style={{
              fontSize: 'min(22vw, 260px)',
              fontFamily: '"Unbounded", "Playfair Display", "Copperplate", serif',
              letterSpacing: '-0.04em'
            }}
          >
            {title}
          </div>
          <p
            className="text-sm text-slate-600 font-medium"
            style={{ fontFamily: '"Didot", "Copperplate", "Fugaz One", serif' }}
          >
            Segera hadir sesuatu yang lebih besar.
          </p>
        </div>

        {isAdmin && (
          <div className="bg-white border border-rose-200 rounded-3xl shadow-soft p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold border border-rose-200">
                  Reset Sistem
                </div>
                <h2 className="text-lg font-bold text-slate-900">Hapus semua data</h2>
                <p className="text-sm text-slate-600 max-w-2xl">
                  Menghapus seluruh data di database kecuali user admin. Tindakan ini tidak bisa dibatalkan.
                </p>
              </div>
              <button
                onClick={() => {
                  setResetMessage('');
                  setConfirmText('');
                  setResetOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold shadow-soft hover:bg-rose-700"
              >
                Reset Database
              </button>
            </div>
            {resetMessage && (
              <div className="mt-4 text-sm font-semibold text-slate-700">{resetMessage}</div>
            )}
          </div>
        )}
      </div>

      {resetOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 border border-rose-100 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-rose-500 font-semibold">Peringatan Keras</p>
              <h3 className="text-xl font-bold text-slate-900">Reset semua data</h3>
              <p className="text-sm text-slate-600 mt-2">
                Semua data akan dihapus permanen, termasuk badan publik, penugasan, log, kuota, SMTP, dan laporan.
                User admin akan tetap tersimpan.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Ketik <span className="text-rose-600">saya yakin</span> untuk konfirmasi
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="saya yakin"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setResetOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                disabled={resetting}
              >
                Batal
              </button>
              <button
                onClick={handleReset}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold shadow-soft hover:bg-rose-700 disabled:opacity-50"
                disabled={!canReset || resetting}
              >
                {resetting ? 'Memproses...' : 'Ya, reset sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tentang;
