'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import type { AgentPayOrder, ServiceProvider } from '@/types';
import { 
  ShieldCheck, CheckCircle2, Clock, CreditCard, ExternalLink, 
  Send, Sparkles, UserCheck, MessageSquare, AlertCircle, ArrowRight, User
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
            // Check if providerId was passed in URL query param
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

  // Fetch orders and incoming inquiries for selected provider
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

      // 2. Fetch Incoming Inquiries from agentpay_chat_sessions
      const sessionsSnap = await getDocs(collection(db, 'agentpay_chat_sessions'));
      if (!sessionsSnap.empty) {
        const allSessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Filter sessions that are awaiting this provider or matched with this provider
        const matchingInquiries = allSessions.filter((s: any) => 
          (s.providerId === activeProvider.id || 
           s.providerMatched?.toLowerCase() === activeProvider.name?.toLowerCase() ||
           s.negotiatedDeal?.providerName?.toLowerCase() === activeProvider.name?.toLowerCase()) &&
          (s.status === 'awaiting_provider' || s.status === 'inquiry' || s.status === 'negotiated')
        );
        setInquiries(matchingInquiries);
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

  // Handle Provider Accepting Proposal
  const handleAcceptProposal = async (sessionId: string) => {
    setRespondingSessionId(sessionId);
    try {
      const note = customReplyNote[sessionId] || '';
      const res = await fetch('/api/providers/respond-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: 'accept',
          message: note
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResponseNotice(`🎉 Success: Agreement Codified! PayPal order generated for client authorization.`);
        setTimeout(() => setResponseNotice(null), 6000);
        await loadProviderData();
      } else {
        alert(`Response Error: ${data.error || 'Failed to accept'}`);
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

  const pendingInquiriesCount = inquiries.filter(i => i.status === 'awaiting_provider').length;

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
            Review incoming AI agent inquiries, respond to client proposals, manage PayPal escrows, and collaborate.
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
            className="text-xs text-emerald-400 hover:text-white font-mono px-2 py-0.5 rounded"
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
          <span>Incoming AI Negotiations</span>
          {pendingInquiriesCount > 0 && (
            <span className="h-5 px-2 rounded-full bg-cyan-500 text-zinc-950 font-black text-[10px] flex items-center justify-center animate-pulse">
              {pendingInquiriesCount} New
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

      {/* TAB 1: Incoming AI Negotiations */}
      {activeTab === 'inquiries' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>Incoming Autonomous Contract Inquiries</span>
            </h3>
            <span className="text-xs text-zinc-500">
              Proposals sent by AgentPay Commerce Bot on behalf of clients
            </span>
          </div>

          {inquiries.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-zinc-900/20 border border-zinc-800/60 text-xs text-zinc-500 space-y-2">
              <Sparkles className="h-8 w-8 text-zinc-600 mx-auto" />
              <p>No active inquiries currently waiting for {activeProvider?.name}.</p>
              <p className="text-[11px] text-zinc-600">
                To test: Go to the main AI Agent Chat, request a service matching {activeProvider?.name.split(' ')[0]}, and select &quot;Negotiate&quot;!
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {inquiries.map((inq) => {
                const isAwaiting = inq.status === 'awaiting_provider';
                const isNegotiated = inq.status === 'negotiated' || inq.status === 'escrow_created';
                const deal = inq.negotiatedDeal || {};
                const isResponding = respondingSessionId === inq.id;

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
                            {deal.scopeTitle || inq.latestPrompt || 'Project Contract Proposal'}
                          </h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            isAwaiting
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {isAwaiting ? '⏳ Awaiting Your Acceptance' : '✓ Agreement Codified'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Client: <strong className="text-white">{inq.buyerName || 'Client'}</strong> ({inq.buyerEmail || 'client@agentpay.network'}) • Budget Cap: <strong className="text-cyan-300">${inq.spendingLimit || 200} USD</strong>
                        </p>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Proposed Escrow Rate</span>
                        <span className="font-mono font-black text-xl text-emerald-400">
                          ${deal.negotiatedPrice || inq.negotiatedPrice || 160} USD
                        </span>
                      </div>
                    </div>

                    {/* Dialogue History */}
                    {inq.negotiationDialog && inq.negotiationDialog.length > 0 && (
                      <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-2.5 text-xs">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold block">
                          Autonomous Protocol Dialogue History:
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

                    {/* Milestone Breakdown */}
                    {deal.milestones && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
                          Proposed Milestone Structure:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {deal.milestones.map((m: any, mIdx: number) => (
                            <div key={mIdx} className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between text-xs">
                              <span className="text-zinc-300 truncate max-w-[200px]">{m.title}</span>
                              <span className="font-mono font-bold text-cyan-400">${m.amount} USD</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interactive Response Bar */}
                    {isAwaiting && (
                      <div className="pt-2 border-t border-zinc-800 space-y-3">
                        <input
                          type="text"
                          value={customReplyNote[inq.id] || ''}
                          onChange={e => setCustomReplyNote({ ...customReplyNote, [inq.id]: e.target.value })}
                          placeholder="Optional note to client (e.g. 'Accepted! Ready to start work immediately on Milestone 1')..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                        />

                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleAcceptProposal(inq.id)}
                            disabled={isResponding}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isResponding ? <span className="animate-spin">⏳</span> : <CheckCircle2 className="h-4 w-4" />}
                            <span>Accept Terms & Codify Agreement (${deal.negotiatedPrice || 160} USD)</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {isNegotiated && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span>Agreement codified! Awaiting client authorization in PayPal Smart Escrow.</span>
                        </div>
                        {inq.paypalOrderId && (
                          <span className="font-mono text-[10px] text-zinc-400">PayPal ID: {inq.paypalOrderId}</span>
                        )}
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
