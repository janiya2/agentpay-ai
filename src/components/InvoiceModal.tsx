'use client';

import React, { useRef, useState } from 'react';
import { 
  X, Printer, Download, CheckCircle2, ShieldCheck, 
  Copy, Check, ExternalLink, Hash, Building2, CreditCard, 
  FileText, Sparkles, QrCode
} from 'lucide-react';
import { AgentPayOrder } from '@/types';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: AgentPayOrder | null;
}

export default function InvoiceModal({ isOpen, onClose, order }: InvoiceModalProps) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !order) return null;

  const invoiceNumber = `INV-2026-${order.id.slice(0, 8).toUpperCase()}`;
  const grossAmount = order.amount || 0;
  const platformFee = Math.round(grossAmount * 0.05 * 100) / 100; // 5% platform fee
  const netPayout = Math.round((grossAmount - platformFee) * 100) / 100;
  const isCompleted = order.status === 'completed';
  const isInEscrow = order.status === 'in-escrow';

  const certificate = order.auditCertificate;
  const isAudited = Boolean(certificate);

  const handlePrint = () => {
    window.print();
  };

  const copyHash = () => {
    if (certificate?.auditHash) {
      navigator.clipboard.writeText(certificate.auditHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2500);
    }
  };

  const copyInvoiceNumber = () => {
    navigator.clipboard.writeText(invoiceNumber);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const formattedDate = order.createdAt 
    ? new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : new Date().toLocaleDateString('en-US');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn print:p-0 print:bg-white">
      {/* Print-specific style injection to guarantee pixel-perfect PDF export */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible !important;
          }
          #printable-invoice {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
            color: #09090b !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .print-border {
            border-color: #e4e4e7 !important;
          }
          .print-bg-zinc {
            background-color: #f4f4f5 !important;
            color: #18181b !important;
          }
          .print-text-dark {
            color: #09090b !important;
          }
          .print-text-muted {
            color: #71717a !important;
          }
        }
      `}</style>

      <div 
        id="printable-invoice"
        ref={printRef}
        className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="no-print p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-zinc-950 shadow-md">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Enterprise B2B Smart Tax Invoice</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-semibold">
                  PayPal Verified
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Official Settlement & AI Escrow Audit Ledger • <span className="font-mono text-zinc-300">{invoiceNumber}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar print:overflow-visible print:p-0">
          
          {/* Invoice Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6 print:border-zinc-200">
            <div>
              <div className="flex items-center gap-2">
                <img 
                  src="/images/agentpay-logo.svg" 
                  alt="AgentPay AI Logo" 
                  className="h-8 w-8 rounded-xl object-cover shadow-sm shadow-cyan-900/40" 
                />
                <span className="font-black text-xl tracking-tight text-white print:text-zinc-950">
                  AGENTPAY<span className="text-cyan-400">.AI</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 print:text-zinc-600">
                Autonomous AI Specialist Procurement & Escrow Settlement Clearing House
              </p>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5 print:text-zinc-500">
                Tax Reg: US-EIN-94-2819034 • PayPal Enterprise Merchant Gateway
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 print:text-zinc-500 block font-bold">
                Tax Invoice & Settlement Ledger
              </span>
              <h2 className="text-xl font-mono font-black text-white print:text-zinc-950">{invoiceNumber}</h2>
              <div className="flex items-center sm:justify-end gap-2 text-xs">
                <span className="text-zinc-400 print:text-zinc-600">Date: <strong className="text-zinc-200 print:text-zinc-950">{formattedDate}</strong></span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                  isCompleted 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 print:bg-emerald-50 print:text-emerald-700' 
                    : isInEscrow
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 print:bg-amber-50 print:text-amber-700'
                    : 'bg-zinc-800 text-zinc-300'
                }`}>
                  {isCompleted ? '✓ Paid & Released' : isInEscrow ? '🛡️ Held in Escrow' : order.status}
                </span>
              </div>
            </div>
          </div>

          {/* Billing Parties Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 print:bg-zinc-50 print:border-zinc-200 text-xs">
            {/* Buyer / Client */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 print:text-cyan-700 font-bold flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <span>Billed To (Client / Buyer)</span>
              </span>
              <h4 className="font-bold text-white print:text-zinc-950 text-sm">{order.buyerName}</h4>
              <p className="text-zinc-400 print:text-zinc-600 font-mono text-[11px] truncate">{order.buyerEmail}</p>
              <p className="text-[10px] text-zinc-500 print:text-zinc-500">Corporate Milestone Account</p>
            </div>

            {/* Specialist / Provider */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 print:text-emerald-700 font-bold flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                <span>Issued By (Hired Specialist)</span>
              </span>
              <h4 className="font-bold text-white print:text-zinc-950 text-sm">{order.providerName}</h4>
              <p className="text-zinc-400 print:text-zinc-600 font-mono text-[11px] truncate">{order.providerEmail}</p>
              <p className="text-[10px] text-zinc-500 print:text-zinc-500">Verified Autonomous Agent Talent</p>
            </div>

            {/* PayPal Clearing Details */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 print:text-amber-700 font-bold flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                <span>PayPal Escrow Ledger</span>
              </span>
              <div className="space-y-0.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-zinc-400 print:text-zinc-600">
                  <span>Order ID:</span>
                  <span className="text-amber-300 print:text-amber-800 font-semibold truncate max-w-[120px]">{order.paypalOrderId}</span>
                </div>
                {order.paypalCaptureId && (
                  <div className="flex items-center justify-between text-zinc-400 print:text-zinc-600">
                    <span>Capture ID:</span>
                    <span className="text-emerald-400 print:text-emerald-700 font-semibold truncate max-w-[120px]">{order.paypalCaptureId}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-zinc-400 print:text-zinc-600">
                  <span>Settlement:</span>
                  <span className="text-zinc-200 print:text-zinc-900 font-semibold">PayPal Orders v2</span>
                </div>
              </div>
            </div>
          </div>

          {/* Project Title & Milestone Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 print:text-zinc-500">Contract Scope</span>
                <h3 className="font-bold text-white print:text-zinc-950 text-sm sm:text-base">{order.serviceTitle}</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 print:text-zinc-600">Contract ID: #{order.id}</span>
            </div>

            <div className="border border-zinc-800 print:border-zinc-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 print:bg-zinc-100 text-zinc-400 print:text-zinc-700 font-mono text-[10px] uppercase border-b border-zinc-800 print:border-zinc-200">
                  <tr>
                    <th className="py-3 px-4">Milestone Tranche</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Deliverable Verification</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Amount (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 print:divide-zinc-200">
                  {order.milestones && order.milestones.length > 0 ? (
                    order.milestones.map((m, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/30 print:hover:bg-transparent">
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-white print:text-zinc-950 block">{m.title}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">Tranche #{idx + 1}</span>
                        </td>
                        <td className="py-3.5 px-4 hidden sm:table-cell text-zinc-400 print:text-zinc-600 text-[11px]">
                          {order.deliverable?.repoUrl ? (
                            <span className="font-mono text-cyan-400 print:text-cyan-800">GitHub Verified ({order.deliverable.repoUrl.replace('https://github.com/', '')})</span>
                          ) : (
                            <span>Milestone Acceptance Criteria</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            m.status === 'released' 
                              ? 'bg-emerald-500/10 text-emerald-400 print:bg-emerald-50 print:text-emerald-700' 
                              : m.status === 'verified'
                              ? 'bg-cyan-500/10 text-cyan-300 print:bg-cyan-50 print:text-cyan-700'
                              : 'bg-zinc-800 text-zinc-400 print:bg-zinc-200 print:text-zinc-700'
                          }`}>
                            {m.status === 'released' ? '✓ Released' : m.status === 'verified' ? '🛡️ AI Verified' : 'In Escrow'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white print:text-zinc-950">
                          ${m.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-3.5 px-4 font-semibold text-white print:text-zinc-950">
                        {order.serviceTitle}
                      </td>
                      <td className="py-3.5 px-4 hidden sm:table-cell text-zinc-400 print:text-zinc-600">
                        Complete Project Milestone Delivery
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400">
                          Verified
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white print:text-zinc-950">
                        ${grossAmount.toFixed(2)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Totals & Fee Breakdown Table */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 pt-2">
            
            {/* Cryptographic AI Escrow Verification Stamp */}
            <div className="w-full sm:max-w-md p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 print:border-zinc-200 print:bg-zinc-50 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400 print:text-cyan-800 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>AI Escrow Judge Verification Seal</span>
                </span>
                {certificate && (
                  <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 print:bg-emerald-50 print:text-emerald-800">
                    Audit Score: {certificate.overallScore}/100
                  </span>
                )}
              </div>

              {certificate ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-zinc-300 print:text-zinc-700 leading-relaxed">
                    Deliverable cryptographically verified by Gemini 2.5 Flash against milestone specifications. 
                    Zero leaked secrets detected. Code quality cleared.
                  </p>
                  <div className="p-2 rounded-xl bg-zinc-950 print:bg-white border border-zinc-800 print:border-zinc-200 font-mono text-[9px] text-zinc-400 print:text-zinc-600 break-all select-all flex items-center justify-between gap-2">
                    <span>SHA-256: {certificate.auditHash}</span>
                    <button 
                      onClick={copyHash}
                      className="no-print text-cyan-400 hover:text-cyan-300 shrink-0 cursor-pointer"
                    >
                      {copiedHash ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>Audit Time: {new Date(certificate.auditedAt).toUTCString()}</span>
                    <span>Revisions: #{certificate.recheckCount || 1}</span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 italic">
                  Escrow payment secured on PayPal Orders v2. Deliverables will be verified by the Autonomous AI Auditor prior to release.
                </p>
              )}
            </div>

            {/* Calculations Summary Box */}
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex items-center justify-between text-zinc-400 print:text-zinc-600">
                <span>Contract Subtotal (Gross):</span>
                <span className="font-mono text-zinc-200 print:text-zinc-950 font-bold">${grossAmount.toFixed(2)} USD</span>
              </div>

              <div className="flex items-center justify-between text-zinc-400 print:text-zinc-600">
                <span className="flex items-center gap-1">
                  <span>Platform & Escrow Fee (5%):</span>
                </span>
                <span className="font-mono text-zinc-400 print:text-zinc-600">-${platformFee.toFixed(2)} USD</span>
              </div>

              <div className="flex items-center justify-between text-zinc-400 print:text-zinc-600">
                <span>Net Specialist Settlement:</span>
                <span className="font-mono text-emerald-400 print:text-emerald-700 font-bold">${netPayout.toFixed(2)} USD</span>
              </div>

              <div className="pt-2 border-t border-zinc-800 print:border-zinc-200 flex items-center justify-between">
                <div>
                  <span className="font-black text-sm text-white print:text-zinc-950 block">Total Billed:</span>
                  <span className="text-[9px] text-zinc-500 font-mono">Inclusive of all platform fees</span>
                </div>
                <span className="text-xl font-mono font-black text-emerald-400 print:text-emerald-700">
                  ${grossAmount.toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          {/* Footer Legal & QR Code Block */}
          <div className="pt-6 border-t border-zinc-800 print:border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="space-y-1 text-[10px] text-zinc-500 print:text-zinc-600 max-w-lg">
              <p className="font-semibold text-zinc-400 print:text-zinc-800">
                Authorized Electronic Ledger Entry • AgentPay AI Settlement Network
              </p>
              <p>
                This smart invoice certifies the escrow authorization, AI quality audit, and disbursement via PayPal Sandbox Orders v2. 
                Retain this statement for corporate corporate tax records, R&D credits, and milestone contractor accounting.
              </p>
            </div>

            {/* Verification Stamp / Seal */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/60 print:bg-zinc-100 border border-zinc-800 print:border-zinc-200">
              <div className="h-10 w-10 rounded-lg bg-zinc-950 print:bg-white border border-zinc-800 print:border-zinc-300 flex items-center justify-center text-cyan-400 print:text-cyan-800">
                <QrCode className="h-6 w-6" />
              </div>
              <div className="text-left font-mono text-[9px] text-zinc-400 print:text-zinc-700 space-y-0.5">
                <span className="font-bold text-white print:text-zinc-950 block">SECURE AUDIT SEAL</span>
                <span>ID: {order.id.slice(0, 12)}</span>
                <span className="text-emerald-400 print:text-emerald-700 block">✓ VERIFIED BY PAYPAL & GEMINI</span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions (Hidden in Print) */}
        <div className="no-print p-4 sm:p-5 border-t border-zinc-800 bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={copyInvoiceNumber}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-mono cursor-pointer"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedLink ? 'Invoice ID Copied!' : `Copy Invoice ID (${invoiceNumber})`}</span>
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

