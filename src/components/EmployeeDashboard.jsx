import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import TaskDetailModal from './TaskDetailModal';
import TaskVerificationModal from './TaskVerificationModal';
import { Search, ListTodo, Filter, Plus, CheckCircle, Users, X, FolderGit2, Repeat } from 'lucide-react';
import ProjectsList from './ProjectsList';
import ProjectDetail from './ProjectDetail';
import RepeatedTasksList from './RepeatedTasksList';

const tabs = [
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'work', label: 'Work', icon: ListTodo },
  { id: 'repeated_tasks', label: 'Repeated Tasks', icon: Repeat },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
  { id: 'team', label: 'Team', icon: Users },
];

export default function EmployeeDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('work');
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [verificationTask, setVerificationTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  const fetchTasksOnly = () => {
    setLoading(true);
    const params = { assignee_id: employeeFilter || user.id };
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    if (search) params.search = search;
    api.getTasks(params).then(setTasks).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    api.getEmployees(true)
      .then(setEmployees)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash) {
        setActiveTab('work');
        setEmployeeFilter(null);
        setSelectedEmp(null);
        return;
      }
      const parts = hash.substring(1).split('/');
      const tabId = parts[0];
      if (['projects', 'work', 'completed', 'team'].includes(tabId)) {
        setActiveTab(tabId);
        if (tabId !== 'projects') setSelectedProject(null);
      }
      if (parts[1] === 'employee' && parts[2]) {
        const empId = Number(parts[2]);
        setEmployeeFilter(empId);
        if (employees && employees.length > 0) {
          const emp = employees.find(e => e.id === empId);
          if (emp) setSelectedEmp(emp);
        }
      } else {
        setEmployeeFilter(null);
        setSelectedEmp(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [employees]);

  useEffect(() => {
    fetchTasksOnly();
    window.addEventListener('task-updated', fetchTasksOnly);
    return () => window.removeEventListener('task-updated', fetchTasksOnly);
  }, [statusFilter, categoryFilter, search, employeeFilter]);

  const statusOptions = ['', 'todo', 'in_progress', 'under_review'];

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      try { await api.deleteTask(deleteTarget.id); fetchTasksOnly(); } catch {}
      setDeleteTarget(null);
    }
  };

  const clearEmployeeFilter = () => {
    window.location.hash = 'team';
    setStatusFilter('');
  };

  const handleViewEmployeeTasks = (emp) => {
    window.location.hash = `work/employee/${emp.id}`;
  };

  const handleViewEmployeeTasksByStatus = (emp, status) => {
    window.location.hash = `work/employee/${emp.id}`;
  };

  const isReadOnly = employeeFilter !== null && Number(employeeFilter) !== user.id;

  const displayedTasks = tasks.filter(t => {
    if (selectedEmp) return true; // Show all tasks for the colleague (no active/completed sub-filtering)
    if (statusFilter) return true;
    if (activeTab === 'completed') {
      return t.status === 'completed';
    } else {
      return t.status !== 'completed';
    }
  }).sort((a, b) => {
    if (activeTab === 'work') {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
    }
    return 0;
  });

  const [quota, setQuota] = useState(null);

  const fetchQuota = () => {
    api.getTaskQuota().then(setQuota).catch(() => {});
  };

  useEffect(() => {
    fetchQuota();
  }, [tasks]);

  return (
    <div className="space-y-6">
      {selectedEmp ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">
                {selectedEmp.name}'s Profile / Work
                <span className="text-red-500 font-semibold text-xs ml-1.5 bg-red-50 px-1.5 py-0.5 rounded border border-red-200/50">Read Only</span>
              </h2>
              <p className="text-[9px] sm:text-[11px] text-gray-400 mt-0.5 uppercase font-semibold">{selectedEmp.role} &middot; {selectedEmp.department} &middot; {selectedEmp.email}</p>
            </div>
            <button onClick={clearEmployeeFilter} className="bg-gray-800 hover:bg-gray-700 text-white text-[10px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all shadow-sm">
              Back to Team
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">My Workspace</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-gray-500">Welcome back, {user.name.split(' ')[0]}</p>
              {quota && quota.isRestricted && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70" title="Weekly limit: 2 tasks, Monthly limit: 8 tasks. Managers/Admins can assign unlimited tasks to you.">
                  Creation quota: {quota.weekCount}/{quota.weekLimit} this week &middot; {quota.monthCount}/{quota.monthLimit} this month
                </span>
              )}
            </div>
          </div>
          {activeTab === 'work' && !isReadOnly && (
            <button
              onClick={() => { setEditTask(null); setShowTaskModal(true); }}
              disabled={quota?.isRestricted && !quota?.canCreate}
              className={`text-sm flex items-center gap-2 ${
                quota?.isRestricted && !quota?.canCreate
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed px-3 py-1.5 rounded-lg border border-gray-300'
                  : 'btn-amber'
              }`}
              title={quota?.isRestricted && !quota?.canCreate ? 'Weekly/Monthly task creation limit reached (max 2/week, 8/month). Please ask your Manager or Admin to assign tasks.' : ''}
            >
              <Plus className="w-4 h-4" /> New Task
            </button>
          )}
        </div>
      )}

      {/* Tabs list (hidden in employee profile drilldown) */}
      {!selectedEmp && (
        <div className="flex gap-1 bg-gray-200 p-1 rounded-xl w-full overflow-x-auto scrollbar-none shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { window.location.hash = tab.id; setStatusFilter(''); }}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-6 mt-4">
          {selectedProject ? (
            <ProjectDetail
              project={selectedProject}
              user={user}
              onBack={() => setSelectedProject(null)}
            />
          ) : (
            <ProjectsList
              user={user}
              onProjectSelect={(p) => setSelectedProject(p)}
            />
          )}
        </div>
      )}

      {activeTab === 'repeated_tasks' && (
        <div className="mt-4">
          <RepeatedTasksList user={user} projects={[]} />
        </div>
      )}

      {activeTab === 'team' && !selectedEmp ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {employees.filter(e => !['admin', 'manager'].includes(e.role)).map((emp) => {
              const isSelf = emp.id === user.id;
              return (
                <div key={emp.id} className={`bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer ${isSelf ? 'ring-1 ring-amber-500/30' : ''}`}
                  onClick={() => handleViewEmployeeTasks(emp)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-sm font-medium text-gray-500">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{emp.name} {isSelf && <span className="text-[10px] text-amber-600 bg-amber-50 px-1 py-0.2 rounded ml-1 font-semibold">You</span>}</p>
                        <p className="text-[10px] text-amber-700 font-semibold uppercase">{emp.role ? emp.role.replace('_', ' ') : ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${emp.avg_progress}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-500">{emp.avg_progress}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">{emp.task_count} task{emp.task_count !== 1 ? 's' : ''}</p>
                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewEmployeeTasksByStatus(emp, 'in_progress');
                      }}
                      className="flex-1 text-center py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-lg transition-colors border border-amber-200/50"
                    >
                      Active Tasks
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewEmployeeTasksByStatus(emp, 'completed');
                      }}
                      className="flex-1 text-center py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-lg transition-colors border border-emerald-200/50"
                    >
                      Completed
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab !== 'projects' ? (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="input-field pl-9"
                placeholder="Search tasks..."
              />
            </div>
            
            {activeTab === 'work' && (
              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-gray-400" />
                {statusOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border transition-colors font-semibold ${
                      statusFilter === s
                        ? 'bg-gray-800 text-white border-gray-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {s ? s.replace('_', ' ') : 'All'}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-semibold text-gray-400">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-[10px] sm:text-xs bg-white border border-gray-200 rounded-lg px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
              >
                <option value="">All Categories</option>
                <option value="General">General</option>
                <option value="Software">Software</option>
                <option value="Electronics">Electronics</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Production">Production</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
            </div>
          ) : displayedTasks.length === 0 ? (
            <div className="card text-center py-12">
              <ListTodo className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No tasks yet</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {displayedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  readOnly={isReadOnly}
                  onEdit={fetchTasksOnly}
                  onDelete={setDeleteTarget}
                  onSelect={(t) => { setEditTask(t); setShowTaskModal(true); }}
                  onViewDetail={setDetailTask}
                  onVerificationNeeded={setVerificationTask}
                />
              ))}
            </div>
          )}
        </>
      ) : null}

      <TaskModal isOpen={showTaskModal} onClose={() => { setShowTaskModal(false); setEditTask(null); }} onSaved={fetchTasksOnly} task={editTask} onVerificationNeeded={setVerificationTask} />
      <TaskDetailModal isOpen={!!detailTask} onClose={() => setDetailTask(null)} task={detailTask} onTaskUpdated={fetchTasksOnly} readOnly={isReadOnly} />
      <TaskVerificationModal isOpen={!!verificationTask} onClose={() => setVerificationTask(null)} task={verificationTask} />
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteTarget?.title}"?`}
      />
    </div>
  );
}
