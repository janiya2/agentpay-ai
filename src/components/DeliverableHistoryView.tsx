'use client';

import React, { useState } from 'react';
import { 
  History, GitCommit, CheckCircle2, AlertTriangle, ExternalLink, 
  ChevronDown, ChevronUp, Sparkles, Clock, RefreshCw, Bot, FileText,
  Github, Globe, ShieldCheck
} from 'lucide-react';

export interface DeliverableHistoryItem {
  version: number;
  repoUrl?: string;
  liveDemoUrl?: string;
  summaryNotes?: string;
  testInstructions?: string;
  submittedAt?: string;
  auditCertificate?: {
    overallScore?: number;
    verdict?: string;
    summary?: string;
    issues?: string[];
    auditedAt?: string;
  } | null;
}

interface DeliverableHistoryViewProps {
  currentDeliverable?: {
    version?: number;
    repoUrl?: string;
    liveDemoUrl?: string;
    summaryNotes?: string;
    testInstructions?: string;
    submittedAt?: string;
  } | null;
  currentCertificate?: {
    overallScore?: number;
    verdict?: string;
    summary?: string;
    issues?: string[];
    auditedAt?: string;
  } | null;
  history?: DeliverableHistoryItem[];
  onOpenAuditModal?: () => void;
  onRunReAudit?: () => void;
  isAuditing?: boolean;
}

