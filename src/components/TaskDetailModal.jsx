import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../App';
import VerificationReviewModal from './VerificationReviewModal';
import MoveBackModal from './MoveBackModal';
import { X, Send, Edit3, Trash2, Check, X as XIcon, MessageSquare, FileText, Reply, Calendar, ThumbsUp, ThumbsDown, GitMerge, ShieldCheck, ArrowRight, ArrowLeft, CheckCircle2, Clock, AlertTriangle, Star, ShieldAlert, AlertCircle, Plus, RotateCcw } from 'lucide-react';

const GENERAL_STAGES = [
  { key: 'todo', label: 'Pending' },
  { key: 'in_progress', label: 'Progress' },
  { key: 'under_review', label: 'Review' },
  { key: 'completed', label: 'Completed' }
];

const VISHWAS_STAGES = [
  { key: 'todo', label: 'Issue' },
  { key: 'rca_in_progress', label: 'Analysis' },
  { key: 'in_progress', label: 'Action' },
  { key: 'test_strategy', label: 'Test Strategy' },
  { key: 'under_review', label: 'Testing' },
  { key: 'completed', label: 'Resolved' }
];

const AVISHKAR_STAGES = [
  { key: 'todo', label: 'Idea' },
  { key: 'feasibility_planning', label: 'Planning' },
  { key: 'in_progress', label: 'Prototype' },
  { key: 'trial', label: 'Trial' },
  { key: 'test_strategy', label: 'Test Strategy' },
  { key: 'testing', label: 'Testing' },
  { key: 'completed', label: 'Deployed' }
];

const getStagePlanDetails = (task) => {
  if (!task) return null;
  let svs = [];
  try {
    const raw = task.stage_verifications;
    svs = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
  } catch (e) {
    svs = [];
  }
  if (!Array.isArray(svs) || svs.length === 0) return null;
  const last = svs[svs.length - 1];
  if (!last) return null;
  return {
    ...last,
    isPending: last.status === 'pending_approval',
    isChangesRequested: last.status === 'changes_requested',
    isApproved: last.status === 'approved'
  };
};

const getPendingStagePlan = (task) => {
  const details = getStagePlanDetails(task);
  return details?.isPending ? details : null;
};

const getPillarStagesList = (pillarName) => {
  const p = (pillarName || '').toLowerCase();
  if (p === 'vishwas') return VISHWAS_STAGES;
  if (p === 'avishkar') return AVISHKAR_STAGES;
  return GENERAL_STAGES;
};

const cleanReviewText = (text) => {
  if (!text) return '';
  return text
    .replace(/^[📝🛡️⚠️]\s*/, '')
    .replace(/^\[([^\]]+)\]:?/, '$1:')
    .replace(/Stage Plan Submission/gi, 'Stage Plan')
    .replace(/\[Plan Section:[^\]]*\]\s*/gi, '')
    .trim();
};

const formatDescription = (desc) => {
  if (!desc) return '';
  if (desc.trim().startsWith('{"type":"excalidraw/clipboard"')) {
    try {
      const data = JSON.parse(desc);
      const texts = data.elements
        ?.filter(el => el.type === 'text' && el.text)
        .map(el => el.text.trim())
        .filter(Boolean);
      if (texts && texts.length > 0) {
        return `🎨 [Excalidraw] : ${texts.join(' | ')}`;
      }
      return '🎨 [Excalidraw Drawing/Diagram]';
    } catch (e) {
      return '🎨 [Excalidraw Drawing/Diagram]';
    }
  }
  return desc.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
};

