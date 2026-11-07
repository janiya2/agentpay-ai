'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { AgentPayOrder } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { 
  CreditCard, ShieldCheck, CheckCircle2, Clock, ExternalLink, 
  RefreshCw, Bot, User, ArrowRight, Sparkles, AlertCircle, FileText, Lock, 
  MessageSquare, Award, Ban, Search, Download, Check, DollarSign, Layers
} from 'lucide-react';
import DirectChatModal from '@/components/DirectChatModal';
import InvoiceModal from '@/components/InvoiceModal';
import { getSpecialistRealAvatar } from '@/lib/specialistAvatars';

export default function ClientTransactionsPage() {
  const { user, openAuthModal, loginWithJudgeAccount } = useAuth();
  const [orders, setOrders] = useState<AgentPayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-escrow' | 'released' | 'pending-payment' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<AgentPayOrder | null>(null);
  const [activeChatOrder, setActiveChatOrder] = useState<{
    channelId: string;
    orderTitle: string;
    providerName: string;
    orderAmount?: number;
    escrowStatus?: string;
  } | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'agentpay_orders'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentPayOrder));
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setOrders(list);
      }
    } catch (err) {
      console.warn('Orders ledger fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Filter strictly for current authenticated client (Multi-tenant privacy protection)
  const myOrders = orders.filter(o => {
    if (!user) return false;
    const userEmail = user.email?.trim().toLowerCase();
    const userName = user.name?.trim().toLowerCase();
    const buyerEmail = o.buyerEmail?.trim().toLowerCase();
    const buyerName = o.buyerName?.trim().toLowerCase();

    return (buyerEmail && buyerEmail === userEmail) || (buyerName && buyerName === userName);
  });

  // Calculate high-level financial ledger aggregates
  const totalVolumeEscrowed = myOrders.reduce((sum, o) => o.status !== 'cancelled' ? sum + (Number(o.amount) || 0) : sum, 0);
  const totalHeldInEscrow = myOrders.reduce((sum, o) => {
    if (o.status !== 'in-escrow') return sum;
    const milestones = o.milestones || [];
    const unreleased = milestones.filter(m => m.status !== 'released').reduce((mSum, m) => mSum + (Number(m.amount) || 0), 0);
    return sum + (unreleased || (Number(o.amount) || 0));
  }, 0);
  const totalDisbursedPayouts = myOrders.reduce((sum, o) => {
    const milestones = o.milestones || [];
    const released = milestones.filter(m => m.status === 'released').reduce((mSum, m) => mSum + (Number(m.amount) || 0), 0);
    return sum + released;
  }, 0);
  const totalPlatformFees = totalVolumeEscrowed * 0.05;

  // Flatten orders into itemized transactions (Deposits + Releases)
  const itemizedTransactions: Array<{
    id: string;
    orderId: string;
    sessionId?: string;
    type: 'deposit' | 'release' | 'authorization_pending' | 'cancelled';
    title: string;
    scopeTitle: string;
    providerName: string;
    providerEmail: string;
    amount: number;
    paymentChannel: string;
    referenceId: string;
    paypalCaptureId?: string;
    date: string;
    status: AgentPayOrder['status'];
    orderObj: AgentPayOrder;
  }> = [];

  myOrders.forEach(o => {
    const isCancelled = o.status === 'cancelled';
    const isInEscrow = o.status === 'in-escrow';
    const isPendingPayment = o.status === 'pending-payment';
    const isCompleted = o.status === 'completed';

    // 1. Initial Deposit / Escrow Authorization Record
    itemizedTransactions.push({
      id: `tx_dep_${o.id}`,
      orderId: o.id,
      sessionId: o.sessionId,
      type: isPendingPayment ? 'authorization_pending' : isCancelled ? 'cancelled' : 'deposit',
      title: isPendingPayment 
        ? 'PayPal Escrow Authorization Pending' 
        : isCancelled 
        ? 'PayPal Milestone Escrow Voided' 
        : 'PayPal Milestone Escrow Deposit (Locked)',
      scopeTitle: o.serviceTitle,
      providerName: o.providerName,
      providerEmail: o.providerEmail || 'provider@agentpay.network',
      amount: o.amount,
      paymentChannel: 'PayPal Orders v2 / Smart Card',
      referenceId: o.paypalOrderId || `PP_ORD_${o.id}`,
      paypalCaptureId: o.paypalCaptureId,
      date: o.createdAt || new Date().toISOString(),
      status: o.status,
      orderObj: o
    });

    // 2. Individual Milestone Release Disbursements
    if (Array.isArray(o.milestones)) {
      o.milestones.forEach((m, mIdx) => {
        if (m.status === 'released') {
          itemizedTransactions.push({
            id: `tx_rel_${o.id}_m${mIdx + 1}`,
            orderId: o.id,
            sessionId: o.sessionId,
            type: 'release',
            title: `Tranche #${mIdx + 1} Released: ${m.title}`,
            scopeTitle: o.serviceTitle,
            providerName: o.providerName,
            providerEmail: o.providerEmail || 'provider@agentpay.network',
            amount: m.amount,
            paymentChannel: 'PayPal Sandbox Instant Payout',
            referenceId: o.paypalCaptureId ? `CAP_DISB_${o.paypalCaptureId.slice(-8)}` : `DISB_${o.id}_${mIdx + 1}`,
            paypalCaptureId: o.paypalCaptureId,
            date: o.updatedAt || o.createdAt || new Date().toISOString(),
            status: 'completed',
            orderObj: o
          });
        }
      });
    }
  });

  // Sort descending by date
  itemizedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter based on UI status tabs
  const filteredTransactions = itemizedTransactions.filter(tx => {
    if (statusFilter === 'in-escrow' && tx.status !== 'in-escrow') return false;
    if (statusFilter === 'released' && tx.type !== 'release') return false;
    if (statusFilter === 'pending-payment' && tx.status !== 'pending-payment') return false;
    if (statusFilter === 'cancelled' && tx.status !== 'cancelled') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const mTitle = tx.title.toLowerCase().includes(q);
      const mScope = tx.scopeTitle.toLowerCase().includes(q);
      const mProv = tx.providerName.toLowerCase().includes(q);
      const mRef = tx.referenceId.toLowerCase().includes(q);
      const mOrd = tx.orderId.toLowerCase().includes(q);
      return mTitle || mScope || mProv || mRef || mOrd;
    }

    return true;
  });

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* Background Neural Wallpaper with Atmospheric Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat opacity-30 mix-blend-screen"
        style={{ backgroundImage: `url('/images/escrow-vault-bg.jpg')` }}
      />
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-[#090A0F]/80 via-[#090A0F]/92 to-[#090A0F]" />
      <div className="fixed -top-32 -left-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed top-1/4 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* Main Content */}
      <div className="relative z-10 max-w-[1550px] mx-auto px-4 sm:px-8 xl:px-12 py-8 w-full space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Client Escrow Transactions & Vault Ledger
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              PayPal Orders v2 Sandbox
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Cryptographically audited financial ledger of all milestone authorizations, locked escrow vaults, and verified specialist disbursements.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {!user ? (
            <button
              onClick={openAuthModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-cyan-300 hover:text-white text-xs font-semibold cursor-pointer"
            >
              <User className="h-3.5 w-3.5" />
              <span>Sign In as Client</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-cyan-500/30 text-xs text-zinc-300">
              <img src={user.avatarUrl} alt={user.name} className="h-5 w-5 rounded-full bg-zinc-800" />
              <span className="font-semibold text-white truncate max-w-[140px]">{user.name.split(' ')[0]}</span>
              <span className="text-[10px] text-cyan-400 font-mono">({user.role === 'judge' ? 'Judge' : 'Client'})</span>
            </div>
          )}

          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Authentication Guard */}
      {!user ? (
        <div className="py-16 px-6 text-center rounded-3xl bg-zinc-900/40 border border-cyan-500/30 backdrop-blur-xl shadow-2xl max-w-xl mx-auto space-y-6 relative overflow-hidden my-6">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mx-auto shadow-lg shadow-cyan-950/50">
            <ShieldCheck className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              🔒 Multi-Tenant Financial Privacy Shield
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Client Authentication Required
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
              Transaction statements and milestone vault balances are strictly private to authenticated buyers and verified evaluators.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={loginWithJudgeAccount}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>⚡ 1-Click Access as Janitha Dilshan (Judge/Client)</span>
            </button>
            <button
              onClick={openAuthModal}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-800/90 hover:bg-zinc-750 text-zinc-300 hover:text-white font-semibold text-xs border border-zinc-700/80 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <User className="h-3.5 w-3.5" />
              <span>Sign In with Custom Email / Google</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Financial Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Total Escrow Volume</span>
              <p className="text-2xl font-black font-mono text-emerald-400">${totalVolumeEscrowed.toFixed(2)} USD</p>
              <span className="text-[10px] text-zinc-500 font-mono block">Total Milestone Commitments</span>
            </div>

            <div className="p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Currently in Escrow Vault</span>
              <p className="text-2xl font-black font-mono text-cyan-300">${totalHeldInEscrow.toFixed(2)} USD</p>
              <span className="text-[10px] text-cyan-400/80 font-mono block">🛡️ Guaranteed by PayPal Hold</span>
            </div>

            <div className="p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Disbursed to Specialists</span>
              <p className="text-2xl font-black font-mono text-teal-400">${totalDisbursedPayouts.toFixed(2)} USD</p>
              <span className="text-[10px] text-zinc-500 font-mono block">Approved & Discharged Tranches</span>
            </div>

            <div className="p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Platform Protocols & Fees</span>
              <p className="text-2xl font-black font-mono text-amber-300">${totalPlatformFees.toFixed(2)} USD</p>
              <span className="text-[10px] text-zinc-500 font-mono block">5% Protocol Fee with AI Audit</span>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-800/80">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
              {[
                { id: 'all', label: 'All Transactions', count: itemizedTransactions.length },
                { id: 'in-escrow', label: '🛡️ In Escrow', count: itemizedTransactions.filter(t => t.status === 'in-escrow').length },
                { id: 'released', label: '✓ Released Payouts', count: itemizedTransactions.filter(t => t.type === 'release').length },
                { id: 'pending-payment', label: '⏳ Pending Capture', count: itemizedTransactions.filter(t => t.status === 'pending-payment').length },
                { id: 'cancelled', label: '🚫 Voided', count: itemizedTransactions.filter(t => t.status === 'cancelled').length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === tab.id
                      ? 'bg-cyan-500 text-zinc-950 font-bold shadow-md shadow-cyan-950/40'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    statusFilter === tab.id ? 'bg-black/30 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative shrink-0 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by order, specialist, PayPal ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Itemized Transactions Table */}
          {filteredTransactions.length === 0 ? (
            <div className="py-16 px-4 text-center rounded-3xl bg-zinc-900/30 border border-zinc-800 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
                <CreditCard className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">No transactions found</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all' 
                  ? 'No transactions match your current search or filter criteria.' 
                  : 'You have not initiated any procurement escrows yet. Speak to your Autonomous AI Agent to negotiate terms!'}
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-zinc-950 font-bold text-xs hover:bg-cyan-400 transition-colors"
              >
                <span>Start Autonomous Procurement</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/40 shadow-xl">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-950/80 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      <th className="p-4">Transaction / Tranche</th>
                      <th className="p-4">Contract Scope</th>
                      <th className="p-4">Hired Specialist</th>
                      <th className="p-4">PayPal Reference</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredTransactions.map((tx) => {
                      const isDeposit = tx.type === 'deposit';
                      const isRelease = tx.type === 'release';
                      const isPending = tx.status === 'pending-payment';
                      const isCancelled = tx.status === 'cancelled';

                      return (
                        <tr key={tx.id} className="hover:bg-zinc-800/40 transition-colors group">
                          {/* Transaction Type & Date */}
                          <td className="p-4 space-y-1">
                            <div className="flex items-center gap-2">
                              <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isRelease 
                                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' 
                                  : isDeposit 
                                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                                  : isPending 
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                              }`}>
                                {isRelease ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : isDeposit ? (
                                  <Lock className="h-4 w-4" />
                                ) : (
                                  <Clock className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-white text-xs block">{tx.title}</span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {new Date(tx.date).toLocaleDateString()} at {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Scope Title & Order Ref */}
                          <td className="p-4 max-w-[200px]">
                            <span className="font-medium text-white truncate block" title={tx.scopeTitle}>
                              {tx.scopeTitle}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              Ref: {tx.orderId}
                            </span>
                          </td>

                          {/* Specialist Info */}
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <img 
                                src={getSpecialistRealAvatar(tx.providerName)} 
                                alt={tx.providerName} 
                                className="h-8 w-8 rounded-full object-cover border border-zinc-700 bg-zinc-800 shrink-0 shadow-sm" 
                              />
                              <div className="space-y-0.5 min-w-0">
                                <span className="font-semibold text-zinc-200 block truncate text-xs">{tx.providerName}</span>
                                <span className="text-[10px] text-cyan-400/80 font-mono truncate max-w-[150px] block">
                                  {tx.providerEmail}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* PayPal Reference */}
                          <td className="p-4 font-mono text-[11px] text-zinc-300">
                            <span className="block text-amber-300/90 font-semibold">{tx.referenceId}</span>
                            {tx.paypalCaptureId && (
                              <span className="text-[10px] text-emerald-400 block truncate max-w-[140px]">
                                Cap: {tx.paypalCaptureId}
                              </span>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="p-4 font-mono font-black text-sm">
                            <span className={
                              isCancelled 
                                ? 'text-zinc-500 line-through' 
                                : isRelease 
                                ? 'text-teal-400' 
                                : isDeposit 
                                ? 'text-emerald-400' 
                                : 'text-amber-300'
                            }>
                              ${tx.amount} USD
                            </span>
                            <span className="text-[10px] text-zinc-500 block font-normal font-sans">
                              {isRelease ? 'Paid Out' : isDeposit ? 'Locked in Vault' : 'Awaiting'}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                              isRelease 
                                ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                                : tx.status === 'in-escrow' 
                                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30' 
                                : isPending 
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse' 
                                : isCancelled 
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}>
                              {isRelease ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  <span>Disbursed</span>
                                </>
                              ) : tx.status === 'in-escrow' ? (
                                <>
                                  <Lock className="h-3 w-3" />
                                  <span>In Escrow</span>
                                </>
                              ) : isPending ? (
                                <>
                                  <Clock className="h-3 w-3" />
                                  <span>Pending Capture</span>
                                </>
                              ) : isCancelled ? (
                                <span>Voided</span>
                              ) : (
                                <span>Completed</span>
                              )}
                            </span>
                          </td>

                          {/* Quick Actions */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isCancelled && (
                                <button
                                  onClick={() => setActiveInvoiceOrder(tx.orderObj)}
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 hover:text-white transition-colors cursor-pointer"
                                  title="View B2B Smart Tax Invoice"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => setActiveChatOrder({
                                  channelId: tx.orderId,
                                  orderTitle: tx.scopeTitle,
                                  providerName: tx.providerName,
                                  orderAmount: tx.amount,
                                  escrowStatus: tx.status
                                })}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                title={`Direct Message ${tx.providerName}`}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </button>

                              <Link
                                href={`/?orderId=${tx.orderId}&sessionId=${tx.sessionId || `session_${tx.orderId}`}&paypalOrderId=${tx.referenceId}`}
                                className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 hover:text-white transition-colors cursor-pointer"
                                title="Open Autonomous Procurement Room"
                              >
                                <Bot className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Direct Collaboration Modal */}
      {activeChatOrder && (
        <DirectChatModal
          isOpen={!!activeChatOrder}
          onClose={() => setActiveChatOrder(null)}
          channelId={activeChatOrder.channelId}
          orderTitle={activeChatOrder.orderTitle}
          currentUserRole="client"
          currentUserName={user?.name || 'Janitha Dilshan'}
          otherPartyName={activeChatOrder.providerName}
          isPurchasedOrder={true}
          orderAmount={activeChatOrder.orderAmount}
          escrowStatus={activeChatOrder.escrowStatus}
        />
      )}

      {/* Enterprise B2B Smart Tax Invoice Modal */}
      {activeInvoiceOrder && (
        <InvoiceModal
          isOpen={!!activeInvoiceOrder}
          onClose={() => setActiveInvoiceOrder(null)}
          order={activeInvoiceOrder}
        />
      )}
      </div>
    </div>
  );
}
