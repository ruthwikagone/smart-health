import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function UserPortalLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/history', label: 'Appointments' },
    { to: '/centers', label: 'Find Centers' },
    { to: '/health-reports', label: 'Health Reports' },
    { to: '/digital-health-records', label: 'Digital Health Records' },
    { to: '/prescriptions', label: 'E-Prescriptions' },
    { to: '/telemedicine', label: 'Telemedicine' },
    { to: '/ai-assistant', label: 'AI Health Assistant' },
    { to: '/feedback', label: 'Feedback' },
    { to: '/profile', label: 'Profile' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="px-6 py-6 border-b border-slate-200 dark:border-slate-800">
            <Link to="/dashboard" className="text-xl font-bold text-sky-600">SmartHealth</Link>
            <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-400">User Portal</p>
          </div>
          <nav className="flex-1 px-4 py-5 space-y-2">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`block rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-sky-700 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-slate-200 px-6 py-5 dark:border-slate-800">
            <p className="font-semibold">{user?.name}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            <button onClick={handleLogout} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 text-left text-sm font-medium text-white dark:bg-white dark:text-slate-900">
              Logout
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600 dark:text-sky-300">User Portal</p>
                <h1 className="mt-1 text-2xl font-bold">{user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'SmartHealth'}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Appointments, profile, history, and healthcare access in one place.</p>
              </div>
              <div className="flex gap-2 lg:hidden">
                <Link to="/dashboard" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">Home</Link>
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
