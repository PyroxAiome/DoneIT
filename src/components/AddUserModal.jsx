import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, AlertCircle, Check } from 'lucide-react';

export default function AddUserModal({ isOpen, onClose, onCreated, onUpdated, editingUser }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', department: 'General' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editingUser) {
      setForm({
        name: editingUser.name || '',
        email: editingUser.email || '',
        password: '',
        role: editingUser.role || 'employee',
        department: editingUser.department || 'General'
      });
    } else {
      setForm({ name: '', email: '', password: '', role: 'employee', department: 'General' });
    }
    setError('');
  }, [editingUser, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const reset = () => { setForm({ name: '', email: '', password: '', role: 'employee', department: 'General' }); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || (!editingUser && !form.password)) {
      setError('Name, email, and password are required');
      return;
    }
    setBusy(true);
    try {
      if (editingUser) {
        const updated = await api.updateUser(editingUser.id, form);
        if (onUpdated) onUpdated(updated);
      } else {
        const user = await api.createUser(form);
        if (onCreated) onCreated(user);
      }
      reset();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={() => { reset(); onClose(); }}>
      <div className="card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{editingUser ? 'Edit Team Member Profile' : 'Add Team Member'}</h3>
          <button onClick={() => { reset(); onClose(); }} className="p-1 hover:bg-gray-100 rounded transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Full Name</label>
            <input value={form.name} onChange={handleChange('name')} className="input-field" placeholder="John Doe" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Email</label>
            <input type="email" value={form.email} onChange={handleChange('email')} className="input-field" placeholder="john@company.com" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
              Password {editingUser && <span className="text-[10px] text-gray-400 font-normal lowercase">(leave blank to keep current)</span>}
            </label>
            <input type="password" value={form.password} onChange={handleChange('password')} className="input-field" placeholder={editingUser ? "Optional password reset" : "Set password"} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Role</label>
            <select value={form.role} onChange={handleChange('role')} className="input-field">
              <option value="employee">Employee</option>
              <option value="software_engineer">Software Engineer</option>
              <option value="electronics_engineer">Electronics Engineer</option>
              <option value="mechanical_engineer">Mechanical Engineer</option>
              <option value="production_engineer">Production Engineer</option>
              <option value="intern">Intern</option>
              <option value="hr">HR</option>
              <option value="site_manager">Site Manager / QS</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { reset(); onClose(); }} className="btn-primary text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="btn-amber text-sm flex items-center gap-2 disabled:opacity-50">
              {busy ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {busy ? 'Saving...' : (editingUser ? 'Save Changes' : 'Add Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
