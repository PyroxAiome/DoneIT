import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, AlertCircle, CheckCircle2, Trash2, Send } from 'lucide-react';

export default function BulkImportModal({ isOpen, employees, onClose, onImportSuccess }) {
  const [pastedText, setPastedText] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setPastedText('');
      setTasks([]);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePasteChange = (e) => {
    const text = e.target.value;
    setPastedText(text);

    if (!text.trim()) {
      setTasks([]);
      return;
    }

    let lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes('assignee') || firstLine.includes('task title')) {
        lines.shift();
      }
    }

    // Filter out any remaining lines that are completely blank (no content in columns)
    lines = lines.filter(line => {
      const cols = line.split('\t');
      return cols.some(c => c.trim());
    });

    const parsed = lines.map((line, idx) => {
      const cols = line.split('\t');
      const assigneeName = cols[0]?.trim() || '';
      const title = cols[1]?.trim() || '';
      const description = cols[2]?.trim() || '';
      const priorityRaw = cols[3]?.trim()?.toLowerCase() || 'medium';
      const category = cols[4]?.trim() || 'General';

      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      const priority = validPriorities.includes(priorityRaw) ? priorityRaw : 'medium';

      const matched = employees.find(emp => emp.name.toLowerCase() === assigneeName.toLowerCase());

      return {
        id: idx,
        assigneeName,
        assignee_id: matched ? matched.id : null,
        title,
        description,
        priority,
        category
      };
    });

    setTasks(parsed);
  };

  const handleUpdateRow = (id, field, value) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, [field]: value };
        if (field === 'assignee_id') {
          const matched = employees.find(emp => emp.id === Number(value));
          updated.assigneeName = matched ? matched.name : '';
        }
        return updated;
      }
      return t;
    }));
  };

  const handleDeleteRow = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tasks.length === 0) return;

    const hasInvalid = tasks.some(t => !t.title.trim() || !t.assignee_id);
    if (hasInvalid) {
      setError('Please resolve all validation errors (ensure every task has a Title and a selected Assignee) before importing.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.importBulkTasks(tasks);
      onImportSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to import tasks.');
    } finally {
      setLoading(false);
    }
  };

  const allValid = tasks.length > 0 && tasks.every(t => t.title.trim() && t.assignee_id);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Import Tasks from Excel</h3>
            <p className="text-xs text-gray-500">Copy columns from your sheet (Assignee, Title, Description, Priority, Category) and paste them below</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-xs text-red-800 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">1. Paste spreadsheet rows</label>
            <textarea
              value={pastedText}
              onChange={handlePasteChange}
              className="w-full border border-gray-200 rounded-xl p-4 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 min-h-[120px] resize-y placeholder:text-gray-400 font-mono"
              placeholder="Employee Name&#9;Task Title&#9;Task Description&#9;Priority&#9;Category"
            />
            <div className="text-[10px] text-gray-400 leading-normal">
              Copy rows from Excel. Ensure columns are ordered: <strong>Assignee Name</strong>, <strong>Title</strong>, <strong>Description</strong>, <strong>Priority (low/medium/high/urgent)</strong>, <strong>Category</strong>. Columns must be separated by tab spaces.
            </div>
          </div>

          {tasks.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">2. Verify and Map Tasks ({tasks.length} found)</label>
                {allValid ? (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready to Import
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Match missing assignees or fill empty fields
                  </span>
                )}
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider sticky top-0 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Assignee (Employee/Manager)</th>
                      <th className="px-4 py-2 font-semibold">Task Title</th>
                      <th className="px-4 py-2 font-semibold">Description</th>
                      <th className="px-4 py-2 font-semibold">Priority</th>
                      <th className="px-4 py-2 font-semibold">Category</th>
                      <th className="px-4 py-2 text-center font-semibold w-10">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {tasks.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2">
                          <div className="space-y-1">
                            <select
                              value={t.assignee_id || ''}
                              onChange={(e) => handleUpdateRow(t.id, 'assignee_id', e.target.value)}
                              className={`w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${!t.assignee_id ? 'border-red-300 bg-red-50/40 text-red-800' : 'border-gray-200'}`}
                            >
                              <option value="">Select Assignee...</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                              ))}
                            </select>
                            {!t.assignee_id && (
                              <span className="text-[9px] text-red-500 font-medium block">
                                Name "{t.assigneeName || 'Empty'}" not matched
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={t.title}
                            onChange={(e) => handleUpdateRow(t.id, 'title', e.target.value)}
                            className={`w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${!t.title.trim() ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}`}
                          />
                        </td>

                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={t.description}
                            onChange={(e) => handleUpdateRow(t.id, 'description', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </td>

                        <td className="px-4 py-2">
                          <select
                            value={t.priority}
                            onChange={(e) => handleUpdateRow(t.id, 'priority', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 capitalize"
                          >
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                            <option value="urgent">urgent</option>
                          </select>
                        </td>

                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={t.category}
                            onChange={(e) => handleUpdateRow(t.id, 'category', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1"
                          />
                        </td>

                        <td className="px-4 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(t.id)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !allValid}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading && <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {loading ? 'Importing...' : `Import ${tasks.length} Tasks`}
          </button>
        </div>
      </div>
    </div>
  );
}
