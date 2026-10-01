import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { getAdminBasePath, isAdmin, isMainAdmin } from '../utils/helpers';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function Profile() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api.get('/profile').then(r => {
      setProfile(r.data.user);
      setForm(r.data.user);
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch('/profile', form);
      setProfile(res.data.user);
      setEditing(false);
      toast.success('Profile updated successfully!');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const initials = profile?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const adminBasePath = getAdminBasePath(authUser);

  return (
    <div className="portal-page">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      {/* Avatar + basic info */}
      <div className="card mb-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-3xl font-bold shadow-lg">
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-bold">{profile?.name}</h2>
            <p className="text-gray-500 text-sm">{profile?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="badge bg-blue-100 text-blue-700 capitalize">{profile?.role}</span>
              {profile?.blood_group && (
                <span className="badge bg-red-100 text-red-700">🩸 {profile.blood_group}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="ml-auto btn-secondary text-sm"
          >
            {editing ? 'Cancel' : '✏️ Edit'}
          </button>
        </div>
      </div>

      {editing ? (        <form onSubmit={handleSave} className="card space-y-4">
          <h3 className="font-semibold">Edit Profile</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name *</label>
              <input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input className="input" type="tel" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date of Birth</label>
              <input className="input" type="date" value={form.date_of_birth ? String(form.date_of_birth).split('T')[0] : ''} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Blood Group</label>
              <select className="input" value={form.blood_group || ''} onChange={e => setForm({ ...form, blood_group: e.target.value })}>
                <option value="">Select</option>
                {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <input className="input" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Your home address" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Emergency Contact</label>
              <input className="input" value={form.emergency_contact || ''} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Name and phone number" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex justify-center items-center gap-2">
              {saving ? <Spinner size="sm" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="card space-y-4">
          <h3 className="font-semibold mb-2">Personal Information</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: '📧 Email', value: profile?.email },
              { label: '📱 Phone', value: profile?.phone || '—' },
              { label: '🎂 Date of Birth', value: profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-IN') : '—' },
              { label: '🩸 Blood Group', value: profile?.blood_group || '—' },
              { label: '📍 Address', value: profile?.address || '—' },
              { label: '🆘 Emergency Contact', value: profile?.emergency_contact || '—' },
              { label: '📅 Member Since', value: new Date(profile?.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' }) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Portal Card — only for admins */}
      {isAdmin(authUser) && (
        <div className="mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl">👑</div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Admin Portal</h3>
              <p className="text-purple-100 text-sm">Manage centers, doctors, appointments and users</p>
            </div>
            <Link
              to={`${adminBasePath}/dashboard`}
              className="bg-white text-purple-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-purple-50 transition-colors text-sm shrink-0"
            >
              Open Portal →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { to: `${adminBasePath}/appointments`, icon: '📋', label: 'Appointments' },
              { to: `${adminBasePath}/queue`, icon: '📊', label: 'Queue Monitor' },
              { to: isMainAdmin(authUser) ? `${adminBasePath}/users` : `${adminBasePath}/ambulances`, icon: isMainAdmin(authUser) ? '👥' : '🚑', label: isMainAdmin(authUser) ? 'Users' : 'Ambulances' },
            ].map(l => (
              <Link key={l.to} to={l.to} className="bg-white/10 hover:bg-white/20 rounded-xl p-3 text-center transition-colors">
                <p className="text-xl mb-1">{l.icon}</p>
                <p className="text-xs font-medium">{l.label}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
