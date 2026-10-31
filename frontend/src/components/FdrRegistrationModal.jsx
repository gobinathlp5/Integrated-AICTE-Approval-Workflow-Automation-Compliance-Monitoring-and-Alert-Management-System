import React, { useState } from 'react';
import {
  X, Check, AlertCircle, Upload, Shield, Landmark, Calendar,
  DollarSign, FileText, ArrowRight, ArrowLeft
} from 'lucide-react';
import { fdrApi } from '../api';

const BANKS_LIST = [
  'State Bank of India',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Bank of India',
  'Indian Bank',
  'Central Bank of India',
  'HDFC Bank Ltd',
  'ICICI Bank Ltd',
  'Axis Bank Ltd',
  'Kotak Mahindra Bank'
];

const PURPOSES = [
  { value: 'NEW_INSTITUTION', label: 'Establishment of New Technical Institute' },
  { value: 'NEW_PROGRAMME', label: 'Introduction of New Technical Programme (UG/PG)' },
  { value: 'ADDITIONAL_INTAKE', label: 'Increase in Approved Student Intake' },
  { value: 'LAND_NORMS', label: 'Security Deposit in lieu of Land / Built-up Norms' },
  { value: 'REGULATORY_SECURITY', label: 'Mandatory AICTE Regulatory Security Deposit' },
  { value: 'OTHER', label: 'Other Statutory Compliance Deposit' }
];

