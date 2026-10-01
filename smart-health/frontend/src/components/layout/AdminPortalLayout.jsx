import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAdminBasePath, getAuthorizedCenters, isHospitalAdmin, isMainAdmin } from '../../utils/helpers';

export default function AdminPortalLayout({ portal = 'hospital', children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = getAdminBasePath(user);
  const isHospitalPortal = portal === 'hospital';
  const title = isHospitalPortal ? 'Hospital Admin Portal' : 'Main Admin Portal';
  const subtitle = isHospitalPortal
    ? 'Manage your assigned hospitals, queues, ambulances, and bookings.'
    : 'Control platform-wide operations, hospitals, users, and system access.';

  const navItems = isHospitalPortal
    ? [
        { to: `${basePath}/dashboard`, label: 'Dashboard' },
        { to: `${basePath}/hospital-control`, label: 'Hospital Control' },
        { to: `${basePath}/appointments`, label: 'Appointments' },
        { to: `${basePath}/queue`, label: 'Queue' },
        { to: `${basePath}/doctors`, label: 'Doctors' },
        { to: `${basePath}/ambulances`, label: 'Ambulances' },
        { to: `${basePath}/feedback`, label: 'Feedback' },
      ]
    : [
        { to: `${basePath}/dashboard`, label: 'Dashboard' },
        { to: `${basePath}/system-control`, label: 'System Control' },
        { to: `${basePath}/centers`, label: 'Centers' },
        { to: `${basePath}/doctors`, label: 'Doctors' },
        { to: `${basePath}/ambulances`, label: 'Ambulances' },
        { to: `${basePath}/appointments`, label: 'Appointments' },
        { to: `${basePath}/queue`, label: 'Queue' },
        { to: `${basePath}/users`, label: 'Users' },
        { to: `${basePath}/feedback`, label: 'Feedback' },
      ];

  const handleLogout = () => {
    logout();
    navigate(isHospitalPortal ? '/hospital-admin/login' : '/main-admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-950 text-white dark:border-slate-800">
          <div className="px-6 py-6 border-b border-white/10">
            <Link to={basePath} className="text-xl font-bold tracking-tight">
              SmartHealth
            </Link>
            <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
          </div>

          <nav className="flex-1 px-4 py-5 space-y-2">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`block rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    active ? 'bg-sky-500 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 px-6 py-5 text-sm text-slate-300">
            <p className="font-semibold">{user?.name}</p>
            <p className="mt-1 text-xs text-slate-400">{user?.email}</p>
            {isHospitalAdmin(user) && (
              <p className="mt-3 text-xs text-slate-400">
                Hospitals: {getAuthorizedCenters(user).map((center) => center.name).join(', ') || 'Assigned hospitals'}
              </p>
            )}
            {isMainAdmin(user) && (
              <p className="mt-3 text-xs text-slate-400">Platform-wide administration enabled</p>
            )}
            <button onClick={handleLogout} className="mt-4 w-full rounded-xl bg-white/10 px-4 py-2 text-left text-sm font-medium hover:bg-white/15">
              Logout
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600 dark:text-sky-300">{title}</p>
                <h1 className="mt-1 text-2xl font-bold">{user?.name ? `Welcome, ${user.name.split(' ')[0]}` : title}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
              </div>
              <div className="flex gap-2 lg:hidden">
                <Link to={basePath} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">Home</Link>
                <button onClick={handleLogout} className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-slate-900">Logout</button>
              </div>
            </div>
          </header>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
