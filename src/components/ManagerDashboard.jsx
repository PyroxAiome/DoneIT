import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import TaskDetailModal from './TaskDetailModal';
import {
  BarChart3, Users, CheckCircle, Plus, Search, Filter,
  ListTodo, User, LayoutGrid
} from 'lucide-react';

export default function ManagerDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);

  const fetchAll = () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (search) params.search = search;
    Promise.all([
      api.getDashboardStats(),
      api.getTasks(params),
      api.getEmployees(),
    ]).then(([s, t, e]) => {
      setStats(s);
      setTasks(t);
      setEmployees(e);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [statusFilter, search]);

  const handleDeleteTask = async () => {
    if (deleteTask) {
      try { await api.deleteTask(deleteTask.id); fetchAll(); } catch {}
      setDeleteTask(null);
    }
  };

  const metricCards = stats ? [
    { label: 'Total Tasks', value: stats.totalTasks, icon: ListTodo, color: 'text-gray-500' },
    { label: 'Team Members', value: stats.totalEmployees, icon: Users, color: 'text-blue-500' },
    { label: 'Avg Completion', value: `${stats.avgCompletion}%`, icon: CheckCircle, color: 'text-emerald-500' },
  ] : [];

  const statusOptions = ['', 'todo', 'in_progress', 'under_review', 'completed'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Manager Dashboard</h2>
        <p className="text-sm text-gray-500">Team overview & task management</p>
      </div>

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

      {employees.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Team Members</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center gap-3 bg-white shadow-sm border border-gray-200 rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-medium text-gray-500">
                  {emp.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{emp.name}</p>
                  <p className="text-[10px] text-gray-400">{emp.department} &middot; {emp.task_count} tasks</p>
                </div>
                <div className="text-right">
                  <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden ml-auto">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${emp.avg_progress}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{emp.avg_progress}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
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
        <button onClick={() => { setEditTask(null); setShowTaskModal(true); }} className="btn-amber text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="card text-center py-12">
          <LayoutGrid className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No tasks found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={fetchAll} onDelete={setDeleteTask} onSelect={(t) => setEditTask(t)} onViewDetail={setDetailTask} />
          ))}
        </div>
      )}

      <TaskModal isOpen={showTaskModal} onClose={() => { setShowTaskModal(false); setEditTask(null); }} onSaved={fetchAll} task={editTask} employees={employees} />
      <TaskDetailModal isOpen={!!detailTask} onClose={() => setDetailTask(null)} task={detailTask} onTaskUpdated={fetchAll} />
      <ConfirmDeleteModal isOpen={!!deleteTask} onClose={() => setDeleteTask(null)} onConfirm={handleDeleteTask}
        title="Delete Task" message={`Delete "${deleteTask?.title}"?`} />
    </div>
  );
}
