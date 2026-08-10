import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../App';
import TaskVerificationModal from './TaskVerificationModal';

export default function TaskModal({ isOpen, onClose, onSaved, task, employees }) {
  const currentUser = useAuth();
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: '', description: '', color: 'slate', status: 'todo', priority: 'medium',
    category: 'General', assignee_id: '', start_date: '', due_date: '', estimated_hours: '',
  });
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [savedTask, setSavedTask] = useState(null);

  const assigneeList = [];
  const seenIds = new Set();
  
  if (employees) {
    employees.forEach(emp => {
      if (emp.role !== 'admin' || (currentUser && emp.id === currentUser.id)) {
        if (!seenIds.has(emp.id)) {
          assigneeList.push(emp);
          seenIds.add(emp.id);
        }
      }
    });
  }

  if (currentUser && !seenIds.has(currentUser.id)) {
    assigneeList.push({
      id: currentUser.id,
      name: `${currentUser.name} (You)`,
      role: currentUser.role,
      department: currentUser.department
    });
    seenIds.add(currentUser.id);
  }

  assigneeList.sort((a, b) => a.name.localeCompare(b.name));

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
      if (task.group_assignee_ids && Array.isArray(task.group_assignee_ids)) {
        setSelectedAssigneeIds(task.group_assignee_ids.map(Number));
      } else if (task.assignee_id) {
        setSelectedAssigneeIds([Number(task.assignee_id)]);
      } else {
        setSelectedAssigneeIds([]);
      }
    } else {
      setForm({
        title: '', description: '', color: 'slate', status: 'todo', priority: 'medium',
        category: 'General', assignee_id: currentUser ? String(currentUser.id) : '', start_date: '', due_date: '', estimated_hours: '',
      });
      if (currentUser && currentUser.role === 'employee') {
        setSelectedAssigneeIds([Number(currentUser.id)]);
      } else {
        setSelectedAssigneeIds([]);
      }
    }
    setError('');
  }, [task, isOpen, currentUser]);

  const toggleAssigneeSelection = (empId) => {
    if (currentUser?.role === 'employee' && empId !== currentUser?.id) {
      return;
    }
    setSelectedAssigneeIds(prev => {
      const next = prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId];
      return next;
    });
  };

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (currentUser?.role !== 'employee') {
      if (selectedAssigneeIds.length === 0) { setError('At least one assignee must be selected'); return; }
    }
    setBusy(true);
    try {
      if (isEdit) {
        const payload = {
          ...form,
          assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
          assignee_ids: selectedAssigneeIds,
          estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : 0,
        };
        const updated = await api.updateTask(task.id, payload);
        if (updated && updated.verificationRequired) {
          setSavedTask(updated);
          setShowVerifyModal(true);
          onSaved();
          return;
        }
      } else {
        const payload = {
          ...form,
          assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
          assignee_ids: selectedAssigneeIds,
          estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : 0,
        };
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
               {(() => {
                 const isGroupTask = task?.parent_id !== null || (task?.group_assignee_ids && task?.group_assignee_ids.length > 1);
                 const isAdminCreatedGroupTask = isGroupTask && task?.creator_role === 'admin';
                 const disableStatusField = isEdit && isAdminCreatedGroupTask && currentUser?.role !== 'admin';
                 return (
                   <select value={form.status} onChange={handleChange('status')} className="input-field" disabled={disableStatusField}>
                     <option value="todo">To Do</option>
                     <option value="in_progress">In Progress</option>
                     <option value="under_review">Under Review</option>
                     {(!(!isEdit && (currentUser?.role === 'employee' || currentUser?.role === 'manager'))) && (
                       <option value="completed">Completed</option>
                     )}
                   </select>
                 );
               })()}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                {isEdit && currentUser?.role !== 'admin' ? 'Assign To' : 'Assign To (Select Multiple to Group)'}
              </label>
              {isEdit && currentUser?.role !== 'admin' ? (
                <select value={form.assignee_id} onChange={handleChange('assignee_id')} className="input-field">
                  <option value="" disabled>Select Assignee</option>
                  {assigneeList.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              ) : (
                <div className="border border-gray-200 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1 bg-white">
                  {assigneeList.length === 0 ? (
                    <p className="text-xs text-gray-400 p-1">No assignees available</p>
                  ) : (
                    assigneeList.map((emp) => {
                      const isChecked = selectedAssigneeIds.includes(emp.id);
                      return (
                        <label key={emp.id} className="flex items-center gap-2 px-2 py-0.5 hover:bg-gray-50 rounded cursor-pointer text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedAssigneeIds(prev => prev.filter(id => id !== emp.id));
                              } else {
                                setSelectedAssigneeIds(prev => [...prev, emp.id]);
                              }
                            }}
                            className="rounded text-amber-500 focus:ring-amber-500 border-gray-300"
                          />
                          <span className="truncate">{emp.name} <span className="text-[10px] text-gray-400">({emp.department})</span></span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
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



          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-primary text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="btn-amber text-sm flex items-center gap-2 disabled:opacity-50">
              {busy ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {busy ? 'Saving...' : isEdit ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>

      <TaskVerificationModal
        isOpen={showVerifyModal}
        onClose={() => {
          setShowVerifyModal(false);
          onClose();
        }}
        task={savedTask || task}
        currentUser={currentUser}
      />
    </div>
  );
}
