import { useState } from 'react';
import {
  Building2, MapPin, User, DollarSign, AlertTriangle, Calendar,
  MoreVertical, Edit3, Trash2, Tag, Star, Clock, ShieldAlert
} from 'lucide-react';

const PRIORITY_STYLES = {
  low: 'border-l-4 border-l-slate-400',
  medium: 'border-l-4 border-l-blue-500',
  high: 'border-l-4 border-l-amber-500',
  critical: 'border-l-4 border-l-red-600'
};

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

const STAGE_COLORS = {
  suspect: 'bg-slate-100 text-slate-700 border-slate-200',
  prospect: 'bg-blue-50 text-blue-700 border-blue-200',
  enquiry: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  presentation: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  demo: 'bg-purple-50 text-purple-700 border-purple-200',
  spec_tender: 'bg-violet-50 text-violet-700 border-violet-200',
  design_negotiation: 'bg-amber-50 text-amber-700 border-amber-200',
  dfp: 'bg-orange-50 text-orange-700 border-orange-200',
  order: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  billing: 'bg-green-100 text-green-800 border-green-300'
};

export default function SalesLeadCard({ lead, onClick, onEdit, onDelete, onStageChange, userRole }) {
  const [showMenu, setShowMenu] = useState(false);

  const formatCurrency = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  let skippedList = [];
  try {
    skippedList = typeof lead.skipped_stages === 'string'
      ? JSON.parse(lead.skipped_stages || '[]')
      : (lead.skipped_stages || []);
  } catch (e) {
    skippedList = [];
  }

  // Days in current stage calculation
  const getDaysInStage = () => {
    if (!lead.stage_updated_at) return 0;
    const diffTime = Math.abs(new Date() - new Date(lead.stage_updated_at));
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };
  const daysInStage = getDaysInStage();

  return (
    <div
      onClick={onClick}
      className={`card relative p-3.5 bg-white rounded-xl border border-gray-200/80 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group ${PRIORITY_STYLES[lead.priority] || PRIORITY_STYLES.medium}`}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STAGE_COLORS[lead.current_stage] || STAGE_COLORS.suspect}`}>
              {STAGE_LABELS[lead.current_stage] || lead.current_stage} ({lead.probability_pct || 0}%)
            </span>

            {lead.category === 'lakshya' && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                <Tag className="w-2.5 h-2.5" />
                Lakshya
              </span>
            )}
          </div>

          <h4 className="font-semibold text-gray-900 text-sm truncate group-hover:text-emerald-700 transition-colors">
            {lead.title}
          </h4>
        </div>

        {/* Options Menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-6 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 animate-in fade-in">
              <button
                onClick={() => { setShowMenu(false); if (onEdit) onEdit(lead); }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5 text-gray-500" />
                Edit Details
              </button>
              {userRole === 'admin' && onDelete && (
                <button
                  onClick={() => { setShowMenu(false); onDelete(lead); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  Delete Lead
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Value & Location Banner */}
      <div className="flex items-center justify-between gap-2 py-1.5 px-2 bg-slate-50/80 rounded-lg mb-2 text-xs">
        <div className="font-bold text-emerald-800 flex items-center gap-1">
          {formatCurrency(lead.lead_value)}
        </div>
        {(lead.city || lead.region) && (
          <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{lead.city ? `${lead.city}, ` : ''}{lead.region ? lead.region.replace('_', ' ') : ''}</span>
          </div>
        )}
      </div>

      {/* Skipped Stage Warning Badge (RED) */}
      {skippedList.length > 0 && (
        <div className="mb-2 p-1.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5 text-[11px] text-red-700 font-medium animate-in fade-in">
          <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span className="truncate">
            Skipped: {skippedList.map(s => STAGE_LABELS[s] || s).join(', ')}
          </span>
        </div>
      )}

      {/* Metadata Badges */}
      <div className="space-y-1 text-[11px] text-gray-600 mb-2">
        {lead.consultant_name && (
          <div className="flex items-center gap-1 text-gray-500 truncate">
            <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="truncate">Consultant: {lead.consultant_name}</span>
          </div>
        )}

        {lead.goal_name && (
          <div className="flex items-center gap-1 text-emerald-700 font-medium truncate">
            <Tag className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="truncate">Goal: {lead.goal_name}</span>
          </div>
        )}
      </div>

      {/* Footer Info Row */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500">
        <div className="flex items-center gap-1">
          <User className="w-3 h-3 text-gray-400" />
          <span className="truncate max-w-[100px]">{lead.assignee_name || 'Unassigned'}</span>
        </div>

        <div className="flex items-center gap-2">
          {parseInt(lead.leverage_contact_count || 0, 10) > 0 && (
            <span className="text-amber-600 font-medium flex items-center gap-0.5" title="Leverage champion contact present">
              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
            </span>
          )}

          <div className={`flex items-center gap-0.5 ${daysInStage > 30 ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
            <Clock className="w-3 h-3" />
            <span>{daysInStage}d</span>
          </div>
        </div>
      </div>
    </div>
  );
}
