import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  X, Briefcase, ChevronRight, Check, AlertCircle, ShieldAlert,
  Users, Plus, Star, Trash2, Edit3, MessageSquare,
  Clock, Calendar, Activity, TrendingUp, TrendingDown, Phone, Mail, Building, Tag, MapPin, User
} from 'lucide-react';

const STAGE_ORDER = [
  'suspect', 'prospect', 'enquiry', 'presentation', 'demo',
  'spec_tender', 'design_negotiation', 'dfp', 'order', 'billing'
];

const STAGE_LABELS = {
  suspect: 'Suspect',
  prospect: 'Prospect',
  enquiry: 'Enquiry',
  presentation: 'Presentation',
  demo: 'Demo',
  spec_tender: 'Spec of Tender',
  design_negotiation: 'Design Negotiation',
  dfp: 'DFP',
  order: 'Order',
  billing: 'Billing'
};

const CONTACT_ROLES = [
  { value: 'technical_head', label: '🔧 Technical Head' },
  { value: 'management', label: '👔 Management' },
  { value: 'procurement', label: '📋 Procurement' },
  { value: 'architect', label: '📐 Architect' },
  { value: 'consultant', label: '🏢 Consultant' },
  { value: 'project_manager', label: '📊 Project Manager' },
  { value: 'finance', label: '💰 Finance' },
  { value: 'other', label: '📌 Other' }
];

const ACTIVITY_TYPES = [
  { value: 'call', label: '📞 Call' },
  { value: 'meeting', label: '🤝 Meeting' },
  { value: 'email', label: '📧 Email' },
  { value: 'site_visit', label: '🏗️ Site Visit' },
  { value: 'presentation', label: '📊 Presentation' },
  { value: 'negotiation', label: '💬 Negotiation' },
  { value: 'follow_up', label: '🔄 Follow Up' },
  { value: 'document_shared', label: '📄 Document Shared' },
  { value: 'positive_event', label: '✅ Positive Event' },
  { value: 'negative_event', label: '⚠️ Negative Event' }
];

const NEGATIVE_REASONS = [
  { value: 'client_delay', label: '⏳ Client Requested Delay' },
  { value: 'competitor_entered', label: '⚔️ Competitor Entered' },
  { value: 'budget_cut', label: '💰 Budget Cut' },
  { value: 'contact_changed', label: '👤 Contact Person Changed' }
];

