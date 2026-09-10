import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Briefcase, Check, AlertCircle, Info, Calendar, DollarSign, MapPin, Tag } from 'lucide-react';

const SOURCES = [
  { value: 'referral', label: '🤝 Referral' },
  { value: 'cold_call', label: '📞 Cold Call' },
  { value: 'website', label: '🌐 Website Enquiry' },
  { value: 'exhibition', label: '🎪 Exhibition / Trade Show' },
  { value: 'tender_portal', label: '📋 Tender Portal' },
  { value: 'consultant', label: '👔 Consultant Reference' },
  { value: 'existing_client', label: '🔄 Existing Client' },
  { value: 'other', label: '📌 Other' }
];

const INDUSTRIES = [
  { value: 'real_estate', label: '🏗️ Real Estate' },
  { value: 'banking', label: '🏦 Banking & Finance' },
  { value: 'healthcare', label: '🏥 Healthcare' },
  { value: 'education', label: '🎓 Education' },
  { value: 'government', label: '🏛️ Government' },
  { value: 'hospitality', label: '🏨 Hospitality' },
  { value: 'manufacturing', label: '🏭 Manufacturing' },
  { value: 'retail', label: '🛒 Retail' },
  { value: 'it_ites', label: '💻 IT / ITES' },
  { value: 'infrastructure', label: '🛣️ Infrastructure' },
  { value: 'energy', label: '⚡ Energy' },
  { value: 'other', label: '📌 Other' }
];

const PRODUCTS = [
  { value: 'building_automation', label: '🏢 Building Automation' },
  { value: 'hvac', label: '❄️ HVAC' },
  { value: 'electrical', label: '⚡ Electrical' },
  { value: 'plumbing', label: '🚿 Plumbing' },
  { value: 'fire_safety', label: '🔥 Fire Safety' },
  { value: 'integrated_solution', label: '🔗 Integrated Solution' },
  { value: 'other', label: '📌 Other' }
];

const REGIONS = [
  { value: 'north_india', label: '🗺️ North India' },
  { value: 'south_india', label: '🗺️ South India' },
  { value: 'west_india', label: '🗺️ West India' },
  { value: 'east_india', label: '🗺️ East India' },
  { value: 'central_india', label: '🗺️ Central India' },
  { value: 'international', label: '🌍 International' }
];

