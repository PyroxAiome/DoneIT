import React, { useState } from 'react';
import { ShieldCheck, MessageSquare, X, CheckCircle2, ArrowRight } from 'lucide-react';

export default function StageVerificationModal({
  isOpen,
  onClose,
  task,
  fromStageLabel,
  toStageLabel,
  fromStageKey,
  toStageKey,
  onConfirm
}) {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !task) return null;

  const quickTags = [
    '✅ Stage deliverables checked & verified',
    '🔬 Root cause analysis / plan approved',
    '🛠️ Execution progress reviewed',
    '🧪 QA & test results verified',
    '👍 Satisfactory stage performance'
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
      setError('Please write a stage verification comment before advancing this task stage.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onConfirm({
        from_stage: fromStageKey,
        to_stage: toStageKey,
        stage_label: `${fromStageLabel || 'Previous Stage'} ➔ ${toStageLabel || 'Next Stage'}`,
        comment: cleanComment
      });
      setCommentText('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record stage verification');
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
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                Mentor Stage Verification
              </h3>
              <p className="text-xs text-indigo-700 font-medium">
                Verify & sign-off on Intern stage transition
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Stage Transition Info */}
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 space-y-2">
          <p className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">Target Task & Stage Move</p>
          <p className="text-sm font-bold text-gray-900 truncate">{task.title}</p>
          {task.assignee_name && (
            <p className="text-xs text-gray-600">
              Intern Assignee: <span className="font-semibold text-gray-800">{task.assignee_name}</span>
            </p>
          )}
          
          <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-gray-800 border-t border-indigo-100">
            <span className="px-2.5 py-1 rounded-md bg-white border border-indigo-200 text-indigo-900 shadow-2xs">
              {fromStageLabel || fromStageKey}
            </span>
            <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="px-2.5 py-1 rounded-md bg-indigo-600 text-white shadow-2xs">
              {toStageLabel || toStageKey}
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5 flex items-center justify-between">
              <span>Mentor Verification Feedback <span className="text-red-500">*</span></span>
              <span className="text-[11px] text-gray-400 font-normal">Required for Interns</span>
            </label>
            <textarea
              value={commentText}
              onChange={(e) => { setCommentText(e.target.value); setError(''); }}
              placeholder="Write stage verification feedback (e.g. Code reviewed, daily log inspected, output verified on-site, ready for next stage)..."
              rows={4}
              className="w-full text-xs sm:text-sm p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all bg-gray-50/50 focus:bg-white resize-none"
              required
            />
          </div>

          {/* Quick Tags */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Quick Review Tags:</p>
            <div className="flex flex-wrap gap-1.5">
              {quickTags.map((tag, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-gray-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border border-gray-200 hover:border-indigo-200 rounded-lg transition-colors text-left"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Verifying...' : 'Verify & Advance Stage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
