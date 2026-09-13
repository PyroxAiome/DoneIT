import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../App';

const roleLabels = {
  admin: 'Admin',
  manager: 'Manager',
  site_manager: 'Site Manager / QS',
  software_engineer: 'Software Engineer',
  electronics_engineer: 'Electronics Engineer',
  mechanical_engineer: 'Mechanical Engineer',
  production_engineer: 'Production Engineer',
  intern: 'Intern',
  hr: 'HR',
  employee: 'Employee'
};

const getRoleDisplay = (emp) => {
  if (!emp) return '';
  return roleLabels[emp.role] || (emp.role ? emp.role.replace('_', ' ') : 'Employee');
};

export default function TaskModal({ isOpen, onClose, onSaved, task, employees, onVerificationNeeded, projectId, initialPillar }) {
  const currentUser = useAuth();
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: '', description: '', color: 'slate', status: 'todo', priority: 'medium',
    pillar: 'general', category: 'General', assignee_id: '', start_date: '', due_date: '', estimated_hours: '',
    verifier_id: '',
  });
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [allUsersList, setAllUsersList] = useState([]);

  useEffect(() => {
    if (isOpen) {
      api.getEmployees(true).then(setAllUsersList).catch(() => {});
    }
  }, [isOpen]);

  const isManagerOrAdmin = currentUser && ['admin', 'manager', 'site_manager', 'sales_manager'].includes(currentUser.role);
  const sourceEmployees = (employees && employees.length > 0) ? employees : allUsersList;

  // Mentee IDs under currentUser
  const myMenteeIds = new Set(
    sourceEmployees
      .filter(emp => Number(emp.mentor_id) === Number(currentUser?.id))
      .map(emp => Number(emp.id))
  );
  const isMentor = myMenteeIds.size > 0;

  const assigneeList = [];
  const seenIds = new Set();

  sourceEmployees.forEach(emp => {
    if (seenIds.has(emp.id)) return;

    if (isManagerOrAdmin) {
      assigneeList.push(emp);
      seenIds.add(emp.id);
    } else if (isMentor) {
      if (emp.id === currentUser?.id || myMenteeIds.has(emp.id) || (task && Number(task.assignee_id) === emp.id)) {
        assigneeList.push(emp);
        seenIds.add(emp.id);
      }
    } else {
      if (emp.id === currentUser?.id || (task && Number(task.assignee_id) === emp.id)) {
        assigneeList.push(emp);
        seenIds.add(emp.id);
      }
    }
  });

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

  // Verifier candidates: anyone in the company (Admin, Manager, Engineer, Employee)
  const verifierCandidates = (allUsersList.length > 0 ? allUsersList : assigneeList).slice().sort((a, b) => a.name.localeCompare(b.name));

  const [projectsList, setProjectsList] = useState([]);

  useEffect(() => {
    if (isOpen && currentUser?.role === 'admin') {
      api.getProjects().then(setProjectsList).catch(() => {});
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        color: task.color || 'slate',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        pillar: task.pillar || 'general',
        category: task.category || 'General',
        duration_type: task.duration_type || (task.due_date ? 'exact' : 'exact'),
        is_red_flagged: !!task.is_red_flagged,
        red_flag_reason: task.red_flag_reason || '',
        assignee_id: task.assignee_id ? String(task.assignee_id) : '',
        start_date: task.start_date || '',
        due_date: task.due_date || '',
        estimated_hours: task.estimated_hours ? String(task.estimated_hours) : '',
        project_id: task.project_id ? String(task.project_id) : (projectId ? String(projectId) : ''),
        verifier_id: task.verifier_id ? String(task.verifier_id) : '',
        vacancies_count: task.vacancies_count || 0,
        hiring_stage: task.hiring_stage || 'Requisition Opened',
        hr_strategy_notes: task.hr_strategy_notes || '',
        hiring_department: task.hiring_department || task.category || 'Software',
        hiring_lead_id: task.hiring_lead_id ? String(task.hiring_lead_id) : '',
        way_of_hiring: task.way_of_hiring || '',
        training_module: task.training_module || '',
        training_level: task.training_level || 'Beginner',
        training_video_url: task.training_video_url || '',
        training_doc_url: task.training_doc_url || '',
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
        pillar: initialPillar || 'general', category: 'General', duration_type: 'exact',
        is_red_flagged: false, red_flag_reason: '',
        assignee_id: currentUser ? String(currentUser.id) : '', start_date: '', due_date: '', estimated_hours: '',
        project_id: projectId ? String(projectId) : '',
        verifier_id: '',
        vacancies_count: 0,
        hiring_stage: 'Requisition Opened',
        hr_strategy_notes: '',
        hiring_department: 'Software',
        hiring_lead_id: '',
        way_of_hiring: '',
        training_module: '',
        training_level: 'Beginner',
        training_video_url: '',
        training_doc_url: '',
      });
      if (currentUser && !isManagerOrAdmin && !isMentor) {
        setSelectedAssigneeIds([Number(currentUser.id)]);
      } else {
        setSelectedAssigneeIds([]);
      }
    }
    setError('');
  }, [task, isOpen, currentUser, projectId, initialPillar]);

  if (!isOpen) return null;

  const toggleAssigneeSelection = (empId) => {
    if (currentUser && !isManagerOrAdmin && !isMentor && empId !== currentUser?.id) {
      return;
    }
    setSelectedAssigneeIds(prev => {
      const next = prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId];
      return next;
    });
  };

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanTitle = form.title.trim();
    if (!cleanTitle) {
      setError('Title required');
      return;
    }
    if (form.is_red_flagged && !form.red_flag_reason.trim()) {
      setError('Please provide a reason / cause for red flagging this task.');
      return;
    }

    setBusy(true);
    try {
      let finalAssigneeIds = selectedAssigneeIds;
      if (!isManagerOrAdmin && !isMentor && currentUser) {
        finalAssigneeIds = [Number(currentUser.id)];
      }

      const payload = {
        ...form,
        title: cleanTitle,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : 0,
        project_id: form.project_id ? Number(form.project_id) : null,
        verifier_id: form.verifier_id ? Number(form.verifier_id) : null,
        vacancies_count: Number(form.vacancies_count || 0),
        hiring_lead_id: form.hiring_lead_id ? Number(form.hiring_lead_id) : null,
        assignee_id: isEdit ? (form.assignee_id ? Number(form.assignee_id) : null) : (finalAssigneeIds[0] || (form.assignee_id ? Number(form.assignee_id) : null)),
        assignee_ids: finalAssigneeIds.length > 0 ? finalAssigneeIds : undefined
      };

      let saved;
      if (isEdit) {
        saved = await api.updateTask(task.id, payload);
      } else {
        saved = await api.createTask(payload);
      }

      if (onSaved) onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="card max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pt-1 pb-2 border-b border-gray-100 z-10">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Title</label>
            <input
              value={form.title}
              onChange={handleChange('title')}
              className="input-field"
              placeholder="Task title"
              required
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={handleChange('description')}
              className="input-field min-h-[80px] py-2"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
              {!isManagerOrAdmin && !isMentor ? 'Assign To' : (isEdit && currentUser?.role !== 'admin' ? 'Assign To' : 'Assign To (Select Multiple to Group)')}
            </label>
            {!isManagerOrAdmin && !isMentor ? (
              <div className="input-field bg-gray-50 border-gray-200 text-gray-700 font-medium flex items-center justify-between cursor-not-allowed">
                <span>{currentUser?.name || 'Self'} <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 font-semibold ml-1">Self-Assigned</span></span>
                <span className="text-[10px] text-gray-400 font-normal">Only Managers/Admins/Mentors can assign tasks to others</span>
              </div>
            ) : isEdit && currentUser?.role !== 'admin' ? (
              <select value={form.assignee_id} onChange={handleChange('assignee_id')} className="input-field">
                <option value="" disabled>Select Assignee</option>
                {assigneeList.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({getRoleDisplay(emp)})</option>
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
                          onChange={() => toggleAssigneeSelection(emp.id)}
                          className="rounded text-amber-500 focus:ring-amber-500 border-gray-300"
                        />
                        <span className="truncate">{emp.name} <span className="text-[10px] text-gray-400">({getRoleDisplay(emp)})</span></span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Work Pillar / Track</label>
              <select value={form.pillar || 'general'} onChange={handleChange('pillar')} className="input-field">
                <option value="general">🌐 General / Other</option>
                <option value="vishwas">🛡️ Vishwas (Quality & Continuous Improvement)</option>
                <option value="avishkar">💡 Avishkar (Innovation & Product Optimization)</option>
                {(currentUser?.role === 'admin' || currentUser?.can_access_nirantar || form.pillar === 'nirantar') && (
                  <option value="nirantar">🔁 Nirantar (Hiring & Vacancies)</option>
                )}
                {(currentUser?.role === 'admin' || currentUser?.can_access_saksham || form.pillar === 'saksham') && (
                  <option value="saksham">⚡ Saksham (Capability Enablement)</option>
                )}
                {(currentUser?.role === 'admin' || currentUser?.can_access_upakaram || form.pillar === 'upakaram') && (
                  <option value="upakaram">🚀 Upakaram (Internal / Confidential Track)</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Category / Department</label>
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

          {form.pillar === 'nirantar' && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-950 uppercase tracking-wide border-b border-purple-200/60 pb-2">
                <span>🔁 Nirantar Recruitment & Vacancy Setup</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-purple-900 block mb-1">Open Vacancies (Count)</label>
                  <input type="number" min="0" value={form.vacancies_count || 0} onChange={handleChange('vacancies_count')} className="input-field bg-white" placeholder="e.g. 2" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-purple-900 block mb-1">Hiring Department</label>
                  <select
                    value={form.hiring_department || form.category || 'Software'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm(prev => ({ ...prev, hiring_department: val, category: val }));
                    }}
                    className="input-field bg-white"
                  >
                    <option value="Software">Software</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Production">Production</option>
                    <option value="HR & Admin">HR & Admin</option>
                    <option value="Quality">Quality</option>
                    <option value="Sales & Marketing">Sales & Marketing</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="Management">Management</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-purple-900 block mb-1">Specific Job Requirements & Hiring Needs</label>
                <textarea
                  value={form.hr_strategy_notes || ''}
                  onChange={handleChange('hr_strategy_notes')}
                  rows={2.5}
                  className="input-field bg-white text-xs"
                  placeholder="Describe role details, required qualifications, skills, experience level, and HR action plan..."
                />
              </div>
            </div>
          )}

          {form.pillar === 'saksham' && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 uppercase tracking-wide border-b border-amber-200/60 pb-2">
                <span>⚡ Saksham Skill Enablement & Training Setup</span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-amber-900 block mb-1">Training Level</label>
                <select
                  value={form.training_level || 'Beginner'}
                  onChange={handleChange('training_level')}
                  className="input-field bg-white text-xs"
                >
                  <option value="Beginner">Beginner (Foundational)</option>
                  <option value="Intermediate">Intermediate (Skill Upgrade)</option>
                  <option value="Advanced">Advanced (Expert / Leadership)</option>
                  <option value="Mandatory Compliance">Mandatory Compliance</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-amber-900 block mb-1">Training Video Link (URL)</label>
                <input
                  type="url"
                  value={form.training_video_url || ''}
                  onChange={handleChange('training_video_url')}
                  className="input-field bg-white text-xs"
                  placeholder="e.g. https://www.youtube.com/watch?v=... or Google Drive video link"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-amber-900 block mb-1">Document / SOP Reference Link (Optional)</label>
                <input
                  type="url"
                  value={form.training_doc_url || ''}
                  onChange={handleChange('training_doc_url')}
                  className="input-field bg-white text-xs"
                  placeholder="e.g. https://drive.google.com/... or document link"
                />
              </div>
            </div>
          )}

          {/* Task Verifier / Reviewer (Admin & Managers can assign anyone to verify) */}
          {['admin', 'manager'].includes(currentUser?.role) && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1 flex items-center justify-between">
                <span>Assign Task Verifier / Reviewer</span>
                <span className="text-[10px] text-amber-600 font-normal">Can verify & approve completion</span>
              </label>
              <select value={form.verifier_id} onChange={handleChange('verifier_id')} className="input-field">
                <option value="">Default (Admin / System)</option>
                {verifierCandidates.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({getRoleDisplay(emp)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {currentUser?.role === 'admin' && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Project</label>
              <select value={form.project_id} onChange={handleChange('project_id')} className="input-field">
                <option value="">None (General Work)</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Target Completion Option</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs font-semibold mb-2">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, duration_type: 'exact' }))}
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${form.duration_type === 'exact' || !form.duration_type ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <span>📅 Exact Date</span>
              </button>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, duration_type: 'short_term', due_date: '' }))}
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${form.duration_type === 'short_term' ? 'bg-amber-50 text-amber-800 border border-amber-300 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <span>⚡ Short-Term</span>
              </button>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, duration_type: 'long_term', due_date: '' }))}
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${form.duration_type === 'long_term' ? 'bg-purple-50 text-purple-800 border border-purple-300 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <span>🏔️ Long-Term</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={handleChange('start_date')} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Target Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={handleChange('due_date')}
                disabled={form.duration_type === 'short_term' || form.duration_type === 'long_term'}
                className="input-field disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Hours</label>
              <input type="number" value={form.estimated_hours} onChange={handleChange('estimated_hours')} className="input-field" placeholder="0" min="0" step="0.5" />
            </div>
          </div>

          {/* Red Flag Warning Box */}
          <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-red-900">
              <input
                type="checkbox"
                checked={form.is_red_flagged}
                onChange={(e) => setForm(prev => ({ ...prev, is_red_flagged: e.target.checked }))}
                className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
              />
              <span>🚩 Mark as Red Flagged Task (Forced Constraint / Compromise)</span>
            </label>

            {form.is_red_flagged && (
              <div className="space-y-1 pt-1 animate-in fade-in">
                <label className="text-[11px] font-semibold text-red-900 block">
                  Cause / Reason for Forced Compromise <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={form.red_flag_reason}
                  onChange={handleChange('red_flag_reason')}
                  placeholder="e.g. Inadequate time given due to urgent release, forced to proceed without full testing..."
                  className="input-field bg-white border-red-300 text-xs min-h-[60px]"
                  required={form.is_red_flagged}
                />
              </div>
            )}
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