export default function SalesLeadDetailModal({ leadId, isOpen, onClose, user, onUpdated }) {
  const [lead, setLead] = useState(null);
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline' | 'contacts' | 'daily-logs' | 'timeline'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Stage move state
  const [targetStage, setTargetStage] = useState('');
  const [stageNotes, setStageNotes] = useState('');
  const [movingStage, setMovingStage] = useState(false);

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({
    contact_name: '', contact_role: '', contact_email: '', contact_phone: '', company_name: '', is_leverage: false, notes: ''
  });

  // Daily log state
  const [dailyLogs, setDailyLogs] = useState([]);
  const [logContent, setLogContent] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [commentText, setCommentText] = useState({});

  // Activity form state
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_type: 'call', negative_reason: '', title: '', description: '', probability_change: 0, activity_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLeadDetails();
    }
    const handleSalesUpdate = () => {
      if (isOpen && leadId) fetchLeadDetails();
    };
    window.addEventListener('sales-updated', handleSalesUpdate);
    return () => window.removeEventListener('sales-updated', handleSalesUpdate);
  }, [isOpen, leadId]);

  const fetchLeadDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getSalesLead(leadId);
      setLead(data);
      setTargetStage(data.current_stage);
      fetchDailyLogs();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyLogs = async () => {
    try {
      const logs = await api.getSalesDailyLogs(leadId);
      setDailyLogs(logs);
    } catch (err) {
      console.error('Failed to fetch daily logs:', err);
    }
  };

  if (!isOpen) return null;

  // ── Stage Transition Handler ──
  const handleStageMove = async () => {
    if (!targetStage) return;
    if (targetStage === lead.current_stage && !stageNotes.trim()) return;
    setMovingStage(true);
    setError('');
    try {
      await api.updateSalesLeadStage(lead.id, targetStage, stageNotes);
      setStageNotes('');
      fetchLeadDetails();
      window.dispatchEvent(new CustomEvent('sales-updated'));
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setMovingStage(false);
    }
  };

  // ── Contact Handlers ──
  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!contactForm.contact_name.trim()) return;
    try {
      if (editingContact) {
        await api.updateSalesLeadContact(lead.id, editingContact.id, contactForm);
      } else {
        await api.createSalesLeadContact(lead.id, contactForm);
      }
      setShowContactForm(false);
      setEditingContact(null);
      setContactForm({ contact_name: '', contact_role: '', contact_email: '', contact_phone: '', company_name: '', is_leverage: false, notes: '' });
      fetchLeadDetails();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteContact = async (cid) => {
    try {
      await api.deleteSalesLeadContact(lead.id, cid);
      fetchLeadDetails();
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Daily Log Handlers ──
  const handleSaveDailyLog = async (e) => {
    e.preventDefault();
    if (!logContent.trim()) return;
    try {
      await api.saveSalesDailyLog(lead.id, logDate, logContent.trim());
      setLogContent('');
      fetchDailyLogs();
      window.dispatchEvent(new CustomEvent('sales-updated'));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddLogComment = async (logId) => {
    const text = commentText[logId];
    if (!text || !text.trim()) return;
    try {
      await api.addSalesDailyLogComment(lead.id, logId, text.trim());
      setCommentText({ ...commentText, [logId]: '' });
      fetchDailyLogs();
      window.dispatchEvent(new CustomEvent('sales-updated'));
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Activity Handler ──
  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (!activityForm.description.trim()) return;
    try {
      await api.createSalesActivity(lead.id, activityForm);
      setShowActivityForm(false);
      setActivityForm({ activity_type: 'call', negative_reason: '', title: '', description: '', probability_change: 0, activity_date: new Date().toISOString().split('T')[0] });
      fetchLeadDetails();
      window.dispatchEvent(new CustomEvent('sales-updated'));
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message);
    }
  };

  let skippedList = [];
  try {
    skippedList = typeof lead?.skipped_stages === 'string'
      ? JSON.parse(lead.skipped_stages || '[]')
      : (lead?.skipped_stages || []);
  } catch (e) {
    skippedList = [];
  }

  const currentIdx = STAGE_ORDER.indexOf(lead?.current_stage || 'suspect');

  const formatCurrency = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(parseFloat(val) / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(parseFloat(val) / 100000).toFixed(2)} Lakh`;
    return `₹${parseFloat(val).toLocaleString('en-IN')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Clean Light Modal Header (Matching TaskDetailModal) */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                {STAGE_LABELS[lead?.current_stage] || lead?.current_stage} ({lead?.probability_pct || 0}%)
              </span>
              {lead?.category === 'lakshya' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-emerald-600" />
                  Lakshya
                </span>
              )}
              {lead?.region && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  {lead.city ? `${lead.city}, ` : ''}{lead.region.replace('_', ' ')}
                </span>
              )}
            </div>

            <h2 className="font-semibold text-lg text-gray-900 truncate">{lead?.title || 'Sales Lead Details'}</h2>

            <div className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
              <span>Assigned Sales Person: <strong className="text-gray-900 font-semibold">{lead?.assignee_name || 'Unassigned'}</strong></span>
              <span>Lead Value: <strong className="text-amber-700 font-bold">{formatCurrency(lead?.lead_value)}</strong></span>
              {lead?.consultant_name && <span>Consultant: <strong className="text-gray-800">{lead.consultant_name}</strong></span>}
            </div>
          </div>

          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition-colors shrink-0 ml-3">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading lead details...
          </div>
        ) : (
          <>
            {/* Clean Tabs Navigation Bar (Matching TaskDetailModal) */}
            <div className="flex border-b border-gray-100 bg-white px-5 gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab('pipeline')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'pipeline' ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <TrendingUp className="w-4 h-4" />
                Pipeline Progress
              </button>
              <button
                onClick={() => setActiveTab('contacts')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'contacts' ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <Users className="w-4 h-4" />
                Client Contacts ({lead.contacts?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('daily-logs')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'daily-logs' ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <MessageSquare className="w-4 h-4" />
                Daily Achievements ({dailyLogs.length})
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'timeline' ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <Activity className="w-4 h-4" />
                Timeline / Activities ({lead.activities?.length || 0})
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">

              {/* ── TAB 1: PIPELINE PROGRESS ── */}
              {activeTab === 'pipeline' && (
                <div className="space-y-6">
                  {/* Clean 10-Stage Funnel Progress Grid */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">10-Stage Funnel Status</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {STAGE_ORDER.map((stageKey, idx) => {
                        const isCurrent = stageKey === lead.current_stage;
                        const isCompleted = idx < currentIdx;
                        const isSkipped = skippedList.includes(stageKey);

                        let bgClass = 'bg-gray-50 text-gray-400 border-gray-200';
                        if (isCurrent) bgClass = 'bg-amber-600 text-white font-bold border-amber-700 shadow-xs';
                        else if (isSkipped) bgClass = 'bg-red-50 text-red-700 border-red-200 font-semibold';
                        else if (isCompleted) bgClass = 'bg-gray-100 text-gray-800 border-gray-200 font-medium';

                        return (
                          <div
                            key={stageKey}
                            onClick={() => setTargetStage(stageKey)}
                            className={`p-2.5 rounded-xl border text-center text-xs transition-all cursor-pointer hover:border-amber-400 ${bgClass} ${targetStage === stageKey && !isCurrent ? 'ring-2 ring-amber-400' : ''}`}
                          >
                            <div className="text-[10px] opacity-75 uppercase font-medium">{idx + 1}. Stage</div>
                            <div className="font-semibold truncate">{STAGE_LABELS[stageKey]}</div>
                            {isSkipped && (
                              <div className="text-[9px] font-bold text-red-600 uppercase mt-0.5 flex items-center justify-center gap-0.5">
                                <ShieldAlert className="w-2.5 h-2.5" /> Skipped
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clean Update Stage Box */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Update Pipeline Stage</h4>
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1 w-full">
                        <label className="text-[11px] text-slate-600 font-medium block mb-1">New Pipeline Stage</label>
                        <select
                          value={targetStage}
                          onChange={(e) => setTargetStage(e.target.value)}
                          className="input-field bg-white"
                        >
                          {STAGE_ORDER.map(s => (
                            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-[2] w-full">
                        <label className="text-[11px] text-slate-600 font-medium block mb-1">Stage Move Notes (Optional)</label>
                        <input
                          type="text"
                          value={stageNotes}
                          onChange={(e) => setStageNotes(e.target.value)}
                          placeholder="e.g. Client agreed to presentation date..."
                          className="input-field bg-white"
                        />
                      </div>
                      <button
                        onClick={handleStageMove}
                        disabled={movingStage || (targetStage === lead.current_stage && !stageNotes.trim())}
                        className="btn-amber text-xs py-2 px-4 whitespace-nowrap disabled:opacity-50"
                      >
                        {movingStage ? 'Updating...' : 'Change Stage'}
                      </button>
                    </div>
                  </div>

                  {/* Audit History of Stage Transitions */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Audit History of Stage Transitions</h3>
                    {lead.history?.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No transition history recorded yet.</p>
                    ) : (
                      <div className="relative border-l-2 border-gray-200 ml-3 space-y-4 pl-4">
                        {lead.history?.map((h, i) => (
                          <div key={h.id || i} className="relative text-xs">
                            <div className="absolute -left-[23px] top-0.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-white" />
                            <div className="font-semibold text-gray-900">
                              {h.from_stage ? `${STAGE_LABELS[h.from_stage]} ➔ ` : ''}{STAGE_LABELS[h.to_stage]}
                              {h.was_skipped && (
                                <span className="ml-2 text-[10px] text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded font-bold">
                                  🔴 Skipped Step
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              By <strong>{h.changed_by_name || 'System'}</strong> on {new Date(h.created_at).toLocaleString()}
                            </div>
                            {h.notes && <p className="text-gray-700 bg-gray-50 p-2 rounded-lg mt-1 italic border border-gray-100">{h.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB 2: CONTACTS ── */}
              {activeTab === 'contacts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Client / Suspect Side Contacts</h3>
                    <button
                      onClick={() => { setShowContactForm(!showContactForm); setEditingContact(null); }}
                      className="btn-amber text-xs px-3 py-1.5 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Contact
                    </button>
                  </div>

                  {/* Add / Edit Contact Form */}
                  {showContactForm && (
                    <form onSubmit={handleSaveContact} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 animate-in fade-in">
                      <h4 className="text-xs font-semibold text-gray-900">{editingContact ? 'Edit Contact' : 'New Contact Person'}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-gray-600 block mb-1">Contact Name *</label>
                          <input
                            type="text"
                            value={contactForm.contact_name}
                            onChange={(e) => setContactForm({ ...contactForm, contact_name: e.target.value })}
                            placeholder="Full Name"
                            className="input-field bg-white text-xs"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-600 block mb-1">Role / Designation</label>
                          <select
                            value={contactForm.contact_role}
                            onChange={(e) => setContactForm({ ...contactForm, contact_role: e.target.value })}
                            className="input-field bg-white text-xs"
                          >
                            <option value="">-- Select Role --</option>
                            {CONTACT_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-600 block mb-1">Company / Firm Name</label>
                          <input
                            type="text"
                            value={contactForm.company_name}
                            onChange={(e) => setContactForm({ ...contactForm, company_name: e.target.value })}
                            placeholder="Company Name"
                            className="input-field bg-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-gray-600 block mb-1">Email</label>
                          <input
                            type="email"
                            value={contactForm.contact_email}
                            onChange={(e) => setContactForm({ ...contactForm, contact_email: e.target.value })}
                            placeholder="contact@client.com"
                            className="input-field bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-600 block mb-1">Phone</label>
                          <input
                            type="text"
                            value={contactForm.contact_phone}
                            onChange={(e) => setContactForm({ ...contactForm, contact_phone: e.target.value })}
                            placeholder="+91-9876543210"
                            className="input-field bg-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-900 font-medium">
                          <input
                            type="checkbox"
                            checked={contactForm.is_leverage}
                            onChange={(e) => setContactForm({ ...contactForm, is_leverage: e.target.checked })}
                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                          />
                          <span>⭐ Leverage Person for Us (Internal Champion)</span>
                        </label>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowContactForm(false)} className="btn-primary text-xs">Cancel</button>
                        <button type="submit" className="btn-amber text-xs">Save Contact</button>
                      </div>
                    </form>
                  )}

                  {/* Contacts List */}
                  {lead.contacts?.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-4 text-center border border-dashed rounded-xl">No contact persons added yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {lead.contacts?.map(c => (
                        <div key={c.id} className="p-3.5 border border-gray-200 rounded-xl bg-white space-y-2 relative group hover:border-amber-400">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
                                {c.contact_name}
                                {c.is_leverage && (
                                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 fill-amber-500" /> Leverage
                                  </span>
                                )}
                              </h4>
                              {c.contact_role && (
                                <span className="text-xs text-amber-800 font-medium">{CONTACT_ROLES.find(r => r.value === c.contact_role)?.label || c.contact_role}</span>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteContact(c.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-xs text-gray-600 space-y-1">
                            {c.company_name && <div className="flex items-center gap-1"><Building className="w-3 h-3 text-gray-400" /> {c.company_name}</div>}
                            {c.contact_email && <div className="flex items-center gap-1"><Mail className="w-3 h-3 text-gray-400" /> {c.contact_email}</div>}
                            {c.contact_phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" /> {c.contact_phone}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: DAILY LOGS (ACHIEVEMENTS) ── */}
              {activeTab === 'daily-logs' && (
                <div className="space-y-6">
                  {/* Daily Log Entry Form */}
                  <form onSubmit={handleSaveDailyLog} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Log Today's Progress / Activity</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] text-gray-600 block mb-1">Date</label>
                        <input
                          type="date"
                          value={logDate}
                          onChange={(e) => setLogDate(e.target.value)}
                          className="input-field bg-white text-xs"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-[11px] text-gray-600 block mb-1">Progress Details</label>
                        <input
                          type="text"
                          value={logContent}
                          onChange={(e) => setLogContent(e.target.value)}
                          placeholder="Describe what happened today on this lead (calls, meetings, responses)..."
                          className="input-field bg-white text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="btn-amber text-xs px-4 py-2">Submit Daily Log</button>
                    </div>
                  </form>

                  {/* Logs Feed */}
                  <div className="space-y-4">
                    {dailyLogs.length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center p-4">No daily logs submitted yet.</p>
                    ) : (
                      dailyLogs.map(log => (
                        <div key={log.id} className="p-4 border border-gray-200 rounded-xl bg-white space-y-3">
                          <div className="flex items-center justify-between text-xs text-gray-500 border-b border-gray-100 pb-2">
                            <span className="font-semibold text-gray-900">{log.user_name}</span>
                            <span>{new Date(log.log_date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          </div>
                          <p className="text-xs text-gray-800">{log.content}</p>

                          {/* Comments section */}
                          <div className="pt-2 border-t border-gray-100 space-y-2">
                            {log.comments?.map(cmt => (
                              <div key={cmt.id} className="text-[11px] bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <span className="font-semibold text-gray-800">{cmt.user_name}: </span>
                                <span className="text-gray-700">{cmt.comment_text}</span>
                              </div>
                            ))}

                            <div className="flex gap-2 pt-1">
                              <input
                                type="text"
                                value={commentText[log.id] || ''}
                                onChange={(e) => setCommentText({ ...commentText, [log.id]: e.target.value })}
                                placeholder="Add a comment..."
                                className="input-field text-xs bg-gray-50"
                              />
                              <button onClick={() => handleAddLogComment(log.id)} className="btn-primary text-xs py-1 px-3">Reply</button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB 4: TIMELINE / ACTIVITIES ── */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Activities & Event Timeline</h3>
                    <button
                      onClick={() => setShowActivityForm(!showActivityForm)}
                      className="btn-amber text-xs px-3 py-1.5 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Log Activity / Event
                    </button>
                  </div>

                  {/* Log Activity Form */}
                  {showActivityForm && (
                    <form onSubmit={handleSaveActivity} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 animate-in fade-in">
                      <h4 className="text-xs font-semibold text-gray-900">Log Activity or Probability Event</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-gray-600 block mb-1">Activity Type *</label>
                          <select
                            value={activityForm.activity_type}
                            onChange={(e) => setActivityForm({ ...activityForm, activity_type: e.target.value })}
                            className="input-field bg-white text-xs"
                          >
                            {ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                          </select>
                        </div>

                        {activityForm.activity_type === 'negative_event' && (
                          <div>
                            <label className="text-[11px] text-red-600 font-semibold block mb-1">Negative Reason *</label>
                            <select
                              value={activityForm.negative_reason}
                              onChange={(e) => setActivityForm({ ...activityForm, negative_reason: e.target.value })}
                              className="input-field bg-white text-xs text-red-700 font-medium"
                            >
                              <option value="">-- Select Reason --</option>
                              {NEGATIVE_REASONS.map(nr => <option key={nr.value} value={nr.value}>{nr.label}</option>)}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="text-[11px] text-gray-600 block mb-1">Probability Change (% Impact)</label>
                          <input
                            type="number"
                            value={activityForm.probability_change}
                            onChange={(e) => setActivityForm({ ...activityForm, probability_change: parseInt(e.target.value, 10) || 0 })}
                            placeholder="e.g. +10 or -15"
                            className="input-field bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-600 block mb-1">Activity Date</label>
                          <input
                            type="date"
                            value={activityForm.activity_date}
                            onChange={(e) => setActivityForm({ ...activityForm, activity_date: e.target.value })}
                            className="input-field bg-white text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-gray-600 block mb-1">Description *</label>
                        <textarea
                          value={activityForm.description}
                          onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                          placeholder="Provide details about the call, meeting, or event..."
                          className="input-field bg-white text-xs min-h-[60px]"
                          required
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowActivityForm(false)} className="btn-primary text-xs">Cancel</button>
                        <button type="submit" className="btn-amber text-xs">Log Activity</button>
                      </div>
                    </form>
                  )}

                  {/* Activity Timeline List */}
                  {lead.activities?.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-4 text-center border border-dashed rounded-xl">No activities logged yet.</p>
                  ) : (
                    <div className="relative border-l-2 border-gray-200 ml-3 space-y-4 pl-4">
                      {lead.activities?.map(act => (
                        <div key={act.id} className="relative text-xs space-y-1">
                          <div className={`absolute -left-[23px] top-0.5 w-3 h-3 rounded-full border-2 border-white ${act.activity_type === 'negative_event' ? 'bg-red-500' : 'bg-amber-500'}`} />
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {ACTIVITY_TYPES.find(a => a.value === act.activity_type)?.label || act.activity_type}
                            </span>
                            {act.negative_reason && (
                              <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                                {NEGATIVE_REASONS.find(nr => nr.value === act.negative_reason)?.label || act.negative_reason}
                              </span>
                            )}
                            {act.probability_change !== 0 && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${act.probability_change > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {act.probability_change > 0 ? `+${act.probability_change}%` : `${act.probability_change}%`}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-700">{act.description}</p>
                          <div className="text-[10px] text-gray-400">
                            Logged by {act.logged_by_name || 'System'} on {act.activity_date || new Date(act.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
