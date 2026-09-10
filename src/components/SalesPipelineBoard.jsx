import { useState } from 'react';
import SalesLeadCard from './SalesLeadCard';
import { DollarSign, Layers } from 'lucide-react';

const STAGES = [
  { key: 'suspect', label: 'Suspect', prob: 5, color: 'bg-slate-100 border-slate-300 text-slate-800' },
  { key: 'prospect', label: 'Prospect', prob: 10, color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { key: 'enquiry', label: 'Enquiry', prob: 20, color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
  { key: 'presentation', label: 'Presentation', prob: 30, color: 'bg-cyan-50 border-cyan-200 text-cyan-800' },
  { key: 'demo', label: 'Demo', prob: 40, color: 'bg-purple-50 border-purple-200 text-purple-800' },
  { key: 'spec_tender', label: 'Spec of Tender', prob: 50, color: 'bg-violet-50 border-violet-200 text-violet-800' },
  { key: 'design_negotiation', label: 'Design Negotiation', prob: 60, color: 'bg-amber-50 border-amber-200 text-amber-800' },
  { key: 'dfp', label: 'DFP', prob: 70, color: 'bg-orange-50 border-orange-200 text-orange-800' },
  { key: 'order', label: 'Order', prob: 85, color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  { key: 'billing', label: 'Billing', prob: 95, color: 'bg-green-100 border-green-300 text-green-900' }
];

export default function SalesPipelineBoard({ leads = [], onLeadClick, onEditLead, onDeleteLead, userRole }) {
  const formatValue = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-6 pt-1 min-h-[600px] scrollbar-thin">
      {STAGES.map(stage => {
        const stageLeads = leads.filter(l => l.current_stage === stage.key);
        const stageTotalValue = stageLeads.reduce((sum, l) => sum + (parseFloat(l.lead_value) || 0), 0);

        return (
          <div
            key={stage.key}
            className="w-72 shrink-0 flex flex-col bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3 shadow-xs"
          >
            {/* Column Header */}
            <div className={`p-2.5 rounded-xl border mb-3 ${stage.color}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-wide truncate">{stage.label}</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/70 shadow-xs">
                  {stage.prob}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1 opacity-90">
                <span>{stageLeads.length} {stageLeads.length === 1 ? 'Lead' : 'Leads'}</span>
                <span className="font-bold">{formatValue(stageTotalValue)}</span>
              </div>
            </div>

            {/* Leads Cards Container */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5">
              {stageLeads.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl my-auto">
                  No leads in this stage
                </div>
              ) : (
                stageLeads.map(lead => (
                  <SalesLeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => onLeadClick(lead)}
                    onEdit={onEditLead}
                    onDelete={onDeleteLead}
                    userRole={userRole}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
