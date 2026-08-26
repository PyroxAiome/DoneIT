import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Repeat, Users, AlertCircle, Check, Search, Shield } from 'lucide-react';
import { api } from '../lib/api';

const categories = [
  'General',
  'HR & Recruitment',
  'Engineering & Tech',
  'Operations & Site',
  'Safety & Compliance',
  'Finance & Accounts',
  'Sales & Client',
  'Management Sync'
];

const frequencies = [
  { id: 'daily', label: 'Daily', desc: 'Every business day' },
  { id: 'weekly', label: 'Weekly', desc: 'Once a week' },
  { id: 'biweekly', label: 'Bi-Weekly', desc: 'Every 2 weeks' },
  { id: 'monthly', label: 'Monthly', desc: 'Once a month' }
];

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', '1st Day of Month', '15th of Month', 'Last Friday of Month'];

export default function RepeatedTaskModal({ isOpen, onClose, task, onSaved, projects = [] }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    frequency: 'weekly',
    meeting_day: 'Monday',
    meeting_time: '10:00 AM',
    category: 'General',
    priority: 'medium',
    status: 'active',
    project_id: '',
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
          meeting_day: task.meeting_day || 'Monday',
          meeting_time: task.meeting_time || '10:00 AM',
          category: task.category || 'General',
          priority: task.priority || 'medium',
          status: task.status || 'active',
          project_id: task.project_id || '',
          member_ids: Array.isArray(task.members) ? task.members.map(m => m.user_id || m.id) : []
        });
      } else {
        setFormData({
          title: '',
          description: '',
          frequency: 'weekly',
          meeting_day: 'Monday',
          meeting_time: '10:00 AM',
          category: 'General',
          priority: 'medium',
          status: 'active',
          project_id: '',
          member_ids: []
        });
      }
      setError('');
    }
  }, [isOpen, task]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load users:', err);
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
      setError('Please enter a task title');
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
      setError(err.message || 'Failed to save repeated task');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                {task ? 'Edit Repeated Task' : 'Create New Repeated Task'}
              </h3>
              <p className="text-xs text-gray-500">
                Setup recurring activity, meeting frequency & assigned team reviewers
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Task Title / Activity Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Weekly Recruitment & Candidate Pipeline Sync"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Description & Review Objectives
            </label>
            <textarea
              rows={2}
              placeholder="Outline the recurring agenda, metrics to review, key deliverables..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Frequency & Schedule Grid */}
          <div className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-3">
            <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" />
              Meeting Schedule & Recurrence
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {frequencies.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, frequency: f.id })}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  Target Discussion Day
                </label>
                <select
                  value={formData.meeting_day}
                  onChange={e => setFormData({ ...formData, meeting_day: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                >
                  {daysOfWeek.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  Meeting Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10:00 AM or 03:30 PM"
                  value={formData.meeting_time}
                  onChange={e => setFormData({ ...formData, meeting_time: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* Category, Priority & Project */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="active">Active (Recurring)</option>
                <option value="paused">Paused / On Hold</option>
                <option value="completed">Completed / Closed</option>
              </select>
            </div>
          </div>

          {/* Associated Project (Optional) */}
          {projects && projects.length > 0 && (
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Linked Project (Optional)</label>
              <select
                value={formData.project_id}
                onChange={e => setFormData({ ...formData, project_id: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">Company-Wide (General Activity)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Assigned Reviewers / Responsible People Multi-Selector */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <label className="font-bold text-gray-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                Assign Responsible People & Reviewers ({formData.member_ids.length} selected)
              </label>
              <span className="text-[11px] text-gray-400">
                All selected members can view & log meeting reviews
              </span>
            </div>

            {/* Search members */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search team member by name or role..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs"
              />
            </div>

            {/* Members Picker List */}
            <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-gray-50/50">
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
                        isSelected ? 'bg-indigo-50/80 hover:bg-indigo-100/70' : 'hover:bg-gray-100/60 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                          {u.name ? u.name.charAt(0) : 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-xs flex items-center gap-1.5">
                            {u.name}
                            <span className="px-1.5 py-0.2 rounded bg-gray-100 text-[10px] text-gray-600 font-normal">
                              {u.role ? u.role.replace('_', ' ') : 'Employee'}
                            </span>
                          </p>
                          <p className="text-[10px] text-gray-400">{u.email}</p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
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
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
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
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-xl shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50"
            >
              {busy ? 'Saving Task...' : task ? 'Update Repeated Task' : 'Create Repeated Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
