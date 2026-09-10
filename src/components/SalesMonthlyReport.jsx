import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Calendar, TrendingUp, AlertTriangle, CheckCircle, Users, Target, ShieldAlert } from 'lucide-react';

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

export default function SalesMonthlyReport() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [selectedMonth]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await api.getSalesStats(selectedMonth);
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch sales stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(parseFloat(val) / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(parseFloat(val) / 100000).toFixed(2)} Lakh`;
    return `₹${parseFloat(val).toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading sales monthly report...
      </div>
    );
  }

  const summary = stats?.summary || {};
  const stageBreakdown = stats?.stage_breakdown || [];
  const reps = stats?.representatives || [];
  const staleLeads = stats?.stale_leads || [];
  const monthlyNew = stats?.monthly_new || {};

  return (
    <div className="space-y-6 pb-8 animate-in fade-in">
      {/* Month Selector Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            Monthly Sales Performance Report
          </h2>
          <p className="text-xs text-gray-500">Pipeline health, conversion metrics, and team performance overview</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600">Select Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input-field bg-slate-50 text-xs py-1.5 px-3 border-gray-300 font-semibold"
          />
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 bg-white border border-gray-200/80 rounded-2xl">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Active Leads</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{summary.total_leads || 0}</div>
          <div className="text-xs text-amber-700 font-medium mt-1">Avg Probability: {summary.avg_probability || 0}%</div>
        </div>

        <div className="card p-4 bg-white border border-gray-200/80 rounded-2xl">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pipeline Value</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(summary.total_pipeline_value)}</div>
          <div className="text-xs text-gray-500 mt-1">Across all 10 stages</div>
        </div>

        <div className="card p-4 bg-white border border-gray-200/80 rounded-2xl">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">New Enquiries ({selectedMonth})</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{monthlyNew.new_leads_count || 0}</div>
          <div className="text-xs text-amber-700 font-medium mt-1">{formatCurrency(monthlyNew.new_leads_value)} added</div>
        </div>

        <div className="card p-4 bg-white border border-gray-200/80 rounded-2xl">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Won Deals (Order/Billing)</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{summary.won_leads || 0}</div>
          <div className="text-xs text-amber-700 font-medium mt-1">{formatCurrency(summary.won_value)} closed</div>
        </div>
      </div>

      {/* Funnel Stage Breakdown */}
      <div className="card p-5 bg-white border border-gray-200/80 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-600" />
          Pipeline Funnel Stage Breakdown
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.keys(STAGE_LABELS).map(stageKey => {
            const item = stageBreakdown.find(s => s.current_stage === stageKey) || { count: 0, total_value: 0 };
            return (
              <div key={stageKey} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <div className="text-[11px] font-semibold text-slate-600 uppercase truncate">{STAGE_LABELS[stageKey]}</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{item.count}</div>
                <div className="text-xs font-medium text-amber-700 mt-0.5">{formatCurrency(item.total_value)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sales Team Performance Table */}
      <div className="card p-5 bg-white border border-gray-200/80 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-600" />
          Salesperson Performance Table
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-slate-50 text-gray-600 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">Sales Person</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3 text-center">Active Leads</th>
                <th className="py-2.5 px-3 text-right">Total Value (₹)</th>
                <th className="py-2.5 px-3 text-center">Won Leads</th>
                <th className="py-2.5 px-3 text-center">Avg Probability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reps.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-4 text-center text-gray-400 italic">No sales team members found.</td>
                </tr>
              ) : (
                reps.map(rep => (
                  <tr key={rep.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-gray-900">{rep.name}</td>
                    <td className="py-2.5 px-3 text-gray-500 capitalize">{rep.role ? rep.role.replace('_', ' ') : 'Sales'}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">{rep.active_leads}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatCurrency(rep.total_value)}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-green-700">{rep.won_leads}</td>
                    <td className="py-2.5 px-3 text-center">{rep.avg_prob}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stale Leads Warning Table (>30 days without stage update) */}
      <div className="card p-5 bg-white border border-gray-200/80 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Stale Leads Alert (&gt;30 Days in Same Stage)
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
            {staleLeads.length} Attention Needed
          </span>
        </div>

        {staleLeads.length === 0 ? (
          <p className="text-xs text-gray-400 italic p-3 text-center bg-gray-50 rounded-xl">No stale leads. All active leads are moving smoothly!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-amber-50/50 text-amber-900 font-semibold uppercase tracking-wider">
                  <th className="py-2 px-3">Lead Title</th>
                  <th className="py-2 px-3">Current Stage</th>
                  <th className="py-2 px-3">Assignee</th>
                  <th className="py-2 px-3 text-right">Value (₹)</th>
                  <th className="py-2 px-3 text-right">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staleLeads.map(l => (
                  <tr key={l.id} className="hover:bg-amber-50/30">
                    <td className="py-2 px-3 font-semibold text-gray-900">{l.title}</td>
                    <td className="py-2 px-3 font-medium text-amber-800">{STAGE_LABELS[l.current_stage] || l.current_stage}</td>
                    <td className="py-2 px-3 text-gray-600">{l.assignee_name || 'Unassigned'}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800">{formatCurrency(l.lead_value)}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{new Date(l.stage_updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
