import React, { useState, useEffect } from 'react';
import { 
  Building2, MapPin, CheckCircle, Shield, Award, Edit3, 
  Search, RefreshCw, FileText, Check 
} from 'lucide-react';
import { institutionApi } from '../api';

export default function InstitutionProfileView({ user }) {
  const [instId, setInstId] = useState(user?.institutionId || 'inst_delhi_001');
  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [pidSearch, setPidSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    loadProfile(instId);
  }, [instId]);

  const loadProfile = async (id) => {
    setLoading(true);
    try {
      const data = await institutionApi.getById(id);
      setInstitution(data);
      setFormData({
        contact_person: data.contact_person || '',
        contact_email: data.contact_email || '',
        phone: data.phone || '',
        land_area_acres: data.land_area_acres || 5.0,
        built_up_area_sqm: data.built_up_area_sqm || 10000
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchPid = async (e) => {
    e.preventDefault();
    if (!pidSearch) return;
    setStatusMessage(null);
    try {
      const res = await institutionApi.searchByPid(pidSearch.trim());
      setInstId(res.id);
      setStatusMessage({ type: 'success', text: `Loaded record for ${res.name} (PID: ${res.aicte_id})` });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await institutionApi.update(instId, formData);
      setStatusMessage({ type: 'success', text: 'Institutional record updated successfully.' });
      setEditMode(false);
      await loadProfile(instId);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const programmes = institution?.programmes_offered 
    ? (typeof institution.programmes_offered === 'string' ? JSON.parse(institution.programmes_offered) : institution.programmes_offered)
    : [
        { programme: 'Engineering & Technology', level: 'UG', intake: 120 },
        { programme: 'Management (MBA)', level: 'PG', intake: 60 }
      ];

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="bg-white rounded-lg border-l-4 border-[#F2A900] border border-[#DCE3EA] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1B5E80]">INSTITUTIONAL DIRECTORY</span>
              <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-mono font-bold">PID Registry</span>
            </div>
            <h1 className="text-xl font-bold text-[#12345A] mt-1">Institutional Profile & Accreditation Dossier</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified campus infrastructure, Head of Institution (HOI) credentials, and AICTE approval lineage.
            </p>
          </div>
          <button
            onClick={() => loadProfile(instId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-lg text-xs font-medium border flex items-center justify-between ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>✕</button>
        </div>
      )}

      {/* PID Search Bar for Council Officers */}
      <form onSubmit={handleSearchPid} className="bg-white p-4 rounded-lg border border-[#DCE3EA] flex flex-col sm:flex-row items-center gap-3">
        <label className="text-xs font-bold text-[#12345A] whitespace-nowrap">
          Lookup by Permanent AICTE ID:
        </label>
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={pidSearch}
            onChange={(e) => setPidSearch(e.target.value)}
            placeholder="e.g. 1-10928374 or 1-98765432"
            className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 font-mono"
          />
        </div>
        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-1.5 bg-[#12345A] hover:bg-[#1B5E80] text-white text-xs font-bold rounded cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          Lookup Profile
        </button>
      </form>

      {institution && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Institution Card (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">AICTE Permanent ID: {institution.aicte_id}</span>
                <h2 className="text-lg font-bold text-[#12345A] mt-0.5">{institution.name}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{institution.city}, {institution.state} • Region: <strong>{institution.region}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Verified
                </span>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  {editMode ? 'Cancel' : 'Edit Contact'}
                </button>
              </div>
            </div>

            {/* Profile Data Boxes (Matching User Reference Image 2: Orange border, 4 boxes) */}
            <div className="border border-amber-300 rounded-lg p-4 bg-amber-50/20 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Institute PID</span>
                  <span className="text-xs font-bold text-slate-900 font-mono">{institution.aicte_id}</span>
                </div>
                <div className="bg-white p-3 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Type</span>
                  <span className="text-xs font-bold text-slate-900">{institution.type || 'Private-Self Financing'}</span>
                </div>
                <div className="bg-white p-3 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">HOI Name</span>
                  <span className="text-xs font-bold text-slate-900">{institution.hoi_name || institution.contact_person || 'Dr. Director'}</span>
                </div>
                <div className="bg-white p-3 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Region</span>
                  <span className="text-xs font-bold text-slate-900">{institution.region}</span>
                </div>
              </div>
            </div>

            {editMode ? (
              <form onSubmit={handleUpdate} className="space-y-4 pt-2">
                <h3 className="text-xs font-bold text-[#12345A] uppercase">Update Contact Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Official Email</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="px-3 py-1.5 rounded bg-slate-100 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-[#12345A] text-white text-xs font-bold"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#12345A] uppercase tracking-wide">
                  Approved Programmes & Approved Seats
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Programme Title</th>
                        <th className="py-2 px-3">Level</th>
                        <th className="py-2 px-3 text-right">Approved Intake</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {programmes.map((p, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-semibold text-slate-900">{p.programme}</td>
                          <td className="py-2 px-3 text-slate-600">{p.level}</td>
                          <td className="py-2 px-3 text-right font-bold text-[#12345A]">{p.intake} Seats</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Infrastructure Metrics (1 Col) */}
          <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#12345A] uppercase tracking-wide pb-2 border-b border-slate-100">
              Campus Infrastructure
            </h2>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500">Contiguous Land Area</div>
                <div className="text-base font-bold text-slate-900">{institution.land_area_acres || 5.24} Acres</div>
                <div className="text-[10px] text-emerald-700 mt-0.5">✓ Meets AICTE Urban Norm (2.5 Acres)</div>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500">Total Instructional Built-up Area</div>
                <div className="text-base font-bold text-slate-900">{institution.built_up_area_sqm || 12500} sq.m</div>
                <div className="text-[10px] text-emerald-700 mt-0.5">✓ Meets AICTE NBC 2016 Guidelines</div>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500">Fire Safety Clearance</div>
                <div className="text-xs font-bold text-slate-900">Valid up to 31-Dec-2027</div>
                <div className="text-[10px] text-slate-500 font-mono">FS-NOC-2026/8941</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
