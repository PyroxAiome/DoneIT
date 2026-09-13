import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Target, TrendingUp, CheckCircle2, User, RefreshCw, ChevronDown, ChevronUp, Award } from 'lucide-react';

const ORDER_STAGES = [
  { key: 'suspect', label: 'Suspect' },
  { key: 'prospect', label: 'Prospect' },
  { key: 'enquiry', label: 'Enquiry' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'demo', label: 'Demo' },
  { key: 'spec_tender', label: 'Spec of Tender' },
  { key: 'design_negotiation', label: 'Design Negotiation' }
];

const BILLING_STAGES = [
  { key: 'proforma_invoice', label: 'Proforma Invoice' },
  { key: 'final_invoice', label: 'Final Invoice' },
  { key: 'billing_approved', label: 'Billing Approved' },
  { key: 'payment_pending', label: 'Payment Pending' }
];

const COLLECTION_STAGES = [
  { key: 'due_followup', label: 'Due Follow-up' },
  { key: 'partial_collection', label: 'Partial Collection' },
  { key: 'full_collection', label: 'Full Collection' },
  { key: 'reconciled', label: 'Reconciled' }
];

export default function SalesTargetDashboard({ user, employees = [], lakshyaType = 'order' }) {
  const STAGES = lakshyaType === 'billing' ? BILLING_STAGES : lakshyaType === 'collection' ? COLLECTION_STAGES : ORDER_STAGES;
  const [periodType, setPeriodType] = useState('monthly');
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear().toString());
  const [periodMonth, setPeriodMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [periodQuarter, setPeriodQuarter] = useState('Q1');
  const [periodHalf, setPeriodHalf] = useState('H1');
  const [selectedPersonId, setSelectedPersonId] = useState('');

  const [targetsProgress, setTargetsProgress] = useState([]);
  const [loading, setLoading] = useState(false);

  // Expanded cards state
  const [expandedCards, setExpandedCards] = useState({});
  const [editingCellId, setEditingCellId] = useState(null);
  const [editVal, setEditVal] = useState('');

  const getPeriodMeta = () => {
    const yr = parseInt(periodYear, 10) || new Date().getFullYear();
    if (periodType === 'monthly') {
      const m = periodMonth;
      const dateObj = new Date(yr, parseInt(m, 10) - 1, 1);
      const label = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      return { start: `${yr}-${m}-01`, label, type: 'monthly' };
    }
    if (periodType === 'quarterly') {
      let startM = '01';
      if (periodQuarter === 'Q2') startM = '04';
      if (periodQuarter === 'Q3') startM = '07';
      if (periodQuarter === 'Q4') startM = '10';
      return { start: `${yr}-${startM}-01`, label: `${periodQuarter} ${yr}`, type: 'quarterly' };
    }
    if (periodType === 'half_yearly') {
      const startM = periodHalf === 'H1' ? '01' : '07';
      return { start: `${yr}-${startM}-01`, label: `${periodHalf} ${yr}`, type: 'half_yearly' };
    }
    return { start: `${yr}-04-01`, label: `FY ${yr}-${(yr + 1).toString().slice(-2)}`, type: 'annual' };
  };

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin && user?.id) {
      setSelectedPersonId(String(user.id));
    }
  }, [isAdmin, user]);

  useEffect(() => {
    fetchProgress();
  }, [periodType, periodYear, periodMonth, periodQuarter, periodHalf, selectedPersonId, lakshyaType]);

  const fetchProgress = async () => {
    setLoading(true);
    try {
      const meta = getPeriodMeta();
      const activePersonId = !isAdmin && user?.id ? String(user.id) : selectedPersonId;
      const res = await api.getSalesTargetProgress({
        period_type: meta.type,
        period_start: meta.start,
        assignee_id: activePersonId,
        lakshya_type: lakshyaType
      });
      setTargetsProgress(res);

      const initialExpanded = {};
      res.forEach(r => {
        if (r.assignee_id) initialExpanded[r.assignee_id] = true;
      });
      setExpandedCards(initialExpanded);
    } catch (err) {
      console.error('Error fetching target progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const salesPeople = employees.filter(e => 
    e.role === 'sales_manager' || e.role === 'sales_executive' || e.can_access_sales
  );

  // Group progress data by Sales Person
  const groupedByPerson = {};
  targetsProgress.forEach(row => {
    const personId = row.assignee_id;
    // For non-admin, strictly filter to own user ID
    if (!isAdmin && user?.id && personId !== user.id) return;

    if (!groupedByPerson[personId]) {
      groupedByPerson[personId] = {
        assignee_id: personId,
        assignee_name: row.assignee_name || 'Unassigned',
        targets: [],
        productLines: new Set()
      };
    }

    const plName = (row.product_line === 'other' && row.product_line_other)
      ? row.product_line_other
      : (row.product_line === 'home_automation' ? 'Home Automation' :
         row.product_line === 'fire_ready' ? 'Fire Ready' :
         row.product_line === 'firesafety' ? 'Fire Safety' : row.product_line);

    groupedByPerson[personId].productLines.add(plName);
    groupedByPerson[personId].targets.push({
      ...row,
      productLineName: plName
    });
  });

  const personCards = Object.values(groupedByPerson);

  const toggleExpand = (personId) => {
    setExpandedCards(prev => ({
      ...prev,
      [personId]: !prev[personId]
    }));
  };

  const periodMeta = getPeriodMeta();

  return (
    <div className="space-y-6">
      
      {/* Top Filter & Period Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isAdmin ? `Sales Team Target Tracker (${periodMeta.label})` : `My Target Performance (${periodMeta.label})`}
            </h2>
            <p className="text-xs text-gray-500">
              {isAdmin ? 'Monitor lead count target achievements individually by Sales Person' : `Track your personal lead count targets for ${periodMeta.label}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Period Type */}
          <select
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <option value="monthly">📅 Monthly Target</option>
            <option value="quarterly">📊 Quarterly Target</option>
            <option value="half_yearly">🗓️ Half-Yearly Target</option>
            <option value="annual">🏆 Annual Target (FY)</option>
          </select>

          {/* Period Selector */}
          {periodType === 'monthly' && (
            <div className="flex items-center gap-1">
              <select
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="text-xs bg-gray-50 border border-gray-300 rounded-lg p-2 font-medium"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, '0');
                  const name = new Date(2026, i, 1).toLocaleString('en-US', { month: 'short' });
                  return <option key={m} value={m}>{name}</option>;
                })}
              </select>
              <input
                type="number"
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
                className="w-20 text-xs bg-gray-50 border border-gray-300 rounded-lg p-2 font-medium"
              />
            </div>
          )}
          {periodType === 'quarterly' && (
            <div className="flex items-center gap-1">
              <select
                value={periodQuarter}
                onChange={(e) => setPeriodQuarter(e.target.value)}
                className="text-xs bg-gray-50 border border-gray-300 rounded-lg p-2 font-medium"
              >
                <option value="Q1">Q1 (Jan-Mar)</option>
                <option value="Q2">Q2 (Apr-Jun)</option>
                <option value="Q3">Q3 (Jul-Sep)</option>
                <option value="Q4">Q4 (Oct-Dec)</option>
              </select>
              <input
                type="number"
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
                className="w-20 text-xs bg-gray-50 border border-gray-300 rounded-lg p-2 font-medium"
              />
            </div>
          )}
          {periodType === 'half_yearly' && (
            <div className="flex items-center gap-1">
              <select
                value={periodHalf}
                onChange={(e) => setPeriodHalf(e.target.value)}
                className="text-xs bg-gray-50 border border-gray-300 rounded-lg p-2 font-medium"
              >
                <option value="H1">H1 (Jan-Jun)</option>
                <option value="H2">H2 (Jul-Dec)</option>
              </select>
              <input
                type="number"
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
                className="w-20 text-xs bg-gray-50 border border-gray-300 rounded-lg p-2 font-medium"
              />
            </div>
          )}

          {/* Person Selector (Admin only) or Badge (Non-Admin) */}
          {isAdmin ? (
            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-300 rounded-lg p-2 font-medium"
            >
              <option value="">👤 All Sales People</option>
              {salesPeople.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          ) : (
            <div className="text-xs bg-amber-50 text-amber-900 border border-amber-200 px-3 py-2 rounded-lg font-bold flex items-center gap-1.5">
              <span>👤 My Personal Targets ({user?.name})</span>
            </div>
          )}

          <button
            onClick={fetchProgress}
            className="p-2 text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title="Refresh Target Performance"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Person Cards List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-gray-500">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading target performance cards...
        </div>
      ) : personCards.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 bg-white">
          <Target className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-500" />
          <p className="text-sm font-semibold text-gray-700">No targets defined for {periodMeta.label}</p>
          <p className="text-xs text-gray-400 mt-1">Admin can set lead count targets using the "🎯 Define Targets" button</p>
        </div>
      ) : (
        <div className="space-y-4">
          {personCards.map(person => {
            const isExpanded = expandedCards[person.assignee_id] !== false;
            
            const totalTarget = person.targets.reduce((sum, t) => sum + (t.target_count || 0), 0);
            const totalActual = person.targets.reduce((sum, t) => sum + (parseInt(t.actual_count, 10) || 0), 0);
            const pct = totalTarget > 0 ? Math.min(100, Math.round((totalActual / totalTarget) * 100)) : 0;

            const productLinesList = Array.from(person.productLines);

            // Fast lookup map for cell: matrixMap[plName_stageKey]
            const matrixMap = {};
            person.targets.forEach(t => {
              matrixMap[`${t.productLineName}_${t.stage}`] = {
                id: t.id,
                target: t.target_count || 0,
                actual: parseInt(t.actual_count, 10) || 0
              };
            });

            const canEditTarget = isAdmin || (user?.id && String(person.assignee_id) === String(user.id));

            return (
              <div 
                key={person.assignee_id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden transition-all"
              >
                
                {/* Person Header Card */}
                <div 
                  onClick={() => toggleExpand(person.assignee_id)}
                  className="p-4 bg-gradient-to-r from-gray-50 via-white to-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100/50 transition-colors border-b border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-gray-900">{person.assignee_name}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          {periodMeta.label} Targets
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Target Leads: <strong className="text-gray-900">{totalTarget}</strong> • Achieved: <strong className="text-emerald-600">{totalActual}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Overall Progress Bar */}
                    <div className="hidden sm:flex flex-col items-end w-44">
                      <div className="flex items-center justify-between w-full text-xs font-semibold mb-1">
                        <span className="text-gray-500">Target Progress</span>
                        <span className="text-amber-700 font-bold">{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Person Target Matrix Grid (Expandable) */}
                {isExpanded && (
                  <div className="p-4 border-t border-gray-100 bg-white overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          <th className="p-2.5 w-44 min-w-44 border-r border-gray-200">Product Line</th>
                          {STAGES.map(stg => (
                            <th key={stg.key} className="p-2 min-w-28 text-center border-r border-gray-200">
                              {stg.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-xs">
                        {productLinesList.map(plName => (
                          <tr key={plName} className="hover:bg-amber-50/20 transition-colors">
                            <td className="p-2.5 font-bold text-gray-800 border-r border-gray-200">
                              {plName}
                            </td>
                            {STAGES.map(stg => {
                              const cellData = matrixMap[`${plName}_${stg.key}`];
                              if (!cellData || cellData.target === 0) {
                                return (
                                  <td key={stg.key} className="p-2 text-center text-gray-300 border-r border-gray-200 font-mono text-[11px]">
                                    -
                                  </td>
                                );
                              }

                              const isAchieved = cellData.actual >= cellData.target;
                              const isEditingThisCell = editingCellId === cellData.id;

                              return (
                                <td key={stg.key} className="p-2 border-r border-gray-200 text-center">
                                  {isEditingThisCell ? (
                                    <div className="flex items-center justify-center gap-1 bg-amber-50 p-1.5 rounded-lg border border-amber-300 shadow-sm animate-in fade-in">
                                      <input
                                        type="number"
                                        min="0"
                                        value={editVal}
                                        onChange={(e) => setEditVal(e.target.value)}
                                        className="w-12 text-xs p-1 border border-amber-400 rounded text-center font-bold bg-white"
                                        autoFocus
                                      />
                                      <button
                                        onClick={async () => {
                                          const val = Math.max(0, parseInt(editVal, 10) || 0);
                                          try {
                                            await api.updateSalesTargetActual(cellData.id, val);
                                            setEditingCellId(null);
                                            fetchProgress();
                                            window.dispatchEvent(new CustomEvent('sales-updated'));
                                          } catch (err) {
                                            alert(err.message || 'Failed to update actual count');
                                          }
                                        }}
                                        className="px-1.5 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700 transition-colors"
                                        title="Save Actual Count"
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={() => setEditingCellId(null)}
                                        className="px-1 py-1 text-gray-400 hover:text-gray-600 text-[10px] font-bold"
                                        title="Cancel"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center gap-1 group">
                                      <button
                                        onClick={() => {
                                          if (canEditTarget) {
                                            setEditingCellId(cellData.id);
                                            setEditVal(cellData.actual.toString());
                                          }
                                        }}
                                        disabled={!canEditTarget}
                                        className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                                          isAchieved 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                            : cellData.actual > 0
                                            ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                                        } ${canEditTarget ? 'cursor-pointer' : 'cursor-default'}`}
                                        title={canEditTarget ? 'Click to edit achieved count' : ''}
                                      >
                                        <span>{cellData.actual} / {cellData.target}</span>
                                        {isAchieved && <span className="text-[10px]">🎉</span>}
                                      </button>

                                      {/* Quick +1 Increment Button for Sales Person */}
                                      {canEditTarget && !isAchieved && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const newVal = cellData.actual + 1;
                                            try {
                                              await api.updateSalesTargetActual(cellData.id, newVal);
                                              fetchProgress();
                                              window.dispatchEvent(new CustomEvent('sales-updated'));
                                            } catch (err) {
                                              alert(err.message || 'Failed to update count');
                                            }
                                          }}
                                          className="text-[9px] font-bold text-amber-700 hover:text-amber-900 bg-amber-100/80 hover:bg-amber-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer opacity-80 hover:opacity-100"
                                          title="Quick +1 Achieved"
                                        >
                                          +1 Achieved
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
