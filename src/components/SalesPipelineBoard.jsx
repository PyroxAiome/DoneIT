import SalesLeadCard from './SalesLeadCard';

const ORDER_STAGES = [
  { key: 'suspect', label: 'Suspect', prob: 10 },
  { key: 'prospect', label: 'Prospect', prob: 25 },
  { key: 'enquiry', label: 'Enquiry', prob: 40 },
  { key: 'presentation', label: 'Presentation', prob: 55 },
  { key: 'demo', label: 'Demo', prob: 70 },
  { key: 'spec_tender', label: 'Spec of Tender', prob: 85 },
  { key: 'design_negotiation', label: 'Design Negotiation', prob: 95 }
];

const BILLING_STAGES = [
  { key: 'proforma_invoice', label: 'Proforma Invoice', prob: 25 },
  { key: 'tax_invoice', label: 'Tax Invoice', prob: 50 },
  { key: 'billing_approved', label: 'Billing Approved', prob: 75 },
  { key: 'payment_pending', label: 'Payment Pending', prob: 100 }
];

const COLLECTION_STAGES = [
  { key: 'payment_due', label: 'Payment Due', prob: 25 },
  { key: 'followup', label: 'Collection Followup', prob: 50 },
  { key: 'partially_collected', label: 'Partially Collected', prob: 75 },
  { key: 'fully_collected', label: 'Fully Collected', prob: 100 }
];

export default function SalesPipelineBoard({ leads = [], onLeadClick, onEditLead, onDeleteLead, userRole, subCategory = 'general' }) {
  const activeStages = subCategory === 'billing_lakshya'
    ? BILLING_STAGES
    : subCategory === 'collection_lakshya'
    ? COLLECTION_STAGES
    : ORDER_STAGES;

  const formatValue = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-6 pt-1 min-h-[580px] scrollbar-thin">
      {activeStages.map(stage => {
        const stageLeads = leads.filter(l => l.current_stage === stage.key || (!l.current_stage && stage.key === activeStages[0].key));
        const stageActiveLeads = stageLeads.filter(l => (l.priority || '').toLowerCase() !== 'lost');
        const stageTotalValue = stageActiveLeads.reduce((sum, l) => sum + (parseFloat(l.lead_value) || 0), 0);

        return (
          <div
            key={stage.key}
            className="w-72 shrink-0 flex flex-col bg-gray-50/70 border border-gray-200 rounded-xl p-3 shadow-xs"
          >
            {/* Column Header */}
            <div className="p-2.5 rounded-lg border bg-gray-100/90 border-gray-200 mb-3 text-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-wide truncate">{stage.label}</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                  {stage.prob}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1 text-gray-500 font-medium">
                <span>{stageLeads.length} {stageLeads.length === 1 ? 'Lead' : 'Leads'}</span>
                <span className="font-bold text-gray-900">{formatValue(stageTotalValue)}</span>
              </div>
            </div>

            {/* Leads Cards Container */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-290px)] pr-0.5">
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
