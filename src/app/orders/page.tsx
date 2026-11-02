'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { AgentPayOrder } from '@/types';
import { CreditCard, ShieldCheck, CheckCircle2, Clock, ExternalLink, RefreshCw } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<AgentPayOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'agentpay_orders'));
      if (!snap.empty) {
        setOrders(snap.docs.map(d => d.data() as AgentPayOrder));
      }
    } catch (err) {
      console.warn('Orders fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const totalVolume = orders.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white">PayPal Milestone Escrow Vault</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-400">
              Live Ledger
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time cryptographic audit trail of autonomous PayPal Orders v2 transactions and milestone payouts.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">Total Volume Processed</span>
          <p className="text-2xl font-black font-mono text-emerald-400">${totalVolume.toFixed(2)} USD</p>
        </div>
        <div className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">Active Escrows</span>
          <p className="text-2xl font-black font-mono text-amber-300">{orders.length}</p>
        </div>
        <div className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">Escrow Security Protocol</span>
          <p className="text-sm font-bold text-cyan-300">PayPal Authorize & Capture v2</p>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 text-center text-xs text-zinc-500">
          <span className="animate-spin inline-block mr-2">⏳</span> Loading escrow transactions...
        </div>
      ) : orders.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-zinc-900/20 border border-zinc-800/60 text-xs text-zinc-500 space-y-2">
          <p>No transactions recorded in the escrow ledger yet.</p>
          <p className="text-[11px] text-zinc-600">Transactions are created automatically when you authorize an AI negotiation in chat.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div
              key={order.id}
              className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-cyan-500/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{order.serviceTitle}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                    order.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                  <span>Client: <strong className="text-zinc-200">{order.buyerName}</strong></span>
                  <span>Provider: <strong className="text-cyan-400">{order.providerName}</strong></span>
                  <span className="font-mono text-zinc-500 text-[11px]">PayPal ID: {order.paypalOrderId}</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Escrow Value</span>
                <span className="font-mono font-black text-xl text-amber-300">${order.amount} USD</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
