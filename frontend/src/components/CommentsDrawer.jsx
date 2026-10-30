import React, { useState, useEffect } from 'react';
import { 
  Lock, MessageSquare, Send, CheckCircle2, ShieldAlert, 
  Eye, EyeOff, User, RefreshCw, AlertTriangle, Share2 
} from 'lucide-react';
import { commentApi } from '../api';

const CHANNELS = [
  { id: 'ALL', label: 'All Visible Channels' },
  { id: 'INSTITUTION_VISIBLE', label: 'Institution-Visible Remarks', badge: 'bg-emerald-100 text-emerald-800' },
  { id: 'INTERNAL_AICTE', label: 'Internal AICTE Notes (Protected)', badge: 'bg-blue-100 text-blue-800' },
  { id: 'COMMITTEE_RESTRICTED', label: 'Committee Observations (EVC)', badge: 'bg-purple-100 text-purple-800' },
  { id: 'COMPETENT_AUTHORITY', label: 'Competent Authority Remarks', badge: 'bg-amber-100 text-amber-800' }
];

export default function CommentsDrawer({ user }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState('ALL');
  const [newCommentText, setNewCommentText] = useState('');
  const [targetChannel, setTargetChannel] = useState('INSTITUTION_VISIBLE');
  const [submitting, setSubmitting] = useState(false);

  const isInstitutionUser = user.role === 'INSTITUTION_ADMIN' || user.role === 'INSTITUTION_STAFF';

  useEffect(() => {
    loadComments();
  }, [selectedChannel]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const res = await commentApi.list();
      setComments(res.comments || []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    setSubmitting(true);
    try {
      await commentApi.create({
        channel: targetChannel,
        commentText: newCommentText.trim(),
        institutionId: user.institution_id || 'inst_delhi_001',
        applicationId: 'app_2026_del_01'
      });
      setNewCommentText('');
      loadComments();
    } catch (err) {
      alert('Failed to post remark: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to release this internal remark to the Institution portal?')) return;
    try {
      await commentApi.release(commentId);
      alert('Internal note has been released to the Institution portal.');
      loadComments();
    } catch (err) {
      alert('Release prohibited: ' + err.message);
    }
  };

  // Channel filter for display
  const filteredComments = selectedChannel === 'ALL'
    ? comments
    : comments.filter(c => c.channel === selectedChannel);

  return (
    <div className="space-y-6">
      
      {/* Title & Banner */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-900" />
          <span>Multi-Channel Communication & Scrutiny Notes</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Strict separation of Institution remarks, internal AICTE deliberations, EVC observations, and appellate notes
        </p>
      </div>

      {/* Security Privacy Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start space-x-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Channel Isolation Architecture (Section E):</span>{' '}
          Internal AICTE notes and committee observations are completely isolated and never exposed to the institution portal unless an authorized officer explicitly performs a verified release.
          {isInstitutionUser && (
            <span className="block mt-1 font-semibold text-emerald-800">
              Active Session Notice: You are authenticated as an Institution user. Internal deliberations remain hidden from your view.
            </span>
          )}
        </div>
      </div>

      {/* Channel Filters */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        {CHANNELS.map(ch => (
          <button
            key={ch.id}
            onClick={() => setSelectedChannel(ch.id)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap cursor-pointer ${
              selectedChannel === ch.id
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* Grid: Comments List + New Comment Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Comments Stream */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200 flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-900" />
              <span>Applying Channel Filtering Matrix...</span>
            </div>
          ) : filteredComments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
              No remarks found in this channel for your access scope.
            </div>
          ) : (
            filteredComments.map((cmt) => {
              const isInternal = cmt.channel === 'INTERNAL_AICTE';
              const isReleased = cmt.is_released_to_institution === 1;
              const canRelease = !isInstitutionUser && !isReleased;

              return (
                <div
                  key={cmt.id}
                  className={`p-4 rounded-xl border transition bg-white shadow-xs ${
                    isInternal ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 text-xs font-bold">
                        {cmt.author_name ? cmt.author_name.charAt(0) : 'U'}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900">{cmt.author_name}</span>
                        <span className="text-[10px] text-slate-500 ml-1.5 font-mono">({cmt.author_role})</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        cmt.channel === 'INSTITUTION_VISIBLE' ? 'bg-emerald-100 text-emerald-800' :
                        cmt.channel === 'INTERNAL_AICTE' ? 'bg-blue-100 text-blue-800' :
                        cmt.channel === 'COMMITTEE_RESTRICTED' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {cmt.channel.replace(/_/g, ' ')}
                      </span>

                      {isReleased ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Eye className="w-3 h-3" /> Released to Inst.
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Internal Only
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap pl-9">
                    {cmt.comment_text}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-100 pl-9 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Posted at: {cmt.created_at}</span>

                    {/* Explicit Release Button (Section E) */}
                    {canRelease && (
                      <button
                        onClick={() => handleReleaseComment(cmt.id)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-1 rounded text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>Explicitly Release to Institution</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Col: Post New Remark */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs h-fit space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-blue-900" />
            <span>Post New Communication Note</span>
          </h3>

          <form onSubmit={handlePostComment} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Communication Channel</label>
              <select
                value={targetChannel}
                onChange={(e) => setTargetChannel(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
              >
                <option value="INSTITUTION_VISIBLE">🌐 Institution-Visible Remarks</option>
                {!isInstitutionUser && (
                  <>
                    <option value="INTERNAL_AICTE">🔒 Internal AICTE Scrutiny Note</option>
                    <option value="COMMITTEE_RESTRICTED">👥 EVC Committee Restricted Note</option>
                    <option value="COMPETENT_AUTHORITY">⚖️ Competent Authority Observation</option>
                  </>
                )}
              </select>
              {isInstitutionUser && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Institution accounts can strictly post to Institution-Visible channel.
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Remark / Evaluation Text</label>
              <textarea
                required
                rows={4}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Enter official remarks, compliance observations, or scrutiny findings..."
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-900 hover:bg-blue-950 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Transmitting...' : 'Post to Channel'}</span>
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
