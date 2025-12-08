import { useAuth } from '../context/AuthContext';
import { useSmtp } from '../context/SmtpContext';

const Navbar = ({ onOpenSmtp }) => {
  const { user, logout } = useAuth();
  const { hasConfig, loading } = useSmtp();

  const indicatorColor = hasConfig ? 'bg-emerald-500' : 'bg-rose-500';
  const indicatorLabel = hasConfig ? 'SMTP Siap' : 'SMTP Belum Siap';

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="flex items-center gap-3">
        <div
          onClick={onOpenSmtp}
          className="flex items-center gap-2 cursor-pointer group select-none"
          title="Klik untuk mengatur SMTP"
        >
          <span
            className={`w-3 h-3 rounded-full ${indicatorColor} shadow-inner transition`}
            aria-label={indicatorLabel}
          />
          <span className="text-sm font-semibold text-slate-700 group-hover:text-primary transition">
            {loading ? 'Mengecek SMTP...' : indicatorLabel}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex flex-col text-right">
          <span className="text-sm font-semibold text-slate-800">{user?.username}</span>
          <span className="text-xs text-slate-500 capitalize">{user?.role}</span>
        </div>
        <button
          onClick={logout}
          className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition"
        >
          Keluar
        </button>
      </div>
    </header>
  );
};

export default Navbar;
