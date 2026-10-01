import { useState } from 'react';
import {
  Clock, User, Check, AlertCircle, AlertTriangle, ShieldCheck,
  ChevronRight, ArrowRight, ArrowLeft, Plus, Filter, Tag, Layers, RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../App';

const STAGES = [
  { key: 'todo', label: 'To Do / Pending', color: 'border-slate-300 bg-slate-50/80 text-slate-800', headerBg: 'bg-slate-100 border-slate-200', icon: Clock },
  { key: 'in_progress', label: 'In Progress', color: 'border-blue-300 bg-blue-50/50 text-blue-900', headerBg: 'bg-blue-50 border-blue-200', icon: ChevronRight },
  { key: 'under_review', label: 'Under Review', color: 'border-purple-300 bg-purple-50/50 text-purple-900', headerBg: 'bg-purple-50 border-purple-200', icon: AlertCircle },
  { key: 'completed', label: 'Completed', color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900', headerBg: 'bg-emerald-50 border-emerald-200', icon: Check }
];

const PRIORITY_MAP = {
  urgent: { label: 'CRITICAL', rank: 1, border: 'border-l-4 border-l-red-500', badge: 'bg-red-100 text-red-800 border-red-200' },
  high: { label: 'HIGH', rank: 2, border: 'border-l-4 border-l-orange-500', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  medium: { label: 'MEDIUM', rank: 3, border: 'border-l-4 border-l-blue-500', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  low: { label: 'LOW', rank: 4, border: 'border-l-4 border-l-slate-400', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
};

const PILLAR_TRANSFERRABLE = ['general', 'vishwas', 'avishkar'];

export default function TaskKanbanBoard({
  tasks = [],
  onRefresh,
  onViewDetail,
  onEditTask,
  onDeleteTask,
  selectedEmp
}) {
  const user = useAuth();
  const [priorityFilter, setPriorityFilter] = useState('all'); // 'all' | 'urgent' | 'high' | 'medium' | 'low'
  const [movingTaskId, setMovingTaskId] = useState(null);
  const [transferPillarTaskId, setTransferPillarTaskId] = useState(null);
  const [targetPillar, setTargetPillar] = useState('');

  // Map backend task statuses to the 4 canonical stages
  const normalizeStatus = (status) => {
    if (!status || status === 'pending' || status === 'todo') return 'todo';
    if (status === 'in_progress') return 'in_progress';
    if (status === 'under_review' || status === 'review') return 'under_review';
    if (status === 'completed') return 'completed';
    return 'todo';
  };

  // Filter tasks by selected priority if active
  const filteredTasks = tasks.filter(t => {
    if (priorityFilter !== 'all') {
      const tPri = (t.priority || 'medium').toLowerCase();
      if (priorityFilter === 'urgent' && (tPri === 'urgent' || tPri === 'critical')) return true;
      if (tPri !== priorityFilter) return false;
    }
    return true;
  });

  // Handle stage move (modifies status strictly without affecting pillar)
  const handleStageMove = async (task, newStageKey) => {
    let backendStatus = newStageKey;
    if (newStageKey === 'todo') backendStatus = 'pending';

    setMovingTaskId(task.id);
    try {
      await api.updateTask(task.id, { status: backendStatus });
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

        {/* Priority Filter Toggle Bar */}
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
      </div>

      {/* 4 Status Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        {STAGES.map(stage => {
          const StageIcon = stage.icon;
          const stageTasks = filteredTasks
            .filter(t => normalizeStatus(t.status) === stage.key)
            .sort((a, b) => {
              const rA = PRIORITY_MAP[(a.priority || 'medium').toLowerCase()]?.rank || 3;
              const rB = PRIORITY_MAP[(b.priority || 'medium').toLowerCase()]?.rank || 3;
              return rA - rB;
            });

          return (
            <div key={stage.key} className="bg-gray-100/70 border border-gray-200 rounded-xl p-3 flex flex-col space-y-3 min-h-[500px]">
              {/* Column Header */}
              <div className={`p-2.5 rounded-lg border flex items-center justify-between ${stage.headerBg}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <StageIcon className="w-4 h-4 shrink-0 text-gray-700" />
                  <h3 className="font-bold text-xs text-gray-900 truncate">{stage.label}</h3>
                </div>
                <span className="text-[11px] font-extrabold px-2 py-0.5 bg-white rounded-full border text-gray-800 shadow-2xs">
                  {stageTasks.length}
                </span>
              </div>

              {/* Column Cards Container */}
              <div className="space-y-3 flex-1">
                {stageTasks.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 italic border border-dashed border-gray-300 rounded-lg bg-white/40">
                    No tasks in {stage.label}
                  </div>
                ) : (
                  stageTasks.map(t => {
                    const priKey = (t.priority || 'medium').toLowerCase();
                    const priInfo = PRIORITY_MAP[priKey] || PRIORITY_MAP.medium;
                    const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
                    const canTransferPillar = PILLAR_TRANSFERRABLE.includes((t.pillar || 'general').toLowerCase());

                    return (
                      <div
                        key={t.id}
                        onClick={() => onViewDetail?.(t)}
                        className={`p-3.5 bg-white border border-gray-200 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer space-y-2.5 ${priInfo.border} ${movingTaskId === t.id ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        {/* Priority Badge & Workspace Tag */}
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${priInfo.badge}`}>
                            {priInfo.label}
                          </span>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                            🏛️ {t.pillar || 'general'}
                          </span>
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
                        <div className="flex items-center justify-between gap-1 pt-2 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                          {/* Quick Stage Progression Buttons */}
                          <div className="flex items-center gap-1">
                            {stage.key !== 'todo' && (
                              <button
                                onClick={() => handleStageMove(t, stage.key === 'completed' ? 'under_review' : stage.key === 'under_review' ? 'in_progress' : 'todo')}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                                title="Move to Previous Stage"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {stage.key !== 'completed' && (
                              <button
                                onClick={() => handleStageMove(t, stage.key === 'todo' ? 'in_progress' : stage.key === 'in_progress' ? 'under_review' : 'completed')}
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
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
