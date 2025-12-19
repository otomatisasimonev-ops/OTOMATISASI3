import { useEffect, useState } from 'react';
import { useSmtp } from '../context/SmtpContext';
import api from '../services/api';

const SmtpModal = ({ open, onClose }) => {
  const { setHasConfig, checkConfig } = useSmtp();
  const [emailAddress, setEmailAddress] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [imapTesting, setImapTesting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info');
  const [smtpOk, setSmtpOk] = useState(false);
  const [imapOk, setImapOk] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState('');
  const [imapMsg, setImapMsg] = useState('');

  const statusChip = (label, ok) => (
    <span
      className={`text-[11px] px-2 py-1 rounded-full border ${
        ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
      }`}
    >
      {ok ? `${label} OK` : `${label} belum dicek`}
    </span>
  );

  useEffect(() => {
    if (!open) {
      setEmailAddress('');
      setAppPassword('');
      setFeedback('');
      setFeedbackType('info');
      setSmtpOk(false);
      setImapOk(false);
      setSmtpMsg('');
      setImapMsg('');
    }
  }, [open]);

  const verifySmtp = async (silent = false) => {
    setSmtpOk(false);
    if (!emailAddress || !appPassword) {
      if (!silent) {
        setFeedbackType('error');
        setFeedback('Isi email dan app password terlebih dulu.');
      }
      return { ok: false, msg: 'SMTP: Email dan App Password wajib diisi.', source: 'smtp' };
    }
    setTesting(true);
    if (!silent) {
      setFeedback('');
      setFeedbackType('info');
    }
    try {
      const res = await api.post('/config/smtp/verify', {
        email_address: emailAddress,
        app_password: appPassword
      });
      const msg = res.data?.message || 'SMTP valid. Siap digunakan.';
      if (!silent) {
        setFeedbackType('success');
        setFeedback(`SMTP: ${msg}`);
      }
      setSmtpOk(true);
      setSmtpMsg(`SMTP: ${msg}`);
      return { ok: true, msg: `SMTP: ${msg}`, source: 'smtp' };
    } catch (err) {
      const rawMsg = err.response?.data?.message || '';
      const isAuthErr = err.response?.data?.code === 'EAUTH' || rawMsg.includes('535-5.7.8');
      const msg = isAuthErr
        ? 'SMTP: Login Gmail ditolak (535). Pastikan pakai 16 digit App Password, 2-Step Verification aktif, dan IMAP di-enable. Bukan password biasa.'
        : `SMTP: ${rawMsg || 'SMTP tidak valid. Periksa email + App Password Gmail, pastikan 2FA & IMAP aktif.'}`;
      if (!silent) {
        setFeedbackType('error');
        setFeedback(msg);
      }
      setSmtpOk(false);
      setSmtpMsg(msg);
      return { ok: false, msg, source: 'smtp' };
    } finally {
      setTesting(false);
    }
  };

  const verifyImap = async (silent = false) => {
    setImapOk(false);
    if (!emailAddress || !appPassword) {
      if (!silent) {
        setFeedbackType('error');
        setFeedback('Isi email dan app password terlebih dulu.');
      }
      return { ok: false, msg: 'IMAP: Email dan App Password wajib diisi.', source: 'imap' };
    }
    setImapTesting(true);
    if (!silent) {
      setFeedback('');
      setFeedbackType('info');
    }
    try {
      const res = await api.post('/config/imap/verify', {
        email_address: emailAddress,
        app_password: appPassword
      });
      const msg = `IMAP: ${res.data?.message || 'IMAP aktif dan bisa diakses.'}`;
      if (!silent) {
        setFeedbackType('success');
        setFeedback(msg);
      }
      setImapOk(true);
      setImapMsg(msg);
      return { ok: true, msg, source: 'imap' };
    } catch (err) {
      const status = err.response?.status;
      const serverMsg = err.response?.data?.message;
      const msg =
        status === 404
          ? 'IMAP: Server belum menyediakan endpoint cek otomatis. Aktifkan manual di Gmail: Settings > See all settings > Forwarding and POP/IMAP > Enable IMAP.'
          : `IMAP: ${serverMsg || err.message || 'IMAP belum aktif atau gagal diuji. Aktifkan di Gmail: Settings > See all settings > Forwarding and POP/IMAP > Enable IMAP.'}`;
      if (!silent) {
        setFeedbackType('error');
        setFeedback(msg);
      }
      setImapOk(false);
      setImapMsg(msg);
      return { ok: false, msg, source: 'imap' };
    } finally {
      setImapTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!smtpOk || !imapOk) {
      setFeedbackType('error');
      setFeedback('Cek SMTP dan IMAP dulu sampai sukses sebelum simpan.');
      return;
    }
    setSaving(true);
    setFeedback('');
    setFeedbackType('info');
    try {
      const smtp = await verifySmtp(true);
      const imap = await verifyImap(true);
      if (!smtp.ok || !imap.ok) {
        setFeedbackType('error');
        const messages = [smtp.ok ? null : smtp.msg, imap.ok ? null : imap.msg].filter(Boolean).join(' | ');
        setFeedback(messages || 'Verifikasi gagal.');
        setSaving(false);
        return;
      }
      await api.post('/config/smtp', {
        email_address: emailAddress,
        app_password: appPassword
      });
      setFeedbackType('success');
      setFeedback(`${smtp.msg}. ${imap.msg || 'IMAP terverifikasi.'} Kredensial tersimpan. Indikator akan berubah hijau.`);
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
              Gunakan Email + App Password (bukan password biasa). Pastikan IMAP Gmail sudah diaktifkan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition text-xl font-bold"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">Email</label>
              {statusChip('SMTP', smtpOk)}
            </div>
            <input
              type="email"
              required
              value={emailAddress}
              onChange={(e) => {
                setEmailAddress(e.target.value);
                setSmtpOk(false);
                setImapOk(false);
              }}
              autoComplete="username"
              className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="nama@gmail.com"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">App Password</label>
              {statusChip('IMAP', imapOk)}
            </div>
            <input
              type="password"
              required
              value={appPassword}
              onChange={(e) => {
                setAppPassword(e.target.value);
                setSmtpOk(false);
                setImapOk(false);
              }}
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
                feedbackType === 'error'
                  ? 'text-rose-600'
                  : feedbackType === 'success'
                  ? 'text-emerald-700'
                  : 'text-primary'
              } bg-slate-50 border border-slate-200 rounded-xl px-3 py-2`}
            >
              {feedback}
            </div>
          )}
          <div className="flex flex-col gap-2 text-xs">
            {smtpMsg && (
              <div
                className={`px-3 py-2 rounded-lg border ${
                  smtpOk ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {smtpMsg}
              </div>
            )}
            {imapMsg && (
              <div
                className={`px-3 py-2 rounded-lg border ${
                  imapOk ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {imapMsg}
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={verifyImap}
              disabled={saving || imapTesting}
              className={`px-4 py-3 rounded-xl border ${
                imapOk
                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              } disabled:opacity-60`}
            >
              {imapTesting ? 'Menguji IMAP...' : imapOk ? 'IMAP OK' : 'Cek IMAP'}
            </button>
            <button
              type="button"
              onClick={verifySmtp}
              disabled={saving || testing}
              className={`px-4 py-3 rounded-xl border ${
                smtpOk
                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              } disabled:opacity-60`}
            >
              {testing ? 'Menguji...' : smtpOk ? 'SMTP OK' : 'Cek SMTP'}
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
              disabled={saving || !smtpOk || !imapOk}
              className="px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : smtpOk && imapOk ? 'Verifikasi & Simpan' : 'Cek dulu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SmtpModal;
