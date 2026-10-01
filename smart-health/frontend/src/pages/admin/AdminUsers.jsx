import { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { isMainAdmin } from '../../utils/helpers';

const EMPTY_ADMIN = {
  name: '',
  email: '',
  password: '',
  phone: '',
  admin_scope: 'hospital',
  center_ids: [],
};

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAdmin, setNewAdmin] = useState(EMPTY_ADMIN);

  const fetchUsers = () => {
    setLoading(true);
    api.get('/admin/users')
      .then((r) => setUsers(r.data.users))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isMainAdmin(me)) return;
    fetchUsers();
    api.get('/centers').then((r) => setCenters(r.data.centers)).catch(() => {});
  }, [me]);

  const handleRoleChange = async (id, role) => {
    const action = role === 'admin' ? 'promote to Main Admin' : 'demote to User';
    const successMessage = role === 'admin' ? 'User promoted to Main Admin' : 'User demoted to User';
    if (!confirm(`Are you sure you want to ${action}?`)) return;
    try {
      await api.patch(`/admin/users/${id}/role`, {
        role,
        admin_scope: role === 'admin' ? 'main' : null,
        center_ids: [],
      });
      toast.success(successMessage);
      fetchUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update role');
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (newAdmin.password.length < 8) {
      return toast.error('Password must be at least 8 characters');
    }
    if (newAdmin.admin_scope === 'hospital' && newAdmin.center_ids.length === 0) {
      return toast.error('Select at least one authorized hospital');
    }

    setCreating(true);
    try {
      await api.post('/admin/create-admin', newAdmin);
      toast.success(`Admin account created for ${newAdmin.name}`);
      setShowCreate(false);
      setNewAdmin(EMPTY_ADMIN);
      fetchUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create admin');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete');
    }
  };

  if (!isMainAdmin(me)) {
    return (
      <div className="portal-page">
        <div className="card text-center">
          <h1 className="text-2xl font-bold mb-2">Main Admin Only</h1>
          <p className="text-gray-500">Hospital admins cannot create admins or change user access.</p>
        </div>
      </div>
    );
  }

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const admins = users.filter((u) => u.role === 'admin');
  const regularUsers = users.filter((u) => u.role === 'user');

  return (
    <div className="portal-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Create hospital-specific admins and control platform access</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
          Create Admin
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { title: 'Hospital Admin', desc: 'Can access only selected hospitals.' },
          { title: 'Main Admin', desc: 'Can manage hospitals, doctors, users, and all appointments.' },
          { title: 'Authorized Access', desc: 'Assign one admin to one or multiple hospitals.' },
        ].map((item) => (
          <div key={item.title} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or email..."
          className="input max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="badge bg-purple-100 text-purple-700">{admins.length} Admins</span>
        <span className="badge bg-gray-100 text-gray-600">{regularUsers.length} Users</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="Users" title="No users found" />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((u) => {
                const isMe = u.id === me?.id;
                const accessLabel = u.role !== 'admin'
                  ? 'User'
                  : (u.admin_scope || 'main') === 'main'
                    ? 'Main Admin'
                    : `Hospital Admin${u.authorized_centers?.length ? ` (${u.authorized_centers.map((c) => c.name).join(', ')})` : ''}`;

                return (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name} {isMe && <span className="text-xs text-blue-500">(you)</span>}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{accessLabel}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.phone || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      {isMe ? (
                        <span className="text-xs text-gray-400 italic">Current session</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {u.role === 'admin' ? (
                            <button
                              onClick={() => handleRoleChange(u.id, 'user')}
                              className="text-xs text-orange-500 hover:text-orange-700 border border-orange-200 hover:border-orange-400 px-2 py-1 rounded-lg transition-colors"
                            >
                              Demote
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRoleChange(u.id, 'admin')}
                              className="text-xs text-purple-600 hover:text-purple-800 border border-purple-200 hover:border-purple-400 px-2 py-1 rounded-lg transition-colors"
                            >
                              Main Admin
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(u.id, u.name)}
                            className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2 py-1 rounded-lg transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="mb-6">
              <h2 className="text-lg font-bold">Create Admin Account</h2>
              <p className="text-xs text-gray-500">Choose whether this admin controls the whole platform or only selected hospitals.</p>
            </div>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <input className="input" required value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input className="input" type="email" required value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input className="input" type="tel" value={newAdmin.phone} onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Admin Type *</label>
                <select className="input" value={newAdmin.admin_scope} onChange={(e) => setNewAdmin({ ...newAdmin, admin_scope: e.target.value, center_ids: e.target.value === 'main' ? [] : newAdmin.center_ids })}>
                  <option value="hospital">Hospital Admin</option>
                  <option value="main">Main Admin</option>
                </select>
              </div>
              {newAdmin.admin_scope === 'hospital' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Authorized Hospitals *</label>
                  <select
                    multiple
                    className="input min-h-32"
                    value={newAdmin.center_ids}
                    onChange={(e) => setNewAdmin({
                      ...newAdmin,
                      center_ids: Array.from(e.target.selectedOptions).map((option) => option.value),
                    })}
                  >
                    {centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold Ctrl or Cmd to select more than one hospital.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Password * (min 8 chars)</label>
                <input className="input" type="password" required value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-xl transition-colors flex justify-center items-center gap-2">
                  {creating ? <Spinner size="sm" /> : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
