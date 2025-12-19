import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import api from '../services/api';

const baseLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/badan-publik', label: 'Data Badan Publik', icon: 'database' },
  { to: '/history', label: 'History Log', icon: 'clock' },
  { to: '/kalender', label: 'Kalender Libur', icon: 'calendar' },
  { to: '/templates', label: 'Edit Template', icon: 'template' },
  { to: '/settings', label: 'Pengaturan', icon: 'settings' },
  { to: '/tentang', label: 'Tentang', icon: 'info' }
];

const adminLinks = [
  { to: '/penugasan', label: 'Penugasan', icon: 'clipboard' },
  { to: '/admin/laporan/uji-akses', label: 'Laporan Uji Akses', icon: 'report' },
  { to: '/users', label: 'Tambah User', icon: 'users' }
];

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [pendingQuota, setPendingQuota] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      if (user?.role !== 'admin') {
        setPendingQuota(0);
        return;
      }
      try {
        const res = await api.get('/quota/requests');
        const pending = (res.data || []).filter((r) => r.status === 'pending').length;
        setPendingQuota(pending);
      } catch (err) {
        setPendingQuota(0);
      }
    };

    const onRefreshEvent = () => fetchPending();
    const onVisibility = () => {
      if (!document.hidden) fetchPending();
    };

    fetchPending();
    window.addEventListener('quota-requests-updated', onRefreshEvent);
    window.addEventListener('focus', onRefreshEvent);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('quota-requests-updated', onRefreshEvent);
      window.removeEventListener('focus', onRefreshEvent);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user?.role, location.pathname]);

  const links =
    user?.role === 'admin'
      ? [
          ...baseLinks.slice(0, 1),
          { to: '/laporan/uji-akses', label: 'Laporan Uji Akses (Saya)', icon: 'report' },
          ...baseLinks.slice(1, 4),
          ...adminLinks,
          ...baseLinks.slice(4)
        ]
      : [...baseLinks.slice(0, 1), { to: '/laporan/uji-akses', label: 'Laporan Uji Akses', icon: 'report' }, ...baseLinks.slice(1)];

  const renderIcon = (name) => {
    const base = 'w-5 h-5 stroke-current';
    switch (name) {
      case 'home':
        return (
          <svg className={base} fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5a.5.5 0 0 1-.5-.5V15h-4v5.5a.5.5 0 0 1-.5.5H5a1 1 0 0 1-1-1v-9.5Z" />
          </svg>
        );
      case 'database':
        return (
          <svg className={base} fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
            <ellipse cx="12" cy="6" rx="7" ry="3" />
            <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
            <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
          </svg>
        );
      case 'clock':
        return (
          <svg className={base} fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        );
      case 'template':
        return (
          <svg className={base} fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M4 9h16M9 4v16" />
          </svg>
        );
      case 'calendar':
        return (
          <svg className={base} fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M8 3v4M16 3v4M4 10h16" />
          </svg>
        );
      case 'settings':
        return (
          <svg className={base} fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
            <path d="M3 12h2m14 0h2M12 3v2m0 14v2m8.2-4.2-1.4-1.4M5.2 6.2 3.8 4.8m16.4 0-1.4 1.4M5.2 17.8 3.8 19.2" />
          </svg>
        );
      case 'clipboard':
        return (
          <svg className={base} fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M9 4h6a2 2 0 0 1 2 2v14H7V6a2 2 0 0 1 2-2Z" />
            <path d="M9 2.5h6v3H9z" />
            <path d="M9 10h6M9 14h4" />
          </svg>
        );
      case 'users':
        return (
          <svg className={base} fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="9" cy="8" r="3" />
            <path d="M3 19a6 6 0 0 1 12 0" />
            <circle cx="17" cy="9" r="2" />
            <path d="M14.5 17a4.5 4.5 0 0 1 6 0" />
          </svg>
        );
      case 'info':
        return (
          <svg className={base} fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8.5h.01M11 11h2v5h-2z" />
          </svg>
        );
      case 'report':
        return (
          <svg className={base} fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M7 3h7l3 3v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
            <path d="M14 3v4h4" />
            <path d="M9 11h8M9 15h8M9 19h6" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white/90 backdrop-blur border-r border-slate-200 shadow-soft">
      <div className="px-6 py-6">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Portal Keterbukaan Informasi"
            className="h-10 w-auto max-w-[340px] object-contain"
          />
        </div>
      </div>
      <nav className="px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-120px)] pb-6">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${isActive
                ? 'bg-primary text-white shadow-soft'
                : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            <span className="text-slate-500">{renderIcon(item.icon)}</span>
            <span className="text-sm flex-1">{item.label}</span>
            {item.to === '/penugasan' && pendingQuota > 0 && location.pathname !== '/penugasan' && (
              <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_0_6px_rgba(248,113,113,0.2)]" />
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
