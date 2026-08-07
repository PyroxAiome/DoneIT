import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../App';
import { X, Send, Edit3, Trash2, Check, X as XIcon, MessageSquare, FileText, Reply, Calendar, ThumbsUp, ThumbsDown, GitMerge } from 'lucide-react';

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

export default function TaskDetailModal({ isOpen, onClose, task, onTaskUpdated, readOnly }) {
  const user = useAuth();
   const [tab, setTab] = useState(task?.defaultTab || 'reviews');
   const [comments, setComments] = useState([]);
   const [fbText, setFbText] = useState('');
   const [explanation, setExplanation] = useState('');
   const [saving, setSaving] = useState(false);
   const [editCommentId, setEditCommentId] = useState(null);
   const [editText, setEditText] = useState('');
   const [taskData, setTaskData] = useState(null);
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

   useEffect(() => {
     if (isOpen && task) {
       setTab(task.defaultTab || 'reviews');
       api.getTask(task.id).then(t => {
         setTaskData(t);
       }).catch(() => {});
       api.getComments(task.id).then(setComments).catch(() => {});
       api.getDailyLogs(task.id).then(setDailyLogs).catch(() => {});
       api.getExplanations(task.id).then(setExplanationsList).catch(() => {});
       api.getDependencies(task.id).then(setDependencies).catch(() => {});
       api.getEmployees(true).then(setUsers).catch(() => {});
     }
   }, [isOpen, task]);

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
      onTaskUpdated?.();
    } catch {}
    setSaving(false);
  };

  const handleDeleteExplanation = async (expId) => {
    try {
      await api.deleteExplanation(task.id, expId);
      setExplanationsList(prev => prev.filter(e => e.id !== expId));
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
      onTaskUpdated?.();
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
      onTaskUpdated?.();
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
      onTaskUpdated?.();
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
      onTaskUpdated?.();
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
      .finally(() => setSaving(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 truncate">{taskData?.title || task.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Status: {(taskData?.status || task.status)?.replace('_', ' ')} &middot; Priority: {taskData?.priority || task.priority}</p>
            {taskData?.last_edited_by_name && taskData?.updated_at !== taskData?.created_at && (
              <p className="text-[10px] text-gray-400 mt-1">Last edited by {taskData.last_edited_by_name} on {new Date(taskData.updated_at).toLocaleDateString()}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition-colors shrink-0 ml-3">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Description section */}
        {(taskData?.description || task.description) && (
          <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{formatDescription(taskData?.description || task.description)}</p>
          </div>
        )}

        {/* Tab buttons */}
        <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-none shrink-0">
          <button onClick={() => setTab('reviews')}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${tab === 'reviews' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-700'}`}>
            <MessageSquare className="w-4 h-4" /> Reviews
          </button>
          <button onClick={() => setTab('explanation')}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${tab === 'explanation' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-700'}`}>
            <FileText className="w-4 h-4" /> Logical Explanation
          </button>
          <button onClick={() => setTab('daily-logs')}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${tab === 'daily-logs' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-700'}`}>
            <Calendar className="w-4 h-4" /> Daily Achievements
          </button>
          <button onClick={() => setTab('dependencies')}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${tab === 'dependencies' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-700'}`}>
            <GitMerge className="w-4 h-4" /> Dependencies
          </button>
        </div>

        <div className="p-5">
          {tab === 'reviews' && (
            <div className="space-y-4">
              {topComments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No reviews yet</p>
              ) : (
                topComments.map((c) => (
                  <div key={c.id}>
                    <div className="bg-gray-50 rounded-lg px-3 py-2.5 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-700">{c.admin_name || 'Admin'}</span>
                          <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!readOnly && canEditComment(c) && editCommentId !== c.id && (
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
                        <p className="text-sm text-gray-600 mt-1">{c.comment_text}</p>
                      )}
                      {!readOnly && (
                        <button onClick={() => setReplyToId(replyToId === c.id ? null : c.id)}
                          className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 mt-1.5 transition-colors">
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
                              {!readOnly && canEditComment(r) && editCommentId !== r.id && (
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
                            <p className="text-sm text-gray-600 mt-1">{r.comment_text}</p>
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

              {/* Top-level review input — only admin/manager */}
              {!readOnly && user.role !== 'employee' && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <input value={fbText} onChange={(e) => setFbText(e.target.value)}
                    className="input-field text-sm flex-1" placeholder="Write a review..."
                    onKeyDown={(e) => e.key === 'Enter' && handleSendReview()} />
                  <button onClick={handleSendReview} className="btn-amber text-sm flex items-center gap-1 px-3">
                    <Send className="w-3.5 h-3.5" /> Send
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === 'explanation' && (
            <div className="space-y-5">
              {/* Add new logic log */}
              {!readOnly && (() => {
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
                      const formattedDate = exp.created_at ? new Date(exp.created_at.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, {
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
              {/* Dependency Request Form (Only show if not readOnly and user is assignee or admin/manager) */}
              {!readOnly && (Number(taskData?.assignee_id || task.assignee_id) === Number(user.id) || ['admin', 'manager'].includes(user.role)) && (
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
    </div>
  );
}
