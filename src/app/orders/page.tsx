'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import type { AgentPayOrder } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { 
  CreditCard, ShieldCheck, CheckCircle2, Clock, ExternalLink, 
  RefreshCw, Bot, User, ArrowRight, Sparkles, AlertCircle, FileText, Lock, 
  MessageSquare, Award, Ban, Search, X, DollarSign, Plus, Filter, Layers,
  Github, Globe, Copy, Check, Terminal, FileCode, AlertTriangle, Scale
} from 'lucide-react';
import DirectChatModal from '@/components/DirectChatModal';
import AiAuditCertificateModal from '@/components/AiAuditCertificateModal';
import AiDisputeModal from '@/components/AiDisputeModal';
import DeliverableHistoryView from '@/components/DeliverableHistoryView';
import EscrowReleaseConfirmModal from '@/components/EscrowReleaseConfirmModal';
import CancelContractConfirmModal from '@/components/CancelContractConfirmModal';
import InvoiceModal from '@/components/InvoiceModal';
import { getSpecialistRealAvatar } from '@/lib/specialistAvatars';

function OrdersPageContent() {
  const { user, openAuthModal, loginWithJudgeAccount } = useAuth();
  const searchParams = useSearchParams();
  const targetScenario = searchParams?.get('scenario') || null;
  const [orders, setOrders] = useState<AgentPayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-escrow' | 'disputed' | 'pending-payment' | 'completed' | 'cancelled'>('all');
  const [escrowDeliverableFilter, setEscrowDeliverableFilter] = useState<'all' | 'submitted' | 'awaiting'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [releasingIndex, setReleasingIndex] = useState<{ orderId: string; mIdx: number } | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [releaseSuccessMsg, setReleaseSuccessMsg] = useState<string | null>(null);

  // In-App Modern Confirmation Modals (Zero ugly browser window.confirm!)
  const [releaseTarget, setReleaseTarget] = useState<{
    order: AgentPayOrder;
    milestone: {
      id?: string;
      title: string;
      amount: number;
      index: number;
      totalMilestones?: number;
    };
  } | null>(null);

  const [cancelTarget, setCancelTarget] = useState<{
    orderId: string;
    orderTitle: string;
  } | null>(null);
  const [systemNotice, setSystemNotice] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'warning' | 'error' | 'success';
  } | null>(null);

  // Link copy state for deliverable card
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const handleCopyLink = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLinkKey(key);
    setTimeout(() => setCopiedLinkKey(null), 2500);
  };
  const [auditingOrderId, setAuditingOrderId] = useState<string | null>(null);
  const [activeCertificateOrder, setActiveCertificateOrder] = useState<AgentPayOrder | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'certificate' | 'chat'>('chat');
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<AgentPayOrder | null>(null);
  const [activeDisputeOrder, setActiveDisputeOrder] = useState<AgentPayOrder | null>(null);
  const [activeChatOrder, setActiveChatOrder] = useState<{
    channelId: string;
    orderId?: string;
    orderTitle: string;
    providerName: string;
    providerId?: string;
    sessionId?: string;
    orderAmount?: number;
    escrowStatus?: string;
  } | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'agentpay_orders'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentPayOrder));
        list.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.deliverable?.submittedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.updatedAt || b.deliverable?.submittedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setOrders(list);
      }
    } catch (err) {
      console.warn('Orders fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Automated 1-Click Scenario Runner for Judges (Scenario 2: Code Audit, Staging Test, and Dispute Court)
  useEffect(() => {
    if (orders.length === 0) return;

    if (targetScenario === 'audit') {
      const target = orders.find(o => o.deliverable) || orders[0];
      if (target) {
        setActiveCertificateOrder(target);
        const tab = searchParams?.get('tab');
        if (tab === 'inspector' || tab === 'chat') {
          setActiveModalTab('chat');
        } else {
          setActiveModalTab('certificate');
        }
      }
    } else if (targetScenario === 'dispute') {
      const target = orders.find(o => o.status === 'in-escrow' || o.deliverable) || orders[0];
      if (target) {
        setActiveDisputeOrder(target);
      }
    }
  }, [targetScenario, orders, searchParams]);

  // Open modern in-app release confirmation modal
  const handleOpenReleaseModal = (order: AgentPayOrder, milestoneIndex: number) => {
    const m = order.milestones?.[milestoneIndex] || {
      title: `Milestone ${milestoneIndex + 1}`,
      amount: order.amount / (order.milestones?.length || 1),
      id: `m-${milestoneIndex}`
    };
    setReleaseTarget({
      order,
      milestone: {
        id: m.id,
        title: m.title,
        amount: m.amount,
        index: milestoneIndex,
        totalMilestones: order.milestones?.length || 1
      }
    });
  };

  // Execute authenticated release from PayPal Escrow
  const executeReleaseMilestone = async () => {
    if (!releaseTarget) return;
    const { order, milestone } = releaseTarget;

    setReleasingIndex({ orderId: order.id, mIdx: milestone.index });
    try {
      const res = await fetch('/api/orders/release-milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, milestoneIndex: milestone.index })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReleaseSuccessMsg(`🎉 Success: Milestone funds released! Status updated to ${data.status}.`);
        setTimeout(() => setReleaseSuccessMsg(null), 6000);
        setReleaseTarget(null);
        await fetchOrders();
      } else {
        setReleaseTarget(null);
        setSystemNotice({
          isOpen: true,
          title: 'Milestone Release Error',
          message: data.error || 'Failed to release funds',
          type: 'error'
        });
      }
    } catch (err: any) {
      setReleaseTarget(null);
      setSystemNotice({
        isOpen: true,
        title: 'Network Communication Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      setReleasingIndex(null);
    }
  };

  // Execute contract cancellation
  const executeCancelOrder = async () => {
    if (!cancelTarget) return;
    const { orderId } = cancelTarget;

    setCancellingOrderId(orderId);
    try {
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          cancelledBy: user?.name || 'Janitha Dilshan (Client)',
          reason: 'Client requested cancellation prior to milestone funding'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReleaseSuccessMsg(`🚫 Contract Cancelled: Order #${orderId} has been successfully cancelled.`);
        setTimeout(() => setReleaseSuccessMsg(null), 7000);
        setCancelTarget(null);
        await fetchOrders();
      } else {
        setCancelTarget(null);
        setSystemNotice({
          isOpen: true,
          title: 'Cancellation Error',
          message: data.error || 'Failed to cancel order',
          type: 'error'
        });
      }
    } catch (err: any) {
      setCancelTarget(null);
      setSystemNotice({
        isOpen: true,
        title: 'Network Communication Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleRunAudit = async (orderId: string) => {
    setAuditingOrderId(orderId);

    // Auto-open modal immediately so client sees real-time progress popup without delay!
    const targetOrder = orders.find(o => o.id === orderId);
    if (targetOrder) {
      setActiveModalTab('certificate');
      setActiveCertificateOrder(targetOrder);
    }

    try {
      const res = await fetch('/api/orders/audit-deliverable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });

      const data = await res.json();
      if (res.ok && data.success && data.certificate) {
        setReleaseSuccessMsg(data.message);
        setTimeout(() => setReleaseSuccessMsg(null), 7000);
        
        setOrders(prev => prev.map(o => o.id === orderId ? {
          ...o,
          auditCertificate: data.certificate,
          deliverableStatus: data.deliverableStatus
        } : o));

        setActiveCertificateOrder(prev => prev && prev.id === orderId ? {
          ...prev,
          auditCertificate: data.certificate,
          deliverableStatus: data.deliverableStatus
        } : prev);
      } else {
        setSystemNotice({
          isOpen: true,
          title: 'Code Audit Notice',
          message: data.error || 'Failed to complete code audit',
          type: 'warning'
        });
      }
    } catch (err: any) {
      setSystemNotice({
        isOpen: true,
        title: 'Audit Network Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      setAuditingOrderId(null);
    }
  };

  const handleRequestRevisions = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'agentpay_orders', orderId);
      await updateDoc(orderRef, {
        deliverableStatus: 'changes_requested',
        updatedAt: new Date().toISOString()
      });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, deliverableStatus: 'changes_requested' } : o));
      setSystemNotice({
        isOpen: true,
        title: 'Revisions Requested',
        message: '⚠️ Revisions requested. Specialist has been notified to address the flagged items in their Provider Workspace.',
        type: 'warning'
      });
    } catch (err: any) {
      setSystemNotice({
        isOpen: true,
        title: 'Status Update Error',
        message: err.message,
        type: 'error'
      });
    }
  };

  // Filter orders strictly for the current logged-in client (No order leakage)
  const myOrders = orders.filter(o => {
    if (!user) return false;
    const userEmail = user.email?.trim().toLowerCase();
    const userName = user.name?.trim().toLowerCase();
    const buyerEmail = o.buyerEmail?.trim().toLowerCase();
    const buyerName = o.buyerName?.trim().toLowerCase();

    return (buyerEmail && buyerEmail === userEmail) || (buyerName && buyerName === userName);
  });

  // Base orders is strictly the current authenticated client's orders (100% Privacy)
  const baseOrders = myOrders;

  // Helper to determine if provider has submitted a deliverable for review & AI audit
  const isOrderSubmitted = (o: AgentPayOrder) => Boolean(
    o.deliverableStatus === 'submitted_pending_audit' ||
    o.deliverableStatus === 'audit_passed' ||
    (o.deliverable && 
    (o.deliverable.repoUrl || o.deliverable.liveDemoUrl || o.deliverable.summaryNotes || o.deliverable.submittedAt) && 
    o.deliverableStatus !== 'awaiting_submission')
  );

  // Status Counts calculated on client's private orders
  const countAll = baseOrders.length;
  const countInEscrow = baseOrders.filter(o => o.status === 'in-escrow').length;
  const countInEscrowSubmitted = baseOrders.filter(o => o.status === 'in-escrow' && isOrderSubmitted(o)).length;
  const countInEscrowAwaiting = baseOrders.filter(o => o.status === 'in-escrow' && !isOrderSubmitted(o)).length;
  const countDisputed = baseOrders.filter(o => o.status === 'disputed' || Boolean((o as any).arbitrationRuling)).length;
  const countPendingPayment = baseOrders.filter(o => o.status === 'pending-payment').length;
  const countCompleted = baseOrders.filter(o => o.status === 'completed').length;
  const countCancelled = baseOrders.filter(o => o.status === 'cancelled').length;

  // Multi-tier Filter: Status Pill + Escrow Deliverable Filter + Search Query
  const displayedOrders = baseOrders.filter(o => {
    // 1. Primary Status Pill Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'disputed') {
        const orderIsDisputed = o.status === 'disputed' || Boolean((o as any).arbitrationRuling);
        if (!orderIsDisputed) return false;
      } else if (o.status !== statusFilter) {
        return false;
      }
    }

    // 2. Deliverable Sub-Filter for In-Escrow contracts
    if (statusFilter === 'in-escrow') {
      const isSub = isOrderSubmitted(o);
      if (escrowDeliverableFilter === 'submitted' && !isSub) return false;
      if (escrowDeliverableFilter === 'awaiting' && isSub) return false;
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (o.serviceTitle || '').toLowerCase().includes(q);
      const matchProvider = (o.providerName || '').toLowerCase().includes(q);
      const matchBuyer = (o.buyerName || '').toLowerCase().includes(q);
      const matchId = (o.id || '').toLowerCase().includes(q);
      return matchTitle || matchProvider || matchBuyer || matchId;
    }
    return true;
  });

  const totalVolume = myOrders.filter(o => o.status !== 'cancelled').reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const activeEscrowCount = myOrders.filter(o => o.status === 'in-escrow').length;

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
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-zinc-800/80 pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] font-bold shadow-inner">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>INSTITUTIONAL PAYPAL ESCROW VAULT • LIVE V2 PROTOCOL</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-100 to-zinc-400 tracking-tight">
              Client Orders &amp; Escrow Vault
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Autonomous milestone contract tracking, AI code auditing with Gemini 2.5, and guaranteed PayPal Escrow disbursements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/transactions"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer transition-all shadow-sm group"
            >
              <FileText className="h-3.5 w-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Transactions Ledger</span>
            </Link>

            <Link
              href="/"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 text-xs font-bold cursor-pointer transition-all shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New RFP</span>
            </Link>

            {!user ? (
              <button
                onClick={openAuthModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-cyan-300 hover:text-white text-xs font-semibold cursor-pointer"
              >
                <User className="h-3.5 w-3.5" />
                <span>Sign In as Client</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-cyan-500/30 text-xs text-zinc-300 shadow-sm">
                <img src={user.avatarUrl} alt={user.name} className="h-5 w-5 rounded-full bg-zinc-800 border border-zinc-700" />
                <span className="font-semibold text-white truncate max-w-[130px]">{user.name.split(' ')[0]}</span>
                <span className="text-[10px] text-cyan-400 font-mono">({user.role === 'judge' ? 'Judge' : 'Client'})</span>
              </div>
            )}

            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Success Notification */}
        {releaseSuccessMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/30 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <p className="font-bold">{releaseSuccessMsg}</p>
            </div>
            <button 
              onClick={() => setReleaseSuccessMsg(null)}
              className="text-xs text-emerald-400 hover:text-white font-mono px-2 py-0.5 rounded cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* If Not Authenticated, Render Institutional Shield Gate */}
        {!user ? (
          <div className="py-16 px-6 text-center rounded-3xl bg-zinc-950/70 border border-cyan-500/30 backdrop-blur-xl shadow-2xl max-w-xl mx-auto space-y-6 relative overflow-hidden my-4">
            <div className="absolute -top-20 -left-20 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mx-auto shadow-lg shadow-cyan-950/50">
              <ShieldCheck className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                🔒 Client Escrow Protocol Gate
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Client Authentication Required
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
                Access to Client Orders &amp; Protected PayPal Milestone Escrow Vault is strictly restricted to authenticated buyers and verified evaluators.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] font-mono text-zinc-300 text-left">
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center gap-2.5">
                <Lock className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>PayPal Orders v2 Escrow</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center gap-2.5">
                <Award className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Multi-Tenant RBAC Security</span>
              </div>
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
            {/* Metrics Row (Strictly Isolated to Client's Private Orders) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 sm:p-6 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 hover:border-emerald-500/40 backdrop-blur-xl shadow-xl space-y-2 relative overflow-hidden group transition-all border-t-2 border-t-emerald-500/80">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="text-[10.5px] uppercase tracking-wider font-semibold">Total Escrow Volume</span>
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tracking-tight">
                  ${totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-zinc-500">USD</span>
                </p>
                <span className="text-[10px] text-zinc-400 font-mono block">Audited on PayPal Sandbox v2</span>
              </div>

              <div className="p-5 sm:p-6 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 hover:border-cyan-500/40 backdrop-blur-xl shadow-xl space-y-2 relative overflow-hidden group transition-all border-t-2 border-t-cyan-500/80">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="text-[10.5px] uppercase tracking-wider font-semibold">Active Escrow Contracts</span>
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-black font-mono text-cyan-300 tracking-tight">
                  {activeEscrowCount} <span className="text-xs font-normal text-zinc-500">Secured</span>
                </p>
                <span className="text-[10px] text-zinc-400 font-mono block">Guaranteed milestone SLAs with AI Audit</span>
              </div>

              <div className="p-5 sm:p-6 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 hover:border-amber-500/40 backdrop-blur-xl shadow-xl space-y-2 relative overflow-hidden group transition-all border-t-2 border-t-amber-500/80">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="text-[10.5px] uppercase tracking-wider font-semibold">Pending Capture</span>
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-black font-mono text-amber-300 tracking-tight">
                  {countPendingPayment} <span className="text-xs font-normal text-zinc-500">Awaiting Auth</span>
                </p>
                <span className="text-[10px] text-zinc-400 font-mono block">Awaiting client funding / cancellable</span>
              </div>

              <div className="p-5 sm:p-6 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 hover:border-blue-500/40 backdrop-blur-xl shadow-xl space-y-2 relative overflow-hidden group transition-all border-t-2 border-t-blue-500/80">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="text-[10.5px] uppercase tracking-wider font-semibold">Escrow Protection SLA</span>
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-base sm:text-lg font-bold text-white tracking-tight">
                  PayPal Hold + AI Judge
                </p>
                <span className="text-[10px] text-emerald-400 font-mono block">Zero-risk client milestone protection</span>
              </div>
            </div>

            {/* Tab Switcher & Status Filter Bar in Glassmorphic Wrapper */}
            <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 backdrop-blur-xl shadow-xl space-y-3.5">
              {/* Client Private Escrow Scope Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white tracking-tight">My Hired Talent &amp; Private Escrows</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                        {myOrders.length} Protected Contracts
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Milestone contracts cryptographically verified &amp; isolated to your account ({user.name}).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 font-semibold">
                  <Lock className="h-3.5 w-3.5 text-emerald-400" />
                  <span>100% Client Escrow Privacy Guard Active</span>
                </div>
              </div>

              {/* Status Pills & Quick Search */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  {[
                    { id: 'all', label: 'All Orders', count: countAll, icon: null },
                    { id: 'in-escrow', label: '🛡️ In Escrow', count: countInEscrow, icon: ShieldCheck },
                    { id: 'disputed', label: '⚖️ Disputed', count: countDisputed, icon: Scale, isAmber: true },
                    { id: 'pending-payment', label: '⏳ Pending Payment', count: countPendingPayment, icon: Clock },
                    { id: 'completed', label: '✓ Completed', count: countCompleted, icon: CheckCircle2 },
                    { id: 'cancelled', label: '🚫 Cancelled', count: countCancelled, icon: Ban },
                  ].map((f) => {
                    const isSelected = statusFilter === f.id;
                    const isAmberTab = f.id === 'disputed';
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          setStatusFilter(f.id as any);
                          if (f.id !== 'in-escrow') {
                            setEscrowDeliverableFilter('all');
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? isAmberTab
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-sm shadow-amber-950/50'
                              : 'bg-zinc-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                            : isAmberTab && f.count > 0
                            ? 'bg-amber-950/30 hover:bg-amber-950/50 text-amber-300/90 hover:text-amber-200 border border-amber-500/40'
                            : 'bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
                        }`}
                      >
                        <span>{f.label}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                          isSelected 
                            ? isAmberTab 
                              ? 'bg-amber-500/30 text-amber-200 font-bold' 
                              : 'bg-cyan-500/20 text-cyan-300 font-bold' 
                            : isAmberTab && f.count > 0 
                            ? 'bg-amber-500/20 text-amber-300 font-bold' 
                            : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {f.count}
                        </span>
                        {f.id === 'in-escrow' && countInEscrowSubmitted > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                            <Sparkles className="h-2.5 w-2.5" />
                            {countInEscrowSubmitted} ready
                          </span>
                        )}
                        {f.id === 'disputed' && countDisputed > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
                            court active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Search Box */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, specialist, or ref..."
                    className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/40 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Specialized Deliverable Status Sub-Filter Bar (Triggered when In Escrow is active) */}
              {statusFilter === 'in-escrow' && (
                <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fadeIn">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
                    <span className="text-[11px] font-mono text-zinc-400 font-bold flex items-center gap-1.5 uppercase tracking-wider shrink-0 pr-1">
                      <Filter className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Deliverable:</span>
                    </span>

                    {/* Sub-Pill 1: All in Escrow */}
                    <button
                      type="button"
                      onClick={() => setEscrowDeliverableFilter('all')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                        escrowDeliverableFilter === 'all'
                          ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm'
                          : 'bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
                      }`}
                    >
                      <Layers className="h-3 w-3" />
                      <span>All in Escrow</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        escrowDeliverableFilter === 'all' ? 'bg-zinc-700 text-white font-bold' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {countInEscrow}
                      </span>
                    </button>

                    {/* Sub-Pill 2: Deliverables Submitted */}
                    <button
                      type="button"
                      onClick={() => setEscrowDeliverableFilter('submitted')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                        escrowDeliverableFilter === 'submitted'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm font-bold'
                          : 'bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 hover:text-cyan-300 border border-zinc-800/80'
                      }`}
                    >
                      <Sparkles className="h-3 w-3 text-cyan-400" />
                      <span>Deliverables Submitted (Ready for Audit)</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                        escrowDeliverableFilter === 'submitted' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {countInEscrowSubmitted}
                      </span>
                    </button>

                    {/* Sub-Pill 3: Awaiting Submission (Specialist Working) */}
                    <button
                      type="button"
                      onClick={() => setEscrowDeliverableFilter('awaiting')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                        escrowDeliverableFilter === 'awaiting'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm font-bold'
                          : 'bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 hover:text-amber-300 border border-zinc-800/80'
                      }`}
                    >
                      <Clock className="h-3 w-3 text-amber-400" />
                      <span>Awaiting Delivery (Work in Progress)</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                        escrowDeliverableFilter === 'awaiting' ? 'bg-amber-500/30 text-amber-200' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {countInEscrowAwaiting}
                      </span>
                    </button>
                  </div>

                  <div className="text-[11px] font-mono text-zinc-400 hidden lg:block shrink-0">
                    {escrowDeliverableFilter === 'submitted' ? (
                      <span className="text-cyan-300 font-semibold flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-cyan-400" />
                        <span>{countInEscrowSubmitted} {countInEscrowSubmitted === 1 ? 'contract ready' : 'contracts ready'} for AI code audit</span>
                      </span>
                    ) : escrowDeliverableFilter === 'awaiting' ? (
                      <span className="text-amber-300 font-semibold flex items-center gap-1">
                        <Clock className="h-3 w-3 text-amber-400" />
                        <span>{countInEscrowAwaiting} {countInEscrowAwaiting === 1 ? 'contract' : 'contracts'} being developed by specialists</span>
                      </span>
                    ) : (
                      <span>Showing {countInEscrow} active escrow contracts</span>
                    )}
                  </div>
                </div>
              )}
            </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-24 text-center text-xs text-zinc-500">
          <span className="animate-spin inline-block mr-2">⏳</span> Querying Firestore orders and milestone states...
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="py-16 px-6 text-center rounded-3xl bg-zinc-900/20 border border-zinc-800/60 space-y-4 max-w-lg mx-auto">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {statusFilter === 'in-escrow' && escrowDeliverableFilter === 'submitted'
                ? 'No deliverables submitted yet for contracts in escrow'
                : statusFilter === 'in-escrow' && escrowDeliverableFilter === 'awaiting'
                ? 'All contracts in escrow have deliverables submitted!'
                : statusFilter !== 'all' 
                ? `No orders matching filter "${statusFilter}"` 
                : 'No active client orders found'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {statusFilter === 'in-escrow' && escrowDeliverableFilter === 'submitted'
                ? 'Specialists are actively developing your project milestones. As soon as a specialist submits their GitHub repo or live preview, it will show up here ready for AI Code Audit!'
                : statusFilter === 'in-escrow' && escrowDeliverableFilter === 'awaiting'
                ? 'Every specialist has submitted their work. You can execute AI Code Audits and approve milestone payouts.'
                : statusFilter !== 'all'
                ? 'Try selecting a different filter tab or clear your search query.'
                : "You haven't hired any specialists yet. Speak to your Autonomous AI Agent to negotiate terms and set up your first milestone escrow!"}
            </p>
          </div>
          {statusFilter === 'in-escrow' && escrowDeliverableFilter !== 'all' ? (
            <button
              onClick={() => { setEscrowDeliverableFilter('all'); setSearchQuery(''); }}
              className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-xs font-semibold text-cyan-300 hover:text-white border border-cyan-500/40 transition-colors cursor-pointer"
            >
              Show All In Escrow ({countInEscrow})
            </button>
          ) : statusFilter !== 'all' ? (
            <button
              onClick={() => { setStatusFilter('all'); setEscrowDeliverableFilter('all'); setSearchQuery(''); }}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold text-xs hover:opacity-95 shadow-lg shadow-cyan-950/40 transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>Start Autonomous Procurement</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {displayedOrders.map((order) => {
            const isCompleted = order.status === 'completed';
            const isInEscrow = order.status === 'in-escrow';
            const isPendingPayment = order.status === 'pending-payment';
            const isCancelled = order.status === 'cancelled';
            const isDisputed = Boolean(
              order.status === 'disputed' || 
              (order as any).arbitrationRuling
            );
            const isAuditPassed = order.deliverableStatus === 'audit_passed';
            const isOrderOwner = Boolean(
              user && (
                (order.buyerEmail && order.buyerEmail.toLowerCase() === user.email?.toLowerCase()) ||
                (order.buyerName && order.buyerName.toLowerCase() === user.name?.toLowerCase()) ||
                user.role === 'admin'
              )
            );
            const isDeliverableSubmitted = Boolean(
              order.deliverableStatus === 'submitted_pending_audit' ||
              order.deliverableStatus === 'audit_passed' ||
              (order.deliverable && 
              (order.deliverable.repoUrl || order.deliverable.liveDemoUrl || order.deliverable.summaryNotes || order.deliverable.submittedAt) &&
              order.deliverableStatus !== 'awaiting_submission')
            );

            // Milestone progress calculation
            const milestones = order.milestones || [];
            const releasedCount = milestones.filter(m => m.status === 'released').length;
            const totalCount = milestones.length || 1;
            const percentReleased = Math.round((releasedCount / totalCount) * 100);

            return (
              <div
                key={order.id}
                className={`p-6 sm:p-7 rounded-3xl backdrop-blur-xl transition-all shadow-2xl space-y-5 border ${
                  isDisputed
                    ? 'bg-gradient-to-b from-amber-500/10 via-zinc-950/80 to-zinc-950/90 border-amber-500/60 hover:border-amber-400 shadow-amber-950/30'
                    : isCancelled 
                    ? 'bg-zinc-950/60 border-zinc-850 opacity-80' 
                    : isPendingPayment 
                    ? 'bg-gradient-to-b from-amber-500/10 via-zinc-950/80 to-zinc-950/90 border-amber-500/40 hover:border-amber-500/60 shadow-amber-950/20' 
                    : isCompleted
                    ? 'bg-gradient-to-b from-emerald-500/5 via-zinc-950/80 to-zinc-950/90 border-emerald-500/40 hover:border-emerald-500/60 shadow-emerald-950/20'
                    : 'bg-gradient-to-b from-cyan-500/5 via-zinc-950/80 to-zinc-950/90 border-zinc-800/90 hover:border-cyan-500/50 shadow-cyan-950/20'
                }`}
              >
                {/* Order Top Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-bold text-white tracking-tight">{order.serviceTitle}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isDisputed
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm animate-pulse'
                          : isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : isInEscrow
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          : isPendingPayment
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                          : isCancelled
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {isDisputed
                          ? '⚖️ Disputed (Court Active)'
                          : isCompleted 
                          ? '✓ Completed' 
                          : isInEscrow 
                          ? '🛡️ In Escrow' 
                          : isPendingPayment 
                          ? '⏳ Pending Payment' 
                          : isCancelled 
                          ? '🚫 Cancelled by Client' 
                          : order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                      <span>Order Ref: <strong className="font-mono text-zinc-300">{order.id}</strong></span>
                      <span>•</span>
                      <span>Buyer: <strong className="text-zinc-200">{order.buyerName}</strong></span>
                      {order.createdAt && (
                        <>
                          <span>•</span>
                          <span className="text-zinc-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Total Escrow Value</span>
                    <span className={`font-mono font-black text-2xl ${isCancelled ? 'text-zinc-500 line-through' : 'text-emerald-400'}`}>
                      ${order.amount} USD
                    </span>
                  </div>
                </div>

                {/* SPECIAL BANNER 1: Pending Payment Notification + Cancel Option */}
                {isPendingPayment && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-amber-300">Awaiting PayPal Payment Authorization</h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                          Specialist tender has been drafted, but milestone escrow funds are not yet locked. Complete authorization or cancel this request.
                        </p>
                      </div>
                    </div>

                    {isOrderOwner ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setCancelTarget({ orderId: order.id, orderTitle: order.serviceTitle })}
                          disabled={cancellingOrderId === order.id}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {cancellingOrderId === order.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Ban className="h-3.5 w-3.5" />
                          )}
                          <span>Cancel Order</span>
                        </button>

                        <Link
                          href={`/?orderId=${order.id}&sessionId=${order.sessionId || `session_${order.id}`}&paypalOrderId=${order.paypalOrderId || ''}`}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1 shadow-md shadow-cyan-950/40"
                        >
                          <span>Authorize in AI Room</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    ) : (
                      <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-zinc-800 shrink-0">
                        🔒 Held for buyer: <strong className="text-zinc-200">{order.buyerName}</strong>
                      </span>
                    )}
                  </div>
                )}

                {/* SPECIAL BANNER 2: Cancelled Order Notice */}
                {isCancelled && (
                  <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex items-center gap-3 text-xs animate-fadeIn">
                    <div className="h-9 w-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                      <Ban className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-rose-300">Contract Cancelled by Client</h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        This inquiry was closed prior to PayPal escrow capture. No charges occurred and deliverable submissions are halted.
                        {order.cancelledAt && ` (Cancelled on ${new Date(order.cancelledAt).toLocaleDateString()})`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Specialist Profile & Escrow Summary Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/60">
                  {/* Specialist Info */}
                  <div className="flex items-center gap-3">
                    <img 
                      src={getSpecialistRealAvatar(order.providerName, order.providerAvatar)} 
                      alt={order.providerName} 
                      className="h-11 w-11 rounded-2xl object-cover border border-zinc-700 bg-zinc-800 shadow-md shrink-0" 
                    />
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Hired Specialist</span>
                      <h4 className="font-bold text-white text-sm">{order.providerName}</h4>
                      <p className="text-xs text-cyan-400/90 font-mono truncate max-w-[200px]">{order.providerEmail}</p>
                    </div>
                  </div>

                  {/* PayPal Credentials Audit */}
                  <div className="flex flex-col justify-center space-y-1 text-xs">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>PayPal Sandbox Order ID:</span>
                      <span className="font-mono text-amber-300 font-semibold">{order.paypalOrderId}</span>
                    </div>
                    {order.paypalCaptureId && (
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>PayPal Capture ID:</span>
                        <span className="font-mono text-emerald-400 font-semibold">{order.paypalCaptureId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deliverable Verification & Code Audit Strip (Hidden if Cancelled) */}
                {/* Deliverable Verification & Code Audit Strip (Hidden if Cancelled) */}
                {!isCancelled && (
                  <div className={`p-5 rounded-3xl border transition-all space-y-4 shadow-lg ${
                    order.deliverableStatus === 'audit_passed'
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-950/20'
                      : order.deliverableStatus === 'changes_requested'
                      ? 'bg-amber-950/20 border-amber-500/40 shadow-amber-950/20'
                      : order.deliverable
                      ? 'bg-cyan-950/20 border-cyan-500/40 shadow-cyan-950/20'
                      : 'bg-zinc-950/60 border-zinc-800/80'
                  }`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-xs shadow-md shrink-0 ${
                          order.deliverableStatus === 'audit_passed'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : order.deliverableStatus === 'changes_requested'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                        }`}>
                          <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-white tracking-tight">
                              Autonomous Deliverable &amp; Code Verification Gate
                            </h4>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                              order.deliverableStatus === 'dispute_resolved'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : order.deliverableStatus === 'audit_passed'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : order.deliverableStatus === 'changes_requested'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                : order.deliverable
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}>
                              {order.deliverableStatus === 'dispute_resolved'
                                ? '⚖️ Dispute Ruling Executed'
                                : order.deliverableStatus === 'audit_passed'
                                ? '🛡️ AI Certified (Verified)'
                                : order.deliverableStatus === 'changes_requested'
                                ? '⚠️ Revisions Requested'
                                : order.deliverable
                                ? `Deliverable v${order.deliverable.version || 1} Ready for AI Audit`
                                : isPendingPayment
                                ? 'Awaiting Payment Capture'
                                : 'Awaiting Specialist Submission'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                            {order.deliverableStatus === 'dispute_resolved'
                              ? 'Binding Quantum Meruit arbitration executed. Escrow split disbursed, client refunded, and contract successfully closed.'
                              : order.deliverableStatus === 'audit_passed'
                              ? `Audited by Gemini 2.5 Flash: Score ${order.auditCertificate?.overallScore}/100. Cryptographically verified against contract specifications.`
                              : order.deliverableStatus === 'changes_requested'
                              ? 'Revision request is active. Specialist has been notified to resolve flagged items and submit an updated version.'
                              : order.deliverable
                              ? 'Specialist has submitted deliverables. Click below to run the automated AI Code Audit & interactive inspector.'
                              : isPendingPayment
                              ? 'Once payment is authorized, specialist will begin deliverables.'
                              : 'Specialist is actively building deliverables. Automated verification will be available once submitted.'}
                          </p>
                        </div>
                      </div>

                      {/* Audit Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {order.deliverable && (
                          <>
                            {/* Primary Button: Open AI Code Inspector & Repo Chat Popup Instantly */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveModalTab('chat');
                                setActiveCertificateOrder(order);
                              }}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-purple-950/50 transition-all cursor-pointer"
                              title="Open interactive AI Code Inspector chat popup to analyze repository"
                            >
                              <Bot className="h-4 w-4 text-cyan-300" />
                              <span>🤖 AI Code Inspector &amp; Chat</span>
                            </button>

                            {/* Secondary Buttons: Audit Certificate / Run Audit */}
                            {order.deliverableStatus === 'submitted_pending_audit' || !order.auditCertificate || (order.deliverable.version || 1) > (order.auditCertificate.version || 1) ? (
                              <button
                                type="button"
                                onClick={() => handleRunAudit(order.id)}
                                disabled={auditingOrderId === order.id}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-cyan-950/40 disabled:opacity-50"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${auditingOrderId === order.id ? 'animate-spin' : ''}`} />
                                <span>{auditingOrderId === order.id ? 'Auditing Codebase...' : `⚡ Run AI Code Re-Audit (v${order.deliverable.version || 1})`}</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveModalTab('certificate');
                                    setActiveCertificateOrder(order);
                                  }}
                                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm ${
                                    order.auditCertificate.overallScore >= 80
                                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                                      : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
                                  }`}
                                  title="View detailed score breakdown, security audit, and checklist"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  <span>Certificate ({order.auditCertificate.overallScore}/100)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRunAudit(order.id)}
                                  disabled={auditingOrderId === order.id}
                                  className="px-2.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                                  title="Re-run audit on current code"
                                >
                                  <RefreshCw className={`h-3 w-3 ${auditingOrderId === order.id ? 'animate-spin' : ''}`} />
                                  <span>{auditingOrderId === order.id ? 'Auditing...' : 'Re-Audit'}</span>
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* STRUCTURED DELIVERABLE INSPECTION CARDS */}
                    {order.deliverable && (
                      <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                        {/* Row 1: Code Repository & Live Preview Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* GitHub Repository Card */}
                          <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-cyan-500/40 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cyan-400 shrink-0">
                                <Github className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] uppercase font-mono font-bold text-zinc-500 block">
                                  GitHub Repository
                                </span>
                                <span className="font-mono text-xs text-white truncate block">
                                  {order.deliverable.repoUrl || 'No public repository attached'}
                                </span>
                              </div>
                            </div>

                            {order.deliverable.repoUrl && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(order.deliverable!.repoUrl!, `repo-${order.id}`)}
                                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                                  title="Copy Repository URL"
                                >
                                  {copiedLinkKey === `repo-${order.id}` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                                <a
                                  href={order.deliverable.repoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 hover:text-white font-mono text-[11px] font-bold flex items-center gap-1 transition-colors"
                                >
                                  <span>View Code</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Live Prototype / Deployment Preview Card */}
                          <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 shrink-0">
                                <Globe className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] uppercase font-mono font-bold text-zinc-500 block">
                                  Live Demo / Deployment
                                </span>
                                <span className="font-mono text-xs text-white truncate block">
                                  {order.deliverable.liveDemoUrl || 'Live preview not attached (inspect repository code)'}
                                </span>
                              </div>
                            </div>

                            {order.deliverable.liveDemoUrl && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(order.deliverable!.liveDemoUrl!, `demo-${order.id}`)}
                                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                                  title="Copy Live Preview URL"
                                >
                                  {copiedLinkKey === `demo-${order.id}` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                                <a
                                  href={order.deliverable.liveDemoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-white font-mono text-[11px] font-bold flex items-center gap-1 transition-colors"
                                >
                                  <span>Open App</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Row 2: Specialist Technical Walkthrough Notes */}
                        {order.deliverable.summaryNotes && (
                          <div className="p-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800/80 space-y-1">
                            <div className="flex items-center gap-1.5 text-zinc-400 font-bold text-[11px]">
                              <FileText className="h-3.5 w-3.5 text-amber-400" />
                              <span>Specialist Architectural Notes &amp; Handover Scope:</span>
                            </div>
                            <p className="text-xs text-zinc-200 leading-relaxed pl-5 italic border-l-2 border-amber-500/40">
                              &ldquo;{order.deliverable.summaryNotes}&rdquo;
                            </p>
                          </div>
                        )}

                        {/* Row 3: Setup & Test Instructions */}
                        {order.deliverable.testInstructions && (
                          <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-300 truncate">
                              <Terminal className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                              <span className="text-zinc-500">Run:</span>
                              <code className="text-cyan-300 font-bold">{order.deliverable.testInstructions}</code>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(order.deliverable!.testInstructions!, `run-${order.id}`)}
                              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-[10px] font-mono flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                            >
                              {copiedLinkKey === `run-${order.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                              <span>{copiedLinkKey === `run-${order.id}` ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        )}

                        {/* Row 4: Active Revision Notice (if revisions were requested and order is not completed/released) */}
                        {order.deliverableStatus === 'changes_requested' && order.revisionNotes && order.status !== 'completed' && !(Array.isArray(order.milestones) && order.milestones.length > 0 && order.milestones.every((m: any) => m.status === 'released')) && (
                          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5 animate-fadeIn">
                            <div className="flex items-center justify-between">
                              <span className="text-amber-300 font-bold flex items-center gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                                <span>Pending Revision Sent to Specialist</span>
                              </span>
                              {order.revisionRequestedAt && (
                                <span className="text-[10px] font-mono text-zinc-400">
                                  {new Date(order.revisionRequestedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <p className="text-amber-100 font-mono text-[11px] pl-5 border-l-2 border-amber-500/40">
                              {order.revisionNotes}
                            </p>
                          </div>
                        )}

                        {/* Submission Metadata Footnote */}
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1">
                          <span>Deliverable Version: #{order.deliverable.version || 1} • Submitted on {new Date(order.deliverable.submittedAt).toLocaleString()}</span>
                          <span className="text-emerald-400 font-semibold">Specialist Payout Ready upon Client Escrow Approval</span>
                        </div>

                        {/* Deliverable Submission & Version History Section */}
                        {(order.deliverable || (order.deliverableHistory && order.deliverableHistory.length > 0)) && (
                          <div className="pt-2">
                            <DeliverableHistoryView
                              currentDeliverable={order.deliverable}
                              currentCertificate={order.auditCertificate}
                              history={order.deliverableHistory || []}
                              onOpenAuditModal={() => {
                                setActiveModalTab('chat');
                                setActiveCertificateOrder(order);
                              }}
                              onRunReAudit={() => handleRunAudit(order.id)}
                              isAuditing={auditingOrderId === order.id}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Structured Milestone Tranches & Release Buttons */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-cyan-400" />
                      <span>Agreed Milestone Verification Tranches</span>
                    </span>

                    {/* Tranche Progress Indicator */}
                    {!isCancelled && milestones.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-zinc-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${percentReleased}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {releasedCount}/{totalCount} Released ({percentReleased}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {isCancelled ? (
                    <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-500 flex items-center gap-2">
                      <Ban className="h-4 w-4 text-zinc-600" />
                      <span>Milestone tranches voided due to contract cancellation. No funds will be released.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {milestones.length > 0 ? (
                        milestones.map((m, mIdx) => {
                          const isDisputeSettled = order.arbitrationRuling?.status === 'EXECUTED_SETTLED' || order.deliverableStatus === 'dispute_resolved';
                          const isReleased = m.status === 'released' && !isDisputeSettled;
                          const isReleasing = releasingIndex?.orderId === order.id && releasingIndex?.mIdx === mIdx;

                          return (
                            <div
                              key={m.id || mIdx}
                              className={`p-4 rounded-2xl border transition-all space-y-3 ${
                                isDisputeSettled
                                  ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                                  : isReleased
                                  ? 'bg-emerald-950/20 border-emerald-500/30'
                                  : 'bg-zinc-900/80 border-zinc-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                                    Tranche #{mIdx + 1}
                                  </span>
                                  <h5 className="font-semibold text-white text-xs">{m.title}</h5>
                                </div>
                                <span className="font-mono font-bold text-sm text-cyan-300">
                                  ${m.amount} USD
                                </span>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[11px]">
                                <span className={`flex items-center gap-1.5 font-semibold ${
                                  isDisputeSettled
                                    ? 'text-amber-300'
                                    : isReleased 
                                    ? 'text-emerald-400' 
                                    : isPendingPayment 
                                    ? 'text-amber-400' 
                                    : 'text-cyan-400'
                                }`}>
                                  {isDisputeSettled ? (
                                    <>
                                      <Scale className="h-3.5 w-3.5 text-amber-400" />
                                      <span>{mIdx === 0 ? '✓ Funds Released Earlier' : '⚖️ Settled via Arbitration Ruling'}</span>
                                    </>
                                  ) : isReleased ? (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>Funds Released</span>
                                    </>
                                  ) : isPendingPayment ? (
                                    <>
                                      <Clock className="h-3.5 w-3.5" />
                                      <span>Awaiting Escrow Deposit</span>
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="h-3.5 w-3.5" />
                                      <span>Locked in Escrow</span>
                                    </>
                                  )}
                                </span>

                                {isDisputeSettled ? (
                                  <span 
                                    className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10.5px] font-mono flex items-center gap-1.5 font-bold shadow-sm"
                                    title={`Binding Quantum Meruit Split Executed: Specialist received $${order.arbitrationRuling?.specialistPayoutAmount || 120} USD total ($80 earlier + $40 now), Client refunded $${order.arbitrationRuling?.clientRefundAmount || 40} USD.`}
                                  >
                                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                    <span>{mIdx === 0 ? 'Paid to Specialist ($80)' : 'Split Executed ($40 Paid / $40 Refunded)'}</span>
                                  </span>
                                ) : !isReleased && !isPendingPayment && (
                                  !isOrderOwner ? (
                                    <span 
                                      className="px-2.5 py-1 rounded-xl bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 text-[10.5px] font-mono flex items-center gap-1.5"
                                      title={`This escrow milestone belongs to ${order.buyerName}. Only the verified buyer may release funds.`}
                                    >
                                      <Lock className="h-3 w-3 text-cyan-400" />
                                      <span>Protected Escrow ({order.buyerName?.split(' ')[0] || 'Buyer'})</span>
                                    </span>
                                  ) : isDeliverableSubmitted ? (
                                    <button
                                      onClick={() => handleOpenReleaseModal(order, mIdx)}
                                      disabled={isReleasing}
                                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-bold text-[11px] flex items-center gap-1 shadow-md shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-50"
                                      title="Approve deliverable and disburse escrow tranche to provider"
                                    >
                                      {isReleasing ? (
                                        <span className="animate-spin">⏳</span>
                                      ) : (
                                        <CheckCircle2 className="h-3 w-3" />
                                      )}
                                      <span>Approve & Release ${m.amount}</span>
                                    </button>
                                  ) : (
                                    <span 
                                      className="px-2.5 py-1 rounded-xl bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 text-[10.5px] font-mono flex items-center gap-1.5 cursor-not-allowed" 
                                      title="Milestone release is locked until the specialist submits completed deliverables in their workspace"
                                    >
                                      <Lock className="h-3 w-3 text-amber-400/80" />
                                      <span>Locked (Awaiting Deliverable)</span>
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 col-span-2">
                          Single-tranche milestone of ${order.amount} USD.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Footer Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-zinc-800/80 text-xs">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Clock className="h-3.5 w-3.5 text-cyan-400" />
                    <span>
                      {isCancelled 
                        ? 'Project closed. No further obligations.' 
                        : 'Turnaround: 3 Business Days with milestone escrow protection.'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {!isCancelled && (
                      <button
                        onClick={() => setActiveInvoiceOrder(order)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-cyan-300 hover:text-white font-semibold text-xs border border-cyan-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      >
                        <FileText className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Smart Tax Invoice</span>
                      </button>
                    )}

                    {!isCancelled && (
                      <button
                        onClick={() => setActiveDisputeOrder(order)}
                        className={`px-3 py-1.5 rounded-xl font-semibold text-xs border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                          isDisputed
                            ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold hover:bg-amber-400 shadow-amber-950/50'
                            : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/40 hover:border-amber-400'
                        }`}
                        title="Convene Autonomous AI Dispute Resolution Court (AgentPay LexGuard™)"
                      >
                        <Scale className={`h-3.5 w-3.5 ${isDisputed ? 'text-zinc-950' : 'text-amber-400'}`} />
                        <span>{isDisputed ? '⚖️ View Dispute Ruling' : 'AI Dispute Court'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => setActiveChatOrder({
                        channelId: order.id,
                        orderId: order.id,
                        orderTitle: order.serviceTitle,
                        providerName: order.providerName,
                        providerId: order.providerId,
                        sessionId: order.sessionId,
                        orderAmount: order.amount,
                        escrowStatus: order.status
                      })}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs border border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Quick pop-up message with specialist"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Quick Message</span>
                    </button>

                    <Link
                      href={`/?tab=specialists&providerId=${order.providerId || ''}&orderId=${order.id}&sessionId=${order.sessionId || ''}&providerName=${encodeURIComponent(order.providerName)}`}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-600/20 hover:from-emerald-500/30 hover:to-teal-600/30 text-emerald-300 hover:text-white font-semibold text-xs border border-emerald-500/40 flex items-center gap-1.5 transition-all shadow-sm"
                      title="Open full specialist chat room workspace for this contract"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Specialist Chat</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>

                    <Link
                      href={`/?orderId=${order.id}&sessionId=${order.sessionId || `session_${order.id}`}&paypalOrderId=${order.paypalOrderId || ''}`}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 text-cyan-300 hover:text-white font-semibold text-xs border border-cyan-500/40 flex items-center gap-1.5 transition-all shadow-sm"
                      title="Open autonomous AI procurement chat room for this contract"
                    >
                      <Bot className="h-3.5 w-3.5 text-cyan-400" />
                      <span>AI Chat Room</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
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
          providerId={activeChatOrder.providerId}
          sessionId={activeChatOrder.sessionId}
          isPurchasedOrder={true}
          orderAmount={activeChatOrder.orderAmount}
          escrowStatus={activeChatOrder.escrowStatus}
        />
      )}

      {/* AI Verification Certificate & Interactive Code Inspector Modal */}
      {activeCertificateOrder && (
        <AiAuditCertificateModal
          key={activeCertificateOrder.id + (activeCertificateOrder.auditCertificate?.auditHash || '-audit')}
          isOpen={!!activeCertificateOrder}
          onClose={() => setActiveCertificateOrder(null)}
          orderId={activeCertificateOrder.id}
          orderTitle={activeCertificateOrder.serviceTitle}
          buyerName={activeCertificateOrder.buyerName}
          providerName={activeCertificateOrder.providerName}
          orderAmount={activeCertificateOrder.amount}
          certificate={activeCertificateOrder.auditCertificate}
          deliverable={activeCertificateOrder.deliverable}
          initialTab={activeModalTab}
          isAuditing={auditingOrderId === activeCertificateOrder.id}
          onRunAudit={() => handleRunAudit(activeCertificateOrder.id)}
          onReleaseEscrow={() => handleOpenReleaseModal(activeCertificateOrder, 0)}
          onRequestRevisions={(notes, issues) => {
            setOrders(prev => prev.map(o => o.id === activeCertificateOrder.id ? {
              ...o,
              deliverableStatus: 'changes_requested',
              revisionNotes: notes,
              revisionIssues: issues,
              revisionRequestedAt: new Date().toISOString()
            } : o));
            setSystemNotice({
              isOpen: true,
              title: 'Revisions Transmitted to Specialist',
              message: `⚠️ Action Notice: Detailed revision punch-list has been sent to ${activeCertificateOrder.providerName}. The specialist can view issues and submit updated deliverables in their Provider Workspace.`,
              type: 'warning'
            });
          }}
        />
      )}

      {/* Autonomous AI Dispute Resolution Court Modal (Gemini 2.5 Flash Legal Engine) */}
      {activeDisputeOrder && (
        <AiDisputeModal
          key={activeDisputeOrder.id + '-dispute'}
          isOpen={!!activeDisputeOrder}
          onClose={() => setActiveDisputeOrder(null)}
          orderId={activeDisputeOrder.id}
          orderTitle={activeDisputeOrder.serviceTitle}
          buyerName={activeDisputeOrder.buyerName}
          providerName={activeDisputeOrder.providerName}
          orderAmount={activeDisputeOrder.amount}
          initialRuling={(activeDisputeOrder as any).arbitrationRuling || null}
          deliverableRepoUrl={activeDisputeOrder.deliverable?.repoUrl}
          onSettlementExecuted={(settlementData) => {
            fetchOrders();
            setSystemNotice({
              isOpen: true,
              title: 'AI Arbitration Settlement Executed',
              message: `⚖️ Ruling Executed: ${settlementData.message || 'Escrow split executed and recorded in the Master Ledger.'}`,
              type: 'success'
            });
          }}
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

      {/* System Protocol Notice Modal (Zero browser alert()) */}
      {systemNotice?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div 
            className="relative w-full max-w-md p-6 rounded-3xl bg-zinc-950 border border-amber-500/40 shadow-2xl shadow-amber-950/40 text-left space-y-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  systemNotice.type === 'error'
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                    : systemNotice.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                }`}>
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm sm:text-base">{systemNotice.title}</h4>
                  <p className="text-[11px] text-zinc-400 font-mono">AgentPay Safe Spending & Escrow Protocol</p>
                </div>
              </div>
              <button
                onClick={() => setSystemNotice(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
              {systemNotice.message}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setSystemNotice(null)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-md shadow-amber-950/40 transition-all cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Escrow Release Confirmation Modal (Zero browser window.confirm!) */}
      {releaseTarget && (
        <EscrowReleaseConfirmModal
          isOpen={!!releaseTarget}
          onClose={() => setReleaseTarget(null)}
          onConfirm={executeReleaseMilestone}
          isReleasing={Boolean(releasingIndex && releasingIndex.orderId === releaseTarget.order.id && releasingIndex.mIdx === releaseTarget.milestone.index)}
          order={releaseTarget.order}
          milestone={releaseTarget.milestone}
        />
      )}

      {/* Premium Cancel Contract Confirmation Modal */}
      {cancelTarget && (
        <CancelContractConfirmModal
          isOpen={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={executeCancelOrder}
          isCancelling={cancellingOrderId === cancelTarget.orderId}
          orderTitle={cancelTarget.orderTitle}
          orderId={cancelTarget.orderId}
        />
      )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#090A0F] text-zinc-400 p-8 flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        <span className="text-xs font-mono">Loading Escrow Orders...</span>
      </div>
    }>
      <OrdersPageContent />
    </Suspense>
  );
}
