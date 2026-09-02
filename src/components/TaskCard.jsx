import { Clock, User, MessageSquare, ChevronRight, MoreHorizontal, Edit3, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../App';

const roleColorMap = {
  admin: { border: 'border-red-300', bg: 'bg-red-50', dot: 'bg-red-500' },
  manager: { border: 'border-blue-300', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  employee: { border: 'border-gray-950', bg: 'bg-gray-50/50', dot: 'bg-gray-950' },
};

const priorityColorMap = {
  low: { border: 'border-slate-300', bg: 'bg-slate-100/50', dot: 'bg-slate-500' },
  medium: { border: 'border-blue-400', bg: 'bg-blue-100/40', dot: 'bg-blue-600' },
  high: { border: 'border-orange-400', bg: 'bg-orange-100/40', dot: 'bg-orange-600' },
  urgent: { border: 'border-red-400', bg: 'bg-red-100/45', dot: 'bg-red-600' },
};

const priorityStyles = {
  low: 'text-slate-700 border-slate-300 bg-slate-100',
  medium: 'text-blue-700 border-blue-300 bg-blue-100',
  high: 'text-orange-700 border-orange-300 bg-orange-100',
  urgent: 'text-red-700 border-red-300 bg-red-100',
};

const statusLabels = {
  todo: 'To Do', in_progress: 'In Progress', under_review: 'Under Review',
  completed: 'Completed',
};

const statusStyles = {
  todo: 'text-gray-500 border-gray-200 bg-gray-50',
  in_progress: 'text-blue-600 border-blue-200 bg-blue-50',
  under_review: 'text-purple-600 border-purple-200 bg-purple-50',
  completed: 'text-emerald-600 border-emerald-200 bg-emerald-50',
};

const canModifyTask = (user, task) => {
  if (!user) return false;
  if (user.role === 'intern') return false; // Interns cannot edit task definition
  if (user.role === 'admin') return true;
  if (user.role === 'manager') {
    return task.creator_id === user.id || (!['admin', 'manager'].includes(task.creator_role) && task.creator_department === user.department);
  }
  return task.creator_id === user.id;
};

const canDeleteTask = (user, task) => {
  if (!user) return false;
  if (user.role === 'intern') return false; // Interns cannot delete tasks
  if (task.status === 'completed') {
    return user.role === 'admin';
  }
  return canModifyTask(user, task);
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
  return desc;
};

export default function TaskCard({ task, compact, onEdit, onDelete, onSelect, onViewDetail, onVerificationNeeded, readOnly }) {
  const user = useAuth();
  const colors = priorityColorMap[task.priority] || priorityColorMap.medium;
  const [showMenu, setShowMenu] = useState(false);
  const [fbCount, setFbCount] = useState(0);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
  const statusActions = ['todo', 'in_progress', 'under_review', 'completed'].filter(s => s !== task.status);

  useEffect(() => {
    api.getComments(task.id).then(c => setFbCount(c.length)).catch(() => {});
  }, [task.id]);

  const handleStatusChange = async (newStatus) => {
    try {
      const result = await api.updateTask(task.id, { status: newStatus });
      if (result && result.verificationRequired) {
        if (onVerificationNeeded) {
          onVerificationNeeded({ ...task, status: 'under_review' });
        } else if (onViewDetail) {
          onViewDetail({ ...task, status: 'under_review' });
        }
      }
      if (onEdit) onEdit();
    } catch {}
    setShowMenu(false);
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colors.border} ${colors.bg} group cursor-pointer hover:shadow-sm transition-all`} onClick={() => onViewDetail?.(task)}>
        <div className={`w-2 h-2 rounded-full ${colors.dot} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-800 truncate font-medium">{task.title}</span>
            {task.project_name && (
              <span className="text-[8px] sm:text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60" title={`Project: ${task.project_name}`}>
                📁 {task.project_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            {task.group_assignees && task.group_assignees.length > 1 ? (
              <span className="flex items-center gap-1 font-bold text-gray-800" title={task.group_assignees.join(', ')}>
                <User className="w-3 h-3" />
                {task.group_assignees.join(', ')}
              </span>
            ) : task.assignee_name ? (
              <span className="flex items-center gap-1 font-bold text-gray-800">
                <User className="w-3 h-3" />
                {task.assignee_name}
              </span>
            ) : null}
            {(task.start_date || task.due_date) && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : ''}`}>
                <Clock className="w-3 h-3" />
                {task.start_date && task.due_date
                  ? `${task.start_date} → ${task.due_date}`
                  : task.start_date
                  ? `Start: ${task.start_date}`
                  : task.due_date}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${statusStyles[task.status] || 'text-gray-500 border-gray-200 bg-gray-50'}`}>
            {statusLabels[task.status] || task.status}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${priorityStyles[task.priority]}`}>{task.priority}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 border-l-4 ${colors.border.replace('border', 'border-l')} ${colors.bg} group relative cursor-pointer`} onClick={() => onViewDetail?.(task)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${colors.dot} shrink-0`} />
            <h3 className="font-semibold text-gray-900 text-xs sm:text-sm whitespace-normal leading-snug">{task.title}</h3>
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5 mt-2 text-[10px] sm:text-xs text-gray-500 flex-wrap">
            <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded border capitalize font-semibold ${statusStyles[task.status] || 'text-gray-500 border-gray-200 bg-gray-50'}`}>
              {statusLabels[task.status] || task.status}
            </span>
            <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded border capitalize font-semibold ${priorityStyles[task.priority]}`}>{task.priority}</span>
            {task.group_assignees && task.group_assignees.length > 1 ? (
              <span className="flex items-center gap-1 font-bold text-gray-800" title={task.group_assignees.join(', ')}>
                <User className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                {task.group_assignees.join(', ')}
              </span>
            ) : task.assignee_name ? (
              <span className="flex items-center gap-1 font-bold text-gray-800">
                <User className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                {task.assignee_name}
              </span>
            ) : null}
            {(task.start_date || task.due_date) && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : ''}`}>
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                {task.start_date && task.due_date
                  ? `${task.start_date} → ${task.due_date}`
                  : task.start_date
                  ? `Start: ${task.start_date}`
                  : task.due_date}
              </span>
            )}
            {task.estimated_hours > 0 && (
              <span>{task.estimated_hours}h est.</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!readOnly && canDeleteTask(user, task) && (
            <button onClick={(e) => { e.stopPropagation(); onDelete?.(task); }} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors" title="Delete task">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {!readOnly && (
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-1 hover:bg-gray-100 rounded transition-all" title="Task actions">
                <MoreHorizontal className="w-4 h-4 text-gray-400" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                  <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20" onClick={(e) => e.stopPropagation()}>
                    {user?.role !== 'intern' && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider">Set Priority</div>
                        {['urgent', 'high', 'medium', 'low'].filter(p => p !== task.priority).map(p => (
                          <button key={p} onClick={() => { api.updateTask(task.id, { priority: p }).then(() => onEdit?.()); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 capitalize">{p}</button>
                        ))}
                        <div className="border-t border-gray-100 my-1" />
                      </>
                    )}
                    <div className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider">Set Status</div>
                    {statusActions.map(s => (
                      <button key={s} onClick={() => handleStatusChange(s)} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">{statusLabels[s]}</button>
                    ))}
                    {canModifyTask(user, task) && (
                      <>
                        <div className="border-t border-gray-100 my-1" />
                        <button onClick={() => { onSelect?.(task); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <Edit3 className="w-3.5 h-3.5" /> Edit Task
                        </button>
                      </>
                    )}
                    {canDeleteTask(user, task) && (
                      <button onClick={() => { onDelete?.(task); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" /> Delete Task
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-gray-500 space-y-0.5">
        {task.description && (
          <p className="line-clamp-2">{formatDescription(task.description)}</p>
        )}
        {task.logical_explanation && (
          <p className="text-gray-400 italic line-clamp-1">
            {task.logical_explanation.length > 60 ? task.logical_explanation.slice(0, 60) + '...' : task.logical_explanation}
          </p>
        )}
      </div>

      <div className="mt-2 sm:mt-2.5 pt-1 sm:pt-1.5 border-t border-dashed border-gray-100 flex items-center justify-between gap-1.5 text-[9px] sm:text-[10px] text-gray-400 flex-wrap">
        <div>
          {task.creator_id === task.assignee_id ? (
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">Self Assigned</span>
          ) : (
            <span>
              Assigned by <span className="font-bold text-gray-900">{task.creator_name || 'System'}</span>
              {task.creator_role && (
                <span className={`text-[8px] sm:text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ml-1.5 ${
                  task.creator_role === 'admin' 
                    ? 'bg-red-50 text-red-600 border border-red-100' 
                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}>
                  {task.creator_role}
                </span>
              )}
            </span>
          )}
        </div>

        {task.status === 'completed' ? (
          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 font-medium text-[9px]">
            Verified: {task.completer_name || task.verifier_name || 'Admin'}
          </span>
        ) : (
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {task.completed_by && Number(task.completed_by) !== Number(task.verifier_id) && (
              <span className="text-emerald-700 bg-emerald-50/90 px-1.5 py-0.5 rounded border border-emerald-200/60 font-medium text-[9px]" title={`Previously verified by ${task.completer_name || 'Admin'}`}>
                Prev. Verified: {task.completer_name || 'Admin'}
              </span>
            )}
            {task.verifier_name && (
              <span className={`px-1.5 py-0.5 rounded border font-medium text-[9px] ${
                Number(task.verifier_id) === Number(user?.id)
                  ? (task.status === 'under_review' ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold animate-pulse' : 'bg-purple-100 text-purple-900 border-purple-300 font-semibold')
                  : (task.completed_by && Number(task.completed_by) !== Number(task.verifier_id) ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-purple-700 bg-purple-50 border-purple-200/60')
              }`} title={`Task verifier: ${task.verifier_name} (${task.verifier_role || 'Verifier'})`}>
                🛡️ {task.completed_by && Number(task.completed_by) !== Number(task.verifier_id) ? 'Re-Verify:' : 'Verifier:'} {Number(task.verifier_id) === Number(user?.id) ? 'You' : task.verifier_name}
                {Number(task.verifier_id) === Number(user?.id) && task.status === 'under_review' ? ' (Review)' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 sm:mt-2.5 pt-1.5 sm:pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] sm:text-[10px] uppercase text-gray-400 font-semibold">{task.category}</span>
          {task.project_name && (
            <span className="text-[8px] sm:text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60" title={`Project: ${task.project_name}`}>
              📁 {task.project_name}
            </span>
          )}
        </div>
        <span className="text-[10px] sm:text-[11px] text-gray-400 flex items-center gap-1">
          <MessageSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {fbCount}
        </span>
      </div>
    </div>
  );
}
