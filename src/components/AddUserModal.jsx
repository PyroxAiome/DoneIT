import { useState } from 'react';
import { api } from '../lib/api';
import { X, AlertCircle, Check } from 'lucide-react';

export default function AddUserModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', department: 'General' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const reset = () => { setForm({ name: '', email: '', password: '', role: 'employee', department: 'General' }); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) {
      setError('Name, email, and password are required');
      return;
    }
    setBusy(true);
    try {
      const user = await api.createUser(form);
      onCreated(user);
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
          <h3 className="font-semibold text-gray-900">Add Team Member</h3>
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
            <input value={form.name} onChange={handleChange('name')} className="input-field" placeholder="John Doe" />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Email</label>
            <input type="email" value={form.email} onChange={handleChange('email')} className="input-field" placeholder="john@company.com" />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Password</label>
            <input type="password" value={form.password} onChange={handleChange('password')} className="input-field" placeholder="Set password" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Role</label>
              <select value={form.role} onChange={handleChange('role')} className="input-field">
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Category (Team)</label>
              <select value={form.department} onChange={handleChange('department')} className="input-field">
                <option>General</option>
                <option>Software</option>
                <option>Electronics</option>
                <option>Mechanical</option>
                <option>Production</option>
                <option>Engineering</option>
                <option>Design</option>
                <option>Marketing</option>
                <option>QA</option>
                <option>Infra</option>
                <option>Executive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { reset(); onClose(); }} className="btn-primary text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="btn-amber text-sm flex items-center gap-2 disabled:opacity-50">
              {busy ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {busy ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
