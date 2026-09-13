import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Target, Save, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';

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

const DEFAULT_PRODUCT_LINES = [
  'Home Automation',
  'Fire Ready',
  'Fire Safety'
];

export default function SalesTargetModal({ isOpen, onClose, onSave, employees = [], lakshyaType = 'order' }) {
  const STAGES = lakshyaType === 'billing' ? BILLING_STAGES : lakshyaType === 'collection' ? COLLECTION_STAGES : ORDER_STAGES;
  const [periodType, setPeriodType] = useState('monthly');
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear().toString());
  const [periodMonth, setPeriodMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [periodQuarter, setPeriodQuarter] = useState('Q1');
  const [periodHalf, setPeriodHalf] = useState('H1');
  const [selectedAssignee, setSelectedAssignee] = useState('');

  // Product Lines list (Default 3 + Custom user added)
  const [productLines, setProductLines] = useState(DEFAULT_PRODUCT_LINES);
  const [newCustomProduct, setNewCustomProduct] = useState('');

  // Target grid state: { [productLine_stage]: countVal }
  const [gridData, setGridData] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const getPeriodMeta = () => {
    const yr = parseInt(periodYear, 10) || new Date().getFullYear();
    if (periodType === 'monthly') {
      const m = periodMonth;
      const dateObj = new Date(yr, parseInt(m, 10) - 1, 1);
      const label = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const start = `${yr}-${m}-01`;
      const lastDay = new Date(yr, parseInt(m, 10), 0).getDate();
      const end = `${yr}-${m}-${String(lastDay).padStart(2, '0')}`;
      return { start, end, label, type: 'monthly' };
    }
    if (periodType === 'quarterly') {
      let startM = '01', endM = '03', lastDay = '31';
      if (periodQuarter === 'Q2') { startM = '04'; endM = '06'; lastDay = '30'; }
      if (periodQuarter === 'Q3') { startM = '07'; endM = '09'; lastDay = '30'; }
      if (periodQuarter === 'Q4') { startM = '10'; endM = '12'; lastDay = '31'; }
      return {
        start: `${yr}-${startM}-01`,
        end: `${yr}-${endM}-${lastDay}`,
        label: `${periodQuarter} ${yr}`,
        type: 'quarterly'
      };
    }
    if (periodType === 'half_yearly') {
      if (periodHalf === 'H1') {
        return { start: `${yr}-01-01`, end: `${yr}-06-30`, label: `H1 ${yr}`, type: 'half_yearly' };
      } else {
        return { start: `${yr}-07-01`, end: `${yr}-12-31`, label: `H2 ${yr}`, type: 'half_yearly' };
      }
    }
    const nextYr = yr + 1;
    return { start: `${yr}-04-01`, end: `${nextYr}-03-31`, label: `FY ${yr}-${nextYr.toString().slice(-2)}`, type: 'annual' };
  };

  useEffect(() => {
    if (isOpen && selectedAssignee) {
      loadExistingTargets();
    }
  }, [isOpen, selectedAssignee, periodType, periodYear, periodMonth, periodQuarter, periodHalf]);

  const loadExistingTargets = async () => {
    if (!selectedAssignee) return;
    setLoading(true);
    try {
      const meta = getPeriodMeta();
      const res = await api.getSalesTargets({
        assignee_id: selectedAssignee,
        period_type: meta.type,
        period_start: meta.start,
        lakshya_type: lakshyaType
      });

      const initialGrid = {};
      const customLinesFound = new Set(DEFAULT_PRODUCT_LINES);

      res.forEach(t => {
        const plName = (t.product_line === 'other' && t.product_line_other) 
          ? t.product_line_other 
          : (t.product_line === 'home_automation' ? 'Home Automation' :
             t.product_line === 'fire_ready' ? 'Fire Ready' :
             t.product_line === 'firesafety' ? 'Fire Safety' : t.product_line);

        customLinesFound.add(plName);
        const key = `${plName}_${t.stage}`;
        initialGrid[key] = t.target_count || '';
      });

      setProductLines(Array.from(customLinesFound));
      setGridData(initialGrid);
    } catch (err) {
      console.error('Error loading targets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCellChange = (productLine, stageKey, val) => {
    const key = `${productLine}_${stageKey}`;
    setGridData(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleAddCustomProduct = () => {
    if (!newCustomProduct.trim()) return;
    const trimmed = newCustomProduct.trim();
    if (!productLines.includes(trimmed)) {
      setProductLines([...productLines, trimmed]);
    }
    setNewCustomProduct('');
  };

  const handleRemoveCustomProduct = (plName) => {
    if (DEFAULT_PRODUCT_LINES.includes(plName)) return; // Default lines cannot be removed
    setProductLines(productLines.filter(p => p !== plName));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedAssignee) {
      setMsg({ text: 'Please select a sales person first', type: 'error' });
      return;
    }

    setSaving(true);
    setMsg({ text: '', type: '' });
    try {
      const meta = getPeriodMeta();
      const targetsList = [];

      productLines.forEach(pl => {
        STAGES.forEach(stg => {
          const key = `${pl}_${stg.key}`;
          const countVal = parseInt(gridData[key], 10) || 0;

          if (countVal > 0) {
            let plKey = 'other';
            let plOther = pl;

            if (pl === 'Home Automation') { plKey = 'home_automation'; plOther = ''; }
            else if (pl === 'Fire Ready') { plKey = 'fire_ready'; plOther = ''; }
            else if (pl === 'Fire Safety') { plKey = 'firesafety'; plOther = ''; }

            targetsList.push({
              assignee_id: parseInt(selectedAssignee, 10),
              product_line: plKey,
              product_line_other: plOther,
              stage: stg.key,
              period_type: meta.type,
              period_label: meta.label,
              period_start: meta.start,
              period_end: meta.end,
              target_count: countVal,
              target_value: 0,
              lakshya_type: lakshyaType
            });
          }
        });
      });

      if (targetsList.length === 0) {
        setMsg({ text: 'Please enter at least one target lead count in the grid', type: 'error' });
        setSaving(false);
        return;
      }

      await api.upsertSalesTargets(targetsList);
      setMsg({ text: 'Process targets saved successfully!', type: 'success' });
      setTimeout(() => {
        onSave && onSave();
        onClose();
      }, 1000);
    } catch (err) {
      setMsg({ text: err.message || 'Failed to save targets', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const salesPeople = employees.filter(e => 
    e.role === 'sales_manager' || e.role === 'sales_executive' || e.can_access_sales
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Define Process Lead Targets</h2>
              <p className="text-xs text-gray-500">Set target lead counts per stage & product line for Sales Team</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {msg.text && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{msg.text}</span>
            </div>
          )}

          {/* Controls Bar */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Sales Person Selection */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">1. Select Sales Person *</label>
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="w-full text-xs bg-white border border-gray-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="">-- Choose Sales Person --</option>
                {salesPeople.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                ))}
              </select>
            </div>

            {/* Target Period Type */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">2. Target Period Type</label>
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value)}
                className="w-full text-xs bg-white border border-gray-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="monthly">Monthly Target</option>
                <option value="quarterly">Quarterly Target</option>
                <option value="half_yearly">Half-Yearly Target</option>
                <option value="annual">Annual Target (FY)</option>
              </select>
            </div>

            {/* Period Specifier */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">3. Choose Target Cycle</label>
              {periodType === 'monthly' && (
                <div className="flex gap-2">
                  <select
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    className="w-1/2 text-xs bg-white border border-gray-300 rounded-lg p-2 font-medium"
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
                    className="w-1/2 text-xs bg-white border border-gray-300 rounded-lg p-2 font-medium"
                  />
                </div>
              )}
              {periodType === 'quarterly' && (
                <div className="flex gap-2">
                  <select
                    value={periodQuarter}
                    onChange={(e) => setPeriodQuarter(e.target.value)}
                    className="w-1/2 text-xs bg-white border border-gray-300 rounded-lg p-2 font-medium"
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
                    className="w-1/2 text-xs bg-white border border-gray-300 rounded-lg p-2 font-medium"
                  />
                </div>
              )}
              {periodType === 'half_yearly' && (
                <div className="flex gap-2">
                  <select
                    value={periodHalf}
                    onChange={(e) => setPeriodHalf(e.target.value)}
                    className="w-1/2 text-xs bg-white border border-gray-300 rounded-lg p-2 font-medium"
                  >
                    <option value="H1">H1 (Jan-Jun)</option>
                    <option value="H2">H2 (Jul-Dec)</option>
                  </select>
                  <input
                    type="number"
                    value={periodYear}
                    onChange={(e) => setPeriodYear(e.target.value)}
                    className="w-1/2 text-xs bg-white border border-gray-300 rounded-lg p-2 font-medium"
                  />
                </div>
              )}
              {periodType === 'annual' && (
                <input
                  type="number"
                  value={periodYear}
                  onChange={(e) => setPeriodYear(e.target.value)}
                  placeholder="Year (e.g. 2026)"
                  className="w-full text-xs bg-white border border-gray-300 rounded-lg p-2 font-medium"
                />
              )}
            </div>

          </div>

          {/* Add Custom Product Line Control */}
          <div className="flex items-center gap-2 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
              <Plus className="w-4 h-4 text-amber-600" />
              Add Product Line:
            </span>
            <input
              type="text"
              value={newCustomProduct}
              onChange={(e) => setNewCustomProduct(e.target.value)}
              placeholder="e.g. Solar Power Systems"
              className="text-xs p-1.5 border border-gray-300 rounded-lg bg-white w-64 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddCustomProduct}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              + Add Row
            </button>
          </div>

          {/* Grid Table */}
          {!selectedAssignee ? (
            <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
              <Target className="w-10 h-10 mx-auto mb-2 opacity-40 text-amber-500" />
              <p className="text-sm font-semibold text-gray-600">Please select a Sales Person above to open the target matrix</p>
            </div>
          ) : loading ? (
            <div className="p-12 text-center text-xs text-gray-500">Loading existing targets...</div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100/90 border-b border-gray-200 text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    <th className="p-3 sticky left-0 bg-gray-100 z-10 w-48 min-w-48 border-r border-gray-200">
                      Product Line
                    </th>
                    {STAGES.map(stg => (
                      <th key={stg.key} className="p-3 min-w-32 text-center border-r border-gray-200">
                        {stg.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white text-xs">
                  {productLines.map(pl => {
                    const isCustom = !DEFAULT_PRODUCT_LINES.includes(pl);
                    return (
                      <tr key={pl} className="hover:bg-amber-50/20 transition-colors">
                        <td className="p-3 font-semibold text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200 shadow-xs flex items-center justify-between">
                          <span>{pl}</span>
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomProduct(pl)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                              title="Remove custom product row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                        {STAGES.map(stg => {
                          const cellKey = `${pl}_${stg.key}`;
                          const val = gridData[cellKey] || '';
                          return (
                            <td key={stg.key} className="p-2 border-r border-gray-200 text-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={val}
                                onChange={(e) => handleCellChange(pl, stg.key, e.target.value)}
                                className="w-20 text-xs p-2 border border-gray-300 rounded-lg font-bold text-center text-gray-900 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-gray-50/50"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedAssignee}
            className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Targets...' : 'Save Targets'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
