import { useState, useEffect } from 'react';
import {
  X, Calendar, Repeat, Users, Plus, MessageSquare, Edit2, Check
} from 'lucide-react';
import { api } from '../lib/api';

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
    action_items: ''
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
        action_items: ''
      });
    }
  }, [isOpen, taskId]);

  const handleLogReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewForm.discussion_notes.trim()) return;
    setBusyReview(true);
    try {
      await api.logRepeatedTaskReview(taskId, {
        ...reviewForm,
        status_outcome: 'on_track'
      });
      setReviewForm({
        review_date: new Date().toISOString().split('T')[0],
        discussion_notes: '',
        action_items: ''
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
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0 mt-0.5">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  {task?.frequency || 'Weekly'} Review
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-base sm:text-lg leading-snug">
                {task?.title || 'Repeated Task'}
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading task details & discussions...</div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>
          ) : task ? (
            <>
              {/* Description */}
              {task.description && (
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {task.description}
                </div>
              )}

              {/* Reviewers List */}
              <div className="p-3.5 bg-amber-50/40 border border-amber-200/60 rounded-xl space-y-2">
                <p className="font-bold text-gray-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-600" />
                  Assigned Reviewers ({task.members?.length || 0})
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {task.members && task.members.length > 0 ? (
                    task.members.map(m => (
                      <div
                        key={m.user_id || m.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-lg shadow-xs"
                      >
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[9px] uppercase">
                          {m.name ? m.name.charAt(0) : 'U'}
                        </span>
                        <span className="font-semibold text-gray-800 text-xs">{m.name}</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          ({m.role ? m.role.replace('_', ' ') : 'Reviewer'})
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 italic">No reviewers assigned yet.</p>
                  )}
                </div>
              </div>

              {/* ── Meeting Reviews & Discussion Section ── */}
              <div className="pt-2 border-t border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-600" />
                    Meeting Reviews & Discussion Log
                  </h4>

                  <button
                    type="button"
                    onClick={() => setShowLogReview(!showLogReview)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {showLogReview ? 'Cancel' : 'Add Meeting Notes'}
                  </button>
                </div>

                {/* Log Meeting Review Collapse Form */}
                {showLogReview && (
                  <form onSubmit={handleLogReviewSubmit} className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
                    <h5 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      Record Meeting Notes & Discussion
                    </h5>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Meeting Date *</label>
                      <input
                        type="date"
                        value={reviewForm.review_date}
                        onChange={e => setReviewForm({ ...reviewForm, review_date: e.target.value })}
                        className="w-full sm:w-48 p-2 border border-gray-300 rounded-lg bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Discussion Summary *
                      </label>
                      <textarea
                        rows={3}
                        placeholder="What did Admin, HR, and team discuss in this meeting? What decisions were made?..."
                        value={reviewForm.discussion_notes}
                        onChange={e => setReviewForm({ ...reviewForm, discussion_notes: e.target.value })}
                        className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Next Action Items (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Key next steps, follow-ups for next review..."
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
                        {busyReview ? 'Saving...' : 'Save Discussion'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Reviews History Timeline */}
                <div className="space-y-3">
                  {!task.reviews || task.reviews.length === 0 ? (
                    <div className="p-6 text-center bg-gray-50 border border-gray-200 border-dashed rounded-2xl text-gray-400">
                      <MessageSquare className="w-8 h-8 mx-auto mb-1 opacity-40 text-amber-600" />
                      <p className="font-semibold text-gray-600">No meeting notes logged yet.</p>
                      <p className="text-[11px] mt-0.5">Click "Add Meeting Notes" to log your first discussion.</p>
                    </div>
                  ) : (
                    task.reviews.map((r, index) => (
                      <div
                        key={r.id || index}
                        className="p-3.5 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px]">
                              {r.logged_by_name ? r.logged_by_name.charAt(0) : 'U'}
                            </span>
                            <span className="font-bold text-gray-900 text-xs">{r.logged_by_name}</span>
                          </div>

                          <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {new Date(r.review_date || r.created_at).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        {/* Notes */}
                        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-gray-800 text-xs whitespace-pre-wrap leading-relaxed">
                          {r.discussion_notes}
                        </div>

                        {/* Action Items */}
                        {r.action_items && (
                          <div className="p-2.5 bg-amber-50/50 border border-amber-200/50 rounded-xl space-y-0.5">
                            <p className="font-bold text-amber-900 text-[10px] uppercase tracking-wider flex items-center gap-1">
                              <Check className="w-3 h-3 text-amber-600 stroke-[3]" />
                              Next Action Items:
                            </p>
                            <p className="text-gray-700 text-xs whitespace-pre-wrap pl-3">
                              {r.action_items}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
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
