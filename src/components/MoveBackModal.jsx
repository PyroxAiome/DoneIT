import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, AlertCircle } from 'lucide-react';

export default function MoveBackModal({
  isOpen,
  onClose,
  task,
  targetStage: initialTargetStage,
  fromStage: initialFromStage,
  onConfirm
}) {
  const [selectedTargetStage, setSelectedTargetStage] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pillar = (task?.pillar || 'general').toLowerCase();

  const getPillarStages = () => {
    if (pillar === 'vishwas') {
      return [
        { key: 'todo', label: '1. Issue Logged' },
        { key: 'rca_in_progress', label: '2. Root Cause Analysis (RCA)' },
        { key: 'in_progress', label: '3. Action In Progress' },
        { key: 'test_strategy', label: '4. Test Strategy' },
        { key: 'under_review', label: '5. Audit / QA Testing' },
        { key: 'completed', label: '6. Verified & Closed' }
      ];
    }
    if (pillar === 'avishkar') {
      return [
        { key: 'todo', label: '1. Idea / Proposal' },
        { key: 'feasibility_planning', label: '2. Feasibility Planning' },
        { key: 'in_progress', label: '3. Prototype / Dev' },
        { key: 'under_review', label: '4. Review & Evaluation' },
        { key: 'completed', label: '5. Integrated' }
      ];
    }
    return [
      { key: 'pending', label: '1. To-Do / Pending' },
      { key: 'in_progress', label: '2. In Progress' },
      { key: 'under_review', label: '3. Under Review' },
      { key: 'completed', label: '4. Completed' }
    ];
  };

  const allStages = getPillarStages();

  const normalizeKey = (k) => {
    if (!k) return 'pending';
    if (k === 'todo') return pillar === 'general' ? 'pending' : 'todo';
    return k;
  };

  const currStageKey = normalizeKey(task?.status);
  const currIdx = allStages.findIndex(s => s.key === currStageKey || (currStageKey === 'pending' && s.key === 'todo') || (currStageKey === 'todo' && s.key === 'pending'));

  // Eligible previous stages (all stages strictly before current stage)
  const previousStages = currIdx > 0 ? allStages.slice(0, currIdx) : [];

  useEffect(() => {
    if (isOpen) {
      setError('');
      setReason('');
      if (initialTargetStage?.key) {
        setSelectedTargetStage(initialTargetStage.key);
      } else if (previousStages.length > 0) {
        // Default to immediately preceding stage
        setSelectedTargetStage(previousStages[previousStages.length - 1].key);
      } else {
        setSelectedTargetStage('');
      }
    }
  }, [isOpen, initialTargetStage, task]);

  if (!isOpen || !task) return null;

  const currentStageObj = allStages[currIdx] || { key: task.status, label: task.status?.replace('_', ' ') };
  const targetStageObj = allStages.find(s => s.key === selectedTargetStage) || initialTargetStage;

  const quickSuggestions = [
    'Deliverables incomplete or missing details',
    'Needs revision based on review feedback',
    'Incorrect logic or edge case unhandled',
    'Verification failed test requirements'
  ];

  const handleAddSuggestion = (text) => {
    if (!reason.includes(text)) {
      setReason(prev => (prev ? `${prev}. ${text}` : text));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!selectedTargetStage) {
      setError('Please select a stage to move back to.');
      return;
    }
    if (!cleanReason) {
      setError('Please provide a reason for moving this task back.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onConfirm({
        target_stage: selectedTargetStage,
        target_stage_label: targetStageObj?.label || selectedTargetStage,
        from_stage: currentStageObj.key,
        from_stage_label: initialFromStage?.label || currentStageObj.label,
        reason: cleanReason
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to move task back.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs" onClick={onClose}>
      <div
        className="bg-white border border-gray-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <ArrowLeft className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                Move Task Back
              </h3>
              <p className="text-xs text-gray-500">
                Return task to a previous stage with feedback
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task & Transition Summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs space-y-2">
          <div className="font-semibold text-gray-900 truncate">
            {task.title}
          </div>
          <div className="flex items-center gap-2 text-gray-600 flex-wrap">
            <span>From: <strong className="text-gray-800">{initialFromStage?.label || currentStageObj.label}</strong></span>
            <span>➔</span>
            <span>To: <strong className="text-amber-700">{targetStageObj?.label || selectedTargetStage || 'Selected Stage'}</strong></span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Stage (Dropdown if multiple options, or preselected) */}
          {previousStages.length > 1 && !initialTargetStage && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Select Previous Stage <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedTargetStage}
                onChange={(e) => setSelectedTargetStage(e.target.value)}
                className="w-full text-xs p-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              >
                {previousStages.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Reason / Feedback Textarea */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
              <span>Why are you moving this task back? <span className="text-red-500">*</span></span>
              <span className="text-[11px] text-gray-400 font-normal">Required</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
              placeholder="Explain clearly what needs to be changed, corrected, or redone..."
              rows={3}
              className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none text-gray-900"
              required
              autoFocus
            />
          </div>

          {/* Quick Suggestions Chips */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Quick Suggestions:</p>
            <div className="flex flex-wrap gap-1.5">
              {quickSuggestions.map((s, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleAddSuggestion(s)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-amber-50 hover:text-amber-800 text-gray-700 transition-colors border border-gray-200 cursor-pointer"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !reason.trim() || !selectedTargetStage}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{submitting ? 'Moving Back...' : 'Move Back'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
