import React, { useState } from 'react';
import { ShieldCheck, MessageSquare, X, CheckCircle2 } from 'lucide-react';

export default function VerificationReviewModal({ isOpen, onClose, task, onConfirm }) {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !task) return null;

  const quickTags = [
    '✅ Deliverable checked & verified',
    '📋 Daily logs reviewed & approved',
    '🎯 Target requirements met successfully',
    '👍 Satisfactory work completed'
  ];

  const handleAddTag = (tag) => {
    if (!commentText.includes(tag)) {
      setCommentText(prev => prev ? `${prev} | ${tag}` : tag);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanComment = commentText.trim();
    if (!cleanComment) {
      setError('Please write a verification review comment before completing this task.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onConfirm(cleanComment);
      setCommentText('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to complete task verification');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                Task Verification & Review
              </h3>
              <p className="text-xs text-emerald-700 font-medium">
                Mandatory verification feedback before completing task
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Task Info */}
        <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5 space-y-1">
          <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">Target Task</p>
          <p className="text-sm font-bold text-gray-900 truncate">{task.title}</p>
          {task.assignee_name && (
            <p className="text-xs text-gray-600">
              Assigned Worker: <span className="font-semibold text-gray-800">{task.assignee_name}</span>
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5 flex items-center justify-between">
              <span>Verification Review Notes <span className="text-red-500">*</span></span>
              <span className="text-[11px] text-gray-400 font-normal">Required</span>
            </label>
            <textarea
              value={commentText}
              onChange={(e) => { setCommentText(e.target.value); setError(''); }}
              placeholder="Write detailed verification feedback (e.g. Reviewed work logs, code tested, verified on-site, deliverables approved)..."
              rows={4}
              className="w-full text-xs sm:text-sm p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all bg-gray-50/50 focus:bg-white resize-none"
              required
            />
          </div>

          {/* Quick Tags */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Quick Review Tags:</p>
            <div className="flex flex-wrap gap-1.5">
              {quickTags.map((tag, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleAddTag(tag)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-emerald-100 hover:text-emerald-800 text-gray-700 transition-colors border border-gray-200/70 font-medium"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className="btn-emerald bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-all"
            >
              {submitting ? (
                <>Saving & Verifying...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Complete Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
