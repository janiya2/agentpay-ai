'use client';

import React from 'react';
import { 
  ShieldCheck, CheckCircle2, Lock, ArrowRight, DollarSign, 
  CreditCard, ExternalLink, X, RefreshCw, AlertCircle, Sparkles
} from 'lucide-react';

interface EscrowReleaseConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isReleasing: boolean;
  order: {
    id: string;
    serviceTitle: string;
    buyerName: string;
    providerName: string;
    providerEmail?: string;
    providerPaypalEmail?: string;
    paypalOrderId?: string;
    amount?: number;
    auditCertificate?: {
      overallScore?: number;
      verdict?: string;
    } | null;
  } | null;
  milestone: {
    id?: string;
    title: string;
    amount: number;
    index: number;
    totalMilestones?: number;
  } | null;
}

export default function EscrowReleaseConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isReleasing,
  order,
  milestone
}: EscrowReleaseConfirmModalProps) {
  if (!isOpen || !order || !milestone) return null;

  const score = order.auditCertificate?.overallScore;
  const isAuditPassed = order.auditCertificate?.verdict === 'PASSED_VERIFIED' || (score !== undefined && score >= 80);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-lg rounded-3xl bg-zinc-950/95 border border-emerald-500/40 shadow-2xl shadow-emerald-950/60 overflow-hidden text-left space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-0 flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/15 to-transparent border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-950/50">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base sm:text-lg">
                  Release Milestone Funds
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                  PayPal Escrow
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Cryptographically secured release to specialist payout balance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isReleasing}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Amount & Beneficiary Showcase Card */}
        <div className="px-5 sm:px-6 relative z-10 space-y-3">
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-zinc-900/80 border border-zinc-800/90 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400 border-b border-zinc-800/80 pb-2.5">
              <span>Tranche #{milestone.index + 1} of {milestone.totalMilestones || 2}</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Lock className="h-3 w-3 text-emerald-400" />
                <span>Locked in PayPal Vault</span>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-500 block">
                  Milestone Scope Title:
                </span>
                <span className="font-bold text-white text-sm sm:text-base">
                  {milestone.title}
                </span>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Contract: <span className="text-zinc-300 font-medium">{order.serviceTitle}</span>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-500 block">
                  Disbursement Amount
                </span>
                <span className="font-mono font-black text-2xl sm:text-3xl text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                  ${milestone.amount} <span className="text-xs font-bold text-emerald-500">USD</span>
                </span>
              </div>
            </div>

            {/* Specialist Payout Target */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
              <span className="text-zinc-400">Beneficiary Specialist:</span>
              <span className="font-mono text-cyan-300 font-bold flex items-center gap-1 truncate max-w-[220px]">
                <span>{order.providerName}</span>
                {order.providerPaypalEmail && (
                  <span className="text-[10px] text-zinc-500 font-normal">({order.providerPaypalEmail})</span>
                )}
              </span>
            </div>
          </div>

          {/* AI Code Audit Badge */}
          {score !== undefined && (
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs ${
              isAuditPassed 
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
            }`}>
              <div className="flex items-center gap-2 font-mono">
                <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
                <span className="font-bold">Autonomous AI Code Audit:</span>
                <span>{score}/100</span>
              </div>
              <span className="font-bold text-[11px] uppercase tracking-wider">
                {isAuditPassed ? '✓ Verified Scope' : '⚠️ Revisions Recommended'}
              </span>
            </div>
          )}

          {/* Escrow Guarantee Checklist */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-1.5 text-[11px] text-zinc-300 font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Cryptographic milestone authorization release from PayPal Custody Vault</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Instant milestone funds credit to specialist payout ledger</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Automated B2B compliant digital receipt &amp; invoice generation</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-5 sm:p-6 pt-2 bg-zinc-900/50 border-t border-zinc-800/80 flex items-center justify-end gap-3 relative z-10">
          <button
            type="button"
            onClick={onClose}
            disabled={isReleasing}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Keep Locked in Escrow
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isReleasing}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isReleasing ? 'animate-spin' : ''}`} />
            <span>{isReleasing ? 'Disbursing PayPal Escrow...' : `⚡ Authorize & Disburse $${milestone.amount} USD`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

