'use client';

import React, { useState } from 'react';
import { 
  Scale, Shield, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, 
  ExternalLink, Copy, Check, RefreshCw, X, FileText, Lock, DollarSign, Bot
} from 'lucide-react';
import { ArbitrationRuling } from '@/app/api/orders/dispute-arbitration/route';

interface AiDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderTitle: string;
  buyerName: string;
  providerName: string;
  orderAmount: number;
  initialRuling?: ArbitrationRuling | null;
  deliverableRepoUrl?: string;
  onSettlementExecuted?: (settlementData: any) => void;
}

export default function AiDisputeModal({
  isOpen,
  onClose,
  orderId,
  orderTitle,
  buyerName,
  providerName,
  orderAmount = 160,
  initialRuling = null,
  deliverableRepoUrl,
  onSettlementExecuted
}: AiDisputeModalProps) {
  const [clientClaim, setClientClaim] = useState(
    "The specialist delivered a frontend interface but failed to connect live webhooks and automated background jobs as agreed in Milestone 2."
  );
  const [specialistClaim, setSpecialistClaim] = useState(
    "The frontend architecture, responsive layouts, and PayPal order components were 100% delivered. Backend automation was held due to missing client webhook credentials."
  );
  
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesizedNotice, setSynthesizedNotice] = useState(false);
  const [isConvening, setIsConvening] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [ruling, setRuling] = useState<ArbitrationRuling | null>(initialRuling);
  const [isSettled, setIsSettled] = useState(initialRuling?.status === 'EXECUTED_SETTLED');
  const [settlementTxId, setSettlementTxId] = useState<string | null>(initialRuling?.settlementTxId || null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // 0. Auto-Synthesize Bilateral Claims from Contract & Code Audit
  const handleSynthesizeClaims = async () => {
    setIsSynthesizing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/orders/dispute-arbitration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          action: 'synthesize_claims'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.clientClaim) setClientClaim(data.clientClaim);
        if (data.specialistClaim) setSpecialistClaim(data.specialistClaim);
        setSynthesizedNotice(true);
        setTimeout(() => setSynthesizedNotice(false), 4000);
      } else {
        setErrorMsg(data.error || 'Failed to auto-synthesize claims');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error communicating with AI Dispute Court');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // 1. Convene AI Arbitrator
  const handleConveneArbitrator = async () => {
    setIsConvening(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/orders/dispute-arbitration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          action: 'convene',
          clientClaim,
          specialistClaim
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.ruling) {
        setRuling(data.ruling);
      } else {
        setErrorMsg(data.error || 'Failed to generate arbitration ruling');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Network error communicating with AI Arbitrator');
    } finally {
      setIsConvening(false);
    }
  };

  // 2. Execute Binding PayPal Settlement
  const handleExecuteSettlement = async () => {
    if (!ruling) return;
    setIsExecuting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/orders/dispute-arbitration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          action: 'execute_settlement',
          rulingData: ruling
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSettled(true);
        setSettlementTxId(data.settlementTxId);
        setRuling(data.executedRuling);
        if (onSettlementExecuted) {
          onSettlementExecuted(data);
        }
      } else {
        setErrorMsg(data.error || 'Failed to execute settlement on PayPal Escrow');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Network error executing settlement');
    } finally {
      setIsExecuting(false);
    }
  };

  const copyHashToClipboard = () => {
    if (!ruling?.arbitrationHash) return;
    navigator.clipboard.writeText(ruling.arbitrationHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-zinc-950 border-2 border-amber-500/60 shadow-2xl shadow-amber-950/80 text-zinc-100 flex flex-col">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 bg-gradient-to-r from-amber-950/40 via-zinc-900/60 to-zinc-950 flex items-start justify-between gap-4 sticky top-0 z-10 backdrop-blur-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                <Scale className="h-3 w-3 text-amber-400" />
                <span>Autonomous AI Dispute Resolution Court</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-cyan-400" />
                <span>AgentPay LexGuard™ Neural Arbiter (v2.5)</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                UNCITRAL Model Law &bull; PayPal Rules v2.1
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              Bilateral Escrow Dispute Mediation &amp; Quantum Meruit Settlement
            </h2>
            <p className="text-xs text-zinc-400 font-sans">
              Contract: <strong className="text-zinc-200">{orderTitle}</strong> &bull; Locked Escrow: <strong className="text-emerald-400 font-mono">${orderAmount} USD</strong>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close Dispute Court"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6">

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Party Badges & Repository Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1">
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                Claimant (Buyer)
              </span>
              <p className="font-bold text-white text-sm">{buyerName}</p>
              <p className="text-[11px] text-zinc-400">Seeking restitution for non-functional milestones</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1">
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                Respondent (Specialist)
              </span>
              <p className="font-bold text-white text-sm">{providerName}</p>
              <p className="text-[11px] text-zinc-400">Claiming substantial performance &amp; good-faith delivery</p>
            </div>
          </div>

          {/* Deliverable Reference */}
          {deliverableRepoUrl && (
            <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-300 truncate">
                <FileText className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="text-zinc-500 font-mono">Repo:</span>
                <span className="font-mono truncate">{deliverableRepoUrl}</span>
              </div>
              <a
                href={deliverableRepoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 shrink-0 ml-2"
              >
                <span>Inspect Repo</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Statements of Dispute (if not yet settled) */}
          {!ruling && (
            <div className="space-y-4">

              {/* ⚡ Auto-Synthesize Claims Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-amber-950/30 via-zinc-900/90 to-zinc-950 border border-amber-500/40 shadow-inner">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Autonomous Evidence Synthesis</span>
                    <span className="text-[10px] text-zinc-400 font-mono">Auto-extract arguments from Contract &amp; AST Code Audit</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSynthesizeClaims}
                  disabled={isSynthesizing || isConvening}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 hover:from-amber-500/35 hover:to-yellow-400/35 text-amber-300 hover:text-white border border-amber-500/50 hover:border-amber-400 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm shrink-0"
                  title="Analyze repository deliverable & code audit to automatically populate bilateral legal claims"
                >
                  {isSynthesizing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
                      <span>Synthesizing from Audit...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>⚡ Auto-Synthesize Claims (AI)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Success Notice after Synthesis */}
              {synthesizedNotice && (
                <div className="px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono flex items-center gap-1.5 animate-fadeIn">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Bilateral claims successfully synthesized from GitHub Deliverables &amp; AST Code Audit!</span>
                </div>
              )}

              {/* Claimant Statement */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    <span>Client's Dispute Claim</span>
                    <span className="text-[10px] text-zinc-500 font-mono">(Dispute Evidence)</span>
                  </label>
                  <span className="text-[10px] font-mono text-zinc-500">Live AI Assessed</span>
                </div>
                <textarea
                  value={clientClaim}
                  onChange={(e) => setClientClaim(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 resize-none font-sans leading-relaxed"
                  placeholder="Detail missing deliverables or failing criteria..."
                />
              </div>

              {/* Respondent Defense */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Specialist Defense &amp; Submission</span>
                    <span className="text-[10px] text-zinc-500 font-mono">(Performance Record)</span>
                  </label>
                  <span className="text-[10px] font-mono text-zinc-500">Live AI Assessed</span>
                </div>
                <textarea
                  value={specialistClaim}
                  onChange={(e) => setSpecialistClaim(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 resize-none font-sans leading-relaxed"
                  placeholder="Detail work performed, delivered assets, and technical dependencies..."
                />
              </div>

              {/* Convene Button */}
              <button
                type="button"
                onClick={handleConveneArbitrator}
                disabled={isConvening}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:opacity-95 text-zinc-950 font-black text-sm flex flex-col items-center justify-center gap-1 shadow-xl shadow-amber-950/60 transition-all cursor-pointer disabled:opacity-50"
              >
                {isConvening ? (
                  <>
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-zinc-950" />
                      <span>Convening AgentPay LexGuard™ Arbiter...</span>
                    </div>
                    <span className="text-[11px] text-zinc-900 font-mono font-medium">
                      Consulting UNCITRAL Model Law &amp; Quantum Meruit precedent...
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-zinc-950" />
                    <span>Convene Binding AI Arbitrator (AgentPay LexGuard™)</span>
                  </div>
                )}
              </button>
            </div>
          )}

          {/* Render Binding Ruling Card */}
          {ruling && (
            <div className="p-5 sm:p-6 rounded-3xl bg-zinc-900/90 border-2 border-amber-500/80 shadow-2xl space-y-5 animate-fadeIn">
              
              {/* Ruling Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold text-[10px]">
                      Case #{ruling.rulingId}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isSettled 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                    }`}>
                      {isSettled ? 'SETTLEMENT EXECUTED' : 'BINDING RULING ISSUED'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white mt-1">
                    {ruling.verdictSummary}
                  </h3>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono text-zinc-500 block">Arbitration Engine</span>
                  <span className="text-xs font-mono font-bold text-cyan-400">AgentPay LexGuard™ Arbiter (v2.5)</span>
                </div>
              </div>

              {/* Quantum Meruit Split Visualizer Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-400 font-bold">
                    Specialist Payout: {ruling.specialistPayoutPercentage}% (${ruling.specialistPayoutAmount} USD)
                  </span>
                  <span className="text-cyan-400 font-bold">
                    Client Restitution: {ruling.clientRefundPercentage}% (${ruling.clientRefundAmount} USD)
                  </span>
                </div>

                <div className="h-3.5 w-full rounded-full bg-zinc-800 overflow-hidden flex shadow-inner">
                  <div 
                    style={{ width: `${ruling.specialistPayoutPercentage}%` }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md"
                    title={`Specialist: ${ruling.specialistPayoutPercentage}%`}
                  />
                  <div 
                    style={{ width: `${ruling.clientRefundPercentage}%` }}
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-md"
                    title={`Client: ${ruling.clientRefundPercentage}%`}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>To: {providerName}</span>
                  <span>To: {buyerName}</span>
                </div>
              </div>

              {/* Findings of Fact */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">
                  Evidentiary Findings of Fact:
                </h4>
                <div className="space-y-1.5">
                  {ruling.findings.map((f, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-2">
                      <span className="font-mono text-amber-400 font-bold shrink-0">{idx + 1}.</span>
                      <span className="leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legal Rationale */}
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-1 text-xs">
                <span className="text-[10px] font-mono text-amber-300 font-bold uppercase tracking-wider block">
                  Legal Precedent &bull; UNCITRAL Doctrine
                </span>
                <p className="text-zinc-300 leading-relaxed font-sans">
                  {ruling.legalPrecedentRationale}
                </p>
              </div>

              {/* Cryptographic SHA-256 Hash Seal */}
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-[10px] font-mono text-zinc-400 truncate">
                    Hash: <strong className="text-zinc-200">{ruling.arbitrationHash}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyHashToClipboard}
                  className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                >
                  {copiedHash ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Execution Status / Action Button */}
              {isSettled ? (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 space-y-2 text-center animate-fadeIn">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>PayPal Escrow Split Settlement Executed Successfully!</span>
                  </div>
                  <p className="text-xs text-zinc-300">
                    Disbursed <strong className="text-white">${ruling.specialistPayoutAmount} USD</strong> to specialist and refunded <strong className="text-white">${ruling.clientRefundAmount} USD</strong> to client.
                  </p>
                  {settlementTxId && (
                    <span className="text-[10px] font-mono text-emerald-400 block">
                      Ledger TxID: {settlementTxId}
                    </span>
                  )}
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRuling(null);
                        setIsSettled(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white font-bold text-xs border border-amber-500/40 cursor-pointer transition-colors flex items-center gap-1.5"
                      title="Re-open the dispute input to test new bilateral claims or auto-synthesis"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Re-Open / Test New Dispute Claims</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-6 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs cursor-pointer transition-colors"
                    >
                      Close Dispute Court
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleExecuteSettlement}
                  disabled={isExecuting}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-zinc-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-zinc-950" />
                      <span>Executing Split on PayPal Orders v2 Escrow...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-zinc-950" />
                      <span>Execute Binding PayPal Settlement (${ruling.specialistPayoutAmount} / ${ruling.clientRefundAmount})</span>
                    </>
                  )}
                </button>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}