const getEmbedVideoUrl = (url) => {
  if (!url) return null;
  const str = url.trim();
  if (str.includes('youtube.com/watch')) {
    const match = str.match(/v=([a-zA-Z0-9_-]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  if (str.includes('youtu.be/')) {
    const match = str.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  if (str.includes('vimeo.com/')) {
    const match = str.match(/vimeo\.com\/([0-9]+)/);
    if (match) return `https://player.vimeo.com/video/${match[1]}`;
  }
  return null;
};

export default function TaskDetailModal({ isOpen, onClose, task, onTaskUpdated, readOnly }) {
  const user = useAuth();
  const [taskData, setTaskData] = useState(null);
  const isInternTask = Boolean(
    (taskData?.assignee_role === 'intern' || task?.assignee_role === 'intern') ||
    (taskData?.assignee_mentor_id || task?.assignee_mentor_id)
  );
  const [tab, setTab] = useState(task?.defaultTab || (isInternTask ? 'stages' : 'reviews'));
   const [comments, setComments] = useState([]);
   const [fbText, setFbText] = useState('');
   const [explanation, setExplanation] = useState('');
   const [saving, setSaving] = useState(false);
   const [editCommentId, setEditCommentId] = useState(null);
   const [editText, setEditText] = useState('');
   const [replyToId, setReplyToId] = useState(null);
   const [replyText, setReplyText] = useState('');
 
   const [dailyLogs, setDailyLogs] = useState([]);
   const [newLogContent, setNewLogContent] = useState('');
   const [newLogDate, setNewLogDate] = useState(new Date().toISOString().split('T')[0]);
   const [editingLogId, setEditingLogId] = useState(null);
   const [editingLogContent, setEditingLogContent] = useState('');
   const [dailyLogCommentsText, setDailyLogCommentsText] = useState({});
 
   const [explanationsList, setExplanationsList] = useState([]);
   const [newExpText, setNewExpText] = useState('');
   const [editingExpId, setEditingExpId] = useState(null);
   const [editingExpText, setEditingExpText] = useState('');

   const [dependencies, setDependencies] = useState([]);
   const [users, setUsers] = useState([]);
   const [tageeId, setTageeId] = useState('');
   const [depText, setDepText] = useState('');
   const [replyTexts, setReplyTexts] = useState({});
   const [showVerificationReviewModal, setShowVerificationReviewModal] = useState(false);
   const [verificationModalConfig, setVerificationModalConfig] = useState({ title: '', subtitle: '', buttonText: '' });
   const [showMoveBackModal, setShowMoveBackModal] = useState(false);
   const [inlineStageComment, setInlineStageComment] = useState('');
   const [inlinePlanNotes, setInlinePlanNotes] = useState('');



   useEffect(() => {
     if (isOpen && task?.id) {
       setTaskData(null);
       setComments([]);
       setDailyLogs([]);
       setExplanationsList([]);
       setDependencies([]);
       setNewLogContent('');
       
       const isInitialInternTask = Boolean(
         (task.assignee_role === 'intern') ||
         (task.assignee_mentor_id) ||
         (task.mentor_id)
       );
       setTab(task.defaultTab || 'reviews');

       api.getTask(task.id).then(t => {
         setTaskData(t);
         const isFetchedInternTask = Boolean(
           (t.assignee_role === 'intern') ||
           (t.assignee_mentor_id) ||
           (t.mentor_id)
         );
         if (!isFetchedInternTask && !task.defaultTab) {
           setTab('reviews');
         }
       }).catch(() => {});
       api.getComments(task.id).then(setComments).catch(() => {});
       api.getDailyLogs(task.id).then(setDailyLogs).catch(() => {});
       api.getExplanations(task.id).then(setExplanationsList).catch(() => {});
       api.getDependencies(task.id).then(setDependencies).catch(() => {});
       api.getEmployees(true).then(setUsers).catch(() => {});
     }
   }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  const topComments = comments.filter(c => !c.parent_id);
  const replies = (parentId) => comments.filter(c => c.parent_id === parentId);

  const handleSaveExplanation = async (e) => {
    e?.preventDefault();
    if (!newExpText.trim()) return;
    setSaving(true);
    try {
      const saved = await api.addExplanation(task.id, newExpText);
      setExplanationsList(prev => [saved, ...prev]);
      setNewExpText('');
      onTaskUpdated?.(taskData || task);
    } catch {}
    setSaving(false);
  };

  const handleDeleteExplanation = async (expId) => {
    try {
      await api.deleteExplanation(task.id, expId);
      setExplanationsList(prev => prev.filter(e => e.id !== expId));
      onTaskUpdated?.(taskData || task);
    } catch {}
  };

  const handleUpdateExplanation = async (expId) => {
    if (!editingExpText.trim()) return;
    setSaving(true);
    try {
      const saved = await api.updateExplanation(task.id, expId, editingExpText);
      setExplanationsList(prev => prev.map(e => e.id === expId ? saved : e));
      setEditingExpId(null);
      setEditingExpText('');
      onTaskUpdated?.(taskData || task);
    } catch {}
    setSaving(false);
  };

  const handleSaveDailyLog = async (e) => {
    e?.preventDefault();
    if (!newLogContent.trim() || !newLogDate) return;
    setSaving(true);
    try {
      const saved = await api.saveDailyLog(task.id, newLogDate, newLogContent);
      setDailyLogs(prev => {
        const index = prev.findIndex(l => l.log_date === newLogDate && l.user_id === user.id);
        if (index > -1) {
          return prev.map((item, i) => i === index ? saved : item);
        } else {
          return [saved, ...prev].sort((a, b) => b.log_date.localeCompare(a.log_date));
        }
      });
      setNewLogContent('');
      onTaskUpdated?.(taskData || task);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to save daily log. Did you restart the server?');
    }
    setSaving(false);
  };

  const handleUpdateLog = async (logId, logDate) => {
    if (!editingLogContent.trim()) return;
    setSaving(true);
    try {
      const saved = await api.saveDailyLog(task.id, logDate, editingLogContent);
      setDailyLogs(prev => prev.map(l => l.id === logId ? saved : l));
      setEditingLogId(null);
      setEditingLogContent('');
      onTaskUpdated?.(taskData || task);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to update daily log.');
    }
    setSaving(false);
  };

  const handleDeleteLog = async (logId) => {
    try {
      await api.deleteDailyLog(task.id, logId);
      setDailyLogs(prev => prev.filter(l => l.id !== logId));
      onTaskUpdated?.(taskData || task);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to delete daily log.');
    }
  };

  const handleReactToLog = async (logId, reactionType) => {
    try {
      const counts = await api.reactToDailyLog(task.id, logId, reactionType);
      setDailyLogs(prev => prev.map(l => {
        if (l.id === logId) {
          return {
            ...l,
            likes_count: counts.likes_count,
            dislikes_count: counts.dislikes_count,
            user_reaction: counts.user_reaction,
          };
        }
        return l;
      }));
    } catch (err) {
      console.error('Failed to react to log:', err);
    }
  };

  const handleAddLogComment = async (e, logId) => {
    e.preventDefault();
    const commentText = dailyLogCommentsText[logId] || '';
    if (!commentText.trim()) return;
    try {
      const newComment = await api.addDailyLogComment(task.id, logId, commentText);
      setDailyLogs(prev => prev.map(l => {
        if (l.id === logId) {
          return {
            ...l,
            comments: [...(l.comments || []), newComment],
          };
        }
        return l;
      }));
      setDailyLogCommentsText(prev => ({ ...prev, [logId]: '' }));
    } catch (err) {
      console.error('Failed to add comment to daily log:', err);
    }
  };

  const handleDeleteLogComment = async (logId, commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.deleteDailyLogComment(task.id, logId, commentId);
      setDailyLogs(prev => prev.map(l => {
        if (l.id === logId) {
          return {
            ...l,
            comments: (l.comments || []).filter(c => c.id !== commentId),
          };
        }
        return l;
      }));
    } catch (err) {
      console.error('Failed to delete comment from daily log:', err);
    }
  };

  const handleSendReview = async () => {
    if (!fbText.trim()) return;
    try {
      const c = await api.addComment(task.id, fbText);
      setComments(prev => [...prev, c]);
      setFbText('');
    } catch {}
  };

  const handleSendReply = async (parentId) => {
    if (!replyText.trim()) return;
    try {
      const c = await api.addComment(task.id, replyText, parentId);
      setComments(prev => [...prev, c]);
      setReplyText('');
      setReplyToId(null);
    } catch {}
  };

  const handleEditReview = async (commentId) => {
    if (!editText.trim()) return;
    try {
      const updated = await api.editComment(task.id, commentId, editText);
      setComments(prev => prev.map(c => c.id === commentId ? updated : c));
      setEditCommentId(null);
      setEditText('');
    } catch {}
  };

  const handleDeleteReview = async (commentId) => {
    try {
      await api.deleteComment(task.id, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId));
    } catch {}
  };

  const startEdit = (comment) => {
    setEditCommentId(comment.id);
    setEditText(comment.comment_text);
  };

  const canEditComment = (comment) => {
    if (user.role === 'admin') return true;
    return comment.admin_id === user.id;
  };

  const handleAddDependency = (e) => {
    e.preventDefault();
    if (!tageeId || !depText.trim()) return;
    setSaving(true);
    api.createDependency(task.id, tageeId, depText)
      .then(newDep => {
        setDependencies(prev => [...prev, newDep]);
        setTageeId('');
        setDepText('');
        window.dispatchEvent(new CustomEvent('dependency-updated'));
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  const handleReplyDependency = (e, depId) => {
    e.preventDefault();
    const rText = replyTexts[depId];
    if (!rText || !rText.trim()) return;
    setSaving(true);
    api.replyDependency(task.id, depId, rText)
      .then(updatedDep => {
        setDependencies(prev => prev.map(d => d.id === depId ? updatedDep : d));
        setReplyTexts(prev => ({ ...prev, [depId]: '' }));
        window.dispatchEvent(new CustomEvent('dependency-updated'));
      })
      .catch(() => {})
  };

  const handleInlineStageAction = async (action, planDetails) => {
    if (action === 'reject' && !inlineStageComment.trim()) {
      alert('Please enter a note or reason in the feedback box to request changes.');
      return;
    }

    setSaving(true);
    try {
      let backendStatus = planDetails.to_stage;
      if (backendStatus === 'todo') backendStatus = 'pending';

      const verificationPayload = {
        action,
        from_stage: planDetails.from_stage,
        to_stage: planDetails.to_stage,
        from_stage_label: planDetails.from_stage_label || planDetails.from_stage,
        to_stage_label: planDetails.to_stage_label || planDetails.to_stage,
        stage_label: `${planDetails.from_stage_label || planDetails.from_stage} ➔ ${planDetails.to_stage_label || planDetails.to_stage}`,
        comment: (inlineStageComment || (action === 'approve' ? 'Stage plan approved & verified' : 'Changes requested')).trim()
      };

      const updatePayload = {
        stage_verification: verificationPayload
      };
      if (action === 'approve') {
        updatePayload.status = backendStatus;
      }

      const updatedTask = await api.updateTask(task.id, updatePayload);
      setTaskData(updatedTask);
      setInlineStageComment('');
      onTaskUpdated?.(updatedTask);
      api.getComments(task.id).then(setComments).catch(() => {});
    } catch (err) {
      alert(err.message || `Failed to ${action} stage`);
    } finally {
      setSaving(false);
    }
  };

  const handleInlineResubmitPlan = async (planDetails) => {
    if (!inlinePlanNotes.trim()) {
      alert('Please enter your updated plan notes.');
      return;
    }

    setSaving(true);
    try {
      const verificationPayload = {
        action: 'submit_plan',
        from_stage: planDetails.from_stage,
        to_stage: planDetails.to_stage,
        from_stage_label: planDetails.from_stage_label || planDetails.from_stage,
        to_stage_label: planDetails.to_stage_label || planDetails.to_stage,
        stage_label: `${planDetails.from_stage_label || planDetails.from_stage} ➔ ${planDetails.to_stage_label || planDetails.to_stage}`,
        plan_notes: inlinePlanNotes.trim(),
        is_revision: true
      };

      const updatedTask = await api.updateTask(task.id, { stage_verification: verificationPayload });
      setTaskData(updatedTask);
      setInlinePlanNotes('');
      onTaskUpdated?.(updatedTask);
      api.getComments(task.id).then(setComments).catch(() => {});
    } catch (err) {
      alert(err.message || 'Failed to resubmit stage plan');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveBack = async ({ target_stage, target_stage_label, from_stage, from_stage_label, reason }) => {
    setSaving(true);
    try {
      let backendStatus = target_stage;
      if (backendStatus === 'todo') backendStatus = 'pending';

      const updated = await api.updateTask(task.id, {
        status: backendStatus,
        move_back_reason: reason,
        from_stage_label,
        to_stage_label: target_stage_label
      });
      setTaskData(updated);
      api.getComments(task.id).then(setComments).catch(() => {});
      onTaskUpdated?.(updated);
      setShowMoveBackModal(false);
    } catch (err) {
      alert(err.message || 'Failed to move task back.');
    } finally {
      setSaving(false);
    }
  };

  const isVerifier = Number(taskData?.verifier_id || task.verifier_id) === Number(user?.id);
  const isCreator = Number(taskData?.creator_id || task.creator_id) === Number(user?.id);
  const isAssignee = Number(taskData?.assignee_id || task.assignee_id) === Number(user?.id);
  const isMentor = (taskData?.assignee_mentor_id || task.assignee_mentor_id) && Number(taskData?.assignee_mentor_id || task.assignee_mentor_id) === Number(user?.id);
  const isAdminOrManager = ['admin', 'manager', 'site_manager'].includes(user?.role);
  const canReview = isAdminOrManager || isVerifier || isCreator || isMentor;
  const canAddExplanation = !readOnly || isAssignee || isMentor || isVerifier || isAdminOrManager;

  const currentTaskForVerification = taskData || task;
  const hasAssignedVerifier = Boolean(currentTaskForVerification.verifier_id);
  const canVerifyStage = hasAssignedVerifier ? isVerifier : (user?.role === 'admin');

  const isResolver = dependencies.some(d => Number(d.tagee_id) === Number(user.id));

  let stageVerifications = [];
  try {
    const raw = taskData?.stage_verifications || task?.stage_verifications;
    stageVerifications = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
  } catch (e) {
    stageVerifications = [];
  }
  if (!Array.isArray(stageVerifications)) stageVerifications = [];

  const currentTaskObj = taskData || task;
  const mentorId = Number(currentTaskObj?.assignee_mentor_id || currentTaskObj?.mentor_id);
  const isAssignedMentor = Boolean(mentorId && Number(user?.id) === mentorId);
  const mentorHasVerified = Array.isArray(stageVerifications) && stageVerifications.some(sv => Number(sv.verified_by_id) === mentorId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 truncate">{taskData?.title || task.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Status: {(taskData?.status || task.status)?.replace('_', ' ')} &middot; Priority: {taskData?.priority || task.priority}</span>
              {(taskData?.pillar || task.pillar) === 'vishwas' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  🛡️ Vishwas (Quality & Continuous Improvement)
                </span>
              )}
              {(taskData?.pillar || task.pillar) === 'avishkar' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  💡 Avishkar (Innovation & Product Optimization)
                </span>
              )}
              {(taskData?.pillar || task.pillar) === 'upakaram' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-300">
                  🚀 Upakaram (Internal Track)
                </span>
              )}
              {(taskData?.duration_type || task.duration_type) === 'short_term' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
                  ⚡ Short-Term Task
                </span>
              )}
              {(taskData?.duration_type || task.duration_type) === 'long_term' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-300">
                  🏔️ Long-Term Task
                </span>
              )}
              {(taskData?.project_name || task.project_name) && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  📁 Project: {taskData?.project_name || task.project_name}
                </span>
              )}
            </p>
            {taskData?.last_edited_by_name && taskData?.updated_at !== taskData?.created_at && (
              <p className="text-[10px] text-gray-400 mt-1">Last edited by {taskData.last_edited_by_name} on {new Date(taskData.updated_at).toLocaleDateString()}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Red Flag Warning Callout Banner */}
        {(taskData?.is_red_flagged || task.is_red_flagged) && (
          <div className="mx-5 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl space-y-1 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-red-950 uppercase tracking-wide">
              <span>🚩 Red Flagged Task (Proceeded under forced constraint)</span>
            </div>
            <p className="text-xs text-red-900 leading-normal">
              <strong>Cause / Reason for Compromise:</strong> {taskData?.red_flag_reason || task.red_flag_reason || 'Proceeded under forced constraint'}
            </p>
          </div>
        )}

        {/* Stage Transition Plan Review & Revision Banner */}
        {(() => {
          const currentT = taskData || task;
          const planDetails = getStagePlanDetails(currentT);
          if (!planDetails) return null;
          const canManage = isAssignee || isCreator || isAdminOrManager;

          // Case A: Changes Requested by Reviewer / Verifier
          if (planDetails.isChangesRequested) {
            const isViewerReviewer = canVerifyStage && (!isAssignee || Number(user?.id) === Number(planDetails.reviewed_by_id));
            const assigneeName = taskData?.assignee_name || task.assignee_name || 'Employee';
            return (
              <div className="mx-5 mt-4 p-4 bg-amber-50/90 border border-amber-300 rounded-xl space-y-2.5 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5 shadow-xs">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                      Plan Revision Requested: {planDetails.from_stage_label || planDetails.from_stage} ➔ {planDetails.to_stage_label || planDetails.to_stage}
                    </h4>
                    <p className="text-xs text-amber-900 mt-1 leading-normal">
                      {isViewerReviewer ? (
                        <>Your feedback to <strong>{assigneeName}</strong>: <em>"{planDetails.review_comment}"</em></>
                      ) : (
                        <>Feedback from <strong>{planDetails.reviewed_by_name || 'Verifier'}</strong>: <em>"{planDetails.review_comment}"</em></>
                      )}
                    </p>
                    {planDetails.plan_notes && (
                      <div className="text-xs text-gray-800 bg-white/80 p-2.5 rounded-lg border border-amber-200/70 mt-2 whitespace-pre-wrap leading-relaxed font-sans">
                        <span className="font-semibold text-gray-500 block text-[10px] uppercase mb-1">
                          {isViewerReviewer ? `${assigneeName}'s Submitted Plan:` : 'Your Submitted Plan:'}
                        </span>
                        {cleanReviewText(planDetails.plan_notes)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Re-submission for Assignee */}
                {(!isViewerReviewer && canManage) && (
                  <div className="pt-2 border-t border-amber-200/60 space-y-2">
                    <textarea
                      rows={2}
                      value={inlinePlanNotes}
                      onChange={(e) => setInlinePlanNotes(e.target.value)}
                      placeholder="Write your revised plan or updated deliverables..."
                      className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-gray-800"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleInlineResubmitPlan(planDetails)}
                        disabled={saving}
                        className="btn-amber text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{saving ? 'Submitting...' : 'Re-Submit Updated Plan'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // Case B: Plan Pending Approval
          if (planDetails.isPending) {
            return (
              <div className="mx-5 mt-4 p-4 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2.5 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5 shadow-xs">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide truncate">
                        Stage Review Pending: {planDetails.from_stage_label || planDetails.from_stage} ➔ {planDetails.to_stage_label || planDetails.to_stage}
                      </h4>
                      <p className="text-xs text-amber-900 mt-1 leading-normal">
                        Submitted by <strong>{planDetails.submitted_by_name || 'Employee'}</strong> for verification by <strong>{(planDetails.verifier_name && planDetails.verifier_name.toLowerCase() !== 'admin') || (currentT.verifier_name && currentT.verifier_name.toLowerCase() !== 'admin') || 'Reviewer and Verifier'}</strong>.
                      </p>
                      {planDetails.achievements ? (
                        <div className="text-xs text-gray-800 bg-white/90 p-2.5 rounded-lg border border-amber-200/70 mt-2 whitespace-pre-wrap leading-relaxed font-sans">
                          <span className="font-semibold text-amber-800 block text-[10px] uppercase mb-0.5">🏆 Achievements & Deliverables:</span>
                          {cleanReviewText(planDetails.achievements)}
                        </div>
                      ) : planDetails.plan_notes ? (
                        <div className="text-xs text-gray-800 bg-white/90 p-2.5 rounded-lg border border-amber-200/70 mt-2 whitespace-pre-wrap leading-relaxed font-sans">
                          <span className="font-semibold text-gray-500 block text-[10px] uppercase mb-0.5">Submitted Notes:</span>
                          {cleanReviewText(planDetails.plan_notes)}
                        </div>
                      ) : null}

                      {planDetails.proposed_review_time && (
                        <div className="mt-2 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span>Proposed Review Meeting: <strong>{planDetails.proposed_review_time}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {!canVerifyStage && (
                    <div className="shrink-0 flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-amber-800 bg-white/80 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Awaiting <strong>{(planDetails.verifier_name && planDetails.verifier_name.toLowerCase() !== 'admin') || (currentT.verifier_name && currentT.verifier_name.toLowerCase() !== 'admin') || 'Reviewer and Verifier'}</strong></span>
                      </span>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Hi ${((planDetails.verifier_name && planDetails.verifier_name.toLowerCase() !== 'admin') || (currentT.verifier_name && currentT.verifier_name.toLowerCase() !== 'admin')) ? (planDetails.verifier_name || currentT.verifier_name) : 'Reviewer and Verifier'},\n\nFollowing up on the stage review for task:\n📌 *${currentT.title}*\n📍 Stage: *${planDetails.stage_label || `${planDetails.from_stage_label || planDetails.from_stage} ➔ ${planDetails.to_stage_label || planDetails.to_stage}`}*\n\nPlease let me know when you are available for a quick review meeting so I can show you my work and we can finish it quickly. Thank you!`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-white bg-[#25D366] hover:bg-[#20bd5a] px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        title="Message Reviewer & Verifier on WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5 fill-current" />
                        <span>WhatsApp Verifier</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* INLINE ACTIONS FOR AUTHORIZED VERIFIER — NO NESTED MODAL */}
                {canVerifyStage && (
                  <div className="pt-2 border-t border-amber-200/60 space-y-2">
                    <input
                      type="text"
                      value={inlineStageComment}
                      onChange={(e) => setInlineStageComment(e.target.value)}
                      placeholder="Optional feedback or verification notes..."
                      className="w-full text-xs px-3 py-2 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-gray-800"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleInlineStageAction('reject', planDetails)}
                        disabled={saving}
                        className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-800 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                        <span>Request Changes</span>
                      </button>

                      <button
                        onClick={() => handleInlineStageAction('approve', planDetails)}
                        disabled={saving}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{saving ? 'Approving...' : 'Approve & Advance Stage'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return null;
        })()}

        {/* Verifier Sign-off & Admin Final Completion Banner (under_review) */}
        {(taskData?.status || task.status) === 'under_review' && (() => {
          const currentT = taskData || task;
          const assignedVerifierId = currentT.verifier_id ? Number(currentT.verifier_id) : null;
          const isAssignedVerifier = Boolean(assignedVerifierId && assignedVerifierId === Number(user?.id));
          const isAdmin = user?.role === 'admin';
          const verifierName = currentT.verifier_name || 'Assigned Verifier';
          const hasVerifierSignedOff = Boolean(currentT.verifier_verified_at);
          const isTaskVerifierAdmin = !assignedVerifierId || assignedVerifierId === 1 || (assignedVerifierId && currentT.verifier_role === 'admin');

          // Case 1: Assigned Verifier viewing (not Admin)
          if (isAssignedVerifier && !isAdmin) {
            return (
              <div className={`mx-5 mt-4 p-4 rounded-xl space-y-3 ${
                hasVerifierSignedOff
                  ? 'bg-emerald-50/90 border border-emerald-200'
                  : 'bg-amber-50/90 border border-amber-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 shadow-xs ${
                      hasVerifierSignedOff ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                        {hasVerifierSignedOff ? 'Verifier Sign-Off Complete' : 'Assigned Verifier Review Required'}
                      </h4>
                      <p className="text-xs text-gray-700 mt-0.5 leading-normal">
                        {hasVerifierSignedOff
                          ? `You verified and signed off on this task on ${new Date(currentT.verifier_verified_at).toLocaleDateString()}: "${currentT.verifier_comment}". It is awaiting final Admin sign-off.`
                          : 'You are the assigned Verifier. Please review all daily logs, deliverables, and explanations. Once approved, sign off to forward to Admin for final completion.'}
                      </p>
                    </div>
                  </div>

                  {!hasVerifierSignedOff && (
                    <button
                      onClick={() => {
                        setVerificationModalConfig({
                          title: 'Assigned Verifier Sign-Off',
                          subtitle: `Sign off deliverables for "${currentT.title}". Task will then be forwarded to Admin for final sign-off.`,
                          buttonText: '🛡️ Sign Off & Forward to Admin'
                        });
                        setShowVerificationReviewModal(true);
                      }}
                      disabled={saving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shrink-0 shadow-xs whitespace-nowrap cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Verify Deliverables &amp; Sign Off
                    </button>
                  )}
                </div>
              </div>
            );
          }

          // Case 2: Admin viewing
          if (isAdmin) {
            // Task has a specific assigned verifier who is not Admin
            if (!isTaskVerifierAdmin) {
              return (
                <div className={`mx-5 mt-4 p-4 rounded-xl space-y-3 ${
                  hasVerifierSignedOff
                    ? 'bg-blue-50/90 border border-blue-200'
                    : 'bg-amber-50/90 border border-amber-200'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 shadow-xs ${
                        hasVerifierSignedOff ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                          {hasVerifierSignedOff ? 'Verifier Approved — Awaiting Admin Sign-Off' : `Awaiting Verifier: ${verifierName}`}
                        </h4>
                        <p className="text-xs text-gray-700 mt-0.5 leading-normal">
                          {hasVerifierSignedOff
                            ? `Assigned Verifier (${verifierName}) verified on ${new Date(currentT.verifier_verified_at).toLocaleDateString()}: "${currentT.verifier_comment}". Ready for Admin final completion.`
                            : `This task must first be verified by the assigned verifier (${verifierName}) before Admin final sign-off. Admin completion will unlock after ${verifierName} signs off.`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        onClick={() => setShowMoveBackModal(true)}
                        className="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Move task back to an earlier stage"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 text-gray-600" />
                        <span>Move Back</span>
                      </button>

                      {hasVerifierSignedOff && (
                        <button
                          onClick={() => {
                            setVerificationModalConfig({
                              title: 'Admin Final Verification Sign-Off',
                              subtitle: `Final sign-off to complete "${currentT.title}". Task was verified by ${verifierName}.`,
                              buttonText: '✅ Final Sign-Off & Complete Task'
                            });
                            setShowVerificationReviewModal(true);
                          }}
                          disabled={saving}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shrink-0 shadow-xs whitespace-nowrap cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          Admin Final Sign-Off &amp; Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Task has NO specific non-admin verifier (Admin is verifier)
            return (
              <div className="mx-5 mt-4 p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 bg-emerald-600 text-white rounded-lg shrink-0 mt-0.5 shadow-xs">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                        Admin Direct Verification &amp; Review
                      </h4>
                      <p className="text-xs text-gray-700 mt-0.5 leading-normal">
                        You can review all deliverables and mark this task as completed, or return it to a previous stage for redo.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      onClick={() => setShowMoveBackModal(true)}
                      className="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Move task back to an earlier stage"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-gray-600" />
                      <span>Move Back</span>
                    </button>
                    <button
                      onClick={() => {
                        setVerificationModalConfig({
                          title: 'Task Verification & Completion',
                          subtitle: `Direct verification feedback before completing "${currentT.title}".`,
                          buttonText: '✅ Confirm & Complete Task'
                        });
                        setShowVerificationReviewModal(true);
                      }}
                      disabled={saving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shrink-0 shadow-xs whitespace-nowrap cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Verify &amp; Mark Completed
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Case 3: General employee / assignee viewing
          return (
            <div className="mx-5 mt-4 p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-gray-800">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Task Under Review</span>
              </div>
              <p className="text-gray-600 text-[11px]">
                {hasVerifierSignedOff
                  ? `Deliverables approved by ${verifierName}. Awaiting final Admin sign-off.`
                  : `Awaiting review and sign-off by assigned verifier: ${verifierName}.`}
              </p>
            </div>
          );
        })()}

        {/* Verifier Assigned Info Banner (when not under_review and not completed) */}
        {(taskData?.status || task.status) !== 'under_review' && (taskData?.status || task.status) !== 'completed' && ((taskData?.verifier_id && Number(taskData.verifier_id) === Number(user?.id)) || (task.verifier_id && Number(task.verifier_id) === Number(user?.id))) && (
          <div className="mx-5 mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="font-semibold text-purple-950">
                🛡️ You are the assigned Verifier for this task
              </span>
            </div>
            <span className="text-purple-700 text-[11px]">
              You can post guidance under the Stage Verification tab. Once the task is submitted, you can verify and mark it completed.
            </span>
          </div>
        )}

        {/* Mentor / Supervisor Info Banner */}
        {isMentor && (
          <div className="mx-5 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="font-semibold text-blue-950">
                🎓 You are the supervising mentor for {taskData?.assignee_name || 'this intern'}
              </span>
            </div>
            <span className="text-blue-700 text-[11px]">
              You can write reviews/guidance, reply in discussions, and log logic context.
            </span>
          </div>
        )}

        {/* Task Completed Verification Info Banner (Only when status is completed) */}
        {(taskData?.status || task.status) === 'completed' && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-emerald-950">
                Verified & Completed by {
                  (taskData?.completer_name && taskData.completer_name !== 'Admin') 
                    ? taskData.completer_name 
                    : ((taskData?.verifier_name && taskData.verifier_name !== 'Admin') 
                        ? taskData.verifier_name 
                        : (taskData?.completer_name || taskData?.verifier_name || 'Admin'))
                }
                {taskData?.verifier_name && taskData?.completer_name && taskData.verifier_name !== taskData.completer_name && taskData.completer_name !== 'Admin' && (
                  <span className="text-emerald-700 font-normal ml-1">
                    (Assigned Verifier: {taskData.verifier_name})
                  </span>
                )}
              </span>
            </div>
            {(taskData?.verified_at || taskData?.updated_at) && (
              <span className="text-emerald-700 text-[11px]">
                {new Date(taskData.verified_at || taskData.updated_at).toLocaleDateString([], { dateStyle: 'medium' })}
              </span>
            )}
          </div>
        )}

        {/* Task Under Re-Verification Banner */}
        {(taskData?.status || task.status) === 'under_review' && taskData?.completed_by && Number(taskData.completed_by) !== Number(taskData?.verifier_id) && (
          <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-medium text-amber-950">
                Previously verified by <span className="font-semibold">{taskData.completer_name || 'Admin'}</span>. Reassigned for verification to <span className="font-semibold">{taskData.verifier_name || 'New Verifier'}</span>.
              </span>
            </div>
            <span className="bg-amber-200/70 text-amber-900 font-semibold text-[10px] px-2 py-0.5 rounded-full">
              Re-Verification Pending
            </span>
          </div>
        )}

        {/* Nirantar Recruitment & Vacancy Hub Block */}
        {(taskData?.pillar || task.pillar) === 'nirantar' && (
          <div className="mx-5 mt-4 p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-purple-200/70 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold shadow-xs">🔁</span>
                <div>
                  <h3 className="text-xs font-extrabold text-purple-950 uppercase tracking-wide">
                    Nirantar Recruitment & Vacancy Hub
                  </h3>
                  <p className="text-[11px] text-purple-700">
                    Live hiring pipeline, vacancy tracking, and HR action plan
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs">
                  🔁 {taskData?.vacancies_count || task.vacancies_count || 0} Open Vacancies
                </span>
              </div>
            </div>

            {/* Quick Overview Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-0.5">Target Department</span>
                <span className="font-semibold text-purple-950">
                  {(taskData?.hiring_department || task.hiring_department) || (taskData?.category || task.category) || 'General / Not Specified'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-0.5">Assigned People / Team</span>
                <span className="font-semibold text-purple-950 truncate block" title={taskData?.group_assignees && taskData.group_assignees.length > 0 ? taskData.group_assignees.join(', ') : (taskData?.assignee_name || task.assignee_name)}>
                  {taskData?.group_assignees && taskData.group_assignees.length > 0
                    ? `${taskData.group_assignees.length} Assigned (${taskData.group_assignees.join(', ')})`
                    : ((taskData?.assignee_name || task.assignee_name) || 'Not Assigned')}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-0.5">Total Vacancies</span>
                <span className="font-semibold text-purple-950">
                  🔁 {taskData?.vacancies_count || task.vacancies_count || 0} Open Positions
                </span>
              </div>
            </div>

            {/* Interactive Hiring Stage Progress & Updater Attribution */}
            <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
                  Hiring Stage & Pipeline Status
                </label>
                <span className="text-[10px] text-purple-600 font-medium">Click to advance stage</span>
              </div>
              <select
                value={taskData?.hiring_stage || task.hiring_stage || 'Requisition Opened'}
                onChange={async (e) => {
                  const newStage = e.target.value;
                  try {
                    const updated = await api.updateTask(task.id, { hiring_stage: newStage });
                    setTaskData(updated);
                    onTaskUpdated?.(updated);
                  } catch (err) {
                    alert(err.message);
                  }
                }}
                className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-purple-300 bg-purple-50/50 text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
              >
                <option value="Requisition Opened">Requisition Opened</option>
                <option value="Candidate Sourcing & Screening">Candidate Sourcing & Screening</option>
                <option value="Interviews Ongoing">Interviews Ongoing</option>
                <option value="Offer Extended">Offer Extended</option>
                <option value="Hired & Onboarded">Hired & Onboarded</option>
                <option value="On Hold">On Hold</option>
              </select>
              {(taskData?.hiring_stage_updater_name || taskData?.last_edited_by_name) && (
                <div className="text-[11px] text-purple-800 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200/60 flex items-center justify-between">
                  <span>👤 Stage updated by: <strong>{taskData.hiring_stage_updater_name || taskData.last_edited_by_name}</strong></span>
                  {(taskData.hiring_stage_updated_at || taskData.updated_at) && (
                    <span className="text-[10px] text-purple-600">
                      {new Date(taskData.hiring_stage_updated_at || taskData.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Recruitment Channels & HR Action Plan (Moved Down) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-xs space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900 block">
                  Recruitment Channels / Way of Hiring
                </span>
                <input
                  type="text"
                  defaultValue={(taskData?.way_of_hiring || task.way_of_hiring) || ''}
                  placeholder="e.g. LinkedIn, Employee Referrals, Job Portals..."
                  onBlur={async (e) => {
                    const val = e.target.value;
                    if (val !== (taskData?.way_of_hiring || task.way_of_hiring)) {
                      try {
                        const updated = await api.updateTask(task.id, { way_of_hiring: val });
                        setTaskData(updated);
                        onTaskUpdated?.(updated);
                      } catch {}
                    }
                  }}
                  className="w-full text-xs font-semibold text-purple-950 bg-purple-50/50 border border-purple-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              </div>
              <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-xs space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900 block">
                  HR Strategy & Action Plan
                </span>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {(taskData?.hr_strategy_notes || task.hr_strategy_notes) || 'No specific strategy notes logged yet.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Saksham Skill Enablement & Employee Training Hub Block */}
        {(taskData?.pillar || task.pillar) === 'saksham' && (
          <div className="mx-5 mt-4 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-amber-200/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold shadow-xs">⚡</span>
                <div>
                  <h3 className="text-xs font-extrabold text-amber-950 uppercase tracking-wide">
                    Saksham Skill Enablement & Training Hub
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    Interactive module-based training, video lessons, and skill assessment
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs">
                  Level: {(taskData?.training_level || task.training_level || 'Beginner')}
                </span>
              </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-amber-100 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block mb-0.5">Training Course / Topic</span>
                <span className="font-semibold text-amber-950 block truncate">
                  {(taskData?.title || task.title)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-amber-100 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block mb-0.5">Assigned Trainee(s)</span>
                <span className="font-semibold text-amber-950 block truncate" title={taskData?.group_assignees && taskData.group_assignees.length > 0 ? taskData.group_assignees.join(', ') : (taskData?.assignee_name || task.assignee_name)}>
                  {taskData?.group_assignees && taskData.group_assignees.length > 0
                    ? `${taskData.group_assignees.length} Trainees (${taskData.group_assignees.join(', ')})`
                    : ((taskData?.assignee_name || task.assignee_name) || 'Self Assigned')}
                </span>
              </div>
            </div>

            {/* Interactive Video Link Input & Doc Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                    ▶️ Training Video Link (URL)
                  </span>
                  {(taskData?.training_video_url || task.training_video_url) && (
                    <a
                      href={taskData?.training_video_url || task.training_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-amber-600 hover:text-amber-800 font-bold underline"
                    >
                      Open in New Tab ↗
                    </a>
                  )}
                </div>
                <input
                  type="url"
                  defaultValue={(taskData?.training_video_url || task.training_video_url) || ''}
                  placeholder="Paste YouTube, Vimeo, or video link (e.g. https://www.youtube.com/watch?v=...)"
                  onBlur={async (e) => {
                    const val = e.target.value;
                    if (val !== (taskData?.training_video_url || task.training_video_url)) {
                      try {
                        const updated = await api.updateTask(task.id, { training_video_url: val });
                        setTaskData(updated);
                        onTaskUpdated?.(updated);
                      } catch {}
                    }
                  }}
                  className="w-full text-xs font-semibold text-amber-950 bg-amber-50/50 border border-amber-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                    📄 Document / SOP Link (Optional)
                  </span>
                  {(taskData?.training_doc_url || task.training_doc_url) && (
                    <a
                      href={taskData?.training_doc_url || task.training_doc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-amber-600 hover:text-amber-800 font-bold underline"
                    >
                      View Doc ↗
                    </a>
                  )}
                </div>
                <input
                  type="url"
                  defaultValue={(taskData?.training_doc_url || task.training_doc_url) || ''}
                  placeholder="Paste PDF / Google Drive / SOP document link..."
                  onBlur={async (e) => {
                    const val = e.target.value;
                    if (val !== (taskData?.training_doc_url || task.training_doc_url)) {
                      try {
                        const updated = await api.updateTask(task.id, { training_doc_url: val });
                        setTaskData(updated);
                        onTaskUpdated?.(updated);
                      } catch {}
                    }
                  }}
                  className="w-full text-xs font-semibold text-amber-950 bg-amber-50/50 border border-amber-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Embedded Video Player (if YouTube/Vimeo link) */}
            {(() => {
              const videoUrl = taskData?.training_video_url || task.training_video_url;
              const embedUrl = getEmbedVideoUrl(videoUrl);
              if (embedUrl) {
                return (
                  <div className="bg-black/90 rounded-xl overflow-hidden shadow-md border border-amber-200 aspect-video relative">
                    <iframe
                      src={embedUrl}
                      title="Saksham Training Video"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* Description section */}
        {(taskData?.description || task.description) && (
          <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{formatDescription(taskData?.description || task.description)}</p>
          </div>
        )}

        {/* Task Ownership & History Details Box */}
        <div className="px-5 py-3 bg-slate-50/80 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-white p-2 rounded-lg border border-gray-200/70 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Created By</span>
            <span className="font-semibold text-gray-900 truncate block">
              {taskData?.creator_name || task.creator_name || 'System'}
              {(taskData?.creator_role || task.creator_role) && (
                <span className="text-[10px] text-gray-500 font-normal ml-1">({taskData?.creator_role || task.creator_role})</span>
              )}
            </span>
            {(taskData?.created_at || task.created_at) && (
              <span className="text-[10px] text-gray-400 block">{new Date(taskData?.created_at || task.created_at).toLocaleDateString()}</span>
            )}
          </div>

          <div className="bg-white p-2 rounded-lg border border-gray-200/70 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assigned To</span>
            <span className="font-semibold text-gray-900 truncate block" title={taskData?.group_assignees ? taskData.group_assignees.join(', ') : (taskData?.assignee_name || task.assignee_name)}>
              {taskData?.group_assignees && taskData.group_assignees.length > 0
                ? taskData.group_assignees.join(', ')
                : (taskData?.assignee_name || task.assignee_name || 'Unassigned')}
            </span>
          </div>

          <div className="bg-white p-2 rounded-lg border border-gray-200/70 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Verifier</span>
            <span className="font-semibold text-purple-900 truncate block">
              {taskData?.verifier_name || task.verifier_name || 'Admin'}
            </span>
          </div>

          <div className="bg-white p-2 rounded-lg border border-gray-200/70 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Last Updated By</span>
            <span className="font-semibold text-gray-900 truncate block">
              {taskData?.last_edited_by_name || taskData?.creator_name || task.creator_name || 'System'}
            </span>
            {(taskData?.updated_at || task.updated_at) && (
              <span className="text-[10px] text-gray-400 block">{new Date(taskData?.updated_at || task.updated_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-none shrink-0">
          
          <button onClick={() => setTab('reviews')}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${tab === 'reviews' ? 'text-amber-600 border-b-2 border-amber-500 font-bold' : 'text-gray-500 hover:text-gray-700'}`}>
            <ShieldCheck className="w-4 h-4" /> Stage Verification ({stageVerifications.length > 0 ? stageVerifications.length : comments.length})
          </button>
          <button onClick={() => setTab('explanation')}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${tab === 'explanation' ? 'text-amber-600 border-b-2 border-amber-500 font-bold' : 'text-gray-500 hover:text-gray-700'}`}>
            <FileText className="w-4 h-4" /> Logical Explanation ({explanationsList.length})
          </button>
          <button onClick={() => setTab('daily-logs')}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${tab === 'daily-logs' ? 'text-amber-600 border-b-2 border-amber-500 font-bold' : 'text-gray-500 hover:text-gray-700'}`}>
            <Calendar className="w-4 h-4" /> Daily Achievements ({dailyLogs.length})
          </button>
          <button onClick={() => setTab('dependencies')}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${tab === 'dependencies' ? 'text-amber-600 border-b-2 border-amber-500 font-bold' : 'text-gray-500 hover:text-gray-700'}`}>
            <GitMerge className="w-4 h-4" /> Dependencies ({dependencies.length})
          </button>
        </div>

        {/* Tab content */}
        <div className="p-5">
          {tab === 'reviews' && (() => {
            const isStageCommentText = (text) => /^(\[Stage|Stage Plan|Stage Revision|Stage Approved|📝 Stage|🛡️ Stage|⚠️ Stage|ℹ️ Stage)/i.test(text || '');
            const generalComments = comments.filter(c => !isStageCommentText(c.comment_text));
            const topGeneralComments = generalComments.filter(c => !c.parent_id);

            // Synthesize timeline items from structured stageVerifications or parse from legacy comments if needed
            let timelineItems = [...stageVerifications];
            if (timelineItems.length === 0) {
              const stageComments = comments.filter(c => isStageCommentText(c.comment_text));
              if (stageComments.length > 0) {
                timelineItems = stageComments.map(c => {
                  const text = c.comment_text || '';
                  const isApproval = /Stage Approved/i.test(text);
                  const isRejection = /Stage Revision/i.test(text);
                  const stageMatch = text.match(/Stage [^-]+ - ([^:]+):/i);
                  const stageLabel = stageMatch ? stageMatch[1].trim() : 'Stage Transition';
                  const cleanContent = text.replace(/^[\[\s]*Stage [^:]+:\s*/i, '').trim();
                  return {
                    id: c.id,
                    stage_label: stageLabel,
                    status: isApproval ? 'approved' : (isRejection ? 'changes_requested' : 'pending_approval'),
                    submitted_by_name: !isApproval && !isRejection ? c.admin_name : null,
                    reviewed_by_name: isApproval || isRejection ? c.admin_name : null,
                    plan_notes: !isApproval && !isRejection ? cleanContent : null,
                    review_comment: isRejection ? cleanContent : null,
                    comment: isApproval ? cleanContent : null,
                    timestamp: c.created_at
                  };
                });
              }
            }

            return (
              <div className="space-y-6">
                {/* Timeline Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>Stage Verification Timeline</span>
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Audit trail of plans, deliverables, and verifier reviews across task stages.
                    </p>
                  </div>
                  {timelineItems.length > 0 && (
                    <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-700 rounded-full border border-gray-200">
                      {timelineItems.length} event{timelineItems.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Vertical Timeline */}
                {timelineItems.length === 0 ? (
                  <div className="text-center py-8 px-4 bg-gray-50/60 rounded-2xl border border-dashed border-gray-200">
                    <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-gray-700">No stage verifications recorded yet</p>
                    <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
                      When employees submit stage plans and deliverables, the reviews will appear along this timeline.
                    </p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-gray-200 ml-3.5 pl-6 space-y-6">
                    {timelineItems.map((item, idx) => {
                      const isApproved = item.status === 'approved';
                      const isRejected = item.status === 'changes_requested';
                      const isPending = item.status === 'pending_approval';

                      const cleanItemPlan = item.plan_notes
                        ? cleanReviewText(item.plan_notes)
                        : '';

                      return (
                        <div key={item.id || idx} className="relative group/timeline">
                          {/* Vertical Timeline Dot */}
                          {isApproved ? (
                            <div className="absolute -left-[35px] top-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-4 ring-emerald-50 shadow-2xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          ) : isRejected ? (
                            <div className="absolute -left-[35px] top-1.5 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center ring-4 ring-amber-50 shadow-2xs">
                              <AlertTriangle className="w-3 h-3" />
                            </div>
                          ) : (
                            <div className="absolute -left-[35px] top-1.5 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center ring-4 ring-blue-50 shadow-2xs">
                              <Clock className="w-3 h-3" />
                            </div>
                          )}

                          {/* Stage Event Card */}
                          <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-2xs space-y-3 hover:border-gray-300 transition-colors">
                            {/* Header: Stage Transition Label + Status Badge */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-gray-100 pb-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 text-xs sm:text-sm">
                                  {item.stage_label || `${item.from_stage_label || item.from_stage} ➔ ${item.to_stage_label || item.to_stage}`}
                                </span>
                                {item.is_revision && (
                                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                    Revision
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {isApproved && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Approved
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    Revision Requested
                                  </span>
                                )}
                                {isPending && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Pending Review
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400 font-medium">
                                  {item.timestamp ? new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>
                            </div>

                            {/* Submitted Plan by Employee */}
                            {cleanItemPlan && (
                              <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3 space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-gray-500">
                                  <span className="font-semibold text-gray-700">Plan & Thoughts</span>
                                  <span>By <strong className="text-gray-800">{item.submitted_by_name || 'Employee'}</strong></span>
                                </div>
                                <p className="text-gray-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans pt-0.5">
                                  {cleanItemPlan}
                                </p>
                              </div>
                            )}

                            {/* Reviewer Feedback / Verification Note */}
                            {item.review_comment && (
                              <div className={`rounded-xl p-3 space-y-1 border ${
                                isRejected 
                                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                              }`}>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold flex items-center gap-1.5">
                                    {isRejected ? (
                                      <>
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span>Feedback from {item.reviewed_by_name || 'Admin'}</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Verification Note from {item.reviewed_by_name || 'Admin'}</span>
                                      </>
                                    )}
                                  </span>
                                  {item.reviewed_at && (
                                    <span className="text-[10px] text-gray-400 font-normal">
                                      {new Date(item.reviewed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans italic pt-0.5">
                                  "{item.review_comment}"
                                </p>
                              </div>
                            )}

                            {/* Approval Sign-off Note */}
                            {item.comment && !item.review_comment && (
                              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-1 text-emerald-950">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Approved by {item.verified_by_name || 'Admin'}</span>
                                  </span>
                                </div>
                                <p className="text-gray-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans pt-0.5">
                                  "{item.comment}"
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* General Discussion & Task Comments */}
                <div className="pt-6 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                      <span>General Discussion ({generalComments.length})</span>
                    </h5>
                  </div>

                  {topGeneralComments.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1 italic">No general discussion comments yet.</p>
                  ) : (
                    topGeneralComments.map((c) => (
                      <div key={c.id} className="space-y-2 border-b border-gray-50 pb-3">
                        <div className="bg-amber-50/50 rounded-xl p-3.5 group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-gray-800">{c.admin_name || 'Admin'}</span>
                              <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canEditComment(c) && editCommentId !== c.id && (
                                <>
                                  <button onClick={() => startEdit(c)} className="text-gray-300 hover:text-gray-600 p-1" title="Edit">
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => handleDeleteReview(c.id)} className="text-gray-300 hover:text-red-500 p-1" title="Delete">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {editCommentId === c.id ? (
                            <div className="mt-2 flex gap-2">
                              <input value={editText} onChange={(e) => setEditText(e.target.value)}
                                className="input-field text-xs flex-1" autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleEditReview(c.id)} />
                              <button onClick={() => handleEditReview(c.id)} className="text-emerald-600 hover:text-emerald-700 p-1"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => { setEditCommentId(null); setEditText(''); }} className="text-gray-400 hover:text-gray-600 p-1"><XIcon className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap leading-relaxed font-sans">{cleanReviewText(c.comment_text)}</p>
                          )}
                          {(!readOnly || canReview || isAssignee) && (
                            <button onClick={() => setReplyToId(replyToId === c.id ? null : c.id)}
                              className="text-[11px] text-gray-400 hover:text-amber-600 flex items-center gap-1 mt-1.5 transition-colors font-medium">
                              <Reply className="w-3 h-3" /> Reply
                            </button>
                          )}
                        </div>

                        {/* Replies */}
                        {replies(c.id).map(r => (
                          <div key={r.id} className="ml-6 mt-2 border-l-2 border-gray-200 pl-3">
                            <div className="bg-gray-50/50 rounded-lg px-3 py-2 group">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-700">{r.admin_name || 'Admin'}</span>
                                  <span className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {canEditComment(r) && editCommentId !== r.id && (
                                    <>
                                      <button onClick={() => startEdit(r)} className="text-gray-300 hover:text-gray-600 p-1" title="Edit">
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => handleDeleteReview(r.id)} className="text-gray-300 hover:text-red-500 p-1" title="Delete">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              {editCommentId === r.id ? (
                                <div className="mt-2 flex gap-2">
                                  <input value={editText} onChange={(e) => setEditText(e.target.value)}
                                    className="input-field text-xs flex-1" autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleEditReview(r.id)} />
                                  <button onClick={() => handleEditReview(r.id)} className="text-emerald-600 hover:text-emerald-700 p-1"><Check className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => { setEditCommentId(null); setEditText(''); }} className="text-gray-400 hover:text-gray-600 p-1"><XIcon className="w-3.5 h-3.5" /></button>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{cleanReviewText(r.comment_text)}</p>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Reply input */}
                        {replyToId === c.id && (
                          <div className="ml-6 mt-2 flex gap-2">
                            <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                              className="input-field text-xs flex-1" placeholder="Write a reply..."
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleSendReply(c.id)} />
                            <button onClick={() => handleSendReply(c.id)} className="btn-amber text-xs flex items-center gap-1 px-2.5">
                              <Send className="w-3 h-3" /> Reply
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {/* Top-level review input */}
                  {canReview && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <input value={fbText} onChange={(e) => setFbText(e.target.value)}
                        className="input-field text-sm flex-1" placeholder="Write a general comment or note on this task..."
                        onKeyDown={(e) => e.key === 'Enter' && handleSendReview()} />
                      <button onClick={handleSendReview} className="btn-amber text-sm flex items-center gap-1 px-3">
                        <Send className="w-3.5 h-3.5" /> Send
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          {tab === 'explanation' && (
            <div className="space-y-5">
              {/* Add new logic log */}
              {canAddExplanation && (() => {
                const userExplanationsCount = explanationsList.filter(e => e.user_id === user.id).length;
                const reachedLimit = userExplanationsCount >= 3;
                return reachedLimit ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 flex items-center justify-between">
                    <span>You have reached the limit of 3 logical explanations for this task.</span>
                    <span className="font-semibold px-2 py-0.5 bg-amber-100 rounded">Limit 3/3</span>
                  </div>
                ) : (
                  <form onSubmit={handleSaveExplanation} className="bg-amber-50/40 border border-amber-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-900">Add Logical Explanation / Context</span>
                      <span className="text-[10px] text-gray-400 font-medium">{userExplanationsCount}/3 logged</span>
                    </div>
                    <textarea
                      value={newExpText}
                      onChange={(e) => setNewExpText(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 min-h-[90px] resize-y placeholder:text-gray-400"
                      placeholder="Explain what is the logic behind doing this work? Why should it happen? How should it happen?..."
                      required
                    />
                    <div className="flex justify-end">
                      <button type="submit" disabled={saving || !newExpText.trim()} className="btn-amber text-xs flex items-center gap-1 px-3 py-1.5 disabled:opacity-50">
                        {saving ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Log Logic Context
                      </button>
                    </div>
                  </form>
                );
              })()}

              {/* Explanations History */}
              <div className="space-y-4">
                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Logic & Strategy Timeline</h5>
                {explanationsList.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No logical explanations written yet. Explain the "why" and "how" of the task.</p>
                ) : (
                  <div className="relative border-l border-gray-100 pl-4 ml-2 space-y-4">
                    {explanationsList.map((exp) => {
                      const isOwner = exp.user_id === user.id || user.role === 'admin';
                      const formattedDate = exp.created_at ? new Date(exp.created_at).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '';
                      return (
                        <div key={exp.id} className="relative group/exp">
                          <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-white bg-blue-500 ring-4 ring-blue-50" />
                          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-2.5 transition-shadow hover:shadow-sm">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800">{exp.user_name}</span>
                                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-200/60 text-gray-500 scale-90 origin-left">
                                  {exp.user_role}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-medium text-gray-400">{formattedDate}</span>
                                {!readOnly && editingExpId !== exp.id && isOwner && (
                                  <div className="flex items-center gap-1.5 opacity-0 group-hover/exp:opacity-100 transition-opacity">
                                    {exp.user_id === user.id && (
                                      <button onClick={() => { setEditingExpId(exp.id); setEditingExpText(exp.explanation_text); }} className="text-gray-500 hover:text-gray-700">
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button onClick={() => handleDeleteExplanation(exp.id)} className="text-red-500 hover:text-red-700">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {editingExpId === exp.id ? (
                              <div className="space-y-2 pt-1">
                                <textarea
                                  value={editingExpText}
                                  onChange={(e) => setEditingExpText(e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 min-h-[80px]"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => setEditingExpId(null)}
                                    className="text-[10px] text-gray-500 hover:bg-gray-100 font-medium px-2 py-1 rounded transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleUpdateExplanation(exp.id)}
                                    disabled={saving}
                                    className="btn-amber text-[10px] font-medium px-2.5 py-1 rounded flex items-center gap-1"
                                  >
                                    {saving && <div className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />}
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{exp.explanation_text}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'daily-logs' && (
            <div className="space-y-5">
              {!readOnly && (
                <form onSubmit={handleSaveDailyLog} className="bg-amber-50/40 border border-amber-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-amber-900">Add Daily Achievement / Log</span>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="font-medium">Date:</span>
                      <input
                        type="date"
                        value={newLogDate}
                        onChange={(e) => setNewLogDate(e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <textarea
                    value={newLogContent}
                    onChange={(e) => setNewLogContent(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 min-h-[90px] resize-y placeholder:text-gray-400"
                    placeholder="What did you achieve or fail on today? What problem was solved/faced?..."
                    required
                  />
                  <div className="flex justify-end">
                    <button type="submit" disabled={saving || !newLogContent.trim()} className="btn-amber text-xs flex items-center gap-1 px-3 py-1.5 disabled:opacity-50">
                      {saving ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Log Work
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product Development History</h5>
                {dailyLogs.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No daily logs written yet. Document progress daily to build the project history.</p>
                ) : (
                  <div className="relative border-l border-gray-100 pl-4 ml-2 space-y-4">
                    {dailyLogs.map((log) => {
                      const isOwner = log.user_id === user.id;
                      const formattedDate = new Date(log.log_date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });

                      return (
                        <div key={log.id} className="relative group/log">
                          <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-white bg-amber-500 ring-4 ring-amber-50" />
                          
                          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-2.5 transition-shadow hover:shadow-sm">
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800">{log.user_name}</span>
                                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-200/60 text-gray-500 scale-90 origin-left">
                                  {log.user_role}
                                </span>
                              </div>
                              <span className="text-[10px] font-medium text-gray-400">{formattedDate}</span>
                            </div>

                            {editingLogId === log.id ? (
                              <div className="space-y-2 pt-1">
                                <textarea
                                  value={editingLogContent}
                                  onChange={(e) => setEditingLogContent(e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 min-h-[80px]"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => setEditingLogId(null)}
                                    className="text-[10px] text-gray-500 hover:bg-gray-100 font-medium px-2 py-1 rounded transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleUpdateLog(log.id, log.log_date)}
                                    className="text-[10px] text-white bg-amber-600 hover:bg-amber-700 font-semibold px-2 py-1 rounded transition-colors"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                  {log.content}
                                </p>
                                
                                <div className="flex items-center justify-between gap-3 text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => !readOnly && handleReactToLog(log.id, 'like')}
                                      className={`flex items-center gap-1 hover:text-emerald-600 transition-colors ${
                                        log.user_reaction === 'like' ? 'text-emerald-600 font-semibold' : ''
                                      } ${readOnly ? 'cursor-default hover:text-gray-500' : ''}`}
                                      title={log.liked_by_names && log.liked_by_names.length > 0 ? `Liked by: ${log.liked_by_names.join(', ')}` : 'Like achievement'}
                                    >
                                      <ThumbsUp className="w-3.5 h-3.5" />
                                      <span>{log.likes_count || 0}</span>
                                      {log.liked_by_names && log.liked_by_names.length > 0 && (
                                        <span className="text-[10px] text-gray-400 font-normal ml-1">
                                          ({log.liked_by_names.join(', ')})
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    {!readOnly && isOwner && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setEditingLogId(log.id);
                                            setEditingLogContent(log.content);
                                          }}
                                          className="flex items-center gap-0.5 hover:text-amber-600 transition-colors"
                                        >
                                          <Edit3 className="w-3 h-3" /> Edit
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (confirm('Delete this daily log?')) {
                                              handleDeleteLog(log.id);
                                            }
                                          }}
                                          className="flex items-center gap-0.5 hover:text-red-600 transition-colors"
                                        >
                                          <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Daily Log Comments */}
                                <div className="mt-3 pl-3 border-l-2 border-gray-200 space-y-2 pt-1.5">
                                  {log.comments && log.comments.length > 0 && (
                                    <div className="space-y-2">
                                      {log.comments.map(c => (
                                        <div key={c.id} className="text-xs bg-white/70 rounded-lg p-2 border border-gray-100 flex items-start justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 text-[9px] text-gray-500 mb-0.5">
                                              <span className="font-semibold text-gray-700">{c.user_name}</span>
                                              <span className="scale-75 origin-left uppercase px-1 py-0.2 rounded bg-gray-100 text-gray-400">
                                                {c.user_role}
                                              </span>
                                              <span>&middot;</span>
                                              <span>{new Date(c.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{c.comment_text}</p>
                                          </div>
                                          {!readOnly && (c.user_id === user.id || user.role === 'admin') && (
                                            <button
                                              onClick={() => handleDeleteLogComment(log.id, c.id)}
                                              className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                                              title="Delete comment"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {!readOnly && (
                                    <form onSubmit={(e) => handleAddLogComment(e, log.id)} className="flex items-center gap-1.5 mt-2">
                                      <input
                                        type="text"
                                        value={dailyLogCommentsText[log.id] || ''}
                                        onChange={(e) => setDailyLogCommentsText(prev => ({ ...prev, [log.id]: e.target.value }))}
                                        placeholder="Add a comment on this achievement..."
                                        className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                      />
                                      <button
                                        type="submit"
                                        disabled={!(dailyLogCommentsText[log.id] || '').trim()}
                                        className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white transition-colors"
                                      >
                                        <Send className="w-3 h-3" />
                                      </button>
                                    </form>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'dependencies' && (
            <div className="space-y-6">
              {/* Dependency Request Form (Only show if not readOnly, user is not resolving, and user is assignee or admin/manager) */}
              {!readOnly && !isResolver && (Number(taskData?.assignee_id || task.assignee_id) === Number(user.id) || ['admin', 'manager'].includes(user.role)) && (
                <form onSubmit={handleAddDependency} className="bg-purple-50/40 border border-purple-100 rounded-xl p-4 space-y-3.5">
                  <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5 uppercase tracking-wider">
                    <GitMerge className="w-4 h-4 text-purple-600" />
                    Tag Colleague for Blocked Dependency
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tag Person</label>
                      <select
                        value={tageeId}
                        onChange={(e) => setTageeId(e.target.value)}
                        required
                        className="border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="">Select colleague...</option>
                        {users
                          .filter(u => u.id !== user.id) // Exclude current user from tagging themselves
                          .map(u => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.role})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">What is needed from them?</label>
                    <textarea
                      value={depText}
                      onChange={(e) => setDepText(e.target.value)}
                      required
                      placeholder="Specify the details of the dependency or blocker..."
                      className="w-full border border-gray-200 rounded-lg p-2.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 min-h-[70px] resize-y placeholder:text-gray-400"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving || !tageeId || !depText.trim()}
                      className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      {saving ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Tag Blocker
                    </button>
                  </div>
                </form>
              )}

              {/* Dependency Logs List */}
              <div className="space-y-4">
                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dependency History</h5>
                {dependencies.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 border border-gray-100 rounded-xl">No dependencies logged for this task.</p>
                ) : (
                  <div className="space-y-3">
                    {dependencies.map((dep) => {
                      const isTagee = Number(dep.tagee_id) === Number(user.id);
                      return (
                        <div key={dep.id} className={`border rounded-xl p-4 flex flex-col gap-3 shadow-sm ${
                          dep.status === 'resolved' 
                            ? 'bg-emerald-50/10 border-emerald-100' 
                            : 'bg-purple-50/10 border-purple-100'
                        }`}>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-gray-800">{dep.requester_name}</span>
                              <span className="text-gray-400 text-[10px]">&rarr;</span>
                              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">{dep.tagee_name}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              dep.status === 'resolved' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {dep.status}
                            </span>
                          </div>

                          <div className="text-xs text-gray-700 leading-relaxed bg-white border border-gray-100/80 rounded-lg p-2.5 whitespace-pre-wrap">
                            {dep.dependency_text}
                          </div>

                          {/* Render Reply (if any) */}
                          {dep.reply_text ? (
                            <div className="border-t border-dashed border-gray-200 pt-3 pl-3 flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5 text-[9px] text-gray-500">
                                <span className="font-bold text-gray-800">{dep.tagee_name}</span>
                                <span>replied on</span>
                                <span>{dep.resolved_at ? new Date(dep.resolved_at).toLocaleString() : ''}</span>
                              </div>
                              <div className="text-xs text-emerald-900 bg-emerald-50/30 border border-emerald-100/50 rounded-lg p-2.5 whitespace-pre-wrap">
                                {dep.reply_text}
                              </div>
                            </div>
                          ) : (
                            /* If no reply, show reply form to the tagged person */
                            isTagee && !readOnly && (
                              <form onSubmit={(e) => handleReplyDependency(e, dep.id)} className="border-t border-dashed border-purple-200 pt-3 flex flex-col gap-2">
                                <textarea
                                  value={replyTexts[dep.id] || ''}
                                  onChange={(e) => setReplyTexts(prev => ({ ...prev, [dep.id]: e.target.value }))}
                                  required
                                  placeholder="Type your response to resolve this blocker..."
                                  className="w-full border border-gray-200 rounded-lg p-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 min-h-[50px] resize-y placeholder:text-gray-400"
                                />
                                <div className="flex justify-end">
                                  <button
                                    type="submit"
                                    disabled={saving || !(replyTexts[dep.id] || '').trim()}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors"
                                  >
                                    Submit Reply & Resolve
                                  </button>
                                </div>
                              </form>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <VerificationReviewModal
        isOpen={showVerificationReviewModal}
        onClose={() => setShowVerificationReviewModal(false)}
        task={taskData || task}
        title={verificationModalConfig.title || 'Task Verification & Review'}
        subtitle={verificationModalConfig.subtitle || 'Mandatory verification feedback before completing task'}
        buttonText={verificationModalConfig.buttonText || 'Confirm & Complete Task'}
        onConfirm={async (verification_comment) => {
          setSaving(true);
          try {
            const updated = await api.updateTask(task.id, { status: 'completed', verification_comment });
            setTaskData(updated);
            api.getComments(task.id).then(setComments).catch(() => {});
            onTaskUpdated?.(updated);
          } catch (err) {
            alert(err.message || 'Failed to complete verification.');
          } finally {
            setSaving(false);
          }
        }}
      />

      <MoveBackModal
        isOpen={showMoveBackModal}
        onClose={() => setShowMoveBackModal(false)}
        task={taskData || task}
        onConfirm={handleMoveBack}
      />
    </div>
  );
}
