import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Target, Check, AlertCircle } from 'lucide-react';

export default function SalesGoalModal({ isOpen, onClose, onSave, editingGoal }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    target_value: '',
    target_leads: '',
    period_type: 'monthly',
    period_start: '',
    period_end: '',
    status: 'active'
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editingGoal) {
      setForm({
        name: editingGoal.name || '',
        description: editingGoal.description || '',
        target_value: editingGoal.target_value || '',
        target_leads: editingGoal.target_leads || '',
        period_type: editingGoal.period_type || 'monthly',
        period_start: editingGoal.period_start || '',
        period_end: editingGoal.period_end || '',
        status: editingGoal.status || 'active'
      });
    } else {
      setForm({
        name: '',
        description: '',
        target_value: '',
        target_leads: '',
        period_type: 'monthly',
        period_start: '',
        period_end: '',
        status: 'active'
      });
    }
    setError('');
  }, [editingGoal, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.name.trim()) {
      setError('Goal name is required');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        target_value: parseFloat(form.target_value) || 0,
        target_leads: parseInt(form.target_leads, 10) || 0
      };
      if (editingGoal) {
        await api.updateSalesGoal(editingGoal.id, payload);
      } else {
        await api.createSalesGoal(payload);
      }
      if (onSave) onSave();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-w-lg w-full bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-emerald-50/50">
          <div className="flex items-center gap-2 text-emerald-800">
            <Target className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold">{editingGoal ? 'Edit Lakshya (Goal)' : 'Create New Lakshya (Goal)'}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200/50 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="m-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Goal Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={handleChange('name')}
              placeholder="e.g. Q3 2026 — ₹5Cr Revenue Target"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={handleChange('description')}
              placeholder="Brief summary of the target, regions, or focus area..."
              className="input-field min-h-[70px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Target Revenue (₹)</label>
              <input
                type="number"
                value={form.target_value}
                onChange={handleChange('target_value')}
                placeholder="e.g. 5000000"
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Target Lead Conversions</label>
              <input
                type="number"
                value={form.target_leads}
                onChange={handleChange('target_leads')}
                placeholder="e.g. 10"
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Period Type</label>
              <select value={form.period_type} onChange={handleChange('period_type')} className="input-field">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Start Date</label>
              <input
                type="date"
                value={form.period_start}
                onChange={handleChange('period_start')}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">End Date</label>
              <input
                type="date"
                value={form.period_end}
                onChange={handleChange('period_end')}
                className="input-field"
              />
            </div>
          </div>

          {editingGoal && (
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Goal Status</label>
              <select value={form.status} onChange={handleChange('status')} className="input-field">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-primary text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="btn-amber text-sm flex items-center gap-2 disabled:opacity-50">
              {busy ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {busy ? 'Saving...' : (editingGoal ? 'Save Goal' : 'Create Goal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
