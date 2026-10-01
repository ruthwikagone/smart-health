import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { formatDate, formatDoctorName, formatTime, safeDate, safeTime } from '../utils/helpers';
import { StatusBadge, PriorityBadge } from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import toast from 'react-hot-toast';

const SECTOR_ICONS = { hospital:'🏥', clinic:'🩺', diagnostics:'🔬', dental:'🦷', eye_care:'👁️', mental_health:'🧠', ent:'👂' };

export default function MedicalHistory() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/appointments/me')
      .then(r => setAppointments(r.data.appointments))
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  const today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  })();

  const filtered = appointments.filter(a => {
    const d = safeDate(a.appointment_date);
    const matchFilter =
      filter === 'all' ? true :
      filter === 'completed' ? a.status === 'completed' :
      filter === 'cancelled' ? a.status === 'cancelled' :
      filter === 'upcoming' ? (d >= today && ['confirmed','in_progress'].includes(a.status)) :
      filter === 'no_show' ? a.status === 'no_show' : true;

    const matchSearch = search === '' ||
      (a.center_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.doctor_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.issue || '').toLowerCase().includes(search.toLowerCase());

    return matchFilter && matchSearch;
  });

  const stats = {
    total: appointments.length,
    completed: appointments.filter(a => a.status === 'completed').length,
    upcoming: appointments.filter(a => safeDate(a.appointment_date) >= today && a.status === 'confirmed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    noShow: appointments.filter(a => a.status === 'no_show').length,
  };

  return (
    <div className="portal-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Medical History</h1>
          <p className="text-sm text-gray-500 mt-1">All your past and upcoming appointments</p>
        </div>
        <Link to="/centers" className="btn-primary text-sm">+ New Appointment</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { key: 'all', label: 'Total', count: stats.total, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { key: 'upcoming', label: 'Upcoming', count: stats.upcoming, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { key: 'completed', label: 'Completed', count: stats.completed, color: 'text-gray-700', bg: 'bg-gray-50 dark:bg-gray-800' },
          { key: 'cancelled', label: 'Cancelled', count: stats.cancelled, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
          { key: 'no_show', label: 'No Show', count: stats.noShow, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-xl p-3 text-center transition-all border-2 ${filter === s.key ? 'border-blue-500 shadow-md' : 'border-transparent'} ${s.bg}`}
          >
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by center, doctor or reason..."
        className="input mb-6"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📋" title="No records found" message="Try changing the filter or search term." />
      ) : (
        <div className="space-y-3">
          {filtered.map(appt => {
            const dateStr = safeDate(appt.appointment_date);
            const timeStr = safeTime(appt.appointment_time);
            const isPast = dateStr < today;
            return (
              <div key={appt.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-2xl shrink-0">
                    {SECTOR_ICONS[appt.sector] || '🏥'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{appt.center_name}</h3>
                      <StatusBadge status={appt.status} />
                      <PriorityBadge priority={appt.priority} />
                    </div>
                    {appt.doctor_name && (
                      <p className="text-sm text-gray-500">👨‍⚕️ {formatDoctorName(appt.doctor_name)} · {appt.specialization}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      📅 {formatDate(dateStr)} at {formatTime(timeStr)}
                      {isPast && <span className="ml-2 text-xs text-gray-400">(past)</span>}
                    </p>
                    <div className="mt-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500">Reason: <span className="text-gray-700 dark:text-gray-300 font-medium">{appt.issue}</span></p>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>Token #{appt.queue_number}</span>
                      <span>Est. wait: {appt.estimated_wait_minutes} min</span>
                      <span>Booked: {formatDate(safeDate(appt.created_at))}</span>
                    </div>
                  </div>
                  <Link
                    to={`/appointments/${appt.id}`}
                    className="btn-secondary text-xs py-1.5 px-3 shrink-0"
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
