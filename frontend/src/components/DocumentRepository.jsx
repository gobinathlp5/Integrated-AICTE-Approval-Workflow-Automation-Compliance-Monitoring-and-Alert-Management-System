import React, { useState, useEffect } from 'react';
import { 
  Folder, FileText, Search, Filter, Upload, Download, Eye, 
  Clock, AlertTriangle, CheckCircle2, Shield, Lock, Plus, RefreshCw, X
} from 'lucide-react';
import { documentApi } from '../api';
import DocumentDetailModal from './DocumentDetailModal';

const VIRTUAL_FOLDERS = [
  { id: 'ALL', label: 'All Collections', icon: Folder },
  { id: 'INSTITUTION', label: 'Institution Folders', icon: Folder },
  { id: 'APPLICATION', label: 'Application Folders', icon: Folder },
  { id: 'UNDERTAKING', label: 'Statutory Undertakings', icon: Folder },
  { id: 'COMPLIANCE', label: 'Compliance Dossiers', icon: Folder },
  { id: 'RENEWAL', label: 'Renewal Affidavits', icon: Folder },
  { id: 'COMMITTEE_INSPECTION', label: 'Committee & Inspections', icon: Folder },
];

export default function DocumentRepository({ user }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expiryFilter, setExpiryFilter] = useState('ALL');

  // Selected document for detailed modal
  const [activeDocId, setActiveDocId] = useState(null);

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    documentCategory: 'LAND',
    folderCategory: 'APPLICATION',
    confidentialityClassification: 'INSTITUTION_VISIBLE',
    expiryDate: '',
    retentionStatus: 'ACTIVE',
    file: null
  });

  useEffect(() => {
    loadDocuments();
  }, [selectedFolder, categoryFilter, statusFilter, expiryFilter]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedFolder !== 'ALL') params.folder = selectedFolder;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (expiryFilter !== 'ALL') params.expiryStatus = expiryFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await documentApi.list(params);
      setDocuments(res.documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadDocuments();
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) {
      alert('Please select a file to upload.');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('title', uploadForm.title);
      formData.append('documentCategory', uploadForm.documentCategory);
      formData.append('folderCategory', uploadForm.folderCategory);
      formData.append('confidentialityClassification', uploadForm.confidentialityClassification);
      formData.append('retentionStatus', uploadForm.retentionStatus);
      if (uploadForm.expiryDate) {
        formData.append('expiryDate', uploadForm.expiryDate);
      }

      await documentApi.upload(formData);
      alert('Document uploaded successfully.');
      setUploadOpen(false);
      setUploadForm({
        title: '',
        documentCategory: 'LAND',
        folderCategory: 'APPLICATION',
        confidentialityClassification: 'INSTITUTION_VISIBLE',
        expiryDate: '',
        retentionStatus: 'ACTIVE',
        file: null
      });
      loadDocuments();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const canUpload = user.role !== 'AUDITOR';

  return (
    <div className="space-y-6">
      
      {/* Top Bar with Title & Upload CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-900" />
            <span>AICTE Document Repository & Access Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Independent access-control metadata, virtual folders, confidentiality tagging & expiry monitoring
          </p>
        </div>

        {canUpload && (
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center space-x-1.5 bg-blue-900 hover:bg-blue-950 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Statutory Document</span>
          </button>
        )}
      </div>

      {/* Virtual Folders Carousel / Selector (Section F) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 px-1">
          Virtual Repository Folders (Section F)
        </span>
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {VIRTUAL_FOLDERS.map((folder) => {
            const Icon = folder.icon;
            const isSelected = selectedFolder === folder.id;
            return (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-blue-900'}`} />
                <span>{folder.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by title, file name, or registration number..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
            />
          </div>
          <button
            type="submit"
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
          
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Document Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-1.5 bg-slate-50 font-medium"
            >
              <option value="ALL">All Categories</option>
              <option value="LAND">Land Ownership</option>
              <option value="BUILDING">Building Sanction</option>
              <option value="FINANCIAL">Financial Audit</option>
              <option value="FACULTY">Faculty List</option>
              <option value="COMPLIANCE">Compliance Dossiers</option>
              <option value="EVC_REPORT">EVC Inspection Reports</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Verification Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-1.5 bg-slate-50 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="VERIFIED">Verified</option>
              <option value="RETURNED_FOR_CORRECTION">Returned for Correction</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Expiry Monitoring
            </label>
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-1.5 bg-slate-50 font-medium"
            >
              <option value="ALL">All Expiry States</option>
              <option value="ACTIVE">Active / Valid</option>
              <option value="EXPIRING_SOON">Expiring Soon (≤ 90 Days)</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedFolder('ALL');
                setCategoryFilter('ALL');
                setStatusFilter('ALL');
                setExpiryFilter('ALL');
                setSearchQuery('');
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded-lg text-xs font-semibold transition"
            >
              Reset Filters
            </button>
          </div>

        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-900" />
            <span>Filtering documents by RBAC matrix & tenant isolation...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Shield className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-xs font-bold text-slate-700">No Documents Visible</h4>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Either no files exist in this folder or your current role ({user.role}) is restricted from viewing these confidentiality classifications.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Document Title & Number</th>
                  <th className="py-3 px-4">Institution</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Expiry Monitoring</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{doc.title}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-blue-900 font-semibold">{doc.document_number}</span>
                        <span>•</span>
                        <span className="font-bold bg-slate-100 text-slate-700 px-1 rounded text-[10px]">v{doc.document_version}</span>
                        <span>•</span>
                        <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 truncate max-w-[160px]">{doc.institution_name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{doc.institution_id}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        {doc.document_category}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        doc.confidentiality_classification === 'INSTITUTION_VISIBLE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        doc.confidentiality_classification === 'INTERNAL_AICTE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        doc.confidentiality_classification === 'COMMITTEE_RESTRICTED' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {doc.confidentiality_classification.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        doc.verification_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                        doc.verification_status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {doc.verification_status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {doc.computed_expiry_status === 'NO_EXPIRY' ? (
                        <span className="text-[11px] text-slate-400">No Expiry</span>
                      ) : doc.computed_expiry_status === 'EXPIRED' ? (
                        <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-max">
                          <AlertTriangle className="w-3 h-3" /> Expired
                        </span>
                      ) : doc.computed_expiry_status === 'EXPIRING_SOON' ? (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-max">
                          <Clock className="w-3 h-3" /> In {doc.days_until_expiry} Days
                        </span>
                      ) : (
                        <span className="text-emerald-700 text-[11px] font-semibold">
                          Valid ({doc.expiry_date})
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setActiveDocId(doc.id)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer"
                      >
                        Inspect & Actions
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Document Detail Modal */}
      {activeDocId && (
        <DocumentDetailModal
          docId={activeDocId}
          user={user}
          onClose={() => setActiveDocId(null)}
          onRefresh={loadDocuments}
        />
      )}

      {/* Upload Modal (Section C & F) */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Upload New Statutory Document</span>
              </h3>
              <button
                onClick={() => setUploadOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="e.g. Master Plan Approval Letter 2026"
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Document Category</label>
                  <select
                    value={uploadForm.documentCategory}
                    onChange={(e) => setUploadForm({ ...uploadForm, documentCategory: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    <option value="LAND">Land Ownership</option>
                    <option value="BUILDING">Building Sanction</option>
                    <option value="FINANCIAL">Financial Audit</option>
                    <option value="FACULTY">Faculty Register</option>
                    <option value="AFFIDAVIT">Statutory Affidavit</option>
                    <option value="UNDERTAKING">Compliance Undertaking</option>
                    <option value="EVC_REPORT">EVC Inspection Dossier</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Virtual Folder</label>
                  <select
                    value={uploadForm.folderCategory}
                    onChange={(e) => setUploadForm({ ...uploadForm, folderCategory: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    <option value="APPLICATION">Application Folder</option>
                    <option value="INSTITUTION">Institution Folder</option>
                    <option value="UNDERTAKING">Statutory Undertaking</option>
                    <option value="COMPLIANCE">Compliance Collection</option>
                    <option value="RENEWAL">Renewal Folder</option>
                    <option value="COMMITTEE_INSPECTION">Committee & Inspection</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Confidentiality Classification</label>
                <select
                  value={uploadForm.confidentialityClassification}
                  onChange={(e) => setUploadForm({ ...uploadForm, confidentialityClassification: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value="INSTITUTION_VISIBLE">Institution-Visible</option>
                  <option value="INTERNAL_AICTE">Internal AICTE Only (Hidden from Institution)</option>
                  <option value="COMMITTEE_RESTRICTED">Committee-Restricted (EVC Only)</option>
                  <option value="HIGHLY_RESTRICTED">Highly Restricted (Competent Authority / Vigilance)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={uploadForm.expiryDate}
                    onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-1.5"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Retention Policy</label>
                  <select
                    value={uploadForm.retentionStatus}
                    onChange={(e) => setUploadForm({ ...uploadForm, retentionStatus: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="HOLD">LEGAL HOLD</option>
                    <option value="PURGE_PROTECTED">PURGE PROTECTED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select File (PDF, DOCX, etc.)</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                  className="w-full text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-900 file:text-white hover:file:bg-blue-950"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-lg transition disabled:opacity-50"
                >
                  {uploadLoading ? 'Uploading & Hashing...' : 'Upload & Register in Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
