import { useState, useEffect } from 'react';
import { 
  FileText, Upload, CheckCircle2, XCircle, AlertCircle, Eye, Trash2, 
  ShieldCheck, Clock, FileCheck, Layers, ExternalLink, Image as ImageIcon, 
  Search, Edit3, Send, AlertTriangle, ArrowRight, Check, X
} from 'lucide-react';
import { api } from '../lib/api';

export const DOCUMENT_CATEGORIES = [
  { id: 'ra_bills', label: 'RA bills' },
  { id: 'work_order', label: 'Work Order' },
  { id: 'amendments', label: 'Amendments' },
  { id: 'installation_docs', label: 'Installation documents' },
  { id: 'drawings', label: 'Drawings' },
  { id: 'purchase_invoice', label: 'Purchase invoice' },
  { id: 'testing_commissioning', label: 'Testing and commissioning documents' },
];

export const getCategoryLabel = (docType) => {
  const found = DOCUMENT_CATEGORIES.find(c => c.id === docType);
  if (found) return found.label;
  const legacy = {
    dc_stamped: 'Stamped DCs',
    quality_report: 'Quality & Test',
    safety_permit: 'Safety Permits',
    handover_sheet: 'Handovers',
    general: 'General Document'
  };
  return legacy[docType] || docType?.replace(/_/g, ' ') || 'Document';
};

