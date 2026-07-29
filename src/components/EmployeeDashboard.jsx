import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import TaskDetailModal from './TaskDetailModal';
import { Search, ListTodo, Filter, Plus, CheckCircle } from 'lucide-react';

const tabs = [
  { id: 'work', label: 'Work', icon: ListTodo },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
];

export default function EmployeeDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('work');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [detailTask, setDetailTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);

  const fetchTasks = () => {
    setLoading(true);
    const params = { assignee_id: user.id };
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    if (search) params.search = search;
    api.getTasks(params).then(setTasks).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTasks();
    window.addEventListener('task-updated', fetchTasks);
    return () => window.removeEventListener('task-updated', fetchTasks);
  }, [statusFilter, categoryFilter, search]);

  const statusOptions = ['', 'todo', 'in_progress', 'under_review', 'blocked'];

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      try { await api.deleteTask(deleteTarget.id); fetchTasks(); } catch {}
      setDeleteTarget(null);
    }
  };

  const displayedTasks = tasks.filter(t => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">My Workspace</h2>
          <p className="text-sm text-gray-500">Welcome back, {user.name.split(' ')[0]}</p>
        </div>
        {activeTab === 'work' && (
          <button onClick={() => { setEditTask(null); setShowTaskModal(true); }} className="btn-amber text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Task
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-200 p-1 rounded-xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setStatusFilter(''); }}
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

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
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
              onEdit={fetchTasks}
              onDelete={setDeleteTarget}
              onSelect={(t) => { setEditTask(t); setShowTaskModal(true); }}
              onViewDetail={setDetailTask}
            />
          ))}
        </div>
      )}

      <TaskModal isOpen={showTaskModal} onClose={() => { setShowTaskModal(false); setEditTask(null); }} onSaved={fetchTasks} task={editTask} />
      <TaskDetailModal isOpen={!!detailTask} onClose={() => setDetailTask(null)} task={detailTask} onTaskUpdated={fetchTasks} />
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
