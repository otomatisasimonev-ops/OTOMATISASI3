import { useState } from 'react';
import { useSmtp } from '../context/SmtpContext';
import SmtpModal from '../components/SmtpModal';

const Settings = () => {
  const { hasConfig } = useSmtp();
  const [open, setOpen] = useState(false);

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
              Simpan email dan app password pribadi untuk mengirim kampanye.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="bg-primary text-white px-4 py-3 rounded-xl font-semibold shadow-soft hover:bg-emerald-700"
          >
            {hasConfig ? 'Perbarui SMTP' : 'Tambah SMTP'}
          </button>
        </div>
        <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
          <li>Pastikan 2FA aktif lalu buat App Password di Google Account.</li>
          <li>Setiap user memiliki SMTP masing-masing, tidak dibagikan.</li>
          <li>Indikator di navbar akan hijau jika SMTP tersimpan.</li>
        </ul>
      </div>
      <SmtpModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

export default Settings;