export default function SalesLeadModal({ isOpen, onClose, onSave, editingLead, employees = [], goals = [], user }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'general',
    goal_id: '',
    lead_value: '',
    lead_source: '',
    industry: '',
    product_category: '',
    priority: 'medium',
    region: '',
    country: 'India',
    city: '',
    site_address: '',
    consultant_name: '',
    consultant_firm: '',
    consultant_email: '',
    consultant_phone: '',
    assignee_id: '',
    expected_close_date: ''
  });

  const [quota, setQuota] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editingLead) {
      setForm({
        title: editingLead.title || '',
        description: editingLead.description || '',
        category: editingLead.category || 'general',
        goal_id: editingLead.goal_id || '',
        lead_value: editingLead.lead_value || '',
        lead_source: editingLead.lead_source || '',
        industry: editingLead.industry || '',
        product_category: editingLead.product_category || '',
        priority: editingLead.priority || 'medium',
        region: editingLead.region || '',
        country: editingLead.country || 'India',
        city: editingLead.city || '',
        site_address: editingLead.site_address || '',
        consultant_name: editingLead.consultant_name || '',
        consultant_firm: editingLead.consultant_firm || '',
        consultant_email: editingLead.consultant_email || '',
        consultant_phone: editingLead.consultant_phone || '',
        assignee_id: editingLead.assignee_id || '',
        expected_close_date: editingLead.expected_close_date || ''
      });
    } else {
      setForm({
        title: '',
        description: '',
        category: 'general',
        goal_id: '',
        lead_value: '',
        lead_source: '',
        industry: '',
        product_category: '',
        priority: 'medium',
        region: '',
        country: 'India',
        city: '',
        site_address: '',
        consultant_name: '',
        consultant_firm: '',
        consultant_email: '',
        consultant_phone: '',
        assignee_id: user?.id || '',
        expected_close_date: ''
      });
    }
    setError('');

    // Fetch quota if creating new lead and user is sales_executive
    if (isOpen && !editingLead && user?.role === 'sales_executive') {
      api.getSalesQuota()
        .then(res => setQuota(res))
        .catch(err => console.error('Quota fetch error:', err));
    }
  }, [editingLead, isOpen, user]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title || !form.title.trim()) {
      setError('Lead title is required');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        lead_value: parseFloat(form.lead_value) || 0,
        goal_id: form.goal_id ? parseInt(form.goal_id, 10) : null,
        assignee_id: form.assignee_id ? parseInt(form.assignee_id, 10) : null
      };

      if (editingLead) {
        await api.updateSalesLead(editingLead.id, payload);
      } else {
        await api.createSalesLead(payload);
      }
      if (onSave) onSave();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const salesTeamMembers = employees.filter(e => e.role === 'sales_manager' || e.role === 'sales_executive' || e.can_access_sales);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-w-3xl w-full bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2 text-gray-900">
            <Briefcase className="w-5 h-5 text-gray-700" />
            <h3 className="font-semibold text-gray-900">{editingLead ? 'Edit Sales Lead' : 'Create New Sales Lead'}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Quota Banner for Sales Executives */}
        {!editingLead && quota?.isRestricted && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-800">
            <div className="flex items-center gap-1.5 font-medium">
              <Info className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Creation Limit: {quota.weekCount}/{quota.weekLimit} this week • {quota.monthCount}/{quota.monthLimit} this month</span>
            </div>
            {!quota.canCreate && (
              <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">Limit Reached</span>
            )}
          </div>
        )}

        {error && (
          <div className="m-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Title & Classification */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Lead Title / Client Name *</label>
              <input
                type="text"
                value={form.title}
                onChange={handleChange('title')}
                placeholder="e.g. HDFC Bank - Mumbai HQ Building Automation"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Category</label>
              <select value={form.category} onChange={handleChange('category')} className="input-field">
                <option value="general">📋 General Lead</option>
                <option value="lakshya">🎯 Lakshya (Goal)</option>
              </select>
            </div>
          </div>

          {/* Lakshya Goal Tagging */}
          {form.category === 'lakshya' && (
            <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1 animate-in fade-in">
              <label className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                Select Lakshya (Goal) Container
              </label>
              <select value={form.goal_id} onChange={handleChange('goal_id')} className="input-field bg-white">
                <option value="">-- Select Target Goal --</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.period_type})</option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Description / Project Scope</label>
            <textarea
              value={form.description}
              onChange={handleChange('description')}
              placeholder="Provide background context, scope, requirements, or key discussions..."
              className="input-field min-h-[75px]"
            />
          </div>

          {/* Classification Dropdowns: Source, Industry, Product, Priority (2x2 Grid for spacious fit) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Lead Source</label>
              <select value={form.lead_source} onChange={handleChange('lead_source')} className="input-field">
                <option value="">-- Select Lead Source --</option>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Industry</label>
              <select value={form.industry} onChange={handleChange('industry')} className="input-field">
                <option value="">-- Select Industry --</option>
                {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Product Category</label>
              <select value={form.product_category} onChange={handleChange('product_category')} className="input-field">
                <option value="">-- Select Product Category --</option>
                {PRODUCTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Priority</label>
              <select value={form.priority} onChange={handleChange('priority')} className="input-field">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">🔴 Critical</option>
              </select>
            </div>
          </div>

          {/* Value, Sales Person Assignment, Expected Close Date (3 Columns in max-w-3xl) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Estimated Value (₹)</label>
              <input
                type="number"
                value={form.lead_value}
                onChange={handleChange('lead_value')}
                placeholder="e.g. 2500000"
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Assigned Sales Person *</label>
              <select
                value={form.assignee_id}
                onChange={handleChange('assignee_id')}
                disabled={user?.role === 'sales_executive'}
                className="input-field disabled:bg-gray-100"
              >
                <option value="">-- Select Sales Person --</option>
                {(salesTeamMembers.length > 0 ? salesTeamMembers : employees).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.role.replace('_', ' ')})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Expected Close Date</label>
              <input
                type="date"
                value={form.expected_close_date}
                onChange={handleChange('expected_close_date')}
                className="input-field"
              />
            </div>
          </div>

          {/* Region & Location Details */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              Location & Region Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Region</label>
                <select value={form.region} onChange={handleChange('region')} className="input-field bg-white">
                  <option value="">-- Select Region --</option>
                  {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">City</label>
                <input type="text" value={form.city} onChange={handleChange('city')} placeholder="e.g. Mumbai" className="input-field bg-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Country</label>
                <input type="text" value={form.country} onChange={handleChange('country')} placeholder="India" className="input-field bg-white" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-600 block mb-1">Site / Building Address</label>
              <input type="text" value={form.site_address} onChange={handleChange('site_address')} placeholder="Full site address" className="input-field bg-white" />
            </div>
          </div>

          {/* External Consultant Info */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Consultant / Key Person Info</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Consultant Name</label>
                <input type="text" value={form.consultant_name} onChange={handleChange('consultant_name')} placeholder="Consultant Name" className="input-field bg-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Consultant Firm</label>
                <input type="text" value={form.consultant_firm} onChange={handleChange('consultant_firm')} placeholder="Consulting Firm" className="input-field bg-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Consultant Email</label>
                <input type="email" value={form.consultant_email} onChange={handleChange('consultant_email')} placeholder="consultant@firm.com" className="input-field bg-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Consultant Phone</label>
                <input type="text" value={form.consultant_phone} onChange={handleChange('consultant_phone')} placeholder="+91-9876543210" className="input-field bg-white" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-primary text-sm">Cancel</button>
            <button
              type="submit"
              disabled={busy || (!editingLead && quota?.isRestricted && !quota?.canCreate)}
              className="btn-amber text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {busy ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {busy ? 'Saving...' : (editingLead ? 'Save Changes' : 'Create Lead')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
