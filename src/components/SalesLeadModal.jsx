import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Briefcase, Check, AlertCircle, Info, Tag, MapPin, Building2 } from 'lucide-react';

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
  { value: 'home_automation', label: '🏠 Home Automation' },
  { value: 'fire_ready', label: '🔥 Fire-ready' },
  { value: 'firesafety', label: '🧯 Firesafety' },
  { value: 'other', label: '📌 Other' }
];

const PRIORITIES = [
  { value: 'active', label: '🟢 Active' },
  { value: 'highly_active', label: '⚡ Highly Active' },
  { value: 'regular', label: '🔷 Regular' },
  { value: 'dormant', label: '🌙 Dormant' },
  { value: 'lost', label: '❌ Lost' }
];

const REGIONS = [
  { value: 'north_india', label: '🗺️ North India' },
  { value: 'south_india', label: '🗺️ South India' },
  { value: 'west_india', label: '🗺️ West India' },
  { value: 'east_india', label: '🗺️ East India' },
  { value: 'central_india', label: '🗺️ Central India' },
  { value: 'international', label: '🌍 International' }
];

export default function SalesLeadModal({ 
  isOpen, onClose, onSave, editingLead, employees = [], goals = [], user,
  initialCategory, initialGoalId, initialSource, initialRegion, initialPriority
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'general',
    goal_id: '',
    lead_value: '',
    lead_source: '',
    lead_source_other: '',
    industry: '',
    industry_other: '',
    product_category: '',
    product_category_other: '',
    priority: 'active',
    region: '',
    country: 'India',
    city: '',
    site_address: '',
    client_name: '',
    client_company: '',
    client_email: '',
    client_phone: '',
    client_designation: '',
    consultant_name: '',
    consultant_firm: '',
    consultant_email: '',
    consultant_phone: '',
    assignee_id: '',
    start_date: new Date().toISOString().split('T')[0],
    expected_close_date: ''
  });

  const [additionalCustomers, setAdditionalCustomers] = useState([]);
  const [additionalConsultants, setAdditionalConsultants] = useState([]);
  const [bNomenclature, setBNomenclature] = useState('');
  const [bSpecs, setBSpecs] = useState({ towers_count: 0, basements_count: 0, has_ground: false, tower_details: [], amenities: '' });
  const [showNomenGuide, setShowNomenGuide] = useState(true);
  const [quota, setQuota] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const parseJsonObj = (val) => {
    if (!val) return {};
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (e) { return {}; }
  };

  const parseJsonArr = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch (e) { return []; }
  };

  const generateNomenclatureString = (specs) => {
    if (!specs) return '';
    const parts = [];
    const sType = specs.structure_type || 'T';
    
    // Structure count (Towers/Blocks/Wings)
    if (specs.towers_count > 0) {
      parts.push(`${specs.towers_count}${sType}`);
    }
    
    // Basements & Ground
    const bgParts = [];
    if (specs.basements_count > 0) {
      bgParts.push(`${specs.basements_count}B`);
    }
    if (specs.has_ground) {
      bgParts.push('G');
    }
    
    let prefix = parts.join(', ');
    if (bgParts.length > 0) {
      prefix = prefix ? `${prefix}, ${bgParts.join(' + ')}` : bgParts.join(' + ');
    }
    
    // Per tower/block breakdown OR general floors/units
    const towerParts = [];
    if (specs.towers_count > 0 && Array.isArray(specs.tower_details) && specs.tower_details.length > 0) {
      specs.tower_details.forEach((t, idx) => {
        if (idx < specs.towers_count) {
          const floorsStr = t.floors ? `${t.floors}F` : '';
          const unitsStr = t.units ? `(C${t.units})` : '';
          if (floorsStr || unitsStr) {
            towerParts.push(`${floorsStr}${unitsStr}`);
          }
        }
      });
    } else if (!specs.towers_count && (specs.general_floors || specs.general_units)) {
      const floorsStr = specs.general_floors ? `${specs.general_floors}F` : '';
      const unitsStr = specs.general_units ? `(C${specs.general_units})` : '';
      if (floorsStr || unitsStr) {
        towerParts.push(`${floorsStr}${unitsStr}`);
      }
    }
    
    let fullStr = prefix;
    if (towerParts.length > 0) {
      fullStr = fullStr ? `${fullStr} + ${towerParts.join(', ')}` : towerParts.join(', ');
    }
    
    // Amenities
    if (specs.amenities && specs.amenities.trim()) {
      fullStr = fullStr ? `${fullStr} + ${specs.amenities.trim()}` : specs.amenities.trim();
    }

    // Extra notes summary badge
    if (specs.building_notes && specs.building_notes.trim()) {
      fullStr = fullStr ? `${fullStr} + ${specs.building_notes.trim()}` : specs.building_notes.trim();
    }
    
    return fullStr;
  };

  const handleBSpecsChange = (field, val) => {
    setBSpecs(prev => {
      const next = { ...prev, [field]: val };
      if (field === 'towers_count') {
        const count = parseInt(val, 10) || 0;
        const currentDetails = [...(prev.tower_details || [])];
        while (currentDetails.length < count) {
          currentDetails.push({ floors: '', units: '' });
        }
        next.tower_details = currentDetails.slice(0, count);
      }
      const autoStr = generateNomenclatureString(next);
      setBNomenclature(autoStr);
      return next;
    });
  };

  const handleTowerDetailChange = (idx, key, val) => {
    setBSpecs(prev => {
      const details = [...(prev.tower_details || [])];
      details[idx] = { ...details[idx], [key]: val };
      const next = { ...prev, tower_details: details };
      const autoStr = generateNomenclatureString(next);
      setBNomenclature(autoStr);
      return next;
    });
  };

  useEffect(() => {
    if (editingLead) {
      setForm({
        title: editingLead.title || '',
        description: editingLead.description || '',
        category: editingLead.category || 'general',
        goal_id: editingLead.goal_id || '',
        lead_value: editingLead.lead_value || '',
        lead_source: editingLead.lead_source || '',
        lead_source_other: editingLead.lead_source_other || '',
        industry: editingLead.industry || '',
        industry_other: editingLead.industry_other || '',
        product_category: editingLead.product_category || '',
        product_category_other: editingLead.product_category_other || '',
        priority: editingLead.priority || 'active',
        region: editingLead.region || '',
        country: editingLead.country || 'India',
        city: editingLead.city || '',
        site_address: editingLead.site_address || '',
        client_name: editingLead.client_name || '',
        client_company: editingLead.client_company || '',
        client_email: editingLead.client_email || '',
        client_phone: editingLead.client_phone || '',
        client_designation: editingLead.client_designation || '',
        client_is_leverage: Boolean(editingLead.client_is_leverage),
        consultant_name: editingLead.consultant_name || '',
        consultant_firm: editingLead.consultant_firm || '',
        consultant_email: editingLead.consultant_email || '',
        consultant_phone: editingLead.consultant_phone || '',
        consultant_is_leverage: Boolean(editingLead.consultant_is_leverage),
        strategy: editingLead.strategy || '',
        assignee_id: editingLead.assignee_id || '',
        start_date: editingLead.start_date || new Date().toISOString().split('T')[0],
        expected_close_date: editingLead.expected_close_date || ''
      });
      setAdditionalCustomers(parseJsonArr(editingLead.additional_customers));
      setAdditionalConsultants(parseJsonArr(editingLead.additional_consultants));
      setBNomenclature(editingLead.building_nomenclature || '');
      setBSpecs(parseJsonObj(editingLead.building_specs));
    } else {
      const selectedCat = initialCategory || (initialGoalId ? 'lakshya' : 'general');
      const selectedGoal = initialGoalId || (goals.length > 0 ? goals[0].id : '');

      setForm({
        title: '',
        description: '',
        category: selectedCat,
        goal_id: selectedCat === 'lakshya' ? selectedGoal : '',
        lead_value: '',
        lead_source: initialSource || '',
        lead_source_other: '',
        industry: '',
        industry_other: '',
        product_category: '',
        product_category_other: '',
        priority: initialPriority || 'active',
        region: initialRegion || '',
        country: 'India',
        city: '',
        site_address: '',
        client_name: '',
        client_company: '',
        client_email: '',
        client_phone: '',
        client_designation: '',
        client_is_leverage: false,
        consultant_name: '',
        consultant_firm: '',
        consultant_email: '',
        consultant_phone: '',
        consultant_is_leverage: false,
        strategy: '',
        assignee_id: user?.id || '',
        start_date: new Date().toISOString().split('T')[0],
        expected_close_date: ''
      });
      setAdditionalCustomers([]);
      setAdditionalConsultants([]);
      setBNomenclature('');
      setBSpecs({ towers_count: 0, basements_count: 0, has_ground: false, tower_details: [], amenities: '' });
    }
    setError('');

    if (isOpen && !editingLead && user?.role === 'sales_executive') {
      api.getSalesQuota()
        .then(res => setQuota(res))
        .catch(err => console.error('Quota fetch error:', err));
    }
  }, [editingLead, isOpen, user, initialCategory, initialGoalId, initialSource, initialRegion, initialPriority, goals]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    let newGoal = form.goal_id;
    if (newCat === 'lakshya' && !newGoal && goals.length > 0) {
      newGoal = initialGoalId || goals[0].id;
    }
    setForm({ ...form, category: newCat, goal_id: newCat === 'lakshya' ? newGoal : '' });
  };

  const addCustomerField = () => {
    setAdditionalCustomers([...additionalCustomers, { client_name: '', client_company: '', client_designation: '', client_email: '', client_phone: '', is_leverage: false }]);
  };

  const removeCustomerField = (index) => {
    setAdditionalCustomers(additionalCustomers.filter((_, i) => i !== index));
  };

  const handleAdditionalCustomerChange = (index, field, value) => {
    const updated = [...additionalCustomers];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalCustomers(updated);
  };

  const addConsultantField = () => {
    setAdditionalConsultants([...additionalConsultants, { consultant_name: '', consultant_firm: '', consultant_email: '', consultant_phone: '', is_leverage: false }]);
  };

  const removeConsultantField = (index) => {
    setAdditionalConsultants(additionalConsultants.filter((_, i) => i !== index));
  };

  const handleAdditionalConsultantChange = (index, field, value) => {
    const updated = [...additionalConsultants];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalConsultants(updated);
  };

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
        goal_id: form.category.includes('lakshya') && form.goal_id ? parseInt(form.goal_id, 10) : null,
        assignee_id: form.assignee_id ? parseInt(form.assignee_id, 10) : null,
        additional_customers: additionalCustomers,
        additional_consultants: additionalConsultants,
        building_nomenclature: bNomenclature,
        building_specs: bSpecs
      };

      if (editingLead) {
        await api.updateSalesLead(editingLead.id, payload);
      } else {
        await api.createSalesLead(payload);
      }
      window.dispatchEvent(new CustomEvent('sales-updated'));
      if (onSave) onSave();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const salesTeamMembers = employees.filter(e => e.role === 'sales_manager' || e.role === 'sales_executive' || (e.can_access_sales && e.role !== 'admin'));

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
              <select value={form.category} onChange={handleCategoryChange} className="input-field">
                <option value="general">📋 General Lead</option>
                <option value="order_lakshya">🎯 Order Lakshya</option>
                <option value="billing_lakshya">📄 Billing Lakshya</option>
                <option value="collection_lakshya">💰 Collection Lakshya</option>
              </select>
            </div>
          </div>

          {(form.category === 'lakshya' || form.category.includes('lakshya')) && (
            <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1 animate-in fade-in">
              <label className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                Select Lakshya Goal Container *
              </label>
              <select value={form.goal_id} onChange={handleChange('goal_id')} className="input-field bg-white" required={form.category.includes('lakshya')}>
                <option value="">-- Select Target Goal --</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.lakshya_type || 'order'})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Description / Project Scope</label>
            <textarea
              value={form.description}
              onChange={handleChange('description')}
              placeholder="Provide background context, scope, requirements, or key discussions..."
              className="input-field min-h-[75px]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-amber-900 uppercase tracking-wider block mb-1">Strategy For This Project</label>
            <textarea
              value={form.strategy || ''}
              onChange={handleChange('strategy')}
              placeholder="Write the master strategy, key action items, leverage points, or target conversion plan..."
              className="input-field min-h-[75px] bg-amber-50/30"
            />
          </div>

          {/* Building & Structure Nomenclature Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  🏢
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Building Structure & Scale (Nomenclature Builder)</h4>
                  <p className="text-[11px] text-slate-500">Record towers, basements, floors & flats for instant Admin Kanban visibility</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNomenGuide(!showNomenGuide)}
                className="text-[11px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-100/70 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-amber-700" />
                {showNomenGuide ? 'Hide Rule Guide' : 'ℹ️ Nomenclature Rule Guide'}
              </button>
            </div>

            {/* Rule Guide / Legend Box */}
            {showNomenGuide && (
              <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-2 animate-in fade-in">
                <div className="font-bold text-amber-900 border-b border-amber-200/80 pb-1 flex items-center gap-1">
                  <span>📌 Nomenclature Shorthand Rules:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-white/80 p-1.5 rounded border border-amber-200">
                    <strong className="text-amber-800">T = Towers</strong> (e.g. <code>3T</code> = 3 Towers)
                  </div>
                  <div className="bg-white/80 p-1.5 rounded border border-amber-200">
                    <strong className="text-amber-800">B = Basements</strong> (e.g. <code>2B</code> = 2 Basements)
                  </div>
                  <div className="bg-white/80 p-1.5 rounded border border-amber-200">
                    <strong className="text-amber-800">G = Ground Floor</strong> (Ground included)
                  </div>
                  <div className="bg-white/80 p-1.5 rounded border border-amber-200">
                    <strong className="text-amber-800">F = Floors</strong> (e.g. <code>33F</code> = 33 Floors)
                  </div>
                  <div className="bg-white/80 p-1.5 rounded border border-amber-200">
                    <strong className="text-amber-800">(C#) = Units / Flats</strong> (e.g. <code>(C8)</code> = 8 Units per floor)
                  </div>
                  <div className="bg-white/80 p-1.5 rounded border border-amber-200">
                    <strong className="text-amber-800">+ = Amenities</strong> (e.g. <code>+ Clubhouse</code>)
                  </div>
                </div>
                <div className="text-[10px] text-amber-800 italic pt-0.5">
                  Example: <code>3T, 2B + G + 33F(C8), 12F(C3), 10F(C10) + Clubhouse</code>
                </div>
              </div>
            )}

            {/* Structured Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Structure Type</label>
                <select
                  value={bSpecs.structure_type || 'T'}
                  onChange={(e) => handleBSpecsChange('structure_type', e.target.value)}
                  className="input-field bg-white text-xs"
                >
                  <option value="T">Towers (T)</option>
                  <option value="Blk">Blocks (Blk)</option>
                  <option value="W">Wings (W)</option>
                  <option value="Bldg">Buildings (Bldg)</option>
                  <option value="Z">Zones / Sheds (Z)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Number of {bSpecs.structure_type === 'Blk' ? 'Blocks' : bSpecs.structure_type === 'W' ? 'Wings' : bSpecs.structure_type === 'Bldg' ? 'Buildings' : bSpecs.structure_type === 'Z' ? 'Zones' : 'Towers'}</label>
                <input
                  type="number"
                  min="0"
                  value={bSpecs.towers_count || ''}
                  onChange={(e) => handleBSpecsChange('towers_count', parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 1"
                  className="input-field bg-white text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Number of Basements (B)</label>
                <input
                  type="number"
                  min="0"
                  value={bSpecs.basements_count || ''}
                  onChange={(e) => handleBSpecsChange('basements_count', parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 2"
                  className="input-field bg-white text-xs"
                />
              </div>
              <div className="flex items-center pt-3 sm:pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean(bSpecs.has_ground)}
                    onChange={(e) => handleBSpecsChange('has_ground', e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300"
                  />
                  <span>Include Ground (G)</span>
                </label>
              </div>
            </div>

            {/* Per Structure Breakdown Rows (If towers > 0) */}
            {bSpecs.towers_count > 0 ? (
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-semibold text-slate-700 block">Floors & Units Breakdown Per {bSpecs.structure_type === 'Blk' ? 'Block' : bSpecs.structure_type === 'W' ? 'Wing' : bSpecs.structure_type === 'Bldg' ? 'Building' : 'Tower'}</label>
                {Array.from({ length: Math.min(bSpecs.towers_count, 10) }).map((_, idx) => {
                  const towerDetail = bSpecs.tower_details?.[idx] || { floors: '', units: '' };
                  const labelPrefix = bSpecs.structure_type === 'Blk' ? 'Block' : bSpecs.structure_type === 'W' ? 'Wing' : bSpecs.structure_type === 'Bldg' ? 'Building' : 'Tower';
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-xs font-bold text-slate-700 w-24 shrink-0">{labelPrefix} {idx + 1}:</span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0"
                          value={towerDetail.floors || ''}
                          onChange={(e) => handleTowerDetailChange(idx, 'floors', parseInt(e.target.value, 10) || 0)}
                          placeholder="Floors (e.g. 33)"
                          className="input-field py-1 text-xs"
                        />
                        <input
                          type="number"
                          min="0"
                          value={towerDetail.units || ''}
                          onChange={(e) => handleTowerDetailChange(idx, 'units', parseInt(e.target.value, 10) || 0)}
                          placeholder="Flats/Units per floor (e.g. 8)"
                          className="input-field py-1 text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Single Facility / General Building Floors & Units Inputs */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Total Floors (F)</label>
                  <input
                    type="number"
                    min="0"
                    value={bSpecs.general_floors || ''}
                    onChange={(e) => handleBSpecsChange('general_floors', parseInt(e.target.value, 10) || 0)}
                    placeholder="e.g. 5"
                    className="input-field bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Units / Commercial Spaces Per Floor (C#)</label>
                  <input
                    type="number"
                    min="0"
                    value={bSpecs.general_units || ''}
                    onChange={(e) => handleBSpecsChange('general_units', parseInt(e.target.value, 10) || 0)}
                    placeholder="e.g. 20"
                    className="input-field bg-white text-xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Additional Facilities / Amenities (+)</label>
              <input
                type="text"
                value={bSpecs.amenities || ''}
                onChange={(e) => handleBSpecsChange('amenities', e.target.value)}
                placeholder="e.g. Penthouse, Clubhouse, Podium, Datacenter Hall"
                className="input-field bg-white text-xs"
              />
            </div>

            {/* Extra Structure / Project Notes Box */}
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Extra Building / Project Structure Notes</label>
              <textarea
                value={bSpecs.building_notes || ''}
                onChange={(e) => handleBSpecsChange('building_notes', e.target.value)}
                rows={2}
                placeholder="Add any extra project structural details (e.g. Podium parking on L1-3, HVAC plant in B2, Phase 1 delivery...)"
                className="input-field bg-white text-xs"
              />
            </div>

            {/* Live Generated Nomenclature Output */}
            <div className="p-3 bg-amber-100/60 border border-amber-300/80 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-xs text-amber-900 font-semibold">
                <span>Generated Nomenclature Summary String:</span>
                <span className="text-[10px] text-amber-700">Auto-built & editable</span>
              </div>
              <input
                type="text"
                value={bNomenclature}
                onChange={(e) => setBNomenclature(e.target.value)}
                placeholder="e.g. 3T, 2B + G + 33F(C8), 12F(C3), 10F(C10) + Clubhouse"
                className="w-full bg-white border border-amber-300 px-3 py-1.5 rounded-lg font-mono text-xs text-amber-950 font-bold focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Lead Source</label>
              <select value={form.lead_source} onChange={handleChange('lead_source')} className="input-field">
                <option value="">-- Select Lead Source --</option>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {form.lead_source === 'other' && (
                <input
                  type="text"
                  value={form.lead_source_other}
                  onChange={handleChange('lead_source_other')}
                  placeholder="Please specify other lead source..."
                  className="input-field mt-2 bg-white text-xs animate-in fade-in"
                  required
                />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Industry</label>
              <select value={form.industry} onChange={handleChange('industry')} className="input-field">
                <option value="">-- Select Industry --</option>
                {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
              {form.industry === 'other' && (
                <input
                  type="text"
                  value={form.industry_other}
                  onChange={handleChange('industry_other')}
                  placeholder="Please specify other industry..."
                  className="input-field mt-2 bg-white text-xs animate-in fade-in"
                  required
                />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Product Category</label>
              <select value={form.product_category} onChange={handleChange('product_category')} className="input-field">
                <option value="">-- Select Product Category --</option>
                {PRODUCTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {form.product_category === 'other' && (
                <input
                  type="text"
                  value={form.product_category_other}
                  onChange={handleChange('product_category_other')}
                  placeholder="Please specify other product category..."
                  className="input-field mt-2 bg-white text-xs animate-in fade-in"
                  required
                />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Priority</label>
              <select value={form.priority} onChange={handleChange('priority')} className="input-field">
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Estimated Value (₹)</label>
              <input type="number" value={form.lead_value} onChange={handleChange('lead_value')} placeholder="e.g. 2500000" className="input-field" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Assigned Sales Person *</label>
              <select value={form.assignee_id} onChange={handleChange('assignee_id')} disabled={user?.role === 'sales_executive'} className="input-field disabled:bg-gray-100">
                <option value="">-- Select Sales Person --</option>
                {(salesTeamMembers.length > 0 ? salesTeamMembers : employees.filter(e => e.role !== 'admin')).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.role.replace('_', ' ')})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={handleChange('start_date')} className="input-field" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Expected Close Date</label>
              <input type="date" value={form.expected_close_date} onChange={handleChange('expected_close_date')} className="input-field" />
            </div>
          </div>

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

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                Customer / Client Information
              </h4>
              <button
                type="button"
                onClick={addCustomerField}
                className="text-xs text-amber-700 hover:text-amber-800 font-semibold bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200/80 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3 rotate-45" /> + Add More Customer
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Contact Person Name</label>
                <input type="text" value={form.client_name} onChange={handleChange('client_name')} placeholder="e.g. Rajesh Kumar" className="input-field bg-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Company / Firm Name</label>
                <input type="text" value={form.client_company} onChange={handleChange('client_company')} placeholder="e.g. Acme Corp Ltd" className="input-field bg-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Designation</label>
                <input type="text" value={form.client_designation} onChange={handleChange('client_designation')} placeholder="e.g. VP Infrastructure" className="input-field bg-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Client Email</label>
                <input type="email" value={form.client_email} onChange={handleChange('client_email')} placeholder="client@company.com" className="input-field bg-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Client Phone</label>
                <input type="text" value={form.client_phone} onChange={handleChange('client_phone')} placeholder="+91 98765 43210" className="input-field bg-white" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-900 font-semibold bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/80 w-full hover:bg-amber-100/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.client_is_leverage || false}
                    onChange={(e) => setForm({ ...form, client_is_leverage: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <span>⭐ Leverage Person for Us (Internal Champion)</span>
                </label>
              </div>
            </div>

            {/* Additional Customer Contacts */}
            {additionalCustomers.map((cust, idx) => (
              <div key={idx} className="p-3 bg-white border border-gray-200 rounded-lg space-y-2 relative mt-2 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-[11px] font-bold text-amber-800 uppercase">Additional Customer Contact #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomerField(idx)}
                    className="text-[10px] font-semibold text-red-600 hover:text-red-800 bg-red-50 px-2 py-0.5 rounded border border-red-200"
                  >
                    Remove ✕
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Contact Name</label>
                    <input
                      type="text"
                      value={cust.client_name || ''}
                      onChange={(e) => handleAdditionalCustomerChange(idx, 'client_name', e.target.value)}
                      placeholder="Contact Name"
                      className="input-field bg-gray-50 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Designation</label>
                    <input
                      type="text"
                      value={cust.client_designation || ''}
                      onChange={(e) => handleAdditionalCustomerChange(idx, 'client_designation', e.target.value)}
                      placeholder="Designation"
                      className="input-field bg-gray-50 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Phone Number</label>
                    <input
                      type="text"
                      value={cust.client_phone || ''}
                      onChange={(e) => handleAdditionalCustomerChange(idx, 'client_phone', e.target.value)}
                      placeholder="+91 98765 00000"
                      className="input-field bg-gray-50 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Email Address</label>
                    <input
                      type="email"
                      value={cust.client_email || ''}
                      onChange={(e) => handleAdditionalCustomerChange(idx, 'client_email', e.target.value)}
                      placeholder="email@company.com"
                      className="input-field bg-gray-50 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-900 font-semibold bg-amber-50/70 p-2 rounded-lg border border-amber-200/70 hover:bg-amber-100/60 transition-colors">
                      <input
                        type="checkbox"
                        checked={cust.is_leverage || false}
                        onChange={(e) => handleAdditionalCustomerChange(idx, 'is_leverage', e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <span>⭐ Leverage Person for Us (Internal Champion)</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Consultant / Key Person Info</h4>
              <button
                type="button"
                onClick={addConsultantField}
                className="text-xs text-amber-700 hover:text-amber-800 font-semibold bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200/80 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3 rotate-45" /> + Add More Consultant
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Consultant Name</label>
                <input type="text" value={form.consultant_name} onChange={handleChange('consultant_name')} className="input-field bg-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Consultant Firm</label>
                <input type="text" value={form.consultant_firm} onChange={handleChange('consultant_firm')} className="input-field bg-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Consultant Email</label>
                <input type="email" value={form.consultant_email} onChange={handleChange('consultant_email')} className="input-field bg-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">Consultant Phone</label>
                <input type="text" value={form.consultant_phone} onChange={handleChange('consultant_phone')} className="input-field bg-white" />
              </div>
              <div className="sm:col-span-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-900 font-semibold bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/80 hover:bg-amber-100/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.consultant_is_leverage || false}
                    onChange={(e) => setForm({ ...form, consultant_is_leverage: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <span>⭐ Leverage Person for Us (Internal Champion)</span>
                </label>
              </div>
            </div>

            {/* Additional Consultant Contacts */}
            {additionalConsultants.map((cons, idx) => (
              <div key={idx} className="p-3 bg-white border border-gray-200 rounded-lg space-y-2 relative mt-2 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-[11px] font-bold text-amber-800 uppercase">Additional Consultant Contact #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeConsultantField(idx)}
                    className="text-[10px] font-semibold text-red-600 hover:text-red-800 bg-red-50 px-2 py-0.5 rounded border border-red-200"
                  >
                    Remove ✕
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Consultant Name</label>
                    <input
                      type="text"
                      value={cons.consultant_name || ''}
                      onChange={(e) => handleAdditionalConsultantChange(idx, 'consultant_name', e.target.value)}
                      placeholder="Name"
                      className="input-field bg-gray-50 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Firm Name</label>
                    <input
                      type="text"
                      value={cons.consultant_firm || ''}
                      onChange={(e) => handleAdditionalConsultantChange(idx, 'consultant_firm', e.target.value)}
                      placeholder="Firm"
                      className="input-field bg-gray-50 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Phone Number</label>
                    <input
                      type="text"
                      value={cons.consultant_phone || ''}
                      onChange={(e) => handleAdditionalConsultantChange(idx, 'consultant_phone', e.target.value)}
                      placeholder="+91 98765 00000"
                      className="input-field bg-gray-50 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Email Address</label>
                    <input
                      type="email"
                      value={cons.consultant_email || ''}
                      onChange={(e) => handleAdditionalConsultantChange(idx, 'consultant_email', e.target.value)}
                      placeholder="consultant@firm.com"
                      className="input-field bg-gray-50 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-900 font-semibold bg-amber-50/70 p-2 rounded-lg border border-amber-200/70 hover:bg-amber-100/60 transition-colors">
                      <input
                        type="checkbox"
                        checked={cons.is_leverage || false}
                        onChange={(e) => handleAdditionalConsultantChange(idx, 'is_leverage', e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <span>⭐ Leverage Person for Us (Internal Champion)</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
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
