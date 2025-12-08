import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/badan-publik', label: 'Data Badan Publik' },
  { to: '/history', label: 'History Log' },
  { to: '/templates', label: 'Edit Template' },
  { to: '/settings', label: 'Pengaturan' }
];

const Sidebar = () => {
  return (
    <aside className="min-h-screen w-64 bg-white/90 backdrop-blur border-r border-slate-200 shadow-soft">
      <div className="px-6 py-6">
        <div className="text-xl font-bold text-primary">Otomasi Email</div>
        <p className="text-sm text-slate-500 mt-1">Versi Lite</p>
      </div>
      <nav className="px-3 space-y-1">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${
                isActive
                  ? 'bg-primary text-white shadow-soft'
                  : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            <span className="text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
