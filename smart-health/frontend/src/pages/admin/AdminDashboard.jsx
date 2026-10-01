import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import Spinner from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatTime, getAuthorizedCenters, isHospitalAdmin, isMainAdmin } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

function StatCard({ label, value, sub }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-blue-600 mt-2">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    try {
      const [todayRes, allRes, queueRes, centersRes, doctorsRes] = await Promise.all([
        api.get('/admin/appointments', { params: { date: today } }),
        api.get('/admin/appointments'),
        api.get('/admin/queue-status', { params: { date: today } }),
        api.get('/centers'),
        api.get('/doctors'),
      ]);

      const authorizedCenters = getAuthorizedCenters(user);
      const visibleCenters = isHospitalAdmin(user)
        ? centersRes.data.centers.filter((center) => authorizedCenters.some((item) => item.id === center.id))
        : centersRes.data.centers;
      const visibleDoctors = isHospitalAdmin(user)
        ? doctorsRes.data.doctors.filter((doctor) => authorizedCenters.some((item) => item.id === doctor.center_id))
        : doctorsRes.data.doctors;

      setData({
        todayAppointments: todayRes.data.appointments,
        allAppointments: allRes.data.appointments,
        queue: queueRes.data.queue,
        centerCount: visibleCenters.length,
        doctorCount: visibleDoctors.length,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [user]);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const completedToday = data.todayAppointments.filter((item) => item.status === 'completed').length;
  const inProgress = data.todayAppointments.filter((item) => item.status === 'in_progress').length;
  const confirmed = data.todayAppointments.filter((item) => item.status === 'confirmed').length;
  const quickLinks = [
    { to: '/admin/hospital-control', label: 'Hospital Control', desc: 'Manage booked patients for assigned hospitals' },
    { to: '/admin/ambulances', label: 'Ambulances', desc: 'Add hospital ambulance services for SOS and live tracking' },
    { to: '/admin/appointments', label: 'Appointments', desc: 'View and manage bookings' },
    { to: '/admin/queue', label: 'Queue Monitor', desc: 'Track the live queue' },
    { to: '/admin/doctors', label: 'Doctors', desc: 'Manage doctors and consultation slots' },
    ...(isMainAdmin(user)
      ? [
          { to: '/admin/system-control', label: 'System Control', desc: 'Platform-wide data and access control' },
          { to: '/admin/centers', label: 'Centers', desc: 'Manage hospitals and centers' },
          { to: '/admin/users', label: 'Users', desc: 'Create and authorize admins' },
        ]
      : []),
  ];

  return (
    <div className="portal-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isMainAdmin(user) ? 'Platform-wide admin access' : 'Hospital-scoped admin access'}
          </p>
          {isHospitalAdmin(user) && (
            <p className="text-xs text-gray-400 mt-1">
              Authorized hospitals: {getAuthorizedCenters(user).map((center) => center.name).join(', ') || 'assigned hospitals'}
            </p>
          )}
        </div>
        <button onClick={load} className="btn-secondary text-sm py-1.5">Refresh</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Today" value={data.todayAppointments.length} sub="Appointments today" />
        <StatCard label="Confirmed" value={confirmed} sub="Still waiting" />
        <StatCard label="In Progress" value={inProgress} sub="Consultations running" />
        <StatCard label="Completed" value={completedToday} sub="Completed today" />
        <StatCard label="All Time" value={data.allAppointments.length} sub="Visible to this admin" />
      </div>

      {isMainAdmin(user) && (
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <StatCard label="Centers" value={data.centerCount} sub="Total hospitals and centers" />
          <StatCard label="Doctors" value={data.doctorCount} sub="Doctors under management" />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="card md:col-span-1">
          <h2 className="font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to} className="block border rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <p className="font-medium">{link.label}</p>
                <p className="text-xs text-gray-500 mt-1">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Live Queue</h2>
            <Link to="/admin/queue" className="text-sm text-blue-600 hover:underline">Open queue</Link>
          </div>
          {data.queue.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No active queue right now</p>
          ) : (
            <div className="space-y-2">
              {data.queue.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="w-10 text-center font-bold text-blue-600">#{item.live_queue_number || item.queue_number}</div>
                  <div className="flex-1">
                    <p className="font-medium">{item.user_name}</p>
                    <p className="text-xs text-gray-500">{item.center_name} · {formatTime(item.appointment_time)}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent Appointments Today</h2>
          <Link to="/admin/appointments" className="text-sm text-blue-600 hover:underline">View all</Link>
        </div>
        {data.todayAppointments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No appointments today</p>
        ) : (
          <div className="space-y-2">
            {data.todayAppointments.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="w-10 text-center font-bold text-blue-600">#{item.live_queue_number || item.queue_number}</div>
                <div className="flex-1">
                  <p className="font-medium">{item.user_name}</p>
                  <p className="text-xs text-gray-500">{item.center_name} · {formatTime(item.appointment_time)}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
