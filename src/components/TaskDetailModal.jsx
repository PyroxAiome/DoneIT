import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../App';
import { X, Send, Edit3, Trash2, Check, X as XIcon, MessageSquare, FileText, Reply } from 'lucide-react';

export default function TaskDetailModal({ isOpen, onClose, task, onTaskUpdated }) {
  const user = useAuth();
  const [tab, setTab] = useState('reviews');
  const [comments, setComments] = useState([]);
  const [fbText, setFbText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [saving, setSaving] = useState(false);
  const [editCommentId, setEditCommentId] = useState(null);
  const [editText, setEditText] = useState('');
  const [taskData, setTaskData] = useState(null);
  const [replyToId, setReplyToId] = useState(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    if (isOpen && task) {
      api.getTask(task.id).then(t => {
        setTaskData(t);
        setExplanation(t.logical_explanation || '');
      }).catch(() => {});
      api.getComments(task.id).then(setComments).catch(() => {});
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const topComments = comments.filter(c => !c.parent_id);
  const replies = (parentId) => comments.filter(c => c.parent_id === parentId);

  const handleSaveExplanation = async () => {
    setSaving(true);
    try {
      await api.updateTask(task.id, { logical_explanation: explanation });
      const t = await api.getTask(task.id);
      setTaskData(t);
      onTaskUpdated?.();
    } catch {}
    setSaving(false);
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
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{taskData?.description || task.description}</p>
          </div>
        )}

        {/* Tab buttons */}
        <div className="flex border-b border-gray-100">
          <button onClick={() => setTab('reviews')}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors ${tab === 'reviews' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-700'}`}>
            <MessageSquare className="w-4 h-4" /> Reviews
          </button>
          <button onClick={() => setTab('explanation')}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors ${tab === 'explanation' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-700'}`}>
            <FileText className="w-4 h-4" /> Logical Explanation
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
                        <p className="text-sm text-gray-600 mt-1">{c.comment_text}</p>
                      )}
                      <button onClick={() => setReplyToId(replyToId === c.id ? null : c.id)}
                        className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 mt-1.5 transition-colors">
                        <Reply className="w-3 h-3" /> Reply
                      </button>
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
              {user.role !== 'employee' && (
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
            <div>
              <p className="text-xs text-gray-400 mb-2">Explain what's happening with this work — any context the team should know.</p>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                className="input-field min-h-[200px] resize-y"
                placeholder="Write your explanation here..."
              />
              <div className="flex justify-end mt-2">
                <button onClick={handleSaveExplanation} disabled={saving} className="btn-amber text-xs flex items-center gap-1 px-3 py-1.5 disabled:opacity-50">
                  {saving ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {saving ? 'Saving...' : 'Save Explanation'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
