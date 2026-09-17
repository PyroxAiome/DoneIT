import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Target, Check, AlertCircle, Building2, User } from 'lucide-react';

export default function SalesGoalModal({ isOpen, onClose, onSave, editingGoal, lakshyaType = 'order', employees = [] }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    target_value: '',
    target_leads: '',
    period_type: 'monthly',
    period_start: '',
    period_end: '',
    status: 'active',
    lakshya_type: lakshyaType,
    goal_scope: 'company',
    assigned_user_id: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [employeeList, setEmployeeList] = useState(employees);

  useEffect(() => {
    if (isOpen) {
      if (employees && employees.length > 0) {
        setEmployeeList(employees);
      } else {
        api.getEmployees().then(setEmployeeList).catch(() => {});
      }
    }
  }, [isOpen, employees]);

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
        status: editingGoal.status || 'active',
        lakshya_type: editingGoal.lakshya_type || lakshyaType || 'order',
        goal_scope: editingGoal.goal_scope || (editingGoal.assigned_user_id ? 'individual' : 'company'),
        assigned_user_id: editingGoal.assigned_user_id ? String(editingGoal.assigned_user_id) : ''
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
        status: 'active',
        lakshya_type: lakshyaType || 'order',
        goal_scope: 'company',
        assigned_user_id: ''
      });
    }
    setError('');
  }, [editingGoal, isOpen, lakshyaType]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const getGoalTitle = () => {
    const scopeLabel = form.goal_scope === 'individual' ? 'Individual' : 'Company';
    const typeLabel = lakshyaType === 'general' ? '' : (lakshyaType === 'billing' ? 'Billing ' : (lakshyaType === 'collection' ? 'Collection ' : 'Order '));
    if (editingGoal) return `Edit ${scopeLabel} ${typeLabel}Goal`;
    return `Create ${scopeLabel} ${typeLabel}Goal`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.name.trim()) {
      setError('Goal name is required');
      return;
    }
    if (form.goal_scope === 'individual' && !form.assigned_user_id) {
      setError('Please select a salesperson for individual value goal');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        target_value: parseFloat(form.target_value) || 0,
        target_leads: parseInt(form.target_leads, 10) || 0,
        assigned_user_id: form.goal_scope === 'individual' && form.assigned_user_id ? parseInt(form.assigned_user_id, 10) : null
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs" onClick={onClose}>
      <div className="card max-w-lg w-full bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-amber-50/60">
          <div className="flex items-center gap-2 text-amber-900">
            <Target className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-sm sm:text-base">{getGoalTitle()}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200/50 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="m-4 flex items-center gap-2 text-red-600 text-xs sm:text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs sm:text-sm">
          
          {/* Goal Scope Toggle (Company Goal vs Individual Salesperson Goal) */}
          <div>
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Goal Scope Target *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, goal_scope: 'company', assigned_user_id: '' })}
                className={`py-2 px-3 rounded-xl border font-semibold flex items-center justify-center gap-2 transition-all text-xs ${
                  form.goal_scope === 'company'
                    ? 'bg-amber-100 text-amber-900 border-amber-400 shadow-xs'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Company Goal
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, goal_scope: 'individual' })}
                className={`py-2 px-3 rounded-xl border font-semibold flex items-center justify-center gap-2 transition-all text-xs ${
                  form.goal_scope === 'individual'
                    ? 'bg-purple-100 text-purple-900 border-purple-400 shadow-xs'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <User className="w-4 h-4" />
                Individual Sales Person Goal
              </button>
            </div>
          </div>

          {/* Salesperson Dropdown if Individual Goal */}
          {form.goal_scope === 'individual' && (
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1 animate-in fade-in duration-150">
              <label className="text-[11px] font-bold text-purple-950 uppercase tracking-wider block mb-1">
                Assign to Salesperson *
              </label>
              <select
                value={form.assigned_user_id}
                onChange={handleChange('assigned_user_id')}
                className="input-field bg-white"
                required
              >
                <option value="">-- Select Sales Executive / Manager --</option>
                {employeeList.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role || 'Sales'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1">Goal Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={handleChange('name')}
              placeholder={form.goal_scope === 'individual' ? "e.g. Satyam Q3 Target — ₹50 Lakhs" : "e.g. Company Q3 2026 — ₹5 Cr Target"}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={handleChange('description')}
              placeholder="Brief summary of the target, regions, or focus area..."
              className="input-field min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1">Target Revenue (₹)</label>
              <input
                type="number"
                value={form.target_value}
                onChange={handleChange('target_value')}
                placeholder="e.g. 5000000"
                className="input-field"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1">Target Lead Conversions</label>
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
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1">Period Type</label>
              <select value={form.period_type} onChange={handleChange('period_type')} className="input-field">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1">Start Date</label>
              <input
                type="date"
                value={form.period_start}
                onChange={handleChange('period_start')}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1">End Date</label>
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
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1">Goal Status</label>
              <select value={form.status} onChange={handleChange('status')} className="input-field">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-primary text-xs font-semibold px-4 py-2 rounded-xl">Cancel</button>
            <button type="submit" disabled={busy} className="btn-amber bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-xs disabled:opacity-50">
              {busy ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {busy ? 'Saving...' : (editingGoal ? 'Save Goal' : getGoalTitle())}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
