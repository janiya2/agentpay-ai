'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import type { AgentPayOrder, ServiceProvider } from '@/types';
import { ShieldCheck, CheckCircle2, Clock, CreditCard, ExternalLink, Send, Sparkles, UserCheck } from 'lucide-react';

export default function ProviderPortalPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [orders, setOrders] = useState<AgentPayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingMilestone, setSubmittingMilestone] = useState(false);

  useEffect(() => {
    async function loadInitialProviders() {
      try {
        const snap = await getDocs(collection(db, 'agentpay_providers'));
        if (!snap.empty) {
          const list = snap.docs.map(d => d.data() as ServiceProvider);
          setProviders(list);
          if (list.length > 0) {
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

  // Fetch orders when selected provider changes
  useEffect(() => {
    if (!selectedProviderId) return;

    async function loadOrders() {
      try {
        const q = query(
          collection(db, 'agentpay_orders'),
          where('providerId', '==', selectedProviderId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setOrders(snap.docs.map(d => d.data() as AgentPayOrder));
        } else {
          // If no specific orders for this provider, show all active orders for demo testing
          const allOrdersSnap = await getDocs(collection(db, 'agentpay_orders'));
          setOrders(allOrdersSnap.docs.map(d => d.data() as AgentPayOrder));
        }
      } catch (err) {
        console.warn('Orders query:', err);
      }
    }
    loadOrders();
  }, [selectedProviderId]);

  const activeProvider = providers.find(p => p.id === selectedProviderId) || providers[0];

  const handleDeliverMilestone = async (orderId: string) => {
    setSubmittingMilestone(true);
    try {
      const orderRef = doc(db, 'agentpay_orders', orderId);
      await updateDoc(orderRef, {
        status: 'completed',
        deliverableUrl: 'https://github.com/innoxpert-showcase/final-deliverable-package',
        updatedAt: new Date().toISOString()
      });

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'completed' } : o));
      alert('🎉 Deliverable submitted! AI milestone verification triggered.');
    } catch (err: any) {
      alert(`Error submitting deliverable: ${err.message}`);
    } finally {
      setSubmittingMilestone(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white">Service Provider Workspace</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-400">
              Escrow Portal
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Manage incoming autonomous agent negotiations, review PayPal milestone escrows, and submit deliverables.
          </p>
        </div>

        {/* Provider Selector for Demo Testing */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-1.5 text-xs">
          <UserCheck className="h-4 w-4 text-cyan-400" />
          <span className="text-zinc-500">Active Profile:</span>
          <select
            value={selectedProviderId}
            onChange={e => setSelectedProviderId(e.target.value)}
            className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
          >
            {providers.slice(0, 15).map(p => (
              <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                {p.name} ({p.title.slice(0, 25)}...)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Provider Snapshot Card */}
      {activeProvider && (
        <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img src={activeProvider.avatarUrl} alt={activeProvider.name} className="h-16 w-16 rounded-2xl bg-zinc-800 border border-zinc-700" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{activeProvider.name}</h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/30">
                  Verified Talent
                </span>
              </div>
              <p className="text-xs text-zinc-400">{activeProvider.title}</p>
              <p className="text-xs text-zinc-500 font-mono">{activeProvider.contactEmail}</p>
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
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Completed</span>
              <span className="text-lg font-black font-mono text-cyan-400">{activeProvider.completedJobs}</span>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Autonomous Orders & Escrows */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-cyan-400" />
          <span>Active PayPal Milestone Orders</span>
        </h3>

        {orders.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-zinc-900/30 border border-zinc-800/60 text-xs text-zinc-500 space-y-2">
            <p>No active orders currently assigned to this profile.</p>
            <p className="text-[11px] text-zinc-600">Tip: Go to the main AI Agent Chat, negotiate an agreement, and it will appear here instantly!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {orders.map(order => (
              <div
                key={order.id}
                className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-cyan-500/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{order.serviceTitle}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                      order.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Client: <span className="text-zinc-200">{order.buyerName}</span> ({order.buyerEmail})
                  </p>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Order Ref: #{order.id} • PayPal Order: {order.paypalOrderId || 'Live'}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Escrow Amount</span>
                    <span className="font-mono font-black text-lg text-amber-300">${order.amount} USD</span>
                  </div>

                  {order.status !== 'completed' ? (
                    <button
                      onClick={() => handleDeliverMilestone(order.id)}
                      disabled={submittingMilestone}
                      className="px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold text-xs border border-cyan-500/30 flex items-center gap-1.5 transition-all"
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
    </div>
  );
}

