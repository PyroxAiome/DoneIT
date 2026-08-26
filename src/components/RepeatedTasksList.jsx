import { useState, useEffect } from 'react';
import {
  Repeat, Calendar, Clock, Plus, Users, Search, Filter, MessageSquare,
  AlertTriangle, CheckCircle2, MoreVertical, Edit2, Trash2, Shield,
  ChevronRight, ArrowUpRight, CheckCircle
} from 'lucide-react';
import { api } from '../lib/api';
import RepeatedTaskModal from './RepeatedTaskModal';
import RepeatedTaskDetailModal from './RepeatedTaskDetailModal';

const statusOutcomeStyles = {
  on_track: { label: 'On Track', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  needs_attention: { label: 'Needs Attention', bg: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  blocked: { label: 'Blockers', bg: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  completed: { label: 'Completed', bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' }
};

export default function RepeatedTasksList({ user, projects = [] }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters & Search
  const [search, setSearch] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');

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
    if (!confirm(`Are you sure you want to delete the repeated task "${task.title}"? All meeting review history will be deleted.`)) {
      return;
    }
    try {
      await api.deleteRepeatedTask(task.id);
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to delete task');
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchSearch =
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase());
    const matchFreq = frequencyFilter === 'all' || t.frequency === frequencyFilter;
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchFreq && matchStatus;
  });

  // Calculate quick metrics
  const activeCount = tasks.filter(t => t.status === 'active').length;
  const weeklyCount = tasks.filter(t => t.frequency === 'weekly').length;
  const totalReviews = tasks.reduce((sum, t) => sum + (Number(t.review_count) || 0), 0);
  const needsAttentionCount = tasks.filter(t => t.latest_review?.status_outcome === 'needs_attention' || t.latest_review?.status_outcome === 'blocked').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
              <Repeat className="w-3 h-3" /> Recurring Operations
            </span>
            <span className="text-xs text-gray-400">Periodic Business & Team Syncs</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Repeated Tasks & Periodic Reviews
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-2xl">
            Track ongoing routine activities (Weekly Recruitment, Site Audits, Sprint Reviews) with assigned multi-person review teams and historical meeting discussion logs.
          </p>
        </div>

        {isAdminOrMgr && (
          <button
            onClick={() => {
              setEditingTask(null);
              setShowCreateModal(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-500/20 transition-all text-xs sm:text-sm whitespace-nowrap self-start md:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            New Repeated Task
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Active Recurring</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Weekly Syncs</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{weeklyCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Reviews Logged</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{totalReviews}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Needs Attention</p>
          <p className="text-2xl font-black text-red-600 mt-1">{needsAttentionCount}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Frequency Filters */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {['all', 'daily', 'weekly', 'biweekly', 'monthly'].map(f => (
              <button
                key={f}
                onClick={() => setFrequencyFilter(f)}
                className={`px-3 py-1 rounded-md font-semibold transition-all capitalize ${
                  frequencyFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'all' ? 'All Frequencies' : f}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="p-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="paused">Paused Only</option>
            <option value="completed">Completed Only</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[200px] sm:min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search repeated tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Tasks Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
          Loading repeated tasks...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <Repeat className="w-12 h-12 mx-auto text-amber-500/40" />
          <h3 className="font-bold text-gray-900 text-base">No Repeated Tasks Found</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {search || frequencyFilter !== 'all' || statusFilter !== 'all'
              ? 'Try changing your search keywords or filter criteria.'
              : 'Create your first repeated task (e.g. Weekly Recruitment, Safety Review) to schedule recurring syncs with your team.'}
          </p>
          {isAdminOrMgr && !search && frequencyFilter === 'all' && (
            <button
              onClick={() => {
                setEditingTask(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-500/20 hover:bg-amber-600 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Repeated Task
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map(t => {
            const latestOutcome = t.latest_review?.status_outcome;
            const outcomeConfig = latestOutcome ? statusOutcomeStyles[latestOutcome] : null;

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTaskId(t.id)}
                className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200/80 flex items-center gap-1 uppercase tracking-wider">
                      <Repeat className="w-3 h-3 text-amber-700" />
                      {t.frequency}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">
                        {t.category}
                      </span>
                      {isAdminOrMgr && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
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
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-bold text-gray-900 text-sm group-hover:text-amber-600 transition-colors leading-snug line-clamp-2">
                    {t.title}
                  </h3>
                  {t.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {t.description}
                    </p>
                  )}

                  {/* Schedule Details */}
                  <div className="mt-3 p-2.5 bg-gray-50/80 rounded-xl border border-gray-100 flex items-center justify-between text-[11px] text-gray-700">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      {t.meeting_day}s
                    </span>
                    <span className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {t.meeting_time}
                    </span>
                  </div>
                </div>

                {/* Bottom Section: Members & Latest Review */}
                <div className="pt-4 mt-4 border-t border-gray-100 space-y-2.5">
                  {/* Members Avatars Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center -space-x-1.5 overflow-hidden">
                      {Array.isArray(t.members) && t.members.length > 0 ? (
                        t.members.slice(0, 4).map((m, idx) => (
                          <div
                            key={idx}
                            className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-[10px] flex items-center justify-center border-2 border-white uppercase shadow-xs"
                            title={`${m.name} (${m.role || 'Reviewer'})`}
                          >
                            {m.name ? m.name.charAt(0) : 'U'}
                          </div>
                        ))
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">No members assigned</span>
                      )}
                      {t.members && t.members.length > 4 && (
                        <span className="text-[10px] font-bold text-gray-500 pl-2">
                          +{t.members.length - 4} more
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-gray-500 flex items-center gap-1 font-semibold">
                      <MessageSquare className="w-3 h-3 text-amber-600" />
                      {t.review_count || 0} reviews
                    </span>
                  </div>

                  {/* Latest Review Status */}
                  {t.latest_review ? (
                    <div className="flex items-center justify-between text-[11px] bg-gray-50/60 p-2 rounded-lg border border-gray-100">
                      <span className="text-gray-500 text-[10px]">
                        Last: {new Date(t.latest_review.review_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      {outcomeConfig && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${outcomeConfig.bg}`}>
                          {outcomeConfig.label}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic text-center py-1">
                      No review logged yet — Click to log
                    </p>
                  )}
                </div>
              </div>
            );
          })}
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
          projects={projects}
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
