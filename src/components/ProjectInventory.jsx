import { useState, useEffect } from 'react';
import { 
  Package, Plus, TrendingUp, ArrowDownLeft, ArrowUpRight, AlertTriangle, 
  CheckCircle2, FileText, Camera, MapPin, Search, Filter, ShieldAlert, Layers,
  ShieldCheck, Eye, XCircle, X, Trash2, Pencil
} from 'lucide-react';
import { api } from '../lib/api';

export default function ProjectInventory({ project, user, tasks }) {
  const [data, setData] = useState({ balances: [], receipts: [], pendingManagerReceipts: [], pendingAdminReceipts: [], pendingAudits: [], usage: [], scrap: [], audits: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  
  const [activeSubTab, setActiveSubTab] = useState('balances'); // 'balances' | 'receipts' | 'usage' | 'scrap'
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modal States
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showScrapModal, setShowScrapModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  // Form States
  const [inwardForm, setInwardForm] = useState({ item_id: '', qty_received: '', challan_number: '', challan_photo: '', notes: '' });
  const [usageForm, setUsageForm] = useState({ item_id: '', task_id: '', qty_used: '', installed_location: '', notes: '' });
  const [scrapForm, setScrapForm] = useState({ item_id: '', qty_scrapped: '', reason: '', photo_url: '' });
  const [itemForm, setItemForm] = useState({ name: '', category: 'Panels', unit: 'pcs', description: '' });
  const [auditForm, setAuditForm] = useState({ item_id: '', physical_counted_qty: '', notes: '' });

  const [resubmitItem, setResubmitItem] = useState(null);
  const [resubmitForm, setResubmitForm] = useState({ qty_received: '', challan_number: '', challan_photo: '', notes: '' });
  const [busy, setBusy] = useState(false);

  const handleVerifyReceipt = async (receiptId, action) => {
    let rejectionReason = '';
    if (action === 'reject') {
      rejectionReason = prompt('Please enter the reason for rejecting this Delivery Challan:');
      if (!rejectionReason) return;
    } else {
      const label = action === 'manager_verify' ? 'Manager Verification (Pass to Admin)' : 'FINAL ADMIN APPROVAL & ADD STOCK';
      if (!confirm(`Are you sure you want to proceed with: ${label}?`)) return;
    }

    try {
      await api.verifyDeliveryChallan(project.id, receiptId, action, rejectionReason);
      loadInventory();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVerifyAudit = async (auditId, action) => {
    let rejectionReason = '';
    if (action === 'reject') {
      rejectionReason = prompt('Please enter the reason for rejecting this physical stock audit:');
      if (!rejectionReason) return;
    } else {
      if (!confirm('Are you sure you want to verify and confirm this stock audit count?')) return;
    }

    try {
      await api.verifyPhysicalAudit(project.id, auditId, action, rejectionReason);
      loadInventory();
    } catch (err) {
      alert(err.message);
    }
  };

  const loadInventory = async () => {
    try {
      setLoading(true);
      const res = await api.getProjectInventory(project.id);
      setData({
        balances: res.balances || [],
        receipts: res.receipts || [],
        pendingManagerReceipts: res.pendingManagerReceipts || [],
        pendingAdminReceipts: res.pendingAdminReceipts || [],
        pendingAudits: res.pendingAudits || [],
        mySubmissions: res.mySubmissions || [],
        usage: res.usage || [],
        scrap: res.scrap || [],
        audits: res.audits || []
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [project.id]);

  // Derived Totals
  const totalReceivedCount = data.balances.reduce((acc, b) => acc + (b.total_received || 0), 0);
  const totalUsedCount = data.balances.reduce((acc, b) => acc + (b.total_used || 0), 0);
  const totalScrappedCount = data.balances.reduce((acc, b) => acc + (b.total_scrapped || 0), 0);
  const totalInStockCount = data.balances.reduce((acc, b) => acc + (b.in_stock || 0), 0);

  const categories = Array.from(new Set(data.balances.map(b => b.category))).filter(Boolean);

  const filteredBalances = data.balances.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) || 
                          b.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || b.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Handlers
  const handleInwardSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!inwardForm.item_id || !inwardForm.qty_received) return setBusy(false);
      await api.logInwardMaterial(project.id, inwardForm);
      setShowInwardModal(false);
      setInwardForm({ item_id: '', qty_received: '', challan_number: '', challan_photo: '', notes: '' });
      loadInventory();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUsageSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!usageForm.item_id || !usageForm.qty_used) return setBusy(false);
      await api.logMaterialUsage(project.id, usageForm);
      setShowUsageModal(false);
      setUsageForm({ item_id: '', task_id: '', qty_used: '', installed_location: '', notes: '' });
      loadInventory();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleScrapSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!scrapForm.item_id || !scrapForm.qty_scrapped || !scrapForm.reason) return setBusy(false);
      await api.logMaterialScrap(project.id, scrapForm);
      setShowScrapModal(false);
      setScrapForm({ item_id: '', qty_scrapped: '', reason: '', photo_url: '' });
      loadInventory();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddItemSubmit = async (e) => {
    e.preventDefault();
    if (!itemForm.name) return;
    setBusy(true);
    try {
      await api.addInventoryMaster(itemForm);
      setShowAddItemModal(false);
      setItemForm({ name: '', category: 'Panels', unit: 'pcs', description: '' });
      loadInventory();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleEditItemSubmit = async (e) => {
    e.preventDefault();
    if (!editItem || !editItem.name.trim()) return;
    setBusy(true);
    try {
      await api.updateInventoryMaster(editItem.id, {
        name: editItem.name.trim(),
        category: editItem.category || 'General',
        unit: editItem.unit || 'pcs',
        description: editItem.description || ''
      });
      setEditItem(null);
      loadInventory();
    } catch (err) {
      alert(err.message || 'Failed to update item');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!confirm(`Are you sure you want to remove "${item.name}" from the inventory master catalog? This will delete the item and its records.`)) {
      return;
    }
    setBusy(true);
    try {
      await api.deleteInventoryMaster(item.item_id);
      loadInventory();
    } catch (err) {
      alert(err.message || 'Failed to delete item');
    } finally {
      setBusy(false);
    }
  };

  const handleAuditSubmit = async (e) => {
    e.preventDefault();
    if (!auditForm.item_id || auditForm.physical_counted_qty === '') return;
    const selected = data.balances.find(b => Number(b.item_id) === Number(auditForm.item_id));
    const expected = selected ? selected.in_stock : 0;
    
    setBusy(true);
    try {
      await api.logPhysicalAudit(project.id, {
        ...auditForm,
        system_expected_qty: expected
      });
      setShowAuditModal(false);
      setAuditForm({ item_id: '', physical_counted_qty: '', notes: '' });
      loadInventory();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleResubmitSubmit = async (e) => {
    e.preventDefault();
    if (!resubmitItem) return;
    setBusy(true);
    try {
      await api.resubmitMaterialReceipt(project.id, resubmitItem.id, resubmitForm);
      setResubmitItem(null);
      setResubmitForm({ qty_received: '', challan_number: '', challan_photo: '', notes: '' });
      loadInventory();
    } catch (err) {
      alert(err.message || 'Failed to resubmit material receipt');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-amber-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Received</p>
            <h3 className="text-lg font-bold text-gray-900 mt-0.5">{totalReceivedCount} <span className="text-xs font-normal text-gray-400">units</span></h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Installed / Used</p>
            <h3 className="text-lg font-bold text-gray-900 mt-0.5">{totalUsedCount} <span className="text-xs font-normal text-gray-400">units</span></h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">In Store Balance</p>
            <h3 className="text-lg font-bold text-gray-900 mt-0.5">{totalInStockCount} <span className="text-xs font-normal text-gray-400">units</span></h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Damaged / Scrap</p>
            <h3 className="text-lg font-bold text-gray-900 mt-0.5">{totalScrappedCount} <span className="text-xs font-normal text-gray-400">units</span></h3>
          </div>
        </div>
      </div>

      {/* VERIFICATION QUEUES FOR ADMIN & MANAGER */}
      
      {/* 1. Material Inward Arrivals Verification Queue */}
      {((user.role === 'admin' && ((data.pendingAdminReceipts?.length || 0) > 0 || (data.pendingManagerReceipts?.length || 0) > 0)) ||
        (user.role === 'manager' && (data.pendingManagerReceipts?.length || 0) > 0)) && (
        <div className="bg-gradient-to-r from-amber-50/95 via-blue-50/70 to-emerald-50/60 border-2 border-amber-300 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-gray-900">
              <ShieldCheck className="w-5 h-5 text-amber-600 animate-pulse" />
              <h3 className="font-bold text-sm sm:text-base">
                Inward Material Verification Queue (
                {user.role === 'admin' 
                  ? (data.pendingAdminReceipts?.length || 0) + (data.pendingManagerReceipts?.length || 0)
                  : data.pendingManagerReceipts?.length || 0} Pending)
              </h3>
            </div>
            <span className="text-xs bg-amber-200 text-amber-950 font-bold px-2.5 py-0.5 rounded-full">
              {user.role === 'admin' ? 'Admin Direct Approval / Sign-Off' : 'Tier 1: Manager Verification'}
            </span>
          </div>
          <p className="text-xs text-gray-700">
            {user.role === 'admin'
              ? 'Review inward stock arrivals logged by team members and managers. Inspect Delivery Challan (DC) photos and click Approve to add stock to the live site ledger.'
              : 'Site team members uploaded these Inward Stock Arrivals. Verify quantities & DC stamps before forwarding to Admin for final sign-off.'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ...(data.pendingAdminReceipts || []),
              ...(user.role === 'admin' ? (data.pendingManagerReceipts || []) : (user.role === 'manager' ? (data.pendingManagerReceipts || []) : []))
            ].map(r => (
              <div key={r.id} className="bg-white rounded-lg border border-amber-200/90 p-4 space-y-3 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{r.item_name}</h4>
                    <p className="text-xs text-emerald-700 font-bold mt-0.5">
                      Quantity: +{r.qty_received} {r.item_unit}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Logged by: <span className="font-semibold text-gray-700">{r.receiver_name}</span> · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                    {r.status === 'pending_admin' && (
                      <span className="inline-block text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 mt-1">
                        Manager Verified by {r.manager_name}
                      </span>
                    )}
                    {r.status === 'pending_manager' && (
                      <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1">
                        Awaiting Initial Verification
                      </span>
                    )}
                  </div>
                  {r.challan_number && (
                    <span className="font-mono text-xs bg-amber-100 text-amber-900 font-bold px-2 py-1 rounded shrink-0">
                      DC #{r.challan_number}
                    </span>
                  )}
                </div>

                {r.notes && (
                  <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 italic">
                    "{r.notes}"
                  </p>
                )}

                {r.challan_photo ? (
                  <div 
                    onClick={() => setPreviewImage(r.challan_photo)}
                    className="relative group cursor-pointer bg-gray-100 rounded-lg overflow-hidden h-32 border border-gray-200 flex items-center justify-center"
                  >
                    <img 
                      src={r.challan_photo} 
                      alt="Delivery Challan" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-semibold">
                      <Eye className="w-4 h-4" /> Inspect Delivery Challan
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3 text-center text-xs text-gray-400">
                    No photo attached
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-gray-100 flex-wrap">
                  {user.role === 'admin' ? (
                    <>
                      <button
                        onClick={() => handleVerifyReceipt(r.id, 'admin_approve')}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Final Approve & Add Stock
                      </button>
                      {r.status === 'pending_manager' && (
                        <button
                          onClick={() => handleVerifyReceipt(r.id, 'manager_verify')}
                          className="flex items-center justify-center gap-1 py-1.5 px-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                          title="Verify as manager"
                        >
                          Pass to Tier 2
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleVerifyReceipt(r.id, 'manager_verify')}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Manager Verify ➔ Send to Admin
                    </button>
                  )}
                  <button
                    onClick={() => handleVerifyReceipt(r.id, 'reject')}
                    className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold border border-red-200 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Physical Stock Audit Verification Queue */}
      {data.pendingAudits && data.pendingAudits.length > 0 && (user.role === 'admin' || user.role === 'manager') && (
        <div className="bg-purple-50/90 border-2 border-purple-300 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-purple-900">
              <ShieldAlert className="w-5 h-5 text-purple-600 animate-pulse" />
              <h3 className="font-bold text-sm sm:text-base">
                Physical Stock Audit Verification Queue ({data.pendingAudits.length} Pending)
              </h3>
            </div>
            <span className="text-xs bg-purple-200 text-purple-950 font-bold px-2.5 py-0.5 rounded-full">
              Audit Count Sign-Off
            </span>
          </div>
          <p className="text-xs text-purple-800">
            Physical stock counts submitted on-site requiring management verification and confirmation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.pendingAudits.map(a => (
              <div key={a.id} className="bg-white rounded-lg border border-purple-200 p-4 space-y-3 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{a.item_name}</h4>
                    <p className="text-xs text-purple-900 font-bold mt-0.5">
                      Physical Count: {a.physical_counted_qty} {a.item_unit} (Expected: {a.system_expected_qty} {a.item_unit})
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Audited by: <span className="font-semibold text-gray-700">{a.auditor_name}</span> · {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    a.discrepancy_qty === 0 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : a.discrepancy_qty < 0 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {a.discrepancy_qty === 0 ? 'Matched' : `${a.discrepancy_qty > 0 ? '+' : ''}${a.discrepancy_qty} ${a.item_unit}`}
                  </span>
                </div>

                {a.notes && (
                  <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 italic">
                    "{a.notes}"
                  </p>
                )}

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleVerifyAudit(a.id, 'approve')}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Confirm & Verify Audit
                  </button>
                  <button
                    onClick={() => handleVerifyAudit(a.id, 'reject')}
                    className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold border border-red-200 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Header & Actions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-gray-900">Site Material Ledger & Stock Audit Log</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative group/tip">
              <button
                onClick={() => setShowInwardModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs font-semibold shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> + Log Arrival (Inward)
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:block w-64 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
                Log new incoming material arrivals with Delivery Challan (DC) number & QS Mohar photo.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>

            <div className="relative group/tip">
              <button
                onClick={() => setShowUsageModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-semibold shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> - Log Installed
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:block w-64 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
                Record materials installed or consumed on-site linked to specific tasks and locations.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>

            <div className="relative group/tip">
              <button
                onClick={() => setShowScrapModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-semibold border border-red-200/60"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Log Damage/Scrap
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:block w-64 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
                Log damaged, defective, or scrapped items with damage photo and rejection reason.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>

            <div className="relative group/tip">
              <button
                onClick={() => setShowAuditModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors text-xs font-semibold border border-purple-200"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Store Stock Audit
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:block w-64 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
                Perform physical store room count to reconcile actual shelf stock against system balance.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>

            {user.role === 'admin' && (
              <div className="relative group/tip">
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors text-xs font-semibold border border-amber-200"
                >
                  <Plus className="w-3.5 h-3.5" /> Master Item
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:block w-60 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
                  Add a new material category item to company-wide master inventory catalog.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sub Navigation & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg self-start">
            <div className="relative group/tip">
              <button
                onClick={() => setActiveSubTab('my_submissions')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeSubTab === 'my_submissions' ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                }`}
              >
                📋 My Submissions Tracker ({data.mySubmissions ? data.mySubmissions.length : 0})
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/tip:block w-64 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
                Track status of Delivery Challans logged by you. Fix & resubmit any rejected entries.
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900" />
              </div>
            </div>

            <div className="relative group/tip">
              <button
                onClick={() => setActiveSubTab('balances')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeSubTab === 'balances' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Live Stock Balance
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/tip:block w-64 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
                Real-time available store quantity (Approved Inward - Installed - Scrapped).
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900" />
              </div>
            </div>

            <div className="relative group/tip">
              <button
                onClick={() => setActiveSubTab('anti_theft')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeSubTab === 'anti_theft' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-700 hover:bg-purple-50'
                }`}
              >
                🛡️ Physical Stock Audit
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/tip:block w-72 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
                4-Way Reconciliation comparing system balance against physical store counts to spot shortages & shrinkage.
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900" />
              </div>
            </div>

            <div className="relative group/tip">
              <button
                onClick={() => setActiveSubTab('receipts')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeSubTab === 'receipts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Inward History ({data.receipts.length})
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/tip:block w-64 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
                Complete historical log of all material arrivals, Delivery Challan (DC) #, and verifier sign-offs.
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900" />
              </div>
            </div>

            <div className="relative group/tip">
              <button
                onClick={() => setActiveSubTab('usage')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeSubTab === 'usage' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Installation History ({data.usage.length})
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/tip:block w-64 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
                Log of materials installed/consumed on-site linked to specific tasks & physical locations.
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900" />
              </div>
            </div>

            <div className="relative group/tip">
              <button
                onClick={() => setActiveSubTab('scrap')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeSubTab === 'scrap' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Scrap History ({data.scrap.length})
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/tip:block w-64 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
                Log of damaged, defective, or scrapped materials with damage photos & rejection reasons.
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search material..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Tab 0: My Submissions Tracker */}
        {activeSubTab === 'my_submissions' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-amber-50/50 border-b border-amber-200 text-amber-900 font-semibold uppercase tracking-wider">
                  <th className="p-3">Material</th>
                  <th className="p-3">Qty Received</th>
                  <th className="p-3">Challan #</th>
                  <th className="p-3">Date Logged</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Verification / Rejection Details</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(!data.mySubmissions || data.mySubmissions.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                      You have no pending or rejected material submissions for this project.
                    </td>
                  </tr>
                ) : (
                  data.mySubmissions.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3 font-bold text-gray-900">{r.item_name}</td>
                      <td className="p-3 text-emerald-700 font-bold">+{r.qty_received} {r.item_unit}</td>
                      <td className="p-3 font-mono font-bold text-amber-900">{r.challan_number || 'N/A'}</td>
                      <td className="p-3 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-center">
                        {r.status === 'pending_manager' && (
                          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                            🟡 Pending Manager Verification
                          </span>
                        )}
                        {r.status === 'pending_admin' && (
                          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-900 font-bold text-[10px]">
                            🔵 Pending Admin Approval
                          </span>
                        )}
                        {r.status === 'rejected' && (
                          <span className="px-2 py-1 rounded-full bg-red-100 text-red-900 font-bold text-[10px]">
                            🔴 Rejected by Verifier
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {r.status === 'rejected' ? (
                          <div className="bg-red-50 border border-red-200 rounded p-2 text-red-800 text-[11px]">
                            <span className="font-bold block">Rejection Reason:</span>
                            {r.rejection_reason || 'Incomplete details or illegible stamp'}
                          </div>
                        ) : r.status === 'pending_admin' ? (
                          <span className="text-gray-600 text-[11px]">Verified by Manager. Awaiting Admin sign-off.</span>
                        ) : (
                          <span className="text-gray-500 text-[11px]">Sent to Manager queue for inspection.</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {r.status === 'rejected' && (
                          <button
                            onClick={() => {
                              setResubmitItem(r);
                              setResubmitForm({
                                qty_received: r.qty_received,
                                challan_number: r.challan_number || '',
                                challan_photo: r.challan_photo || '',
                                notes: r.notes || ''
                              });
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[11px] transition-colors"
                          >
                            Fix & Resubmit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 1: Live Stock Balance */}
        {activeSubTab === 'balances' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="p-3">Material / Item</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Received (Inward)</th>
                  <th className="p-3 text-right">Installed (Used)</th>
                  <th className="p-3 text-right">Scrapped</th>
                  <th className="p-3 text-right">Store Balance</th>
                  <th className="p-3 text-center">Status</th>
                  {user.role === 'admin' && <th className="p-3 text-center w-16">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={user.role === 'admin' ? 8 : 7} className="p-8 text-center text-gray-400 italic">
                      No materials found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map(b => (
                    <tr key={b.item_id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3">
                        <p className="font-bold text-gray-900">{b.name}</p>
                        {b.description && <p className="text-[10px] text-gray-400 mt-0.5">{b.description}</p>}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium text-[10px]">
                          {b.category}
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium text-emerald-700 bg-emerald-50/30">{b.total_received} {b.unit}</td>
                      <td className="p-3 text-right font-medium text-blue-700 bg-blue-50/30">{b.total_used} {b.unit}</td>
                      <td className="p-3 text-right font-medium text-red-600">{b.total_scrapped} {b.unit}</td>
                      <td className="p-3 text-right font-bold text-gray-900 text-sm bg-amber-50/30">{b.in_stock} {b.unit}</td>
                      <td className="p-3 text-center">
                        {b.in_stock === 0 && b.total_received === 0 ? (
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-gray-100 text-gray-500">Not Delivered</span>
                        ) : b.in_stock === 0 ? (
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-red-100 text-red-700">Depleted</span>
                        ) : b.in_stock <= 5 ? (
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-100 text-amber-800">Low Stock</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-800">Healthy</span>
                        )}
                      </td>
                      {user.role === 'admin' && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setEditItem({
                                id: b.item_id,
                                name: b.name,
                                category: b.category,
                                unit: b.unit,
                                description: b.description || ''
                              })}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title={`Edit ${b.name}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDeleteItem(b)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title={`Delete ${b.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Inward Receipts History */}
        {activeSubTab === 'receipts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3">Material</th>
                  <th className="p-3 text-right">Qty Received</th>
                  <th className="p-3">Challan / Invoice #</th>
                  <th className="p-3">Received By</th>
                  <th className="p-3">Verification Status</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.receipts.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-gray-400 italic">No inward shipments logged yet.</td></tr>
                ) : (
                  data.receipts.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="p-3 font-semibold text-gray-900">{r.item_name}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">+{r.qty_received} {r.item_unit}</td>
                      <td className="p-3 font-mono text-gray-700 font-bold">{r.challan_number || '-'}</td>
                      <td className="p-3 text-gray-600">{r.receiver_name || 'System'}</td>
                      <td className="p-3">
                        {r.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved
                          </span>
                        ) : r.status === 'pending_admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 animate-pulse">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            Awaiting Admin Approval
                          </span>
                        ) : r.status === 'pending_manager' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                            <ShieldAlert className="w-3 h-3 text-amber-600" />
                            Awaiting Verification
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700" title={r.rejection_reason || ''}>
                            <XCircle className="w-3 h-3 text-red-600" />
                            Rejected {r.rejection_reason ? `(${r.rejection_reason})` : ''}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-500 max-w-xs truncate">{r.notes || '-'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {r.challan_photo && (
                            <button
                              onClick={() => setPreviewImage(r.challan_photo)}
                              className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Inspect Delivery Challan photo"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {user.role === 'admin' && r.status !== 'approved' && (
                            <>
                              <button
                                onClick={() => handleVerifyReceipt(r.id, 'admin_approve')}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded shadow-xs"
                                title="Final Approve and add stock"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleVerifyReceipt(r.id, 'reject')}
                                className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[10px] rounded"
                                title="Reject receipt"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {user.role === 'manager' && r.status === 'pending_manager' && (
                            <>
                              <button
                                onClick={() => handleVerifyReceipt(r.id, 'manager_verify')}
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded shadow-xs"
                                title="Manager verify"
                              >
                                Verify
                              </button>
                              <button
                                onClick={() => handleVerifyReceipt(r.id, 'reject')}
                                className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[10px] rounded"
                                title="Reject receipt"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === 'rejected' && r.received_by === user.id && (
                            <button
                              onClick={() => {
                                setResubmitItem(r);
                                setResubmitForm({
                                  qty_received: r.qty_received,
                                  challan_number: r.challan_number || '',
                                  challan_photo: r.challan_photo || '',
                                  notes: r.notes || ''
                                });
                              }}
                              className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded"
                            >
                              Fix & Resubmit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Installation History */}
        {activeSubTab === 'usage' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3">Material</th>
                  <th className="p-3 text-right">Qty Used</th>
                  <th className="p-3">Location / Floor</th>
                  <th className="p-3">Linked Task</th>
                  <th className="p-3">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.usage.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-gray-400 italic">No installation usage logged yet.</td></tr>
                ) : (
                  data.usage.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="p-3 font-semibold text-gray-900">{u.item_name}</td>
                      <td className="p-3 text-right font-bold text-blue-600">-{u.qty_used} {u.item_unit}</td>
                      <td className="p-3 text-gray-800 font-medium">{u.installed_location || '-'}</td>
                      <td className="p-3 text-gray-600">{u.task_title || '-'}</td>
                      <td className="p-3 text-gray-600">{u.logger_name || 'System'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Scrap History */}
        {activeSubTab === 'scrap' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3">Material</th>
                  <th className="p-3 text-right">Qty Scrapped</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.scrap.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-400 italic">No damaged or scrapped material logged.</td></tr>
                ) : (
                  data.scrap.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="p-3 font-semibold text-gray-900">{s.item_name}</td>
                      <td className="p-3 text-right font-bold text-red-600">-{s.qty_scrapped} {s.item_unit}</td>
                      <td className="p-3 text-gray-700 italic">{s.reason}</td>
                      <td className="p-3 text-gray-600">{s.logger_name || 'System'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4-Way Reconciliation Audit Sub-Tab */}
        {activeSubTab === 'anti_theft' && (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
              <h4 className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-purple-600" />
                4-Way Stock Reconciliation Engine
              </h4>
              <p className="text-[11px] text-purple-800">
                Formula: <span className="font-mono font-bold">Expected Store Balance = Approved DC Received - Installed - Scrapped</span>. 
                Compares system store balance against physical store counts to spot shortages & shrinkage instantly.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                    <th className="p-3">Material</th>
                    <th className="p-3 text-right text-emerald-700 bg-emerald-50/50">Approved Inward (A)</th>
                    <th className="p-3 text-right text-blue-700 bg-blue-50/50">Installed (B)</th>
                    <th className="p-3 text-right text-red-600 bg-red-50/50">Scrapped (C)</th>
                    <th className="p-3 text-right text-amber-900 bg-amber-50">Expected Store (A-B-C)</th>
                    <th className="p-3 text-right text-purple-900 bg-purple-50">Physical Audit (D)</th>
                    <th className="p-3 text-center">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBalances.map(b => {
                    const latest = b.latest_audit;
                    const physicalCount = latest ? latest.physical_counted_qty : null;
                    const discrepancy = physicalCount !== null ? (physicalCount - b.in_stock) : 0;

                    return (
                      <tr key={b.item_id} className="hover:bg-gray-50/80">
                        <td className="p-3 font-bold text-gray-900">{b.name}</td>
                        <td className="p-3 text-right font-medium text-emerald-700 bg-emerald-50/20">{b.total_received} {b.unit}</td>
                        <td className="p-3 text-right font-medium text-blue-700 bg-blue-50/20">{b.total_used} {b.unit}</td>
                        <td className="p-3 text-right font-medium text-red-600 bg-red-50/20">{b.total_scrapped} {b.unit}</td>
                        <td className="p-3 text-right font-bold text-amber-950 bg-amber-50/40">{b.in_stock} {b.unit}</td>
                        <td className="p-3 text-right font-bold text-purple-900 bg-purple-50/40">
                          {physicalCount !== null ? `${physicalCount} ${b.unit}` : <span className="text-gray-400 font-normal">Not Audited</span>}
                        </td>
                        <td className="p-3 text-center">
                          {physicalCount === null ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600">Pending Audit</span>
                          ) : discrepancy === 0 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">🟢 100% Matched</span>
                          ) : discrepancy < 0 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-red-100 text-red-700 animate-pulse">
                              🔴 {Math.abs(discrepancy)} {b.unit} Shortage / Missing
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
                              🔵 +{discrepancy} {b.unit} Surplus
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Audit History Log Table */}
            <div className="mt-6 space-y-2">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Physical Stock Audit History & Verification Log
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                      <th className="p-3">Audit Date</th>
                      <th className="p-3">Material</th>
                      <th className="p-3 text-right">Physical Count</th>
                      <th className="p-3 text-right">System Expected</th>
                      <th className="p-3 text-right">Discrepancy</th>
                      <th className="p-3">Auditor</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Notes</th>
                      {(user.role === 'admin' || user.role === 'manager') && <th className="p-3 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(!data.audits || data.audits.length === 0) ? (
                      <tr><td colSpan={9} className="p-6 text-center text-gray-400 italic">No physical audits logged yet.</td></tr>
                    ) : (
                      data.audits.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-gray-500">{new Date(a.created_at).toLocaleDateString()}</td>
                          <td className="p-3 font-semibold text-gray-900">{a.item_name}</td>
                          <td className="p-3 text-right font-bold text-purple-900">{a.physical_counted_qty} {a.item_unit}</td>
                          <td className="p-3 text-right text-gray-600">{a.system_expected_qty} {a.item_unit}</td>
                          <td className="p-3 text-right font-bold">
                            <span className={a.discrepancy_qty === 0 ? 'text-emerald-700' : a.discrepancy_qty < 0 ? 'text-red-600' : 'text-blue-600'}>
                              {a.discrepancy_qty > 0 ? `+${a.discrepancy_qty}` : a.discrepancy_qty} {a.item_unit}
                            </span>
                          </td>
                          <td className="p-3 text-gray-700">{a.auditor_name || 'System'}</td>
                          <td className="p-3">
                            {a.status === 'verified' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Verified {a.verifier_name ? `by ${a.verifier_name}` : ''}
                              </span>
                            ) : a.status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700" title={a.rejection_reason || ''}>
                                <XCircle className="w-3 h-3 text-red-600" />
                                Rejected {a.rejection_reason ? `(${a.rejection_reason})` : ''}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                                <ShieldAlert className="w-3 h-3 text-amber-600" />
                                Awaiting Verification
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-gray-500 max-w-xs truncate">{a.notes || '-'}</td>
                          {(user.role === 'admin' || user.role === 'manager') && (
                            <td className="p-3 text-center">
                              {a.status === 'pending' && (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleVerifyAudit(a.id, 'approve')}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded shadow-xs"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleVerifyAudit(a.id, 'reject')}
                                    className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[10px] rounded"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Log Inward Material */}
      {showInwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={() => setShowInwardModal(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
              Log Inward Material (Arrival)
            </h3>

            <form onSubmit={handleInwardSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Material *</label>
                <select
                  value={inwardForm.item_id}
                  onChange={e => setInwardForm({ ...inwardForm, item_id: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Choose item from catalog...</option>
                  {data.balances.map(b => (
                    <option key={b.item_id} value={b.item_id}>{b.name} ({b.category})</option>
                  ))}
                </select>
              </div>

                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Quantity Received *</label>
                      <input type="number" step="any" min="0.1" placeholder="e.g. 50" value={inwardForm.qty_received}
                        onChange={e => setInwardForm({ ...inwardForm, qty_received: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg" required />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Challan / Invoice #</label>
                      <input type="text" placeholder="e.g. CH-9042" value={inwardForm.challan_number}
                        onChange={e => setInwardForm({ ...inwardForm, challan_number: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Notes / Supplier</label>
                    <input type="text" placeholder="Optional delivery details" value={inwardForm.notes}
                      onChange={e => setInwardForm({ ...inwardForm, notes: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                </>


              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowInwardModal(false)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700">
                  {busy ? 'Saving...' : 'Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Installation / Usage */}
      {showUsageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={() => setShowUsageModal(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-blue-600" />
              Record Material Installed / Used
            </h3>

            <form onSubmit={handleUsageSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Material *</label>
                <select
                  value={usageForm.item_id}
                  onChange={e => setUsageForm({ ...usageForm, item_id: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Choose item...</option>
                  {data.balances.map(b => (
                    <option key={b.item_id} value={b.item_id}>
                      {b.name} (Available: {b.in_stock} {b.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Quantity Used *</label>
                  <input type="number" step="any" min="0.1" placeholder="e.g. 10" value={usageForm.qty_used}
                    onChange={e => setUsageForm({ ...usageForm, qty_used: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Location / Floor</label>
                  <input type="text" placeholder="e.g. Floor 3, Flat 302" value={usageForm.installed_location}
                    onChange={e => setUsageForm({ ...usageForm, installed_location: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
              </div>

              {tasks && tasks.length > 0 && (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Link to Task</label>
                  <select value={usageForm.task_id} onChange={e => setUsageForm({ ...usageForm, task_id: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg">
                    <option value="">General Project Use (No Task)</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowUsageModal(false)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                  {busy ? 'Deducting...' : 'Record Usage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Scrap/Damage */}
      {showScrapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={() => setShowScrapModal(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Report Material Scrap / Damage
            </h3>

            <form onSubmit={handleScrapSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Damaged Item *</label>
                <select
                  value={scrapForm.item_id}
                  onChange={e => setScrapForm({ ...scrapForm, item_id: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Choose item...</option>
                  {data.balances.map(b => (
                    <option key={b.item_id} value={b.item_id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Quantity Scrapped *</label>
                <input type="number" step="any" min="0.1" placeholder="e.g. 2" value={scrapForm.qty_scrapped}
                  onChange={e => setScrapForm({ ...scrapForm, qty_scrapped: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg" required />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Reason for Damage / Scrap *</label>
                <textarea rows={2} placeholder="e.g. Broken base during installation on Floor 2"
                  value={scrapForm.reason} onChange={e => setScrapForm({ ...scrapForm, reason: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg" required />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowScrapModal(false)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">
                  {busy ? 'Reporting...' : 'Log Damage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Store Physical Audit */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={() => setShowAuditModal(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-purple-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-purple-600" />
              Perform Physical Store Stock Audit
            </h3>

            <form onSubmit={handleAuditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Material to Audit *</label>
                <select
                  value={auditForm.item_id}
                  onChange={e => setAuditForm({ ...auditForm, item_id: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Choose item...</option>
                  {data.balances.map(b => (
                    <option key={b.item_id} value={b.item_id}>
                      {b.name} (Expected Store Balance: {b.in_stock} {b.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Actual Physical Counted Quantity *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 15"
                  value={auditForm.physical_counted_qty}
                  onChange={e => setAuditForm({ ...auditForm, physical_counted_qty: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg font-bold text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Audit Notes / Location Checked</label>
                <input
                  type="text"
                  placeholder="e.g. Verified by Storekeeper in Shelf B2"
                  value={auditForm.notes}
                  onChange={e => setAuditForm({ ...auditForm, notes: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowAuditModal(false)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-1.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700">
                  {busy ? 'Saving...' : 'Record Stock Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Master Catalog Item (Admin Only) */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={() => setShowAddItemModal(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              Add Item to Master Catalog
            </h3>

            <form onSubmit={handleAddItemSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Material Name *</label>
                <input
                  type="text"
                  placeholder="e.g. 4-Core FRLS Cable"
                  value={itemForm.name}
                  onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={itemForm.category}
                    onChange={e => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Panels">Panels</option>
                    <option value="Detectors">Detectors</option>
                    <option value="Modules">Modules</option>
                    <option value="Notifiers">Notifiers</option>
                    <option value="Cabling">Cabling</option>
                    <option value="Accessories">Accessories</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Unit of Measurement</label>
                  <input
                    type="text"
                    placeholder="pcs, meters, sets, boxes"
                    value={itemForm.unit}
                    onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Technical specification or details"
                  value={itemForm.description}
                  onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowAddItemModal(false)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-1.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700">
                  {busy ? 'Saving...' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Master Catalog Item (Admin Only) */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={() => setEditItem(null)}>
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              Edit Material / Item
            </h3>

            <form onSubmit={handleEditItemSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Material Name *</label>
                <input
                  type="text"
                  placeholder="e.g. 4-Core FRLS Cable"
                  value={editItem.name}
                  onChange={e => setEditItem({ ...editItem, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={editItem.category}
                    onChange={e => setEditItem({ ...editItem, category: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Panels">Panels</option>
                    <option value="Detectors">Detectors</option>
                    <option value="Modules">Modules</option>
                    <option value="Notifiers">Notifiers</option>
                    <option value="Cabling">Cabling</option>
                    <option value="Accessories">Accessories</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Unit of Measurement</label>
                  <input
                    type="text"
                    placeholder="pcs, meters, sets, boxes"
                    value={editItem.unit}
                    onChange={e => setEditItem({ ...editItem, unit: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Technical specification or details"
                  value={editItem.description}
                  onChange={e => setEditItem({ ...editItem, description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setEditItem(null)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                  {busy ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Fix & Resubmit Rejected Submission */}
      {resubmitItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-amber-200">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Fix & Resubmit: {resubmitItem.item_name}</h3>
              <button onClick={() => setResubmitItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-900">
              <p className="font-bold">Original Rejection Reason:</p>
              <p className="mt-0.5">{resubmitItem.rejection_reason || 'Incomplete stamp or invalid entry'}</p>
            </div>

            <form onSubmit={handleResubmitSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Quantity Received</label>
                <input
                  type="number"
                  step="0.01"
                  value={resubmitForm.qty_received}
                  onChange={e => setResubmitForm({ ...resubmitForm, qty_received: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Delivery Challan (DC) #</label>
                <input
                  type="text"
                  value={resubmitForm.challan_number}
                  onChange={e => setResubmitForm({ ...resubmitForm, challan_number: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Updated Photo URL / QS Stamp Image</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={resubmitForm.challan_photo}
                  onChange={e => setResubmitForm({ ...resubmitForm, challan_photo: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Notes / Clarifications</label>
                <textarea
                  value={resubmitForm.notes}
                  onChange={e => setResubmitForm({ ...resubmitForm, notes: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setResubmitItem(null)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-1.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700">
                  {busy ? 'Resubmitting...' : 'Resubmit for Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
