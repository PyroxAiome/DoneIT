import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import SalesPipelineBoard from './SalesPipelineBoard';
import SalesLeadModal from './SalesLeadModal';
import SalesLeadDetailModal from './SalesLeadDetailModal';
import SalesGoalModal from './SalesGoalModal';
import SalesMonthlyReport from './SalesMonthlyReport';
import SalesTargetModal from './SalesTargetModal';
import SalesTargetDashboard from './SalesTargetDashboard';
import {
  TrendingUp, Target, Plus, Search, Filter, Briefcase,
  CheckCircle2, Award, Tag, Calendar, UserCheck, Edit2, Trash2
} from 'lucide-react';

const STAGES = [
  { key: 'suspect', label: 'Suspect' },
  { key: 'prospect', label: 'Prospect' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'demo', label: 'Demo' },
  { key: 'spec_tender', label: 'Spec of Tender' },
  { key: 'enquiry', label: 'Enquiry' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'design_optimisation', label: 'Design Optimisation' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'pending_order_receipts', label: 'Pending Order Receipts' }
];

const SOURCES = [
  { value: 'referral', label: 'Referral' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'website', label: 'Website' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'tender_portal', label: 'Tender Portal' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'existing_client', label: 'Existing Client' },
  { value: 'other', label: 'Other' }
];

const REGIONS = [
  { value: 'north_india', label: 'North India' },
  { value: 'south_india', label: 'South India' },
  { value: 'west_india', label: 'West India' },
  { value: 'east_india', label: 'East India' },
  { value: 'central_india', label: 'Central India' },
  { value: 'international', label: 'International' }
];

