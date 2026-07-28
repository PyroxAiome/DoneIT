import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, AlertCircle, Check } from 'lucide-react';

const colors = [
  { value: 'slate', label: 'Slate', class: 'bg-gray-400' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-emerald-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
];

export default function TaskModal({ isOpen, onClose, onSaved, task, employees }) {
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: '', description: '', color: 'slate', status: 'todo', priority: 'medium',
    category: 'General', assignee_id: '', start_date: '', due_date: '', estimated_hours: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        color: task.color || 'slate',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        category: task.category || 'General',
        assignee_id: task.assignee_id ? String(task.assignee_id) : '',
        start_date: task.start_date || '',
        due_date: task.due_date || '',
        estimated_hours: task.estimated_hours ? String(task.estimated_hours) : '',
      });
    } else {
      setForm({ title: '', description: '', color: 'slate', status: 'todo', priority: 'medium', category: 'General', assignee_id: '', start_date: '', due_date: '', estimated_hours: '' });
    }
    setError('');
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title) { setError('Title is required'); return; }
    setBusy(true);
    try {
      const payload = {
        ...form,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : 0,
      };
      if (isEdit) {
        await api.updateTask(task.id, payload);
      } else {
        await api.createTask(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm">
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Edit Task' : 'Create Task'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition-colors">
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
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Title</label>
            <input value={form.title} onChange={handleChange('title')} className="input-field" placeholder="Task title" />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Description</label>
            <textarea value={form.description} onChange={handleChange('description')} className="input-field" rows={2} placeholder="Optional description" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Status</label>
              <select value={form.status} onChange={handleChange('status')} className="input-field">
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="under_review">Under Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Priority</label>
              <select value={form.priority} onChange={handleChange('priority')} className="input-field">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Assign To</label>
              <select value={form.assignee_id} onChange={handleChange('assignee_id')} className="input-field">
                <option value="">Unassigned</option>
                {(employees || []).filter(e => e.role !== 'admin').map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Category</label>
              <select value={form.category} onChange={handleChange('category')} className="input-field">
                {!['General', 'Software', 'Electronics', 'Mechanical', 'Production'].includes(form.category) && form.category && (
                  <option value={form.category}>{form.category}</option>
                )}
                <option value="General">General</option>
                <option value="Software">Software</option>
                <option value="Electronics">Electronics</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Production">Production</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Start</label>
              <input type="date" value={form.start_date} onChange={handleChange('start_date')} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Due</label>
              <input type="date" value={form.due_date} onChange={handleChange('due_date')} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Hours</label>
              <input type="number" value={form.estimated_hours} onChange={handleChange('estimated_hours')} className="input-field" placeholder="0" min="0" step="0.5" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Color Theme</label>
            <div className="flex gap-2">
              {colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={`w-7 h-7 rounded-full ${c.class} ${form.color === c.value ? 'ring-2 ring-gray-400 ring-offset-2 ring-offset-white' : 'ring-1 ring-transparent'} transition-all`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-primary text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="btn-amber text-sm flex items-center gap-2 disabled:opacity-50">
              {busy ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {busy ? 'Saving...' : isEdit ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
