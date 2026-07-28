import { Clock, User, MessageSquare, ChevronRight, MoreHorizontal, Edit3, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../App';
const roleColorMap = {
  admin: { border: 'border-red-300', bg: 'bg-red-50', dot: 'bg-red-500' },
  manager: { border: 'border-blue-300', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  employee: { border: 'border-gray-950', bg: 'bg-gray-50/50', dot: 'bg-gray-950' },
};

const priorityStyles = {
  low: 'text-gray-500 border-gray-200 bg-gray-50',
  medium: 'text-blue-600 border-blue-200 bg-blue-50',
  high: 'text-orange-600 border-orange-200 bg-orange-50',
  urgent: 'text-red-600 border-red-200 bg-red-50',
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
  if (user.role === 'admin') return true;
  if (user.role === 'employee') return task.creator_id === user.id;
  if (user.role === 'manager') {
    return task.creator_id === user.id || (task.creator_role === 'employee' && task.creator_department === user.department);
  }
  return false;
};

export default function TaskCard({ task, compact, onEdit, onDelete, onSelect, onViewDetail }) {
  const user = useAuth();
  const colors = roleColorMap[task.creator_role] || roleColorMap.employee;
  const [showMenu, setShowMenu] = useState(false);
  const [fbCount, setFbCount] = useState(0);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
  const statusActions = ['todo', 'in_progress', 'under_review', 'completed'].filter(s => s !== task.status);

  useEffect(() => {
    api.getComments(task.id).then(c => setFbCount(c.length)).catch(() => {});
  }, [task.id]);

  const handleStatusChange = async (newStatus) => {
    try {
      await api.updateTask(task.id, { status: newStatus });
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
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            {task.assignee_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{task.assignee_name}</span>}
            {task.due_date && <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : ''}`}><Clock className="w-3 h-3" />{task.due_date}</span>}
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
    <div className={`card border-l-4 ${colors.border.replace('border', 'border-l')} group relative cursor-pointer`} onClick={() => onViewDetail?.(task)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} shrink-0`} />
            <h3 className="font-medium text-gray-900 text-sm whitespace-normal">{task.title}</h3>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
            {task.assignee_name && (
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{task.assignee_name}</span>
            )}
            {task.due_date && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : ''}`}>
                <Clock className="w-3 h-3" />{task.due_date}
              </span>
            )}
            {task.estimated_hours > 0 && (
              <span>{task.estimated_hours}h est.</span>
            )}
            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{fbCount}</span>
          </div>
        </div>

        <div className="flex items-start gap-1 shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${statusStyles[task.status] || 'text-gray-500 border-gray-200 bg-gray-50'}`}>
            {statusLabels[task.status] || task.status}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${priorityStyles[task.priority]}`}>{task.priority}</span>
          {canModifyTask(user, task) && (
            <button onClick={(e) => { e.stopPropagation(); onDelete?.(task); }} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors" title="Delete task">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-1 hover:bg-gray-100 rounded transition-all" title="Task actions">
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20" onClick={(e) => e.stopPropagation()}>
                  <div className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider">Set Priority</div>
                  {['urgent', 'high', 'medium', 'low'].filter(p => p !== task.priority).map(p => (
                    <button key={p} onClick={() => { api.updateTask(task.id, { priority: p }).then(() => onEdit?.()); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 capitalize">{p}</button>
                  ))}
                  <div className="border-t border-gray-100 my-1" />
                  <div className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider">Set Status</div>
                  {statusActions.map(s => (
                    <button key={s} onClick={() => handleStatusChange(s)} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">{statusLabels[s]}</button>
                  ))}
                  <div className="border-t border-gray-100 my-1" />
                  {canModifyTask(user, task) && (
                    <button onClick={() => { onSelect?.(task); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Edit3 className="w-3.5 h-3.5" /> Edit Task
                    </button>
                  )}
                  {canModifyTask(user, task) && (
                    <button onClick={() => { onDelete?.(task); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Task
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500 space-y-1">
        {task.description && (
          <p className="line-clamp-2">{task.description}</p>
        )}
        {task.logical_explanation && (
          <p className="text-gray-400 italic line-clamp-1">
            {task.logical_explanation.length > 60 ? task.logical_explanation.slice(0, 60) + '...' : task.logical_explanation}
          </p>
        )}
      </div>

      <div className="mt-2.5 pt-1.5 border-t border-dashed border-gray-100 flex items-center gap-1.5 text-[10px] text-gray-400">
        {task.creator_id === task.assignee_id ? (
          <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">Self Assigned</span>
        ) : (
          <span>
            Assigned by <span className="font-semibold text-gray-600">{task.creator_name || 'System'}</span>
            {task.creator_role && (
              <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ml-1.5 ${
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

      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
        <span className="text-[10px] uppercase text-gray-400">{task.category}</span>
        <span className="text-[11px] text-gray-400 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" /> {fbCount}
        </span>
      </div>
    </div>
  );
}
