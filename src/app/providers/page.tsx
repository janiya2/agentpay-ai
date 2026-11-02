'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import type { AgentPayOrder, ServiceProvider } from '@/types';
import { 
  ShieldCheck, CheckCircle2, Clock, CreditCard, ExternalLink, 
  Send, Sparkles, UserCheck, MessageSquare, AlertCircle, ArrowRight, User, Ban,
  Edit3, X, Save, MapPin, Briefcase, Tag, Mail, Check, Search, Filter, Bot, DollarSign, Layers
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
  const [chatInputPerTender, setChatInputPerTender] = useState<{ [sid: string]: string }>({});
  const [isSendingMessage, setIsSendingMessage] = useState<{ [sid: string]: boolean }>({});
  const [responseNotice, setResponseNotice] = useState<string | null>(null);

  // 2-Pane Chat & Bidding Workspace State
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [tenderFilter, setTenderFilter] = useState<'all' | 'open' | 'awarded' | 'closed'>('all');
  const [tenderSearchQuery, setTenderSearchQuery] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Profile Editor Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    title: string;
    category: string;
    hourlyRate: number;
    contactEmail: string;
    location: string;
    skills: string;
    bio: string;
    status: 'active' | 'busy' | 'offline';
  }>({
    name: '',
    title: '',
    category: 'web-development',
    hourlyRate: 50,
    contactEmail: '',
    location: 'Remote',
    skills: '',
    bio: '',
    status: 'active'
  });

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

  // Open Edit Profile Modal
  const openEditProfile = () => {
    if (!activeProvider) return;
    setEditForm({
      name: activeProvider.name || '',
      title: activeProvider.title || '',
      category: activeProvider.category || 'web-development',
      hourlyRate: activeProvider.hourlyRate || 50,
      contactEmail: activeProvider.contactEmail || '',
      location: activeProvider.location || 'Remote',
      skills: (activeProvider.skills || []).join(', '),
      bio: activeProvider.bio || '',
      status: activeProvider.status || 'active'
    });
    setIsEditModalOpen(true);
  };

  // Save Updated Profile to Firestore
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider) return;
    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/providers/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: activeProvider.id,
          name: editForm.name,
          title: editForm.title,
          category: editForm.category,
          hourlyRate: Number(editForm.hourlyRate),
          contactEmail: editForm.contactEmail,
          location: editForm.location,
          skills: editForm.skills.split(',').map(s => s.trim()).filter(Boolean),
          bio: editForm.bio,
          status: editForm.status
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResponseNotice(`🎉 Success: Profile for ${editForm.name} updated in Firestore!`);
        setTimeout(() => setResponseNotice(null), 6000);
        // Update local state immediately
        setProviders(prev => prev.map(p => p.id === activeProvider.id ? { ...p, ...data.updatedProfile } : p));
        setIsEditModalOpen(false);
      } else {
        alert(data.error || 'Failed to update profile');
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Fetch orders and incoming tender RFQs strictly for activeProvider (NO LEAKAGE, NO FLICKER)
  const loadProviderData = async () => {
    if (!activeProvider) return;

    try {
      // 1. Fetch Orders strictly for activeProvider (No fallback to other providers' orders!)
      const allOrdersSnap = await getDocs(collection(db, 'agentpay_orders'));
      if (!allOrdersSnap.empty) {
        const allList = allOrdersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AgentPayOrder));
        const filtered = allList.filter(o => 
          (o.providerId && o.providerId === activeProvider.id) || 
          (o.providerName && o.providerName.trim().toLowerCase() === activeProvider.name.trim().toLowerCase())
        );
        setOrders(filtered); // Strict: Exactly this provider's orders only!
      } else {
        setOrders([]);
      }

      // 2. Fetch Incoming Tenders & RFQs strictly for activeProvider (Silent background refresh)
      const sessionsSnap = await getDocs(collection(db, 'agentpay_chat_sessions'));
      if (!sessionsSnap.empty) {
        const allSessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const matching = allSessions.filter((s: any) => {
          const targets = s.targetProviders || [];
          const isInTargets = targets.some((tp: any) => tp.id === activeProvider.id || tp.name?.trim().toLowerCase() === activeProvider.name?.trim().toLowerCase());
          const isDirect = s.providerId === activeProvider.id || s.providerMatched?.trim().toLowerCase() === activeProvider.name?.trim().toLowerCase();
          return (isInTargets || isDirect) && (s.status === 'tender_open' || s.status === 'awaiting_provider' || s.status === 'closed_awarded' || s.status === 'negotiated');
        });
        setInquiries(matching);
      } else {
        setInquiries([]);
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

  // Handle Provider Submitting Bid (Optimistic & Zero Flicker)
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
        // Optimistically update in memory so bid button transforms instantly to live status
        const myNewBid = {
          providerId: activeProvider.id,
          providerName: activeProvider.name,
          bidPrice: Number(price),
          deliveryDays: Number(days),
          note,
          submittedAt: new Date().toISOString()
        };
        setInquiries(prev => prev.map(inq => {
          if (inq.id === sessionId) {
            return {
              ...inq,
              bids: [...(inq.bids || []), myNewBid]
            };
          }
          return inq;
        }));
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

  // Handle Provider Sending Message into Tender Transmission Dialogue (100% Optimistic & Real-Time)
  const handleSendTenderMessage = async (sessionId: string) => {
    const text = chatInputPerTender[sessionId]?.trim();
    if (!text || !activeProvider) return;

    // 1. Clear input immediately
    setChatInputPerTender(prev => ({ ...prev, [sessionId]: '' }));

    // 2. Optimistically append provider message to chat immediately
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const optimisticProviderEntry = {
      speaker: 'provider' as const,
      speakerName: `${activeProvider.name} 👨‍💻 (Specialist Message)`,
      message: text,
      timestamp: timeNow
    };

    setInquiries(prev => prev.map(inq => {
      if (inq.id === sessionId) {
        return {
          ...inq,
          negotiationDialog: [...(inq.negotiationDialog || []), optimisticProviderEntry]
        };
      }
      return inq;
    }));

    // 3. Trigger typing indicator and auto-scroll
    setIsSendingMessage(prev => ({ ...prev, [sessionId]: true }));
    setTimeout(() => {
      chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    try {
      const res = await fetch('/api/providers/send-tender-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          providerId: activeProvider.id,
          message: text
        })
      });

      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.dialog)) {
        // Seamlessly update in-memory dialogue with server-confirmed dialog + bot reply (No page refresh!)
        setInquiries(prev => prev.map(inq => {
          if (inq.id === sessionId) {
            return {
              ...inq,
              negotiationDialog: data.dialog
            };
          }
          return inq;
        }));
        setTimeout(() => {
          chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      } else {
        alert(data.error || 'Failed to send message');
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsSendingMessage(prev => ({ ...prev, [sessionId]: false }));
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

  const filteredTenders = inquiries.filter(inq => {
    const isOpen = inq.status === 'tender_open' || inq.status === 'awaiting_provider';
    const isClosed = inq.status === 'closed_awarded' || inq.status === 'escrow_created';
    const isWinner = isClosed && (inq.winningBid?.providerId === activeProvider?.id || inq.providerId === activeProvider?.id);
    const isOutbidLate = isClosed && !isWinner;

    if (tenderFilter === 'open' && !isOpen) return false;
    if (tenderFilter === 'awarded' && !isWinner) return false;
    if (tenderFilter === 'closed' && !isOutbidLate) return false;

    if (tenderSearchQuery.trim()) {
      const q = tenderSearchQuery.toLowerCase();
      const scope = (inq.projectScope || inq.latestPrompt || '').toLowerCase();
      const client = (inq.buyerName || '').toLowerCase();
      return scope.includes(q) || client.includes(q);
    }

    return true;
  });

  const activeTender = inquiries.find(i => i.id === selectedTenderId) || filteredTenders[0] || null;

  // Auto-scroll chat to latest message smoothly
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTender?.id, activeTender?.negotiationDialog?.length, isSendingMessage]);

  // Prevent flash of empty content on initial load
  if (loading && providers.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-28 w-full flex flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Sparkles className="h-6 w-6 animate-spin" />
        </div>
        <p className="text-zinc-400 font-mono text-xs animate-pulse">Loading Service Provider Workspace & Profiles...</p>
      </div>
    );
  }

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
        <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img src={activeProvider.avatarUrl} alt={activeProvider.name} className="h-16 w-16 rounded-2xl bg-zinc-800 border border-zinc-700 shadow-md" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-white">{activeProvider.name}</h2>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/30">
                    Verified Talent
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                    activeProvider.status === 'active' 
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      : activeProvider.status === 'busy'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    ● {activeProvider.status?.toUpperCase() || 'ACTIVE'}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 font-medium">{activeProvider.title}</p>
                <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                  <span className="text-cyan-400 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {activeProvider.contactEmail}
                  </span>
                  {activeProvider.location && (
                    <span className="text-zinc-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {activeProvider.location}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6 border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6 text-center w-full md:w-auto justify-between md:justify-end">
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

              {/* Edit Profile Action Button */}
              <button
                onClick={openEditProfile}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Edit3 className="h-3.5 w-3.5 text-cyan-400" />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>

          {/* Bio & Skills Tags */}
          <div className="border-t border-zinc-800/80 pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <p className="text-zinc-400 line-clamp-2 max-w-2xl leading-relaxed text-[11.5px]">
              {activeProvider.bio || 'Verified independent specialist on AgentPay network.'}
            </p>
            {activeProvider.skills && activeProvider.skills.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {activeProvider.skills.slice(0, 4).map((s, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-700">
                    {s}
                  </span>
                ))}
              </div>
            )}
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

      {/* TAB 1: Incoming AI Negotiations & Two-Pane Chat Workspace */}
      {activeTab === 'inquiries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>Autonomous Tender Negotiations & Chat Workspace</span>
            </h3>
            <span className="text-xs text-zinc-500">
              Interactive multi-agent communication hub for {activeProvider?.name}
            </span>
          </div>

          {inquiries.length === 0 ? (
            <div className="p-16 text-center rounded-3xl bg-zinc-900/20 border border-zinc-800/60 text-xs text-zinc-500 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                <Bot className="h-6 w-6" />
              </div>
              <p className="text-white font-bold text-sm">No active project tenders currently open for {activeProvider?.name}.</p>
              <p className="text-[11px] text-zinc-400 max-w-md mx-auto leading-relaxed">
                When a client searches for services in AI Agent Chat and clicks &quot;Dispatch Tender&quot; or selects {activeProvider?.name.split(' ')[0]}, the tender will arrive here instantly with email alerts!
              </p>
            </div>
          ) : (
            <div className="h-[700px] w-full rounded-3xl border border-zinc-800/80 bg-zinc-950/90 shadow-2xl overflow-hidden flex flex-col md:flex-row backdrop-blur-xl">
              {/* LEFT PANE: Tender & Chat List with Search & Filters */}
              <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-zinc-800/80 bg-zinc-950/60 flex flex-col shrink-0">
                {/* Search & Filters */}
                <div className="p-3.5 border-b border-zinc-800/80 space-y-2.5">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search tenders, scopes, clients..."
                      value={tenderSearchQuery}
                      onChange={e => setTenderSearchQuery(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-[11px]">
                    {(['all', 'open', 'awarded', 'closed'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setTenderFilter(tab)}
                        className={`px-2.5 py-1 rounded-lg font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                          tenderFilter === tab
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                        }`}
                      >
                        {tab === 'all' ? `All (${inquiries.length})` : tab === 'open' ? 'Open' : tab === 'awarded' ? 'Won' : 'Closed'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tenders List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                  {filteredTenders.length === 0 ? (
                    <div className="py-16 text-center text-xs text-zinc-500">
                      No matching tenders found.
                    </div>
                  ) : (
                    filteredTenders.map(inq => {
                      const isSelected = (activeTender?.id === inq.id);
                      const isOpen = inq.status === 'tender_open' || inq.status === 'awaiting_provider';
                      const isClosed = inq.status === 'closed_awarded' || inq.status === 'escrow_created';
                      const isWinner = isClosed && (inq.winningBid?.providerId === activeProvider.id || inq.providerId === activeProvider.id);
                      const isOutbidLate = isClosed && !isWinner;
                      const lastMessage = inq.negotiationDialog?.[inq.negotiationDialog.length - 1];

                      return (
                        <div
                          key={inq.id}
                          onClick={() => setSelectedTenderId(inq.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                            isSelected
                              ? 'bg-zinc-900/90 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                              : 'bg-zinc-950/40 border-zinc-850 hover:bg-zinc-900/50 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-white text-xs truncate max-w-[170px]">
                              {inq.projectScope || inq.latestPrompt || 'Milestone Contract'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                              isOpen
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : isWinner
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}>
                              {isOpen ? 'Open' : isWinner ? 'Won' : 'Closed'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-zinc-400">
                            <span className="truncate max-w-[140px] text-zinc-300">
                              👤 {inq.buyerName || 'Client'}
                            </span>
                            <span className="font-mono font-bold text-emerald-400 text-xs">
                              ${inq.spendingLimit || 200}
                            </span>
                          </div>

                          <p className="text-[10.5px] text-zinc-500 line-clamp-1 italic">
                            {lastMessage?.message || 'Tender scope initialized'}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT PANE: Full Interactive Chat Room & Procurement Panel */}
              {activeTender ? (
                <div className="flex-1 flex flex-col h-full bg-zinc-950/40">
                  {/* Active Room Top Header */}
                  <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">
                            {activeTender.projectScope || 'Milestone Deliverable'}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                            activeTender.status === 'closed_awarded'
                              ? activeTender.winningBid?.providerId === activeProvider.id
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            {activeTender.status === 'closed_awarded' 
                              ? activeTender.winningBid?.providerId === activeProvider.id ? '🏆 Contract Awarded to You' : '🚫 Opportunity Closed (Late)'
                              : '⏳ Tender Open for Bids'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Client: <strong className="text-zinc-200">{activeTender.buyerName}</strong> ({activeTender.buyerEmail})
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Client Budget Cap</span>
                      <span className="font-mono font-black text-lg text-emerald-400">
                        ${activeTender.spendingLimit || 200} USD
                      </span>
                    </div>
                  </div>

                  {/* Messages Scroll Area */}
                  <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar">
                    {/* Notice Banners */}
                    {activeTender.status === 'closed_awarded' && activeTender.winningBid?.providerId !== activeProvider.id && (
                      <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                        <Ban className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">🚫 Opportunity Closed (Contract Already Awarded)</p>
                          <p className="text-zinc-300 text-[11px] mt-0.5">
                            The client has already awarded this project to <strong className="text-white">{activeTender.winningBid?.providerName || 'another specialist'}</strong> for <strong className="text-emerald-400">${activeTender.winningBid?.bidPrice || activeTender.amount} USD</strong> and authorized PayPal Milestone Escrow. Bidding is now locked.
                          </p>
                        </div>
                      </div>
                    )}

                    {activeTender.status === 'closed_awarded' && activeTender.winningBid?.providerId === activeProvider.id && (
                      <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-start gap-2.5 text-xs text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">🎉 Congratulations! The client accepted your bid and funded PayPal Milestone Escrow.</p>
                          <p className="text-zinc-300 text-[11px] mt-0.5">
                            Switch to the Active Escrow Orders tab to submit deliverables and chat directly with the client.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Dialogue Speech Bubbles */}
                    {(!activeTender.negotiationDialog || activeTender.negotiationDialog.length === 0) ? (
                      <div className="py-12 text-center text-xs text-zinc-500">
                        No messages yet in this tender negotiation. Send a message below to start!
                      </div>
                    ) : (
                      activeTender.negotiationDialog.map((diag: any, dIdx: number) => {
                        const isAgent = diag.speaker === 'agent';
                        const isMe = !isAgent && diag.speakerName?.toLowerCase().includes(activeProvider.name.toLowerCase());

                        return (
                          <div
                            key={dIdx}
                            className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                          >
                            <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                              isAgent
                                ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-400'
                                : 'bg-purple-950 border border-purple-500/40 text-purple-300'
                            }`}>
                              {isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                            </div>

                            <div className={`space-y-1 max-w-[80%] sm:max-w-[70%]`}>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-400 px-1 font-mono">
                                <span className={`font-bold ${isAgent ? 'text-cyan-400' : 'text-purple-300'}`}>
                                  {diag.speakerName}
                                </span>
                                <span>{diag.timestamp}</span>
                              </div>
                              <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                                isAgent
                                  ? 'bg-zinc-900/90 text-zinc-200 border border-cyan-500/20 rounded-tl-none shadow-md'
                                  : 'bg-purple-950/30 text-purple-100 border border-purple-500/30 rounded-tr-none shadow-md'
                              }`}>
                                <p className="whitespace-pre-wrap">{diag.message}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Bot Typing Indicator */}
                    {isSendingMessage[activeTender.id] && (
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 animate-spin text-cyan-300" />
                        </div>
                        <div className="p-3 rounded-2xl bg-zinc-900 border border-cyan-500/30 rounded-tl-none text-xs text-zinc-400 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                          <span className="font-mono text-cyan-300 text-[11px]">
                            AgentPay Commerce Bot is analyzing your message...
                          </span>
                        </div>
                      </div>
                    )}

                    <div ref={chatScrollRef} />
                  </div>

                  {/* BOTTOM ACTION DOCK: Quick Prompts, Chat Input & Bidding */}
                  <div className="border-t border-zinc-800/80 bg-zinc-900/60 p-3 sm:p-4 space-y-3 shrink-0">
                    {/* Quick Suggestion Chips */}
                    {activeTender.status !== 'closed_awarded' && (
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-[11px]">
                        <span className="text-zinc-500 shrink-0 font-medium text-[10px]">Quick Prompts:</span>
                        <button
                          onClick={() => setChatInputPerTender({
                            ...chatInputPerTender,
                            [activeTender.id]: "Hello! What are the exact deliverable formats and wireframe specs required for this project?"
                          })}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white shrink-0 transition-colors cursor-pointer"
                        >
                          💬 Ask for Scope Details
                        </button>
                        <button
                          onClick={() => setChatInputPerTender({
                            ...chatInputPerTender,
                            [activeTender.id]: `I can deliver this project with full source files for $${Math.round((activeTender.spendingLimit || 200) * 0.8)} USD in 3 days.`
                          })}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white shrink-0 transition-colors cursor-pointer"
                        >
                          🤝 Propose ${Math.round((activeTender.spendingLimit || 200) * 0.8)} in 3 Days
                        </button>
                        <button
                          onClick={() => setChatInputPerTender({
                            ...chatInputPerTender,
                            [activeTender.id]: "I have verified my availability and will start immediately upon PayPal escrow lock."
                          })}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white shrink-0 transition-colors cursor-pointer"
                        >
                          ⚡ Confirm Immediate Start
                        </button>
                      </div>
                    )}

                    {/* Chat Input Bar */}
                    {activeTender.status !== 'closed_awarded' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={chatInputPerTender[activeTender.id] || ''}
                          onChange={e => setChatInputPerTender({ ...chatInputPerTender, [activeTender.id]: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && handleSendTenderMessage(activeTender.id)}
                          placeholder={`Message ${activeTender.buyerName} & AI Bot (ask questions, negotiate price)...`}
                          disabled={isSendingMessage[activeTender.id]}
                          className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition-all disabled:opacity-50"
                        />
                        <button
                          onClick={() => handleSendTenderMessage(activeTender.id)}
                          disabled={isSendingMessage[activeTender.id] || !chatInputPerTender[activeTender.id]?.trim()}
                          className="h-10 px-4 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shrink-0"
                        >
                          {isSendingMessage[activeTender.id] ? <span className="animate-spin">⏳</span> : <Send className="h-3.5 w-3.5" />}
                          <span className="hidden sm:inline">Send</span>
                        </button>
                      </div>
                    )}

                    {/* Docked Milestone Bid Submission Form */}
                    {(() => {
                      const isOpen = activeTender.status === 'tender_open' || activeTender.status === 'awaiting_provider';
                      const myExistingBid = (activeTender.bids || []).find((b: any) => b.providerId === activeProvider.id);

                      if (isOpen && myExistingBid) {
                        return (
                          <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                              <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                              <span>Your Bid of ${myExistingBid.bidPrice} USD ({myExistingBid.deliveryDays} Days) is Live on Client&apos;s Bids Board!</span>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-mono">Awaiting client decision in Chat</span>
                          </div>
                        );
                      }

                      if (isOpen && !myExistingBid) {
                        return (
                          <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-cyan-500/30 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-cyan-300 flex items-center gap-1.5 text-[11px]">
                                <DollarSign className="h-3.5 w-3.5 text-cyan-400" />
                                Submit Official Milestone Bid to Client
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono">Max Cap: ${activeTender.spendingLimit || 200} USD</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-0.5">Bid Price ($ USD)</label>
                                <input
                                  type="number"
                                  value={customBidPrice[activeTender.id] || Math.round((activeTender.spendingLimit || 200) * 0.8)}
                                  onChange={e => setCustomBidPrice({ ...customBidPrice, [activeTender.id]: Number(e.target.value) })}
                                  min="30"
                                  max={activeTender.spendingLimit || 500}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-cyan-400 text-xs"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-0.5">Turnaround (Days)</label>
                                <input
                                  type="number"
                                  value={customDeliveryDays[activeTender.id] || 3}
                                  onChange={e => setCustomDeliveryDays({ ...customDeliveryDays, [activeTender.id]: Number(e.target.value) })}
                                  min="1"
                                  max="14"
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-cyan-400 text-xs"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-0.5">Note to Client</label>
                                <input
                                  type="text"
                                  value={customReplyNote[activeTender.id] || ''}
                                  onChange={e => setCustomReplyNote({ ...customReplyNote, [activeTender.id]: e.target.value })}
                                  placeholder="e.g. 'Figma prototype with components'"
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-cyan-400 text-xs placeholder-zinc-500"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end pt-1">
                              <button
                                onClick={() => handleSubmitBid(activeTender.id)}
                                disabled={respondingSessionId === activeTender.id}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
                              >
                                {respondingSessionId === activeTender.id ? <span className="animate-spin">⏳</span> : <Sparkles className="h-3.5 w-3.5" />}
                                <span>Submit Official Bid (${customBidPrice[activeTender.id] || Math.round((activeTender.spendingLimit || 200) * 0.8)} USD)</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
                  Select a tender on the left to start negotiating.
                </div>
              )}
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

      {/* Specialist Profile Editor Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Edit Specialist Profile
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                      Firestore Sync
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Updates will sync live across AI Agent discovery and tender negotiations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
              {/* Row 1: Name & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1">Specialist Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                    placeholder="e.g. Sophia Patel"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1">Professional Title / Headline</label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                    placeholder="e.g. SaaS UX Strategist & Interactive Prototyper"
                  />
                </div>
              </div>

              {/* Row 2: Category & Hourly Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1">Service Category</label>
                  <select
                    value={editForm.category}
                    onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="web-development">Web Development</option>
                    <option value="ui-ux-design">UI/UX Design</option>
                    <option value="ai-automation">AI Automation</option>
                    <option value="seo-marketing">SEO Marketing</option>
                    <option value="video-production">Video Production</option>
                    <option value="mobile-apps">Mobile Apps</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1">Standard Hourly Rate ($ USD / hr)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-zinc-500 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min="15"
                      max="500"
                      value={editForm.hourlyRate}
                      onChange={e => setEditForm({ ...editForm, hourlyRate: Number(e.target.value) })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3.5 py-2.5 text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Email & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1">Contact Email</label>
                  <input
                    type="email"
                    required
                    value={editForm.contactEmail}
                    onChange={e => setEditForm({ ...editForm, contactEmail: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-cyan-400"
                    placeholder="e.g. sophia.patel@innoxpert-agents.io"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1">Location / Base</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-400"
                    placeholder="e.g. San Francisco, CA / Remote"
                  />
                </div>
              </div>

              {/* Row 4: Availability Status */}
              <div>
                <label className="block text-[11px] text-zinc-400 font-medium mb-1">Availability Status</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['active', 'busy', 'offline'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, status: st })}
                      className={`py-2 rounded-xl border text-xs font-semibold capitalize transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        editForm.status === st
                          ? st === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                            : st === 'busy'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-600 shadow-sm'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${
                        st === 'active' ? 'bg-emerald-400' : st === 'busy' ? 'bg-amber-400' : 'bg-zinc-500'
                      }`} />
                      <span>{st}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 5: Skills Tags */}
              <div>
                <label className="block text-[11px] text-zinc-400 font-medium mb-1">
                  Core Skills (Comma-separated)
                </label>
                <input
                  type="text"
                  value={editForm.skills}
                  onChange={e => setEditForm({ ...editForm, skills: e.target.value })}
                  placeholder="e.g. Figma, Design Systems, UX Research, Mobile Wireframes, Interactive Prototyping"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Row 6: Bio Overview */}
              <div>
                <label className="block text-[11px] text-zinc-400 font-medium mb-1">Professional Bio & Experience</label>
                <textarea
                  rows={3}
                  value={editForm.bio}
                  onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Tell clients and autonomous AI agents about your experience, track record, and core expertise..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-400 leading-relaxed resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs border border-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Saving to Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Profile to Firestore</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
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
