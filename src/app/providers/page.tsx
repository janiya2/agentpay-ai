'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import type { AgentPayOrder, ServiceProvider } from '@/types';
import { 
  ShieldCheck, CheckCircle2, Clock, CreditCard, ExternalLink, 
  Send, Sparkles, UserCheck, MessageSquare, AlertCircle, ArrowRight, User, Ban
} from 'lucide-react';
import DirectChatModal from '@/components/DirectChatModal';

export default function ProviderPortalPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'inquiries' | 'orders'>('inquiries');
  const [orders, setOrders] = useState<AgentPayOrder[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingSessionId, setRespondingSessionId] = useState<string | null>(null);
  const [customBidPrice, setCustomBidPrice] = useState<{ [sid: string]: number }>({});
  const [customDeliveryDays, setCustomDeliveryDays] = useState<{ [sid: string]: number }>({});
  const [customReplyNote, setCustomReplyNote] = useState<{ [sid: string]: string }>({});
  const [responseNotice, setResponseNotice] = useState<string | null>(null);

  // Direct Chat Modal State
  const [activeChatOrder, setActiveChatOrder] = useState<{
    orderId: string;
    orderTitle: string;
    clientName: string;
  } | null>(null);

  useEffect(() => {
    async function loadInitialProviders() {
      try {
        const snap = await getDocs(collection(db, 'agentpay_providers'));
        if (!snap.empty) {
          const list = snap.docs.map(d => d.data() as ServiceProvider);
          setProviders(list);
          if (list.length > 0) {
            if (typeof window !== 'undefined') {
              const urlParams = new URLSearchParams(window.location.search);
              const provParam = urlParams.get('providerId');
              if (provParam && list.some(p => p.id === provParam)) {
                setSelectedProviderId(provParam);
                return;
              }
            }
            setSelectedProviderId(list[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching providers:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialProviders();
  }, []);

  const activeProvider = providers.find(p => p.id === selectedProviderId) || providers[0];

  // Fetch orders and incoming tender RFQs
  const loadProviderData = async () => {
    if (!activeProvider) return;

    try {
      // 1. Fetch Orders
      const allOrdersSnap = await getDocs(collection(db, 'agentpay_orders'));
      if (!allOrdersSnap.empty) {
        const allList = allOrdersSnap.docs.map(d => d.data() as AgentPayOrder);
        const filtered = allList.filter(o => 
          o.providerId === activeProvider.id || 
          o.providerName?.toLowerCase() === activeProvider.name?.toLowerCase()
        );
        setOrders(filtered.length > 0 ? filtered : allList.slice(0, 3));
      }

      // 2. Fetch Incoming Tenders & RFQs
      const sessionsSnap = await getDocs(collection(db, 'agentpay_chat_sessions'));
      if (!sessionsSnap.empty) {
        const allSessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const matching = allSessions.filter((s: any) => {
          const targets = s.targetProviders || [];
          const isInTargets = targets.some((tp: any) => tp.id === activeProvider.id || tp.name === activeProvider.name);
          const isDirect = s.providerId === activeProvider.id || s.providerMatched === activeProvider.name;
          return (isInTargets || isDirect) && (s.status === 'tender_open' || s.status === 'awaiting_provider' || s.status === 'closed_awarded' || s.status === 'negotiated');
        });
        setInquiries(matching);
      }
    } catch (err) {
      console.warn('Load provider data:', err);
    }
  };

  useEffect(() => {
    if (activeProvider) {
      loadProviderData();
    }
  }, [selectedProviderId, activeProvider]);

  // Handle Provider Submitting Bid
  const handleSubmitBid = async (sessionId: string) => {
    setRespondingSessionId(sessionId);
    try {
      const price = customBidPrice[sessionId] || 160;
      const days = customDeliveryDays[sessionId] || 3;
      const note = customReplyNote[sessionId] || 'I have verified capacity and will deliver within 3 days with full code documentation.';

      const res = await fetch('/api/providers/submit-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          providerId: activeProvider.id,
          bidPrice: Number(price),
          deliveryDays: Number(days),
          note
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResponseNotice(`🎉 Success: Bid of $${price} USD submitted to client!`);
        setTimeout(() => setResponseNotice(null), 6000);
        await loadProviderData();
      } else {
        alert(data.error || 'Failed to submit bid');
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setRespondingSessionId(null);
    }
  };

  const handleDeliverMilestone = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'agentpay_orders', orderId);
      await updateDoc(orderRef, {
        status: 'completed',
        deliverableUrl: 'https://github.com/innoxpert-showcase/final-deliverable-package',
        updatedAt: new Date().toISOString()
      });

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'completed' } : o));
      alert('🎉 Deliverable submitted! Client notified to review and release funds.');
    } catch (err: any) {
      alert(`Error submitting deliverable: ${err.message}`);
    }
  };

  const pendingTendersCount = inquiries.filter(i => i.status === 'tender_open' || i.status === 'awaiting_provider').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full space-y-8 animate-fadeIn">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Service Provider Workspace</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-400">
              Talent Portal
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Review incoming AI agent tenders, submit competitive milestone bids, manage PayPal escrows, and collaborate.
          </p>
        </div>

        {/* Provider Selector */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl px-3.5 py-2 text-xs">
          <UserCheck className="h-4 w-4 text-cyan-400" />
          <span className="text-zinc-400 font-medium">Active Specialist:</span>
          <select
            value={selectedProviderId}
            onChange={e => setSelectedProviderId(e.target.value)}
            className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
          >
            {providers.slice(0, 20).map(p => (
              <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                {p.name} ({p.title.slice(0, 28)}...)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Response Notice Toast */}
      {responseNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/30 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="font-bold">{responseNotice}</p>
          </div>
          <button 
            onClick={() => setResponseNotice(null)}
            className="text-xs text-emerald-400 hover:text-white font-mono px-2 py-0.5 rounded cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Provider Snapshot Card */}
      {activeProvider && (
        <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
          <div className="flex items-center gap-4">
            <img src={activeProvider.avatarUrl} alt={activeProvider.name} className="h-16 w-16 rounded-2xl bg-zinc-800 border border-zinc-700 shadow-md" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{activeProvider.name}</h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/30">
                  Verified Talent
                </span>
              </div>
              <p className="text-xs text-zinc-400">{activeProvider.title}</p>
              <p className="text-xs text-cyan-400 font-mono">{activeProvider.contactEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6 text-center">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Standard Rate</span>
              <span className="text-lg font-black font-mono text-emerald-400">${activeProvider.hourlyRate}/hr</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Job Score</span>
              <span className="text-lg font-black font-mono text-amber-400">⭐ {activeProvider.rating}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Jobs Completed</span>
              <span className="text-lg font-black font-mono text-cyan-400">{activeProvider.completedJobs}</span>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-1">
        <button
          onClick={() => setActiveTab('inquiries')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'inquiries'
              ? 'bg-zinc-800 text-cyan-300 border border-zinc-700 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Incoming AI Tenders</span>
          {pendingTendersCount > 0 && (
            <span className="h-5 px-2 rounded-full bg-cyan-500 text-zinc-950 font-black text-[10px] flex items-center justify-center animate-pulse">
              {pendingTendersCount} Open
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-zinc-800 text-cyan-300 border border-zinc-700 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Active Escrow Orders ({orders.length})</span>
        </button>
      </div>

      {/* TAB 1: Incoming AI Negotiations & Tenders */}
      {activeTab === 'inquiries' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>Incoming Autonomous RFQ Tenders</span>
            </h3>
            <span className="text-xs text-zinc-500">
              Real-time project scopes transmitted to {activeProvider?.name}
            </span>
          </div>

          {inquiries.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-zinc-900/20 border border-zinc-800/60 text-xs text-zinc-500 space-y-2">
              <Sparkles className="h-8 w-8 text-zinc-600 mx-auto" />
              <p>No active project tenders currently open for {activeProvider?.name}.</p>
              <p className="text-[11px] text-zinc-600">
                Tip: Go to AI Agent Chat, search for a service matching {activeProvider?.name.split(' ')[0]}, and click &quot;Dispatch Tender&quot;!
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {inquiries.map((inq) => {
                const isOpen = inq.status === 'tender_open' || inq.status === 'awaiting_provider';
                const isClosed = inq.status === 'closed_awarded' || inq.status === 'escrow_created';
                const isWinner = isClosed && (inq.winningBid?.providerId === activeProvider.id || inq.providerId === activeProvider.id);
                const isOutbidLate = isClosed && !isWinner;
                const isResponding = respondingSessionId === inq.id;

                // Check if active provider already submitted a bid for this tender
                const myExistingBid = (inq.bids || []).find((b: any) => b.providerId === activeProvider.id);

                return (
                  <div
                    key={inq.id}
                    className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-cyan-500/40 transition-all shadow-xl space-y-4"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <h4 className="font-bold text-white text-base">
                            {inq.projectScope || inq.latestPrompt || 'Autonomous Milestone Deliverable'}
                          </h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            isOpen
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                              : isWinner
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}>
                            {isOpen ? '⏳ Tender Open for Bids' : isWinner ? '🏆 Contract Awarded to You' : '🚫 Opportunity Closed (Late)'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Client: <strong className="text-white">{inq.buyerName || 'Client'}</strong> ({inq.buyerEmail || 'client@agentpay.network'}) • Client Budget Cap: <strong className="text-cyan-300">${inq.spendingLimit || 200} USD</strong>
                        </p>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Max Budget Cap</span>
                        <span className="font-mono font-black text-xl text-emerald-400">
                          ${inq.spendingLimit || 200} USD
                        </span>
                      </div>
                    </div>

                    {/* Dialogue History */}
                    {inq.negotiationDialog && inq.negotiationDialog.length > 0 && (
                      <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-2.5 text-xs">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold block">
                          Autonomous Tender Transmissions:
                        </span>
                        {inq.negotiationDialog.map((diag: any, dIdx: number) => (
                          <div
                            key={dIdx}
                            className={`p-3 rounded-xl space-y-1 ${
                              diag.speaker === 'agent'
                                ? 'bg-cyan-950/20 border border-cyan-500/30 text-cyan-100'
                                : 'bg-purple-950/20 border border-purple-500/30 text-purple-100'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className={diag.speaker === 'agent' ? 'text-cyan-400 font-mono' : 'text-purple-300 font-mono'}>
                                {diag.speakerName}
                              </span>
                              <span className="text-zinc-500 font-mono">{diag.timestamp}</span>
                            </div>
                            <p className="text-zinc-200 text-[11.5px] leading-relaxed">{diag.message}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CASE 1: Opportunity Closed / Late Bid Notice (Exact edge-case Janitha described) */}
                    {isOutbidLate && (
                      <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-rose-300 font-bold">
                          <Ban className="h-4 w-4 text-rose-400 shrink-0" />
                          <span>🚫 Opportunity Closed (Contract Already Awarded)</span>
                        </div>
                        <p className="text-zinc-300 leading-relaxed pl-6">
                          The client has already awarded this project to <strong className="text-white">{inq.winningBid?.providerName || 'another specialist'}</strong> for <strong className="text-emerald-400">${inq.winningBid?.bidPrice || inq.amount} USD</strong> and authorized PayPal Milestone Escrow. Bidding is now locked for this tender. Thank you for your interest!
                        </p>
                      </div>
                    )}

                    {/* CASE 2: You Won the Contract */}
                    {isWinner && (
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                          <div>
                            <p className="font-bold">🎉 Congratulations! The client accepted your bid and funded the milestone escrow.</p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">Please switch to the Active Escrow Orders tab to submit deliverables and chat with the client.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CASE 3: Already Submitted Bid, Awaiting Client Decision */}
                    {isOpen && myExistingBid && (
                      <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-cyan-300 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                            <span>Your Bid of ${myExistingBid.bidPrice} USD is Live!</span>
                          </span>
                          <span className="font-mono text-zinc-400 text-[10px]">Submitted at {myExistingBid.submittedAt}</span>
                        </div>
                        <p className="text-zinc-300 pl-6 text-[11px]">
                          Turnaround: <strong>{myExistingBid.deliveryDays} Days</strong> • Note: &quot;{myExistingBid.note}&quot; • <em>Awaiting client decision in chat.</em>
                        </p>
                      </div>
                    )}

                    {/* CASE 4: Tender Open & Ready to Submit Bid */}
                    {isOpen && !myExistingBid && (
                      <div className="pt-2 border-t border-zinc-800 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Your Bid Price (USD)</label>
                            <input
                              type="number"
                              value={customBidPrice[inq.id] || 160}
                              onChange={e => setCustomBidPrice({ ...customBidPrice, [inq.id]: Number(e.target.value) })}
                              min="30"
                              max={inq.spendingLimit || 500}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Delivery Turnaround (Days)</label>
                            <input
                              type="number"
                              value={customDeliveryDays[inq.id] || 3}
                              onChange={e => setCustomDeliveryDays({ ...customDeliveryDays, [inq.id]: Number(e.target.value) })}
                              min="1"
                              max="14"
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Technical Note to Client</label>
                          <input
                            type="text"
                            value={customReplyNote[inq.id] || ''}
                            onChange={e => setCustomReplyNote({ ...customReplyNote, [inq.id]: e.target.value })}
                            placeholder="e.g. 'I will deliver Next.js 15 with App Router, Tailwind and full documentation in 3 days'..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-1">
                          <button
                            onClick={() => handleSubmitBid(inq.id)}
                            disabled={isResponding}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isResponding ? <span className="animate-spin">⏳</span> : <Send className="h-3.5 w-3.5" />}
                            <span>Submit Competitive Bid (${customBidPrice[inq.id] || 160} USD)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Active PayPal Escrow Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-cyan-400" />
            <span>Active Funded PayPal Milestone Contracts</span>
          </h3>

          {orders.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-zinc-900/30 border border-zinc-800/60 text-xs text-zinc-500 space-y-2">
              <CreditCard className="h-8 w-8 text-zinc-600 mx-auto" />
              <p>No active funded orders currently assigned to {activeProvider?.name}.</p>
              <p className="text-[11px] text-zinc-600">Once a client authorizes a PayPal milestone escrow, it will appear here!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {orders.map(order => (
                <div
                  key={order.id}
                  className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-cyan-500/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-white">{order.serviceTitle}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        order.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {order.status === 'completed' ? '✓ Completed' : '🛡️ In Escrow'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Client: <strong className="text-zinc-200">{order.buyerName}</strong> ({order.buyerEmail})
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      Order Ref: #{order.id} • PayPal Order: {order.paypalOrderId || 'Live'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="text-right pr-2">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Locked Escrow</span>
                      <span className="font-mono font-black text-xl text-emerald-400">${order.amount} USD</span>
                    </div>

                    {/* Direct Client Chat Button */}
                    <button
                      onClick={() => setActiveChatOrder({
                        orderId: order.id,
                        orderTitle: order.serviceTitle,
                        clientName: order.buyerName
                      })}
                      className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs border border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Chat with Client</span>
                    </button>

                    {order.status !== 'completed' ? (
                      <button
                        onClick={() => handleDeliverMilestone(order.id)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Submit Deliverable</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-xs border border-emerald-500/30 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Funds Released</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Direct Collaboration Modal */}
      {activeChatOrder && (
        <DirectChatModal
          isOpen={!!activeChatOrder}
          onClose={() => setActiveChatOrder(null)}
          orderId={activeChatOrder.orderId}
          orderTitle={activeChatOrder.orderTitle}
          currentUserRole="provider"
          currentUserName={activeProvider.name}
          otherPartyName={activeChatOrder.clientName}
        />
      )}
    </div>
  );
}
