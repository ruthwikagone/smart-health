import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { PriorityBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { formatTime, getAuthorizedCenters, isHospitalAdmin, parseAppointmentIssue } from '../../utils/helpers';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function AdminQueue() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ center_id: '', date: new Date().toISOString().split('T')[0] });

  const fetchQueue = () => {
    setLoading(true);
    api.get('/admin/queue-status', { params: filters })
      .then((r) => setQueue(r.data.queue))
      .catch(() => toast.error('Failed to load queue'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isHospitalAdmin(user)) {
      setCenters(getAuthorizedCenters(user));
      return;
    }
    api.get('/centers').then((r) => setCenters(r.data.centers));
  }, [user]);

  useEffect(() => {
    fetchQueue();
    const timer = setInterval(fetchQueue, 15000);
    return () => clearInterval(timer);
  }, [filters]);

  const handleStatus = async (id, status) => {
    try {
      await api.patch(`/admin/appointments/${id}/status`, { status });
      toast.success('Updated');
      fetchQueue();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="portal-page">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">Queue Monitor</h1>
        <span className="text-xs text-green-600 bg-green-100 px-3 py-1 rounded-full animate-pulse">Auto-refreshes every 15s</span>
      </div>

      {isHospitalAdmin(user) && (
        <p className="text-sm text-gray-500 mb-6">
          Queue access is limited to your authorized hospitals.
        </p>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <select className="input max-w-xs" value={filters.center_id} onChange={(e) => setFilters({ ...filters, center_id: e.target.value })}>
          <option value="">{isHospitalAdmin(user) ? 'All Authorized Hospitals' : 'All Centers'}</option>
          {centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
        </select>
        <input type="date" className="input max-w-xs" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner /></div>
        : queue.length === 0 ? <p className="text-center text-gray-500 py-16">No active queue for selected filters.</p>
        : (
          <div className="space-y-3">
            {queue.map((item) => {
              const issue = parseAppointmentIssue(item.issue);
              const issueSummary = issue.summary || issue.notes || 'No issue details added';

              return (
                <div key={item.id} className={`card flex items-center gap-4 ${item.status === 'in_progress' ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                  <div className="text-2xl font-bold text-blue-600 w-10 text-center">#{item.live_queue_number || item.queue_number}</div>
                  <div className="flex-1">
                    <p className="font-medium">{item.user_name}</p>
                    <p className="text-xs text-gray-600 mt-1">{issueSummary}</p>
                    <p className="text-xs text-red-600 mt-1">Symptoms: {issue.symptoms.length ? issue.symptoms.join(', ') : 'Not specified'}</p>
                    <p className="text-xs text-gray-500">{formatTime(item.appointment_time)} | ~{item.estimated_wait_minutes} min wait</p>
                  </div>
                  <div className="min-w-[92px] text-center">
                    <PriorityBadge priority={item.priority} />
                  </div>
                  <StatusBadge status={item.status} />
                  <div className="flex gap-2">
                    {item.status === 'confirmed' && (
                      <button
                        onClick={() => handleStatus(item.id, 'in_progress')}
                        className="btn-secondary text-xs py-1 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!item.can_start}
                        title={!item.can_start ? 'Start the highest-priority patient first.' : 'Start consultation'}
                      >
                        Start
                      </button>
                    )}
                    {item.status === 'in_progress' && (
                      <button onClick={() => handleStatus(item.id, 'completed')} className="btn-primary text-xs py-1 px-2">Complete</button>
                    )}
                    <button onClick={() => handleStatus(item.id, 'no_show')} className="text-xs text-gray-400 hover:text-red-500 px-1">No Show</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
