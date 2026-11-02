'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { AgentPayOrder } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { 
  CreditCard, ShieldCheck, CheckCircle2, Clock, ExternalLink, 
  RefreshCw, Bot, User, ArrowRight, Sparkles, AlertCircle, FileText, Lock, MessageSquare
} from 'lucide-react';
import DirectChatModal from '@/components/DirectChatModal';

export default function OrdersPage() {
  const { user, openAuthModal } = useAuth();
  const [orders, setOrders] = useState<AgentPayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my_orders' | 'all_ledger'>('my_orders');
  const [releasingIndex, setReleasingIndex] = useState<{ orderId: string; mIdx: number } | null>(null);
  const [releaseSuccessMsg, setReleaseSuccessMsg] = useState<string | null>(null);
  const [activeChatOrder, setActiveChatOrder] = useState<{
    orderId: string;
    orderTitle: string;
    providerName: string;
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
      console.warn('Orders fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleReleaseMilestone = async (orderId: string, milestoneIndex: number) => {
    const confirmRelease = window.confirm(
      `Confirm Release of Milestone funds from PayPal Sandbox Escrow to the provider?`
    );
    if (!confirmRelease) return;

    setReleasingIndex({ orderId, mIdx: milestoneIndex });
    try {
      const res = await fetch('/api/orders/release-milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, milestoneIndex })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReleaseSuccessMsg(`🎉 Success: Milestone funds released! Status updated to ${data.status}.`);
        setTimeout(() => setReleaseSuccessMsg(null), 6000);
        // Refresh local orders
        await fetchOrders();
      } else {
        alert(`Release Error: ${data.error || 'Failed to release funds'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setReleasingIndex(null);
    }
  };

  // Filter orders
  const myOrders = orders.filter(o => 
    !user || 
    user.role === 'judge' || 
    o.buyerEmail === user.email || 
    o.buyerName === user.name
  );

  const displayedOrders = activeTab === 'my_orders' ? myOrders : orders;
  const totalVolume = orders.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const activeEscrowCount = orders.filter(o => o.status === 'in-escrow').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-white tracking-tight">Client Orders & Escrow Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-400">
              Live PayPal Orders v2
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Autonomous milestone contract tracking, deliverable verification, and PayPal Escrow disbursements.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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

      {/* Success Notification */}
      {releaseSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/30 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="font-bold">{releaseSuccessMsg}</p>
          </div>
          <button 
            onClick={() => setReleaseSuccessMsg(null)}
            className="text-xs text-emerald-400 hover:text-white font-mono px-2 py-0.5 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Total Escrow Volume</span>
          <p className="text-2xl font-black font-mono text-emerald-400">${totalVolume.toFixed(2)} USD</p>
          <span className="text-[10px] text-zinc-500 font-mono block">Audited on PayPal Sandbox v2</span>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Active Escrow Contracts</span>
          <p className="text-2xl font-black font-mono text-amber-300">{activeEscrowCount}</p>
          <span className="text-[10px] text-zinc-500 font-mono block">Guaranteed 3-day milestone SLAs</span>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Escrow Security Protocol</span>
          <p className="text-base font-bold text-cyan-300">PayPal Authorize & Capture v2</p>
          <span className="text-[10px] text-zinc-500 font-mono block">Zero-mock client protection</span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-1">
        <button
          onClick={() => setActiveTab('my_orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'my_orders'
              ? 'bg-zinc-800 text-cyan-300 border border-zinc-700 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <User className="h-4 w-4" />
          <span>My Hired Talent & Orders ({myOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('all_ledger')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'all_ledger'
              ? 'bg-zinc-800 text-cyan-300 border border-zinc-700 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Global Platform Ledger ({orders.length})</span>
        </button>
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
            <h3 className="text-base font-bold text-white">No active client orders found</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              You haven&apos;t hired any specialists yet. Speak to your Autonomous AI Agent to negotiate terms and set up your first milestone escrow!
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold text-xs hover:opacity-95 shadow-lg shadow-cyan-950/40 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            <span>Start Autonomous Procurement</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {displayedOrders.map((order) => {
            const isCompleted = order.status === 'completed';
            const isInEscrow = order.status === 'in-escrow';

            return (
              <div
                key={order.id}
                className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-cyan-500/40 transition-all shadow-xl space-y-5"
              >
                {/* Order Top Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-white tracking-tight">{order.serviceTitle}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : isInEscrow
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {isCompleted ? '✓ Completed' : isInEscrow ? '🛡️ In Escrow' : order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
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
                    <span className="font-mono font-black text-2xl text-emerald-400">${order.amount} USD</span>
                  </div>
                </div>

                {/* Specialist Profile & Escrow Summary Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/60">
                  {/* Specialist Info */}
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-cyan-400 font-bold text-sm shrink-0">
                      <User className="h-5 w-5" />
                    </div>
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

                {/* Structured Milestone Tranches & Release Buttons */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-cyan-400" />
                      <span>Agreed Milestone Verification Tranches</span>
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Release funds upon reviewing provider deliverables
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {order.milestones && order.milestones.length > 0 ? (
                      order.milestones.map((m, mIdx) => {
                        const isReleased = m.status === 'released';
                        const isReleasing = releasingIndex?.orderId === order.id && releasingIndex?.mIdx === mIdx;

                        return (
                          <div
                            key={m.id || mIdx}
                            className={`p-4 rounded-2xl border transition-all space-y-3 ${
                              isReleased
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
                                isReleased ? 'text-emerald-400' : 'text-amber-400'
                              }`}>
                                {isReleased ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Funds Released</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="h-3.5 w-3.5" />
                                    <span>Locked in Escrow</span>
                                  </>
                                )}
                              </span>

                              {!isReleased && (
                                <button
                                  onClick={() => handleReleaseMilestone(order.id, mIdx)}
                                  disabled={isReleasing}
                                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-bold text-[11px] flex items-center gap-1 shadow-md shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-50"
                                >
                                  {isReleasing ? (
                                    <span className="animate-spin">⏳</span>
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  <span>Approve & Release ${m.amount}</span>
                                </button>
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
                </div>

                {/* Bottom Footer Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-zinc-800/80 text-xs">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Clock className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Turnaround: 3 Business Days with milestone escrow protection.</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveChatOrder({
                        orderId: order.id,
                        orderTitle: order.serviceTitle,
                        providerName: order.providerName
                      })}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs border border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Direct Message {order.providerName.split(' ')[0]}</span>
                    </button>

                    <Link
                      href="/"
                      className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                    >
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

      {/* Direct Collaboration Modal */}
      {activeChatOrder && (
        <DirectChatModal
          isOpen={!!activeChatOrder}
          onClose={() => setActiveChatOrder(null)}
          orderId={activeChatOrder.orderId}
          orderTitle={activeChatOrder.orderTitle}
          currentUserRole="client"
          currentUserName={user?.name || 'Janitha Dilshan'}
          otherPartyName={activeChatOrder.providerName}
        />
      )}
    </div>
  );
}
