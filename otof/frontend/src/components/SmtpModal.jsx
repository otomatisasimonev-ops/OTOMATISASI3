import { useEffect, useState } from 'react';
import { useSmtp } from '../context/SmtpContext';
import api from '../services/api';

const SmtpModal = ({ open, onClose }) => {
  const { setHasConfig, checkConfig } = useSmtp();
  const [emailAddress, setEmailAddress] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info');

  useEffect(() => {
    if (!open) {
      setEmailAddress('');
      setAppPassword('');
      setFeedback('');
      setFeedbackType('info');
    }
  }, [open]);

  const verifySmtp = async () => {
    if (!emailAddress || !appPassword) {
      setFeedbackType('error');
      setFeedback('Isi email dan app password terlebih dulu.');
      return false;
    }
    setTesting(true);
    setFeedback('');
    setFeedbackType('info');
    try {
      const res = await api.post('/config/smtp/verify', {
        email_address: emailAddress,
        app_password: appPassword
      });
      setFeedbackType('success');
      setFeedback(res.data?.message || 'SMTP valid. Siap digunakan.');
      return true;
    } catch (err) {
      setFeedbackType('error');
      setFeedback(
        err.response?.data?.message ||
          'SMTP tidak valid. Periksa email + App Password Gmail, pastikan 2FA & IMAP aktif.'
      );
      return false;
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback('');
    setFeedbackType('info');
    try {
      const ok = await verifySmtp();
      if (!ok) {
        setSaving(false);
        return;
      }
      await api.post('/config/smtp', {
        email_address: emailAddress,
        app_password: appPassword
      });
      setFeedbackType('success');
      setFeedback('SMTP valid dan tersimpan. Indikator akan berubah hijau.');
      setHasConfig(true);
      await checkConfig();
      setTimeout(onClose, 800);
    } catch (err) {
      setFeedbackType('error');
      setFeedback(err.response?.data?.message || 'Gagal memverifikasi atau menyimpan SMTP');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Setel SMTP Gmail</h2>
            <p className="text-sm text-slate-500">
              Gunakan Email + App Password (bukan password biasa).
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition text-xl font-bold"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <input
              type="email"
              required
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              autoComplete="username"
              className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="nama@gmail.com"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">App Password</label>
            <input
              type="password"
              required
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="16 digit app password"
            />
            <p className="text-xs text-slate-500 mt-1">
              Buat di Google Account &gt; Security &gt; App Passwords.
            </p>
          </div>
          {feedback && (
            <div
              className={`text-sm ${
                feedbackType === 'error' ? 'text-rose-600' : 'text-primary'
              }`}
            >
              {feedback}
            </div>
          )}
          <div className="flex justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={verifySmtp}
              disabled={saving || testing}
              className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {testing ? 'Menguji...' : 'Cek SMTP'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? 'Verifikasi & Simpan...' : 'Verifikasi & Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SmtpModal;
