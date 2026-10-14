import { useState } from 'react';
import {
  Clock, User, Check, AlertCircle, AlertTriangle, ShieldCheck,
  ChevronRight, ArrowRight, ArrowLeft, Plus, Filter, Tag, Layers, RefreshCw,
  MoreHorizontal, Edit3, Trash2
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../App';
import StageVerificationModal from './StageVerificationModal';

const GENERAL_STAGES = [
  { key: 'todo', label: 'Pending', fullTitle: 'To Do / Pending', description: 'Tasks awaiting initial pickup and action', color: 'border-slate-300 bg-slate-50/80 text-slate-800', headerBg: 'bg-slate-100 border-slate-200' },
  { key: 'in_progress', label: 'Progress', fullTitle: 'In Progress', description: 'Tasks actively being worked on', color: 'border-blue-300 bg-blue-50/50 text-blue-900', headerBg: 'bg-blue-50 border-blue-200' },
  { key: 'under_review', label: 'Review', fullTitle: 'Under Review', description: 'Tasks submitted awaiting verifier sign-off', color: 'border-purple-300 bg-purple-50/50 text-purple-900', headerBg: 'bg-purple-50 border-purple-200' },
  { key: 'completed', label: 'Completed', fullTitle: 'Completed', description: 'Verified and finalized tasks', color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900', headerBg: 'bg-emerald-50 border-emerald-200' }
];

const VISHWAS_STAGES = [
  { key: 'todo', label: 'Issue', fullTitle: '🔍 Issue Logged', description: 'Initial quality defect or issue logged for tracking', color: 'border-rose-300 bg-rose-50/60 text-rose-900', headerBg: 'bg-rose-50 border-rose-200' },
  { key: 'rca_in_progress', label: 'Analysis', fullTitle: '🔬 Root Cause Analysis', description: 'Deep-dive investigation into underlying failure factors', color: 'border-amber-300 bg-amber-50/60 text-amber-900', headerBg: 'bg-amber-50 border-amber-200' },
  { key: 'in_progress', label: 'Action', fullTitle: '🛠️ Action in Progress', description: 'Executing corrective action and preventive measures', color: 'border-blue-300 bg-blue-50/60 text-blue-900', headerBg: 'bg-blue-50 border-blue-200' },
  { key: 'under_review', label: 'Audit', fullTitle: '🧪 QA Audit & Testing', description: 'Quality assurance testing, verification, and inspection', color: 'border-purple-300 bg-purple-50/60 text-purple-900', headerBg: 'bg-purple-50 border-purple-200' },
  { key: 'completed', label: 'Resolved', fullTitle: '🛡️ Verified & Standardized', description: 'Fully verified fix, standardized into SOP/workflow', color: 'border-emerald-300 bg-emerald-50/60 text-emerald-900', headerBg: 'bg-emerald-50 border-emerald-200' }
];

const AVISHKAR_STAGES = [
  { key: 'todo', label: 'Idea', fullTitle: '💡 Idea & Proposal', description: 'Initial innovative idea or project proposal submitted', color: 'border-amber-300 bg-amber-50/60 text-amber-900', headerBg: 'bg-amber-50 border-amber-200' },
  { key: 'feasibility_planning', label: 'Planning', fullTitle: '📐 Feasibility & Planning', description: 'Assessing technical viability, resources, and scope', color: 'border-indigo-300 bg-indigo-50/60 text-indigo-900', headerBg: 'bg-indigo-50 border-indigo-200' },
  { key: 'in_progress', label: 'Prototype', fullTitle: '🧪 PoC / Prototype', description: 'Building initial proof of concept or prototype', color: 'border-blue-300 bg-blue-50/60 text-blue-900', headerBg: 'bg-blue-50 border-blue-200' },
  { key: 'under_review', label: 'Trial', fullTitle: '🚀 Testing & Trial', description: 'Real-world field trial and user feedback evaluation', color: 'border-purple-300 bg-purple-50/60 text-purple-900', headerBg: 'bg-purple-50 border-purple-200' },
  { key: 'completed', label: 'Deployed', fullTitle: '🌟 Deployed & Adopted', description: 'Successfully deployed and adopted into operations', color: 'border-emerald-300 bg-emerald-50/60 text-emerald-900', headerBg: 'bg-emerald-50 border-emerald-200' }
];

const PRIORITY_MAP = {
  urgent: { label: 'CRITICAL', rank: 1, border: 'border-l-4 border-l-red-500', badge: 'bg-red-100 text-red-800 border-red-200' },
  high: { label: 'HIGH', rank: 2, border: 'border-l-4 border-l-orange-500', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  medium: { label: 'MEDIUM', rank: 3, border: 'border-l-4 border-l-blue-500', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  low: { label: 'LOW', rank: 4, border: 'border-l-4 border-l-slate-400', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
};

const PRODUCT_MAP = {
  general: '🌐 General',
  home_automation: '🏠 Home Automation',
  fire_ready: '🔥 Fire-ready',
  firesafety: '🧯 VictoFire',
  victofire: '🧯 VictoFire',
  other: '📌 Other'
};

const PILLAR_TRANSFERRABLE = ['general', 'vishwas', 'avishkar'];

export default function TaskKanbanBoard({
  tasks = [],
  activePillar: propPillar,
  pillar: pillarProp,
  onRefresh,
  onViewDetail,
  onEditTask,
  onDeleteTask,
  selectedEmp
}) {
  const user = useAuth();
  const [priorityFilter, setPriorityFilter] = useState('all'); // 'all' | 'urgent' | 'high' | 'medium' | 'low'
  const [productLineFilter, setProductLineFilter] = useState('all'); // 'all' | 'general' | 'home_automation' | ...
  const [openMenuTaskId, setOpenMenuTaskId] = useState(null);
  const [movingTaskId, setMovingTaskId] = useState(null);
  const [stageVerificationTask, setStageVerificationTask] = useState(null);
  const [stageMoveDetails, setStageMoveDetails] = useState({
    fromStageLabel: '',
    toStageLabel: '',
    fromStageKey: '',
    toStageKey: ''
  });
  const [transferPillarTaskId, setTransferPillarTaskId] = useState(null);
  const [targetPillar, setTargetPillar] = useState('');

  const handleConfirmStageVerification = async (verificationPayload) => {
    if (!stageVerificationTask) return;
    try {
      let backendStatus = verificationPayload.to_stage;
      if (backendStatus === 'todo') backendStatus = 'pending';

      await api.updateTask(stageVerificationTask.id, {
        status: backendStatus,
        stage_verification: verificationPayload
      });
      setStageVerificationTask(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to verify and update stage');
    }
  };

  const getPillarStages = (pillarName) => {
    const p = (pillarName || '').toLowerCase();
    if (p === 'vishwas') return VISHWAS_STAGES;
    if (p === 'avishkar') return AVISHKAR_STAGES;
    return GENERAL_STAGES;
  };

  const selectedPillar = propPillar || pillarProp;
  const activePillar = (selectedPillar && selectedPillar !== 'all')
    ? selectedPillar.toLowerCase()
    : (tasks.length > 0 && tasks.every(t => (t.pillar || 'general').toLowerCase() === (tasks[0].pillar || 'general').toLowerCase())
        ? (tasks[0].pillar || 'general').toLowerCase()
        : 'general');

  const stages = getPillarStages(activePillar);

  // Map backend task statuses to canonical stage keys per pillar
  const normalizeStatus = (status, pillarName) => {
    const p = (pillarName || activePillar || 'general').toLowerCase();
    if (p === 'vishwas') {
      if (!status || status === 'pending' || status === 'todo' || status === 'issue_logged') return 'todo';
      if (status === 'rca' || status === 'rca_in_progress') return 'rca_in_progress';
      if (status === 'in_progress' || status === 'action_in_progress') return 'in_progress';
      if (status === 'under_review' || status === 'review' || status === 'qa_testing') return 'under_review';
      if (status === 'completed' || status === 'verified_standardized') return 'completed';
      return 'todo';
    }
    if (p === 'avishkar') {
      if (!status || status === 'pending' || status === 'todo' || status === 'idea_proposal') return 'todo';
      if (status === 'feasibility' || status === 'feasibility_planning') return 'feasibility_planning';
      if (status === 'in_progress' || status === 'poc_prototype') return 'in_progress';
      if (status === 'under_review' || status === 'review' || status === 'testing_trial') return 'under_review';
      if (status === 'completed' || status === 'deployed_adopted') return 'completed';
      return 'todo';
    }
    if (!status || status === 'pending' || status === 'todo') return 'todo';
    if (status === 'in_progress') return 'in_progress';
    if (status === 'under_review' || status === 'review') return 'under_review';
    if (status === 'completed') return 'completed';
    return 'todo';
  };

  // Filter tasks by selected priority & product line if active
  const filteredTasks = tasks.filter(t => {
    if (priorityFilter !== 'all') {
      const tPri = (t.priority || 'medium').toLowerCase();
      if (priorityFilter === 'urgent' && (tPri === 'urgent' || tPri === 'critical')) return true;
      if (tPri !== priorityFilter) return false;
    }
    if (productLineFilter !== 'all') {
      const tProd = (t.product_line || 'general').toLowerCase();
      if (tProd !== productLineFilter) return false;
    }
    return true;
  });

  const canManageTask = (t) => {
    if (!user) return false;
    const uId = Number(user.id);

    // Admins and Managers can manage tasks in their workspace
    if (user.role === 'admin' || user.role === 'manager' || user.role === 'site_manager') return true;

    // Check if user is the assigned mentor for this task or for selectedEmp
    const taskMentorId = Number(t.assignee_mentor_id || t.mentor_id || (selectedEmp ? selectedEmp.mentor_id : null));
    if (taskMentorId && taskMentorId === uId) return true;

    // If inspecting another employee's profile as a general employee/intern (who is NOT their mentor)
    if (selectedEmp && Number(selectedEmp.id) !== uId) return false;

    // Regular employees/interns can ONLY manage tasks assigned to them, created by them, or where they are verifier/hiring_lead
    if (Number(t.assignee_id) === uId) return true;
    if (Number(t.creator_id) === uId) return true;
    if (Number(t.verifier_id) === uId) return true;
    if (Number(t.completed_by) === uId) return true;
    if (Number(t.hiring_lead_id) === uId) return true;
    if (t.group_assignee_ids && Array.isArray(t.group_assignee_ids) && t.group_assignee_ids.map(Number).includes(uId)) return true;

    return false;
  };

  // Handle stage move (modifies status strictly without affecting pillar)
  const handleStageMove = async (task, direction) => {
    if (!canManageTask(task)) {
      alert("Permission Denied: You can only move or update tasks assigned to you or created by you.");
      return;
    }

    const taskStages = getPillarStages(task.pillar);
    const currStageKey = normalizeStatus(task.status, task.pillar);
    const currIdx = taskStages.findIndex(s => s.key === currStageKey);
    if (currIdx === -1) return;

    const targetIdx = direction === 'next' ? currIdx + 1 : currIdx - 1;
    if (targetIdx < 0 || targetIdx >= taskStages.length) return;

    const targetStage = taskStages[targetIdx];
    let backendStatus = targetStage.key;
    if (backendStatus === 'todo') backendStatus = 'pending';

    const isInternTask = task.assignee_role === 'intern' || Boolean(task.assignee_mentor_id);
    const mentorId = Number(task.assignee_mentor_id || task.mentor_id);
    const isAssignedMentor = Boolean(mentorId && Number(user?.id) === mentorId);
    const isAssignee = Number(task.assignee_id) === Number(user?.id);

    // If task is assigned to an Intern:
    if (isInternTask) {
      if (isAssignedMentor) {
        // Mentor is moving stage for an Intern task -> Open StageVerificationModal for written review
        setStageMoveDetails({
          fromStageLabel: taskStages[currIdx]?.label || currStageKey,
          toStageLabel: targetStage?.label || targetStage.key,
          fromStageKey: currStageKey,
          toStageKey: targetStage.key
        });
        setStageVerificationTask(task);
        return;
      }

      let stageVerifications = [];
      try {
        const raw = task.stage_verifications;
        stageVerifications = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
      } catch (e) {
        stageVerifications = [];
      }
      const mentorHasVerified = Array.isArray(stageVerifications) && stageVerifications.some(sv => Number(sv.verified_by_id) === mentorId);

      if (!isAssignee && !mentorHasVerified && user?.role !== 'admin' && user?.role !== 'manager') {
        const mentorDisplayName = task.mentor_name || 'Assigned Mentor';
        alert(`Mentor Verification Required: This task assigned to Intern "${task.assignee_name || 'Intern'}" must first be stage-verified by their assigned Mentor (${mentorDisplayName}).`);
        return;
      }
    }

    const isAuthorizedVerifier = user?.role === 'admin' || 
      (task.verifier_id && Number(task.verifier_id) === Number(user?.id)) ||
      (task.completed_by && Number(task.completed_by) === Number(user?.id));

    // If attempting to move to final stage or if moving away from review stage:
    if (targetIdx === taskStages.length - 1 || currStageKey === 'under_review') {
      if (targetIdx === taskStages.length - 1) {
        if (!isAuthorizedVerifier) {
          alert(`Verification Required: Only the assigned verifier (${task.verifier_name || 'Admin'}) or an Admin can review and approve a task in Review stage.`);
        }
        // Always open the Task Detail Modal so the reviewer can write their review & perform verification
        if (onViewDetail) {
          onViewDetail(task);
        }
        return;
      }
    }

    setMovingTaskId(task.id);
    try {
      const result = await api.updateTask(task.id, { status: backendStatus });
      if (result && result.verificationRequired) {
        alert(`Task submitted for Review. It requires verification by ${task.verifier_name || 'Admin'} before it can be marked Completed.`);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to update task status');
    } finally {
      setMovingTaskId(null);
    }
  };

  // Handle explicit pillar transfer between core technical pillars (general, vishwas, avishkar)
  const handleTransferPillar = async (taskId) => {
    if (!targetPillar) return;
    try {
      await api.updateTask(taskId, { pillar: targetPillar });
      setTransferPillarTaskId(null);
      setTargetPillar('');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to transfer task pillar');
    }
  };

  return (
    <div className="space-y-4">
      {/* Kanban Header Controls Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-600" />
          <span className="font-bold text-xs text-gray-900 uppercase tracking-wider">
            Task Kanban Board ({filteredTasks.length} {filteredTasks.length === 1 ? 'Task' : 'Tasks'})
          </span>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority Filter */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 flex-wrap">
            <span className="text-[10px] font-bold text-gray-500 uppercase px-2 flex items-center gap-1">
              <Filter className="w-3 h-3 text-gray-400" /> Priority:
            </span>
            <button
              onClick={() => setPriorityFilter('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${priorityFilter === 'all' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
            >
              All
            </button>
            <button
              onClick={() => setPriorityFilter('urgent')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${priorityFilter === 'urgent' ? 'bg-red-100 text-red-800 font-bold border border-red-300 shadow-xs' : 'text-gray-600 hover:text-red-700'}`}
            >
              🔴 Critical
            </button>
            <button
              onClick={() => setPriorityFilter('high')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${priorityFilter === 'high' ? 'bg-orange-100 text-orange-800 font-bold border border-orange-300 shadow-xs' : 'text-gray-600 hover:text-orange-700'}`}
            >
              🟠 High
            </button>
            <button
              onClick={() => setPriorityFilter('medium')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${priorityFilter === 'medium' ? 'bg-blue-100 text-blue-800 font-bold border border-blue-300 shadow-xs' : 'text-gray-600 hover:text-blue-700'}`}
            >
              🟡 Medium
            </button>
            <button
              onClick={() => setPriorityFilter('low')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${priorityFilter === 'low' ? 'bg-slate-200 text-slate-800 font-bold border border-slate-300 shadow-xs' : 'text-gray-600 hover:text-slate-800'}`}
            >
              ⚪ Low
            </button>
          </div>

          {/* Product Line Filter */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-200">
            <span className="text-[10px] font-bold text-gray-500 uppercase px-1.5 flex items-center gap-1">
              <Tag className="w-3 h-3 text-gray-400" /> Product:
            </span>
            <select
              value={productLineFilter}
              onChange={e => setProductLineFilter(e.target.value)}
              className="text-xs font-semibold bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="all">All Product Lines</option>
              <option value="general">🌐 General</option>
              <option value="home_automation">🏠 Home Automation</option>
              <option value="fire_ready">🔥 Fire-ready</option>
              <option value="victofire">🧯 VictoFire</option>
              <option value="other">📌 Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status Kanban Columns */}
      <div className={`grid grid-cols-1 ${stages.length === 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3 items-start`}>
        {stages.map((stage, sIdx) => {
          const stageTasks = filteredTasks
            .filter(t => normalizeStatus(t.status, t.pillar) === stage.key)
            .sort((a, b) => {
              const rA = PRIORITY_MAP[(a.priority || 'medium').toLowerCase()]?.rank || 3;
              const rB = PRIORITY_MAP[(b.priority || 'medium').toLowerCase()]?.rank || 3;
              return rA - rB;
            });

          return (
            <div key={stage.key} className="bg-gray-100/70 border border-gray-200 rounded-xl p-3 flex flex-col space-y-3 min-h-[520px] max-h-[calc(100vh-280px)]">
              {/* Column Header with Hover Tooltip Popup */}
              <div
                title={`${stage.fullTitle}: ${stage.description}`}
                className={`group relative p-2.5 rounded-lg border flex items-center justify-between ${stage.headerBg} shrink-0 cursor-pointer transition-all hover:shadow-xs`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="font-bold text-xs text-gray-900 tracking-wide uppercase truncate">{stage.label}</h3>
                </div>
                <span className="text-[11px] font-extrabold px-2 py-0.5 bg-white rounded-full border text-gray-800 shadow-2xs">
                  {stageTasks.length}
                </span>

                {/* Hover Tooltip Popup */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 hidden group-hover:block z-30 w-56 p-2.5 bg-gray-900 text-white text-[11px] rounded-lg shadow-xl border border-gray-700 pointer-events-none transition-all animate-in fade-in duration-150">
                  <div className="font-bold text-amber-300 text-xs mb-0.5">{stage.fullTitle}</div>
                  <div className="text-gray-300 text-[10px] leading-relaxed">{stage.description}</div>
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-t border-l border-gray-700"></div>
                </div>
              </div>

              {/* Column Cards Container (Vertically Scrollable) */}
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {stageTasks.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 italic border border-dashed border-gray-300 rounded-lg bg-white/40">
                    No tasks in {stage.fullTitle || stage.label}
                  </div>
                ) : (
                  stageTasks.map(t => {
                    const priKey = (t.priority || 'medium').toLowerCase();
                    const priInfo = PRIORITY_MAP[priKey] || PRIORITY_MAP.medium;
                    const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
                    const canTransferPillar = PILLAR_TRANSFERRABLE.includes((t.pillar || 'general').toLowerCase());
                    const productLabel = t.product_line === 'other' && t.product_line_other
                      ? `📌 ${t.product_line_other}`
                      : (PRODUCT_MAP[(t.product_line || 'general').toLowerCase()] || `📦 ${t.product_line}`);

                    return (
                      <div
                        key={t.id}
                        onClick={() => onViewDetail?.(t)}
                        className={`p-3.5 bg-white border border-gray-200 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer space-y-2.5 ${priInfo.border} ${movingTaskId === t.id ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        {/* Priority Badge, Product Line & 3-Dots Action Menu */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${priInfo.badge}`}>
                              {priInfo.label}
                            </span>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                              🏛️ {t.pillar || 'general'}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200/80">
                              {productLabel}
                            </span>
                          </div>

                          {/* 3-Dots Action Menu */}
                          {canManageTask(t) && (
                            <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => setOpenMenuTaskId(openMenuTaskId === t.id ? null : t.id)}
                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors"
                                title="Task Actions"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>

                              {openMenuTaskId === t.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuTaskId(null)} />
                                  <div className="absolute right-0 top-6 w-36 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-20 animate-in fade-in duration-100">
                                    {onEditTask && (
                                      <button
                                        onClick={() => { setOpenMenuTaskId(null); onEditTask(t); }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 flex items-center gap-2 font-semibold"
                                      >
                                        <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Edit Task
                                      </button>
                                    )}
                                    {onDeleteTask && (
                                      <button
                                        onClick={() => { setOpenMenuTaskId(null); onDeleteTask(t); }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-semibold border-t border-gray-100"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" /> Delete Task
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4 className="font-semibold text-xs text-gray-900 line-clamp-2 leading-snug">{t.title}</h4>
                          {t.project_name && (
                            <span className="text-[9px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded inline-block mt-1">
                              📁 {t.project_name}
                            </span>
                          )}
                        </div>

                        {/* Assignee & Dates */}
                        <div className="text-[11px] text-gray-600 space-y-1 pt-1 border-t border-gray-100">
                          {t.assignee_name && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-gray-400 shrink-0" />
                              <span className="truncate">Assignee: <strong>{t.assignee_name}</strong></span>
                            </div>
                          )}
                          {t.verifier_name && (
                            <div className="flex items-center gap-1 text-[10px]">
                              <ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate text-amber-800">Verifier: <strong>{t.verifier_name}</strong></span>
                            </div>
                          )}
                          {(t.start_date || t.due_date) && (
                            <div className={`flex items-center gap-1 text-[10px] ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                              <Clock className="w-3 h-3 shrink-0" />
                              <span>{t.due_date ? `Due: ${t.due_date}` : `Start: ${t.start_date}`}</span>
                              {isOverdue && <span className="text-[9px] uppercase bg-red-100 text-red-700 px-1 rounded">Overdue</span>}
                            </div>
                          )}
                        </div>

                        {/* Stage Controls & Transfer Pillar Actions */}
                        {canManageTask(t) ? (
                          <div className="flex items-center justify-between gap-1 pt-2 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                            {/* Quick Stage Progression Buttons */}
                            <div className="flex items-center gap-1">
                              {sIdx > 0 && (
                                <button
                                  onClick={() => handleStageMove(t, 'prev')}
                                  className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                                  title="Move to Previous Stage"
                                >
                                  <ArrowLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {sIdx < stages.length - 1 && (
                                <button
                                  onClick={() => handleStageMove(t, 'next')}
                                  className="p-1 hover:bg-amber-100 rounded text-amber-700 font-semibold transition-colors flex items-center gap-0.5 text-[10px]"
                                  title="Advance Stage"
                                >
                                  <span>Move</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Explicit Pillar Transfer (General ↔ Vishwas ↔ Avishkar) */}
                            {canTransferPillar && (
                              <div>
                                {transferPillarTaskId === t.id ? (
                                  <div className="flex items-center gap-1 animate-in fade-in">
                                    <select
                                      value={targetPillar}
                                      onChange={e => setTargetPillar(e.target.value)}
                                      className="text-[10px] p-0.5 bg-white border border-amber-300 rounded"
                                    >
                                      <option value="">Pillar</option>
                                      {PILLAR_TRANSFERRABLE.filter(p => p !== (t.pillar || 'general')).map(p => (
                                        <option key={p} value={p}>{p}</option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => handleTransferPillar(t.id)}
                                      disabled={!targetPillar}
                                      className="text-[9px] bg-amber-600 text-white px-1.5 py-0.5 rounded font-bold disabled:opacity-50"
                                    >
                                      Go
                                    </button>
                                    <button
                                      onClick={() => setTransferPillarTaskId(null)}
                                      className="text-[9px] text-gray-400 hover:text-gray-600 px-0.5"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setTransferPillarTaskId(t.id); setTargetPillar(''); }}
                                    className="text-[9px] font-semibold text-gray-500 hover:text-amber-800 hover:bg-amber-50 px-1.5 py-0.5 rounded border border-gray-200 transition-colors"
                                    title="Transfer task between General ↔ Vishwas ↔ Avishkar"
                                  >
                                    ⇄ Pillar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end pt-1.5 border-t border-gray-100">
                            <span className="text-[9px] font-semibold text-gray-400 uppercase bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200/60">
                              Read Only
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <StageVerificationModal
        isOpen={Boolean(stageVerificationTask)}
        onClose={() => setStageVerificationTask(null)}
        task={stageVerificationTask}
        fromStageLabel={stageMoveDetails.fromStageLabel}
        toStageLabel={stageMoveDetails.toStageLabel}
        fromStageKey={stageMoveDetails.fromStageKey}
        toStageKey={stageMoveDetails.toStageKey}
        onConfirm={handleConfirmStageVerification}
      />
    </div>
  );
}