export default function FdrRegistrationModal({ isOpen, onClose, onSuccess, user }) {
  if (!isOpen) return null;

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fdr_number: '',
    issuing_bank: 'State Bank of India',
    bank_branch: '',
    ifsc_code: '',
    bank_ref: '',
    deposit_amount: '',
    issue_date: '',
    maturity_date: '',
    interest_rate: '7.1',
    auto_renewal: false,
    deposit_holder: '',
    joint_holder_name: 'Regional Officer, AICTE',
    beneficiary: 'Member Secretary, AICTE',
    lien_marked: true,
    lien_ref: '',
    purpose: 'NEW_INSTITUTION',
    remarks: ''
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateStep1 = () => {
    if (!formData.fdr_number.trim()) return 'FDR Receipt Number is required.';
    if (!formData.issuing_bank.trim()) return 'Issuing Bank is required.';
    if (!formData.bank_branch.trim()) return 'Bank Branch is required.';
    if (!formData.ifsc_code.trim()) return 'IFSC Code is required.';
    if (!formData.deposit_amount || Number(formData.deposit_amount) <= 0) return 'Deposit amount must be a positive number.';
    if (!formData.issue_date) return 'Issue Date is required.';
    if (!formData.maturity_date) return 'Maturity Date is required.';
    if (new Date(formData.maturity_date) <= new Date(formData.issue_date)) {
      return 'Maturity Date must be strictly after Issue Date.';
    }
    return null;
  };

  const handleNext = (e) => {
    e.preventDefault();
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleSubmit = async (submitForVerification = true) => {
    setError(null);
    setIsSubmitting(true);
    try {
      // 1. Create FDR record
      const payload = {
        ...formData,
        deposit_amount: Number(formData.deposit_amount),
        interest_rate: formData.interest_rate ? Number(formData.interest_rate) : null,
        auto_renewal: formData.auto_renewal ? 1 : 0,
        lien_marked: formData.lien_marked ? 1 : 0,
        status: submitForVerification && selectedFile ? 'PENDING_VERIFICATION' : 'DRAFT'
      };

      const res = await fdrApi.create(payload);
      const fdrId = res.data?.id;

      // 2. Upload document if attached
      if (fdrId && selectedFile) {
        const fileData = new FormData();
        fileData.append('file', selectedFile);
        fileData.append('document_type', 'FDR_SCAN');
        await fdrApi.uploadDocument(fdrId, fileData);

        if (submitForVerification) {
          await fdrApi.submit(fdrId);
        }
      }

      onSuccess && onSuccess(fdrId);
      onClose();
    } catch (err) {
      console.error('Error submitting FDR registration:', err);
      setError(err.message || 'Failed to register FDR deposit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#12345A] to-[#1B5E80] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Landmark className="w-5 h-5 text-[#F2A900]" />
            </div>
            <div>
              <h3 className="text-base font-bold font-serif">Register Statutory Security Deposit / FDR</h3>
              <p className="text-xs text-slate-200">AICTE Approval Process Handbook (APH) Statutory Custody</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Header */}
        <div className="flex items-center justify-between px-8 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold">
          <div className={`flex items-center gap-2 ${step === 1 ? 'text-[#12345A] font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 1 ? 'bg-[#12345A] text-white' : 'bg-slate-200 text-slate-600'}`}>
              1
            </span>
            <span>Instrument Particulars</span>
          </div>

          <div className="h-0.5 w-16 bg-slate-200" />

          <div className={`flex items-center gap-2 ${step === 2 ? 'text-[#12345A] font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 2 ? 'bg-[#12345A] text-white' : 'bg-slate-200 text-slate-600'}`}>
              2
            </span>
            <span>Lien Mandate & Scan Upload</span>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Form Content */}
        <div className="p-6">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    FDR / Receipt Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fdr_number"
                    value={formData.fdr_number}
                    onChange={handleChange}
                    placeholder="e.g. FDR-2026-SBI-98421"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Issuing Scheduled Bank <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="issuing_bank"
                    value={formData.issuing_bank}
                    onChange={handleChange}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none bg-white"
                  >
                    {BANKS_LIST.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Branch Name & City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="bank_branch"
                    value={formData.bank_branch}
                    onChange={handleChange}
                    placeholder="e.g. Connaught Place, New Delhi"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bank IFSC Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="ifsc_code"
                    value={formData.ifsc_code}
                    onChange={handleChange}
                    placeholder="e.g. SBIN0000691"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none font-mono uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deposit Amount (INR ₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="deposit_amount"
                    value={formData.deposit_amount}
                    onChange={handleChange}
                    placeholder="e.g. 3500000"
                    min="1000"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Issue Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="issue_date"
                    value={formData.issue_date}
                    onChange={handleChange}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Maturity Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="maturity_date"
                    value={formData.maturity_date}
                    onChange={handleChange}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bank Account / Customer Ref No.
                  </label>
                  <input
                    type="text"
                    name="bank_ref"
                    value={formData.bank_ref}
                    onChange={handleChange}
                    placeholder="e.g. SBI/FDR/2026/A-9921"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Interest Rate (% p.a.)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    name="interest_rate"
                    value={formData.interest_rate}
                    onChange={handleChange}
                    placeholder="e.g. 7.1"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="auto_renewal"
                  name="auto_renewal"
                  checked={formData.auto_renewal}
                  onChange={handleChange}
                  className="rounded text-[#12345A] focus:ring-[#12345A]"
                />
                <label htmlFor="auto_renewal" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Bank has registered auto-renewal clause upon maturity
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Purpose of Security Deposit <span className="text-red-500">*</span>
                </label>
                <select
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none bg-white"
                >
                  {PURPOSES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deposit Holder (Trust / Society Name)
                  </label>
                  <input
                    type="text"
                    name="deposit_holder"
                    value={formData.deposit_holder}
                    onChange={handleChange}
                    placeholder="e.g. Delhi Educational Foundation Trust"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Joint Operation Holder (Statutory)
                  </label>
                  <input
                    type="text"
                    name="joint_holder_name"
                    value={formData.joint_holder_name}
                    onChange={handleChange}
                    className="w-full text-xs p-2.5 border border-slate-200 bg-slate-50 text-slate-600 rounded-lg focus:outline-none cursor-not-allowed"
                    readOnly
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-700" />
                  <span>Mandatory Statutory AICTE Lien Endorsement</span>
                </div>
                <p className="text-[11px] text-blue-700">
                  Fixed Deposit Receipt must be held in joint name with Regional Officer, AICTE,
                  with exclusive lien marked in favor of Member Secretary, AICTE.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="lien_marked"
                    name="lien_marked"
                    checked={formData.lien_marked}
                    onChange={handleChange}
                    className="rounded text-blue-700"
                  />
                  <label htmlFor="lien_marked" className="font-semibold text-xs text-blue-950 cursor-pointer">
                    I confirm the issuing bank has marked official statutory lien in favor of AICTE
                  </label>
                </div>
              </div>

              {/* File Upload Box */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Upload Scanned FDR Receipt & Lien Letter (PDF)
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-[#12345A] rounded-xl p-4 text-center cursor-pointer transition">
                  <input
                    type="file"
                    id="fdr_file_upload"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                    className="hidden"
                  />
                  <label htmlFor="fdr_file_upload" className="cursor-pointer">
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    {selectedFile ? (
                      <div>
                        <span className="text-xs font-bold text-[#12345A]">{selectedFile.name}</span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {(selectedFile.size / 1024).toFixed(1)} KB • Click to change
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-semibold text-slate-700">Click to upload FDR scan file</span>
                        <div className="text-[10px] text-slate-400 mt-0.5">PDF or high-resolution scan (max 25 MB)</div>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Additional Remarks / Statutory Notes
                </label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  rows={2}
                  placeholder="e.g. Original physical receipt deposited with Regional Office under Acknowledgement #9921"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12345A]/20 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>

            {step === 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 text-xs font-bold text-white bg-[#12345A] hover:bg-[#1B5E80] rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#12345A] hover:bg-[#1B5E80] rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-[#F2A900]" />
                  <span>{isSubmitting ? 'Registering...' : 'Submit for Verification'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
