import { useState, useEffect } from 'react';
import {
  X, Calendar, Clock, Repeat, Users, CheckCircle2, AlertTriangle, AlertCircle,
  Plus, MessageSquare, Tag, FolderGit2, Edit2, ShieldAlert, Check, ChevronDown, ChevronUp, History
} from 'lucide-react';
import { api } from '../lib/api';

const statusOutcomeStyles = {
  on_track: { label: 'On Track', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  needs_attention: { label: 'Needs Attention', bg: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertTriangle },
  blocked: { label: 'Critical Blockers', bg: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle },
  completed: { label: 'Milestone Completed', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2 }
};

export default function RepeatedTaskDetailModal({ isOpen, onClose, taskId, user, onEdit, onUpdated }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Log Review Form state
  const [showLogReview, setShowLogReview] = useState(false);
  const [busyReview, setBusyReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    review_date: new Date().toISOString().split('T')[0],
    discussion_notes: '',
    action_items: '',
    status_outcome: 'on_track'
  });

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getRepeatedTask(taskId);
      setTask(data);
    } catch (err) {
      setError(err.message || 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      loadTask();
      setShowLogReview(false);
      setReviewForm({
        review_date: new Date().toISOString().split('T')[0],
        discussion_notes: '',
        action_items: '',
        status_outcome: 'on_track'
      });
    }
  }, [isOpen, taskId]);

  const handleLogReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewForm.discussion_notes.trim()) return;
    setBusyReview(true);
    try {
      await api.logRepeatedTaskReview(taskId, reviewForm);
      setReviewForm({
        review_date: new Date().toISOString().split('T')[0],
        discussion_notes: '',
        action_items: '',
        status_outcome: 'on_track'
      });
      setShowLogReview(false);
      loadTask();
      if (onUpdated) onUpdated();
    } catch (err) {
      alert(err.message || 'Failed to save review');
    } finally {
      setBusyReview(false);
    }
  };

  if (!isOpen) return null;

  const isAdminOrMgr = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0 mt-0.5">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  {task?.frequency || 'Weekly'}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700">
                  {task?.category || 'General'}
                </span>
                {task?.status === 'active' ? (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    ● Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-200 text-gray-700 capitalize">
                    {task?.status}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-gray-900 text-lg leading-snug">
                {task?.title || 'Repeated Task Details'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isAdminOrMgr && task && (
              <button
                onClick={() => {
                  onClose();
                  if (onEdit) onEdit(task);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading task details & review history...</div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>
          ) : task ? (
            <>
              {/* Meeting Schedule & Meta Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gradient-to-br from-gray-50 to-amber-50/30 border border-gray-200/80 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Meeting Day</p>
                    <p className="font-bold text-gray-900 text-xs">{task.meeting_day || 'Weekly'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Meeting Time</p>
                    <p className="font-bold text-gray-900 text-xs">{task.meeting_time || '10:00 AM'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Reviews Logged</p>
                    <p className="font-bold text-gray-900 text-xs">{task.reviews ? task.reviews.length : 0} Review Sessions</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {task.description && (
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-700 text-[11px] uppercase tracking-wider">Objectives & Scope</h4>
                  <p className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {task.description}
                  </p>
                </div>
              )}

              {/* Assigned Team Members & Reviewers */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-700 text-[11px] uppercase tracking-wider flex items-center justify-between">
                  <span>Assigned Responsible Team & Reviewers ({task.members?.length || 0})</span>
                </h4>

                <div className="flex flex-wrap gap-2">
                  {task.members && task.members.length > 0 ? (
                    task.members.map(m => (
                      <div
                        key={m.user_id || m.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl"
                      >
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] uppercase">
                          {m.name ? m.name.charAt(0) : 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-indigo-950 text-xs">{m.name}</p>
                          <p className="text-[10px] text-indigo-600 font-medium capitalize">
                            {m.role ? m.role.replace('_', ' ') : 'Reviewer'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 italic">No specific team members assigned yet.</p>
                  )}
                </div>
              </div>

              {/* ── Meeting Reviews & Discussion Section ── */}
              <div className="pt-3 border-t border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-amber-600" />
                      Periodic Meeting Reviews & Discussion History
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Chronological log of meeting notes, decisions, and action items
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowLogReview(!showLogReview)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {showLogReview ? 'Hide Form' : 'Log Meeting Review'}
                  </button>
                </div>

                {/* Log Meeting Review Collapse Form */}
                {showLogReview && (
                  <form onSubmit={handleLogReviewSubmit} className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
                    <h5 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      Record Today's Review Meeting Notes
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Meeting Date *</label>
                        <input
                          type="date"
                          value={reviewForm.review_date}
                          onChange={e => setReviewForm({ ...reviewForm, review_date: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Status Outcome *</label>
                        <select
                          value={reviewForm.status_outcome}
                          onChange={e => setReviewForm({ ...reviewForm, status_outcome: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-lg bg-white font-semibold"
                        >
                          <option value="on_track">🟢 On Track (Healthy)</option>
                          <option value="needs_attention">🟡 Needs Attention / Action Required</option>
                          <option value="blocked">🔴 Critical Blockers Encountered</option>
                          <option value="completed">🔵 Milestone Completed</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Meeting Discussion Summary & Decisions *
                      </label>
                      <textarea
                        rows={3}
                        placeholder="What was discussed in this meeting? What were the key updates or decisions made?..."
                        value={reviewForm.discussion_notes}
                        onChange={e => setReviewForm({ ...reviewForm, discussion_notes: e.target.value })}
                        className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Action Items & Next Steps (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="1. HR to schedule interviews with 3 candidates&#10;2. Tech team to review resumes by Friday..."
                        value={reviewForm.action_items}
                        onChange={e => setReviewForm({ ...reviewForm, action_items: e.target.value })}
                        className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowLogReview(false)}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={busyReview}
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-sm"
                      >
                        {busyReview ? 'Submitting...' : 'Save Review Entry'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Reviews History Timeline */}
                <div className="space-y-3">
                  {!task.reviews || task.reviews.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 border border-gray-200 border-dashed rounded-2xl text-gray-400">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-600" />
                      <p className="font-semibold text-gray-600">No meeting reviews logged yet.</p>
                      <p className="text-[11px] mt-0.5">Click "Log Meeting Review" above after your first sync to keep everyone aligned.</p>
                    </div>
                  ) : (
                    task.reviews.map((r, index) => {
                      const outcomeConfig = statusOutcomeStyles[r.status_outcome] || statusOutcomeStyles.on_track;
                      const OutcomeIcon = outcomeConfig.icon;

                      return (
                        <div
                          key={r.id || index}
                          className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-3 hover:border-amber-200 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center font-bold text-xs">
                                {r.logged_by_name ? r.logged_by_name.charAt(0) : 'U'}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-xs">{r.logged_by_name}</p>
                                <p className="text-[10px] text-gray-400">
                                  Logged on {new Date(r.review_date || r.created_at).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                </p>
                              </div>
                            </div>

                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 ${outcomeConfig.bg}`}>
                              <OutcomeIcon className="w-3.5 h-3.5" />
                              {outcomeConfig.label}
                            </span>
                          </div>

                          {/* Notes */}
                          <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 text-gray-800 text-xs whitespace-pre-wrap leading-relaxed">
                            {r.discussion_notes}
                          </div>

                          {/* Action Items */}
                          {r.action_items && (
                            <div className="p-3 bg-amber-50/40 border border-amber-200/50 rounded-xl space-y-1">
                              <p className="font-bold text-amber-900 text-[10px] uppercase tracking-wider flex items-center gap-1">
                                <Check className="w-3 h-3 text-amber-600 stroke-[3]" />
                                Next Action Items:
                              </p>
                              <p className="text-gray-700 text-xs whitespace-pre-wrap pl-4">
                                {r.action_items}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
