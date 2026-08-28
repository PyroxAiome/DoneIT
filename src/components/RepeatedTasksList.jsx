import { useState, useEffect } from 'react';
import {
  Repeat, Plus, Users, Search, MessageSquare, Edit2, Trash2, Calendar
} from 'lucide-react';
import { api } from '../lib/api';
import RepeatedTaskModal from './RepeatedTaskModal';
import RepeatedTaskDetailModal from './RepeatedTaskDetailModal';

export default function RepeatedTasksList({ user }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const isAdminOrMgr = user?.role === 'admin' || user?.role === 'manager';

  const loadTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getRepeatedTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load repeated tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleDeleteTask = async (task, e) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) {
      return;
    }
    try {
      await api.deleteRepeatedTask(task.id);
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to delete task');
    }
  };

  const filteredTasks = tasks.filter(t =>
    t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase()) ||
    t.members?.some(m => m.name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Repeat className="w-5 h-5 text-amber-500" />
            Repeated Tasks & Reviews
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Common recurring tasks (Recruitment, Weekly Syncs, Audits) reviewed regularly by Admin, HR & team
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white w-48 sm:w-60"
            />
          </div>

          {isAdminOrMgr && (
            <button
              onClick={() => {
                setEditingTask(null);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              New Repeated Task
            </button>
          )}
        </div>
      </div>

      {/* Tasks List / Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
          Loading repeated tasks...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <Repeat className="w-10 h-10 mx-auto text-amber-400/50" />
          <h3 className="font-bold text-gray-900 text-base">No Repeated Tasks Yet</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {search
              ? 'No tasks match your search.'
              : 'Add tasks like Recruitment, Weekly HR review, or Operations sync where Admin, HR, and team members sit together to review.'}
          </p>
          {isAdminOrMgr && !search && (
            <button
              onClick={() => {
                setEditingTask(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-xs shadow-sm hover:bg-amber-600 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Repeated Task
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map(t => (
            <div
              key={t.id}
              onClick={() => setSelectedTaskId(t.id)}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between cursor-pointer group"
            >
              <div>
                {/* Frequency & Action row */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 capitalize flex items-center gap-1">
                    <Repeat className="w-3 h-3 text-amber-700" />
                    {t.frequency} Review
                  </span>

                  {isAdminOrMgr && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTask(t);
                          setShowCreateModal(true);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                        title="Edit task"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {user.role === 'admin' && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTask(t, e)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-amber-600 transition-colors leading-snug">
                  {t.title}
                </h3>

                {/* Description */}
                {t.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {t.description}
                  </p>
                )}
              </div>

              {/* Bottom Card Footer */}
              <div className="pt-3.5 mt-3.5 border-t border-gray-100 space-y-2.5">
                {/* Assigned People Row */}
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3 text-gray-400" />
                    Reviewers ({t.members?.length || 0})
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    {Array.isArray(t.members) && t.members.length > 0 ? (
                      t.members.map((m, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-gray-100 text-[11px] font-medium text-gray-700 flex items-center gap-1"
                        >
                          <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center">
                            {m.name ? m.name.charAt(0) : 'U'}
                          </span>
                          {m.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-gray-400 italic">No reviewers assigned</span>
                    )}
                  </div>
                </div>

                {/* Review Count / Button */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-gray-500 flex items-center gap-1 font-medium text-[11px]">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                    {t.review_count || 0} discussion logs
                  </span>

                  <span className="text-amber-600 font-bold group-hover:underline text-[11px]">
                    View & Review →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <RepeatedTaskModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTask(null);
          }}
          task={editingTask}
          onSaved={loadTasks}
        />
      )}

      {/* Detail & Reviews Modal */}
      {selectedTaskId && (
        <RepeatedTaskDetailModal
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          taskId={selectedTaskId}
          user={user}
          onEdit={(taskToEdit) => {
            setSelectedTaskId(null);
            setEditingTask(taskToEdit);
            setShowCreateModal(true);
          }}
          onUpdated={loadTasks}
        />
      )}
    </div>
  );
}
