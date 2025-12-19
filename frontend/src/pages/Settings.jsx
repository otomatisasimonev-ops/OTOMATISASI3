import { useState } from 'react';
import { useSmtp } from '../context/SmtpContext';
import api from '../services/api';
import SmtpModal from '../components/SmtpModal';

const steps = [
  'Aktifkan 2-Step Verification di Google Account.',
  'Buat App Password: Security > App Passwords > pilih “Mail” dan device “Other”, simpan 16 digit.',
  'Aktifkan IMAP (Settings Gmail > See all settings > Forwarding and POP/IMAP > Enable IMAP). POP3 opsional.',
  'Masukkan Email + App Password ke form SMTP di sini.',
  'Simpan. Indikator di navbar berubah hijau jika berhasil.'
];

const Settings = () => {
  const { hasConfig } = useSmtp();
  const [open, setOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordMessage('Password lama dan baru wajib diisi.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage('Konfirmasi password tidak cocok.');
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await api.patch('/users/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordMessage(res.data?.message || 'Password berhasil diperbarui.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordMessage(err.response?.data?.message || 'Gagal memperbarui password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Pengaturan kredensial</p>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        </div>
        <span
          className={`px-3 py-2 rounded-full text-xs font-semibold ${
            hasConfig ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {hasConfig ? 'SMTP siap' : 'SMTP belum diisi'}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">SMTP Gmail</h2>
            <p className="text-sm text-slate-500">
              SMTP (Simple Mail Transfer Protocol) adalah jalur pengiriman email. Kita perlu App Password karena
              Gmail melarang password biasa untuk aplikasi pihak ketiga.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="bg-primary text-white px-4 py-3 rounded-xl font-semibold shadow-soft hover:bg-emerald-700"
          >
            {hasConfig ? 'Perbarui SMTP' : 'Tambah SMTP'}
          </button>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="text-sm font-semibold text-slate-800 mb-2">Langkah singkat</div>
          <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="text-xs text-slate-500 mt-2">
            Catatan: POP/IMAP hanya untuk menerima email; kita butuh IMAP aktif agar koneksi SMTP Gmail diizinkan.
          </p>
        </div>
        <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
          <li>Setiap user punya SMTP sendiri; admin tidak berbagi kredensial.</li>
          <li>Jika gagal, cek 16 digit App Password dan pastikan IMAP aktif.</li>
          <li>Indikator di navbar akan hijau jika SMTP tersimpan.</li>
          <li>Kredensial dan KTP hanya dipakai untuk proses pengiriman; jangan bagikan ke luar sistem.</li>
        </ul>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-soft space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ganti Password</h2>
          <p className="text-sm text-slate-500">Gunakan password baru untuk login berikutnya.</p>
        </div>
        {passwordMessage && (
          <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
            {passwordMessage}
          </div>
        )}
        <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-700">Password lama</label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Password lama"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Password baru</label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Password baru"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Konfirmasi password</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ulangi password baru"
              autoComplete="new-password"
            />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={passwordLoading}
              className="px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 disabled:opacity-60"
            >
              {passwordLoading ? 'Memproses...' : 'Perbarui Password'}
            </button>
          </div>
        </form>
      </div>
      <SmtpModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

export default Settings;
