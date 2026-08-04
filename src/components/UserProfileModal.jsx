import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Briefcase, CheckCircle, Clock } from 'lucide-react';
import TaskDetailModal from './TaskDetailModal';

export default function UserProfileModal({ isOpen, onClose, user, initialTab = 'active' }) {
  const [tab, setTab] = useState(initialTab);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    if (isOpen && user) {
      setTab(initialTab);
      setLoading(true);
      api.getTasks({ assignee_id: user.id })
        .then(setTasks)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen, user, initialTab]);

  if (!isOpen || !user) return null;

  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const displayedTasks = tab === 'active' ? activeTasks : completedTasks;

  const handleTaskClick = (task) => {
    setSelectedTask(task);
  };

  const handleTaskUpdated = () => {
    api.getTasks({ assignee_id: user.id })
      .then(setTasks)
      .catch(() => {});
  };

  const priorityStyles = {
    low: 'text-slate-600 bg-slate-50 border-slate-200',
    medium: 'text-blue-600 bg-blue-50 border-blue-200',
    high: 'text-orange-600 bg-orange-50 border-orange-200',
    urgent: 'text-red-600 bg-red-50 border-red-200',
  };

  const statusStyles = {
    todo: 'text-gray-600 bg-gray-50 border-gray-200',
    in_progress: 'text-blue-600 bg-blue-50 border-blue-200',
    under_review: 'text-purple-600 bg-purple-50 border-purple-200',
    completed: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    blocked: 'text-red-600 bg-red-50 border-red-200',
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-155">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">{user.name}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-505">
              <span className="font-semibold px-2 py-0.5 rounded bg-amber-50 border border-amber-250 text-amber-700 capitalize">{user.role}</span>
              <span>&middot;</span>
              <span className="font-medium text-gray-600">{user.department}</span>
              <span>&middot;</span>
              <span className="text-gray-500">{user.email}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Progress stats */}
          <div className="bg-gray-50/50 border border-gray-150 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">Average Performance Progress</span>
              <span className="font-bold text-gray-900">{user.avg_progress || 0}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${user.avg_progress || 0}%` }} />
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5">{tasks.length} total tasks assigned</span>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setTab('active')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                tab === 'active'
                  ? 'border-amber-500 text-amber-600 font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Active Tasks ({activeTasks.length})
            </button>
            <button
              onClick={() => setTab('completed')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                tab === 'completed'
                  ? 'border-amber-500 text-amber-600 font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Completed Tasks ({completedTasks.length})
            </button>
          </div>

          {/* Task list container */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full" />
              </div>
            ) : displayedTasks.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs">No {tab} tasks assigned.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleTaskClick(t)}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-amber-600 transition-colors">
                        {t.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                        <span className="font-semibold text-gray-600">{t.category}</span>
                        <span>&middot;</span>
                        {t.estimated_hours > 0 && <span>{t.estimated_hours}h est.</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border capitalize ${priorityStyles[t.priority] || priorityStyles.medium}`}>
                        {t.priority}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border capitalize ${statusStyles[t.status] || statusStyles.todo}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <TaskDetailModal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onTaskUpdated={handleTaskUpdated}
      />
    </div>
  );
}
