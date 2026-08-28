import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, AlertCircle, Check } from 'lucide-react';

export default function AddUserModal({ isOpen, onClose, onCreated, onUpdated, editingUser, employees = [] }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', department: 'General', mentor_id: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editingUser) {
      setForm({
        name: editingUser.name || '',
        email: editingUser.email || '',
        password: '',
        role: editingUser.role || 'employee',
        department: editingUser.department || 'General',
        mentor_id: editingUser.mentor_id || ''
      });
    } else {
      setForm({ name: '', email: '', password: '', role: 'employee', department: 'General', mentor_id: '' });
    }
    setError('');
  }, [editingUser, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const reset = () => { setForm({ name: '', email: '', password: '', role: 'employee', department: 'General', mentor_id: '' }); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || (!editingUser && !form.password)) {
      setError('Name, email, and password are required');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        mentor_id: form.role === 'intern' && form.mentor_id ? Number(form.mentor_id) : null
      };
      if (editingUser) {
        const updated = await api.updateUser(editingUser.id, payload);
        if (onUpdated) onUpdated(updated);
      } else {
        const user = await api.createUser(payload);
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
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Department</label>
              <input value={form.department} onChange={handleChange('department')} className="input-field" placeholder="Engineering" />
            </div>
          </div>

          {/* Intern Mentor Assignment */}
          {form.role === 'intern' && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 animate-in fade-in">
              <label className="text-xs font-semibold text-amber-900 block">
                Assign Under Mentor / Responsible Employee
              </label>
              <p className="text-[11px] text-amber-700">
                The chosen employee will monitor this intern's tasks and daily work updates.
              </p>
              <select
                value={form.mentor_id || ''}
                onChange={handleChange('mentor_id')}
                className="input-field bg-white"
              >
                <option value="">-- No Mentor Assigned --</option>
                {employees
                  .filter(e => e.role !== 'intern' && (!editingUser || e.id !== editingUser.id))
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role ? emp.role.replace('_', ' ') : 'Employee'}{emp.department ? ` - ${emp.department}` : ''})
                    </option>
                  ))}
              </select>
            </div>
          )}

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
