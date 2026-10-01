import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Spinner from '../components/ui/Spinner';

const initialForm = {
  rating: 5,
  category: 'General',
  centerId: '',
  doctorId: '',
  subject: '',
  message: '',
};

export default function Feedback() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [centers, setCenters] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(initialForm);

  const loadFeedback = async () => {
    try {
      const res = await api.get('/feedback/me');
      setItems(res.data.feedback || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
    api.get('/centers').then((res) => setCenters(res.data.centers || [])).catch(() => setCenters([]));
  }, []);

  useEffect(() => {
    if (!form.centerId) {
      setDoctors([]);
      setForm((current) => ({ ...current, doctorId: '' }));
      return;
    }

    api.get('/doctors', { params: { center_id: form.centerId } })
      .then((res) => setDoctors(res.data.doctors || []))
      .catch(() => setDoctors([]));
    setForm((current) => ({ ...current, doctorId: '' }));
  }, [form.centerId]);

  const submitFeedback = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await api.post('/feedback', {
        ...form,
        centerId: form.centerId || undefined,
        doctorId: form.doctorId || undefined,
      });
      setItems((current) => [res.data.feedback, ...current]);
      setForm(initialForm);
      setDoctors([]);
      toast.success('Feedback submitted successfully.');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to submit feedback.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="portal-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="mt-1 text-sm text-gray-500">Share your experience and help improve patient care across the platform.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <form onSubmit={submitFeedback} className="card space-y-4">
          <h2 className="text-lg font-semibold">Write your feedback</h2>

          <div>
            <label className="mb-1 block text-sm font-medium">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, rating: value }))}
                  className={`rounded-full px-3 py-2 text-sm font-semibold ${form.rating === value ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="category" className="mb-1 block text-sm font-medium">Category</label>
            <select
              id="category"
              className="input"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            >
              <option value="General">General</option>
              <option value="Doctor">Doctor</option>
              <option value="Hospital">Hospital</option>
              <option value="Appointment">Appointment</option>
              <option value="Telemedicine">Telemedicine</option>
              <option value="Billing">Billing</option>
              <option value="Support">Support</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="centerId" className="mb-1 block text-sm font-medium">Hospital</label>
              <select
                id="centerId"
                className="input"
                value={form.centerId}
                onChange={(event) => setForm((current) => ({ ...current, centerId: event.target.value }))}
                required
              >
                <option value="">Select hospital</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>{center.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="doctorId" className="mb-1 block text-sm font-medium">Doctor</label>
              <select
                id="doctorId"
                className="input"
                value={form.doctorId}
                onChange={(event) => setForm((current) => ({ ...current, doctorId: event.target.value }))}
                disabled={!form.centerId}
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="subject" className="mb-1 block text-sm font-medium">Subject</label>
            <input
              id="subject"
              className="input"
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              placeholder="Brief summary of your experience"
              required
            />
          </div>

          <div>
            <label htmlFor="message" className="mb-1 block text-sm font-medium">Message</label>
            <textarea
              id="message"
              className="input min-h-32"
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              placeholder="Tell us what went well, what needs improvement, and how we can help."
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? 'Submitting...' : 'Submit feedback'}
          </button>
        </form>

        <div className="card">
          <h2 className="text-lg font-semibold">Your recent feedback</h2>
          {loading ? (
            <div className="mt-4 flex justify-center py-8"><Spinner /></div>
          ) : items.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No feedback submitted yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {items.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{item.subject}</strong>
                    <span className="badge bg-amber-100 text-amber-700">{item.rating}/5</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{item.category}</p>
                  <p className="mt-2 text-xs text-gray-500">{item.centerName || 'Hospital not selected'}{item.doctorName ? ` · Dr. ${item.doctorName}` : ''}</p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{item.message}</p>
                  <p className="mt-2 text-xs text-gray-500">Status: {item.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