export default function ProjectSiteDocuments({ project, user, onVerificationDone }) {
  const [documents, setDocuments] = useState([]);
  const [pendingManagerDocs, setPendingManagerDocs] = useState([]);
  const [pendingAdminDocs, setPendingAdminDocs] = useState([]);
  const [myDocs, setMyDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTypeFilter, setActiveTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [rejectingDoc, setRejectingDoc] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  // Upload Form State
  const [uploadForm, setUploadForm] = useState({ doc_type: 'ra_bills', title: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [busy, setBusy] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({ doc_type: 'ra_bills', title: '' });
  const [editFile, setEditFile] = useState(null);
  const [submittingDocId, setSubmittingDocId] = useState(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const res = await api.getProjectDocuments(project.id);
      if (res && res.documents) {
        setDocuments(res.documents || []);
        setPendingManagerDocs(res.pendingManagerDocs || []);
        setPendingAdminDocs(res.pendingAdminDocs || []);
        setMyDocs(res.myDocs || (res.allDocs ? res.allDocs.filter(d => d.uploaded_by === user?.id) : []));
      } else if (Array.isArray(res)) {
        setDocuments(res.filter(d => d.status === 'active'));
        setPendingManagerDocs(res.filter(d => d.status === 'pending_manager'));
        setPendingAdminDocs(res.filter(d => d.status === 'pending_admin'));
        setMyDocs(res.filter(d => d.uploaded_by === user?.id));
      }
    } catch (err) {
      console.error('Error loading project documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [project.id]);

  // Handle Document Upload
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('doc_type', uploadForm.doc_type);
      formData.append('title', uploadForm.title || selectedFile.name);

      await api.uploadProjectDocument(project.id, formData);
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadForm({ doc_type: 'ra_bills', title: '' });
      await loadDocuments();
      if (onVerificationDone) onVerificationDone();
    } catch (err) {
      alert(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  // Open Edit/Modify Modal
  const openEditModal = (doc) => {
    setEditingDoc(doc);
    setEditForm({
      doc_type: doc.doc_type || 'ra_bills',
      title: doc.title || ''
    });
    setEditFile(null);
  };

  // Save Modifications
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingDoc) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('title', editForm.title);
      formData.append('doc_type', editForm.doc_type);
      if (editFile) {
        formData.append('file', editFile);
      }

      await api.updateProjectDocument(project.id, editingDoc.id, formData);
      setEditingDoc(null);
      setEditFile(null);
      await loadDocuments();
      if (onVerificationDone) onVerificationDone();
    } catch (err) {
      alert(err.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  // Submit Draft / Rejected Document for Level 1 Manager Verification
  const handleSubmitForVerification = async (docId) => {
    if (!confirm('Submit this document for Level 1 Manager Verification?')) return;
    setSubmittingDocId(docId);
    try {
      await api.submitProjectDocument(project.id, docId);
      await loadDocuments();
      if (onVerificationDone) onVerificationDone();
    } catch (err) {
      alert(err.message || 'Failed to submit document');
    } finally {
      setSubmittingDocId(null);
    }
  };

  // 2-Level Verification (Level 1: Manager -> Level 2: Admin)
  const handleVerifyDoc = async (docId, action) => {
    if (action === 'reject') {
      const doc = [...pendingManagerDocs, ...pendingAdminDocs, ...documents].find(d => d.id === docId);
      setRejectingDoc(doc || { id: docId });
      setRejectionReason('');
      return;
    }

    const label = action === 'manager_verify' 
      ? 'Level 1 Manager Verification (Forward to Admin for Final Sign-off)' 
      : 'Level 2 Final Admin Approval & Add to Vault';
    if (!confirm(`Are you sure you want to proceed with: ${label}?`)) return;

    try {
      await api.verifyProjectDocument(project.id, docId, action, '');
      if (onVerificationDone) onVerificationDone();
      await loadDocuments();
    } catch (err) {
      alert(err.message || 'Verification action failed');
    }
  };

  // Confirm Rejection with Reason
  const handleConfirmRejection = async (e) => {
    e.preventDefault();
    if (!rejectingDoc) return;
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason explaining what needs correction.');
      return;
    }

    setBusy(true);
    try {
      await api.verifyProjectDocument(project.id, rejectingDoc.id, 'reject', rejectionReason.trim());
      setRejectingDoc(null);
      setRejectionReason('');
      if (onVerificationDone) onVerificationDone();
      await loadDocuments();
    } catch (err) {
      alert(err.message || 'Failed to reject document');
    } finally {
      setBusy(false);
    }
  };

  // Delete Draft Document
  const handleDeleteDoc = async (docId, isDraft = false) => {
    const msg = isDraft 
      ? 'Delete this draft document? This cannot be undone.' 
      : 'Are you sure you want to archive this document from the vault?';
    if (!confirm(msg)) return;

    try {
      await api.deleteProjectDocument(project.id, docId);
      await loadDocuments();
      if (onVerificationDone) onVerificationDone();
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  };

  // Filter vault documents
  const filteredVaultDocs = documents.filter(d => {
    const matchesType = activeTypeFilter === 'all' || d.doc_type === activeTypeFilter;
    const matchesSearch = (d.title || '').toLowerCase().includes(search.toLowerCase()) || 
                          (d.file_name || '').toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* ── SECTION 1: EMPLOYEE "MY UPLOADS & SUBMISSION PIPELINE" ── */}
      {myDocs.length > 0 && (
        <div className="bg-white border-2 border-amber-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-gray-900 flex items-center gap-2">
                  My Uploaded Documents & Verification Status
                  <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    {myDocs.length} Total
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Review your uploads, modify title, category or files, and submit for 2-Level verification (Manager ➔ Admin).
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload New Document
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {myDocs.map(doc => {
              const isDraft = doc.status === 'draft';
              const isPendingMgr = doc.status === 'pending_manager';
              const isPendingAdm = doc.status === 'pending_admin';
              const isRejected = doc.status === 'rejected';
              const isActive = doc.status === 'active';

              return (
                <div 
                  key={`mydoc-${doc.id}`}
                  className={`bg-white rounded-xl border p-3.5 space-y-3 transition-all ${
                    isDraft 
                      ? 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/20' 
                      : isRejected 
                      ? 'border-rose-300 ring-2 ring-rose-400/20 bg-rose-50/20' 
                      : isPendingMgr 
                      ? 'border-blue-200 bg-blue-50/15'
                      : isPendingAdm
                      ? 'border-purple-200 bg-purple-50/15'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[10px] uppercase font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                          {getCategoryLabel(doc.doc_type)}
                        </span>
                        
                        {isDraft && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" /> Draft (Not Submitted)
                          </span>
                        )}
                        {isPendingMgr && (
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" /> Level 1: In Manager Review
                          </span>
                        )}
                        {isPendingAdm && (
                          <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 text-purple-600" /> Level 2: In Admin Final Sign-Off
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-rose-600" /> Needs Revision / Rejected
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified in Vault
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-2" title={doc.title}>
                        {doc.title}
                      </h4>
                    </div>

                    <FileText className={`w-5 h-5 shrink-0 ${
                      isDraft ? 'text-amber-500' : isRejected ? 'text-rose-500' : 'text-gray-400'
                    }`} />
                  </div>

                  {/* Rejection Alert Message */}
                  {isRejected && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-700">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Rejection Reason:
                      </div>
                      <p className="text-xs italic pl-5">
                        "{doc.rejection_reason || 'Requires corrections before approval.'}"
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline truncate max-w-[180px]"
                      title={doc.file_name}
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {doc.file_name || 'View File'}
                    </a>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Action Buttons for Employee */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    {(isDraft || isRejected || isPendingMgr) && (
                      <button
                        onClick={() => openEditModal(doc)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="Edit title, category, or replace file"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-gray-600" />
                        Modify
                      </button>
                    )}

                    {(isDraft || isRejected) && (
                      <button
                        onClick={() => handleSubmitForVerification(doc.id)}
                        disabled={submittingDocId === doc.id}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {submittingDocId === doc.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        {isRejected ? 'Resubmit' : 'Submit for Verification'}
                      </button>
                    )}

                    {isDraft && (
                      <button
                        onClick={() => handleDeleteDoc(doc.id, true)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 2: TIER 1 MANAGER VERIFICATION QUEUE (Level 1) ── */}
      {pendingManagerDocs.length > 0 && (user?.role === 'manager' || user?.role === 'admin') && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-900">
              <ShieldCheck className="w-5 h-5 text-amber-600 animate-pulse shrink-0" />
              <h3 className="font-bold text-sm sm:text-base">
                Tier 1: Manager Document Verification Queue ({pendingManagerDocs.length} Pending)
              </h3>
            </div>
            <span className="text-xs bg-amber-200 text-amber-950 font-bold px-2.5 py-0.5 rounded-full">
              Level 1: Manager Verification Step
            </span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Site employees submitted these documents. Verify details before passing to Admin for Level 2 final sign-off.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingManagerDocs.map(d => (
              <div key={`pending-mgr-${d.id}`} className="bg-white rounded-lg border border-amber-200 p-4 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mb-1 inline-block">
                      Level 1 Verification
                    </span>
                    <h4 className="font-bold text-gray-900 text-sm">{d.title}</h4>
                    <p className="text-xs text-gray-600 font-semibold mt-0.5">
                      Category: {getCategoryLabel(d.doc_type)}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Uploaded by: <span className="font-semibold text-gray-800">{d.uploader_name}</span> · {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <FileText className="w-6 h-6 text-amber-600 shrink-0" />
                </div>

                <a 
                  href={d.file_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 text-xs font-semibold text-blue-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" /> Inspect Uploaded Document ({d.file_name})
                </a>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleVerifyDoc(d.id, 'manager_verify')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Manager Verify ➔ Pass to Admin
                  </button>
                  <button
                    onClick={() => handleVerifyDoc(d.id, 'reject')}
                    className="px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 3: TIER 2 ADMIN FINAL APPROVAL QUEUE (Level 2) ── */}
      {pendingAdminDocs.length > 0 && user?.role === 'admin' && (
        <div className="bg-blue-50/90 border-2 border-blue-300 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-blue-900">
              <ShieldCheck className="w-5 h-5 text-blue-600 animate-pulse shrink-0" />
              <h3 className="font-bold text-sm sm:text-base">
                Tier 2: Admin Final Document Approval Queue ({pendingAdminDocs.length} Pending)
              </h3>
            </div>
            <span className="text-xs bg-blue-200 text-blue-950 font-bold px-2.5 py-0.5 rounded-full">
              Level 2: Final Admin Authorization
            </span>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed">
            These documents have passed Level 1 Manager Verification. Click Final Approve to permanently activate them in the vault.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingAdminDocs.map(d => (
              <div key={`pending-adm-${d.id}`} className="bg-white rounded-lg border border-blue-200 p-4 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mb-1 inline-block">
                      Level 2 Final Authorization
                    </span>
                    <h4 className="font-bold text-gray-900 text-sm">{d.title}</h4>
                    <p className="text-xs text-gray-600 font-semibold mt-0.5">
                      Category: {getCategoryLabel(d.doc_type)}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Uploaded by: <span className="font-semibold text-gray-800">{d.uploader_name}</span> · Manager Verified: <span className="font-semibold text-blue-700">{d.manager_name || 'Manager'}</span>
                    </p>
                  </div>
                  <FileText className="w-6 h-6 text-blue-600 shrink-0" />
                </div>

                <a 
                  href={d.file_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 text-xs font-semibold text-blue-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" /> Inspect Uploaded Document ({d.file_name})
                </a>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleVerifyDoc(d.id, 'admin_approve')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Final Approve Document
                  </button>
                  <button
                    onClick={() => handleVerifyDoc(d.id, 'reject')}
                    className="px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 4: DOCUMENT VAULT (7 CATEGORIES TABS) ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-base font-bold text-gray-900">Project Site Document Vault</h2>
              <p className="text-xs text-gray-500">
                Verified RA bills, Work Orders, Amendments, Drawings, Invoices, and Commissioning Docs
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-sm text-xs font-semibold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            + Upload Site Document
          </button>
        </div>

        {/* 7 Requested Category Tabs + All Docs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 bg-gray-100 p-1.5 rounded-xl">
            <button
              onClick={() => setActiveTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTypeFilter === 'all' 
                  ? 'bg-white text-gray-900 shadow-2xs font-bold' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All Docs ({documents.length})
            </button>

            {DOCUMENT_CATEGORIES.map(tab => {
              const count = documents.filter(d => d.doc_type === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTypeFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTypeFilter === tab.id 
                      ? 'bg-white text-gray-900 shadow-2xs font-bold' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {tab.label} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          <div className="relative sm:w-56">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Vault Document Cards Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-amber-600 rounded-full" />
          </div>
        ) : filteredVaultDocs.length === 0 ? (
          <div className="text-center py-12 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 space-y-2">
            <FileText className="w-8 h-8 text-gray-400 mx-auto stroke-1" />
            <p className="text-xs text-gray-500 font-medium">No verified documents found in this category.</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-xs text-amber-600 hover:underline font-semibold cursor-pointer"
            >
              Upload document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {filteredVaultDocs.map(doc => (
              <div key={doc.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-gray-900 text-xs truncate" title={doc.title}>{doc.title}</h4>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded inline-block mt-0.5">
                        {getCategoryLabel(doc.doc_type)}
                      </span>
                    </div>
                  </div>

                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                      title="Archive document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-gray-500 space-y-1 pt-1 border-t border-gray-100">
                  <p>Uploaded by: <span className="font-medium text-gray-700">{doc.uploader_name || 'System'}</span></p>
                  {doc.manager_name && (
                    <p>Manager Verified: <span className="font-medium text-blue-700">{doc.manager_name}</span></p>
                  )}
                  {doc.admin_name && (
                    <p>Admin Approved: <span className="font-medium text-emerald-700">{doc.admin_name}</span></p>
                  )}
                  <p>Date: {new Date(doc.created_at).toLocaleDateString()}</p>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View / Download
                  </a>
                  {doc.file_size > 0 && (
                    <span className="text-[10px] text-gray-400 font-medium">
                      {(doc.file_size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL 1: UPLOAD DOCUMENT ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-600" />
                Upload Project Document
              </h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFileUpload} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Document Category *</label>
                <select
                  value={uploadForm.doc_type}
                  onChange={e => setUploadForm({ ...uploadForm, doc_type: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500"
                  required
                >
                  {DOCUMENT_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  placeholder="e.g. RA Bill #04 - HVAC Piping & Panels"
                  value={uploadForm.title}
                  onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select File (PDF or Image) *</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => setSelectedFile(e.target.files[0])}
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs cursor-pointer"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 space-y-1">
                <p className="font-semibold">Workflow Notice:</p>
                <p>
                  {user?.role === 'admin' 
                    ? 'Uploaded as Admin: Document will be immediately active and verified.' 
                    : user?.role === 'manager' 
                    ? 'Uploaded as Manager: Document will be forwarded to Admin for final approval.' 
                    : 'Uploaded as Employee: Document will be saved as Draft. You can review and modify it, then click "Submit for Verification" when ready.'}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowUploadModal(false)} 
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={busy} 
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {busy ? 'Uploading...' : user?.role === 'admin' ? 'Upload to Vault' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EDIT / MODIFY DOCUMENT ── */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs" onClick={() => setEditingDoc(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-600" />
                Modify Uploaded Document
              </h3>
              <button 
                onClick={() => setEditingDoc(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Document Category *</label>
                <select
                  value={editForm.doc_type}
                  onChange={e => setEditForm({ ...editForm, doc_type: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500"
                  required
                >
                  {DOCUMENT_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Replace File (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => setEditFile(e.target.files[0])}
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs cursor-pointer"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Current file: <span className="font-semibold text-gray-600">{editingDoc.file_name}</span>. Leave empty to keep existing file.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditingDoc(null)} 
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={busy} 
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save Modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: REJECTION REASON PROMPT ── */}
      {rejectingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs" onClick={() => setRejectingDoc(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 text-rose-700">
                <XCircle className="w-5 h-5 text-rose-600" />
                Reject Document & Request Revisions
              </h3>
              <button 
                onClick={() => setRejectingDoc(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRejection} className="space-y-3.5 text-xs">
              <p className="text-gray-600">
                Provide a clear reason for rejecting <strong className="text-gray-800">"{rejectingDoc.title}"</strong>. The uploader will see this note and will be able to modify and resubmit.
              </p>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Rejection Reason / Required Corrections *
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="e.g. Page 2 is blurry, missing client sign-off, or incorrect work order number..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setRejectingDoc(null)} 
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={busy || !rejectionReason.trim()} 
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {busy ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: FULL SCREEN IMAGE PREVIEW ── */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-xl p-2 overflow-hidden" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-gray-900/80 text-white rounded-full hover:bg-black"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <img src={previewImage} alt="Document Inspection" className="w-full max-h-[85vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
