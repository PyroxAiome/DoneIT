import { useState, useEffect } from 'react';
import { X, Repeat, Users, AlertCircle, Check, Search } from 'lucide-react';
import { api } from '../lib/api';

const frequencies = [
  { id: 'weekly', label: 'Weekly', desc: 'Reviewed every week' },
  { id: 'monthly', label: 'Monthly', desc: 'Reviewed once a month' },
  { id: 'daily', label: 'Daily', desc: 'Reviewed every day' }
];

export default function RepeatedTaskModal({ isOpen, onClose, task, onSaved }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    frequency: 'weekly',
    member_ids: []
  });

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      if (task) {
        setFormData({
          title: task.title || '',
          description: task.description || '',
          frequency: task.frequency || 'weekly',
          member_ids: Array.isArray(task.members) ? task.members.map(m => m.user_id || m.id) : []
        });
      } else {
        setFormData({
          title: '',
          description: '',
          frequency: 'weekly',
          member_ids: []
        });
      }
      setUserSearch('');
      setError('');
    }
  }, [isOpen, task]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getEmployees(true);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load team members:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleMember = (userId) => {
    const id = Number(userId);
    setFormData(prev => ({
      ...prev,
      member_ids: prev.member_ids.includes(id)
        ? prev.member_ids.filter(mId => mId !== id)
        : [...prev.member_ids, id]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Please enter a task name');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (task?.id) {
        await api.updateRepeatedTask(task.id, formData);
      } else {
        await api.createRepeatedTask(formData);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save task');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.department?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                {task ? 'Edit Repeated Task' : 'Create Repeated Task'}
              </h3>
              <p className="text-[11px] text-gray-500">
                Setup a repetitive activity for periodic review meetings
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Task Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Recruitment, Safety Review, Weekly Financials"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="What is this recurring task about? What will be reviewed during meetings?..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Frequency Selector */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1.5">
              Review Frequency
            </label>
            <div className="grid grid-cols-3 gap-2">
              {frequencies.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, frequency: f.id })}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    formData.frequency === f.id
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                  }`}
                >
                  <p className="font-bold text-xs">{f.label}</p>
                  <p className={`text-[10px] mt-0.5 ${formData.frequency === f.id ? 'text-amber-100' : 'text-gray-400'}`}>
                    {f.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Assigned People Multi-Selector */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <label className="font-bold text-gray-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-600" />
                Assign People to Review ({formData.member_ids.length} selected)
              </label>
              <span className="text-[11px] text-gray-400">
                (Admin, HR, managers, team members)
              </span>
            </div>

            {/* Search members */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, role, or department..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white"
              />
            </div>

            {/* Members Picker List */}
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
              {loadingUsers ? (
                <p className="p-4 text-center text-gray-400">Loading team members...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="p-4 text-center text-gray-400">No matching team members found.</p>
              ) : (
                filteredUsers.map(u => {
                  const isSelected = formData.member_ids.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleMember(u.id)}
                      className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected ? 'bg-amber-50/80 hover:bg-amber-100/70' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                          {u.name ? u.name.charAt(0) : 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-xs flex items-center gap-1.5 truncate">
                            {u.name}
                            <span className="px-1.5 py-0.2 rounded bg-gray-100 text-[10px] text-gray-600 font-normal uppercase">
                              {u.role ? u.role.replace('_', ' ') : 'Employee'}
                            </span>
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all flex-shrink-0 ml-2 ${
                        isSelected
                          ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                          : 'border-gray-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              {busy ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
