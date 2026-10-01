import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/ui/Spinner';

const VALID_STATUSES = ['new', 'in_review', 'resolved'];

export default function AdminFeedback() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadFeedback = async () => {
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const res = await api.get('/feedback/admin', { params });
      setItems(res.data.feedback || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load feedback.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, [filter]);

  const updateFeedback = async (id, status, adminResponse) => {
    try {
      const res = await api.patch(`/feedback/${id}`, { status, adminResponse });
      setItems((current) => current.map((item) => (item.id === id ? res.data.feedback : item)));
      toast.success('Feedback updated.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update feedback.');
    }
  };

  return (
    <div className="portal-page">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Feedback Center</h1>
          <p className="mt-1 text-sm text-gray-500">Review patient feedback and respond to issues across assigned hospitals.</p>
        </div>
        <select className="input max-w-xs" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All</option>
          {VALID_STATUSES.map((status) => (
            <option key={status} value={status}>{status.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="card text-center text-sm text-gray-500">No feedback found for this filter.</div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="card">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{item.subject}</h2>
                    <span className="badge bg-amber-100 text-amber-700">{item.rating}/5</span>
                    <span className="badge bg-slate-100 text-slate-700">{item.category}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{item.userName} · {item.userEmail}</p>
                  <p className="text-xs text-gray-500">{item.centerName || 'General'}{item.doctorName ? ` · Dr. ${item.doctorName}` : ''} · {new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <select
                  className="input max-w-[180px]"
                  value={item.status}
                  onChange={(event) => updateFeedback(item.id, event.target.value, item.adminResponse || '')}
                >
                  {VALID_STATUSES.map((status) => (
                    <option key={status} value={status}>{status.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">{item.message}</p>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium">Admin response</label>
                <textarea
                  className="input min-h-24"
                  value={item.adminResponse || ''}
                  onChange={(event) => {
                    setItems((current) => current.map((entry) =>
                      entry.id === item.id ? { ...entry, adminResponse: event.target.value } : entry
                    ));
                  }}
                  placeholder="Write a response to the patient."
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => updateFeedback(item.id, item.status, item.adminResponse || '')}
                  >
                    Save response
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
