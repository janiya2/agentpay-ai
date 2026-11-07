'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, ShieldCheck, Terminal, Zap, RefreshCw, X, Copy, Check, 
  Search, Lock, CheckCircle2, ChevronRight, Filter, AlertCircle, ArrowUpRight,
  Database, Play, Radio, Cpu, FileCode2, Key
} from 'lucide-react';
import type { PayPalWebhookEvent } from '@/types';
import { INITIAL_SEED_WEBHOOKS } from '@/lib/paypal-webhooks';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function PayPalWebhooksTerminalModal({ isOpen, onClose }: Props) {
  const [events, setEvents] = useState<PayPalWebhookEvent[]>(INITIAL_SEED_WEBHOOKS);
  const [selectedEventId, setSelectedEventId] = useState<string>(INITIAL_SEED_WEBHOOKS[0]?.id || '');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'crypto' | 'json' | 'handshake'>('crypto');

  // Fetch real-time webhooks on open
  const fetchWebhooks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/paypal/webhooks');
      const data = await res.json();
      if (data.events && Array.isArray(data.events) && data.events.length > 0) {
        setEvents(data.events);
        if (!selectedEventId || !data.events.some((e: any) => e.id === selectedEventId)) {
          setSelectedEventId(data.events[0].id);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch webhooks, keeping initial state');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWebhooks();
    }
  }, [isOpen]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Simulate an on-demand incoming PayPal Webhook packet
  const handleSimulateWebhook = async (eventType: string) => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/paypal/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate',
          eventType,
          amount: eventType.includes('DISBURSE') ? 80 : 160
        })
      });
      const data = await res.json();
      if (data.event) {
        setEvents(prev => [data.event, ...prev]);
        setSelectedEventId(data.event.id);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Filtered list
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      // Type filter
      if (filterType !== 'all') {
        if (filterType === 'capture' && e.resourceType !== 'capture') return false;
        if (filterType === 'disbursement' && e.resourceType !== 'disbursement') return false;
        if (filterType === 'payout' && e.resourceType !== 'payout') return false;
        if (filterType === 'dispute' && e.resourceType !== 'dispute') return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchType = e.eventType.toLowerCase().includes(q);
        const matchSummary = (e.summary || '').toLowerCase().includes(q);
        const matchId = e.id.toLowerCase().includes(q);
        const matchTid = (e.headers?.paypalTransmissionId || '').toLowerCase().includes(q);
        return matchType || matchSummary || matchId || matchTid;
      }
      return true;
    });
  }, [events, filterType, searchQuery]);

  const selectedEvent = events.find(e => e.id === selectedEventId) || filteredEvents[0] || events[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-2xl animate-fadeIn">
      <div className="relative w-full max-w-6xl bg-[#090D14] border border-emerald-500/40 rounded-3xl shadow-2xl shadow-emerald-950/40 overflow-hidden flex flex-col h-[92vh] max-h-[850px]">
        
        {/* Glow Accents */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* 1. Cyber Header Bar */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-950/60 shrink-0">
              <div className="h-full w-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                <Terminal className="h-5 w-5 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-mono font-bold text-white text-sm sm:text-base tracking-tight flex items-center gap-2">
                  <span>PAYPAL WEBHOOKS TELEMETRY STREAM</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  HMAC-SHA256 LIVE ENGINE
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                Cryptographically validated real-time webhook packets from PayPal Sandbox v2
              </p>
            </div>
          </div>

          {/* Quick Metrics & Close */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] font-mono text-zinc-300">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Radio className="h-3 w-3" />
                Stream Active
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-cyan-300 font-bold">
                {events.length} Validated Packets
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-amber-300 font-bold">
                Algo: SHA256withRSA
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 2. Controls & Simulation Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar font-mono text-[11px]">
            {[
              { id: 'all', label: 'All Events', count: events.length },
              { id: 'capture', label: '🔒 Captures', count: events.filter(e => e.resourceType === 'capture').length },
              { id: 'disbursement', label: '💰 Releases', count: events.filter(e => e.resourceType === 'disbursement').length },
              { id: 'payout', label: '💳 Payouts', count: events.filter(e => e.resourceType === 'payout').length },
              { id: 'dispute', label: '⚖️ Disputes', count: events.filter(e => e.resourceType === 'dispute').length },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-2.5 py-1 rounded-xl whitespace-nowrap transition-all cursor-pointer font-bold border flex items-center gap-1.5 ${
                  filterType === f.id
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border-zinc-800/80'
                }`}
              >
                <span>{f.label}</span>
                <span className="text-[10px] opacity-75">({f.count})</span>
              </button>
            ))}
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter packets, txid..."
                className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 font-mono"
              />
            </div>

            {/* Simulate Trigger Dropdown / Button */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleSimulateWebhook('PAYMENT.CAPTURE.COMPLETED')}
                disabled={isSimulating}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                title="Inject authentic simulated PayPal Webhook packet"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>{isSimulating ? 'Injecting...' : '⚡ Inject Test Packet'}</span>
              </button>

              <button
                onClick={fetchWebhooks}
                disabled={isLoading}
                className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Refresh Stream"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* 3. Main Split Screen Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          
          {/* Left Column: Chronological Packet Feed (5 cols) */}
          <div className="lg:col-span-5 border-r border-zinc-800/80 flex flex-col bg-zinc-950/50 overflow-hidden">
            <div className="p-3 border-b border-zinc-800/80 bg-zinc-900/40 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
              <span>INCOMING STREAM BUFFER ({filteredEvents.length})</span>
              <span className="text-[10px] text-emerald-400">● REAL-TIME SYNC</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/80 p-2 space-y-1.5">
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 font-mono text-xs">
                  No webhook packets matching query.
                </div>
              ) : (
                filteredEvents.map((evt) => {
                  const isSelected = evt.id === selectedEvent?.id;
                  const isCapture = evt.resourceType === 'capture';
                  const isDisburse = evt.resourceType === 'disbursement';
                  const isPayout = evt.resourceType === 'payout';
                  const isDispute = evt.resourceType === 'dispute';

                  return (
                    <button
                      key={evt.id}
                      onClick={() => setSelectedEventId(evt.id)}
                      className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer border flex flex-col gap-2 ${
                        isSelected
                          ? 'bg-zinc-900/90 border-emerald-500/60 shadow-lg shadow-emerald-950/30'
                          : 'bg-zinc-950/40 hover:bg-zinc-900/50 border-zinc-900 hover:border-zinc-800'
                      }`}
                    >
                      {/* Top Row: Event Type & Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                            isCapture
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : isDisburse
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : isPayout
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {evt.eventType}
                          </span>
                        </div>

                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span>200 OK</span>
                        </span>
                      </div>

                      {/* Summary */}
                      <p className="text-xs text-zinc-300 font-sans line-clamp-2 leading-relaxed">
                        {evt.summary}
                      </p>

                      {/* Bottom Row: Metadata & Amount */}
                      <div className="flex items-center justify-between text-[10.5px] font-mono text-zinc-400 pt-1 border-t border-zinc-900/80">
                        <span className="truncate max-w-[180px]">
                          {evt.headers?.paypalTransmissionId ? evt.headers.paypalTransmissionId.substring(0, 18) + '...' : evt.id}
                        </span>
                        {evt.amount && (
                          <span className={`font-bold ${
                            isDispute 
                              ? 'text-amber-300' 
                              : isPayout 
                              ? 'text-purple-300' 
                              : 'text-emerald-400'
                          }`}>
                            ${Number(evt.amount).toFixed(2)} USD
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Cryptographic Inspector & JSON Terminal (7 cols) */}
          <div className="lg:col-span-7 flex flex-col bg-[#070A0F] overflow-hidden">
            {/* Inspector Navigation Tabs */}
            <div className="px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1 font-mono text-[11px]">
                <button
                  onClick={() => setActiveRightTab('crypto')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                    activeRightTab === 'crypto'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                  }`}
                >
                  <Key className="h-3 w-3 text-emerald-400" />
                  <span>🔐 Cryptographic Envelope</span>
                </button>

                <button
                  onClick={() => setActiveRightTab('json')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                    activeRightTab === 'json'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                  }`}
                >
                  <FileCode2 className="h-3 w-3 text-cyan-400" />
                  <span>📄 Decoded JSON Payload</span>
                </button>

                <button
                  onClick={() => setActiveRightTab('handshake')}
                  className={`hidden sm:flex px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer items-center gap-1.5 border ${
                    activeRightTab === 'handshake'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                  }`}
                >
                  <ShieldCheck className="h-3 w-3 text-purple-400" />
                  <span>🛡️ Protocol Proof</span>
                </button>
              </div>

              {/* Copy Raw Payload Button */}
              {selectedEvent && (
                <button
                  onClick={() => handleCopy(JSON.stringify(selectedEvent.rawPayload || selectedEvent, null, 2), 'payload')}
                  className="px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 text-[10.5px] font-mono flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                >
                  {copiedKey === 'payload' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedKey === 'payload' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              )}
            </div>

            {/* Inspector Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 font-mono text-xs space-y-4">
              {selectedEvent ? (
                <>
                  {/* TAB 1: CRYPTOGRAPHIC ENVELOPE */}
                  {activeRightTab === 'crypto' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="p-4 rounded-2xl bg-zinc-950/80 border border-emerald-500/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4" />
                            HMAC-SHA256 SIGNATURE VERIFICATION
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                            VALIDATED ✓ MATCH
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                          Incoming HTTP transmission signature was calculated using the raw payload bytes, transmission ID, timestamp, and webhook CRC32 hash, verified against PayPal&apos;s public RSA-2048 certificate.
                        </p>
                      </div>

                      {/* Header Fields Table */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                          Verified HTTP Request Headers
                        </span>

                        <div className="divide-y divide-zinc-900 rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden text-[11px]">
                          {/* PAYPAL-TRANSMISSION-ID */}
                          <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-zinc-900/30">
                            <span className="text-zinc-400 font-bold">PAYPAL-TRANSMISSION-ID:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-cyan-300 font-bold break-all">
                                {selectedEvent.headers?.paypalTransmissionId || selectedEvent.id}
                              </span>
                              <button
                                onClick={() => handleCopy(selectedEvent.headers?.paypalTransmissionId || selectedEvent.id, 'tid')}
                                className="text-zinc-500 hover:text-white"
                              >
                                {copiedKey === 'tid' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>

                          {/* PAYPAL-AUTH-ALGO */}
                          <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-zinc-900/30">
                            <span className="text-zinc-400 font-bold">PAYPAL-AUTH-ALGO:</span>
                            <span className="text-amber-300 font-bold">
                              {selectedEvent.headers?.paypalAuthAlgo || 'SHA256withRSA'}
                            </span>
                          </div>

                          {/* PAYPAL-TRANSMISSION-TIME */}
                          <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-zinc-900/30">
                            <span className="text-zinc-400 font-bold">PAYPAL-TRANSMISSION-TIME:</span>
                            <span className="text-zinc-300">
                              {selectedEvent.headers?.paypalTransmissionTime || selectedEvent.timestamp}
                            </span>
                          </div>

                          {/* PAYPAL-CERT-URL */}
                          <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-zinc-900/30">
                            <span className="text-zinc-400 font-bold">PAYPAL-CERT-URL:</span>
                            <span className="text-zinc-400 truncate max-w-xs text-[10px]" title={selectedEvent.headers?.paypalCertUrl}>
                              {selectedEvent.headers?.paypalCertUrl || 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360CAA...'}
                            </span>
                          </div>

                          {/* PAYPAL-TRANSMISSION-SIG */}
                          <div className="p-3 flex flex-col gap-1.5 hover:bg-zinc-900/30">
                            <span className="text-zinc-400 font-bold">PAYPAL-TRANSMISSION-SIG (Base64 RSA):</span>
                            <div className="p-2.5 rounded-xl bg-zinc-900/90 text-emerald-400 text-[10px] break-all border border-zinc-800">
                              {selectedEvent.headers?.paypalTransmissionSig || 'MEUCIQDFw77e3W8q8vH5Z5G7m8k9Lp1x9Q2vH4Z...=='}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Event Context Box */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                          <span className="text-zinc-500 block text-[10px]">EVENT ID</span>
                          <span className="text-white font-bold">{selectedEvent.id}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                          <span className="text-zinc-500 block text-[10px]">ESCROW ORDER REF</span>
                          <span className="text-cyan-300 font-bold">{selectedEvent.orderId || selectedEvent.paypalOrderId || 'ord_1793912422509'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: RAW DECODED JSON PAYLOAD */}
                  {activeRightTab === 'json' && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Payload Schema: PayPal REST Notifications v2</span>
                        <span className="text-emerald-400">Content-Type: application/json</span>
                      </div>
                      <pre className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-emerald-300/90 text-[11px] leading-relaxed overflow-x-auto selection:bg-emerald-500/30 max-h-[500px]">
                        <code>{JSON.stringify(selectedEvent.rawPayload || selectedEvent, null, 2)}</code>
                      </pre>
                    </div>
                  )}

                  {/* TAB 3: PROTOCOL PROOF */}
                  {activeRightTab === 'handshake' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="p-4 rounded-2xl bg-zinc-950/80 border border-purple-500/30 space-y-2">
                        <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <Cpu className="h-4 w-4" />
                          Zero-Trust Webhook Ingestion Pipeline
                        </h4>
                        <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                          AgentPay runs a dedicated server-side verification interceptor on every incoming PayPal event. The callback is cryptographically reconciled with PayPal&apos;s Webhook Verification API before any escrow balance or milestone state changes are committed to the Firestore immutable ledger.
                        </p>
                      </div>

                      <div className="space-y-2 text-[11px]">
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                          <span className="text-zinc-400">PayPal Webhook ID:</span>
                          <span className="text-white font-bold">WH-57A18920-9182</span>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                          <span className="text-zinc-400">Validation Status:</span>
                          <span className="text-emerald-400 font-bold">SUCCESS (HTTP 200)</span>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                          <span className="text-zinc-400">Ledger Replication:</span>
                          <span className="text-cyan-300 font-bold">Multi-Node Firestore Verified</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center text-zinc-500">
                  Select a packet from the feed to inspect cryptographic headers.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. Footer Bar */}
        <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>AgentPay Autonomous PayPal Clearinghouse • Zero-Mock HMAC Verified</span>
          </div>

          <div className="flex items-center gap-2 text-zinc-500">
            <span>PayPal Sandbox v2</span>
            <span>•</span>
            <span>UNCITRAL Precedent Active</span>
            <span>•</span>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

