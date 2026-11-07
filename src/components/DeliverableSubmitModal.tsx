'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Send, Github, Globe, FileText, CheckCircle2, 
  AlertTriangle, Sparkles, ExternalLink, RefreshCw, CreditCard, Edit3, Info
} from 'lucide-react';

interface DeliverableSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderTitle: string;
  buyerName: string;
  orderAmount: number;
  providerPaypalEmail?: string;
  currentDeliverable?: {
    repoUrl?: string;
    liveDemoUrl?: string;
    summaryNotes?: string;
    testInstructions?: string;
    version?: number;
    paypalEmail?: string;
    submittedAt?: string;
  };
  previousIssues?: string[];
  revisionNotes?: string;
  onSuccess: (deliverable: any) => void;
  onUpdatePaypalEmail?: (email: string) => void;
}

export default function DeliverableSubmitModal({
  isOpen,
  onClose,
  orderId,
  orderTitle,
  buyerName,
  orderAmount,
  providerPaypalEmail,
  currentDeliverable,
  previousIssues,
  revisionNotes,
  onSuccess,
  onUpdatePaypalEmail
}: DeliverableSubmitModalProps) {
  const [repoUrl, setRepoUrl] = useState(currentDeliverable?.repoUrl || '');
  const [liveDemoUrl, setLiveDemoUrl] = useState(currentDeliverable?.liveDemoUrl || '');
  const [summaryNotes, setSummaryNotes] = useState(currentDeliverable?.summaryNotes || '');
  const [testInstructions, setTestInstructions] = useState(
    currentDeliverable?.testInstructions || 'Clone repository, run `npm install` and `npm run dev` to launch locally.'
  );
  const [paypalEmail, setPaypalEmail] = useState(
    providerPaypalEmail || currentDeliverable?.paypalEmail || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize form state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setRepoUrl(currentDeliverable?.repoUrl || '');
      setLiveDemoUrl(currentDeliverable?.liveDemoUrl || '');
      setSummaryNotes(currentDeliverable?.summaryNotes || '');
      setTestInstructions(
        currentDeliverable?.testInstructions || 'Clone repository, run `npm install` and `npm run dev` to launch locally.'
      );
      setPaypalEmail(providerPaypalEmail || currentDeliverable?.paypalEmail || '');
      setErrorMsg(null);
    }
  }, [isOpen, orderId, currentDeliverable, providerPaypalEmail]);

  if (!isOpen) return null;

  const isEditing = Boolean(currentDeliverable && (currentDeliverable.repoUrl || currentDeliverable.liveDemoUrl || currentDeliverable.summaryNotes));
  const isRevision = Boolean((previousIssues && previousIssues.length > 0) || (revisionNotes && revisionNotes.trim().length > 0));
  const currentVersion = currentDeliverable?.version || 1;
  const nextVersion = isEditing || isRevision ? currentVersion + 1 : 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paypalEmail.trim() || !paypalEmail.includes('@')) {
      setErrorMsg('⚠️ Verified PayPal Payout Email is required so client milestone escrow releases can be paid to you.');
      return;
    }

    if (!repoUrl.trim() && !liveDemoUrl.trim() && !summaryNotes.trim()) {
      setErrorMsg('Please provide a GitHub repo URL, live demo link, or summary walkthrough.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/orders/submit-deliverable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          repoUrl,
          liveDemoUrl,
          summaryNotes,
          testInstructions,
          paypalEmail: paypalEmail.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onUpdatePaypalEmail?.(paypalEmail.trim());
        onSuccess(data.deliverable);
        onClose();
      } else {
        setErrorMsg(data.error || 'Failed to submit deliverable');
      }
    } catch (err: any) {
      setErrorMsg(`Network error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-zinc-950 shadow-md ${
              isRevision 
                ? 'bg-gradient-to-tr from-amber-400 to-yellow-500' 
                : isEditing
                ? 'bg-gradient-to-tr from-emerald-400 to-cyan-500'
                : 'bg-gradient-to-tr from-cyan-400 to-blue-500'
            }`}>
              {isRevision ? <RefreshCw className="h-5 w-5" /> : isEditing ? <Edit3 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {isRevision 
                    ? `Re-Submit Deliverable Revision (v${nextVersion})` 
                    : isEditing 
                    ? `Edit & Update Deliverable (v${nextVersion})` 
                    : 'Submit Milestone Deliverable'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono border ${
                  isRevision
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : isEditing
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-semibold'
                    : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                }`}>
                  {isRevision ? 'Revision Required' : isEditing ? `Editing Submission v${currentVersion}` : 'AI Judge Audit Ready'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                For Client <strong className="text-white">{buyerName}</strong> • Escrow Value: <strong className="text-emerald-400">${orderAmount} USD</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
          
          {/* Currently Submitted Live Deliverable Info Alert */}
          {isEditing && !isRevision && (
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-2 text-cyan-300 font-bold">
                <Info className="h-4 w-4 shrink-0 text-cyan-400" />
                <span>Currently Live Submission (Version {currentVersion})</span>
              </div>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                You have already submitted this deliverable. You can edit or refine any links, test instructions, or notes below. Saving will update the deliverable to version <strong className="text-cyan-300">v{nextVersion}</strong> for client and AI auditor inspection.
              </p>
            </div>
          )}

          {/* Previous Revision Feedback Alert */}
          {isRevision && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 border border-amber-500/40 text-xs space-y-2.5 animate-fadeIn">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Client &amp; AI Auditor Revision Notice</span>
              </div>

              {revisionNotes && (
                <div className="p-3 rounded-xl bg-zinc-950/80 border border-amber-500/30 text-zinc-200">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-1">
                    Client Punch-List &amp; Specific Request:
                  </span>
                  <p className="whitespace-pre-line text-xs font-mono text-zinc-300">{revisionNotes}</p>
                </div>
              )}

              {previousIssues && previousIssues.length > 0 && (
                <div className="space-y-1">
                  <p className="text-zinc-300 text-[11px] font-semibold">
                    Specific Code / Functional Issues Flagged:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-amber-200 text-[11px] font-mono bg-zinc-950/60 p-2.5 rounded-xl border border-amber-500/20">
                    {previousIssues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Project Scope Context Banner */}
          <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-xs flex items-center justify-between">
            <span className="text-zinc-400">Contract Scope: <strong className="text-zinc-200">{orderTitle}</strong></span>
            <span className="text-zinc-500 font-mono text-[10px]">Order: #{orderId.substring(0, 14)}</span>
          </div>

          {/* Mandatory PayPal Payout Routing Section */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-emerald-400" />
                <span>Specialist PayPal Payout Email (Required)</span>
                <span className="text-[10px] text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                Direct PayPal Disbursement
              </span>
            </div>
            <input
              type="email"
              required
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              placeholder="e.g. specialist-payout@paypal-sandbox.com"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 transition-all placeholder-zinc-500"
            />
            <p className="text-[10.5px] text-zinc-400 leading-relaxed">
              When the client audits and clicks <strong>&quot;Approve &amp; Release&quot;</strong>, PayPal Orders v2 / Payouts will disburse this contract&apos;s escrow funds directly to this PayPal address.
            </p>
          </div>

          {/* Field 1: GitHub Repository / PR URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Github className="h-4 w-4 text-cyan-400" />
              <span>GitHub Repository or Pull Request URL</span>
              <span className="text-[10px] text-zinc-500 font-normal">(Public repository recommended for automated code ingestion)</span>
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="e.g. https://github.com/my-username/saas-dashboard"
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 transition-all placeholder-zinc-500"
            />
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Our Autonomous AI Auditor will ingest <code className="text-cyan-400">package.json</code>, components, and source code files directly via GitHub API to verify against RFP specifications.
            </p>
          </div>

          {/* Field 2: Live Demo / Figma / Deployment URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-emerald-400" />
              <span>Live Website / Deployment Preview URL (Optional)</span>
            </label>
            <input
              type="url"
              value={liveDemoUrl}
              onChange={(e) => setLiveDemoUrl(e.target.value)}
              placeholder="e.g. https://my-project-production.vercel.app or Figma prototype link"
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 transition-all placeholder-zinc-500"
            />
          </div>

          {/* Field 3: Deliverable Walkthrough & Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-amber-400" />
              <span>Deliverable Walkthrough & Architectural Summary</span>
              <span className="text-[10px] text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={summaryNotes}
              onChange={(e) => setSummaryNotes(e.target.value)}
              placeholder="Describe what was built, key components implemented, responsiveness, technologies used, and how it satisfies the client's milestone contract..."
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-400 transition-all placeholder-zinc-500 resize-none leading-relaxed"
            />
          </div>

          {/* Field 4: Test & Setup Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <span>Testing & Setup Instructions</span>
            </label>
            <input
              type="text"
              value={testInstructions}
              onChange={(e) => setTestInstructions(e.target.value)}
              placeholder="e.g. npm install && npm run dev (Visit localhost:3000)"
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 transition-all placeholder-zinc-500"
            />
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-semibold text-xs border border-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting & Transmitting...</span>
                </>
              ) : (
                <>
                  {isEditing ? <Edit3 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                  <span>
                    {isRevision 
                      ? `Submit Revision (v${nextVersion})` 
                      : isEditing 
                      ? `Save & Update Deliverable (v${nextVersion})` 
                      : 'Submit Milestone Deliverable'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

