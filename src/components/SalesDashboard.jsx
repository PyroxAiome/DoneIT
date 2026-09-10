import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import SalesPipelineBoard from './SalesPipelineBoard';
import SalesLeadModal from './SalesLeadModal';
import SalesLeadDetailModal from './SalesLeadDetailModal';
import SalesGoalModal from './SalesGoalModal';
import SalesMonthlyReport from './SalesMonthlyReport';
import {
  TrendingUp, Target, Plus, Search, Filter, Briefcase,
  CheckCircle2, Award, Tag, Calendar, UserCheck
} from 'lucide-react';

const STAGES = [
  { key: 'suspect', label: 'Suspect' },
  { key: 'prospect', label: 'Prospect' },
  { key: 'enquiry', label: 'Enquiry' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'demo', label: 'Demo' },
  { key: 'spec_tender', label: 'Spec of Tender' },
  { key: 'design_negotiation', label: 'Design Negotiation' },
  { key: 'dfp', label: 'DFP' },
  { key: 'order', label: 'Order' },
  { key: 'billing', label: 'Billing' }
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

export default function SalesDashboard({ user, initialAssigneeId = '' }) {
  // Main view tabs: 'board' | 'report'
  const [activeTab, setActiveTab] = useState('board');

  // Sub-filter: 'general' | 'lakshya'
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
  const [sourceFilter, setSourceFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState(initialAssigneeId ? String(initialAssigneeId) : '');

  // Modals
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  useEffect(() => {
    if (initialAssigneeId !== undefined && initialAssigneeId !== null) {
      setAssigneeFilter(initialAssigneeId ? String(initialAssigneeId) : '');
    }
  }, [initialAssigneeId]);

  useEffect(() => {
    fetchAllData();

    const handleUpdate = () => fetchAllData();
    window.addEventListener('sales-updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('sales-updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [subCategory, selectedGoalId, stageFilter, sourceFilter, regionFilter, priorityFilter, assigneeFilter]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [leadsRes, goalsRes, empRes] = await Promise.all([
        api.getSalesLeads({
          category: subCategory,
          goal_id: selectedGoalId,
          stage: stageFilter,
          lead_source: sourceFilter,
          region: regionFilter,
          priority: priorityFilter,
          assignee_id: assigneeFilter,
          search: search
        }),
        api.getSalesGoals(),
        api.getEmployees(true)
      ]);
      setLeads(leadsRes);
      setGoals(goalsRes);
      setEmployees(empRes);
    } catch (err) {
      console.error('Sales fetch error:', err);
    } finally {
      setLoading(false);
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

  // Metrics
  const totalValue = leads.reduce((sum, l) => sum + (parseFloat(l.lead_value) || 0), 0);
  const wonLeads = leads.filter(l => l.current_stage === 'order' || l.current_stage === 'billing');
  const avgProb = leads.length > 0 ? Math.round(leads.reduce((sum, l) => sum + (l.probability_pct || 0), 0) / leads.length) : 0;

  return (
    <div className="space-y-6">
      {/* Top Title & Category Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Sales Pipeline Command Center</h1>
              {user?.role === 'admin' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  Admin Master View
                </span>
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
                : 'Track company sales leads, 10-stage funnel progress, and Lakshya target goals'}
            </p>
          </div>
        </div>

        {/* Sub-filters Toggle */}
        <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            onClick={() => { setSubCategory('general'); setSelectedGoalId(null); }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${subCategory === 'general' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
          >
            📋 General Leads
          </button>
          <button
            onClick={() => { setSubCategory('lakshya'); setSelectedGoalId(null); }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${subCategory === 'lakshya' ? 'bg-white text-amber-700 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
          >
            🎯 Lakshya (Goal Leads)
          </button>
        </div>
      </div>

      {/* Lakshya Target Goal Containers Section */}
      {subCategory === 'lakshya' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-900">
              <Target className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-sm">Lakshya Target Goal Containers</h3>
            </div>
            {['admin', 'sales_manager'].includes(user?.role) && (
              <button
                onClick={() => { setEditingGoal(null); setShowGoalModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-xs text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Lakshya Goal
              </button>
            )}
          </div>

          {goals.length === 0 ? (
            <p className="text-xs text-gray-500 italic py-2">No Lakshya goals created yet. Click above to define your first revenue goal target.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {goals.map(g => {
                const isSelected = selectedGoalId === g.id;
                const targetVal = parseFloat(g.target_value) || 0;
                const currentVal = parseFloat(g.current_value) || 0;
                const pct = targetVal > 0 ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : 0;

                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGoalId(isSelected ? null : g.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/30' : 'bg-gray-50 border-gray-200 hover:bg-white hover:shadow-xs'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-xs text-gray-900 truncate">{g.name}</h4>
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        {g.period_type}
                      </span>
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
                        <span>{g.total_leads || 0} Leads • {g.won_leads || 0} Won</span>
                        <span className="font-bold text-amber-700">{pct}% Achieved</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Active Leads</div>
            <div className="text-xl font-bold text-gray-900">{leads.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pipeline Value</div>
            <div className="text-xl font-bold text-amber-700">{formatCurrency(totalValue)}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Won Leads</div>
            <div className="text-xl font-bold text-amber-800">{wonLeads.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Avg Probability</div>
            <div className="text-xl font-bold text-gray-900">{avgProb}%</div>
          </div>
        </div>
      </div>

      {/* Navigation & Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'board' ? 'bg-amber-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              10-Stage Pipeline Board
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'report' ? 'bg-amber-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Monthly Cycle Report
            </button>
          </div>

          <button
            onClick={() => { setEditingLead(null); setShowLeadModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-xs text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            New Lead
          </button>
        </div>

        {/* Filters */}
        {activeTab !== 'report' && (
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
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
                  {(employees.filter(e => e.role === 'sales_manager' || e.role === 'sales_executive' || e.can_access_sales).length > 0
                    ? employees.filter(e => e.role === 'sales_manager' || e.role === 'sales_executive' || e.can_access_sales)
                    : employees
                  ).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
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
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">🔴 Critical</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
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
        />
      ) : (
        <SalesMonthlyReport />
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
