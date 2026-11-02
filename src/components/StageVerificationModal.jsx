import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, ArrowRight, Clock, AlertTriangle, 
  ShieldCheck, History, MessageSquare, Copy, Check, 
  Award, ExternalLink 
} from 'lucide-react';
import { useAuth } from '../App';

export default function StageVerificationModal({
  isOpen,
  onClose,
  task,
  fromStageLabel,
  toStageLabel,
  fromStageKey,
  toStageKey,
  mode = 'submit_plan', // 'submit_plan' | 'revise_plan' | 'approve' | 'edit_feedback' | 'direct_advance' | 'awaiting_verification'
  pendingPlan = null,
  onConfirm
}) {
  const user = useAuth();
  const [commentText, setCommentText] = useState('');
  const [achievements, setAchievements] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Extract all stage verification and revision history
  let stageHistory = [];
  try {
    const raw = task?.stage_verifications;
    stageHistory = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
  } catch (e) {
    stageHistory = [];
  }
  if (!Array.isArray(stageHistory)) stageHistory = [];

  // Exclude current pending plan from prior history so it's not shown twice
  const priorHistory = stageHistory.filter(v => !pendingPlan || v.id !== pendingPlan.id);

  // Clean any legacy [Plan Section: ...] from submitted plan text
  const cleanPendingText = pendingPlan?.plan_notes
    ? pendingPlan.plan_notes.replace(/\[Plan Section:[^\]]*\]\s*/gi, '').trim()
    : (pendingPlan?.achievements || '');

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit_feedback') {
        setCommentText(pendingPlan?.review_comment || '');
      } else {
        setCommentText('');
      }
      setAchievements(pendingPlan?.achievements || cleanPendingText || '');
      setError('');
      setCopied(false);
    }
  }, [isOpen, mode, pendingPlan, cleanPendingText]);

  if (!isOpen || !task) return null;

  // Determine who will verify this task
  const mentorName = task.mentor_name || task.assignee_mentor_name;
  const verifierName = task.verifier_name || mentorName || 'Admin';

  const activeRedo = [...stageHistory].reverse().find(v => v.type === 'admin_redo_request' && v.status === 'redo_required');

  const generateWhatsAppMessage = () => {
    const stageName = (fromStageLabel && toStageLabel) 
      ? `${fromStageLabel} ➔ ${toStageLabel}` 
      : (toStageLabel || toStageKey || 'Next Stage');

    const salutation = `Hi ${verifierName}`;

    let msg = `${salutation},\n\nI would like to request stage verification for my task on DoneIt:\n📌 *${task.title}*\n📍 Stage: *${stageName}*`;

    const notesToInclude = achievements.trim() || cleanPendingText;
    if (notesToInclude) {
      msg += `\n\n🏆 *Work Done & Deliverables:*\n${notesToInclude}`;
    }

    msg += `\n\nPlease let me know when you are available for a quick review meeting so I can show you my work and we can finish it quickly. Thank you!`;
    return msg;
  };

  const getWhatsAppUrl = () => {
    const text = generateWhatsAppMessage();
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(generateWhatsAppMessage());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const handleSubmitPlan = async (e) => {
    if (e) e.preventDefault();
    const cleanAchievements = achievements.trim();
    if (!cleanAchievements) {
      setError('Please describe your achievements or work done for this stage.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onConfirm({
        action: 'submit_plan',
        from_stage: fromStageKey,
        to_stage: toStageKey,
        from_stage_label: fromStageLabel || fromStageKey,
        to_stage_label: toStageLabel || toStageKey,
        stage_label: `${fromStageLabel || fromStageKey} ➔ ${toStageLabel || toStageKey}`,
        achievements: cleanAchievements,
        plan_notes: cleanAchievements,
        is_revision: mode === 'revise_plan'
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit stage plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setError('');
    setSubmitting(true);
    try {
      await onConfirm({
        action: 'approve',
        from_stage: fromStageKey,
        to_stage: toStageKey,
        from_stage_label: fromStageLabel || fromStageKey,
        to_stage_label: toStageLabel || toStageKey,
        stage_label: `${fromStageLabel || fromStageKey} ➔ ${toStageLabel || toStageKey}`,
        comment: (commentText || 'Stage plan approved & verified').trim()
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to approve stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    const cleanComment = commentText.trim();
    if (!cleanComment) {
      setError('Please provide feedback explaining what changes are requested.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onConfirm({
        action: 'reject',
        from_stage: fromStageKey,
        to_stage: toStageKey,
        from_stage_label: fromStageLabel || fromStageKey,
        to_stage_label: toStageLabel || toStageKey,
        stage_label: `${fromStageLabel || fromStageKey} ➔ ${toStageLabel || toStageKey}`,
        comment: cleanComment
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send back stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateFeedback = async () => {
    const cleanComment = commentText.trim();
    if (!cleanComment) {
      setError('Please provide feedback explaining what changes are requested.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onConfirm({
        action: 'update_feedback',
        from_stage: fromStageKey,
        to_stage: toStageKey,
        from_stage_label: fromStageLabel || fromStageKey,
        to_stage_label: toStageLabel || toStageKey,
        stage_label: `${fromStageLabel || fromStageKey} ➔ ${toStageLabel || toStageKey}`,
        comment: cleanComment
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const isApproveMode = mode === 'approve';
  const isReviseMode = mode === 'revise_plan';
  const isEditFeedbackMode = mode === 'edit_feedback';
  const isAwaitingMode = mode === 'awaiting_verification';
  const isSubmitMode = mode === 'submit_plan' || isReviseMode;
  const isDirectMode = mode === 'direct_advance';

  const modalTitle = isReviseMode
    ? 'Revise Stage Achievements & Work'
    : (isEditFeedbackMode
        ? 'Edit Review Feedback'
        : (isAwaitingMode
            ? 'Stage Review Awaiting Verifier'
            : (isSubmitMode
                ? 'Stage Review Request & Work Done'
                : (isApproveMode ? 'Stage Verification' : 'Advance Stage'))));

  const renderHistoryTrail = () => {
    if (priorHistory.length === 0) return null;
    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/70">
        <div className="px-3 py-2 bg-gray-100/80 border-b border-gray-200 flex items-center justify-between text-xs font-bold text-gray-700">
          <div className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-gray-500" />
            <span>Stage Verification History</span>
          </div>
          <span className="text-[10px] font-semibold text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded-full shadow-2xs">
            {priorHistory.length} event{priorHistory.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="p-3 space-y-2.5 max-h-48 overflow-y-auto text-xs divide-y divide-gray-200/60">
          {priorHistory.map((item, idx) => {
            const cleanItemPlan = item.achievements || (item.plan_notes
              ? item.plan_notes.replace(/\[Plan Section:[^\]]*\]\s*/gi, '').trim()
              : '');
            return (
              <div key={item.id || idx} className="pt-2.5 first:pt-0 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                  <span className="font-bold text-gray-700">
                    {item.stage_label || `${item.from_stage_label || item.from_stage} ➔ ${item.to_stage_label || item.to_stage}`}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {item.timestamp ? new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>

                {cleanItemPlan && (
                  <div className="bg-white p-2 rounded-lg border border-gray-200 text-gray-700 space-y-0.5 shadow-2xs">
                    <span className="text-[10px] font-semibold text-gray-400 block uppercase">
                      Work by {item.submitted_by_name || 'Employee'}:
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed font-sans text-xs">{cleanItemPlan}</p>
                  </div>
                )}

                {item.review_comment && (
                  <div className="bg-amber-50/90 border border-amber-200/80 rounded-lg p-2 text-amber-950 space-y-0.5 shadow-2xs">
                    <span className="text-[10px] font-bold text-amber-800 block uppercase">
                      Feedback from {item.reviewed_by_name || 'Reviewer'} ({item.status === 'changes_requested' ? 'Revision Requested' : 'Approved'}):
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed font-sans text-xs italic">"{item.review_comment}"</p>
                  </div>
                )}

                {item.comment && !item.review_comment && (
                  <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-lg p-2 text-emerald-950 space-y-0.5 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-800 block uppercase">
                      Approved by {item.verified_by_name || 'Verifier'}:
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed font-sans text-xs">"{item.comment}"</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs" onClick={onClose}>
      <div 
        className="bg-white border border-gray-200 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">
              {modalTitle}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {fromStageLabel || fromStageKey} ➔ {toStageLabel || toStageKey}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Task Summary */}
        <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
          <p className="font-semibold text-gray-900 truncate">{task.title}</p>
          <div className="flex items-center justify-between text-gray-500 text-[11px] pt-1 border-t border-gray-200/60">
            <span>
              {task.creator_id && Number(task.creator_id) === Number(task.assignee_id) ? 'Self Created: ' : 'Assigned to: '}
              <strong className="text-gray-700">{task.assignee_name || 'Unassigned'}</strong>
            </span>
            <span>Verifier: <strong className="text-gray-700">{verifierName}</strong></span>
          </div>
        </div>

        {/* Admin Stage Redo Directive Callout */}
        {activeRedo && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-xs space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-rose-950 font-bold uppercase text-[10px]">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>↩️ Redo Directive ({activeRedo.target_stage_label || activeRedo.target_stage})</span>
            </div>
            <p className="text-rose-900 leading-normal text-xs bg-white/80 p-2.5 rounded-lg border border-rose-200">
              <strong>Instructions:</strong> "{activeRedo.reason}"
            </p>
            <p className="text-[11px] text-rose-700">
              Please update your deliverables for this stage and re-submit your achievements and updated plan.
            </p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* MODE 1: EMPLOYEE / MANAGER SUBMITS OR REVISES STAGE PLAN */}
        {isSubmitMode && (
          <form onSubmit={handleSubmitPlan} className="space-y-3.5">
            {/* Stage Restriction Notice */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs space-y-1 text-amber-900">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-800">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Stage Review Required by {verifierName}</span>
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Only the assigned verifier ({verifierName}) can approve and advance this task to <strong>{toStageLabel || toStageKey}</strong>. Document your achievements below and request review timing on WhatsApp.
              </p>
            </div>

            {/* Show Reviewer feedback, history, and previous plan when revising */}
            {isReviseMode && (
              <div className="space-y-2">
                {renderHistoryTrail()}

                {pendingPlan?.review_comment && (
                  <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Reviewer Feedback ({pendingPlan.reviewed_by_name || 'Reviewer'})</span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed mt-0.5 font-sans italic">
                      "{pendingPlan.review_comment}"
                    </p>
                  </div>
                )}

                {cleanPendingText && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-600 space-y-0.5">
                    <span className="font-semibold text-gray-500 text-[10px] uppercase block">
                      Previously Submitted ({pendingPlan.submitted_by_name || task.assignee_name || 'Employee'})
                    </span>
                    <p className="text-gray-700 whitespace-pre-wrap font-sans text-xs">
                      {cleanPendingText}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Achievements & Deliverables */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isReviseMode ? 'Updated Achievements & Deliverables' : 'Show Your Achievements & Deliverables'}</span>
                  <span className="text-red-500">*</span>
                </span>
                <span className="text-[10px] font-normal text-gray-400">What work was done?</span>
              </label>
              <textarea
                value={achievements}
                onChange={(e) => { setAchievements(e.target.value); setError(''); }}
                placeholder="Detail what you accomplished, completed milestones, findings, test results, or links to deliverables..."
                rows={4}
                className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-hidden bg-gray-50/50 focus:bg-white resize-y"
                required
                autoFocus
              />
            </div>

            {/* Review Guidance Box */}
            <div className="bg-blue-50/80 border border-blue-200/90 rounded-xl p-3 text-xs space-y-1 text-blue-950">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-blue-900">
                <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Review Verification Guidance</span>
              </div>
              <p className="text-[11px] text-blue-950 leading-relaxed font-medium">
                Show your work with your verifier at a given time. Be specific and clear with your task — it should finish fast.
              </p>
              <p className="text-[10px] text-blue-800/80">
                Request a convenient time directly from {verifierName} via the WhatsApp button below.
              </p>
            </div>

            {/* WhatsApp Integration Callout */}
            <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-800 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>Message {verifierName} on WhatsApp</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="text-[11px] text-gray-600 hover:text-gray-900 flex items-center gap-1 bg-white border border-gray-200 px-2 py-0.5 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                  <span>{copied ? 'Copied!' : 'Copy Msg'}</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-600 leading-normal">
                Directly WhatsApp {verifierName} to request a meeting time with your achievements and work pre-filled.
              </p>
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 fill-current" />
                <span>Open WhatsApp to Request Meeting Time</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-amber text-xs font-semibold px-4 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (isReviseMode ? 'Submitting Revision...' : 'Submitting Request...') : (isReviseMode ? 'Submit Revised Plan' : 'Submit Verification Request')}
              </button>
            </div>
          </form>
        )}

        {/* MODE 5: AWAITING VERIFICATION (VIEW STATUS & WHATSAPP FOLLOW-UP) */}
        {isAwaitingMode && (
          <div className="space-y-3.5">
            {renderHistoryTrail()}

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-amber-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Stage Review Awaiting Verifier</span>
                </span>
                <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full text-[10px]">
                  Under Verification
                </span>
              </div>
              <p className="text-gray-800 text-xs leading-relaxed font-medium">
                Show your work with your verifier at a given time. Be specific and clear with your task — it should finish fast.
              </p>

              {(pendingPlan?.achievements || cleanPendingText) && (
                <div className="bg-white p-2.5 rounded-lg border border-amber-200/80 text-gray-800 space-y-1">
                  <span className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1">
                    <Award className="w-3 h-3 text-amber-600" /> Achievements & Deliverables Submitted:
                  </span>
                  <p className="whitespace-pre-wrap leading-relaxed text-xs">{pendingPlan?.achievements || cleanPendingText}</p>
                </div>
              )}
            </div>

            {/* WhatsApp Follow-up Section */}
            <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-800 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>Connect with {verifierName} on WhatsApp</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="text-[11px] text-gray-600 hover:text-gray-900 flex items-center gap-1 bg-white border border-gray-200 px-2 py-0.5 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                  <span>{copied ? 'Copied!' : 'Copy Msg'}</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-600 leading-normal">
                Request a review meeting time with {verifierName} to verify and finish your stage fast.
              </p>
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 fill-current" />
                <span>Message {verifierName} on WhatsApp</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* MODE 2: BOSS / MENTOR / ADMIN APPROVAL */}
        {isApproveMode && (
          <div className="space-y-3">
            {renderHistoryTrail()}

            {pendingPlan && (
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-amber-900 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Submitted for Verification by {pendingPlan.submitted_by_name || 'Employee'}</span>
                  </span>
                  {pendingPlan.timestamp && (
                    <span className="text-gray-400 font-normal">
                      {new Date(pendingPlan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {pendingPlan.achievements ? (
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200/70 text-gray-800 space-y-1">
                    <span className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-600" /> Achievements & Deliverables:
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed text-xs">{pendingPlan.achievements}</p>
                  </div>
                ) : cleanPendingText ? (
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200/70 text-gray-800 space-y-1">
                    <span className="text-[10px] font-bold text-amber-800 uppercase">Stage Plan:</span>
                    <p className="whitespace-pre-wrap leading-relaxed text-xs">{cleanPendingText}</p>
                  </div>
                ) : null}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Review & Verification Comments
              </label>
              <textarea
                value={commentText}
                onChange={(e) => { setCommentText(e.target.value); setError(''); }}
                placeholder="Write review comments or approval feedback..."
                rows={3}
                className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-hidden bg-gray-50/50 focus:bg-white resize-y"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 flex-wrap">
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
              >
                Request Changes
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={submitting}
                  className="btn-amber bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {submitting ? 'Approving...' : 'Approve Stage'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODE 4: BOSS / MENTOR / ADMIN EDITING FEEDBACK OR DIRECTLY APPROVING */}
        {isEditFeedbackMode && (
          <div className="space-y-3">
            {renderHistoryTrail()}

            {/* Show Employee's Submitted Plan for reference */}
            {cleanPendingText && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px] text-gray-500 font-semibold">
                  <span>Submitted Achievements & Plan</span>
                  <span className="font-normal text-gray-400">By {pendingPlan.submitted_by_name || task.assignee_name || 'Employee'}</span>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed mt-1 font-sans">
                  {cleanPendingText}
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Your Feedback & Instructions for Employee <span className="text-red-500">*</span>
              </label>
              <textarea
                value={commentText}
                onChange={(e) => { setCommentText(e.target.value); setError(''); }}
                placeholder="Update your review feedback or instructions..."
                rows={3}
                className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-hidden bg-gray-50/50 focus:bg-white resize-y"
                autoFocus
              />
            </div>

            <p className="text-[11px] text-gray-500">
              You can update your instructions for {task.assignee_name || 'the employee'}, or approve the stage directly if no further changes are needed.
            </p>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 flex-wrap">
              <button
                type="button"
                onClick={handleUpdateFeedback}
                disabled={submitting}
                className="btn-amber text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Updating...' : 'Update Feedback'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {submitting ? 'Approving...' : 'Approve Stage'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODE 3: DIRECT ADVANCE BY BOSS / MENTOR / ADMIN */}
        {isDirectMode && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Verification Comments (Optional)
              </label>
              <textarea
                value={commentText}
                onChange={(e) => { setCommentText(e.target.value); setError(''); }}
                placeholder="Write any verification or transition notes..."
                rows={3}
                className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-hidden bg-gray-50/50 focus:bg-white resize-y"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleApprove}
                disabled={submitting}
                className="btn-amber text-xs font-semibold px-4 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {submitting ? 'Advancing...' : 'Advance Stage'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