export default function SalesDashboard({ user, initialAssigneeId = '', initialLeadId = null, onClearLeadId = null }) {
  // Main view tabs: 'board' | 'report' | 'targets'
  const [activeTab, setActiveTab] = useState('board');

  // Sub-filter: 'general' | 'order_lakshya' | 'billing_lakshya' | 'collection_lakshya'
  const [subCategory, setSubCategory] = useState('general');
  const [selectedGoalId, setSelectedGoalId] = useState(null);

  // Data states
  const [leads, setLeads] = useState([]);
  const [goals, setGoals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState(initialAssigneeId ? String(initialAssigneeId) : '');

  // Modals
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  useEffect(() => {
    if (initialAssigneeId !== undefined && initialAssigneeId !== null) {
      setAssigneeFilter(initialAssigneeId ? String(initialAssigneeId) : '');
    }
  }, [initialAssigneeId]);

  useEffect(() => {
    if ((subCategory === 'billing_lakshya' || subCategory === 'collection_lakshya') && activeTab === 'targets') {
      setActiveTab('board');
    }
  }, [subCategory, activeTab]);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (initialLeadId) {
      setSelectedLeadId(initialLeadId);
      if (onClearLeadId) onClearLeadId();
    }
  }, [initialLeadId]);

  useEffect(() => {
    fetchAllData();

    const handleUpdate = () => fetchAllData();
    const handleOpenLead = (e) => {
      if (e.detail && e.detail.leadId) {
        setSelectedLeadId(e.detail.leadId);
      }
    };
    window.addEventListener('sales-updated', handleUpdate);
    window.addEventListener('open-sales-lead', handleOpenLead);
    return () => {
      window.removeEventListener('sales-updated', handleUpdate);
      window.removeEventListener('open-sales-lead', handleOpenLead);
    };
  }, [subCategory, selectedGoalId, stageFilter, productFilter, sourceFilter, regionFilter, priorityFilter, assigneeFilter]);

  const fetchAllData = async () => {
    // Only show full loading spinner if initial load and no leads exist
    if (isInitialLoad && leads.length === 0) {
      setLoading(true);
    }
    try {
      const lakshyaTypeParam = subCategory.includes('lakshya') ? subCategory.replace('_lakshya', '') : '';
      const [leadsRes, goalsRes, empRes] = await Promise.all([
        api.getSalesLeads({
          category: subCategory,
          goal_id: selectedGoalId,
          stage: stageFilter,
          product_category: productFilter,
          lead_source: sourceFilter,
          region: regionFilter,
          priority: priorityFilter,
          assignee_id: assigneeFilter,
          search: search
        }),
        api.getSalesGoals(lakshyaTypeParam),
        api.getEmployees(true)
      ]);
      setLeads(leadsRes);
      setGoals(goalsRes);
      setEmployees(empRes);
    } catch (err) {
      console.error('Sales fetch error:', err);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAllData();
  };

  const formatCurrency = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(parseFloat(val) / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(parseFloat(val) / 100000).toFixed(2)} Lakh`;
    return `₹${parseFloat(val).toLocaleString('en-IN')}`;
  };

  // Metrics (Separating Lost Leads from Active Pipeline)
  const activeLeadsList = leads.filter(l => (l.priority || '').toLowerCase() !== 'lost');
  const lostLeadsList = leads.filter(l => (l.priority || '').toLowerCase() === 'lost');

  const totalValue = activeLeadsList.reduce((sum, l) => sum + (parseFloat(l.lead_value) || 0), 0);
  const lostValue = lostLeadsList.reduce((sum, l) => sum + (parseFloat(l.lead_value) || 0), 0);
  const wonLeads = activeLeadsList.filter(l => l.current_stage === 'order' || l.current_stage === 'billing');
  const avgProb = activeLeadsList.length > 0 ? Math.round(activeLeadsList.reduce((sum, l) => sum + (l.probability_pct || 0), 0) / activeLeadsList.length) : 0;
  const filteredSalesPerson = assigneeFilter
    ? employees.find(e => String(e.id) === String(assigneeFilter))
    : null;

  const canViewGeneral = (user?.role === 'admin' || user?.can_access_general_leads !== false) && (!filteredSalesPerson || filteredSalesPerson.can_access_general_leads !== false);
  const canViewOrder = (user?.role === 'admin' || user?.can_access_order_lakshya !== false) && (!filteredSalesPerson || filteredSalesPerson.can_access_order_lakshya !== false);
  const canViewBilling = (user?.role === 'admin' || user?.can_access_billing_lakshya !== false) && (!filteredSalesPerson || filteredSalesPerson.can_access_billing_lakshya !== false);
  const canViewCollection = (user?.role === 'admin' || user?.can_access_collection_lakshya !== false) && (!filteredSalesPerson || filteredSalesPerson.can_access_collection_lakshya !== false);

  useEffect(() => {
    if (filteredSalesPerson) {
      if (subCategory === 'billing_lakshya' && !canViewBilling) {
        setSubCategory(canViewGeneral ? 'general' : canViewOrder ? 'order_lakshya' : 'general');
      } else if (subCategory === 'collection_lakshya' && !canViewCollection) {
        setSubCategory(canViewGeneral ? 'general' : canViewOrder ? 'order_lakshya' : 'general');
      } else if (subCategory === 'general' && !canViewGeneral) {
        setSubCategory(canViewOrder ? 'order_lakshya' : 'general');
      } else if ((subCategory === 'order_lakshya' || subCategory === 'lakshya') && !canViewOrder) {
        setSubCategory(canViewGeneral ? 'general' : 'general');
      }
    }
  }, [filteredSalesPerson, subCategory, canViewGeneral, canViewOrder, canViewBilling, canViewCollection]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Sales Pipeline Command Center</h1>
              {user?.role === 'admin' && (
                filteredSalesPerson ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                    👤 Sales View: {filteredSalesPerson.name}
                    <button
                      onClick={() => setAssigneeFilter('')}
                      className="ml-1 text-amber-700 hover:text-red-700 font-bold text-xs"
                      title="Clear employee filter (Return to Admin Master View)"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    Admin Master View
                  </span>
                )
              )}
              {user?.role === 'sales_manager' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Sales Manager View
                </span>
              )}
              {user?.role === 'sales_executive' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                  Sales Executive • My Assigned Funnel
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {user?.role === 'sales_executive'
                ? 'Managing your assigned client leads, stage progress, and personal activity logs'
                : subCategory === 'general'
                ? 'Track raw sales inquiries, general lead assignments, and initial contact progress'
                : subCategory === 'order_lakshya'
                ? 'Pre-order 7-stage target process linked directly to Order Target Goals & Sales Achievements'
                : subCategory === 'billing_lakshya'
                ? 'Post-order invoicing funnel and Billing Lakshya target progress'
                : 'Post-invoicing payment recovery and Collection Lakshya target progress'}
            </p>
          </div>
        </div>

        {/* Sub-filters Toggle */}
        <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 flex-wrap gap-0.5">
          {canViewGeneral && (
            <button
              onClick={() => { setSubCategory('general'); setSelectedGoalId(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${subCategory === 'general' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
            >
              📋 General Inquiries
            </button>
          )}
          {canViewOrder && (
            <button
              onClick={() => { setSubCategory('order_lakshya'); setSelectedGoalId(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${subCategory === 'order_lakshya' || subCategory === 'lakshya' ? 'bg-white text-amber-700 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              🎯 Order Lakshya (Hot Prospects)
            </button>
          )}
          {canViewBilling && (
            <button
              onClick={() => { setSubCategory('billing_lakshya'); setSelectedGoalId(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${subCategory === 'billing_lakshya' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              📄 Billing Lakshya
            </button>
          )}
          {canViewCollection && (
            <button
              onClick={() => { setSubCategory('collection_lakshya'); setSelectedGoalId(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${subCategory === 'collection_lakshya' ? 'bg-white text-emerald-700 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              💰 Collection Lakshya
            </button>
          )}
        </div>
      </div>

      {(subCategory === 'order_lakshya' || subCategory === 'lakshya') && (
        <div className="bg-amber-50 border border-amber-300/80 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔥</span>
            <div>
              <h4 className="font-bold text-sm text-amber-950">Order Lakshya — Hot Prospects Funnel</h4>
              <p className="text-[11px] text-amber-800">Track all high-priority hot prospects, qualified inquiries, and key conversion stages targeting immediate order closure.</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2.5 py-1 rounded-md border border-amber-300 shrink-0">
            🔥 Hot Prospects Active
          </span>
        </div>
      )}

      {/* Target Goal Containers Section (Unified for ALL 4 sub-categories) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4 animate-in fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-gray-900">
            <Target className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-sm">
              {subCategory === 'general' ? 'General Inquiries Containers' :
               subCategory === 'order_lakshya' || subCategory === 'lakshya' ? 'Order Lakshya Goal Containers (Hot Prospects)' :
               subCategory === 'billing_lakshya' ? 'Billing Lakshya Goal Containers' :
               'Collection Lakshya Goal Containers'}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {user?.role === 'admin' && !assigneeFilter && (subCategory === 'general' || subCategory === 'order_lakshya' || subCategory === 'lakshya') && (
              <button
                onClick={() => setShowTargetModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors text-xs font-semibold"
              >
                <Target className="w-3.5 h-3.5 text-amber-600" />
                Define Targets
              </button>
            )}
            {user?.role === 'admin' && !assigneeFilter && (
              <button
                onClick={() => { setEditingGoal(null); setShowGoalModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-xs text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Create {subCategory === 'general' ? 'Company' : (subCategory === 'order_lakshya' || subCategory === 'lakshya' ? 'Company Order' : (subCategory === 'billing_lakshya' ? 'Company Billing' : 'Company Collection'))} Goal
              </button>
            )}
            <button
              onClick={() => { setEditingLead(null); setShowLeadModal(true); }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors shadow-xs text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              New Lead
            </button>
          </div>
        </div>

          {(() => {
            const companyGoals = goals.filter(g => g.goal_scope === 'company' || (!g.goal_scope && !g.assigned_user_id));
            const individualGoals = goals.filter(g => g.goal_scope === 'individual' || g.assigned_user_id);

            const renderGoalCard = (g) => {
              const isSelected = selectedGoalId === g.id;
              const targetVal = parseFloat(g.target_value) || 0;
              
              const goalLeads = leads.filter(l => l.goal_id === g.id);
              const currentVal = assigneeFilter
                ? goalLeads.reduce((sum, l) => sum + (parseFloat(l.lead_value) || 0), 0)
                : (parseFloat(g.current_value) || 0);
              const totalLeadsCount = assigneeFilter ? goalLeads.length : (g.total_leads || 0);
              const wonLeadsCount = assigneeFilter
                ? goalLeads.filter(l => l.current_stage === 'order' || l.current_stage === 'billing').length
                : (g.won_leads || 0);

              const pct = targetVal > 0 ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : 0;

              return (
                <div
                  key={g.id}
                  onClick={() => setSelectedGoalId(isSelected ? null : g.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all min-w-[280px] max-w-[320px] shrink-0 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30 shadow-xs'
                      : 'bg-gray-50/80 border-gray-200 hover:bg-white hover:shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <h4 className="font-semibold text-xs text-gray-900 truncate flex-1" title={g.name}>{g.name}</h4>
                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          g.goal_scope === 'individual' || g.assigned_user_id
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {g.goal_scope === 'individual' || g.assigned_user_id
                            ? `👤 ${g.assigned_user_name || 'Individual'}`
                            : '🏢 Company'}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                          {g.period_type}
                        </span>
                        {user?.role === 'admin' && !assigneeFilter && (
                          <div className="flex items-center gap-0.5 ml-0.5">
                            <button
                              onClick={() => { setEditingGoal(g); setShowGoalModal(true); }}
                              className="p-1 hover:bg-amber-100 rounded text-gray-500 hover:text-amber-700 transition-colors"
                              title="Edit Goal"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm(`Delete Lakshya goal "${g.name}"?`)) {
                                  try {
                                    await api.deleteSalesGoal(g.id);
                                    if (selectedGoalId === g.id) setSelectedGoalId(null);
                                    fetchAllData();
                                  } catch (err) {
                                    alert(err.message || 'Failed to delete goal');
                                  }
                                }
                              }}
                              className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600 transition-colors"
                              title="Delete Goal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Project & Category Specifications Tags */}
                    {(g.project_name || g.product_category || g.region || g.target_order_value_min > 0) && (
                      <div className="flex items-center gap-1.5 flex-wrap my-1.5">
                        {g.project_name && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200" title={`Project/Client: ${g.project_name}`}>
                            📁 {g.project_name}
                          </span>
                        )}
                        {g.product_category && g.product_category !== 'general' && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 capitalize">
                            🏷️ {g.product_category.replace('_', ' ')}
                          </span>
                        )}
                        {g.target_order_value_min > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Min Deal: {formatCurrency(g.target_order_value_min)}
                          </span>
                        )}
                      </div>
                    )}

                    {g.specifications && (
                      <p className="text-[11px] text-gray-600 line-clamp-1 italic bg-amber-50/50 p-1.5 rounded border border-amber-100/60 my-1">
                        📝 {g.specifications}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600 mt-2">
                    <div className="flex items-center justify-between">
                      <span>Revenue Progress:</span>
                      <strong className="text-amber-700 font-bold">{formatCurrency(currentVal)} / {formatCurrency(targetVal)}</strong>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full transition-all" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                      <span>{totalLeadsCount} Leads • {wonLeadsCount} Won</span>
                      <span className="font-bold text-amber-700">{pct}% Achieved</span>
                    </div>
                  </div>
                </div>
              );
            };

            if (goals.length === 0) {
              return (
                <p className="text-xs text-gray-500 italic py-2">
                  No {subCategory.replace('_lakshya', '')} goals created yet.
                </p>
              );
            }

            return (
              <div className="space-y-4">
                {/* Company Goals Section */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    <span>🏢 Company Goals ({companyGoals.length})</span>
                  </div>
                  {companyGoals.length === 0 ? (
                    <p className="text-xs text-gray-400 italic bg-gray-50 p-2.5 rounded-lg border border-dashed border-gray-200">
                      No company-wide goals defined.
                    </p>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                      {companyGoals.map(renderGoalCard)}
                    </div>
                  )}
                </div>

                {/* Individual Goals Section */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    <span>👤 Individual Sales Person Goals ({individualGoals.length})</span>
                  </div>
                  {individualGoals.length === 0 ? (
                    <p className="text-xs text-gray-400 italic bg-gray-50 p-2.5 rounded-lg border border-dashed border-gray-200">
                      No individual sales person goals assigned yet.
                    </p>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                      {individualGoals.map(renderGoalCard)}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {selectedGoalId && (
            <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-lg flex items-center justify-between text-xs text-amber-900 animate-in fade-in">
              <span className="font-medium flex items-center gap-1.5">
                <Target className="w-4 h-4 text-amber-600 shrink-0" />
                Filtered by Goal: <strong>{goals.find(g => g.id === selectedGoalId)?.name || 'Selected Goal'}</strong> — Showing only leads linked to this target.
              </span>
              <button
                onClick={() => setSelectedGoalId(null)}
                className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold rounded-md text-xs transition-colors shrink-0 ml-2"
              >
                Clear Filter (Show All Leads) ✕
              </button>
            </div>
          )}
        </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Active Leads</div>
            <div className="text-lg font-bold text-gray-900">{activeLeadsList.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Pipeline Value</div>
            <div className="text-lg font-bold text-amber-700">{formatCurrency(totalValue)}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-red-200/80 bg-red-50/20 p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shrink-0">
            <TrendingUp className="w-4 h-4 rotate-180" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1">
              Lost Pipeline
              <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-red-200 text-red-800">{lostLeadsList.length}</span>
            </div>
            <div className="text-lg font-bold text-red-700">{formatCurrency(lostValue)}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Won Leads</div>
            <div className="text-lg font-bold text-emerald-800">{wonLeads.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Avg Probability</div>
            <div className="text-lg font-bold text-gray-900">{avgProb}%</div>
          </div>
        </div>
      </div>

      {/* Navigation & Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'board' ? 'bg-amber-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {subCategory === 'billing_lakshya' ? 'Billing Funnel Board' : subCategory === 'collection_lakshya' ? 'Collection Funnel Board' : '7-Stage Pipeline Board'}
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'report' ? 'bg-amber-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Monthly Cycle Report
            </button>
            {(subCategory === 'order_lakshya' || subCategory === 'lakshya' || subCategory === 'general') && (
              <button
                onClick={() => setActiveTab('targets')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'targets' ? 'bg-amber-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                🎯 Target Performance
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {activeTab === 'board' && (
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            <div className="sm:col-span-1">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search leads..."
                  className="input-field text-xs pl-8 bg-gray-50"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3" />
              </form>
            </div>

            <div>
              {user?.role === 'sales_executive' ? (
                <div className="input-field text-xs bg-gray-100 text-gray-700 flex items-center justify-between font-medium cursor-not-allowed select-none">
                  <span>👤 My Assigned Leads</span>
                </div>
              ) : (
                <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="input-field text-xs bg-gray-50">
                  <option value="">All Sales People</option>
                  {(() => {
                    const salesPeople = employees.filter(e => e.role === 'sales_manager' || e.role === 'sales_executive' || (e.can_access_sales && e.role !== 'admin'));
                    const displayList = salesPeople.length > 0 ? salesPeople : employees.filter(e => e.role !== 'admin');
                    return displayList.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ));
                  })()}
                </select>
              )}
            </div>

            <div>
              <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="input-field text-xs bg-gray-50">
                <option value="">All Stages</option>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="input-field text-xs bg-gray-50">
                <option value="">Product Choice (All)</option>
                <option value="home_automation">Home Automation</option>
                <option value="fire_ready">Fire-ready</option>
                <option value="firesafety">Firesafety</option>
                {/* Custom product category support */}
                {Array.from(new Set(leads.map(l => l.product_category).filter(p => p && !['home_automation', 'fire_ready', 'firesafety'].includes(p)))).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="input-field text-xs bg-gray-50">
                <option value="">All Sources</option>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="input-field text-xs bg-gray-50">
                <option value="">All Regions</option>
                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="input-field text-xs bg-gray-50">
                <option value="">All Priorities</option>
                <option value="active">🟢 Active</option>
                <option value="highly_active">⚡ Highly Active</option>
                <option value="regular">🔷 Regular</option>
                <option value="dormant">🌙 Dormant</option>
                <option value="lost">❌ Lost</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading && leads.length === 0 ? (
        <div className="p-12 text-center text-gray-500">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading sales data...
        </div>
      ) : activeTab === 'board' ? (
        <SalesPipelineBoard
          leads={leads}
          onLeadClick={(l) => setSelectedLeadId(l.id)}
          onEditLead={(l) => { setEditingLead(l); setShowLeadModal(true); }}
          onDeleteLead={async (l) => {
            if (window.confirm(`Delete lead "${l.title}"?`)) {
              await api.deleteSalesLead(l.id);
              fetchAllData();
            }
          }}
          userRole={user?.role}
          subCategory={subCategory}
        />
      ) : activeTab === 'report' ? (
        <SalesMonthlyReport assigneeId={assigneeFilter || (user?.role !== 'admin' && user?.role !== 'manager' ? user?.id : '')} />
      ) : (
        <SalesTargetDashboard
          user={user}
          employees={employees}
          lakshyaType={subCategory.includes('lakshya') ? subCategory.replace('_lakshya', '') : 'order'}
          assigneeId={assigneeFilter || (user?.role !== 'admin' && user?.role !== 'manager' ? user?.id : '')}
        />
      )}

      {/* Modals */}
      <SalesLeadModal
        isOpen={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        onSave={fetchAllData}
        editingLead={editingLead}
        employees={employees}
        goals={goals}
        user={user}
        initialCategory={subCategory}
        initialGoalId={selectedGoalId}
        initialSource={sourceFilter}
        initialRegion={regionFilter}
        initialPriority={priorityFilter}
      />

      <SalesGoalModal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        onSave={fetchAllData}
        editingGoal={editingGoal}
        lakshyaType={subCategory.replace('_lakshya', '')}
        employees={employees}
      />

      <SalesTargetModal
        isOpen={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        onSave={fetchAllData}
        employees={employees}
        lakshyaType={subCategory.includes('lakshya') ? subCategory.replace('_lakshya', '') : 'order'}
      />

      <SalesLeadDetailModal
        leadId={selectedLeadId}
        isOpen={!!selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        user={user}
        onUpdated={fetchAllData}
      />
    </div>
  );
}
