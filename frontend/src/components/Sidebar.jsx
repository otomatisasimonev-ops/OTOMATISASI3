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
  { to: '/admin/uji-akses/pertanyaan', label: 'Pertanyaan Uji Akses', icon: 'report' },
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
    <aside className="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-white via-white to-sand-50/80 backdrop-blur-xl border-r border-slate-200/60 shadow-[4px_0_24px_-2px_rgba(15,118,110,0.08)]">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-secondary/[0.03] pointer-events-none" />

      {/* Logo Section */}
      <div className="relative px-6 py-6 border-b border-slate-100/80">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Portal Keterbukaan Informasi"
            className="h-10 w-auto max-w-[340px] object-contain drop-shadow-sm"
          />
        </div>
        {/* Subtle accent line */}
        <div className="absolute bottom-0 left-6 right-6 h-[2px] bg-gradient-to-r from-primary/40 via-secondary/30 to-transparent rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="relative px-3 py-4 space-y-1 overflow-y-auto max-h-[calc(100vh-120px)] pb-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {links.map((item, index) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${isActive
                ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg shadow-primary/25 scale-[1.02]'
                : 'text-slate-600 hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100/80 hover:text-slate-900 hover:shadow-sm'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/90 rounded-r-full shadow-sm" />
                )}

                {/* Icon with dynamic styling */}
                <span className={`flex-shrink-0 transition-colors duration-200 ${isActive
                    ? 'text-white/90'
                    : 'text-slate-400 group-hover:text-primary'
                  }`}>
                  {renderIcon(item.icon)}
                </span>

                {/* Label */}
                <span className="text-sm flex-1 truncate">{item.label}</span>

                {/* Notification badge for pending quota */}
                {item.to === '/penugasan' && pendingQuota > 0 && location.pathname !== '/penugasan' && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-lg" />
                  </span>
                )}

                {/* Hover arrow indicator */}
                {!isActive && (
                  <svg
                    className="w-4 h-4 text-slate-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>


    </aside>
  );
};

export default Sidebar;
