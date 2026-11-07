'use client';

import React, { useState, useMemo } from 'react';
import type { AgentPayOrder, ServiceProvider, PayPalPayoutRecord } from '@/types';
import { useJudgeTour } from '@/context/JudgeTourContext';
import { 
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownLeft, ShieldCheck, 
  Lock, Download, FileText, CheckCircle2, Clock, Sparkles, Filter, 
  Search, CreditCard, ExternalLink, RefreshCw, Layers, Check, Copy, 
  Zap, ArrowRight, Shield, ChevronDown, ChevronUp, AlertCircle, Terminal
} from 'lucide-react';

export interface AdminUnifiedTransaction {
  id: string;
  type: 'escrow_deposit' | 'milestone_release' | 'paypal_cashout';
  title: string;
  subTitle: string;
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientEmail: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  paypalId: string;
  status: string;
  date: string;
  orderObj?: AgentPayOrder;
  payoutObj?: PayPalPayoutRecord;
}

interface AdminTransactionsLedgerProps {
  orders: AgentPayOrder[];
  providers: ServiceProvider[];
  payouts: PayPalPayoutRecord[];
  onOpenInvoice: (order: AgentPayOrder) => void;
}

export default function AdminTransactionsLedger({
  orders,
  providers,
  payouts,
  onOpenInvoice
}: AdminTransactionsLedgerProps) {
  const { openWebhooksModal } = useJudgeTour();
  const [filterType, setFilterType] = useState<'all' | 'escrow_deposit' | 'milestone_release' | 'paypal_cashout'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Compile Unified Audit Trail
  const unifiedTransactions: AdminUnifiedTransaction[] = useMemo(() => {
    const list: AdminUnifiedTransaction[] = [];

    // 1. Client Escrow Deposits (Orders funded)
    orders.forEach(o => {
      if (o.status === 'in-escrow' || o.status === 'completed') {
        const gross = o.amount || 0;
        const fee = Math.round(gross * 0.05 * 100) / 100;
        const net = Math.round((gross - fee) * 100) / 100;
        list.push({
          id: `dep_${o.id}`,
          type: 'escrow_deposit',
          title: `Client Escrow Deposit: ${o.serviceTitle}`,
          subTitle: `Order Ref: ${o.id}`,
          senderName: o.buyerName || 'Verified Client',
          senderEmail: o.buyerEmail || 'client@innoxpert-agents.io',
          recipientName: 'AgentPay PayPal Escrow Vault',
          recipientEmail: 'vault@innoxpert-agents.io',
          grossAmount: gross,
          platformFee: fee,
          netAmount: net,
          currency: 'USD',
          paypalId: o.paypalCaptureId || o.paypalOrderId || 'PAYPAL_ORDER_PENDING',
          status: o.status === 'completed' ? 'Fully Released' : 'Held in Escrow',
          date: o.createdAt || new Date().toISOString(),
          orderObj: o
        });
      }
    });

    // 2. Milestone Escrow Releases
    orders.forEach(o => {
      if (Array.isArray(o.milestones)) {
        o.milestones.forEach((m, idx) => {
          if (m.status === 'released') {
            const gross = m.amount || 0;
            const fee = Math.round(gross * 0.05 * 100) / 100;
            const net = Math.round((gross - fee) * 100) / 100;
            list.push({
              id: `rel_${o.id}_m${idx + 1}`,
              type: 'milestone_release',
              title: `Milestone Escrow Release: ${m.title || `Tranche #${idx + 1}`}`,
              subTitle: `${o.serviceTitle} (Order ${o.id})`,
              senderName: `${o.buyerName} (via Escrow Vault)`,
              senderEmail: o.buyerEmail || 'client@innoxpert-agents.io',
              recipientName: o.providerName || 'Specialist',
              recipientEmail: o.providerEmail || o.providerPaypalEmail || 'provider@innoxpert-agents.io',
              grossAmount: gross,
              platformFee: fee,
              netAmount: net,
              currency: 'USD',
              paypalId: o.paypalCaptureId || o.paypalOrderId || 'VAULT_SETTLEMENT',
              status: 'Released to Specialist',
              date: (m as any).releasedAt || o.updatedAt || o.createdAt || new Date().toISOString(),
              orderObj: o
            });
          }
        });
      }
    });

    // 3. Specialist PayPal Cashouts
    payouts.forEach(p => {
      list.push({
        id: `payout_${p.id}`,
        type: 'paypal_cashout',
        title: `Specialist PayPal Sandbox Cashout`,
        subTitle: `Direct transfer to ${p.paypalEmail}`,
        senderName: 'AgentPay Institutional Vault',
        senderEmail: 'payouts@innoxpert-agents.io',
        recipientName: p.providerName || 'Specialist',
        recipientEmail: p.paypalEmail,
        grossAmount: p.amount,
        platformFee: 0,
        netAmount: p.amount,
        currency: p.currency || 'USD',
        paypalId: p.paypalBatchId || 'BATCH_PAYPAL_V2',
        status: p.paypalPayoutStatus === 'SUCCESS' ? 'Disbursed via PayPal' : 'Processing via PayPal',
        date: p.createdAt || new Date().toISOString(),
        payoutObj: p
      });
    });

    // Sort descending by date
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [orders, payouts]);

  // Filtered List
  const filteredTransactions = useMemo(() => {
    return unifiedTransactions.filter(tx => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          tx.id.toLowerCase().includes(q) ||
          tx.title.toLowerCase().includes(q) ||
          tx.paypalId.toLowerCase().includes(q) ||
          tx.senderName.toLowerCase().includes(q) ||
          tx.senderEmail.toLowerCase().includes(q) ||
          tx.recipientName.toLowerCase().includes(q) ||
          tx.recipientEmail.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [unifiedTransactions, filterType, searchQuery]);

  // Treasury Metrics
  const treasuryMetrics = useMemo(() => {
    let gmv = 0;
    let platformFeeRevenue = 0;
    let pendingInEscrow = 0;
    let totalCashedOutToTalent = 0;

    orders.forEach(o => {
      if (o.status === 'in-escrow' || o.status === 'completed') {
        gmv += (o.amount || 0);
        platformFeeRevenue += Math.round((o.amount || 0) * 0.05 * 100) / 100;
        if (Array.isArray(o.milestones)) {
          const pending = o.milestones.filter(m => m.status !== 'released').reduce((acc, m) => acc + (m.amount || 0), 0);
          pendingInEscrow += pending;
        } else if (o.status === 'in-escrow') {
          pendingInEscrow += (o.amount || 0);
        }
      }
    });

    payouts.forEach(p => {
      totalCashedOutToTalent += (p.amount || 0);
    });

    return {
      gmv: Math.round(gmv * 100) / 100,
      platformFeeRevenue: Math.round(platformFeeRevenue * 100) / 100,
      pendingInEscrow: Math.round(pendingInEscrow * 100) / 100,
      totalCashedOutToTalent: Math.round(totalCashedOutToTalent * 100) / 100
    };
  }, [orders, payouts]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Transaction Ref,Type,Title,Sender,Sender Email,Recipient,Recipient Email,Gross Amount,5% Platform Fee,Net Amount,PayPal Identifier,Status,Timestamp'];
    const rows = unifiedTransactions.map(tx => [
      `"${tx.id}"`,
      `"${tx.type}"`,
      `"${tx.title.replace(/"/g, '""')}"`,
      `"${tx.senderName}"`,
      `"${tx.senderEmail}"`,
      `"${tx.recipientName}"`,
      `"${tx.recipientEmail}"`,
      `$${tx.grossAmount}`,
      `$${tx.platformFee}`,
      `$${tx.netAmount}`,
      `"${tx.paypalId}"`,
      `"${tx.status}"`,
      `"${new Date(tx.date).toLocaleString()}"`
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AgentPay_Platform_Financial_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
            <span>Platform Financial Transactions &amp; PayPal Audit Ledger</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1 pl-10.5">
            Real-time auditable stream of client escrow deposits, milestone releases, and specialist PayPal payouts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={openWebhooksModal}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title="Inspect real-time PayPal Webhooks stream and HMAC verification"
          >
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            <span>⚡ PayPal Webhooks Terminal</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Download className="h-3.5 w-3.5 text-cyan-400" />
            <span>Export Master CSV Ledger</span>
          </button>
        </div>
      </div>

      {/* 2. Platform Treasury KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* GMV */}
        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-1.5">
            <span className="uppercase text-[10px] tracking-wider text-cyan-400 font-bold">Total Platform GMV</span>
            <TrendingUp className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl sm:text-3xl font-black font-mono text-cyan-300">
              ${treasuryMetrics.gmv}
            </p>
            <span className="text-xs font-mono font-bold text-cyan-400">USD</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">Total funded milestone contracts</p>
        </div>

        {/* Platform Revenue */}
        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/50 border border-emerald-500/30 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-1.5">
            <span className="uppercase text-[10px] tracking-wider text-emerald-400 font-bold">Platform Revenue (5%)</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
              ${treasuryMetrics.platformFeeRevenue}
            </p>
            <span className="text-xs font-mono font-bold text-emerald-500">USD</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">Autonomous multi-agent orchestration fees</p>
        </div>

        {/* In Escrow Reserves */}
        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/50 border border-amber-500/30 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-1.5">
            <span className="uppercase text-[10px] tracking-wider text-amber-400 font-bold">In-Escrow Custody</span>
            <Lock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl sm:text-3xl font-black font-mono text-amber-300">
              ${treasuryMetrics.pendingInEscrow}
            </p>
            <span className="text-xs font-mono font-bold text-amber-500">USD</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">Secured in PayPal Sandbox escrow vault</p>
        </div>

        {/* Disbursed to Specialists */}
        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/50 border border-purple-500/30 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-1.5">
            <span className="uppercase text-[10px] tracking-wider text-purple-300 font-bold">Paid Out via PayPal</span>
            <Zap className="h-4 w-4 text-purple-300" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl sm:text-3xl font-black font-mono text-purple-300">
              ${treasuryMetrics.totalCashedOutToTalent}
            </p>
            <span className="text-xs font-mono font-bold text-purple-400">USD</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">Direct PayPal Sandbox payouts executed</p>
        </div>
      </div>

      {/* 3. Filter Chips & Search Bar */}
      <div className="p-4 rounded-3xl bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All Records ({unifiedTransactions.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('escrow_deposit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'escrow_deposit'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Lock className="h-3 w-3" />
            <span>Escrow Deposits ({unifiedTransactions.filter(t => t.type === 'escrow_deposit').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('milestone_release')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'milestone_release'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>Milestone Releases ({unifiedTransactions.filter(t => t.type === 'milestone_release').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('paypal_cashout')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'paypal_cashout'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className="h-3 w-3" />
            <span>PayPal Cashouts ({unifiedTransactions.filter(t => t.type === 'paypal_cashout').length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search ref, PayPal ID, party..."
            className="pl-9 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60 w-full sm:w-64 font-mono"
          />
        </div>
      </div>

      {/* 4. Transactions Ledger Table */}
      <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/90 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Transaction / Flow</th>
                <th className="py-3.5 px-4">Sender &amp; Recipient</th>
                <th className="py-3.5 px-4">PayPal ID / Batch</th>
                <th className="py-3.5 px-4 text-right">Gross Amount</th>
                <th className="py-3.5 px-4 text-right">5% Fee</th>
                <th className="py-3.5 px-4 text-right">Net Amount</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    No transactions match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-zinc-900/40 transition-colors">
                    {/* Flow & Title */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg shrink-0 ${
                          tx.type === 'escrow_deposit' 
                            ? 'bg-cyan-500/15 text-cyan-400' 
                            : tx.type === 'milestone_release'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-purple-500/15 text-purple-400'
                        }`}>
                          {tx.type === 'escrow_deposit' && <Lock className="h-3.5 w-3.5" />}
                          {tx.type === 'milestone_release' && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {tx.type === 'paypal_cashout' && <Zap className="h-3.5 w-3.5" />}
                        </span>
                        <div>
                          <p className="font-bold text-white leading-tight">{tx.title}</p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{tx.subTitle}</p>
                          <span suppressHydrationWarning className="text-[10px] text-zinc-400 font-mono">
                            {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Parties */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="space-y-0.5">
                        <div className="text-[11px] text-zinc-300">
                          <span className="text-zinc-500 text-[10px]">From: </span>
                          <strong className="text-white">{tx.senderName}</strong>
                        </div>
                        <div className="text-[11px] text-zinc-300">
                          <span className="text-zinc-500 text-[10px]">To: </span>
                          <span className="text-emerald-400 font-medium">{tx.recipientName}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate max-w-[180px]">{tx.recipientEmail}</p>
                      </div>
                    </td>

                    {/* PayPal ID */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20 truncate max-w-[150px]">
                          {tx.paypalId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(tx.paypalId, tx.id)}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Copy PayPal ID"
                        >
                          {copiedId === tx.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Gross */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      ${tx.grossAmount} USD
                    </td>

                    {/* Fee */}
                    <td className="py-3.5 px-4 text-right font-mono text-zinc-400">
                      ${tx.platformFee} USD
                    </td>

                    {/* Net */}
                    <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400">
                      ${tx.netAmount} USD
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        tx.type === 'paypal_cashout'
                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          : tx.type === 'milestone_release'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {tx.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {tx.orderObj ? (
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(tx.orderObj!)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-mono text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-sm"
                        >
                          <FileText className="h-3 w-3 text-cyan-400" />
                          <span>Invoice</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-500 font-mono">Disbursed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