export default function DeliverableHistoryView({
  currentDeliverable,
  currentCertificate,
  history = [],
  onOpenAuditModal,
  onRunReAudit,
  isAuditing = false
}: DeliverableHistoryViewProps) {
  const currentVersion = currentDeliverable?.version || (history.length > 0 ? history.length + 1 : 1);
  const totalIterations = (history?.length || 0) + (currentDeliverable ? 1 : 0);
  
  // Default expanded if there are previous submissions or multiple iterations
  const [isExpanded, setIsExpanded] = useState<boolean>(totalIterations > 1);

  if (!currentDeliverable && (!history || history.length === 0)) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-zinc-950/60 border border-zinc-800/80 overflow-hidden text-xs">
      {/* Header bar with toggle */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 bg-zinc-900/60 hover:bg-zinc-900/90 flex items-center justify-between gap-3 cursor-pointer transition-colors select-none"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="h-6 w-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <History className="h-3.5 w-3.5" />
          </div>
          <span className="font-bold text-zinc-200">
            Deliverable Submission &amp; Version History
          </span>
          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono text-[10px] font-semibold">
            {totalIterations} {totalIterations === 1 ? 'Submission' : 'Submissions'} (v{currentVersion} Active)
          </span>

          {history.length > 0 && (
            <span className="text-[11px] text-amber-300 font-mono flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>{history.length} Previous {history.length === 1 ? 'Revision' : 'Revisions'} Tracked</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-zinc-400">
          <span className="text-[11px] hidden sm:inline-block">
            {isExpanded ? 'Collapse' : 'View All Versions'}
          </span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Expandable History Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 divide-y divide-zinc-800/60">
          {/* 1. CURRENT ACTIVE DELIVERABLE */}
          {currentDeliverable && (
            <div className="space-y-2.5 pt-1 first:pt-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>v{currentVersion} (Current Active Deliverable)</span>
                  </span>
                  {currentDeliverable.submittedAt && (
                    <span className="text-[10px] font-mono text-zinc-400">
                      {new Date(currentDeliverable.submittedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Score badge / Audit status */}
                <div className="flex items-center gap-2">
                  {currentCertificate ? (
                    <span className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold border flex items-center gap-1 ${
                      currentCertificate.overallScore && currentCertificate.overallScore >= 80
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    }`}>
                      <ShieldCheck className="h-3 w-3" />
                      <span>Audit Score: {currentCertificate.overallScore}/100 ({currentCertificate.verdict || 'EVALUATED'})</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-mono text-[10px] font-bold flex items-center gap-1 animate-pulse">
                      <Sparkles className="h-3 w-3 text-cyan-400" />
                      <span>Awaiting AI Audit</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Links & Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {currentDeliverable.repoUrl && (
                  <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <Github className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      <span className="font-mono text-zinc-300 truncate">{currentDeliverable.repoUrl}</span>
                    </div>
                    <a 
                      href={currentDeliverable.repoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] font-bold flex items-center gap-0.5 shrink-0"
                    >
                      <span>Open</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                )}

                {currentDeliverable.liveDemoUrl && (
                  <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <Globe className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="font-mono text-zinc-300 truncate">{currentDeliverable.liveDemoUrl}</span>
                    </div>
                    <a 
                      href={currentDeliverable.liveDemoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 font-mono text-[11px] font-bold flex items-center gap-0.5 shrink-0"
                    >
                      <span>Preview</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                )}
              </div>

              {currentDeliverable.summaryNotes && (
                <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800/80 text-zinc-300">
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block mb-0.5">Specialist Architectural Notes:</span>
                  <p className="italic text-zinc-200">{currentDeliverable.summaryNotes}</p>
                </div>
              )}

              {/* Action buttons on current version */}
              <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                {onRunReAudit && (
                  <button
                    type="button"
                    onClick={onRunReAudit}
                    disabled={isAuditing}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
                    <span>{isAuditing ? 'Auditing Codebase...' : `⚡ Run AI Code Re-Audit (v${currentVersion})`}</span>
                  </button>
                )}

                {onOpenAuditModal && (
                  <button
                    type="button"
                    onClick={onOpenAuditModal}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Bot className="h-3.5 w-3.5 text-cyan-400" />
                    <span>AI Code Inspector &amp; Chat</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 2. HISTORICAL PREVIOUS SUBMISSIONS */}
          {history.length > 0 && (
            <div className="space-y-3 pt-3">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>Previous Deliverable Iterations ({history.length})</span>
              </span>

              <div className="space-y-2.5">
                {history.slice().reverse().map((item, idx) => {
                  const cert = item.auditCertificate;
                  const itemVer = item.version || (history.length - idx);

                  return (
                    <div 
                      key={idx}
                      className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-2 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono font-bold text-[11px] flex items-center gap-1">
                            <GitCommit className="h-3 w-3 text-cyan-400" />
                            <span>v{itemVer} (Archived Submission)</span>
                          </span>
                          {item.submittedAt && (
                            <span className="text-[10px] font-mono text-zinc-400">
                              Submitted: {new Date(item.submittedAt).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Past audit score */}
                        {cert && cert.overallScore !== undefined && (
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border flex items-center gap-1 ${
                            cert.overallScore >= 80 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          }`}>
                            <span>Past Audit Score: {cert.overallScore}/100</span>
                            <span>•</span>
                            <span>{cert.verdict === 'PASSED_VERIFIED' ? 'PASSED' : 'REVISIONS REQUESTED'}</span>
                          </span>
                        )}
                      </div>

                      {/* Summary Notes & Repo Link */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400 font-mono">
                        {item.repoUrl && (
                          <a 
                            href={item.repoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <Github className="h-3 w-3" />
                            <span className="truncate max-w-[220px]">{item.repoUrl}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}

                        {item.liveDemoUrl && (
                          <a 
                            href={item.liveDemoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Globe className="h-3 w-3" />
                            <span className="truncate max-w-[220px]">{item.liveDemoUrl}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>

                      {item.summaryNotes && (
                        <p className="text-[11px] text-zinc-300 italic pl-3 border-l border-zinc-700">
                          &ldquo;{item.summaryNotes}&rdquo;
                        </p>
                      )}

                      {/* Flagged issues in this historical version if any */}
                      {cert?.issues && cert.issues.length > 0 && (
                        <div className="p-2 rounded-lg bg-rose-950/20 border border-rose-500/20 text-[11px] text-rose-200 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-rose-300 block">
                            Issues Flagged on v{itemVer} (Resolved in Next Version):
                          </span>
                          <ul className="list-disc list-inside space-y-0.5 text-[10px] text-zinc-300">
                            {cert.issues.map((iss, iIdx) => (
                              <li key={iIdx}>{iss}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

