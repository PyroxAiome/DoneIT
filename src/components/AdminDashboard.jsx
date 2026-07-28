import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import AddUserModal from './AddUserModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import TaskDetailModal from './TaskDetailModal';
import {
  LayoutDashboard, Briefcase, Users, Plus, Search, Grid3X3, List,
  UserPlus, Trash2, Filter, ListTodo, CheckCircle,
  MessageSquare, X
} from 'lucide-react';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'team', label: 'Team', icon: Users },
];

export default function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState(null);
  const [compact, setCompact] = useState(false);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [deleteTask, setDeleteTask] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);

  const fetchAll = () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    if (search) params.search = search;
    if (employeeFilter) params.assignee_id = employeeFilter;

    Promise.all([
      api.getDashboardStats(),
      api.getTasks(params),
      api.getEmployees(true),
    ]).then(([s, t, e]) => {
      setStats(s);
      setTasks(t);
      setEmployees(e);
      if (employeeFilter) setSelectedEmp(e.find(emp => emp.id === Number(employeeFilter)));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
    window.addEventListener('task-updated', fetchAll);
    return () => window.removeEventListener('task-updated', fetchAll);
  }, [statusFilter, categoryFilter, search, employeeFilter]);

  const handleDeleteTask = async () => {
    if (deleteTask) {
      try { await api.deleteTask(deleteTask.id); fetchAll(); } catch {}
      setDeleteTask(null);
    }
  };

  const handleDeleteUser = async () => {
    if (deleteUser) {
      try { await api.deleteUser(deleteUser.id); fetchAll(); } catch {}
      setDeleteUser(null);
    }
  };

  const handleEditTask = (task) => {
    setEditTask(task);
    setShowTaskModal(true);
  };

  const handleViewEmployeeTasks = (emp) => {
    setEmployeeFilter(emp.id);
    setActiveTab('work');
  };

  const clearEmployeeFilter = () => {
    setEmployeeFilter(null);
    setSelectedEmp(null);
  };

  const metricCards = stats ? [
    { label: 'Total Tasks', value: stats.totalTasks, icon: ListTodo, color: 'text-gray-500' },
    { label: 'Team Members', value: stats.totalEmployees + stats.totalManagers, icon: Users, color: 'text-blue-500' },
    { label: 'Avg Completion', value: `${stats.avgCompletion}%`, icon: CheckCircle, color: 'text-emerald-500' },
  ] : [];

  const statusOptions = ['', 'todo', 'in_progress', 'under_review', 'completed'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Executive Dashboard</h2>
          <p className="text-sm text-gray-500">Full company overview</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-200 p-1 rounded-xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); if (tab.id === 'work') { setEmployeeFilter(null); setSelectedEmp(null); } }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {metricCards.map((m) => (
                <div key={m.label} className="card flex items-center gap-3">
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                  <div>
                    <p className="text-xs text-gray-500">{m.label}</p>
                    <p className="text-xl font-semibold text-gray-900">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {stats?.statusBreakdown && (
            <div className="card">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Status Breakdown</h3>
              <div className="flex gap-2 flex-wrap">
                {stats.statusBreakdown.map((s) => {
                  const total = stats.statusBreakdown.reduce((a, b) => a + b.cnt, 0);
                  const pct = total > 0 ? (s.cnt / total) * 100 : 0;
                  return (
                    <div key={s.status} className="flex-1 min-w-[80px]">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.status === 'completed' ? 'bg-emerald-500' : s.status === 'in_progress' ? 'bg-blue-500' : s.status === 'under_review' ? 'bg-purple-500' : 'bg-gray-400'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 text-center">{s.status.replace('_', ' ')} ({s.cnt})</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'work' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" placeholder="Search tasks..." />
              </div>
              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-gray-400" />
                {statusOptions.map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      statusFilter === s
                        ? 'bg-gray-800 text-white border-gray-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}>
                    {s ? s.replace('_', ' ') : 'All'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
            <div className="flex items-center gap-2">
              {employeeFilter && (
                <span className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                  {selectedEmp?.name}
                  <button onClick={clearEmployeeFilter} className="hover:bg-amber-100 rounded p-0.5"><X className="w-3 h-3" /></button>
                </span>
              )}
              <button onClick={() => setCompact(false)} className={`p-2 rounded-lg border transition-colors ${!compact ? 'bg-gray-800 text-white border-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'}`}>
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button onClick={() => setCompact(true)} className={`p-2 rounded-lg border transition-colors ${compact ? 'bg-gray-800 text-white border-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'}`}>
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => { setEditTask(null); setShowTaskModal(true); }} className="bg-amber-500 hover:bg-amber-400 text-white p-2 rounded-lg border border-amber-400/40 shadow-lg shadow-amber-200/40 transition-all" title="Create Task">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="card text-center py-12">
              <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{employeeFilter ? 'No tasks for this team member' : 'No tasks found'}</p>
            </div>
          ) : compact ? (
            <div className="space-y-1.5">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} compact onEdit={fetchAll} onDelete={setDeleteTask} onSelect={handleEditTask} onViewDetail={setDetailTask} />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} onEdit={fetchAll} onDelete={setDeleteTask} onSelect={handleEditTask} onViewDetail={setDetailTask} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowUserModal(true)} className="btn-amber text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Add Employee
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {employees.filter(e => e.role !== 'admin').map((emp) => (
              <div key={emp.id} className="bg-white border border-gray-200 rounded-xl p-4 group hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                onClick={() => handleViewEmployeeTasks(emp)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-sm font-medium text-gray-500">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{emp.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase">{emp.role} &middot; {emp.department}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteUser(emp); }}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete user"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${emp.avg_progress}%` }} />
                  </div>
                  <span className="text-[11px] text-gray-500">{emp.avg_progress}%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{emp.task_count} task{emp.task_count !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <TaskModal isOpen={showTaskModal} onClose={() => { setShowTaskModal(false); setEditTask(null); }} onSaved={fetchAll} task={editTask} employees={employees} />
      <AddUserModal isOpen={showUserModal} onClose={() => setShowUserModal(false)} onCreated={fetchAll} />
      <TaskDetailModal isOpen={!!detailTask} onClose={() => setDetailTask(null)} task={detailTask} onTaskUpdated={fetchAll} />
      <ConfirmDeleteModal isOpen={!!deleteTask} onClose={() => setDeleteTask(null)} onConfirm={handleDeleteTask}
        title="Delete Task" message={`Delete "${deleteTask?.title}"? This cannot be undone.`} />
      <ConfirmDeleteModal isOpen={!!deleteUser} onClose={() => setDeleteUser(null)} onConfirm={handleDeleteUser}
        title="Delete User" message={`Remove ${deleteUser?.name} and all their data? This cannot be undone.`} />
    </div>
  );
}
