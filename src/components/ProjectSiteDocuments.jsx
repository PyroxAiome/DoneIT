import { useState, useEffect } from 'react';
import { 
  FileText, Upload, CheckCircle2, XCircle, AlertCircle, Eye, Trash2, 
  ShieldCheck, Clock, FileCheck, Layers, ExternalLink, Image as ImageIcon, Search
} from 'lucide-react';
import { api } from '../lib/api';

export default function ProjectSiteDocuments({ project, user, pendingManagerReceipts = [], pendingAdminReceipts = [], onVerificationDone }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTypeFilter, setActiveTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null); // URL for full screen modal

  // Upload Form
  const [uploadForm, setUploadForm] = useState({ doc_type: 'dc_stamped', title: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const [pendingManagerDocs, setPendingManagerDocs] = useState([]);
  const [pendingAdminDocs, setPendingAdminDocs] = useState([]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const res = await api.getProjectDocuments(project.id);
      if (res && res.documents) {
        setDocuments(res.documents);
        setPendingManagerDocs(res.pendingManagerDocs || []);
        setPendingAdminDocs(res.pendingAdminDocs || []);
      } else {
        setDocuments(res || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [project.id]);

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
      if (onVerificationDone) onVerificationDone();
      loadDocuments();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVerifyDoc = async (docId, action) => {
    let rejectionReason = '';
    if (action === 'reject') {
      rejectionReason = prompt('Please enter the reason for rejecting this site document:');
      if (!rejectionReason) return;
    } else {
      const label = action === 'manager_verify' ? 'Manager Verification (Pass to Admin)' : 'FINAL ADMIN APPROVAL';
      if (!confirm(`Are you sure you want to proceed with: ${label}?`)) return;
    }

    try {
      await api.verifyProjectDocument(project.id, docId, action, rejectionReason);
      if (onVerificationDone) onVerificationDone();
      loadDocuments();
    } catch (err) {
      alert(err.message);
    }
  };

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
      setUploadForm({ doc_type: 'dc_stamped', title: '' });
      loadDocuments();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!confirm('Are you sure you want to archive this document?')) return;
    try {
      await api.deleteProjectDocument(project.id, docId);
      loadDocuments();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredDocs = documents.filter(d => {
    const matchesType = activeTypeFilter === 'all' || d.doc_type === activeTypeFilter;
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) || 
                          d.file_name.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* TIER 1: Manager Verification Queue (Documents ONLY) */}
      {pendingManagerDocs.length > 0 && user.role === 'manager' && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900">
              <ShieldCheck className="w-5 h-5 text-amber-600 animate-pulse" />
              <h3 className="font-bold text-sm sm:text-base">
                Tier 1: Manager Document Verification Queue ({pendingManagerDocs.length} Pending)
              </h3>
            </div>
            <span className="text-xs bg-amber-200 text-amber-950 font-bold px-2.5 py-0.5 rounded-full">
              Manager Verification Step
            </span>
          </div>
          <p className="text-xs text-amber-800">
            Site Managers / QS uploaded these site documents & reports. Verify documents before sending to Admin for final sign-off.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingManagerDocs.map(d => (
              <div key={`doc-${d.id}`} className="bg-white rounded-lg border border-amber-200 p-4 space-y-3 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mb-1 inline-block">Uploaded Document</span>
                    <h4 className="font-bold text-gray-900 text-sm">{d.title}</h4>
                    <p className="text-xs text-gray-600 font-medium mt-0.5 capitalize">
                      Category: {d.doc_type.replace('_', ' ')}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Uploaded by: <span className="font-semibold text-gray-700">{d.uploader_name}</span> · {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <FileText className="w-6 h-6 text-amber-600" />
                </div>

                <a 
                  href={d.file_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 text-xs font-semibold text-blue-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Inspect Uploaded Document File ({d.file_name})
                </a>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleVerifyDoc(d.id, 'manager_verify')}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Manager Verify ➔ Send to Admin
                  </button>
                  <button
                    onClick={() => handleVerifyDoc(d.id, 'reject')}
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

      {/* TIER 2: Admin Final Approval Queue (Documents ONLY) */}
      {pendingAdminDocs.length > 0 && user.role === 'admin' && (
        <div className="bg-blue-50/90 border-2 border-blue-300 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-900">
              <ShieldCheck className="w-5 h-5 text-blue-600 animate-pulse" />
              <h3 className="font-bold text-sm sm:text-base">
                Tier 2: Admin Final Document Approval Queue ({pendingAdminDocs.length} Pending)
              </h3>
            </div>
            <span className="text-xs bg-blue-200 text-blue-950 font-bold px-2.5 py-0.5 rounded-full">
              Final Admin Authorization
            </span>
          </div>
          <p className="text-xs text-blue-800">
            These Site Documents have been verified by Manager ({pendingAdminDocs[0]?.manager_name || 'Manager'}). Click Final Approve to activate in the document vault.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingAdminDocs.map(d => (
              <div key={`doc-${d.id}`} className="bg-white rounded-lg border border-blue-200 p-4 space-y-3 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mb-1 inline-block">Uploaded Document</span>
                    <h4 className="font-bold text-gray-900 text-sm">{d.title}</h4>
                    <p className="text-xs text-gray-600 font-medium mt-0.5 capitalize">
                      Category: {d.doc_type.replace('_', ' ')}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Manager Verified by: <span className="font-semibold text-blue-700">{d.manager_name}</span> · {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>

                <a 
                  href={d.file_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 text-xs font-semibold text-blue-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Inspect Uploaded Document File ({d.file_name})
                </a>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleVerifyDoc(d.id, 'admin_approve')}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Final Approve Document
                  </button>
                  <button
                    onClick={() => handleVerifyDoc(d.id, 'reject')}
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

      {/* SECTION 2: Document Vault Header & Actions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-base font-bold text-gray-900">Project Site Document Vault</h2>
              <p className="text-xs text-gray-500">Store & verify Delivery Challans, Quality Reports, and Safety Permits on AWS Lightsail</p>
            </div>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-sm text-xs font-semibold"
          >
            <Upload className="w-4 h-4" />
            + Upload Site Document
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
            {[
              { id: 'all', label: 'All Docs' },
              { id: 'dc_stamped', label: 'Stamped DCs' },
              { id: 'quality_report', label: 'Quality & Test' },
              { id: 'safety_permit', label: 'Safety Permits' },
              { id: 'handover_sheet', label: 'Handovers' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTypeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTypeFilter === tab.id ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
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

        {/* Document Cards Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-amber-600 rounded-full" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-12 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 space-y-2">
            <FileText className="w-8 h-8 text-gray-400 mx-auto stroke-1" />
            <p className="text-xs text-gray-500 font-medium">No site documents found in vault.</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-xs text-amber-600 hover:underline font-semibold"
            >
              Upload first document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {filteredDocs.map(doc => (
              <div key={doc.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-900 text-xs truncate" title={doc.title}>{doc.title}</h4>
                      <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        {doc.doc_type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {(user.role === 'admin' || user.role === 'manager') && (
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-gray-100 transition-colors"
                      title="Archive document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-gray-500 space-y-0.5 pt-1 border-t border-gray-100">
                  <p>Uploaded by: <span className="font-medium text-gray-700">{doc.uploader_name || 'System'}</span></p>
                  <p>Date: {new Date(doc.created_at).toLocaleDateString()}</p>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View / Download
                  </a>
                  {doc.file_size > 0 && (
                    <span className="text-[10px] text-gray-400">
                      {(doc.file_size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-600" />
              Upload Site Document to AWS Lightsail
            </h3>

            <form onSubmit={handleFileUpload} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Document Category *</label>
                <select
                  value={uploadForm.doc_type}
                  onChange={e => setUploadForm({ ...uploadForm, doc_type: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="dc_stamped">Delivery Challan (QS Stamped Mohar)</option>
                  <option value="quality_report">Quality / Test Report</option>
                  <option value="safety_permit">Safety / Height Work Permit</option>
                  <option value="handover_sheet">Floor Handover Certificate</option>
                  <option value="general">General Site Document</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Delivery Challan #CH-9042 with QS Stamp"
                  value={uploadForm.title}
                  onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select File (Photo or PDF) *</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => setSelectedFile(e.target.files[0])}
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowUploadModal(false)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-1.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700">
                  {busy ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-screen Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-xl p-2 overflow-hidden" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-gray-900/80 text-white rounded-full hover:bg-black"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <img src={previewImage} alt="QS Stamp Mohar Inspection" className="w-full max-h-[85vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
