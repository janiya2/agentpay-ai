'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, User, Send, Shield, Sparkles, CheckCircle2, DollarSign, Clock, 
  ArrowRight, ExternalLink, History, X, ChevronRight, Lock, MessageSquare, AlertCircle
} from 'lucide-react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import type { ChatMessage, ServiceProvider } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import DirectChatModal from '@/components/DirectChatModal';

export default function ChatInterface() {
  const { user, openAuthModal } = useAuth();

  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init_1',
      role: 'assistant',
      content: "Hello! I am your Autonomous AgentPay AI Commerce Agent. Tell me what service or digital deliverable you need (e.g. Next.js web application, Figma UI design, AI automation workflow, SEO, or video editing), and I will discover top-tier providers, negotiate terms, and set up your safe PayPal milestone escrow.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionPayload: {
        type: 'negotiation_proposal',
        isRealAI: true,
        modelUsed: 'gemini-2.5-flash'
      }
    }
  ]);
  const [input, setInput] = useState('');
  const [spendingLimit, setSpendingLimit] = useState(200);
  const [isLoading, setIsLoading] = useState(false);
  const [activePayPalOrder, setActivePayPalOrder] = useState<{
    orderId: string;
    paypalOrderId: string;
    amount: number;
    providerName: string;
    scopeTitle: string;
  } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ isRealAI: boolean; modelUsed: string }>({
    isRealAI: true,
    modelUsed: 'gemini-2.5-flash'
  });

  // Direct 1-on-1 Chat with Specialist State
  const [activeDirectChat, setActiveDirectChat] = useState<{
    channelId: string;
    orderTitle: string;
    providerName: string;
    isPurchasedOrder: boolean;
    bidPrice?: number;
    deliveryDays?: number;
    clientBudgetCap?: number;
  } | null>(null);

  // History Drawer State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize or restore session ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let stored = sessionStorage.getItem('agentpay_chat_session_id');
      if (!stored) {
        stored = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        sessionStorage.setItem('agentpay_chat_session_id', stored);
      }
      setSessionId(stored);
    }
  }, []);

  const handleNewSession = () => {
    const newSid = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('agentpay_chat_session_id', newSid);
    }
    setSessionId(newSid);
    setMessages([
      {
        id: `init_${Date.now()}`,
        role: 'assistant',
        content: "New Autonomous Session Initialized. What service or deliverable would you like to procure and negotiate today within your spending limit?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionPayload: {
          type: 'negotiation_proposal',
          isRealAI: true,
          modelUsed: 'gemini-2.5-flash'
        }
      }
    ]);
    setActivePayPalOrder(null);
    setPaymentSuccess(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activePayPalOrder]);

  // Load chat history from Firestore
  const fetchChatHistory = async () => {
    setLoadingHistory(true);
    setIsHistoryOpen(true);
    try {
      const q = query(
        collection(db, 'agentpay_chat_sessions'),
        orderBy('updatedAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistorySessions(sessions);
    } catch (err) {
      console.warn('Failed to load chat sessions:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const resumeSession = (session: any) => {
    setSessionId(session.id);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('agentpay_chat_session_id', session.id);
    }
    if (Array.isArray(session.messages) && session.messages.length > 0) {
      setMessages(session.messages);
    }
    if (session.spendingLimit) {
      setSpendingLimit(session.spendingLimit);
    }
    if (session.negotiatedDeal) {
      setActivePayPalOrder(session.paypalOrderId ? {
        orderId: session.orderRefId || session.id,
        paypalOrderId: session.paypalOrderId,
        amount: session.negotiatedDeal.negotiatedPrice,
        providerName: session.negotiatedDeal.providerName,
        scopeTitle: session.negotiatedDeal.scopeTitle
      } : null);
    } else {
      setActivePayPalOrder(null);
    }
    setIsHistoryOpen(false);
  };

  // Provider 1-Click Auto Accept
  const handleProviderAutoAccept = async (targetSessionId?: string) => {
    const sid = targetSessionId || sessionId;
    if (!sid) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/providers/respond-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          action: 'accept'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
        if (data.paypalOrderId) {
          const lastMsg = data.messages?.[data.messages.length - 1];
          const deal = lastMsg?.actionPayload?.negotiatedTerms;
          setActivePayPalOrder({
            orderId: data.orderRefId || `ord_${Date.now()}`,
            paypalOrderId: data.paypalOrderId,
            amount: data.amount || deal?.negotiatedPrice || 160,
            providerName: deal?.providerName || 'Specialist',
            scopeTitle: deal?.scopeTitle || 'Milestone Contract'
          });
        }
      } else {
        alert(`Notice: ${data.error || 'Failed to auto-accept'}`);
      }
    } catch (err: any) {
      console.warn('Auto accept error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Award Contract to a specific Specialist Bid (Autonomous Reverse Auction Winner)
  const handleAwardBid = async (targetSessionId: string, providerId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/agent/award-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: targetSessionId || sessionId,
          providerId
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
        if (data.paypalOrderId && data.winningBid) {
          setActivePayPalOrder({
            orderId: data.orderRefId || `ord_${Date.now()}`,
            paypalOrderId: data.paypalOrderId,
            amount: data.winningBid.bidPrice || data.winningBid.amount || 160,
            providerName: data.winningBid.providerName || data.winningBid.name || 'Specialist',
            scopeTitle: data.winningBid.serviceTitle || 'Milestone Contract'
          });
        }
      } else {
        alert(data.error || 'Failed to award contract');
      }
    } catch (err: any) {
      console.warn('Award bid error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Simulation Helper for Hackathon Judges / Evaluators
  const handleSimulateProviderBid = async (
    targetSessionId: string, 
    providerId: string, 
    bidPrice: number, 
    deliveryDays: number = 3, 
    note?: string
  ) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/providers/submit-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: targetSessionId || sessionId,
          providerId,
          bidPrice,
          deliveryDays,
          note: note || `I have verified capacity and will deliver within ${deliveryDays} days with full documentation.`
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const snap = await getDoc(doc(db, 'agentpay_chat_sessions', targetSessionId || sessionId));
        if (snap.exists()) {
          const sData = snap.data();
          if (Array.isArray(sData.messages)) {
            setMessages(sData.messages);
          }
        }
      } else {
        alert(data.error || 'Simulation notice');
      }
    } catch (err: any) {
      console.warn('Simulate bid error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-sync polling while waiting for provider to respond or submit bids in Provider Workspace
  useEffect(() => {
    const isAwaiting = messages.some(
      m => m.actionPayload?.inquiryStatus === 'awaiting_provider' || 
           m.actionPayload?.tenderStatus === 'tender_open' ||
           m.actionPayload?.type === 'tender_dispatched'
    );
    if (!isAwaiting || !sessionId) return;

    const interval = setInterval(async () => {
      try {
        const snap = await getDoc(doc(db, 'agentpay_chat_sessions', sessionId));
        if (snap.exists()) {
          const sData = snap.data();
          if (Array.isArray(sData.messages)) {
            const lastCurrentMsg = messages[messages.length - 1];
            const currentBidsCount = lastCurrentMsg?.actionPayload?.bids?.length || 0;
            const newBidsCount = sData.bids?.length || 0;
            const isStatusChanged = sData.status === 'closed_awarded' && lastCurrentMsg?.actionPayload?.tenderStatus !== 'closed_awarded';

            if (newBidsCount !== currentBidsCount || isStatusChanged || sData.messages.length > messages.length) {
              setMessages(sData.messages);
              if (sData.status === 'closed_awarded' && sData.paypalOrderId && sData.winningBid) {
                setActivePayPalOrder({
                  orderId: sData.orderRefId || sessionId,
                  paypalOrderId: sData.paypalOrderId,
                  amount: sData.winningBid.bidPrice || sData.winningBid.amount || 160,
                  providerName: sData.winningBid.providerName || 'Specialist',
                  scopeTitle: sData.projectScope || 'Milestone Contract'
                });
              }
            }
          }
        }
      } catch (err) {
        // ignore
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [messages, sessionId]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || isLoading) return;

    // Auto-auth prompt check if user isn't logged in and wants to negotiate
    const isNegotiateIntent = textToSend.toLowerCase().includes('proceed with') || textToSend.toLowerCase().includes('negotiate');
    if (isNegotiateIntent && !user) {
      openAuthModal();
      return;
    }

    const currentSid = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (!sessionId) setSessionId(currentSid);

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSid,
          messages: [...messages, userMsg],
          spendingLimit,
          buyerName: user?.name || 'Janitha Dilshan',
          buyerEmail: user?.email || 'janithad2@gmail.com'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to communicate with AI Agent.');
      }

      const decision = data.agentDecision;
      const isTender = decision?.intent === 'tender_dispatched';
      const isNegotiationOrCheckout = decision?.intent === 'checkout_ready' || !!decision?.negotiatedDeal || !!data.paypalOrderId;

      if (typeof data.isRealAI === 'boolean') {
        setAiStatus({ isRealAI: data.isRealAI, modelUsed: data.modelUsed || 'gemini-2.5-flash' });
      }

      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: decision?.reply || data.fallbackReply || "I have analyzed your request.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionPayload: {
          type: isTender ? 'tender_dispatched' : (isNegotiationOrCheckout ? 'paypal_checkout' : data.matchedProviders?.length ? 'search_results' : 'negotiation_proposal'),
          tenderStatus: isTender ? 'tender_open' : undefined,
          targetProviders: decision?.targetProviders || null,
          bids: decision?.bids || [],
          matchedProviders: (isNegotiationOrCheckout || isTender) ? [] : data.matchedProviders,
          negotiatedTerms: decision?.negotiatedDeal,
          negotiationDialog: decision?.negotiationDialog,
          paypalOrderId: data.paypalOrderId,
          amount: decision?.negotiatedDeal?.negotiatedPrice,
          isRealAI: data.isRealAI,
          modelUsed: data.modelUsed
        }
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If PayPal order was triggered, set it for interactive checkout
      if (decision?.negotiatedDeal && data.paypalOrderId) {
        setActivePayPalOrder({
          orderId: data.orderRefId || `ord_${Date.now()}`,
          paypalOrderId: data.paypalOrderId || `PAYPAL_SANDBOX_${Date.now()}`,
          amount: decision.negotiatedDeal.negotiatedPrice,
          providerName: decision.negotiatedDeal.providerName,
          scopeTitle: decision.negotiatedDeal.scopeTitle
        });
      }

    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'system',
          content: `⚠️ Connection notice: ${err.message || 'AI request failed'}. Please check Gemini API key in Admin.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayPalCapture = async (paypalOrderId: string) => {
    if (!activePayPalOrder) return;

    try {
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paypalOrderId,
          orderId: activePayPalOrder.orderId
        })
      });

      const captureData = await res.json();

      if (captureData.success) {
        setPaymentSuccess(true);
        setActivePayPalOrder(null);

        setMessages((prev) => [
          ...prev,
          {
            id: `sys_${Date.now()}`,
            role: 'assistant',
            content: `🎉 Payment successfully verified via PayPal Orders v2! $${captureData.amount || activePayPalOrder.amount} USD is securely locked in Milestone Escrow. A transactional notification has been dispatched to ${activePayPalOrder.providerName}. You can track and release milestones in the Escrow Vault page.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        alert(`PayPal Capture Warning: ${captureData.error}`);
      }
    } catch (err: any) {
      console.error('Capture error:', err);
    }
  };

  return (
    <div className="relative flex flex-col h-[750px] w-full max-w-5xl mx-auto rounded-3xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-2xl shadow-2xl overflow-hidden">
      {/* Top Protocol Header & Spending Guardrail */}
      <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Bot className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">AgentPay Autonomous Room</h2>
              {aiStatus.isRealAI ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Gemini AI ({aiStatus.modelUsed})
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-400 font-mono flex items-center gap-1.5" title="Add a valid Gemini key in /admin to activate Live AI">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Offline Rule Engine
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">Zero-Mock Multi-Turn Negotiation & PayPal Escrow</p>
          </div>
        </div>

        {/* Action Buttons & Safe Spending Guardrail */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          {/* Transcript History Button */}
          <button
            onClick={fetchChatHistory}
            title="Browse previous negotiation sessions and transcripts"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            <History className="h-3.5 w-3.5 text-cyan-400" />
            <span>Chat History</span>
          </button>

          {/* New Session Button */}
          <button
            onClick={handleNewSession}
            title="Start fresh procurement session"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>New Session</span>
          </button>

          {/* Spending Limit Guardrail */}
          <div className="w-full sm:w-64 px-3.5 py-2 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-zinc-400 font-medium text-[11px]">
                <Shield className="h-3 w-3 text-cyan-400" />
                <span>Budget Cap:</span>
              </span>
              <span className="font-mono font-bold text-cyan-300">${spendingLimit} USD</span>
            </div>
            <input
              type="range"
              min="30"
              max="1000"
              step="10"
              value={spendingLimit}
              onChange={(e) => setSpendingLimit(Number(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Guest Client Notice Banner (When user is not signed in) */}
      {!user && (
        <div className="px-4 py-2 bg-gradient-to-r from-blue-950/40 via-cyan-950/40 to-purple-950/40 border-b border-cyan-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px]">
              Browsing as Guest. Sign in with <strong className="text-white">1-Click Judge Access</strong> or Google to bind milestone escrow orders to your account.
            </span>
          </div>
          <button
            onClick={openAuthModal}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-[11px] border border-cyan-500/40 transition-all cursor-pointer shrink-0"
          >
            1-Click Sign In
          </button>
        </div>
      )}

      {/* Chat Messages Body */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.role === 'user'
                  ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-zinc-950'
                  : 'bg-zinc-800 border border-zinc-700 text-cyan-400'
              }`}
            >
              {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            <div className={`space-y-3 max-w-[85%] sm:max-w-[75%]`}>
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan-600/20 text-cyan-50 border border-cyan-500/30 rounded-tr-none'
                    : 'bg-zinc-900/90 text-zinc-200 border border-zinc-800/80 rounded-tl-none shadow-md'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-2 font-mono pt-1.5 border-t border-zinc-800/60">
                  {msg.role === 'assistant' ? (
                    msg.actionPayload?.isRealAI ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <Sparkles className="h-3 w-3 text-emerald-400" />
                        Live Neural AI ({msg.actionPayload.modelUsed || 'gemini-2.5-flash'})
                      </span>
                    ) : (
                      <span className="text-amber-400/90 flex items-center gap-1 font-semibold" title="Configure active key in /admin for Live AI">
                        <span>⚠️ Offline Fallback Mode</span>
                      </span>
                    )
                  ) : (
                    <span />
                  )}
                  <span>{msg.timestamp}</span>
                </div>
              </div>

              {/* 1. Matched Providers Discovery Cards */}
              {msg.actionPayload?.matchedProviders && msg.actionPayload.matchedProviders.length > 0 && msg.actionPayload.type !== 'paypal_checkout' && msg.actionPayload.type !== 'tender_dispatched' && (
                <div className="space-y-3 pt-2">
                  {/* Master Dispatch Tender Button */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/60 via-cyan-950/40 to-indigo-950/60 border border-cyan-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          Autonomous RFQ Reverse Auction Protocol
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">3 Top Specialists Found</span>
                        </h4>
                        <p className="text-[10px] text-zinc-400">
                          Transmit requirements to all 3 specialists simultaneously. Compare their incoming milestone bids and award the contract to the best offer.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!user) {
                          openAuthModal();
                          return;
                        }
                        handleSend(`Dispatch autonomous tender to top 3 specialists for my project within my $${spendingLimit} budget.`);
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-950/40 transition-all cursor-pointer shrink-0"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span>🚀 Dispatch Tender to All 3 Specialists</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {msg.actionPayload.matchedProviders.map((prov) => (
                      <div
                        key={prov.id}
                        className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-cyan-500/40 transition-all text-xs space-y-2 group shadow-md"
                      >
                        <div className="flex items-center gap-2.5">
                          <img src={prov.avatarUrl} alt={prov.name} className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700" />
                          <div>
                            <h4 className="font-bold text-white group-hover:text-cyan-300 transition-colors">{prov.name}</h4>
                            <p className="text-[10px] text-zinc-400 truncate max-w-[150px]">{prov.title}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[11px]">
                          <span className="text-zinc-400">⭐ {prov.rating} ({prov.reviewCount})</span>
                          <span className="font-mono font-bold text-emerald-400">${prov.hourlyRate}/hr</span>
                        </div>
                        <div className="pt-0.5">
                          {prov.autoBiddingEnabled !== false ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-bold">
                              <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
                              Instant AI Delegate Active
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-bold">
                              <Clock className="h-2.5 w-2.5 text-amber-400" />
                              Manual Bids Only (24h SLA)
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (!user) {
                              openAuthModal();
                              return;
                            }
                            handleSend(`I want to proceed with ${prov.name} for my project within my $${spendingLimit} budget.`);
                          }}
                          className="w-full py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Bot className="h-3.5 w-3.5 text-cyan-400" />
                          <span>Select {prov.name.split(' ')[0]}</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Autonomous RFQ Protocol & Live Competing Bids Board */}
              {msg.actionPayload?.targetProviders && msg.actionPayload.targetProviders.length > 0 && (
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/95 border border-cyan-500/30 text-xs space-y-4 shadow-xl backdrop-blur-md">
                  {/* Board Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${msg.actionPayload.tenderStatus === 'closed_awarded' ? 'bg-emerald-400' : 'bg-cyan-400 animate-ping'}`} />
                      <div>
                        <h4 className="font-mono font-bold text-cyan-300 uppercase tracking-wider text-xs flex items-center gap-1.5">
                          <Bot className="h-4 w-4 text-cyan-400" />
                          Autonomous RFQ Tender & Competing Bids Board
                        </h4>
                        <p className="text-[10px] text-zinc-400">
                          {msg.actionPayload.tenderStatus === 'closed_awarded' 
                            ? 'Contract awarded and escrow funded. Competing inquiries locked.'
                            : 'Tender open to 3 top specialists. Reviewing scope and awaiting competitive bids.'}
                        </p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border font-bold ${
                      msg.actionPayload.tenderStatus === 'closed_awarded'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                    }`}>
                      {msg.actionPayload.tenderStatus === 'closed_awarded' ? '🏆 Contract Awarded' : '⏳ Tender Open for Bids'}
                    </span>
                  </div>

                  {/* Tendered Specialists Strip */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">
                      Tender Transmitted To 3 Specialists:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {msg.actionPayload.targetProviders.map((tp: any) => {
                        const hasBid = (msg.actionPayload?.bids || []).some((b: any) => b.providerId === tp.id);
                        const isWon = msg.actionPayload?.tenderStatus === 'closed_awarded' && (msg.actionPayload?.winningBid?.providerId === tp.id || tp.status === 'awarded');
                        const isLateClosed = msg.actionPayload?.tenderStatus === 'closed_awarded' && !isWon;

                        return (
                          <div 
                            key={tp.id} 
                            className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                              isWon 
                                ? 'bg-emerald-950/30 border-emerald-500/50' 
                                : isLateClosed 
                                ? 'bg-zinc-900/40 border-zinc-800/80 opacity-60' 
                                : hasBid
                                ? 'bg-cyan-950/20 border-cyan-500/40'
                                : 'bg-zinc-900/60 border-zinc-800'
                            }`}
                          >
                            <img src={tp.avatarUrl} alt={tp.name} className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white text-[11px] truncate">{tp.name}</span>
                              </div>
                              <p className="text-[9px] text-zinc-400 truncate">{tp.title}</p>
                              <div className="pt-1">
                                {isWon ? (
                                  <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1 font-mono">
                                    <CheckCircle2 className="h-2.5 w-2.5" /> Won & Awarded
                                  </span>
                                ) : isLateClosed ? (
                                  <span className="text-[9px] font-mono text-rose-400 flex items-center gap-1">
                                    <AlertCircle className="h-2.5 w-2.5" /> Closed (Late)
                                  </span>
                                ) : hasBid ? (
                                  <span className="text-[9px] font-bold text-cyan-400 flex items-center gap-1 font-mono">
                                    <CheckCircle2 className="h-2.5 w-2.5" /> Bid Received
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-mono text-amber-400 flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5 animate-spin" /> Reviewing Scope...
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Competing Bids List */}
                  <div className="space-y-2 pt-1 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">
                        Received Milestone Bids ({msg.actionPayload.bids?.length || 0}):
                      </span>
                      {msg.actionPayload.tenderStatus !== 'closed_awarded' && (
                        <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                          Streaming live from Provider Workspaces
                        </span>
                      )}
                    </div>

                    {(!msg.actionPayload.bids || msg.actionPayload.bids.length === 0) ? (
                      <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-center space-y-1">
                        <Clock className="h-5 w-5 text-amber-400 mx-auto animate-pulse" />
                        <p className="text-zinc-300 font-medium text-[11px]">Awaiting bids from tendered specialists...</p>
                        <p className="text-zinc-500 text-[10px]">
                          Specialists have been notified via Resend email. You can also open the Provider Workspace in another tab or use the quick-test buttons below.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {msg.actionPayload.bids.map((bid: any) => {
                          const isWinner = msg.actionPayload?.winningBid?.providerId === bid.providerId;
                          const isClosedOther = msg.actionPayload?.tenderStatus === 'closed_awarded' && !isWinner;

                          return (
                            <div
                              key={bid.providerId}
                              className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                                isWinner 
                                  ? 'bg-gradient-to-r from-emerald-950/30 to-teal-950/30 border-emerald-500/50 shadow-lg' 
                                  : isClosedOther
                                  ? 'bg-zinc-900/30 border-zinc-800 opacity-60'
                                  : 'bg-zinc-900/80 border-cyan-500/30 hover:border-cyan-400'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                                <div className="flex items-center gap-2.5">
                                  {bid.providerAvatar && (
                                    <img src={bid.providerAvatar} alt={bid.providerName} className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700" />
                                  )}
                                  <div>
                                    <span className="font-bold text-white text-xs">{bid.providerName}</span>
                                    <span className="text-[10px] text-zinc-400 block font-mono">
                                      Turnaround: <strong className="text-zinc-200">{bid.deliveryDays} Days</strong> • Submitted {bid.submittedAt}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="font-mono font-black text-emerald-400 text-base">
                                    ${bid.bidPrice} USD
                                  </span>
                                  {isWinner ? (
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/40">
                                      🏆 Awarded
                                    </span>
                                  ) : isClosedOther ? (
                                    <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-500 text-[10px]">
                                      Outbid / Closed
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setActiveDirectChat({
                                          channelId: `${sessionId}_${bid.providerId}`,
                                          orderTitle: `${bid.providerTitle || 'Digital Milestone'} Contract`,
                                          providerName: bid.providerName,
                                          isPurchasedOrder: false,
                                          bidPrice: bid.bidPrice,
                                          deliveryDays: bid.deliveryDays,
                                          clientBudgetCap: spendingLimit
                                        })}
                                        className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold text-[11px] border border-zinc-700 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                        title="Chat directly with specialist before awarding"
                                      >
                                        <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                                        <span>Chat</span>
                                      </button>

                                      <button
                                        onClick={() => handleAwardBid(sessionId, bid.providerId)}
                                        disabled={isLoading}
                                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-bold text-[11px] flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        <span>Award & Pay</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <p className="text-zinc-300 text-[11px] italic pl-1">
                                &quot;{bid.note}&quot;
                              </p>

                              {bid.milestones && bid.milestones.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                  {bid.milestones.map((m: any, mIdx: number) => (
                                    <div key={mIdx} className="p-2 rounded-lg bg-zinc-950/70 border border-zinc-800 flex items-center justify-between text-[10px]">
                                      <span className="text-zinc-300 truncate max-w-[130px]">{m.title}</span>
                                      <span className="font-mono font-bold text-cyan-400">${m.amount}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Evaluator Controls: Workspace Links & 1-Click Simulation */}
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <a
                        href="/providers"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Open Provider Workspace (/providers)</span>
                      </a>
                      <span className="text-zinc-600">|</span>
                      <span className="text-zinc-400">Quick Test:</span>
                    </div>

                    {msg.actionPayload.tenderStatus !== 'closed_awarded' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleSimulateProviderBid(sessionId, 'prov_1001', 160, 3, 'I can start immediately and deliver in 3 days.')}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 font-semibold border border-cyan-800/80 cursor-pointer transition-all"
                        >
                          ⚡ Auto-Bid Daniel ($160)
                        </button>
                        <button
                          onClick={() => handleSimulateProviderBid(sessionId, 'prov_1002', 150, 4, 'Full Next.js setup with test coverage included.')}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-300 font-semibold border border-purple-800/80 cursor-pointer transition-all"
                        >
                          ⚡ Auto-Bid Kasun ($150)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. Autonomous Multi-Agent Protocol Channel (Direct Bot-to-Provider Dialogue) */}
              {msg.actionPayload?.negotiationDialog && msg.actionPayload.negotiationDialog.length > 0 && (
                <div className="p-4 rounded-2xl bg-zinc-950/95 border border-cyan-500/30 text-xs space-y-3 shadow-xl backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${msg.actionPayload.inquiryStatus === 'awaiting_provider' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                      <span className="font-mono font-bold text-cyan-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-cyan-400" />
                        Autonomous Agent-to-Provider Protocol Channel
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      msg.actionPayload.inquiryStatus === 'awaiting_provider'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {msg.actionPayload.inquiryStatus === 'awaiting_provider' ? '⏳ Awaiting Provider Response' : 'Agreement Codified'}
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {msg.actionPayload.negotiationDialog.map((dialog, dIdx) => (
                      <div
                        key={dIdx}
                        className={`p-3 rounded-xl text-xs space-y-1 transition-all ${
                          dialog.speaker === 'agent'
                            ? 'bg-cyan-950/30 border border-cyan-500/30 text-cyan-100 ml-0 mr-4'
                            : 'bg-purple-950/30 border border-purple-500/30 text-purple-100 ml-4 mr-0'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className={dialog.speaker === 'agent' ? 'text-cyan-400 font-mono flex items-center gap-1' : 'text-purple-300 font-mono flex items-center gap-1'}>
                            {dialog.speakerName}
                          </span>
                          <span className="text-zinc-500 font-mono text-[9px]">{dialog.timestamp || 'Just now'}</span>
                        </div>
                        <p className="text-zinc-200 text-[11.5px] leading-relaxed whitespace-pre-wrap">{dialog.message}</p>
                      </div>
                    ))}
                  </div>

                  {/* Awaiting Provider Interactive Controls */}
                  {msg.actionPayload.inquiryStatus === 'awaiting_provider' && (
                    <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2.5 mt-2">
                      <div className="flex items-center justify-between text-[11px] text-amber-300">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-400" />
                          <span>Proposal sent to {msg.actionPayload.providerName || 'Specialist'}&apos;s Workspace & Email</span>
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">Dual-Sided Sync Active</span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                        <a
                          href={`/providers?providerId=${msg.actionPayload.providerId || 'prov_1001'}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full sm:w-auto flex-1 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />
                          <span>Open Provider Workspace (Respond as {msg.actionPayload.providerName?.split(' ')[0] || 'Specialist'})</span>
                        </a>

                        <button
                          onClick={() => handleProviderAutoAccept(sessionId)}
                          disabled={isLoading}
                          className="w-full sm:w-auto py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>⚡ 1-Click Auto-Accept as Provider</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Autonomous Negotiation Agreement Summary */}
              {msg.actionPayload?.negotiatedTerms && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 to-blue-950/30 border border-purple-500/40 text-xs space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                    <span className="font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                      <span>Autonomous Negotiation Breakdown</span>
                    </span>
                    <span className="font-mono text-emerald-400 font-black text-sm">
                      ${msg.actionPayload.negotiatedTerms.negotiatedPrice || msg.actionPayload.amount} USD
                    </span>
                  </div>

                  <div className="space-y-2 text-zinc-300 text-[11px]">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Selected Specialist: <strong className="text-white">{msg.actionPayload.negotiatedTerms.providerName}</strong></span>
                      {msg.actionPayload.negotiatedTerms.originalPrice && (
                        <span>Standard Quote: <span className="line-through text-zinc-500">${msg.actionPayload.negotiatedTerms.originalPrice}</span></span>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] uppercase font-mono text-zinc-400 font-semibold">Structured Milestone Tranches:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.actionPayload.negotiatedTerms.milestones?.map((m: any, mIdx: number) => (
                          <div key={mIdx} className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-[11px]">
                            <span className="text-zinc-200 font-medium truncate max-w-[140px]">{m.title}</span>
                            <span className="font-mono font-bold text-cyan-400">${m.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live Active PayPal Checkout Bubble */}
        {activePayPalOrder && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-blue-950/40 border border-cyan-500/40 shadow-xl space-y-4 max-w-lg mx-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">PayPal Smart Checkout Ready</span>
              </div>
              <span className="font-mono font-black text-amber-300 text-sm">${activePayPalOrder.amount} USD</span>
            </div>

            <div className="text-xs text-zinc-300 space-y-1">
              <p><strong className="text-zinc-400">Deliverable:</strong> {activePayPalOrder.scopeTitle}</p>
              <p><strong className="text-zinc-400">Provider:</strong> {activePayPalOrder.providerName}</p>
              <p className="text-[11px] text-zinc-500">Milestone escrow protected. Funds are captured securely on PayPal Sandbox.</p>
            </div>

            {/* Official PayPal Button & 1-Click Sandbox Authorization */}
            <div className="pt-2 space-y-2">
              <PayPalButtons
                style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                createOrder={async () => activePayPalOrder.paypalOrderId}
                onApprove={async (data) => {
                  await handlePayPalCapture(data.orderID);
                }}
                onError={(err) => {
                  console.warn('PayPal Sandbox notice:', err);
                }}
              />
              <button
                onClick={() => handlePayPalCapture(activePayPalOrder.paypalOrderId)}
                className="w-full py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>🛡️ 1-Click Authorize Sandbox Escrow (${activePayPalOrder.amount} USD)</span>
              </button>
            </div>
          </div>
        )}

        {paymentSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-bold">PayPal Milestone Escrow Active!</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Order committed to Firestore and provider notified via email. View in Escrow Vault.</p>
            </div>
          </div>
        )}

        {/* Real-Time AI Analysis & Procurement Reasoning Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3.5 animate-fadeIn">
            <div className="h-9 w-9 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-950/50">
              <Bot className="h-4 w-4 animate-spin text-cyan-300" />
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-cyan-500/30 rounded-tl-none shadow-xl space-y-2 max-w-[85%] sm:max-w-[70%]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-mono font-bold text-cyan-300">
                  Gemini 2.5 Flash Analyzing Scope & Providers...
                </span>
              </div>
              <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" />
                </div>
                <span className="text-zinc-500 text-[10px] font-mono">Autonomous procurement protocol active</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2 border-t border-zinc-800/60 bg-zinc-950/40 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
        <span className="text-zinc-500 shrink-0 font-medium">Try asking:</span>
        <button
          onClick={() => handleSend("I need a Next.js 15 developer to build a modern dashboard for under $120.")}
          className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 shrink-0 transition-colors"
        >
          💻 Next.js Dashboard ($120)
        </button>
        <button
          onClick={() => handleSend("Find me a Figma UI/UX designer for an e-commerce mobile app with a $80 budget.")}
          className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 shrink-0 transition-colors"
        >
          🎨 Figma Mobile App ($80)
        </button>
        <button
          onClick={() => handleSend("I want an autonomous AI automation engineer to build an n8n webhook workflow for $150.")}
          className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 shrink-0 transition-colors"
        >
          🤖 AI Automation Workflow ($150)
        </button>
      </div>

      {/* Input Bar */}
      <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={user ? `Speak to your agent as ${user.name.split(' ')[0]}: 'Find me a Next.js dev under $150'...` : "Speak to your agent: 'Find me a Next.js dev under $150'..."}
          disabled={isLoading}
          className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-50"
        />
        <button
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim()}
          className="h-11 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 disabled:opacity-40 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all shrink-0 cursor-pointer"
        >
          {isLoading ? <span className="animate-spin">⏳</span> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>

      {/* Sliding Negotiation History Drawer */}
      {isHistoryOpen && (
        <div className="absolute inset-0 z-30 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md h-full bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl overflow-hidden animate-slideLeft">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-2.5">
                <History className="h-4 w-4 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Negotiation Transcripts</h3>
                  <p className="text-[10px] text-zinc-400">All autonomous multi-agent sessions stored in Firestore</p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar">
              {loadingHistory ? (
                <div className="py-20 text-center text-xs text-zinc-500">
                  <span className="animate-spin inline-block mr-2">⏳</span> Loading Firestore transcripts...
                </div>
              ) : historySessions.length === 0 ? (
                <div className="py-20 text-center text-xs text-zinc-500 space-y-1">
                  <p>No past chat sessions found.</p>
                  <p className="text-[11px] text-zinc-600">Start a chat and your sessions will appear here automatically.</p>
                </div>
              ) : (
                historySessions.map((sess) => {
                  const isCurrent = sess.id === sessionId;
                  return (
                    <div
                      key={sess.id}
                      className={`p-3.5 rounded-2xl border transition-all space-y-2.5 text-xs ${
                        isCurrent
                          ? 'bg-cyan-950/20 border-cyan-500/50 shadow-md'
                          : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-zinc-400">
                          {sess.id.replace('session_', '#').substring(0, 16)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          sess.status === 'escrow_created'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : sess.status === 'negotiated'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}>
                          {sess.status === 'escrow_created' ? 'Escrow Active' : sess.status === 'negotiated' ? 'Negotiated' : 'Inquiry'}
                        </span>
                      </div>

                      {sess.providerMatched && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-300 font-semibold truncate max-w-[180px]">
                            Specialist: <strong className="text-cyan-300">{sess.providerMatched}</strong>
                          </span>
                          {sess.negotiatedPrice && (
                            <span className="font-mono font-black text-emerald-400">
                              ${sess.negotiatedPrice} USD
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-950/60 p-2 rounded-xl border border-zinc-800/50">
                        {sess.latestResponse || sess.latestPrompt || 'Session conversation transcript'}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                        <span>{sess.messageCount || sess.messages?.length || 1} messages</span>
                        <button
                          onClick={() => resumeSession(sess)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-cyan-500/20 text-zinc-200 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>{isCurrent ? 'Viewing' : 'Resume'}</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-3.5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
              <button
                onClick={() => {
                  handleNewSession();
                  setIsHistoryOpen(false);
                }}
                className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span>Start New Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct 1-on-1 Specialist Collaboration Modal */}
      {activeDirectChat && (
        <DirectChatModal
          isOpen={!!activeDirectChat}
          onClose={() => setActiveDirectChat(null)}
          channelId={activeDirectChat.channelId}
          orderTitle={activeDirectChat.orderTitle}
          currentUserRole="client"
          currentUserName={user?.name || 'Janitha Dilshan'}
          otherPartyName={activeDirectChat.providerName}
          isPurchasedOrder={activeDirectChat.isPurchasedOrder}
          bidPrice={activeDirectChat.bidPrice}
          deliveryDays={activeDirectChat.deliveryDays}
          clientBudgetCap={activeDirectChat.clientBudgetCap}
        />
      )}
    </div>
  );
}
